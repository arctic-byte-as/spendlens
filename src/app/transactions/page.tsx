import { createServerClient } from '@/lib/supabase/server'
import TransactionsTable from '@/components/TransactionsTable'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const MAX_TRANSACTIONS_PAGE_LOAD = 500

export default async function TransactionsPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: rows } = await supabase
    .from('transactions')
    .select('id, date, merchant, description, category, amount, currency, is_recurring')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(MAX_TRANSACTIONS_PAGE_LOAD)

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
      <div
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.3em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
          marginBottom: '28px',
        }}
      >
        TRANSACTIONS
      </div>

      {!rows || rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', border: '1px solid var(--grid-line)' }}>
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: 'var(--muted)',
              marginBottom: '12px',
            }}
          >
            NO TRANSACTIONS YET
          </div>
          <Link
            href="/upload"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: 'var(--prancing-horse)',
              textDecoration: 'none',
            }}
          >
            UPLOAD YOUR FIRST CSV →
          </Link>
        </div>
      ) : (
        <TransactionsTable
          initialRows={rows.map((row) => ({
            ...row,
            amount: Number(row.amount),
            currency: row.currency || 'NOK',
          }))}
        />
      )}
    </div>
  )
}
