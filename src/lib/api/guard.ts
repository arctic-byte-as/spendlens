import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export type AuthenticatedRouteContext = {
  supabase: ReturnType<typeof createServerClient>
  user: User
}

export async function requireAuthenticatedRouteContext(): Promise<AuthenticatedRouteContext | NextResponse> {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { supabase, user }
}
