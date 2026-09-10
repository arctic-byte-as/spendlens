import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasFlag } from '@/lib/features'

export const IMPORT_TOKEN_RATE_LIMIT = 20
export const IMPORT_TOKEN_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

export type ImportTokenContext = {
  supabase: ReturnType<typeof createAdminClient>
  userId: string
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function unauthorized(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

export async function requireImportTokenContext(request: Request): Promise<ImportTokenContext | NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized('Missing or malformed Authorization header')
  }

  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) {
    return unauthorized('Missing or malformed Authorization header')
  }

  const tokenHash = hashToken(token)
  const admin = createAdminClient()

  const { data: tokenRow, error: tokenLookupError } = await admin
    .from('import_tokens')
    .select('id, user_id, expires_at, revoked_at, last_used_at, request_count')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Import token lookup failed:', tokenLookupError)
    return NextResponse.json({ error: 'Failed to validate import token' }, { status: 500 })
  }

  if (!tokenRow) {
    return unauthorized('Invalid import token')
  }

  if (tokenRow.revoked_at) {
    return unauthorized('Import token has been revoked')
  }

  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return unauthorized('Import token has expired')
  }

  const now = Date.now()
  const windowStart = tokenRow.last_used_at ? new Date(tokenRow.last_used_at).getTime() : 0
  const withinWindow = now - windowStart < IMPORT_TOKEN_RATE_LIMIT_WINDOW_MS
  const nextRequestCount = withinWindow ? tokenRow.request_count + 1 : 1

  if (withinWindow && tokenRow.request_count >= IMPORT_TOKEN_RATE_LIMIT) {
    return NextResponse.json({ error: 'Rate limit exceeded, try again later' }, { status: 429 })
  }

  const { error: updateError } = await admin
    .from('import_tokens')
    .update({ last_used_at: new Date(now).toISOString(), request_count: nextRequestCount })
    .eq('id', tokenRow.id)

  if (updateError) {
    console.error('Import token usage update failed:', updateError)
    return NextResponse.json({ error: 'Failed to validate import token' }, { status: 500 })
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('feature_flags')
    .eq('id', tokenRow.user_id)
    .maybeSingle()

  if (profileError) {
    console.error('Profile lookup failed during import token auth:', profileError)
    return NextResponse.json({ error: 'Failed to validate feature access' }, { status: 500 })
  }

  if (!hasFlag(profile, 'receipt_analysis')) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 })
  }

  return { supabase: admin, userId: tokenRow.user_id }
}
