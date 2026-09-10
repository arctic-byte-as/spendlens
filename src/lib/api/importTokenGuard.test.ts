import { createHash } from 'crypto'

const mockCreateAdminClient = jest.fn()
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockCreateAdminClient(),
}))

const mockLogSecurityEvent = jest.fn()
jest.mock('@/lib/logging/securityLog', () => ({
  logSecurityEvent: (event: unknown) => mockLogSecurityEvent(event),
}))

import { requireImportTokenContext, IMPORT_TOKEN_RATE_LIMIT } from './importTokenGuard'

const RAW_TOKEN = 'slr_imp_test-token'
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex')

type TokenRow = {
  id: string
  user_id: string
  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
  request_count: number
}

function createAdminMock(tokenRow: TokenRow | null, profileFeatureFlags: Record<string, unknown> = { receipt_analysis: true }) {
  const updateEq = jest.fn(() => Promise.resolve({ error: null }))
  const update = jest.fn(() => ({ eq: updateEq }))

  const from = jest.fn((table: string) => {
    if (table === 'import_tokens') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: tokenRow, error: null })),
          })),
        })),
        update,
      }
    }

    if (table === 'profiles') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: { feature_flags: profileFeatureFlags }, error: null })
            ),
          })),
        })),
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return { from, update, updateEq }
}

function requestWith(token?: string): Request {
  const headers = new Headers()
  if (token !== undefined) {
    headers.set('authorization', `Bearer ${token}`)
  }
  return new Request('https://spendlens.example/api/receipts/import/bookmarklet', { headers })
}

describe('requireImportTokenContext', () => {
  beforeEach(() => {
    mockCreateAdminClient.mockReset()
    mockLogSecurityEvent.mockReset()
  })

  it('rejects a missing Authorization header', async () => {
    const admin = createAdminMock(null)
    mockCreateAdminClient.mockReturnValue(admin)

    const request = new Request('https://spendlens.example/api/receipts/import/bookmarklet')
    const result = await requireImportTokenContext(request)

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('rejects a malformed Authorization header', async () => {
    mockCreateAdminClient.mockReturnValue(createAdminMock(null))

    const headers = new Headers({ authorization: 'Token abc' })
    const request = new Request('https://spendlens.example/api/receipts/import/bookmarklet', { headers })
    const result = await requireImportTokenContext(request)

    expect((result as Response).status).toBe(401)
  })

  it('rejects an unknown token', async () => {
    mockCreateAdminClient.mockReturnValue(createAdminMock(null))

    const result = await requireImportTokenContext(requestWith(RAW_TOKEN))

    expect((result as Response).status).toBe(401)
  })

  it('rejects a revoked token', async () => {
    const admin = createAdminMock({
      id: 'token-1',
      user_id: 'user-1',
      expires_at: new Date(Date.now() + 1000_000).toISOString(),
      revoked_at: new Date().toISOString(),
      last_used_at: null,
      request_count: 0,
    })
    mockCreateAdminClient.mockReturnValue(admin)

    const result = await requireImportTokenContext(requestWith(RAW_TOKEN))

    expect((result as Response).status).toBe(401)
  })

  it('rejects an expired token', async () => {
    const admin = createAdminMock({
      id: 'token-1',
      user_id: 'user-1',
      expires_at: new Date(Date.now() - 1000).toISOString(),
      revoked_at: null,
      last_used_at: null,
      request_count: 0,
    })
    mockCreateAdminClient.mockReturnValue(admin)

    const result = await requireImportTokenContext(requestWith(RAW_TOKEN))

    expect((result as Response).status).toBe(401)
  })

  it('rejects when the rate limit is exceeded within the rolling window', async () => {
    const admin = createAdminMock({
      id: 'token-1',
      user_id: 'user-1',
      expires_at: new Date(Date.now() + 1000_000).toISOString(),
      revoked_at: null,
      last_used_at: new Date().toISOString(),
      request_count: IMPORT_TOKEN_RATE_LIMIT,
    })
    mockCreateAdminClient.mockReturnValue(admin)

    const result = await requireImportTokenContext(requestWith(RAW_TOKEN))

    expect((result as Response).status).toBe(429)
    expect(admin.update).not.toHaveBeenCalled()
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      eventType: 'rate_limit_exceeded',
      route: '/api/receipts/import/bookmarklet',
      actor: 'user-1',
      reason: 'import_token_rate_limit',
    })
  })

  it('resets the counter once the rolling window has elapsed', async () => {
    const admin = createAdminMock({
      id: 'token-1',
      user_id: 'user-1',
      expires_at: new Date(Date.now() + 1000_000).toISOString(),
      revoked_at: null,
      last_used_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      request_count: IMPORT_TOKEN_RATE_LIMIT,
    })
    mockCreateAdminClient.mockReturnValue(admin)

    const result = await requireImportTokenContext(requestWith(RAW_TOKEN))

    expect(result).not.toBeInstanceOf(Response)
    expect(admin.update).toHaveBeenCalledWith(expect.objectContaining({ request_count: 1 }))
  })

  it('rejects when the feature flag is not enabled for the token owner', async () => {
    const admin = createAdminMock(
      {
        id: 'token-1',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 1000_000).toISOString(),
        revoked_at: null,
        last_used_at: null,
        request_count: 0,
      },
      { receipt_analysis: false }
    )
    mockCreateAdminClient.mockReturnValue(admin)

    const result = await requireImportTokenContext(requestWith(RAW_TOKEN))

    expect((result as Response).status).toBe(403)
  })

  it('returns the admin client and userId for a valid token', async () => {
    const admin = createAdminMock({
      id: 'token-1',
      user_id: 'user-1',
      expires_at: new Date(Date.now() + 1000_000).toISOString(),
      revoked_at: null,
      last_used_at: null,
      request_count: 0,
    })
    mockCreateAdminClient.mockReturnValue(admin)

    const result = await requireImportTokenContext(requestWith(RAW_TOKEN))

    expect(result).not.toBeInstanceOf(Response)
    expect(result).toEqual({ supabase: admin, userId: 'user-1' })
    expect(admin.update).toHaveBeenCalledWith(
      expect.objectContaining({ request_count: 1, last_used_at: expect.any(String) })
    )
    expect(mockLogSecurityEvent).not.toHaveBeenCalled()
  })
})
