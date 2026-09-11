import type { SupabaseClient } from '@supabase/supabase-js'

export type UploadSavingTip = {
  category?: string
  title?: string
  saving_amount?: number
  evidence?: string
}

/**
 * The shared `insights` table holds two unrelated kinds of rows: per-upload transaction
 * insights (`upload_id` set, written by /api/process and /api/uploads/[id]/recategorise) and
 * the receipt/diet-trend cache (`upload_id: null`, written by
 * src/lib/receipts/insightsCache.ts). Always read the former through this helper rather than
 * querying `insights` directly, so a future call site can't accidentally blend the receipt/diet
 * cache rows back in by ordering on `generated_at` without the `upload_id` filter.
 */
export async function getLatestUploadSavingTips(
  supabase: SupabaseClient,
  userId: string,
): Promise<UploadSavingTip[]> {
  const { data } = await supabase
    .from('insights')
    .select('top_saving_tips')
    .eq('user_id', userId)
    .not('upload_id', 'is', null)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const tips = data?.top_saving_tips
  return Array.isArray(tips) ? (tips as UploadSavingTip[]) : []
}
