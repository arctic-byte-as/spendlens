import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'
import { hasFlag } from '@/lib/features'
import { parseReceiptsImportPayload } from './payload'

type ReceiptInsertRow = {
  user_id: string
  receipt_id: string
  date: string
  store: string
  chain: string
  total_amount: number
  total_bonus: number
  savings_summary: unknown
  currency: string
}

type ReceiptItemInsertRow = {
  user_id: string
  receipt_id: string
  item_guid: string
  name: string
  quantity: number
  unit: string | null
  total_price: number
  bonus: number
  bonus_percent: number
  vat_percent: number
  is_unknown: boolean
  savings_amount: number
}

const RECEIPT_BATCH_SIZE = 50
const ITEM_BATCH_SIZE = 500

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size))
  }
  return out
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedRouteContext()
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('feature_flags')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Profile lookup failed:', profileError)
    return NextResponse.json({ error: 'Failed to validate feature access' }, { status: 500 })
  }

  if (!hasFlag(profile, 'receipt_analysis')) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 })
  }

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON in request body' }, { status: 400 })
  }

  let parsed: ReturnType<typeof parseReceiptsImportPayload>
  try {
    parsed = parseReceiptsImportPayload(requestBody)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 },
    )
  }

  const receiptRowById = new Map<string, ReceiptInsertRow>()
  const itemRows: ReceiptItemInsertRow[] = []
  const receiptIds = new Set<string>()

  for (const receipt of parsed.receipts) {
    receiptIds.add(receipt.receiptId)
    receiptRowById.set(receipt.receiptId, {
      user_id: user.id,
      receipt_id: receipt.receiptId,
      date: receipt.date,
      store: receipt.store,
      chain: receipt.chain,
      total_amount: receipt.totalAmount,
      total_bonus: receipt.totalBonus,
      savings_summary: receipt.savingsSummary,
      currency: receipt.currency,
    })

    for (const item of receipt.items) {
      itemRows.push({
        user_id: user.id,
        receipt_id: receipt.receiptId,
        item_guid: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        total_price: item.totalPrice,
        bonus: item.bonus,
        bonus_percent: item.bonusPercent,
        vat_percent: item.vatPercent,
        is_unknown: item.isUnknownProduct,
        savings_amount: item.savingsAmount,
      })
    }
  }

  const receiptRows = Array.from(receiptRowById.values())

  const { data: existingReceipts, error: existingReceiptsError } = await supabase
    .from('receipts')
    .select('receipt_id')
    .eq('user_id', user.id)
    .in('receipt_id', Array.from(receiptIds))

  if (existingReceiptsError) {
    console.error('Existing receipt lookup failed:', existingReceiptsError)
    return NextResponse.json({ error: 'Failed to import receipts' }, { status: 500 })
  }

  const existingReceiptIds = new Set((existingReceipts || []).map(row => row.receipt_id))
  const newReceiptIds = new Set(
    Array.from(receiptIds).filter(receiptId => !existingReceiptIds.has(receiptId)),
  )
  const receiptRowsToInsert = receiptRows.filter(row => newReceiptIds.has(row.receipt_id))
  const itemRowsToInsert = itemRows.filter(row => newReceiptIds.has(row.receipt_id))

  const skipped = existingReceiptIds.size
  const imported = receiptRowsToInsert.length

  for (const batch of chunk(receiptRowsToInsert, RECEIPT_BATCH_SIZE)) {
    const { error } = await supabase
      .from('receipts')
      .upsert(batch, { onConflict: 'user_id,receipt_id' })

    if (error) {
      console.error('Receipt upsert failed:', error)
      return NextResponse.json({ error: 'Failed to import receipts' }, { status: 500 })
    }
  }

  for (const batch of chunk(itemRowsToInsert, ITEM_BATCH_SIZE)) {
    const { error } = await supabase
      .from('receipt_items')
      .upsert(batch, {
        onConflict: 'user_id,receipt_id,item_guid',
        ignoreDuplicates: true,
      })

    if (error) {
      console.error('Receipt item insert failed:', error)
      return NextResponse.json({ error: 'Failed to import receipt items' }, { status: 500 })
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    errors: [],
  })
}
