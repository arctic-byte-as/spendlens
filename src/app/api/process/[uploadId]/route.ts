import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import Papa from 'papaparse'
import { detectBankFormat, getColumnMapping, parseTransactions, sanitiseDescription } from '@/lib/csv/parse'
import { categoriseTransactions } from '@/lib/ai/categorise'
import { generateInsights } from '@/lib/ai/insights'

export async function POST(
  request: NextRequest,
  { params }: { params: { uploadId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uploadId } = params

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
      .from('csv-uploads')
      .download(upload.storage_path)

    if (downloadError || !fileData) {
      throw new Error('Failed to download CSV file')
    }

    const csvText = await fileData.text()

    // Parse CSV to detect format, then parse transactions
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true })
    const headers = parsed.meta.fields || []
    const format = detectBankFormat(headers)
    const mapping = getColumnMapping(format)
    const parsedTransactions = parseTransactions(csvText, mapping)

    if (parsedTransactions.length === 0) {
      await supabase.from('uploads').update({ status: 'error', row_count: 0 }).eq('id', uploadId)
      return NextResponse.json({ error: 'No transactions found in CSV' }, { status: 422 })
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

    const { data: insertedTxs, error: insertError } = await supabase
      .from('transactions')
      .insert(transactionRows)
      .select('id, description, amount')

    if (insertError) {
      throw new Error(`Failed to insert transactions: ${insertError.message}`)
    }

    // AI categorisation
    try {
      const toCategrise = (insertedTxs || []).map((tx: { id: string; description: string | null; amount: number }) => ({
        id: tx.id,
        description: tx.description || '',
        amount: tx.amount,
      }))
      const categories = await categoriseTransactions(toCategrise)

      // Update transactions with categories
      for (const result of categories) {
        await supabase.from('transactions').update({
          category: result.category,
          subcategory: result.subcategory,
          merchant: result.merchant,
          is_recurring: result.is_recurring,
        }).eq('id', result.id)
      }

      // Generate insights from spending totals
      const categoryTotals: Record<string, number> = {}
      for (const cat of categories) {
        const tx = (insertedTxs || []).find((t: { id: string; amount: number }) => t.id === cat.id)
        if (tx && tx.amount < 0) {
          categoryTotals[cat.category] = (categoryTotals[cat.category] || 0) + Math.abs(tx.amount)
        }
      }

      const tips = await generateInsights(categoryTotals)

      const periodDates = parsedTransactions.map(t => t.date).sort()
      await supabase.from('insights').insert({
        user_id: user.id,
        upload_id: uploadId,
        period_start: periodDates[0],
        period_end: periodDates[periodDates.length - 1],
        summary_json: { total_transactions: parsedTransactions.length, category_totals: categoryTotals },
        top_saving_tips: tips,
      })
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
