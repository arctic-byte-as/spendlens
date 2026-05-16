import { createHmac } from 'crypto'
import { getTestAuthCredentialsFromHeaders, isTestAuthBypassEnabled } from './test-bypass'

function encodePayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('hex')
}

describe('test auth bypass', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SPENDLENS_TEST_AUTH_ENABLED: 'true',
      TEST_AUTH_HMAC_SECRET: 'test-secret',
      TEST_AUTH_OWNER_EMAIL: 'owner@example.com',
      TEST_AUTH_OWNER_PASSWORD: 'owner-password',
      TEST_AUTH_FRIEND_EMAIL: 'friend@example.com',
      TEST_AUTH_FRIEND_PASSWORD: 'friend-password',
      NODE_ENV: 'test',
      VERCEL_ENV: 'preview',
    }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('disables bypass when production safeguards apply', () => {
    process.env.NODE_ENV = 'production'
    expect(isTestAuthBypassEnabled()).toBe(false)

    process.env.NODE_ENV = 'test'
    process.env.VERCEL_ENV = 'production'
    expect(isTestAuthBypassEnabled()).toBe(false)
  })

  it('returns credentials for valid signed headers', () => {
    const payload = encodePayload({
      profile: 'owner',
      ts: Date.now(),
      nonce: 'nonce-value',
    })
    const headers = new Headers({
      'x-spendlens-test-auth': payload,
      'x-spendlens-test-auth-signature': signPayload(payload, 'test-secret'),
    })

    expect(getTestAuthCredentialsFromHeaders(headers)).toEqual({
      email: 'owner@example.com',
      password: 'owner-password',
    })
  })

  it('rejects stale or incorrectly signed payloads', () => {
    const stalePayload = encodePayload({
      profile: 'owner',
      ts: Date.now() - 120_000,
      nonce: 'nonce-value',
    })

    const staleHeaders = new Headers({
      'x-spendlens-test-auth': stalePayload,
      'x-spendlens-test-auth-signature': signPayload(stalePayload, 'test-secret'),
    })
    expect(getTestAuthCredentialsFromHeaders(staleHeaders)).toBeNull()

    const freshPayload = encodePayload({
      profile: 'owner',
      ts: Date.now(),
      nonce: 'nonce-value',
    })

    const invalidSignatureHeaders = new Headers({
      'x-spendlens-test-auth': freshPayload,
      'x-spendlens-test-auth-signature': 'invalid-signature',
    })
    expect(getTestAuthCredentialsFromHeaders(invalidSignatureHeaders)).toBeNull()
  })
})
