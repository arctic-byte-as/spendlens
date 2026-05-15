import { NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'
import { getRequiredEnv, getStripeClient } from '@/lib/billing/stripe'

export async function POST() {
  try {
    const auth = await requireAuthenticatedRouteContext()
    if (auth instanceof NextResponse) return auth
    const { supabase, user } = auth

    const appUrl = getRequiredEnv('NEXT_PUBLIC_APP_URL')
    const priceId = getRequiredEnv('STRIPE_PRO_PRICE_ID')
    const stripe = getStripeClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id ? undefined : user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/dashboard?billing=cancelled`,
      client_reference_id: user.id,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout session creation failed:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
