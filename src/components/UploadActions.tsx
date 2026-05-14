'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import RecategoriseUploadButton from './RecategoriseUploadButton'

type Props = {
  uploadId: string
  uploadStatus: string | null
}

export default function UploadActions({ uploadId, uploadStatus }: Props) {
  const router = useRouter()
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle')

  async function deleteUpload() {
    if (!window.confirm('Delete this upload and all its transactions?')) return

    setDeleteStatus('deleting')
    const response = await fetch(`/api/uploads/${uploadId}`, { method: 'DELETE' })
    if (!response.ok) {
      setDeleteStatus('error')
      return
    }

    router.refresh()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <RecategoriseUploadButton uploadId={uploadId} uploadStatus={uploadStatus} />
      <button
        type="button"
        onClick={deleteUpload}
        disabled={deleteStatus === 'deleting'}
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '8px',
          letterSpacing: '0.12em',
          padding: '6px 10px',
          border: '1px solid var(--prancing-horse)',
          background: 'transparent',
          color: 'var(--prancing-horse)',
          cursor: deleteStatus === 'deleting' ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {deleteStatus === 'deleting' ? 'DELETING...' : 'DELETE'}
      </button>
      {deleteStatus === 'error' ? (
        <span style={{ color: 'var(--prancing-horse)', fontSize: '10px' }}>FAILED</span>
      ) : null}
    </div>
  )
}
