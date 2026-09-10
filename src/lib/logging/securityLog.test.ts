import { logSecurityEvent } from './securityLog'

describe('logSecurityEvent', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('produces the expected structured shape', () => {
    const record = logSecurityEvent({
      eventType: 'auth_failure',
      route: '/api/transactions',
      actor: 'user-123',
      reason: 'missing_session',
    })

    expect(record).toEqual({
      timestamp: expect.any(String),
      level: 'security',
      eventType: 'auth_failure',
      route: '/api/transactions',
      actor: 'user-123',
      reason: 'missing_session',
    })
    expect(() => new Date(record.timestamp).toISOString()).not.toThrow()
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp)
  })

  it('writes exactly one JSON line to stdout matching the returned record', () => {
    const record = logSecurityEvent({
      eventType: 'rate_limit_exceeded',
      route: '/api/receipts/import/bookmarklet',
      actor: 'user-456',
    })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(consoleSpy.mock.calls[0][0])).toEqual(record)
  })

  it('omits reason and metadata when not provided', () => {
    const record = logSecurityEvent({
      eventType: 'webhook_signature_invalid',
      route: '/api/webhooks/stripe',
      actor: 'unknown',
    })

    expect(record).not.toHaveProperty('reason')
    expect(record).not.toHaveProperty('metadata')
  })

  it('passes through non-sensitive metadata', () => {
    const record = logSecurityEvent({
      eventType: 'upload_rejected',
      route: '/api/upload',
      actor: 'user-789',
      reason: 'invalid_file_type',
      metadata: { fileExtension: '.exe', attempt: 3, isRetry: false },
    })

    expect(record.metadata).toEqual({ fileExtension: '.exe', attempt: 3, isRetry: false })
  })

  it('redacts metadata values whose keys look sensitive', () => {
    const record = logSecurityEvent({
      eventType: 'ai_validation_failure',
      route: '/api/insights/upload-1',
      actor: 'user-789',
      metadata: {
        authToken: 'secret-abc-123',
        accountNumber: '1234-5678-9012',
        password: 'hunter2',
        csvContent: 'date,amount,merchant\n2026-01-01,42.00,Some Shop',
        stripeSecretKey: 'sk_live_abc',
        sessionCookie: 'sid=abcdef',
        cardNumber: '4242424242424242',
        rawReceiptPayload: '{"items":[{"name":"milk"}]}',
        safeField: 'this is fine',
      },
    })

    const metadata = record.metadata!
    expect(metadata.authToken).toBe('[redacted]')
    expect(metadata.accountNumber).toBe('[redacted]')
    expect(metadata.password).toBe('[redacted]')
    expect(metadata.csvContent).toBe('[redacted]')
    expect(metadata.stripeSecretKey).toBe('[redacted]')
    expect(metadata.sessionCookie).toBe('[redacted]')
    expect(metadata.cardNumber).toBe('[redacted]')
    expect(metadata.rawReceiptPayload).toBe('[redacted]')
    expect(metadata.safeField).toBe('this is fine')

    const serialised = JSON.stringify(record)
    expect(serialised).not.toContain('secret-abc-123')
    expect(serialised).not.toContain('1234-5678-9012')
    expect(serialised).not.toContain('hunter2')
    expect(serialised).not.toContain('4242424242424242')
    expect(serialised).not.toContain('sk_live_abc')
  })

  it('truncates very long safe-looking string values instead of dropping them', () => {
    const longValue = 'x'.repeat(500)
    const record = logSecurityEvent({
      eventType: 'ai_validation_failure',
      route: '/lib/ai/categorise',
      actor: 'unknown',
      metadata: { rawResponsePreview: longValue },
    })

    const value = record.metadata!.rawResponsePreview as string
    expect(value.length).toBeLessThan(longValue.length)
    expect(value).toContain('…[truncated]')
  })

  it('drops undefined metadata values instead of serialising them as null', () => {
    const record = logSecurityEvent({
      eventType: 'auth_failure',
      route: '/api/upload',
      actor: 'unknown',
      metadata: { attempt: 1, extra: undefined },
    })

    expect(record.metadata).toEqual({ attempt: 1 })
  })
})
