'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  uploadId: string
  uploadStatus: string | null
}

export default function RecategoriseUploadButton({ uploadId, uploadStatus }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'running' | 'resetting' | 'error'>('idle')
  const isProcessing = uploadStatus === 'processing'

  async function recategorise() {
    setStatus('running')
    const response = await fetch(`/api/uploads/${uploadId}/recategorise`, { method: 'POST' })
    if (!response.ok) {
      setStatus('error')
      return
    }

    setStatus('idle')
    router.refresh()
  }

  async function reset() {
    setStatus('resetting')
    const response = await fetch(`/api/uploads/${uploadId}/reset`, { method: 'POST' })
    if (!response.ok) {
      setStatus('error')
      return
    }

    setStatus('idle')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {isProcessing ? (
        <button
          type="button"
          onClick={reset}
          disabled={status !== 'idle'}
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '8px',
            letterSpacing: '0.12em',
            padding: '6px 10px',
            border: '1px solid var(--grid-line)',
            background: 'transparent',
            color: 'var(--carbon)',
            cursor: status !== 'idle' ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'resetting' ? 'RESETTING...' : 'RESET'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={recategorise}
        disabled={status !== 'idle' || isProcessing}
        style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '8px',
          letterSpacing: '0.12em',
          padding: '6px 10px',
          border: '1px solid var(--grid-line)',
          background: 'transparent',
          color: 'var(--carbon)',
          cursor: status !== 'idle' || isProcessing ? 'not-allowed' : 'pointer',
          opacity: isProcessing ? 0.45 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {status === 'running' ? 'RUNNING...' : 'RERUN AI'}
      </button>
      {status === 'error' ? (
        <span style={{ color: 'var(--prancing-horse)', fontSize: '10px' }}>FAILED</span>
      ) : null}
    </div>
  )
}
