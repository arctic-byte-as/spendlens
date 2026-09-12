import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { hasFlag } from '@/lib/features'
import { getMonthlyDietCategoryTrend } from '@/lib/receipts/analysis'
import { fetchAllReceipts, fetchAllReceiptItems } from '@/lib/receipts/fetchAll'
import { DIET_CATEGORY_GROUPS, type DietCategoryGroup } from '@/lib/receipts/dietCategories'
import { dietTrendInsights, type DietCategoryVerdict } from '@/lib/ai/insights'
import { getFreshCachedInsights, writeInsightsCache } from '@/lib/receipts/insightsCache'
import { panelTitle, actionButtonStyle, monthLabel } from '../shared'

const SOURCE = 'diet_trend'

const GROUP_LABELS: Record<DietCategoryGroup | 'all', string> = {
  all: 'ALL',
  cut_out: 'CUT OUT',
  moderate: 'MODERATE',
  eat_more: 'EAT MORE',
  everyday: 'EVERYDAY',
}

const VERDICT_COLOR: Record<DietCategoryVerdict['verdict'], string> = {
  improving: 'var(--positive)',
  worsening: 'var(--prancing-horse)',
  flat: 'var(--muted)',
}

function formatPct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function formatDeltaPp(value: number | null): string {
  if (value === null) return '—'
  const pp = Math.round(value * 1000) / 10
  return `${pp > 0 ? '+' : ''}${pp}pp`
}

const SPARKLINE_WIDTH = 160
const SPARKLINE_HEIGHT = 32
const SPARKLINE_PAD = 3

// Compact SVG trend line for a category's share-of-spend across all months with data, in
// chronological order. No charting library — matches the rest of the app's pure-CSS/SVG bars.
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null

  const max = Math.max(...values, 0.0001)
  const innerW = SPARKLINE_WIDTH - SPARKLINE_PAD * 2
  const innerH = SPARKLINE_HEIGHT - SPARKLINE_PAD * 2
  const stepX = innerW / (values.length - 1)

  const points = values.map((v, i) => {
    const x = SPARKLINE_PAD + i * stepX
    const y = SPARKLINE_PAD + innerH - (v / max) * innerH
    return [x, y] as const
  })

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lastX, lastY] = points[points.length - 1]

  return (
    <svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  )
}

export default async function DietTrendPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('feature_flags')
    .eq('id', user.id)
    .maybeSingle()

  if (!hasFlag(profile, 'receipt_analysis')) {
    redirect('/dashboard')
  }

  const groupParam = searchParams?.group
  const activeGroup = (Array.isArray(groupParam) ? groupParam[0] : groupParam) as DietCategoryGroup | 'all' | undefined
  const forceRefresh = searchParams?.refresh === '1'

  const [receipts, items] = await Promise.all([
    fetchAllReceipts(supabase, user.id),
    fetchAllReceiptItems(supabase, user.id),
  ])

  if (receipts.length === 0) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        <div style={panelTitle}>Diet Trend</div>
        <div style={{ marginTop: '32px', textAlign: 'center', padding: '72px 24px', border: '1px solid var(--grid-line)' }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '14px' }}>
            NO RECEIPTS IMPORTED
          </div>
          <Link href="/dashboard/receipts/import" style={actionButtonStyle}>
            IMPORT RECEIPTS
          </Link>
        </div>
      </div>
    )
  }

  const trend = getMonthlyDietCategoryTrend(receipts, items)
  // Chronological order is needed for the sparkline path below; the month-by-month list further
  // down is shown newest-first since that's what someone checking "am I improving" wants to see
  // without scrolling.
  const monthsChronological = Array.from(new Set(trend.map(row => row.month))).sort()
  const months = [...monthsChronological].reverse()

  let verdicts: DietCategoryVerdict[] = []
  const cached = forceRefresh ? null : await getFreshCachedInsights(supabase, user.id, SOURCE)

  if (cached && Array.isArray(cached.summary_json?.verdicts)) {
    verdicts = cached.summary_json!.verdicts as DietCategoryVerdict[]
  } else {
    verdicts = await dietTrendInsights(trend)
    await writeInsightsCache(supabase, user.id, SOURCE, { summary_json: { verdicts } })
  }

  const categoriesInData = Array.from(new Set(trend.map(row => row.category))).filter(c => c !== 'Other')
  const visibleCategories = categoriesInData.filter(category => {
    if (!activeGroup || activeGroup === 'all') return true
    return DIET_CATEGORY_GROUPS[category] === activeGroup
  })

  const rowsByCategory = new Map<string, typeof trend>()
  for (const row of trend) {
    const list = rowsByCategory.get(row.category) ?? []
    list.push(row)
    rowsByCategory.set(row.category, list)
  }

  const verdictByCategory = new Map(verdicts.map(v => [v.category, v.verdict]))

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px', display: 'grid', gap: '36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={panelTitle}>Diet Trend</div>
        <Link href="/dashboard/receipts/diet?refresh=1" style={actionButtonStyle}>
          REFRESH VERDICTS
        </Link>
      </div>

      {verdicts.length > 0 && (
        <section>
          <div style={{ ...panelTitle, marginBottom: '16px' }}>AI Diet Verdicts</div>
          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {verdicts.map(v => (
              <div key={v.category} style={{ border: '1px solid var(--grid-line)', padding: '16px 18px', display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                    {v.category.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.1em', color: VERDICT_COLOR[v.verdict] }}>
                    {v.verdict.toUpperCase()}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--carbon)' }}>{v.summary}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['all', 'cut_out', 'moderate', 'eat_more', 'everyday'] as const).map(group => {
            const active = (activeGroup ?? 'all') === group
            return (
              <Link
                key={group}
                href={`/dashboard/receipts/diet?group=${group}`}
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '8px',
                  letterSpacing: '0.12em',
                  padding: '8px 14px',
                  border: '1px solid var(--grid-line)',
                  color: active ? 'white' : 'var(--carbon)',
                  background: active ? 'var(--prancing-horse)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                {GROUP_LABELS[group]}
              </Link>
            )
          })}
        </div>

        <div style={{ display: 'grid', gap: '20px' }}>
          {visibleCategories.map(category => {
            const rows = rowsByCategory.get(category) ?? []
            const sparklineValues = monthsChronological.map(
              month => rows.find(r => r.month === month)?.shareOfTotal ?? 0,
            )
            const verdict = verdictByCategory.get(category)
            const sparklineColor = verdict ? VERDICT_COLOR[verdict] : 'var(--bronze)'
            return (
              <div key={category}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--carbon)' }}>{category}</div>
                  <Sparkline values={sparklineValues} color={sparklineColor} />
                </div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {months.map(month => {
                    const row = rows.find(r => r.month === month)
                    const share = row?.shareOfTotal ?? 0
                    const delta = row?.shareDeltaVsPreviousMonth ?? null
                    return (
                      <div key={month} style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto auto', gap: '10px', alignItems: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.1em', color: 'var(--muted)' }}>{monthLabel(month)}</div>
                        <div style={{ position: 'relative', height: '6px', background: 'var(--grid-line)' }}>
                          <div style={{ position: 'absolute', inset: 0, width: `${Math.max(share * 100, share > 0 ? 1 : 0)}%`, background: 'var(--bronze)' }} />
                        </div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--carbon)', minWidth: '50px', textAlign: 'right' }}>{formatPct(share)}</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--muted)', minWidth: '60px', textAlign: 'right' }}>{formatDeltaPp(delta)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
