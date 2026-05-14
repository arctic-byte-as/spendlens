'use client'

import { useState, useCallback, useEffect } from 'react'
import Papa from 'papaparse'
import { detectBankFormat, getColumnMapping, getHeaders } from '@/lib/csv/parse'
import type { BankFormat, ColumnMapping } from '@/lib/csv/parse'
import ColumnMapper from './ColumnMapper'
import UpgradeButton from './UpgradeButton'

type WizardStep = 'upload' | 'map' | 'confirm'

export default function UploadWizard() {
  const [step, setStep] = useState<WizardStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [detectedFormat, setDetectedFormat] = useState<BankFormat>('UNKNOWN')
  const [mapping, setMapping] = useState<ColumnMapping>({ date: '', description: '', amount: '' })
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [trialUsed, setTrialUsed] = useState(false)
  const [rowLimit, setRowLimit] = useState<number | null>(1000)
  const [loadingBilling, setLoadingBilling] = useState(true)

  useEffect(() => {
    let active = true
    const loadBillingStatus = async () => {
      try {
        const res = await fetch('/api/billing/status')
        const data = await res.json()
        if (!active || !res.ok) return
        setTrialUsed(Boolean(data.trialUsed))
        setRowLimit(typeof data.rowLimit === 'number' ? data.rowLimit : null)
      } finally {
        if (active) setLoadingBilling(false)
      }
    }
    void loadBillingStatus()
    return () => { active = false }
  }, [])

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Please upload a .csv file')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds 10 MB limit')
      return
    }
    setErrorMsg('')
    setFile(f)
    const text = await f.text()
    const hdrs = getHeaders(text)
    setHeaders(hdrs)
    const format = detectBankFormat(hdrs)
    setDetectedFormat(format)
    const colMap = getColumnMapping(format, hdrs)
    setMapping(colMap)

    // Build preview using Papa Parse (handles quoted fields with commas correctly)
    const { data: previewData } = Papa.parse<Record<string, string>>(text, {
      header: true,
      preview: 5,
      skipEmptyLines: true,
    })
    setPreview(previewData)
    const parsedForCount = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })
    setRowCount(parsedForCount.data.length)
    setStep('map')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleImport = async (allowRowTruncation = false) => {
    if (!file) return
    setUploading(true)
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Upload failed')
      }

      setUploading(false)
      setProcessing(true)

      const processRes = await fetch(`/api/process/${uploadData.uploadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping, allowRowTruncation }),
      })
      const processData = await processRes.json()

      if (!processRes.ok) {
        throw new Error(processData.error || 'Processing failed')
      }

      setProcessing(false)
      setStatus('done')
    } catch (err) {
      setUploading(false)
      setProcessing(false)
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const stepStyle = (s: WizardStep) => ({
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '8px',
    fontWeight: 700 as const,
    letterSpacing: '0.2em',
    padding: '6px 16px',
    background: step === s ? 'var(--carbon)' : 'transparent',
    color: step === s ? 'var(--luce-cream)' : 'var(--muted)',
    border: '1px solid',
    borderColor: step === s ? 'var(--carbon)' : 'var(--grid-line)',
    textTransform: 'uppercase' as const,
  })

  if (status === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'var(--positive)', marginBottom: '16px' }}>
          IMPORT COMPLETE
        </div>
        <div style={{ color: 'var(--muted)', marginBottom: '24px' }}>Your transactions have been imported and are being categorised.</div>
        <a href="/dashboard" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--luce-cream)', background: 'var(--prancing-horse)', padding: '10px 24px', textDecoration: 'none', display: 'inline-block' }}>
          VIEW DASHBOARD
        </a>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
        {(['upload', 'map', 'confirm'] as WizardStep[]).map((s, i) => (
          <span key={s} style={stepStyle(s)}>
            {i + 1}. {s === 'upload' ? 'UPLOAD' : s === 'map' ? 'MAP COLUMNS' : 'CONFIRM'}
          </span>
        ))}
      </div>

      {step === 'upload' && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            style={{
              border: `2px dashed ${dragOver ? 'var(--prancing-horse)' : 'var(--grid-line)'}`,
              padding: '60px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '10px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '12px' }}>
              DRAG &amp; DROP CSV FILE HERE
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginBottom: '20px' }}>or click to browse</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Max 10 MB · .csv only</div>
          </div>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {errorMsg && <div style={{ color: 'var(--prancing-horse)', marginTop: '12px', fontSize: '12px' }}>{errorMsg}</div>}
        </div>
      )}

      {step === 'map' && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.2em', color: 'var(--muted)' }}>
              DETECTED FORMAT:
            </span>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.2em', color: 'var(--bronze)', marginLeft: '8px' }}>
              {detectedFormat}
            </span>
          </div>
          <ColumnMapper
            headers={headers}
            mapping={mapping}
            onMappingChange={setMapping}
          />
          {/* Preview table */}
          <div style={{ marginTop: '32px', marginBottom: '24px', overflowX: 'auto' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '12px' }}>
              PREVIEW (FIRST 5 ROWS)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {headers.map(h => (
                    <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--grid-line)', fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map(h => (
                      <td key={h} style={{ padding: '8px', borderBottom: '1px solid var(--grid-line)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => setStep('confirm')}
            style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', padding: '10px 24px', background: 'var(--carbon)', color: 'var(--luce-cream)', border: 'none', cursor: 'pointer' }}
          >
            NEXT →
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '8px' }}>READY TO IMPORT</div>
            <div style={{ color: 'var(--carbon)' }}>File: <strong>{file?.name}</strong></div>
            <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>Format: {detectedFormat}</div>
            {rowCount > 0 && (
              <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>
                Rows detected: {rowCount.toLocaleString('nb-NO')}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '12px' }}>PREVIEW (FIRST 5 ROWS)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {headers.map(h => (
                    <th key={h} style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--grid-line)', fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.1em', color: 'var(--muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {headers.map(h => (
                      <td key={h} style={{ padding: '8px', borderBottom: '1px solid var(--grid-line)' }}>{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loadingBilling && trialUsed && (
            <div style={{ border: '1px solid var(--prancing-horse)', padding: '12px', marginBottom: '12px' }}>
              <div style={{ color: 'var(--carbon)', fontSize: '12px', marginBottom: '10px' }}>
                You&apos;ve used your free trial. Upgrade to Pro for unlimited uploads + savings insights.
              </div>
              <UpgradeButton />
            </div>
          )}
          {!loadingBilling && !trialUsed && rowLimit && rowCount > rowLimit && (
            <div style={{ border: '1px solid var(--prancing-horse)', padding: '12px', marginBottom: '12px' }}>
              <div style={{ color: 'var(--carbon)', fontSize: '12px', marginBottom: '10px' }}>
                Your free trial supports up to {rowLimit.toLocaleString('nb-NO')} transactions. This file has {rowCount.toLocaleString('nb-NO')} rows.
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleImport(true)}
                  disabled={uploading || processing}
                  style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.2em', padding: '8px 14px', background: 'var(--carbon)', color: 'var(--luce-cream)', border: 'none', cursor: uploading || processing ? 'wait' : 'pointer' }}
                >
                  IMPORT FIRST {rowLimit.toLocaleString('nb-NO')}
                </button>
                <UpgradeButton />
              </div>
            </div>
          )}
          {errorMsg && <div style={{ color: 'var(--prancing-horse)', marginBottom: '12px', fontSize: '12px' }}>{errorMsg}</div>}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setStep('map')}
              style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', padding: '10px 20px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--grid-line)', cursor: 'pointer' }}
            >
              ← BACK
            </button>
            <button
              onClick={() => handleImport(false)}
              disabled={uploading || processing || (!loadingBilling && trialUsed)}
              style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', padding: '10px 28px', background: 'var(--prancing-horse)', color: 'white', border: 'none', cursor: uploading || processing ? 'wait' : 'pointer' }}
            >
              {uploading ? 'UPLOADING...' : processing ? 'PROCESSING...' : 'IMPORT'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
