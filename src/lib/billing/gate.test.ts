import { evaluateBillingGate } from './gate'

describe('evaluateBillingGate', () => {
  it('blocks past_due users', () => {
    expect(
      evaluateBillingGate({
        profile: { subscription_status: 'past_due', subscription_tier: 'pro' },
        completedUploads: 0,
      })
    ).toMatchObject({ allowed: false, error: 'payment_required' })
  })

  it('blocks free users from insights', () => {
    expect(
      evaluateBillingGate({
        profile: { subscription_status: 'free', subscription_tier: 'free' },
        completedUploads: 0,
        isInsightsRoute: true,
      })
    ).toMatchObject({ allowed: false, error: 'upgrade_required' })
  })

  it('blocks second free-tier upload', () => {
    expect(
      evaluateBillingGate({
        profile: { subscription_status: 'free', subscription_tier: 'free' },
        completedUploads: 1,
      })
    ).toMatchObject({ allowed: false, error: 'upgrade_required', trialUsed: true })
  })

  it('blocks rows above limit when truncation is disabled', () => {
    expect(
      evaluateBillingGate({
        profile: { subscription_status: 'free', subscription_tier: 'free' },
        completedUploads: 0,
        rowCount: 1500,
      })
    ).toMatchObject({ allowed: false, error: 'row_limit_exceeded' })
  })

  it('allows first free upload with truncation flag', () => {
    expect(
      evaluateBillingGate({
        profile: { subscription_status: 'free', subscription_tier: 'free' },
        completedUploads: 0,
        rowCount: 1500,
        allowRowTruncation: true,
      })
    ).toMatchObject({ allowed: true })
  })

  it('allows active pro users', () => {
    expect(
      evaluateBillingGate({
        profile: { subscription_status: 'active', subscription_tier: 'pro' },
        completedUploads: 999,
        rowCount: 100000,
        isInsightsRoute: true,
      })
    ).toMatchObject({ allowed: true })
  })
})
