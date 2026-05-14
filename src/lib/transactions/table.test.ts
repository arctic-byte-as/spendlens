import { filterTransactions, formatSignedAmount, type TransactionListItem } from './table'

const rows: TransactionListItem[] = [
  {
    id: '1',
    date: '2026-01-01',
    merchant: 'Netflix',
    description: 'Netflix Subscription',
    category: 'SUBSCRIPTIONS',
    amount: -159,
    currency: 'NOK',
    is_recurring: true,
  },
  {
    id: '2',
    date: '2026-01-02',
    merchant: 'Kiwi',
    description: 'Groceries',
    category: 'GROCERIES',
    amount: -340.5,
    currency: 'NOK',
    is_recurring: false,
  },
]

describe('filterTransactions', () => {
  it('filters by recurring flag', () => {
    expect(filterTransactions(rows, '', 'ALL', true)).toHaveLength(1)
  })

  it('filters by category and search', () => {
    const result = filterTransactions(rows, 'kiwi', 'GROCERIES', false)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })
})

describe('formatSignedAmount', () => {
  it('formats debit values with minus sign', () => {
    expect(formatSignedAmount(-340.5, 'NOK')).toMatch(/^−340,50 NOK$/)
  })

  it('formats credit values with plus sign', () => {
    const formatted = formatSignedAmount(50000, 'NOK')
    expect(formatted).toMatch(/^\+50[\s\u00A0\u202F]000,00 NOK$/)
  })
})
