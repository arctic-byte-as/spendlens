import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { formatSignedAmount } from '@/lib/transactions/table'
import UpgradeButton from '@/components/UpgradeButton'

const MAX_RECENT_TRANSACTIONS = 8

type TransactionRow = {
  id: string
  date: string
  merchant: string | null
  description: string | null
  category: string | null
  category_source: string | null
  amount: number | string
  currency: string | null
}

type InsightRow = {
  top_saving_tips: Array<{
    category?: string
    title?: string
    saving_amount?: number
    evidence?: string
  }> | null
}

function formatCurrency(amount: number, currency = 'NOK') {
  return `${Math.round(amount).toLocaleString('nb-NO')} ${currency}`
}

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: transactions }, { data: uploads }, { data: insights }, { data: profile }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, date, merchant, description, category, category_source, amount, currency')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(500),
    supabase
      .from('uploads')
      .select('id, filename, uploaded_at, row_count, status')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })
      .limit(5),
    supabase
      .from('insights')
      .select('top_saving_tips')
      .eq('user_id', user.id)
      .not('upload_id', 'is', null)
      .order('generated_at', { ascending: false })
      .limit(1),
    supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const rows = (transactions || []) as TransactionRow[]
  const doneUploads = (uploads || []).filter(upload => upload.status === 'done')
  const isFreeTier = (profile?.subscription_tier ?? 'free') === 'free'
  const isPastDue = profile?.subscription_status === 'past_due'
  const insightsLocked = isFreeTier || isPastDue
  const trialUsed = doneUploads.length >= 1
  const latestTips = ((insights?.[0] as InsightRow | undefined)?.top_saving_tips || []).slice(0, 4)
  const currency = rows.find(row => row.currency)?.currency || 'NOK'

  const totalIncome = rows.reduce((sum, row) => {
    const amount = Number(row.amount)
    return amount > 0 ? sum + amount : sum
  }, 0)
  const totalSpend = rows.reduce((sum, row) => {
    const amount = Number(row.amount)
    return amount < 0 ? sum + Math.abs(amount) : sum
  }, 0)
  const net = totalIncome - totalSpend

  const categoryTotals = rows.reduce<Record<string, number>>((totals, row) => {
    const amount = Number(row.amount)
    if (amount >= 0) return totals
    const category = row.category || (row.category_source === 'failed' ? 'FAILED' : 'PENDING')
    totals[category] = (totals[category] || 0) + Math.abs(amount)
    return totals
  }, {})
  const allCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  const maxCategory = Math.max(...allCategories.map(([, amount]) => amount), 1)
  const recentRows = rows.slice(0, MAX_RECENT_TRANSACTIONS)

  // Colour palette — cycles for as many categories as needed
  const PALETTE = [
    '#C8102E', // prancing horse red
    '#8B6914', // bronze
    '#2D6A4F', // positive green
    '#4A6FA5', // steel blue
    '#9B5E20', // burnt orange
    '#5C4A72', // plum
    '#2B7A6E', // teal
    '#7A3E3E', // dark burgundy
    '#6B8F71', // sage
    '#7A6235', // warm gold
  ]

  const panelTitle: React.CSSProperties = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.3em',
    color: 'var(--muted)',
    textTransform: 'uppercase',
  }

  if (rows.length === 0) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
        <div style={panelTitle}>Dashboard</div>
        <div style={{ marginTop: '32px', textAlign: 'center', padding: '72px 24px', border: '1px solid var(--grid-line)' }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '14px' }}>
            NO TRANSACTIONS YET
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '24px' }}>
            Import a CSV to activate your spending dashboard.
          </div>
          <Link
            href="/upload"
            style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', padding: '10px 24px', background: 'var(--prancing-horse)', color: 'white', textDecoration: 'none' }}
          >
            IMPORT CSV
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={panelTitle}>Dashboard</div>
        <Link
          href="/upload"
          style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', padding: '8px 20px', background: 'var(--prancing-horse)', color: 'white', textDecoration: 'none' }}
        >
          + IMPORT CSV
        </Link>
      </div>

      {isFreeTier && trialUsed && (
        <div style={{ border: '1px solid var(--prancing-horse)', padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--carbon)' }}>
            You&apos;ve used your free trial. Upgrade to Pro for unlimited uploads + savings insights.
          </div>
          <UpgradeButton />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1px', background: 'var(--grid-line)', marginBottom: '40px' }}>
        {[
          ['SPEND', formatCurrency(totalSpend, currency || 'NOK')],
          ['INCOME', formatCurrency(totalIncome, currency || 'NOK')],
          ['NET', formatSignedAmount(net, currency || 'NOK')],
          ['IMPORTS', doneUploads.length.toLocaleString('nb-NO')],
        ].map(([label, value]) => (
          <div key={label} style={{ background: 'var(--luce-cream)', padding: '22px 20px' }}>
            <div style={{ ...panelTitle, fontSize: '8px', marginBottom: '10px' }}>{label}</div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--carbon)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.65fr', gap: '40px', marginBottom: '44px' }}>
        <section>
          <div style={{ ...panelTitle, marginBottom: '20px' }}>Spending By Category</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {allCategories.map(([cat, amount], index) => {
              const colour = PALETTE[index % PALETTE.length]
              const pct = Math.max((amount / maxCategory) * 100, 1)
              const sharePct = totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0
              return (
                <Link
                  key={cat}
                  href={`/transactions?category=${encodeURIComponent(cat)}`}
                  style={{ display: 'grid', gridTemplateColumns: '190px 1fr auto', gap: '14px', alignItems: 'center', textDecoration: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', background: colour, flexShrink: 0 }} />
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '7.5px', letterSpacing: '0.12em', color: 'var(--carbon)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cat}
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: '8px', background: 'var(--grid-line)' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: colour, opacity: 0.85 }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '7px', letterSpacing: '0.1em', color: colour, opacity: 0.8, minWidth: '28px', textAlign: 'right' }}>
                      {sharePct}%
                    </div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: 'var(--carbon)', whiteSpace: 'nowrap', minWidth: '110px', textAlign: 'right' }}>
                      {formatCurrency(amount, currency || 'NOK')}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section>
          <div style={{ ...panelTitle, marginBottom: '20px' }}>Saving Tips</div>
          {insightsLocked ? (
            <div style={{ borderTop: '1px solid var(--grid-line)', paddingTop: '16px' }}>
              <div style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.7, marginBottom: '14px' }}>
                {isPastDue ? 'Savings insights are paused while your subscription is past due.' : 'Savings insights are a Pro feature.'}
              </div>
              <UpgradeButton />
            </div>
          ) : latestTips.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.7, borderTop: '1px solid var(--grid-line)', paddingTop: '16px' }}>
              Insights will appear after AI categorisation completes.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '18px' }}>
              {latestTips.map((tip, index) => (
                <div key={`${tip.title}-${index}`} style={{ borderTop: '1px solid var(--grid-line)', paddingTop: '14px' }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.15em', color: 'var(--bronze)', marginBottom: '6px' }}>
                    {tip.category || 'OTHER'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--carbon)', marginBottom: '6px' }}>{tip.title}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--positive)' }}>
                    {formatCurrency(Number(tip.saving_amount || 0), currency || 'NOK')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <div style={{ ...panelTitle, marginBottom: '20px' }}>Recent Transactions</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {recentRows.map(row => (
              <tr key={row.id}>
                <td style={{ padding: '12px 0', borderTop: '1px solid var(--grid-line)', fontSize: '11px', color: 'var(--muted)', width: '120px' }}>
                  {new Date(row.date).toLocaleDateString('nb-NO')}
                </td>
                <td style={{ padding: '12px 16px', borderTop: '1px solid var(--grid-line)' }}>
                  {row.merchant || row.description || 'Transaction'}
                </td>
                <td style={{ padding: '12px 16px', borderTop: '1px solid var(--grid-line)', fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.12em', color: 'var(--bronze)' }}>
                  {row.category || (row.category_source === 'failed' ? 'FAILED' : 'PENDING')}
                </td>
                <td style={{ padding: '12px 0', borderTop: '1px solid var(--grid-line)', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: Number(row.amount) < 0 ? 'var(--prancing-horse)' : 'var(--positive)' }}>
                  {formatSignedAmount(Number(row.amount), row.currency || currency || 'NOK')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
