import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'
import { hasFlag } from '@/lib/features'
import { importReceipts } from './importReceipts'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedRouteContext(request)
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

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON in request body' }, { status: 400 })
  }

  return importReceipts(supabase, user.id, requestBody)
}
