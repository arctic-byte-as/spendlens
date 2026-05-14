import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: { uploadId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: upload, error: uploadError } = await supabase
    .from('uploads')
    .select('id')
    .eq('id', params.uploadId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (uploadError) {
    console.error('Upload lookup failed:', uploadError)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  const { data: insight, error: insightError } = await supabase
    .from('insights')
    .select('*')
    .eq('upload_id', params.uploadId)
    .eq('user_id', user.id)
    .order('generated_at', { ascending: false })
    .maybeSingle()

  if (insightError) {
    console.error('Insights lookup failed:', insightError)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }

  if (!insight) {
    return NextResponse.json({ error: 'Insights not found' }, { status: 404 })
  }

  return NextResponse.json({ insight })
}
