const mockLogSecurityEvent = jest.fn()
jest.mock('@/lib/logging/securityLog', () => ({
  logSecurityEvent: (event: unknown) => mockLogSecurityEvent(event),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({}),
}))

const mockConstructEvent = jest.fn()
jest.mock('@/lib/billing/stripe', () => ({
  getStripeClient: () => ({ webhooks: { constructEvent: mockConstructEvent } }),
  getRequiredEnv: () => 'whsec_test',
}))

jest.mock('@/lib/billing/webhook', () => ({
  handleStripeWebhookEvent: jest.fn(),
}))

import { POST } from './route'

describe('POST /api/webhooks/stripe — signature failures', () => {
  beforeEach(() => {
    mockLogSecurityEvent.mockReset()
    mockConstructEvent.mockReset()
  })

  it('logs a webhook_signature_invalid event and returns 400 when the signature header is missing', async () => {
    const request = new Request('https://spendlens.example/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      eventType: 'webhook_signature_invalid',
      route: '/api/webhooks/stripe',
      actor: 'unknown',
      reason: 'missing_signature_header',
    })
  })

  it('logs a webhook_signature_invalid event and returns 400 when signature verification fails, without leaking the payload', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('signature mismatch')
    })

    const rawBody = JSON.stringify({ secret_account_number: '1234-5678-9012' })
    const request = new Request('https://spendlens.example/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad-signature' },
      body: rawBody,
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockLogSecurityEvent).toHaveBeenCalledTimes(1)
    const event = mockLogSecurityEvent.mock.calls[0][0]
    expect(event).toEqual({
      eventType: 'webhook_signature_invalid',
      route: '/api/webhooks/stripe',
      actor: 'unknown',
      reason: 'signature_verification_failed',
    })
    expect(JSON.stringify(event)).not.toContain('1234-5678-9012')
  })
})
