import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'
import { isCanonicalCategory, isValidCategoryName } from '@/lib/transactions/categories'

/**
 * GET /api/categories
 * Returns the user's custom categories as a sorted string array.
 */
export async function GET() {
  const auth = await requireAuthenticatedRouteContext()
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  const { data, error } = await supabase
    .from('user_categories')
    .select('name')
    .eq('user_id', user.id)
    .order('name')

  if (error) {
    console.error('Failed to fetch user categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }

  return NextResponse.json({ categories: (data || []).map(r => r.name) })
}

/**
 * POST /api/categories
 * Body: { name: string }
 * Creates a new custom category for the user. The name must not clash with a
 * canonical category and must match the allowed character set.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedRouteContext(request)
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name } = body as Record<string, unknown>
  if (typeof name !== 'string') {
    return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
  }

  const normalised = name.toUpperCase().trim()

  if (isCanonicalCategory(normalised)) {
    return NextResponse.json({ error: `"${normalised}" is already a built-in category` }, { status: 409 })
  }

  if (!isValidCategoryName(normalised)) {
    return NextResponse.json({
      error: 'Category name must be 1–50 characters: uppercase letters, digits, spaces, &, apostrophes, or hyphens',
    }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_categories')
    .insert({ user_id: user.id, name: normalised })

  if (error) {
    if (error.code === '23505') {
      // Unique violation — category already exists; treat as success
      return NextResponse.json({ name: normalised })
    }
    console.error('Failed to create user category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }

  return NextResponse.json({ name: normalised }, { status: 201 })
}
