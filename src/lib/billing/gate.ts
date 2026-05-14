import {
  FREE_TIER,
  FREE_TIER_TRANSACTION_LIMIT,
  FREE_TIER_UPLOAD_LIMIT,
  type SubscriptionStatus,
  type SubscriptionTier,
} from './constants'

export type BillingProfile = {
  subscription_status: SubscriptionStatus | null
  subscription_tier: SubscriptionTier | null
}

export type GateContext = {
  profile: BillingProfile
  completedUploads: number
  rowCount?: number
  isInsightsRoute?: boolean
  allowRowTruncation?: boolean
}

export type GateDecision = {
  allowed: boolean
  error?: 'payment_required' | 'upgrade_required' | 'row_limit_exceeded'
  rowLimit?: number
  trialUsed: boolean
}

export function evaluateBillingGate({
  profile,
  completedUploads,
  rowCount,
  isInsightsRoute = false,
  allowRowTruncation = false,
}: GateContext): GateDecision {
  const status = profile.subscription_status ?? 'free'
  const tier = profile.subscription_tier ?? 'free'
  const trialUsed = completedUploads >= FREE_TIER_UPLOAD_LIMIT

  if (status === 'past_due') {
    return { allowed: false, error: 'payment_required', trialUsed }
  }

  if (tier !== FREE_TIER) {
    return { allowed: true, trialUsed }
  }

  if (isInsightsRoute) {
    return { allowed: false, error: 'upgrade_required', trialUsed, rowLimit: FREE_TIER_TRANSACTION_LIMIT }
  }

  if (trialUsed) {
    return { allowed: false, error: 'upgrade_required', trialUsed, rowLimit: FREE_TIER_TRANSACTION_LIMIT }
  }

  if (typeof rowCount === 'number' && rowCount > FREE_TIER_TRANSACTION_LIMIT && !allowRowTruncation) {
    return { allowed: false, error: 'row_limit_exceeded', trialUsed, rowLimit: FREE_TIER_TRANSACTION_LIMIT }
  }

  return { allowed: true, trialUsed, rowLimit: FREE_TIER_TRANSACTION_LIMIT }
}
