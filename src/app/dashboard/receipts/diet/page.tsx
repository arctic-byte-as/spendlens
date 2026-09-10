import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { hasFlag } from '@/lib/features'
import {
  getMonthlyDietCategoryTrend,
  type ReceiptAnalysisRow,
  type ReceiptItemAnalysisRow,
} from '@/lib/receipts/analysis'
import { DIET_CATEGORY_GROUPS, type DietCategoryGroup } from '@/lib/receipts/dietCategories'
import { dietTrendInsights, type DietCategoryVerdict } from '@/lib/ai/insights'
import { getFreshCachedInsights, writeInsightsCache } from '@/lib/receipts/insightsCache'

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

const panelTitle: React.CSSProperties = {
  fontFamily: 'Orbitron, sans-serif',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.3em',
  color: 'var(--muted)',
  textTransform: 'uppercase',
}

const actionButtonStyle: React.CSSProperties = {
  fontFamily: 'Orbitron, sans-serif',
  fontSize: '9px',
  letterSpacing: '0.2em',
  padding: '10px 24px',
  background: 'var(--prancing-horse)',
  color: 'white',
  textDecoration: 'none',
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`)
    .toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' })
    .toUpperCase()
}

function formatPct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

function formatDeltaPp(value: number | null): string {
  if (value === null) return '—'
  const pp = Math.round(value * 1000) / 10
  return `${pp > 0 ? '+' : ''}${pp}pp`
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

  const [{ data: receiptRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from('receipts')
      .select('receipt_id, date, chain, total_amount, currency')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
    supabase
      .from('receipt_items')
      .select('receipt_id, name, quantity, unit, total_price, bonus_percent, vat_percent, savings_amount, diet_category')
      .eq('user_id', user.id),
  ])

  const receipts = (receiptRows || []) as ReceiptAnalysisRow[]
  const items = (itemRows || []) as ReceiptItemAnalysisRow[]

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
  const months = Array.from(new Set(trend.map(row => row.month))).sort()

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
            return (
              <div key={category}>
                <div style={{ fontSize: '12px', color: 'var(--carbon)', marginBottom: '8px' }}>{category}</div>
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
