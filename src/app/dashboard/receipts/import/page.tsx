import Link from 'next/link'
import { redirect } from 'next/navigation'
import ReceiptImportWizard from '@/components/ReceiptImportWizard'
import { hasFlag } from '@/lib/features'
import { createServerClient } from '@/lib/supabase/server'

export default async function ReceiptImportPage() {
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.3em', color: 'var(--muted)', textTransform: 'uppercase' }}>
          Import Receipts
        </div>
        <Link
          href="/dashboard/receipts/connect"
          style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--muted)' }}
        >
          CONNECT TRUMF →
        </Link>
      </div>
      <ReceiptImportWizard />
    </div>
  )
}
