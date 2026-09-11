import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { logSecurityEvent } from '@/lib/logging/securityLog'

export type AuthenticatedRouteContext = {
  supabase: ReturnType<typeof createServerClient>
  user: User
}

function actorFromRequest(request?: Request): string {
  const forwardedFor = request?.headers.get('x-forwarded-for')
  return forwardedFor?.split(',')[0]?.trim() || 'unknown'
}

function routeFromRequest(request?: Request): string {
  if (!request) return 'unknown'
  try {
    return new URL(request.url).pathname
  } catch {
    return 'unknown'
  }
}

export async function requireAuthenticatedRouteContext(
  request?: Request
): Promise<AuthenticatedRouteContext | NextResponse> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    logSecurityEvent({
      eventType: 'auth_failure',
      route: routeFromRequest(request),
      actor: actorFromRequest(request),
      reason: 'no_authenticated_session',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { supabase, user }
}
