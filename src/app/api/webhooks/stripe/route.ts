import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequiredEnv, getStripeClient } from '@/lib/billing/stripe'
import { handleStripeWebhookEvent } from '@/lib/billing/webhook'

export async function POST(request: Request) {
  try {
    const stripe = getStripeClient()
    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const secret = getRequiredEnv('STRIPE_WEBHOOK_SECRET')
    const payload = await request.text()

    const event = stripe.webhooks.constructEvent(payload, signature, secret)
    const admin = createAdminClient()
    await handleStripeWebhookEvent(admin, event)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook failed:', error)
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
  }
}
