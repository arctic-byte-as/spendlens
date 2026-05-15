import { hasFlag } from './features'

describe('hasFlag', () => {
  it('returns true only for strict boolean true', () => {
    expect(hasFlag({ feature_flags: { receipt_analysis: true } }, 'receipt_analysis')).toBe(true)
  })

  it('returns false when flag is missing', () => {
    expect(hasFlag({ feature_flags: {} }, 'receipt_analysis')).toBe(false)
  })

  it('returns false for non-boolean truthy values', () => {
    expect(hasFlag({ feature_flags: { receipt_analysis: 'true' } }, 'receipt_analysis')).toBe(false)
    expect(hasFlag({ feature_flags: { receipt_analysis: 1 } }, 'receipt_analysis')).toBe(false)
  })

  it('returns false for nullish profile values', () => {
    expect(hasFlag(undefined, 'receipt_analysis')).toBe(false)
    expect(hasFlag(null, 'receipt_analysis')).toBe(false)
  })
})
