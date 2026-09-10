import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasFlag } from '@/lib/features'

const TOKEN_PREFIX = 'slr_imp_'
const TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000
const DISPLAY_PREFIX_LENGTH = 8

function generateToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function requireReceiptAnalysisAccess() {
  const auth = await requireAuthenticatedRouteContext()
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('feature_flags')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Profile lookup failed:', profileError)
    return NextResponse.json({ error: 'Failed to validate feature access' }, { status: 500 })
  }

  if (!hasFlag(profile, 'receipt_analysis')) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 403 })
  }

  return { userId: user.id }
}

export async function POST() {
  const access = await requireReceiptAnalysisAccess()
  if (access instanceof NextResponse) return access
  const { userId } = access

  const admin = createAdminClient()
  const now = new Date()

  const { error: revokeError } = await admin
    .from('import_tokens')
    .update({ revoked_at: now.toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (revokeError) {
    console.error('Failed to revoke prior import token:', revokeError)
    return NextResponse.json({ error: 'Failed to issue import token' }, { status: 500 })
  }

  const token = generateToken()
  const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS)

  const { error: insertError } = await admin.from('import_tokens').insert({
    user_id: userId,
    token_hash: hashToken(token),
    token_prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
    expires_at: expiresAt.toISOString(),
  })

  if (insertError) {
    console.error('Failed to persist import token:', insertError)
    return NextResponse.json({ error: 'Failed to issue import token' }, { status: 500 })
  }

  return NextResponse.json({
    token,
    tokenPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
    expiresAt: expiresAt.toISOString(),
  })
}

export async function DELETE() {
  const access = await requireReceiptAnalysisAccess()
  if (access instanceof NextResponse) return access
  const { userId } = access

  const admin = createAdminClient()

  const { error } = await admin
    .from('import_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (error) {
    console.error('Failed to revoke import token:', error)
    return NextResponse.json({ error: 'Failed to revoke import token' }, { status: 500 })
  }

  return NextResponse.json({ revoked: true })
}

export async function GET() {
  const access = await requireReceiptAnalysisAccess()
  if (access instanceof NextResponse) return access
  const { userId } = access

  const admin = createAdminClient()

  const { data: tokenRow, error } = await admin
    .from('import_tokens')
    .select('token_prefix, expires_at, last_used_at, request_count, revoked_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Failed to load import token status:', error)
    return NextResponse.json({ error: 'Failed to load import token status' }, { status: 500 })
  }

  if (!tokenRow) {
    return NextResponse.json({ token: null })
  }

  return NextResponse.json({
    token: {
      tokenPrefix: tokenRow.token_prefix,
      expiresAt: tokenRow.expires_at,
      lastUsedAt: tokenRow.last_used_at,
      requestCount: tokenRow.request_count,
    },
  })
}
