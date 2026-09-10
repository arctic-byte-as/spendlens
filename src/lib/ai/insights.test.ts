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

import { generateInsights } from './insights'

describe('generateInsights — AI validation failure logging', () => {
  beforeEach(() => {
    mockLogSecurityEvent.mockReset()
    mockCreate.mockReset()
  })

  it('logs an ai_validation_failure event without leaking the raw Claude response', async () => {
    const sensitiveResponseText = '[card 4242424242424242 — not valid JSON]'
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: sensitiveResponseText }],
    })

    const tips = await generateInsights({ GROCERIES: 500 })

    expect(tips).toEqual([])
    expect(mockLogSecurityEvent).toHaveBeenCalledTimes(1)
    const event = mockLogSecurityEvent.mock.calls[0][0]
    expect(event).toEqual({
      eventType: 'ai_validation_failure',
      route: 'lib/ai/insights',
      actor: 'unknown',
      reason: 'insights_parse_failed',
    })
    expect(JSON.stringify(event)).not.toContain('4242424242424242')
    expect(JSON.stringify(event)).not.toContain(sensitiveResponseText)
  })

  it('does not log a security event when insights parse successfully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[{"category":"GROCERIES","title":"Buy less","saving_amount":50,"evidence":"trend"}]' }],
    })

    await generateInsights({ GROCERIES: 500 })

    expect(mockLogSecurityEvent).not.toHaveBeenCalled()
  })
})
