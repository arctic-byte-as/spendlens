import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'
import { parseTransactionPatchPayload } from './payload'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthenticatedRouteContext()
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  let payload: ReturnType<typeof parseTransactionPatchPayload>
  try {
    payload = parseTransactionPatchPayload(await request.json())
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request body' },
      { status: 400 }
    )
  }

  const { data: existingTx, error: existingError } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingError) {
    console.error('Transaction lookup failed:', existingError)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }

  if (!existingTx) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  const updatePayload = 'category' in payload
    ? { ...payload, category_source: 'user', category_corrected_at: new Date().toISOString() }
    : payload

  const { data: updated, error: updateError } = await supabase
    .from('transactions')
    .update(updatePayload)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, category, notes')
    .single()

  if (updateError) {
    console.error('Transaction update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }

  return NextResponse.json({ transaction: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthenticatedRouteContext()
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  const { data: deleted, error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (deleteError) {
    console.error('Transaction delete failed:', deleteError)
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 })
  }

  if (!deleted) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
