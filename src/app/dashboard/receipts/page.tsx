import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { hasFlag } from '@/lib/features'
import {
  getCurrency,
  getItemPriceTrends,
  getMonthlyChainSpend,
  getMonthlyHealthRatio,
  getMonthlySavingsRate,
  getMonthlyVatSplit,
  getTopPurchasedItems,
  type ReceiptAnalysisRow,
  type ReceiptItemAnalysisRow,
} from '@/lib/receipts/analysis'

type SearchParams = Record<string, string | string[] | undefined>

type SortKey = 'name' | 'qty' | 'spend' | 'receipts'
type SortDirection = 'asc' | 'desc'

function getSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`)
    .toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' })
    .toUpperCase()
}

function formatCurrency(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString('nb-NO')} ${currency}`
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000
}

function sortTopItems(
  items: ReturnType<typeof getTopPurchasedItems>,
  key: SortKey,
  dir: SortDirection,
) {
  const factor = dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    if (key === 'name') return a.name.localeCompare(b.name) * factor
    if (key === 'qty') return (a.totalQty - b.totalQty) * factor
    if (key === 'receipts') return (a.receiptCount - b.receiptCount) * factor
    return (a.totalSpend - b.totalSpend) * factor
  })
}

function nextDirection(currentKey: SortKey, currentDir: SortDirection, clicked: SortKey): SortDirection {
  if (currentKey !== clicked) return clicked === 'name' ? 'asc' : 'desc'
  return currentDir === 'asc' ? 'desc' : 'asc'
}

