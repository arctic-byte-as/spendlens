import type { SupabaseClient } from '@supabase/supabase-js'

// Epic 7-E: both receiptInsights() and dietTrendInsights() cache in the shared `insights` table
// (upload_id: null — these are not tied to a single upload) using a "source" tag in summary_json
// to distinguish them, with a 24h TTL before recomputation.
export const INSIGHTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type CachedInsightsRow = {
  generated_at: string
  summary_json: Record<string, unknown> | null
  top_saving_tips: unknown
}

export async function getFreshCachedInsights(
  supabase: SupabaseClient,
  userId: string,
  source: string,
): Promise<CachedInsightsRow | null> {
  const { data, error } = await supabase
    .from('insights')
    .select('generated_at, summary_json, top_saving_tips')
    .eq('user_id', userId)
    .is('upload_id', null)
    .contains('summary_json', { source })
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const ageMs = Date.now() - new Date(data.generated_at).getTime()
  if (!Number.isFinite(ageMs) || ageMs > INSIGHTS_CACHE_TTL_MS) return null

  return data as CachedInsightsRow
}

export async function writeInsightsCache(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  fields: { summary_json?: Record<string, unknown>; top_saving_tips?: unknown },
): Promise<void> {
  const { error } = await supabase.from('insights').insert({
    user_id: userId,
    upload_id: null,
    summary_json: { ...(fields.summary_json || {}), source },
    top_saving_tips: fields.top_saving_tips ?? null,
  })

  if (error) {
    console.error(`Failed to cache ${source} insights:`, error)
  }
}
