export const FEATURE_FLAGS = ['receipt_analysis'] as const

export type FeatureFlag = (typeof FEATURE_FLAGS)[number]

type FeatureFlagRecord = Partial<Record<FeatureFlag, unknown>>

type FeatureProfile = {
  feature_flags?: FeatureFlagRecord | null
} | null | undefined

export function hasFlag(profile: FeatureProfile, flag: FeatureFlag): boolean {
  return profile?.feature_flags?.[flag] === true
}
