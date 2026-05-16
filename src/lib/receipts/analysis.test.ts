import {
  getItemPriceTrends,
  getMonthlyHealthRatio,
  getMonthlySavingsRate,
  getMonthlyVatSplit,
  getTopPurchasedItems,
  type ReceiptAnalysisRow,
  type ReceiptItemAnalysisRow,
} from './analysis'

const receipts: ReceiptAnalysisRow[] = [
  {
    receipt_id: 'r1',
    date: '2026-01-10T10:00:00.000Z',
    chain: 'MENY',
    total_amount: 100,
    currency: 'NOK',
  },
  {
    receipt_id: 'r2',
    date: '2026-01-20T10:00:00.000Z',
    chain: 'KIWI',
    total_amount: 120,
    currency: 'NOK',
  },
  {
    receipt_id: 'r3',
    date: '2026-02-10T10:00:00.000Z',
    chain: 'MENY',
    total_amount: 150,
    currency: 'NOK',
  },
]

const items: ReceiptItemAnalysisRow[] = [
  {
    receipt_id: 'r1',
    name: 'APPLE',
    quantity: 2,
    unit: 'EA',
    total_price: 20,
    bonus_percent: 20,
    vat_percent: 15,
    savings_amount: 2,
  },
  {
    receipt_id: 'r1',
    name: 'SOAP',
    quantity: 1,
    unit: 'EA',
    total_price: 80,
    bonus_percent: 5,
    vat_percent: 25,
    savings_amount: 0,
  },
  {
    receipt_id: 'r2',
    name: 'APPLE',
    quantity: 2,
    unit: 'EA',
    total_price: 30,
    bonus_percent: 16,
    vat_percent: 15,
    savings_amount: 1,
  },
  {
    receipt_id: 'r3',
    name: 'APPLE',
    quantity: 2,
    unit: 'EA',
    total_price: 40,
    bonus_percent: 18,
    vat_percent: 15,
    savings_amount: 2,
  },
]

describe('receipt analysis aggregations', () => {
  it('calculates monthly health ratio equivalent to SQL ratio', () => {
    const rows = getMonthlyHealthRatio(receipts, items)

    expect(rows).toEqual([
      {
        month: '2026-01',
        healthySpend: 50,
        totalSpend: 130,
        ratio: 50 / 130,
      },
      {
        month: '2026-02',
        healthySpend: 40,
        totalSpend: 40,
        ratio: 1,
      },
    ])
  })

  it('calculates monthly VAT split and campaign savings rate', () => {
    expect(getMonthlyVatSplit(receipts, items)).toEqual([
      {
        month: '2026-01',
        foodSpend: 50,
        nonFoodSpend: 80,
      },
      {
        month: '2026-02',
        foodSpend: 40,
        nonFoodSpend: 0,
      },
    ])

    expect(getMonthlySavingsRate(receipts, items)).toEqual([
      {
        month: '2026-01',
        savings: 3,
        grossSpend: 130,
        rate: 3 / 133,
      },
      {
        month: '2026-02',
        savings: 2,
        grossSpend: 40,
        rate: 2 / 42,
      },
    ])
  })

  it('tracks item price increases and top purchased items', () => {
    const trends = getItemPriceTrends(receipts, items)
    expect(trends).toHaveLength(1)
    expect(trends[0].itemName).toBe('APPLE')
    expect(trends[0].monthly.map(row => row.avgUnitPrice)).toEqual([12.5, 20])
    expect(trends[0].monthly[1].increaseVsPreviousPct).toBeCloseTo(0.6)
    expect(trends[0].monthly[1].increasedOverTenPercent).toBe(true)

    expect(getTopPurchasedItems(items)).toEqual([
      {
        name: 'APPLE',
        totalQty: 6,
        totalSpend: 90,
        receiptCount: 3,
      },
      {
        name: 'SOAP',
        totalQty: 1,
        totalSpend: 80,
        receiptCount: 1,
      },
    ])
  })
})
