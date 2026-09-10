import { NextRequest, NextResponse } from 'next/server'
import { requireImportTokenContext } from '@/lib/api/importTokenGuard'
import { importReceipts } from '../importReceipts'

const ALLOWED_ORIGIN = 'https://www.trumf.no'

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin !== ALLOWED_ORIGIN) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
  }

  const auth = await requireImportTokenContext(request)
  if (auth instanceof NextResponse) {
    for (const [key, value] of Object.entries(corsHeaders())) {
      auth.headers.set(key, value)
    }
    return auth
  }
  const { supabase, userId } = auth

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON in request body' },
      { status: 400, headers: corsHeaders() },
    )
  }

  const response = await importReceipts(supabase, userId, requestBody)
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value)
  }
  return response
}
