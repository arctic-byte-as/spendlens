import Papa from 'papaparse'

export type BankFormat = 'DNB' | 'NORDEA' | 'SBANKEN' | 'SPAREBANK1' | 'GENERIC_EN' | 'GENERIC_NO' | 'UNKNOWN'

export interface ParsedTransaction {
  date: string        // ISO format YYYY-MM-DD
  description: string
  amount: number      // negative = debit, positive = credit
  currency: string    // default 'NOK'
}

export interface ColumnMapping {
  date: string
  description: string
  // For banks with a single amount column:
  amount?: string
  // For DNB which has separate debit/credit columns:
  amountOut?: string  // "Ut fra konto" (debit, already negative or positive)
  amountIn?: string   // "Inn på konto" (credit)
  currency?: string
}

const HEADER_ALIASES = {
  date: ['Date', 'Dato', 'Bokføringsdato', 'Bokforingsdato'],
  description: ['Description', 'Beskrivelse', 'Forklaring', 'Tekst', 'Avsender'],
  amount: ['Amount', 'Beløp', 'Belop', 'Beløb'],
  amountOut: ['Ut fra konto', 'Ut Fra Konto'],
  amountIn: ['Inn på konto', 'Inn pa konto'],
  balance: ['Saldo'],
  paymentType: ['Betalingstype'],
  toAccount: ['Til konto'],
  fromAccount: ['Fra konto'],
} as const

export function normaliseHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim()
}

function hasHeader(headers: string[], aliases: readonly string[]): boolean {
  return aliases.some(alias => headers.includes(alias))
}

function pickHeader(headers: string[], aliases: readonly string[], fallback: string): string {
  return aliases.find(alias => headers.includes(alias)) || fallback
}

export function detectBankFormat(headers: string[]): BankFormat {
  const h = headers.map(normaliseHeader)

  if (h.includes('Dato') && (h.includes('Forklaring') || h.includes('Tekst')) && hasHeader(h, HEADER_ALIASES.amountOut)) {
    return 'DNB'
  }
  if (hasHeader(h, HEADER_ALIASES.date) && hasHeader(h, HEADER_ALIASES.paymentType) && hasHeader(h, HEADER_ALIASES.description) && hasHeader(h, HEADER_ALIASES.amount)) {
    return 'NORDEA'
  }
  // Sbanken has Dato + (Til konto or Fra konto) + Beløp
  if (h.includes('Dato') && (hasHeader(h, HEADER_ALIASES.toAccount) || hasHeader(h, HEADER_ALIASES.fromAccount))) {
    return 'SBANKEN'
  }
  // Sparebank1: Dato + Beskrivelse + Beløp + Saldo (but not Sbanken)
  if (h.includes('Dato') && h.includes('Beskrivelse') && hasHeader(h, HEADER_ALIASES.amount) && hasHeader(h, HEADER_ALIASES.balance)) {
    return 'SPAREBANK1'
  }
  if (h.includes('Date') && h.includes('Description') && hasHeader(h, HEADER_ALIASES.amount)) {
    return 'GENERIC_EN'
  }
  // Generic NO: Dato + Beskrivelse + Beløp (no Saldo)
  if (h.includes('Dato') && h.includes('Beskrivelse') && hasHeader(h, HEADER_ALIASES.amount)) {
    return 'GENERIC_NO'
  }
  return 'UNKNOWN'
}

