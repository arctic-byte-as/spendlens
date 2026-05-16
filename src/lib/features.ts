export const FEATURE_FLAGS = ['receipt_analysis'] as const

export type FeatureFlag = (typeof FEATURE_FLAGS)[number]

// Feature flags are stored as JSON and treated as untrusted runtime input.
type FeatureFlagRecord = Partial<Record<FeatureFlag, unknown>>

type FeatureProfile = {
  feature_flags?: FeatureFlagRecord | null
} | null | undefined

export function hasFlag(profile: FeatureProfile, flag: FeatureFlag): boolean {
  return profile?.feature_flags?.[flag] === true
}
