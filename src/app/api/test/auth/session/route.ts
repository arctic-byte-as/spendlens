import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getTestAuthCredentialsFromHeaders, isTestAuthBypassEnabled } from '@/lib/auth/test-bypass'

export const runtime = 'nodejs'

function notFoundResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Not found' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: NextRequest) {
  if (!isTestAuthBypassEnabled()) {
    return notFoundResponse()
  }

  const credentials = getTestAuthCredentialsFromHeaders(request.headers)
  if (!credentials) {
    return notFoundResponse()
  }

  const supabase = createServerClient()
  const { error } = await supabase.auth.signInWithPassword(credentials)

  if (error) {
    console.error('Test auth bootstrap failed:', error.message)
    return NextResponse.json(
      { error: 'Test auth bootstrap failed' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}
