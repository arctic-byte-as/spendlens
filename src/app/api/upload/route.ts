import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate file type
  const filename = file.name.toLowerCase()
  if (!filename.endsWith('.csv')) {
    return NextResponse.json({ error: 'Only .csv files are accepted' }, { status: 400 })
  }

  // Validate size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 })
  }

  const uploadId = crypto.randomUUID()
  const storagePath = `uploads/${user.id}/${uploadId}.csv`

  // Store in Supabase Storage
  const fileBuffer = await file.arrayBuffer()
  const { error: storageError } = await supabase.storage
    .from('csv-uploads')
    .upload(storagePath, fileBuffer, { contentType: 'text/csv' })

  if (storageError) {
    console.error('Storage error:', storageError)
    return NextResponse.json({ error: 'Failed to store file' }, { status: 500 })
  }

  // Create uploads row
  const { error: dbError } = await supabase.from('uploads').insert({
    id: uploadId,
    user_id: user.id,
    filename: file.name,
    status: 'processing',
    storage_path: storagePath,
  })

  if (dbError) {
    console.error('DB error:', dbError)
    return NextResponse.json({ error: 'Failed to create upload record' }, { status: 500 })
  }

  return NextResponse.json({ uploadId })
}
