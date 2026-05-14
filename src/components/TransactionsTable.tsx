'use client'

import { useEffect, useMemo, useState } from 'react'
import { CATEGORIES, type Category } from '@/lib/transactions/categories'
import {
  filterTransactions,
  formatSignedAmount,
  type TransactionListItem,
} from '@/lib/transactions/table'

const PAGE_SIZE = 25

type Props = {
  initialRows: TransactionListItem[]
}

export default function TransactionsTable({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'ALL' | Category>('ALL')
  const [recurringOnly, setRecurringOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  const filteredRows = useMemo(
    () => filterTransactions(rows, search, category, recurringOnly),
    [rows, search, category, recurringOnly]
  )

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(current => (current > totalPages ? totalPages : current))
  }, [totalPages])

  async function updateCategory(id: string, nextCategory: Category) {
    setError('')
    const previous = rows
    setRows(current => current.map(row => (
      row.id === id ? { ...row, category: nextCategory } : row
    )))

    const response = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: nextCategory }),
    })

    if (!response.ok) {
      setRows(previous)
      const data = await response.json().catch(() => ({ error: 'Failed to update category' }))
      setError(data.error || 'Failed to update category')
    }
  }

  function changeFilterCategory(value: 'ALL' | Category) {
    setCategory(value)
    setPage(1)
  }

  function changeSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function toggleRecurring(nextValue: boolean) {
    setRecurringOnly(nextValue)
    setPage(1)
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <input
          type="search"
          aria-label="Search merchant or description"
          placeholder="SEARCH MERCHANT OR DESCRIPTION"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          style={{
            minWidth: '280px',
            flex: 1,
            padding: '10px 12px',
            border: '1px solid var(--grid-line)',
            background: 'transparent',
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
          }}
        />
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => changeFilterCategory(e.target.value as 'ALL' | Category)}
          style={{
            padding: '10px 12px',
            border: '1px solid var(--grid-line)',
            background: 'transparent',
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
          }}
        >
          <option value="ALL">ALL CATEGORIES</option>
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--muted)' }}>
          <input
            type="checkbox"
            checked={recurringOnly}
            onChange={(e) => toggleRecurring(e.target.checked)}
          />
          RECURRING ONLY
        </label>
      </div>

      {error && (
        <div style={{ color: 'var(--prancing-horse)', fontSize: '11px' }}>
          {error}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--grid-line)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['DATE', 'MERCHANT', 'DESCRIPTION', 'CATEGORY', 'AMOUNT'].map((header) => (
                <th
                  key={header}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--grid-line)',
                    textAlign: 'left',
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: '8px',
                    letterSpacing: '0.18em',
                    color: 'var(--muted)',
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => {
              const formattedDate = new Date(row.date).toLocaleDateString('nb-NO')
              const labelTarget = row.description || row.merchant || `transaction on ${formattedDate}`

              return (
                <tr key={row.id}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--grid-line)', color: 'var(--muted)' }}>
                  {formattedDate}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--grid-line)' }}>
                  {row.merchant || '—'}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--grid-line)' }}>
                  <div>{row.description || '—'}</div>
                  {row.is_recurring ? (
                    <span style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 6px',
                      border: '1px solid var(--bronze)',
                      color: 'var(--bronze)',
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: '8px',
                      letterSpacing: '0.1em',
                    }}>
                      RECURRING
                    </span>
                  ) : null}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--grid-line)' }}>
                  <select
                    aria-label={`Category for ${labelTarget}`}
                    value={row.category || 'OTHER'}
                    onChange={(e) => updateCategory(row.id, e.target.value as Category)}
                    style={{
                      width: '100%',
                      minWidth: '180px',
                      padding: '8px',
                      border: '1px solid var(--grid-line)',
                      background: 'transparent',
                      fontFamily: 'DM Mono, monospace',
                      fontSize: '11px',
                    }}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </td>
                <td style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--grid-line)',
                  textAlign: 'right',
                  color: row.amount < 0 ? 'var(--prancing-horse)' : 'var(--positive)',
                  fontFamily: 'DM Mono, monospace',
                }}>
                  {formatSignedAmount(row.amount, row.currency)}
                </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filteredRows.length === 0 && (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
          NO TRANSACTIONS MATCH YOUR FILTERS
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--grid-line)',
              background: 'transparent',
              color: 'var(--carbon)',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '9px',
              letterSpacing: '0.12em',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            PREV
          </button>
          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
            PAGE {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--grid-line)',
              background: 'transparent',
              color: 'var(--carbon)',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '9px',
              letterSpacing: '0.12em',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            NEXT
          </button>
        </div>
      )}
    </div>
  )
}
