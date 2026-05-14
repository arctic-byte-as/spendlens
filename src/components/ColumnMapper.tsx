'use client'

import type { ColumnMapping } from '@/lib/csv/parse'

interface Props {
  headers: string[]
  mapping: ColumnMapping
  onMappingChange: (mapping: ColumnMapping) => void
}

const REQUIRED_FIELDS = [
  { key: 'date', label: 'DATE COLUMN' },
  { key: 'description', label: 'DESCRIPTION COLUMN' },
  { key: 'amount', label: 'AMOUNT COLUMN' },
] as const

export default function ColumnMapper({ headers, mapping, onMappingChange }: Props) {
  const selectStyle = {
    fontFamily: 'DM Mono, monospace',
    fontSize: '12px',
    padding: '8px 12px',
    border: '1px solid var(--grid-line)',
    background: 'transparent',
    color: 'var(--carbon)',
    cursor: 'pointer',
    width: '240px',
    outline: 'none',
  }

  return (
    <div>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '16px' }}>
        MAP COLUMNS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {REQUIRED_FIELDS.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.15em', color: 'var(--bronze)', width: '180px' }}>
              {label}
            </span>
            <select
              value={(mapping as unknown as Record<string, string>)[key] || ''}
              onChange={e => onMappingChange({ ...mapping, [key]: e.target.value })}
              style={selectStyle}
            >
              <option value="">— select column —</option>
              {headers.map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
