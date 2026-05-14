import UploadWizard from '@/components/UploadWizard'

export default function UploadPage() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.3em', color: 'var(--muted)', marginBottom: '32px', textTransform: 'uppercase' }}>
        Import CSV
      </div>
      <UploadWizard />
    </div>
  )
}
