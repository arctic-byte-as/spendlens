import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'
import { categoriseTransactionBatches, type CategorisationResult } from '@/lib/ai/categorise'
import { generateInsights } from '@/lib/ai/insights'
import { evaluateBillingGate } from '@/lib/billing/gate'

type TransactionForAi = {
  id: string
  date: string
  description: string | null
  amount: number | string
  category: string | null
  category_source: string | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthenticatedRouteContext()
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  const uploadId = params.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  const { count: completedUploads } = await supabase
    .from('uploads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'done')

  const gate = evaluateBillingGate({
    profile: {
      subscription_status: profile?.subscription_status ?? 'free',
      subscription_tier: profile?.subscription_tier ?? 'free',
    },
    completedUploads: completedUploads || 0,
    isInsightsRoute: true,
  })

  if (!gate.allowed) {
    return NextResponse.json({ error: gate.error }, { status: 402 })
  }

  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .select('id')
    .eq('id', uploadId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (uploadError) {
    console.error('Upload lookup failed:', uploadError)
    return NextResponse.json({ error: 'Failed to find upload' }, { status: 500 })
  }

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, date, description, amount, category, category_source')
    .eq('upload_id', uploadId)
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  if (txError) {
    console.error('Transaction lookup failed:', txError)
    return NextResponse.json({ error: 'Failed to load transactions' }, { status: 500 })
  }

  const rows = (transactions || []) as TransactionForAi[]
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No transactions found for upload' }, { status: 422 })
  }
  const aiRows = rows.filter(row => row.category_source !== 'user')

  await supabase.from('uploads').update({ status: 'processing' }).eq('id', uploadId).eq('user_id', user.id)

  try {
    const categories: CategorisationResult[] = []
    const transactionsToCategorise = aiRows.map(row => ({
      id: row.id,
      description: row.description || '',
      amount: Number(row.amount),
    }))

    // Fetch user-defined custom categories so the AI can recognise them
    const { data: userCats } = await supabase
      .from('user_categories')
      .select('name')
      .eq('user_id', user.id)
    const customCategories = (userCats || []).map(r => r.name)

    for await (const batchResults of categoriseTransactionBatches(transactionsToCategorise, customCategories)) {
      for (const result of batchResults) {
        const { error: updateError } = await supabase
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

        if (updateError) {
          throw new Error(`Failed to update transaction category: ${updateError.message}`)
        }
      }
      categories.push(...batchResults)
    }

    const categoryTotals: Record<string, number> = {}
    for (const row of rows) {
      const aiResult = categories.find(result => result.id === row.id)
      const category = row.category_source === 'user'
        ? row.category || 'OTHER'
        : aiResult && !aiResult.failed
          ? aiResult.category
          : row.category || 'OTHER'
      const amount = Number(row.amount || 0)
      if (amount < 0) {
        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(amount)
      }
    }

    const tips = await generateInsights(categoryTotals)
    const periodDates = rows.map(row => row.date).sort()

    const { error: deleteInsightError } = await supabase
      .from('insights')
      .delete()
      .eq('upload_id', uploadId)
      .eq('user_id', user.id)

    if (deleteInsightError) {
      throw new Error(`Failed to replace existing insights: ${deleteInsightError.message}`)
    }

    const { error: insightInsertError } = await supabase.from('insights').insert({
      user_id: user.id,
      upload_id: uploadId,
      period_start: periodDates[0],
      period_end: periodDates[periodDates.length - 1],
      summary_json: { total_transactions: rows.length, category_totals: categoryTotals },
      top_saving_tips: tips,
    })

    if (insightInsertError) {
      throw new Error(`Failed to insert insights: ${insightInsertError.message}`)
    }

    await supabase
      .from('uploads')
      .update({ status: 'done', row_count: rows.length })
      .eq('id', uploadId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, count: rows.length })
  } catch (error) {
    console.error('Recategorisation failed:', error)
    await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId).eq('user_id', user.id)
    return NextResponse.json({ error: 'Recategorisation failed' }, { status: 500 })
  }
}
