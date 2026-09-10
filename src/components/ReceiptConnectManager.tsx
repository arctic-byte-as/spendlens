'use client'

import { useCallback, useEffect, useState } from 'react'
import { buildBookmarkletHref } from '@/lib/receipts/bookmarklet'

type TokenStatus = {
  tokenPrefix: string
  expiresAt: string
  lastUsedAt: string | null
  requestCount: number
}

type LoadState = 'loading' | 'loaded' | 'error'
type ActionState = 'idle' | 'generating' | 'revoking'

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  return new Date(value).toLocaleString('nb-NO')
}

export default function ReceiptConnectManager() {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [actionState, setActionState] = useState<ActionState>('idle')
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const loadStatus = useCallback(async () => {
    setLoadState('loading')
    setErrorMsg('')
    try {
      const response = await fetch('/api/receipts/import-token')
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load token status')
      }
      setTokenStatus(data.token)
      setLoadState('loaded')
    } catch (error) {
      setLoadState('error')
      setErrorMsg(error instanceof Error ? error.message : 'Failed to load token status')
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const handleGenerate = async () => {
    setActionState('generating')
    setErrorMsg('')
    setFreshToken(null)
    try {
      const response = await fetch('/api/receipts/import-token', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate import token')
      }
      setFreshToken(data.token)
      await loadStatus()
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to generate import token')
    } finally {
      setActionState('idle')
    }
  }

  const handleRevoke = async () => {
    setActionState('revoking')
    setErrorMsg('')
    try {
      const response = await fetch('/api/receipts/import-token', { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke import token')
      }
      setFreshToken(null)
      await loadStatus()
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Failed to revoke import token')
    } finally {
      setActionState('idle')
    }
  }

  const panelTitle: React.CSSProperties = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.3em',
    color: 'var(--muted)',
    textTransform: 'uppercase',
  }

  const metricBox: React.CSSProperties = {
    border: '1px solid var(--grid-line)',
    padding: '18px',
    minHeight: '86px',
  }

  const buttonStyle: React.CSSProperties = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '9px',
    letterSpacing: '0.2em',
    padding: '11px 26px',
    background: 'var(--prancing-horse)',
    color: 'white',
    border: 'none',
    cursor: actionState === 'idle' ? 'pointer' : 'wait',
  }

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'transparent',
    color: 'var(--carbon)',
    border: '1px solid var(--grid-line)',
  }

  const bookmarkletHref = freshToken
    ? buildBookmarkletHref(freshToken, process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
    : null

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      <div style={{ color: 'var(--muted)', fontSize: '12px', maxWidth: '640px' }}>
        Generate a personal import token, then drag the bookmarklet below to your bookmarks
        bar. Click it while logged in at{' '}
        <code style={{ fontFamily: 'DM Mono, monospace' }}>trumf.no/profil/kvitteringer</code>{' '}
        to pull your receipts straight into SpendLens.
      </div>

      {errorMsg && (
        <div style={{ border: '1px solid var(--prancing-horse)', padding: '14px', color: 'var(--carbon)', fontSize: '12px' }}>
          {errorMsg}
        </div>
      )}

      {loadState === 'loading' && (
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Loading token status...</div>
      )}

      {loadState !== 'loading' && (
        <>
          <section>
            <div style={{ ...panelTitle, marginBottom: '14px' }}>Token Status</div>
            {tokenStatus ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
                {[
                  ['TOKEN', `${tokenStatus.tokenPrefix}...`],
                  ['EXPIRES', formatDateTime(tokenStatus.expiresAt)],
                  ['LAST USED', formatDateTime(tokenStatus.lastUsedAt)],
                  ['REQUESTS', tokenStatus.requestCount.toLocaleString('nb-NO')],
                ].map(([label, value]) => (
                  <div key={label} style={metricBox}>
                    <div style={{ ...panelTitle, fontSize: '7px', marginBottom: '10px' }}>{label}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--carbon)', lineHeight: 1.45 }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No active import token.</div>
            )}
          </section>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button type="button" onClick={handleGenerate} disabled={actionState !== 'idle'} style={buttonStyle}>
              {actionState === 'generating' ? 'GENERATING...' : tokenStatus ? 'REGENERATE TOKEN' : 'GENERATE TOKEN'}
            </button>
            {tokenStatus && (
              <button type="button" onClick={handleRevoke} disabled={actionState !== 'idle'} style={secondaryButtonStyle}>
                {actionState === 'revoking' ? 'REVOKING...' : 'REVOKE'}
              </button>
            )}
          </div>

          {tokenStatus && !freshToken && (
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Regenerating replaces your current token and invalidates any existing bookmarklet link.
            </div>
          )}

          {freshToken && bookmarkletHref && (
            <section>
              <div style={{ ...panelTitle, marginBottom: '14px' }}>Install Bookmarklet</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '16px' }}>
                This link is shown once and embeds your import token. Drag it to your bookmarks
                bar now — it won&apos;t be shown again after you leave this page.
              </div>
              <a
                href={bookmarkletHref}
                onClick={event => event.preventDefault()}
                style={{
                  display: 'inline-block',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '9px',
                  letterSpacing: '0.2em',
                  padding: '11px 26px',
                  background: 'var(--carbon)',
                  color: 'white',
                  textDecoration: 'none',
                  cursor: 'grab',
                }}
              >
                IMPORT TRUMF RECEIPTS
              </a>
            </section>
          )}
        </>
      )}
    </div>
  )
}
