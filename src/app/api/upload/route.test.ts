const mockLogSecurityEvent = jest.fn()
jest.mock('@/lib/logging/securityLog', () => ({
  logSecurityEvent: (event: unknown) => mockLogSecurityEvent(event),
}))

const mockRequireAuthenticatedRouteContext = jest.fn()
jest.mock('@/lib/api/guard', () => ({
  requireAuthenticatedRouteContext: (...args: unknown[]) => mockRequireAuthenticatedRouteContext(...args),
}))

import { NextRequest } from 'next/server'
import { POST } from './route'

function requestWithFile(filename: string, content: string): NextRequest {
  const file = new File([content], filename, { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)
  return new NextRequest('https://spendlens.example/api/upload', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/upload — rejected upload logging', () => {
  beforeEach(() => {
    mockLogSecurityEvent.mockReset()
    mockRequireAuthenticatedRouteContext.mockReset()
    mockRequireAuthenticatedRouteContext.mockResolvedValue({
      supabase: {},
      user: { id: 'user-1' },
    })
  })

  it('logs an upload_rejected event for a non-CSV file', async () => {
    const request = requestWithFile('malware.exe', 'not a csv')

    const response = await POST(request)

    expect(response.status).toBe(400)
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      eventType: 'upload_rejected',
      route: '/api/upload',
      actor: 'user-1',
      reason: 'invalid_file_type',
    })
  })

  it('logs an upload_rejected event for an oversized file', async () => {
    const request = requestWithFile('data.csv', 'a'.repeat(11 * 1024 * 1024))

    const response = await POST(request)

    expect(response.status).toBe(413)
    expect(mockLogSecurityEvent).toHaveBeenCalledWith({
      eventType: 'upload_rejected',
      route: '/api/upload',
      actor: 'user-1',
      reason: 'file_too_large',
    })
  })
})
