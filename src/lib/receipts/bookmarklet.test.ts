import { buildBookmarkletHref } from './bookmarklet'

describe('buildBookmarkletHref', () => {
  it('produces a valid javascript: URI with substituted values', () => {
    const href = buildBookmarkletHref('slr_imp_abc123', 'https://spendlens.example')

    expect(href.startsWith('javascript:')).toBe(true)

    const decoded = decodeURIComponent(href.slice('javascript:'.length))
    expect(decoded).toContain("'https://spendlens.example'")
    expect(decoded).toContain("'slr_imp_abc123'")
    expect(decoded).toContain('/api/receipts/import/bookmarklet')
  })

  it('never leaves the raw placeholders in the output', () => {
    const href = buildBookmarkletHref('slr_imp_abc123', 'https://spendlens.example')
    const decoded = decodeURIComponent(href.slice('javascript:'.length))

    expect(decoded).not.toContain('__SPENDLENS_API_BASE__')
    expect(decoded).not.toContain('__IMPORT_TOKEN__')
  })

  it('throws rather than returning a broken href when the token is empty', () => {
    expect(() => buildBookmarkletHref('', 'https://spendlens.example')).toThrow(
      'buildBookmarkletHref requires a non-empty import token'
    )
  })

  it('throws rather than returning a broken href when apiBase is empty', () => {
    expect(() => buildBookmarkletHref('slr_imp_abc123', '')).toThrow(
      'buildBookmarkletHref requires a non-empty apiBase'
    )
  })
})
