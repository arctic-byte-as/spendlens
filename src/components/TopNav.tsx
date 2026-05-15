import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import BillingPortalButton from './BillingPortalButton'
import { hasFlag } from '@/lib/features'

export default async function TopNav() {
  let user = null
  let subscriptionStatus: string | null = null
  let hasReceiptAnalysisFlag = false
  try {
    const supabase = createServerClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, feature_flags')
        .eq('id', user.id)
        .maybeSingle()
      subscriptionStatus = profile?.subscription_status ?? null
      hasReceiptAnalysisFlag = hasFlag(profile, 'receipt_analysis')
    }
  } catch {
    // Not in a request context
  }

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : null

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        height: '56px',
        borderBottom: '1px solid var(--grid-line)',
        background: 'var(--luce-cream)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Link
        href={user ? '/dashboard' : '/'}
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 900,
          fontSize: '18px',
          letterSpacing: '0.25em',
          color: 'var(--carbon)',
          textDecoration: 'none',
        }}
      >
        SPEND<span style={{ color: 'var(--prancing-horse)' }}>●</span>LENS
      </Link>

      {user && (
        <ul style={{ display: 'flex', gap: '36px', listStyle: 'none', margin: 0, padding: 0 }}>
          {[
            { href: '/dashboard', label: 'DASHBOARD' },
            { href: '/upload', label: 'UPLOAD' },
            { href: '/uploads', label: 'HISTORY' },
            { href: '/transactions', label: 'TRANSACTIONS' },
            ...(hasReceiptAnalysisFlag ? [{ href: '/dashboard/receipts', label: 'RECEIPTS' }] : []),
          ].map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '9px',
                  fontWeight: 500,
                  letterSpacing: '0.2em',
                  color: 'var(--muted)',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                }}
              >
                {link.label}
              </Link>
            </li>
          ))}
          {subscriptionStatus === 'active' && (
            <li>
              <BillingPortalButton />
            </li>
          )}
        </ul>
      )}

      {user && initials && (
        <div
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'var(--alcantara)',
            color: 'var(--bronze-lt)',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: '0.05em',
          }}
        >
          {initials}
        </div>
      )}
    </nav>
  )
}
