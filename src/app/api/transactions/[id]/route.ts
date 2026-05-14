import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { parseTransactionPatchPayload } from './payload'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const { data: updated, error: updateError } = await supabase
    .from('transactions')
    .update(payload)
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