export default async function ReceiptAnalysisPage({
  searchParams,
}: {
  searchParams?: SearchParams
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

  const [{ data: receiptRows }, { data: itemRows }] = await Promise.all([
    supabase
      .from('receipts')
      .select('receipt_id, date, chain, total_amount, currency')
      .eq('user_id', user.id)
      .order('date', { ascending: true }),
    supabase
      .from('receipt_items')
      .select('receipt_id, name, quantity, unit, total_price, bonus_percent, vat_percent, savings_amount')
      .eq('user_id', user.id),
  ])

  const receipts = (receiptRows || []) as ReceiptAnalysisRow[]
  const items = (itemRows || []) as ReceiptItemAnalysisRow[]
  const currency = getCurrency(receipts)

  const chainMonthly = getMonthlyChainSpend(receipts)
  const healthMonthly = getMonthlyHealthRatio(receipts, items)
  const vatMonthly = getMonthlyVatSplit(receipts, items)
  const savingsMonthly = getMonthlySavingsRate(receipts, items)
  const priceTrends = getItemPriceTrends(receipts, items)
  const topPurchased = getTopPurchasedItems(items)

  const currentSort = (getSingle(searchParams?.sort) as SortKey) || 'spend'
  const currentDir = (getSingle(searchParams?.dir) as SortDirection) || 'desc'
  const sortedTopItems = sortTopItems(topPurchased, currentSort, currentDir)

  const maxChainSpend = Math.max(...chainMonthly.map(row => row.spend), 1)
  const maxVatSpend = Math.max(...vatMonthly.map(row => row.foodSpend + row.nonFoodSpend), 1)

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

  if (receipts.length === 0) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        <div style={panelTitle}>Receipt Analysis</div>
        <div style={{ marginTop: '32px', textAlign: 'center', padding: '72px 24px', border: '1px solid var(--grid-line)' }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '14px' }}>
            NO RECEIPTS IMPORTED
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '24px' }}>
            Import receipt data to unlock monthly chain, basket health, VAT and savings analytics.
          </div>
          <Link
            href="/upload"
            style={actionButtonStyle}
          >
            IMPORT DATA
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px', display: 'grid', gap: '42px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={panelTitle}>Receipt Analysis</div>
      </div>

      <section>
        <div style={{ ...panelTitle, marginBottom: '16px' }}>Monthly Spend By Chain</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {chainMonthly.map(row => {
            const pct = Math.max((row.spend / maxChainSpend) * 100, 1)
            return (
              <div key={`${row.month}-${row.chain}`} style={{ display: 'grid', gridTemplateColumns: '120px 120px 1fr auto', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.12em', color: 'var(--muted)' }}>{monthLabel(row.month)}</div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.12em', color: 'var(--carbon)' }}>{row.chain}</div>
                <div style={{ position: 'relative', height: '8px', background: 'var(--grid-line)' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'var(--prancing-horse)' }} />
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--carbon)', minWidth: '190px', textAlign: 'right' }}>
                  {formatCurrency(row.spend, currency)} · {row.trips} trips
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <div style={{ ...panelTitle, marginBottom: '16px' }}>Grocery Health Index</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {healthMonthly.map(row => (
            <div key={row.month} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto auto', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.12em', color: 'var(--muted)' }}>{monthLabel(row.month)}</div>
              <div style={{ position: 'relative', height: '8px', background: 'var(--grid-line)' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${Math.max(row.ratio * 100, 1)}%`, background: 'var(--positive)' }} />
                <div style={{ position: 'absolute', inset: 0, width: '30%', borderRight: '1px dashed var(--bronze)' }} />
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--carbon)', minWidth: '65px', textAlign: 'right' }}>
                {formatPct(row.ratio)}
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', minWidth: '160px', textAlign: 'right' }}>
                {formatCurrency(row.healthySpend, currency)} / {formatCurrency(row.totalSpend, currency)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ ...panelTitle, marginBottom: '16px' }}>Food vs Non-Food VAT Split</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {vatMonthly.map(row => {
            const total = row.foodSpend + row.nonFoodSpend
            const foodPct = total > 0 ? (row.foodSpend / total) * 100 : 0
            const nonFoodPct = total > 0 ? (row.nonFoodSpend / total) * 100 : 0
            const scaled = Math.max((total / maxVatSpend) * 100, 1)
            return (
              <div key={row.month} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.12em', color: 'var(--muted)' }}>{monthLabel(row.month)}</div>
                <div style={{ position: 'relative', height: '10px', background: 'var(--grid-line)', width: `${scaled}%`, minWidth: '40px' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${foodPct}%`, background: 'var(--positive)' }} />
                  <div style={{ position: 'absolute', inset: 0, left: `${foodPct}%`, width: `${nonFoodPct}%`, background: 'var(--bronze)' }} />
                </div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--carbon)', minWidth: '280px', textAlign: 'right' }}>
                  Food {formatCurrency(row.foodSpend, currency)} · Non-food {formatCurrency(row.nonFoodSpend, currency)}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <div style={{ ...panelTitle, marginBottom: '16px' }}>Regular Item Price Changes (EA, 3+ purchases)</div>
        {priceTrends.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Not enough repeated EA-item purchases to calculate price trend yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {priceTrends.slice(0, 12).map(trend => {
              const latest = trend.monthly[trend.monthly.length - 1]
              const increases = trend.monthly.filter(row => row.increasedOverTenPercent).length
              return (
                <div key={trend.itemName} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '10px', borderTop: '1px solid var(--grid-line)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--carbon)' }}>{trend.itemName}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', minWidth: '90px', textAlign: 'right' }}>{trend.purchaseCount} purchases</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--carbon)', minWidth: '120px', textAlign: 'right' }}>{formatCurrency(latest.avgUnitPrice, currency)} / EA</div>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.12em', color: increases > 0 ? 'var(--prancing-horse)' : 'var(--muted)', minWidth: '130px', textAlign: 'right' }}>
                    {increases > 0 ? `>10% UP ${increases}x` : 'STABLE'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <div style={{ ...panelTitle, marginBottom: '16px' }}>Campaign Savings Rate</div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {savingsMonthly.map(row => (
            <div key={row.month} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto auto', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.12em', color: 'var(--muted)' }}>{monthLabel(row.month)}</div>
              <div style={{ position: 'relative', height: '8px', background: 'var(--grid-line)' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${Math.max(row.rate * 100, 1)}%`, background: row.rate >= 0.15 ? 'var(--positive)' : 'var(--bronze)' }} />
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: row.rate >= 0.15 ? 'var(--positive)' : 'var(--carbon)', minWidth: '65px', textAlign: 'right' }}>{formatPct(row.rate)}</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--muted)', minWidth: '220px', textAlign: 'right' }}>
                {formatCurrency(row.savings, currency)} saved / {formatCurrency(row.grossSpend + row.savings, currency)} baseline
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ ...panelTitle, marginBottom: '16px' }}>Top 50 Purchased Items By Spend</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                { key: 'name', label: 'Name' },
                { key: 'qty', label: 'Total Qty' },
                { key: 'spend', label: 'Total Spend' },
                { key: 'receipts', label: 'Receipt Count' },
              ].map(column => {
                const key = column.key as SortKey
                const active = currentSort === key
                const dir = nextDirection(currentSort, currentDir, key)
                return (
                  <th key={column.key} style={{ borderTop: '1px solid var(--grid-line)', padding: '10px 0', textAlign: column.key === 'name' ? 'left' : 'right' }}>
                    <Link
                      href={`/dashboard/receipts?sort=${key}&dir=${dir}`}
                      style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.12em', color: active ? 'var(--carbon)' : 'var(--muted)', textDecoration: 'none' }}
                    >
                      {column.label.toUpperCase()}
                      {active ? ` ${currentDir === 'asc' ? '↑' : '↓'}` : ''}
                    </Link>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedTopItems.map(row => (
              <tr key={row.name}>
                <td style={{ borderTop: '1px solid var(--grid-line)', padding: '10px 0', fontSize: '12px', color: 'var(--carbon)' }}>{row.name}</td>
                <td style={{ borderTop: '1px solid var(--grid-line)', padding: '10px 0', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>{roundToThreeDecimals(row.totalQty)}</td>
                <td style={{ borderTop: '1px solid var(--grid-line)', padding: '10px 0', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>{formatCurrency(row.totalSpend, currency)}</td>
                <td style={{ borderTop: '1px solid var(--grid-line)', padding: '10px 0', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>{row.receiptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
