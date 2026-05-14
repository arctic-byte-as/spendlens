import { Category } from './categories'

export type TransactionListItem = {
  id: string
  date: string
  merchant: string | null
  description: string | null
  category: string | null
  amount: number
  currency: string
  is_recurring: boolean | null
}

export function formatSignedAmount(amount: number, currency: string) {
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : ''
  const locale = currency === 'NOK' ? 'nb-NO' : 'en-US'
  return `${sign}${Math.abs(amount).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

export function filterTransactions(
  rows: TransactionListItem[],
  search: string,
  category: 'ALL' | Category,
  recurringOnly: boolean
) {
  const searchLower = search.trim().toLowerCase()

  return rows.filter((row) => {
    if (recurringOnly && !row.is_recurring) return false
    if (category !== 'ALL' && row.category !== category) return false

    if (!searchLower) return true

    const haystack = `${row.merchant || ''} ${row.description || ''}`.toLowerCase()
    return haystack.includes(searchLower)
  })
}
