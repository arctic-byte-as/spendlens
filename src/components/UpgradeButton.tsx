'use client'

import { useState, type CSSProperties } from 'react'

type UpgradeButtonProps = {
  label?: string
  style?: CSSProperties
}

export default function UpgradeButton({ label = 'UPGRADE — $8/MO', style }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Unable to start checkout')
      }
      window.location.href = data.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={loading}
      style={{
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '9px',
        letterSpacing: '0.2em',
        padding: '10px 24px',
        background: 'var(--prancing-horse)',
        color: 'white',
        border: 'none',
        cursor: loading ? 'wait' : 'pointer',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {loading ? 'LOADING...' : label}
    </button>
  )
}
