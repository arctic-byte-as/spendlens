export const FREE_TIER_UPLOAD_LIMIT = 1
export const FREE_TIER_TRANSACTION_LIMIT = 1000

export const PRO_TIER = 'pro'
export const FREE_TIER = 'free'

export type SubscriptionTier = typeof FREE_TIER | typeof PRO_TIER
export type SubscriptionStatus = 'free' | 'active' | 'past_due' | 'cancelled'
