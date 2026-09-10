import { NextRequest, NextResponse } from 'next/server'

const mockRequireImportTokenContext = jest.fn()
jest.mock('@/lib/api/importTokenGuard', () => ({
  requireImportTokenContext: (request: Request) => mockRequireImportTokenContext(request),
}))

const mockImportReceipts = jest.fn()
jest.mock('../importReceipts', () => ({
  importReceipts: (...args: unknown[]) => mockImportReceipts(...args),
}))

import { OPTIONS, POST } from './route'

const ALLOWED_ORIGIN = 'https://www.trumf.no'

function makeRequest(options: { origin?: string; body?: unknown } = {}) {
  const headers = new Headers()
  if (options.origin !== undefined) {
    headers.set('origin', options.origin)
  }
  return new NextRequest('https://spendlens.example/api/receipts/import/bookmarklet', {
    method: 'POST',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : JSON.stringify({ receipts: [] }),
  })
}

describe('bookmarklet import route', () => {
  beforeEach(() => {
    mockRequireImportTokenContext.mockReset()
    mockImportReceipts.mockReset()
  })

  it('responds to OPTIONS with the hardcoded allowed origin, never reflecting the request', async () => {
    const response = await OPTIONS()

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN)
  })

  it('rejects requests from a disallowed origin before checking the token', async () => {
    const request = makeRequest({ origin: 'https://evil.example' })

    const response = await POST(request)

    expect(response.status).toBe(403)
    expect(mockRequireImportTokenContext).not.toHaveBeenCalled()
  })

  it('rejects requests missing an Origin header', async () => {
    const request = makeRequest({})

    const response = await POST(request)

    expect(response.status).toBe(403)
    expect(mockRequireImportTokenContext).not.toHaveBeenCalled()
  })

  it('never reflects an attacker-supplied origin even if it looks similar', async () => {
    const request = makeRequest({ origin: 'https://www.trumf.no.evil.example' })

    const response = await POST(request)

    expect(response.status).toBe(403)
  })

  it('propagates a 401 from the token guard with CORS headers attached', async () => {
    mockRequireImportTokenContext.mockResolvedValue(
      NextResponse.json({ error: 'Invalid import token' }, { status: 401 })
    )
    const request = makeRequest({ origin: ALLOWED_ORIGIN })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN)
  })

  it('calls importReceipts with the resolved userId and admin client, attaching CORS headers', async () => {
    const fakeSupabase = { from: jest.fn() }
    mockRequireImportTokenContext.mockResolvedValue({ supabase: fakeSupabase, userId: 'user-1' })
    mockImportReceipts.mockResolvedValue(NextResponse.json({ imported: 1, skipped: 0, errors: [] }))

    const request = makeRequest({ origin: ALLOWED_ORIGIN, body: { receipts: [] } })

    const response = await POST(request)
    const body = await response.json()

    expect(mockImportReceipts).toHaveBeenCalledWith(fakeSupabase, 'user-1', { receipts: [] })
    expect(body).toEqual({ imported: 1, skipped: 0, errors: [] })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN)
  })

  it('returns 400 for malformed JSON without calling importReceipts', async () => {
    mockRequireImportTokenContext.mockResolvedValue({ supabase: {}, userId: 'user-1' })

    const request = new NextRequest('https://spendlens.example/api/receipts/import/bookmarklet', {
      method: 'POST',
      headers: new Headers({ origin: ALLOWED_ORIGIN }),
      body: '{not-json',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockImportReceipts).not.toHaveBeenCalled()
  })
})
