import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function UploadsPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: uploads } = await supabase
    .from('uploads')
    .select('*')
    .eq('user_id', user!.id)
    .order('uploaded_at', { ascending: false })

  const panelTitle: React.CSSProperties = {
    fontFamily: 'Orbitron, sans-serif',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.3em',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    marginBottom: '28px',
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={panelTitle}>Import History</div>
        <Link
          href="/upload"
          style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', padding: '8px 20px', background: 'var(--prancing-horse)', color: 'white', textDecoration: 'none' }}
        >
          + IMPORT CSV
        </Link>
      </div>

      {!uploads || uploads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', border: '1px solid var(--grid-line)' }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '10px', letterSpacing: '0.2em', color: 'var(--muted)', marginBottom: '16px' }}>
            NO IMPORTS YET
          </div>
          <Link href="/upload" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.2em', color: 'var(--prancing-horse)', textDecoration: 'none' }}>
            UPLOAD YOUR FIRST CSV →
          </Link>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['DATE', 'FILENAME', 'ROWS', 'STATUS'].map(h => (
                <th key={h} style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '8px', letterSpacing: '0.15em', color: 'var(--muted)', padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--grid-line)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uploads.map(upload => (
              <tr key={upload.id}>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--grid-line)', color: 'var(--muted)', fontSize: '11px' }}>
                  {new Date(upload.uploaded_at).toLocaleDateString('nb-NO')}
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--grid-line)' }}>
                  {upload.filename}
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--grid-line)', fontFamily: 'DM Mono, monospace', textAlign: 'right' }}>
                  {upload.row_count ?? '—'}
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--grid-line)' }}>
                  <span style={{
                    fontFamily: 'Orbitron, sans-serif',
                    fontSize: '8px',
                    letterSpacing: '0.1em',
                    padding: '3px 8px',
                    background: upload.status === 'done' ? 'var(--positive)' : upload.status === 'error' ? 'var(--prancing-horse)' : 'var(--alcantara)',
                    color: 'white',
                  }}>
                    {upload.status?.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
