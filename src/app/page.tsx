'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

type OAuthProvider = 'azure'

const OAUTH_BUTTONS: { provider: OAuthProvider; label: string; icon: string }[] = [
  { provider: 'azure', label: 'CONTINUE WITH MICROSOFT', icon: 'M' },
]

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--alcantara)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '32px',
            fontWeight: 900,
            letterSpacing: '0.25em',
            color: '#F5F0E8',
            marginBottom: '8px',
          }}
        >
          SPEND<span style={{ color: 'var(--prancing-horse)' }}>●</span>LENS
        </div>
        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '9px',
            letterSpacing: '0.3em',
            color: 'var(--muted)',
            marginBottom: '48px',
            textTransform: 'uppercase',
          }}
        >
          Privacy-First Personal Finance
        </div>

        <div
          style={{
            borderTop: '1px solid #3A3632',
            borderBottom: '1px solid #3A3632',
            padding: '32px 0',
            marginBottom: '40px',
          }}
        >
          <div style={{ color: '#8A8070', fontSize: '12px', marginBottom: '8px' }}>
            Upload CSV bank exports
          </div>
          <div style={{ color: '#8A8070', fontSize: '12px', marginBottom: '8px' }}>
            AI categorises your spending automatically
          </div>
          <div style={{ color: '#8A8070', fontSize: '12px' }}>
            Dashboard surfaces ranked savings opportunities
          </div>
        </div>

        {status === 'sent' ? (
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '11px',
              letterSpacing: '0.15em',
              color: 'var(--positive)',
              padding: '20px',
              border: '1px solid var(--positive)',
            }}
          >
            CHECK YOUR EMAIL — MAGIC LINK SENT
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="YOUR EMAIL ADDRESS"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                marginBottom: '12px',
                background: 'transparent',
                border: '1px solid #3A3632',
                color: '#F5F0E8',
                fontFamily: 'DM Mono, monospace',
                fontSize: '13px',
                letterSpacing: '0.05em',
                outline: 'none',
              }}
            />
            {status === 'error' && (
              <div style={{ color: 'var(--prancing-horse)', fontSize: '11px', marginBottom: '12px' }}>
                {errorMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--prancing-horse)',
                color: '#F5F0E8',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: status === 'loading' ? 'wait' : 'pointer',
              }}
            >
              {status === 'loading' ? 'SENDING...' : 'SEND MAGIC LINK'}
            </button>
          </form>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '28px 0 20px' }}>
          <div style={{ flex: 1, height: '1px', background: '#3A3632' }} />
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.2em', color: '#6A6050' }}>OR</div>
          <div style={{ flex: 1, height: '1px', background: '#3A3632' }} />
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          {OAUTH_BUTTONS.map(({ provider, label, icon }) => (
            <button
              key={provider}
              type="button"
              onClick={() => handleOAuth(provider)}
              style={{
                width: '100%',
                padding: '11px 16px',
                background: 'transparent',
                color: '#F5F0E8',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.15em',
                border: '1px solid #3A3632',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontFamily: 'sans-serif', fontSize: '14px', lineHeight: 1 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
