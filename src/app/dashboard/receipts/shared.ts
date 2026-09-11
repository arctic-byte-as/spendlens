import type { CSSProperties } from 'react'

// Shared visual language for the /dashboard/receipts/* pages (Receipt Analysis, Diet Trend,
// Savings Insights) — keep these in sync so the three pages read as one section.
export const panelTitle: CSSProperties = {
  fontFamily: 'Orbitron, sans-serif',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.3em',
  color: 'var(--muted)',
  textTransform: 'uppercase',
}

export const actionButtonStyle: CSSProperties = {
  fontFamily: 'Orbitron, sans-serif',
  fontSize: '9px',
  letterSpacing: '0.2em',
  padding: '10px 24px',
  background: 'var(--prancing-horse)',
  color: 'white',
  textDecoration: 'none',
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`)
    .toLocaleDateString('nb-NO', { month: 'short', year: 'numeric' })
    .toUpperCase()
}
