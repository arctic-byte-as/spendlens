import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { evaluateBillingGate } from '@/lib/billing/gate'
import { FREE_TIER_TRANSACTION_LIMIT } from '@/lib/billing/constants'

export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: profile, error: profileError }, { count: uploadCount, error: uploadError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('subscription_status, subscription_tier')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('uploads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'done'),
  ])

  if (profileError || uploadError) {
    console.error('Failed to resolve billing status', profileError || uploadError)
    return NextResponse.json({ error: 'Failed to fetch billing status' }, { status: 500 })
  }

  const decision = evaluateBillingGate({
    profile: {
      subscription_status: profile?.subscription_status ?? 'free',
      subscription_tier: profile?.subscription_tier ?? 'free',
    },
    completedUploads: uploadCount || 0,
  })

  const isFreeTier = (profile?.subscription_tier ?? 'free') === 'free'
  const rowLimit = isFreeTier && !decision.trialUsed ? FREE_TIER_TRANSACTION_LIMIT : null

  return NextResponse.json({
    trialUsed: decision.trialUsed,
    rowLimit,
    subscriptionStatus: profile?.subscription_status ?? 'free',
    subscriptionTier: profile?.subscription_tier ?? 'free',
  })
}
