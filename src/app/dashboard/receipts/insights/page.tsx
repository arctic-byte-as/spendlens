import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { hasFlag } from '@/lib/features'
import {
  getCurrency,
  getMonthlyChainSpend,
  getMonthlyHealthRatio,
  getMonthlySavingsRate,
  getMonthlyVatSplit,
  getTopPurchasedItems,
} from '@/lib/receipts/analysis'
import { fetchAllReceipts, fetchAllReceiptItems } from '@/lib/receipts/fetchAll'
import { receiptInsights, type SavingTip } from '@/lib/ai/insights'
import { getFreshCachedInsights, writeInsightsCache } from '@/lib/receipts/insightsCache'
import { panelTitle, actionButtonStyle } from '../shared'

const SOURCE = 'receipt_analysis'
const TOP_ITEMS_FOR_AI = 20

function formatCurrency(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString('nb-NO')} ${currency}`
}

export default async function ReceiptInsightsPage({
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

  const forceRefresh = searchParams?.refresh === '1'

  let tips: SavingTip[] = []
  let generatedAt: string | null = null
  let currency = 'NOK'

  const cached = forceRefresh ? null : await getFreshCachedInsights(supabase, user.id, SOURCE)

  if (cached) {
    tips = Array.isArray(cached.top_saving_tips) ? (cached.top_saving_tips as SavingTip[]) : []
    generatedAt = cached.generated_at
    const cachedCurrency = cached.summary_json?.currency
    if (typeof cachedCurrency === 'string' && cachedCurrency) currency = cachedCurrency
  } else {
    const [receipts, items] = await Promise.all([
      fetchAllReceipts(supabase, user.id),
      fetchAllReceiptItems(supabase, user.id),
    ])

    if (receipts.length > 0) {
      currency = getCurrency(receipts)
      const healthMonthly = getMonthlyHealthRatio(receipts, items)
      const vatMonthly = getMonthlyVatSplit(receipts, items)
      const savingsMonthly = getMonthlySavingsRate(receipts, items)
      const chainMonthly = getMonthlyChainSpend(receipts)
      const topItems = getTopPurchasedItems(items).slice(0, TOP_ITEMS_FOR_AI)

      const latestHealth = healthMonthly[healthMonthly.length - 1]
      const latestVat = vatMonthly[vatMonthly.length - 1]
      const latestSavings = savingsMonthly[savingsMonthly.length - 1]

      const chainBreakdown = new Map<string, { spend: number; trips: number }>()
      for (const row of chainMonthly) {
        const current = chainBreakdown.get(row.chain) ?? { spend: 0, trips: 0 }
        current.spend += row.spend
        current.trips += row.trips
        chainBreakdown.set(row.chain, current)
      }

      tips = await receiptInsights({
        currency,
        healthRatio: latestHealth?.ratio ?? 0,
        vatSplit: {
          foodSpend: latestVat?.foodSpend ?? 0,
          nonFoodSpend: latestVat?.nonFoodSpend ?? 0,
        },
        savingsRate: latestSavings?.rate ?? 0,
        chainBreakdown: Array.from(chainBreakdown.entries()).map(([chain, v]) => ({ chain, ...v })),
        topItems: topItems.map(item => ({ name: item.name, totalSpend: item.totalSpend, totalQty: item.totalQty })),
      })

      generatedAt = new Date().toISOString()
      await writeInsightsCache(supabase, user.id, SOURCE, { summary_json: { currency }, top_saving_tips: tips })
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px', display: 'grid', gap: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={panelTitle}>Receipt Savings Insights</div>
        <Link href="/dashboard/receipts/insights?refresh=1" style={actionButtonStyle}>
          REFRESH
        </Link>
      </div>

      {generatedAt && (
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)' }}>
          Generated {new Date(generatedAt).toLocaleString('nb-NO')}
        </div>
      )}

      {tips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '72px 24px', border: '1px solid var(--grid-line)' }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '14px' }}>
            NO TIPS YET
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Import receipts to get AI-generated savings tips based on your actual basket.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {tips.map((tip, index) => (
            <div key={`${tip.category}-${index}`} style={{ border: '1px solid var(--grid-line)', padding: '18px 20px', display: 'grid', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--muted)' }}>
                  {tip.category.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '13px', color: 'var(--positive)' }}>
                  {formatCurrency(tip.saving_amount, currency)}/mo
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--carbon)' }}>{tip.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{tip.evidence}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
