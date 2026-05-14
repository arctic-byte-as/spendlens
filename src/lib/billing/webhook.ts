import Stripe from 'stripe'
import { toBillingStatus } from './stripe'

type SupabaseLike = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>
    }
  }
}

function toEndsAt(seconds?: number | null) {
  return seconds ? new Date(seconds * 1000).toISOString() : null
}

function getSubscriptionPeriodEnd(sub: Stripe.Subscription) {
  const maybeWithPeriodEnd = sub as Stripe.Subscription & { current_period_end?: number | null }
  return maybeWithPeriodEnd.current_period_end ?? sub.cancel_at ?? null
}

async function updateByCustomer(
  supabase: SupabaseLike,
  stripeCustomerId: string,
  values: Record<string, unknown>
) {
  const { error } = await supabase
    .from('profiles')
    .update(values)
    .eq('stripe_customer_id', stripeCustomerId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function handleStripeWebhookEvent(supabase: SupabaseLike, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (!session.customer) return

      const values: Record<string, unknown> = {
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer.id,
        subscription_status: 'active',
        subscription_tier: 'pro',
      }

      if (session.client_reference_id) {
        const { error } = await supabase
          .from('profiles')
          .update(values)
          .eq('id', session.client_reference_id)

        if (error) throw new Error(error.message)
      }
      return
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      if (!sub.customer) return
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      await updateByCustomer(supabase, customerId, {
        subscription_status: toBillingStatus(sub.status),
        subscription_tier: 'pro',
        subscription_ends_at: toEndsAt(getSubscriptionPeriodEnd(sub)),
      })
      return
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      if (!sub.customer) return
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      await updateByCustomer(supabase, customerId, {
        subscription_status: 'cancelled',
        subscription_tier: 'free',
        subscription_ends_at: toEndsAt(getSubscriptionPeriodEnd(sub)),
      })
      return
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id
      if (!customerId) return

      await updateByCustomer(supabase, customerId, {
        subscription_status: 'past_due',
      })
      return
    }

    default:
      return
  }
}
