const mockLogSecurityEvent = jest.fn()
jest.mock('@/lib/logging/securityLog', () => ({
  logSecurityEvent: (event: unknown) => mockLogSecurityEvent(event),
}))

const mockCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  }))
})

import { categoriseTransactionBatches } from './categorise'

describe('categoriseTransactionBatches — AI validation failure logging', () => {
  beforeEach(() => {
    mockLogSecurityEvent.mockReset()
    mockCreate.mockReset()
  })

  it('logs an ai_validation_failure event without leaking the raw Claude response', async () => {
    const sensitiveResponseText = 'account number 1234-5678-9012, this is not JSON'
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: sensitiveResponseText }],
    })

    const results = []
    for await (const batch of categoriseTransactionBatches([
      { id: 'tx-1', description: 'Some merchant', amount: 42 },
    ])) {
      results.push(...batch)
    }

    expect(results).toEqual([
      expect.objectContaining({ id: 'tx-1', category: 'OTHER', failed: true }),
    ])

    expect(mockLogSecurityEvent).toHaveBeenCalledTimes(1)
    const event = mockLogSecurityEvent.mock.calls[0][0]
    expect(event).toEqual({
      eventType: 'ai_validation_failure',
      route: 'lib/ai/categorise',
      actor: 'unknown',
      reason: 'categorisation_batch_failed',
    })
    expect(JSON.stringify(event)).not.toContain('1234-5678-9012')
    expect(JSON.stringify(event)).not.toContain(sensitiveResponseText)
  })

  it('does not log a security event when categorisation succeeds', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[{"id":"tx-1","category":"GROCERIES","subcategory":"","merchant":"Shop","is_recurring":false}]' }],
    })

    for await (const _batch of categoriseTransactionBatches([
      { id: 'tx-1', description: 'Some merchant', amount: 42 },
    ])) {
      // drain generator
    }

    expect(mockLogSecurityEvent).not.toHaveBeenCalled()
  })
})
