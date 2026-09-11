import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReceiptAnalysisRow, ReceiptItemAnalysisRow } from './analysis'

// PostgREST caps unpaginated selects at 1000 rows by default. A household with enough receipt
// history silently loses everything past that cap unless the fetch is paged explicitly — this
// paginates in fixed-size windows until a page comes back short.
const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  // Advance by the number of rows actually returned (not PAGE_SIZE) and keep going until a page
  // comes back empty, rather than stopping as soon as a page is "short". PostgREST projects can
  // enforce a smaller max-rows cap than PAGE_SIZE, which would otherwise make every page look
  // short and truncate the fetch early — the exact bug this pagination exists to avoid.
  for (;;) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...data)
    from += data.length
  }

  return rows
}

export async function fetchAllReceipts(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReceiptAnalysisRow[]> {
  return fetchAllRows<ReceiptAnalysisRow>((from, to) =>
    supabase
      .from('receipts')
      .select('receipt_id, date, chain, total_amount, currency')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  )
}

export async function fetchAllReceiptItems(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReceiptItemAnalysisRow[]> {
  return fetchAllRows<ReceiptItemAnalysisRow>((from, to) =>
    supabase
      .from('receipt_items')
      .select('receipt_id, name, quantity, unit, total_price, bonus_percent, vat_percent, savings_amount, diet_category')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, to),
  )
}
