import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedRouteContext } from '@/lib/api/guard'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuthenticatedRouteContext()
  if (auth instanceof NextResponse) return auth
  const { supabase, user } = auth

  const { data: upload, error: lookupError } = await supabase
    .from('uploads')
    .select('id, storage_path')
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

  if (upload.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('uploads')
      .remove([upload.storage_path])

    if (storageError) {
      console.error('Storage delete failed:', storageError)
    }
  }

  const { error: deleteError } = await supabase
    .from('uploads')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('Upload delete failed:', deleteError)
    return NextResponse.json({ error: 'Failed to delete upload' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
