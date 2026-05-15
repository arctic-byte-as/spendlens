import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequiredEnv, getStripeClient } from '@/lib/billing/stripe'
import { handleStripeWebhookEvent } from '@/lib/billing/webhook'

export async function POST(request: Request) {
  const stripe = getStripeClient()
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const secret = getRequiredEnv('STRIPE_WEBHOOK_SECRET')
  const payload = await request.text()

  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret)
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error)
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error: receivedInsertError } = await admin
    .from('stripe_webhook_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      status: 'received',
    })

  if (receivedInsertError?.code === '23505') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (receivedInsertError) {
    console.error('Failed to persist webhook receipt:', receivedInsertError)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  try {
    await handleStripeWebhookEvent(admin, event)
    await admin
      .from('stripe_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        error_code: null,
      })
      .eq('event_id', event.id)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook processing failed:', error)
    await admin
      .from('stripe_webhook_events')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_code: 'processing_failed',
      })
      .eq('event_id', event.id)

    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
