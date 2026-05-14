import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isCanonicalCategory, isValidCategoryName } from '@/lib/transactions/categories'

/**
 * POST /api/transactions/bulk-categorise
 *
 * Body: { matchDescription: string, category: string }
 *
 * Updates all transactions for the authenticated user whose description OR
 * merchant matches the given string (case-insensitive, exact token match)
 * and sets their category + marks them as user-corrected.
 *
 * Returns: { updated: number, ids: string[] }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { matchDescription, ids: rawIds, category } = body as Record<string, unknown>

  if (typeof category !== 'string') {
    return NextResponse.json({ error: 'category is required' }, { status: 400 })
  }
  const normCategory = category.toUpperCase().trim()
  if (!isCanonicalCategory(normCategory) && !isValidCategoryName(normCategory)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  let matchingIds: string[]

  if (Array.isArray(rawIds) && rawIds.length > 0) {
    // Mode: assign a specific set of transaction IDs
    if (!rawIds.every(id => typeof id === 'string')) {
      return NextResponse.json({ error: 'ids must be an array of strings' }, { status: 400 })
    }
    // Filter to only IDs the user actually owns (DB RLS also enforces this)
    const { data: owned, error: ownedError } = await supabase
      .from('transactions')
      .select('id')
      .in('id', rawIds as string[])
      .eq('user_id', user.id)
    if (ownedError) {
      console.error('bulk-categorise fetch error:', ownedError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }
    matchingIds = (owned || []).map(tx => tx.id)
  } else if (typeof matchDescription === 'string' && matchDescription.trim().length > 0) {
    // Mode: match all transactions by description/merchant substring
    const matchTerm = matchDescription.trim().toLowerCase()
    const { data: allTxs, error: fetchError } = await supabase
      .from('transactions')
      .select('id, description, merchant')
      .eq('user_id', user.id)
    if (fetchError) {
      console.error('bulk-categorise fetch error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }
    matchingIds = (allTxs || [])
      .filter(tx => {
        const desc = (tx.description || '').toLowerCase()
        const merch = (tx.merchant || '').toLowerCase()
        return desc.includes(matchTerm) || merch.includes(matchTerm)
      })
      .map(tx => tx.id)
  } else {
    return NextResponse.json({ error: 'Provide either ids[] or matchDescription' }, { status: 400 })
  }

  if (matchingIds.length === 0) {
    return NextResponse.json({ updated: 0, ids: [] })
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      category: normCategory,
      category_source: 'user',
      category_corrected_at: new Date().toISOString(),
    })
    .in('id', matchingIds)
    .eq('user_id', user.id)   // belt-and-braces RLS complement

  if (updateError) {
    console.error('bulk-categorise update error:', updateError)
    return NextResponse.json({ error: 'Failed to update transactions' }, { status: 500 })
  }

  return NextResponse.json({ updated: matchingIds.length, ids: matchingIds })
}
