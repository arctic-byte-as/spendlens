import Stripe from 'stripe'
import { type SubscriptionStatus } from './constants'

let stripeClient: Stripe | null = null

export function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key)
  }

  return stripeClient
}

export function getRequiredEnv(name: 'STRIPE_PRO_PRICE_ID' | 'STRIPE_WEBHOOK_SECRET' | 'NEXT_PUBLIC_APP_URL') {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

export function toBillingStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'active' || status === 'trialing') return 'active'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due'
  if (status === 'canceled' || status === 'incomplete_expired') return 'cancelled'
  return 'free'
}
