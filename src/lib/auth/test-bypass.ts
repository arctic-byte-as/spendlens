import { createHmac, timingSafeEqual } from 'crypto'

const TEST_AUTH_ENABLED_VALUE = 'true'
const MAX_TEST_AUTH_SKEW_MS = 60_000
const TEST_AUTH_PROFILES = ['owner', 'friend'] as const

type TestAuthProfile = (typeof TEST_AUTH_PROFILES)[number]

type TestAuthPayload = {
  profile: TestAuthProfile
  ts: number
  nonce: string
}

export type TestAuthCredentials = {
  email: string
  password: string
}

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}

export function isTestAuthBypassEnabled(): boolean {
  return process.env.SPENDLENS_TEST_AUTH_ENABLED === TEST_AUTH_ENABLED_VALUE && !isProductionEnvironment()
}

function parseTestAuthPayload(encodedPayload: string): TestAuthPayload | null {
  try {
    const decoded = Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    const parsed = JSON.parse(decoded)

    if (!parsed || typeof parsed !== 'object') return null
    const payload = parsed as Record<string, unknown>

    if (typeof payload.profile !== 'string' || !TEST_AUTH_PROFILES.includes(payload.profile as TestAuthProfile)) {
      return null
    }

    if (typeof payload.ts !== 'number' || !Number.isFinite(payload.ts)) {
      return null
    }

    if (typeof payload.nonce !== 'string' || payload.nonce.length < 8) {
      return null
    }

    return {
      profile: payload.profile as TestAuthProfile,
      ts: payload.ts,
      nonce: payload.nonce,
    }
  } catch {
    return null
  }
}

function isFreshTimestamp(timestamp: number): boolean {
  return Math.abs(Date.now() - timestamp) <= MAX_TEST_AUTH_SKEW_MS
}

function hasValidSignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex')

  if (signature.length !== expected.length) {
    return false
  }

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

function credentialsForProfile(profile: TestAuthProfile): TestAuthCredentials | null {
  if (profile === 'owner') {
    const email = process.env.TEST_AUTH_OWNER_EMAIL
    const password = process.env.TEST_AUTH_OWNER_PASSWORD
    if (!email || !password) return null
    return { email, password }
  }

  const email = process.env.TEST_AUTH_FRIEND_EMAIL
  const password = process.env.TEST_AUTH_FRIEND_PASSWORD
  if (!email || !password) return null
  return { email, password }
}

export function getTestAuthCredentialsFromHeaders(headers: Headers): TestAuthCredentials | null {
  if (!isTestAuthBypassEnabled()) {
    return null
  }

  const secret = process.env.TEST_AUTH_HMAC_SECRET
  if (!secret) {
    return null
  }

  const payloadHeader = headers.get('x-spendlens-test-auth')
  const signatureHeader = headers.get('x-spendlens-test-auth-signature')
  if (!payloadHeader || !signatureHeader) {
    return null
  }

  if (!hasValidSignature(payloadHeader, signatureHeader, secret)) {
    return null
  }

  const payload = parseTestAuthPayload(payloadHeader)
  if (!payload || !isFreshTimestamp(payload.ts)) {
    return null
  }

  return credentialsForProfile(payload.profile)
}
