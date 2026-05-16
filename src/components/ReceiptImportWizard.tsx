'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createReceiptImportPreview,
  extractReceiptsFromJson,
  type ReceiptImportPreview,
  type ReceiptImportReceipt,
} from '@/lib/receipts/importPreview'

type ImportStatus = 'idle' | 'ready' | 'importing' | 'done' | 'error'

function resolveDisplayCurrency(receipts: ReceiptImportReceipt[]): string {
  const counts = new Map<string, number>()

  for (const receipt of receipts) {
    const currency = (receipt.currency || 'NOK').toUpperCase()
    counts.set(currency, (counts.get(currency) || 0) + 1)
  }

  let selectedCurrency = 'NOK'
  let selectedCount = -1
  counts.forEach((count, currency) => {
    if (count > selectedCount) {
      selectedCurrency = currency
      selectedCount = count
    }
  })

  return selectedCurrency
}

function formatCurrency(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString('nb-NO')} ${currency}`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('nb-NO')
}

function fileListLabel(files: File[]): string {
  if (files.length === 0) return 'No files selected'
  if (files.length === 1) return files[0].name
  return `${files.length.toLocaleString('nb-NO')} JSON files`
}

export default function ReceiptImportWizard() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<ReceiptImportPreview | null>(null)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const previewRows = useMemo(() => preview?.receipts.slice(0, 5) || [], [preview])
  const summaryCurrency = useMemo(
    () => resolveDisplayCurrency(preview?.receipts || []),
    [preview],
  )

  const readFiles = useCallback(async (selectedFiles: File[]) => {
    setErrorMsg('')
    setStatus('idle')

    if (selectedFiles.length === 0) return

    const invalidFile = selectedFiles.find(file => !file.name.toLowerCase().endsWith('.json'))
    if (invalidFile) {
      setFiles([])
      setPreview(null)
      setStatus('error')
      setErrorMsg(`Receipt imports must be JSON files. "${invalidFile.name}" is not supported.`)
      return
    }

    const receipts: ReceiptImportReceipt[] = []

    try {
      for (const file of selectedFiles) {
        const parsed = JSON.parse(await file.text())
        receipts.push(...extractReceiptsFromJson(parsed))
      }
    } catch (error) {
      setFiles(selectedFiles)
      setPreview(null)
      setStatus('error')
      setErrorMsg(error instanceof Error ? `Could not parse JSON: ${error.message}` : 'Could not parse JSON')
      return
    }

    const nextPreview = createReceiptImportPreview(receipts)
    if (nextPreview.receiptCount === 0) {
      setFiles(selectedFiles)
      setPreview(null)
      setStatus('error')
      setErrorMsg('No Trumf receipts were found. Upload all_receipts_trumf.json or receipt_*.json files.')
      return
    }

    setFiles(selectedFiles)
    setPreview(nextPreview)
    setStatus('ready')
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    void readFiles(Array.from(event.dataTransfer.files))
  }, [readFiles])

  const handleImport = async () => {
    if (!preview || status === 'importing') return
    setStatus('importing')
    setErrorMsg('')

    try {
      const response = await fetch('/api/receipts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipts: preview.receipts }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Receipt import failed')
      }

      setStatus('done')
      router.push('/dashboard/receipts')
      router.refresh()
    } catch (error) {
      setStatus('error')
      setErrorMsg(error instanceof Error ? error.message : 'Receipt import failed')
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

  return (
    <div style={{ display: 'grid', gap: '32px' }}>
      <div
        onDrop={handleDrop}
        onDragOver={event => { event.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => document.getElementById('receipt-json-input')?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--prancing-horse)' : 'var(--grid-line)'}`,
          padding: '56px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <div style={{ ...panelTitle, marginBottom: '12px' }}>Drop Trumf receipt JSON</div>
        <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '18px' }}>
          {fileListLabel(files)}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
          Accepts all_receipts_trumf.json or multiple receipt_*.json files
        </div>
      </div>

      <input
        id="receipt-json-input"
        type="file"
        accept=".json,application/json"
        multiple
        style={{ display: 'none' }}
        onChange={event => void readFiles(Array.from(event.target.files || []))}
      />

      {errorMsg && (
        <div style={{ border: '1px solid var(--prancing-horse)', padding: '14px', color: 'var(--carbon)', fontSize: '12px' }}>
          {errorMsg}
        </div>
      )}

      {preview && (
        <div style={{ display: 'grid', gap: '28px' }}>
          <section>
            <div style={{ ...panelTitle, marginBottom: '14px' }}>Import Preview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '12px' }}>
              {[
                ['RECEIPTS', preview.receiptCount.toLocaleString('nb-NO')],
                ['DATE RANGE', `${formatDate(preview.dateFrom)} – ${formatDate(preview.dateTo)}`],
                ['CHAINS', preview.chains.join(', ') || '—'],
                ['SPEND', formatCurrency(preview.totalSpend, summaryCurrency)],
                ['LINE ITEMS', preview.totalItems.toLocaleString('nb-NO')],
              ].map(([label, value]) => (
                <div key={label} style={metricBox}>
                  <div style={{ ...panelTitle, fontSize: '7px', marginBottom: '10px' }}>{label}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px', color: 'var(--carbon)', lineHeight: 1.45 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
            {preview.duplicateCount > 0 && (
              <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '12px' }}>
                {preview.duplicateCount.toLocaleString('nb-NO')} duplicate receipts in the selected files will be skipped before import.
              </div>
            )}
          </section>

          <section>
            <div style={{ ...panelTitle, marginBottom: '14px' }}>Sample Receipts</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    {['DATE', 'STORE', 'CHAIN', 'ITEMS', 'TOTAL'].map(header => (
                      <th key={header} style={{ padding: '9px', textAlign: 'left', borderBottom: '1px solid var(--grid-line)', ...panelTitle, fontSize: '7px' }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(receipt => (
                    <tr key={receipt.receiptId || receipt.batchId}>
                      <td style={{ padding: '9px', borderBottom: '1px solid var(--grid-line)' }}>{formatDate(receipt.date)}</td>
                      <td style={{ padding: '9px', borderBottom: '1px solid var(--grid-line)' }}>{receipt.store}</td>
                      <td style={{ padding: '9px', borderBottom: '1px solid var(--grid-line)' }}>{receipt.chain}</td>
                      <td style={{ padding: '9px', borderBottom: '1px solid var(--grid-line)' }}>{receipt.items.length.toLocaleString('nb-NO')}</td>
                      <td style={{ padding: '9px', borderBottom: '1px solid var(--grid-line)' }}>
                        {formatCurrency(receipt.totalAmount, (receipt.currency || 'NOK').toUpperCase())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleImport}
              disabled={status === 'importing'}
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '9px',
                letterSpacing: '0.2em',
                padding: '11px 26px',
                background: 'var(--prancing-horse)',
                color: 'white',
                border: 'none',
                cursor: status === 'importing' ? 'wait' : 'pointer',
              }}
            >
              {status === 'importing' ? 'IMPORTING...' : 'IMPORT RECEIPTS'}
            </button>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Existing receipts are deduplicated by receipt ID.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
