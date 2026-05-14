'use client'

import { useState } from 'react'

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false)

  const handleOpenPortal = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Unable to open billing portal')
      }
      window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpenPortal}
      disabled={loading}
      style={{
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '9px',
        fontWeight: 500,
        letterSpacing: '0.2em',
        color: 'var(--muted)',
        textTransform: 'uppercase',
        border: 'none',
        background: 'transparent',
        cursor: loading ? 'wait' : 'pointer',
      }}
    >
      {loading ? 'LOADING...' : 'MANAGE BILLING'}
    </button>
  )
}
