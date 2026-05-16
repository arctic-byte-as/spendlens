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

  // 23505 = unique_violation for stripe_webhook_events.event_id (duplicate Stripe delivery).
  if (receivedInsertError?.code === '23505') {
    const { data: existingEvent, error: existingEventError } = await admin
      .from('stripe_webhook_events')
      .select('status')
      .eq('event_id', event.id)
      .maybeSingle()

    if (existingEventError) {
      console.error('Failed to load existing webhook event:', existingEventError)
      return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }

    if (existingEvent?.status === 'processed') {
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  if (receivedInsertError && receivedInsertError.code !== '23505') {
    console.error('Failed to persist webhook receipt:', receivedInsertError)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  try {
    await handleStripeWebhookEvent(admin, event)
    await admin.rpc('mark_stripe_webhook_event', {
      p_event_id: event.id,
      p_status: 'processed',
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook processing failed:', error)
    await admin.rpc('mark_stripe_webhook_event', {
      p_event_id: event.id,
      p_status: 'failed',
      p_error_code: 'processing_failed',
    })

    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
