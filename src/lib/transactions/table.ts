import { Category } from './categories'

export type DatePeriod = 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'LAST_QUARTER' | 'YTD' | 'LAST_12M'

export const DATE_PERIODS: { value: DatePeriod; label: string }[] = [
  { value: 'ALL',           label: 'ALL TIME' },
  { value: 'THIS_MONTH',    label: 'THIS MONTH' },
  { value: 'LAST_MONTH',    label: 'LAST MONTH' },
  { value: 'THIS_QUARTER',  label: 'THIS QUARTER' },
  { value: 'LAST_QUARTER',  label: 'LAST QUARTER' },
  { value: 'YTD',           label: 'YEAR TO DATE' },
  { value: 'LAST_12M',      label: 'LAST 12 MONTHS' },
]

export function getPeriodBounds(period: DatePeriod): { from: Date; to: Date } | null {
  if (period === 'ALL') return null

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-based

  switch (period) {
    case 'THIS_MONTH':
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) }
    case 'LAST_MONTH':
      return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) }
    case 'THIS_QUARTER': {
      const qStart = Math.floor(m / 3) * 3
      return { from: new Date(y, qStart, 1), to: new Date(y, qStart + 3, 0) }
    }
    case 'LAST_QUARTER': {
      const qStart = Math.floor(m / 3) * 3 - 3
      return { from: new Date(y, qStart, 1), to: new Date(y, qStart + 3, 0) }
    }
    case 'YTD':
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) }
    case 'LAST_12M': {
      const from = new Date(now)
      from.setFullYear(from.getFullYear() - 1)
      return { from, to: now }
    }
  }
}

export type TransactionListItem = {
  id: string
  date: string
  merchant: string | null
  description: string | null
  category: string | null
  amount: number
  currency: string
  is_recurring: boolean | null
  category_source?: string | null
}

export function formatSignedAmount(amount: number, currency: string, locale = 'nb-NO') {
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : ''
  return `${sign}${Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

export function filterTransactions(
  rows: TransactionListItem[],
  search: string,
  category: 'ALL' | 'UNCATEGORISED' | Category,
  recurringOnly: boolean,
  period: DatePeriod = 'ALL'
) {
  const searchLower = search.trim().toLowerCase()
  const bounds = getPeriodBounds(period)

  return rows.filter((row) => {
    if (recurringOnly && !row.is_recurring) return false
    if (category === 'UNCATEGORISED' && row.category) return false
    if (category !== 'ALL' && category !== 'UNCATEGORISED' && row.category !== category) return false

    if (bounds) {
      const txDate = new Date(row.date)
      if (txDate < bounds.from || txDate > bounds.to) return false
    }

    if (!searchLower) return true

    const haystack = `${row.merchant || ''} ${row.description || ''}`.toLowerCase()
    return haystack.includes(searchLower)
  })
}
