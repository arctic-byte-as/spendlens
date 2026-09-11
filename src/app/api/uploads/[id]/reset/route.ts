import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthenticatedRouteContext(request)
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  const { data: upload, error: lookupError } = await supabase
    .from('uploads')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (lookupError) {
    console.error('Upload lookup failed:', lookupError)
    return NextResponse.json({ error: 'Failed to find upload' }, { status: 500 })
  }

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id')
    .eq('upload_id', params.id)
    .eq('user_id', user.id)
    .limit(1)

  if (txError) {
    console.error('Transaction lookup failed:', txError)
    return NextResponse.json({ error: 'Failed to inspect upload' }, { status: 500 })
  }

  const nextStatus = transactions && transactions.length > 0 ? 'error' : 'processing'
  const { error: updateError } = await supabase
    .from('uploads')
    .update({ status: nextStatus })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Upload reset failed:', updateError)
    return NextResponse.json({ error: 'Failed to reset upload' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: nextStatus })
}
