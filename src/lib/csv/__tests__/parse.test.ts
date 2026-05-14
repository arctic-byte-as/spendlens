import { detectBankFormat, parseNorwegianAmount, sanitiseDescription, getHeaders, parseTransactions, getColumnMapping } from '../parse'

describe('detectBankFormat', () => {
  it('detects DNB', () => {
    expect(detectBankFormat(['Dato', 'Forklaring', 'Rentedato', 'Ut fra konto', 'Inn på konto'])).toBe('DNB')
  })
  it('detects Nordea', () => {
    expect(detectBankFormat(['Dato', 'Betalingstype', 'Tekst', 'Beløp', 'Saldo'])).toBe('NORDEA')
  })
  it('detects Sparebank1', () => {
    expect(detectBankFormat(['Dato', 'Beskrivelse', 'Rentedato', 'Beløp', 'Saldo'])).toBe('SPAREBANK1')
  })
  it('detects Generic EN', () => {
    expect(detectBankFormat(['Date', 'Description', 'Amount'])).toBe('GENERIC_EN')
  })
  it('detects Generic NO', () => {
    expect(detectBankFormat(['Dato', 'Beskrivelse', 'Beløp'])).toBe('GENERIC_NO')
  })
  it('detects Generic NO with unaccented amount header', () => {
    expect(detectBankFormat(['Dato', 'Beskrivelse', 'Belop'])).toBe('GENERIC_NO')
  })
  it('detects Nordea with booking date variant', () => {
    expect(detectBankFormat(['Bokføringsdato', 'Betalingstype', 'Avsender', 'Belop'])).toBe('NORDEA')
  })
  it('returns UNKNOWN for unrecognised headers', () => {
    expect(detectBankFormat(['Col1', 'Col2'])).toBe('UNKNOWN')
  })
})

describe('parseNorwegianAmount', () => {
  it('parses Norwegian format with period thousands', () => {
    expect(parseNorwegianAmount('1.234,56')).toBe(1234.56)
  })
  it('parses negative', () => {
    expect(parseNorwegianAmount('-500,00')).toBe(-500)
  })
  it('parses plain number', () => {
    expect(parseNorwegianAmount('1234.56')).toBe(1234.56)
  })
  it('returns 0 for empty', () => {
    expect(parseNorwegianAmount('')).toBe(0)
  })
})

describe('sanitiseDescription', () => {
  it('strips Norwegian account numbers', () => {
    expect(sanitiseDescription('Payment from 12345678901 ref123')).not.toContain('12345678901')
  })
  it('strips IBANs', () => {
    expect(sanitiseDescription('Transfer NO9386011117947')).not.toContain('NO9386011117947')
  })
  it('leaves normal text intact', () => {
    expect(sanitiseDescription('Coffee at Starbucks')).toBe('Coffee at Starbucks')
  })
})

describe('parseTransactions', () => {
  it('parses a generic EN CSV', () => {
    const csv = 'Date,Description,Amount\n2024-01-15,Coffee,-45.00\n2024-01-16,Salary,50000.00'
    const mapping = getColumnMapping('GENERIC_EN')
    const txs = parseTransactions(csv, mapping)
    expect(txs).toHaveLength(2)
    expect(txs[0].amount).toBe(-45)
    expect(txs[1].amount).toBe(50000)
  })

  it('parses semicolon CSV with Norwegian header variants', () => {
    const csv = 'Dato;Beskrivelse;Belop\n15.01.2024;Kaffe;-45,00\n16.01.2024;Lonn;50000,00'
    const headers = getHeaders(csv)
    const mapping = getColumnMapping(detectBankFormat(headers), headers)
    const txs = parseTransactions(csv, mapping)
    expect(txs).toHaveLength(2)
    expect(txs[0].date).toBe('2024-01-15')
    expect(txs[0].amount).toBe(-45)
    expect(txs[1].amount).toBe(50000)
  })
})
