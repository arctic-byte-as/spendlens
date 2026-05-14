import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import Papa from 'papaparse'
import { detectBankFormat, getColumnMapping, parseTransactions, sanitiseDescription } from '@/lib/csv/parse'
import type { ColumnMapping } from '@/lib/csv/parse'
import { categoriseTransactionBatches, type CategorisationResult } from '@/lib/ai/categorise'
import { generateInsights } from '@/lib/ai/insights'

const TRANSACTION_INSERT_BATCH = 500

function isColumnMapping(value: unknown): value is ColumnMapping {
  if (!value || typeof value !== 'object') return false
  const mapping = value as Partial<Record<keyof ColumnMapping, unknown>>
  const hasSingleAmount = typeof mapping.amount === 'string' && mapping.amount.length > 0
  const hasSplitAmount = typeof mapping.amountOut === 'string' && mapping.amountOut.length > 0
    && typeof mapping.amountIn === 'string' && mapping.amountIn.length > 0

  return typeof mapping.date === 'string'
    && mapping.date.length > 0
    && typeof mapping.description === 'string'
    && mapping.description.length > 0
    && (hasSingleAmount || hasSplitAmount)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { uploadId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uploadId } = params
  const body = await request.json().catch(() => null)
  const providedMapping = isColumnMapping(body?.mapping) ? body.mapping : null

  // Verify upload belongs to user
  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('user_id', user.id)
    .single()

  if (uploadError || !upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  try {
    // Download CSV from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(upload.storage_path)

    if (downloadError || !fileData) {
      throw new Error('Failed to download CSV file')
    }

    const csvText = await fileData.text()

    // Parse CSV to detect format, then parse transactions
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true })
    const headers = parsed.meta.fields || []
    const format = detectBankFormat(headers)
    const mapping = providedMapping || getColumnMapping(format, headers)
    const parsedTransactions = parseTransactions(csvText, mapping)

    if (parsedTransactions.length === 0) {
      await supabase.from('uploads').update({ status: 'error', row_count: 0 }).eq('id', uploadId)
      return NextResponse.json({
        error: 'No transactions found in CSV',
        details: `Detected columns: ${headers.join(', ') || 'none'}`,
      }, { status: 422 })
    }

    // Insert transactions
    const transactionRows = parsedTransactions.map(tx => ({
      user_id: user.id,
      upload_id: uploadId,
      date: tx.date,
      description: sanitiseDescription(tx.description),
      amount: tx.amount,
      currency: tx.currency || 'NOK',
    }))

    const insertedTxs: Array<{ id: string; description: string | null; amount: number }> = []
    for (let i = 0; i < transactionRows.length; i += TRANSACTION_INSERT_BATCH) {
      const { data: insertedBatch, error: insertError } = await supabase
        .from('transactions')
        .upsert(transactionRows.slice(i, i + TRANSACTION_INSERT_BATCH), {
          onConflict: 'user_id,date,amount,description,currency',
          ignoreDuplicates: true,
        })
        .select('id, description, amount')

      if (insertError) {
        throw new Error(`Failed to insert transactions: ${insertError.message}`)
      }

      insertedTxs.push(...(insertedBatch || []).map(tx => ({
        ...tx,
        amount: Number(tx.amount),
      })))
    }

    // AI categorisation
    try {
      const toCategorise = (insertedTxs || []).map((tx: { id: string; description: string | null; amount: number }) => ({
        id: tx.id,
        description: tx.description || '',
        amount: tx.amount,
      }))
      const categories: CategorisationResult[] = []

      // Fetch user-defined custom categories so the AI can recognise them
      const { data: userCats } = await supabase
        .from('user_categories')
        .select('name')
        .eq('user_id', user.id)
      const customCategories = (userCats || []).map(r => r.name)

      // Update existing transaction rows. Upsert is not appropriate here because
      // these partial rows do not include required insert columns like date/amount.
      for await (const batchResults of categoriseTransactionBatches(toCategorise, customCategories)) {
        for (const result of batchResults) {
          const { error: categoryUpdateError } = await supabase
            .from('transactions')
            .update({
              category: result.failed ? null : result.category,
              subcategory: result.subcategory,
              merchant: result.merchant,
              is_recurring: result.is_recurring,
              category_source: result.failed ? 'failed' : 'ai',
            })
            .eq('id', result.id)
            .eq('user_id', user.id)

          if (categoryUpdateError) {
            throw new Error(`Failed to update transaction category: ${categoryUpdateError.message}`)
          }
        }
        categories.push(...batchResults)
      }

      // Generate insights from spending totals
      const categoryTotals: Record<string, number> = {}
      for (const cat of categories) {
        if (cat.failed) continue
        const tx = (insertedTxs || []).find((t: { id: string; amount: number }) => t.id === cat.id)
        if (tx && tx.amount < 0) {
          categoryTotals[cat.category] = (categoryTotals[cat.category] || 0) + Math.abs(tx.amount)
        }
      }

      const tips = await generateInsights(categoryTotals)

      const periodDates = parsedTransactions.map(t => t.date).sort()
      const { error: insightInsertError } = await supabase.from('insights').insert({
        user_id: user.id,
        upload_id: uploadId,
        period_start: periodDates[0],
        period_end: periodDates[periodDates.length - 1],
        summary_json: { total_transactions: parsedTransactions.length, category_totals: categoryTotals },
        top_saving_tips: tips,
      })

      if (insightInsertError) {
        throw new Error(`Failed to insert insights: ${insightInsertError.message}`)
      }
    } catch (aiError) {
      console.error('AI categorisation error:', aiError)
      // Don't fail the whole process if AI fails
    }

    // Update upload status
    await supabase.from('uploads').update({
      status: 'done',
      row_count: parsedTransactions.length,
    }).eq('id', uploadId)

    return NextResponse.json({ success: true, count: parsedTransactions.length })
  } catch (error) {
    console.error('Processing error:', error)
    await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
