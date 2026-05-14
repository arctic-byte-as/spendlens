'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIES, type Category } from '@/lib/transactions/categories'
import {
  DATE_PERIODS,
  filterTransactions,
  formatSignedAmount,
  type DatePeriod,
  type TransactionListItem,
} from '@/lib/transactions/table'

const PAGE_SIZE = 25

type Props = {
  initialRows: TransactionListItem[]
  initialCategory?: 'ALL' | 'UNCATEGORISED' | Category
  initialCustomCategories?: string[]
}

export default function TransactionsTable({
  initialRows,
  initialCategory = 'ALL',
  initialCustomCategories = [],
}: Props) {
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'ALL' | 'UNCATEGORISED' | Category>(initialCategory)
  const [period, setPeriod] = useState<DatePeriod>('ALL')
  const [recurringOnly, setRecurringOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [bulkStatus, setBulkStatus] = useState<string>('')

  // Custom categories created by the user
  const [customCategories, setCustomCategories] = useState<string[]>(initialCustomCategories)
  const allCategories = useMemo(() => [...CATEGORIES, ...customCategories], [customCategories])

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  const filteredRows = useMemo(
    () => filterTransactions(rows, search, category, recurringOnly, period),
    [rows, search, category, recurringOnly, period]
  )

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(current => (current > totalPages ? totalPages : current))
  }, [totalPages])

  // Keep header checkbox indeterminate state in sync
  useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el) return
    const allSelected = filteredRows.length > 0 && filteredRows.every(r => selectedIds.has(r.id))
    el.indeterminate = selectedIds.size > 0 && !allSelected
  }, [filteredRows, selectedIds])

  async function updateCategory(id: string, nextCategory: string) {
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

  async function bulkCategoriseSimilar(matchDescription: string, nextCategory: Category) {
    setBulkStatus('')
    setError('')

    const response = await fetch('/api/transactions/bulk-categorise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchDescription, category: nextCategory }),
    })

    const data = await response.json().catch(() => ({ error: 'Unknown error' }))

    if (!response.ok) {
      setError(data.error || 'Bulk update failed')
      return
    }

    const updatedIds = new Set<string>(data.ids || [])
    setRows(current => current.map(row =>
      updatedIds.has(row.id) ? { ...row, category: nextCategory } : row
    ))
    setBulkStatus(`APPLIED TO ${data.updated} TRANSACTION${data.updated === 1 ? '' : 'S'}`)
    setTimeout(() => setBulkStatus(''), 4000)
  }

  // Apply a category to the currently selected IDs
  async function applyBulkCategory(cat: string) {
    if (!cat || selectedIds.size === 0) return
    setBulkStatus('')
    setError('')

    const ids = Array.from(selectedIds)
    const response = await fetch('/api/transactions/bulk-categorise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, category: cat }),
    })
    const data = await response.json().catch(() => ({ error: 'Unknown error' }))
    if (!response.ok) {
      setError(data.error || 'Bulk update failed')
      return
    }
    const updatedIds = new Set<string>(data.ids || [])
    setRows(current => current.map(row =>
      updatedIds.has(row.id) ? { ...row, category: cat } : row
    ))
    setSelectedIds(new Set())
    setBulkCategory('')
    setBulkStatus(`APPLIED "${cat}" TO ${data.updated} TRANSACTION${data.updated === 1 ? '' : 'S'}`)
    setTimeout(() => setBulkStatus(''), 4000)
  }

  // Create a brand new custom category, then assign it to selected IDs
  async function createAndAssign() {
    const name = newCategoryName.trim().toUpperCase()
    if (!name) return
    setError('')

    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json().catch(() => ({ error: 'Unknown error' }))
    if (!res.ok) {
      setError(data.error || 'Failed to create category')
      return
    }
    // Add to local list if not already present
    setCustomCategories(prev => prev.includes(name) ? prev : [...prev, name])
    setIsCreatingCategory(false)
    setNewCategoryName('')
    await applyBulkCategory(name)
  }

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) setSelectedIds(new Set(filteredRows.map(r => r.id)))
    else setSelectedIds(new Set())
  }

  async function deleteTransaction(id: string) {
    if (!window.confirm('Delete this transaction?')) return

    setError('')
    const previous = rows
    setRows(current => current.filter(row => row.id !== id))

    const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setRows(previous)
      const data = await response.json().catch(() => ({ error: 'Failed to delete transaction' }))
      setError(data.error || 'Failed to delete transaction')
    }
  }

  function changeFilterCategory(value: 'ALL' | 'UNCATEGORISED' | Category) {
    setCategory(value)
    setPage(1)
  }

  function changeSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function changePeriod(value: DatePeriod) {
    setPeriod(value)
    setPage(1)
  }

  function toggleRecurring(nextValue: boolean) {
    setRecurringOnly(nextValue)
    setPage(1)
  }

  const controlStyle = {
    padding: '10px 12px',
    border: '1px solid var(--grid-line)',
    background: 'transparent',
    fontFamily: 'DM Mono, monospace',
    fontSize: '12px',
    color: 'var(--carbon)',
  }

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {/* Row 1: search + category + period */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <input
          type="search"
          aria-label="Search merchant or description"
          placeholder="SEARCH MERCHANT OR DESCRIPTION"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
          style={{ ...controlStyle, minWidth: '280px', flex: 1 }}
        />
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => changeFilterCategory(e.target.value as 'ALL' | Category)}
          style={controlStyle}
        >
          <option value="ALL">ALL CATEGORIES</option>
          <option value="UNCATEGORISED">UNCATEGORISED</option>
          {allCategories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Filter by period"
          value={period}
          onChange={(e) => changePeriod(e.target.value as DatePeriod)}
          style={controlStyle}
        >
          {DATE_PERIODS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
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

      {/* Status / error banners */}
      {bulkStatus && (
        <div style={{ color: 'var(--positive)', fontSize: '11px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>
          ✓ {bulkStatus}
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--prancing-horse)', fontSize: '11px' }}>
          {error}
        </div>
      )}

      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          padding: '10px 14px',
          border: '1px solid var(--bronze)',
          background: 'rgba(139,105,20,0.05)',
        }}>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.15em', color: 'var(--bronze)' }}>
            {selectedIds.size} SELECTED
          </span>

          {!isCreatingCategory ? (
            <>
              <select
                aria-label="Category to apply to selected transactions"
                value={bulkCategory}
                onChange={e => {
                  if (e.target.value === '__NEW__') {
                    setIsCreatingCategory(true)
                    setBulkCategory('')
                  } else {
                    setBulkCategory(e.target.value)
                  }
                }}
                style={{ ...controlStyle, minWidth: '200px' }}
              >
                <option value="">— SELECT CATEGORY —</option>
                {allCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__NEW__">＋ CREATE NEW CATEGORY...</option>
              </select>
              <button
                type="button"
                disabled={!bulkCategory}
                onClick={() => applyBulkCategory(bulkCategory)}
                style={{
                  padding: '8px 14px',
                  border: '1px solid var(--bronze)',
                  background: bulkCategory ? 'var(--bronze)' : 'transparent',
                  color: bulkCategory ? '#fff' : 'var(--bronze)',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '8px',
                  letterSpacing: '0.12em',
                  cursor: bulkCategory ? 'pointer' : 'not-allowed',
                }}
              >
                APPLY
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                autoFocus
                placeholder="NEW CATEGORY NAME"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') createAndAssign() }}
                maxLength={50}
                style={{ ...controlStyle, minWidth: '240px' }}
              />
              <button
                type="button"
                disabled={!newCategoryName.trim()}
                onClick={createAndAssign}
                style={{
                  padding: '8px 14px',
                  border: '1px solid var(--bronze)',
                  background: newCategoryName.trim() ? 'var(--bronze)' : 'transparent',
                  color: newCategoryName.trim() ? '#fff' : 'var(--bronze)',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '8px',
                  letterSpacing: '0.12em',
                  cursor: newCategoryName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                CREATE &amp; ASSIGN
              </button>
              <button
                type="button"
                onClick={() => { setIsCreatingCategory(false); setNewCategoryName('') }}
                style={{
                  padding: '8px 10px',
                  border: '1px solid var(--grid-line)',
                  background: 'transparent',
                  color: 'var(--muted)',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '8px',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => { setSelectedIds(new Set()); setBulkCategory(''); setIsCreatingCategory(false); setNewCategoryName('') }}
            style={{
              marginLeft: 'auto',
              padding: '8px 10px',
              border: '1px solid var(--grid-line)',
              background: 'transparent',
              color: 'var(--muted)',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '8px',
              letterSpacing: '0.1em',
              cursor: 'pointer',
            }}
          >
            CLEAR SELECTION
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--grid-line)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--grid-line)', width: '36px' }}>
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  aria-label="Select all visible transactions"
                  checked={filteredRows.length > 0 && filteredRows.every(r => selectedIds.has(r.id))}
                  onChange={e => toggleSelectAll(e.target.checked)}
                />
              </th>
              {['DATE', 'MERCHANT', 'DESCRIPTION', 'CATEGORY', 'AMOUNT', ''].map((header) => (
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
              // Prefer merchant for bulk-match; fall back to description
              const bulkMatchTerm = row.merchant || row.description || ''

              return (
                <tr key={row.id} style={{ background: selectedIds.has(row.id) ? 'rgba(139,105,20,0.06)' : undefined }}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--grid-line)', width: '36px' }}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${labelTarget}`}
                      checked={selectedIds.has(row.id)}
                      onChange={e => toggleRowSelection(row.id, e.target.checked)}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--grid-line)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
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
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        aria-label={`Category for ${labelTarget}`}
                        value={row.category || ''}
                        onChange={(e) => updateCategory(row.id, e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: '160px',
                          padding: '8px',
                          border: '1px solid var(--grid-line)',
                          background: 'transparent',
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '11px',
                        }}
                      >
                        <option value="" disabled>
                          {row.category_source === 'failed' ? 'AI FAILED' : 'PENDING'}
                        </option>
                        {allCategories.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                      {bulkMatchTerm && row.category && (
                        <button
                          type="button"
                          title={`Apply "${row.category}" to all transactions matching "${bulkMatchTerm}"`}
                          onClick={() => {
                            if (window.confirm(
                              `Apply "${row.category}" to ALL transactions matching "${bulkMatchTerm}"?\n\nThis will update every matching transaction in your history.`
                            )) {
                              bulkCategoriseSimilar(bulkMatchTerm, row.category as Category)
                            }
                          }}
                          style={{
                            padding: '6px 8px',
                            border: '1px solid var(--bronze)',
                            background: 'transparent',
                            color: 'var(--bronze)',
                            fontFamily: 'Orbitron, sans-serif',
                            fontSize: '7px',
                            letterSpacing: '0.1em',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          APPLY ALL
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--grid-line)',
                    textAlign: 'right',
                    color: row.amount < 0 ? 'var(--prancing-horse)' : 'var(--positive)',
                    fontFamily: 'DM Mono, monospace',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatSignedAmount(row.amount, row.currency)}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--grid-line)', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => deleteTransaction(row.id)}
                      aria-label={`Delete ${labelTarget}`}
                      style={{
                        padding: '6px 8px',
                        border: '1px solid var(--prancing-horse)',
                        background: 'transparent',
                        color: 'var(--prancing-horse)',
                        fontFamily: 'Orbitron, sans-serif',
                        fontSize: '8px',
                        letterSpacing: '0.12em',
                        cursor: 'pointer',
                      }}
                    >
                      DELETE
                    </button>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: '11px' }}>
          {filteredRows.length} TRANSACTION{filteredRows.length === 1 ? '' : 'S'}
        </span>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
    </div>
  )
}

