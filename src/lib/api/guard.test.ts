const mockGetUser = jest.fn()
const mockCreateServerClient = jest.fn(() => ({
  auth: { getUser: mockGetUser },
}))

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: () => mockCreateServerClient(),
}))

const mockLogSecurityEvent = jest.fn()
jest.mock('@/lib/logging/securityLog', () => ({
  logSecurityEvent: (event: unknown) => mockLogSecurityEvent(event),
}))

import { requireAuthenticatedRouteContext } from './guard'

describe('requireAuthenticatedRouteContext', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockLogSecurityEvent.mockReset()
  })

  it('returns the supabase client and user when authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const result = await requireAuthenticatedRouteContext()

    expect(result).toEqual({ supabase: expect.any(Object), user: { id: 'user-1' } })
    expect(mockLogSecurityEvent).not.toHaveBeenCalled()
  })

  it('returns 401 and logs an auth_failure event when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const request = new Request('https://spendlens.example/api/transactions/tx-1', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    })

    const result = await requireAuthenticatedRouteContext(request)

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
    expect(mockLogSecurityEvent).toHaveBeenCalledTimes(1)
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      eventType: 'auth_failure',
      route: '/api/transactions/tx-1',
      actor: '203.0.113.5',
      reason: 'no_authenticated_session',
    })
  })

  it('falls back to "unknown" route and actor when no request is passed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await requireAuthenticatedRouteContext()

    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      eventType: 'auth_failure',
      route: 'unknown',
      actor: 'unknown',
      reason: 'no_authenticated_session',
    })
  })
})
