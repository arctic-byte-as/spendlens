import { redirect } from 'next/navigation'
import ReceiptConnectManager from '@/components/ReceiptConnectManager'
import { hasFlag } from '@/lib/features'
import { createServerClient } from '@/lib/supabase/server'

export default async function ReceiptConnectPage() {
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
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.3em', color: 'var(--muted)', marginBottom: '32px', textTransform: 'uppercase' }}>
        Connect Trumf
      </div>
      <ReceiptConnectManager />
    </div>
  )
}
