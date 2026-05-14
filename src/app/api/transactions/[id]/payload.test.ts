import { parseTransactionPatchPayload } from './payload'

describe('parseTransactionPatchPayload', () => {
  it('accepts canonical category values', () => {
    expect(parseTransactionPatchPayload({ category: 'food & drink' })).toEqual({
      category: 'FOOD & DRINK',
    })
  })

  it('accepts notes updates', () => {
    expect(parseTransactionPatchPayload({ notes: 'Monthly bill' })).toEqual({
      notes: 'Monthly bill',
    })
  })

  it('rejects unsupported fields', () => {
    expect(() => parseTransactionPatchPayload({ amount: -100 })).toThrow(
      'Only category and notes can be updated'
    )
  })

  it('rejects invalid category values', () => {
    // Custom category names are now allowed (e.g. 'COFFEE'), so test a name with illegal characters
    expect(() => parseTransactionPatchPayload({ category: 'COFFEE!' })).toThrow('Invalid category')
  })
})