export function getColumnMapping(format: BankFormat, headers: string[] = []): ColumnMapping {
  const h = headers.map(normaliseHeader)
  switch (format) {
    case 'DNB':
      return {
        date: pickHeader(h, HEADER_ALIASES.date, 'Dato'),
        description: pickHeader(h, ['Forklaring', 'Tekst', 'Description'], 'Forklaring'),
        amountOut: pickHeader(h, HEADER_ALIASES.amountOut, 'Ut fra konto'),
        amountIn: pickHeader(h, HEADER_ALIASES.amountIn, 'Inn på konto'),
      }
    case 'NORDEA':
      return {
        date: pickHeader(h, HEADER_ALIASES.date, 'Dato'),
        description: pickHeader(h, ['Tekst', 'Avsender', 'Description'], 'Tekst'),
        amount: pickHeader(h, HEADER_ALIASES.amount, 'Beløp'),
      }
    case 'SBANKEN':
      return {
        date: pickHeader(h, HEADER_ALIASES.date, 'Dato'),
        description: pickHeader(h, ['Tekst', 'Beskrivelse', 'Description'], 'Tekst'),
        amount: pickHeader(h, HEADER_ALIASES.amount, 'Beløp'),
      }
    case 'SPAREBANK1':
      return {
        date: pickHeader(h, HEADER_ALIASES.date, 'Dato'),
        description: pickHeader(h, ['Beskrivelse', 'Forklaring', 'Description'], 'Beskrivelse'),
        amount: pickHeader(h, HEADER_ALIASES.amount, 'Beløp'),
      }
    case 'GENERIC_EN':
      return {
        date: pickHeader(h, HEADER_ALIASES.date, 'Date'),
        description: pickHeader(h, ['Description', 'Beskrivelse', 'Tekst', 'Forklaring'], 'Description'),
        amount: pickHeader(h, HEADER_ALIASES.amount, 'Amount'),
      }
    case 'GENERIC_NO':
      return {
        date: pickHeader(h, HEADER_ALIASES.date, 'Dato'),
        description: pickHeader(h, ['Beskrivelse', 'Tekst', 'Forklaring', 'Description'], 'Beskrivelse'),
        amount: pickHeader(h, HEADER_ALIASES.amount, 'Beløp'),
      }
    case 'UNKNOWN':
    default:
      return {
        date: pickHeader(h, HEADER_ALIASES.date, 'Date'),
        description: pickHeader(h, HEADER_ALIASES.description, 'Description'),
        amount: pickHeader(h, HEADER_ALIASES.amount, 'Amount'),
      }
  }
}

export function parseNorwegianAmount(value: string): number {
  if (!value || !value.trim()) return 0
  let v = value.trim()
  // Remove spaces (thousands separator in some formats)
  v = v.replace(/\s/g, '')
  // Norwegian format: 1.234,56 — period is thousands, comma is decimal
  // Only replace periods that are thousands separators (followed by digits and a comma or end)
  // Strategy: if both period and comma are present, period is thousands separator
  if (v.includes('.') && v.includes(',')) {
    v = v.replace(/\./g, '')   // remove thousand separators
    v = v.replace(',', '.')    // decimal comma → period
  } else if (v.includes(',')) {
    // Only comma: treat as decimal separator
    v = v.replace(',', '.')
  }
  // Otherwise it's already a standard number (period as decimal or integer)
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

export function sanitiseDescription(desc: string): string {
  // Remove IBANs (e.g. NO9386011117947, GB29NWBK60161331926819)
  let clean = desc.replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/g, '')
  // Remove Norwegian 11-digit account numbers
  clean = clean.replace(/\b\d{11}\b/g, '')
  return clean.trim()
}

function normaliseDate(raw: string): string {
  const s = raw.trim()
  // DD.MM.YYYY
  const ddmmyyyy = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
  // DD/MM/YYYY
  const ddmmyyyySlash = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ddmmyyyySlash) return `${ddmmyyyySlash[3]}-${ddmmyyyySlash[2]}-${ddmmyyyySlash[1]}`
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return s
}

export function parseTransactions(csvText: string, mapping: ColumnMapping): ParsedTransaction[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normaliseHeader,
  })

  const transactions: ParsedTransaction[] = []

  for (const row of result.data) {
    // Skip rows where the date column is empty
    const rawDate = row[mapping.date]
    if (!rawDate || !rawDate.trim()) continue

    const date = normaliseDate(rawDate)

    const rawDesc = row[mapping.description] || ''
    const description = sanitiseDescription(rawDesc)

    let amount = 0
    if (mapping.amountOut !== undefined && mapping.amountIn !== undefined) {
      // DNB: separate debit/credit columns
      const outVal = row[mapping.amountOut] || ''
      const inVal = row[mapping.amountIn] || ''
      if (outVal.trim()) {
        amount = parseNorwegianAmount(outVal)
      } else if (inVal.trim()) {
        // Inn på konto is always a credit — ensure positive
        amount = Math.abs(parseNorwegianAmount(inVal))
      }
    } else if (mapping.amount) {
      amount = parseNorwegianAmount(row[mapping.amount] || '')
    }

    const currency = (mapping.currency && row[mapping.currency]) ? row[mapping.currency].trim() : 'NOK'

    transactions.push({ date, description, amount, currency })
  }

  return transactions
}

export function getHeaders(csvText: string): string[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    preview: 1,
    transformHeader: normaliseHeader,
  })
  return result.meta.fields || []
}
