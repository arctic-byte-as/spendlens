import {
  getItemPriceTrends,
  getMonthlyDietCategoryTrend,
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

describe('getMonthlyDietCategoryTrend', () => {
  const dietReceipts: ReceiptAnalysisRow[] = [
    { receipt_id: 'd1', date: '2026-01-05T10:00:00.000Z', chain: 'KIWI', total_amount: 100, currency: 'NOK' },
    { receipt_id: 'd2', date: '2026-02-05T10:00:00.000Z', chain: 'KIWI', total_amount: 100, currency: 'NOK' },
    { receipt_id: 'd3', date: '2026-03-05T10:00:00.000Z', chain: 'KIWI', total_amount: 100, currency: 'NOK' },
  ]

  const dietItems: ReceiptItemAnalysisRow[] = [
    { receipt_id: 'd1', name: 'SMÅGODT', quantity: 1, unit: 'EA', total_price: 30, bonus_percent: 0, vat_percent: 15, savings_amount: 0, diet_category: 'Candy & Sweets' },
    { receipt_id: 'd1', name: 'LAKS', quantity: 1, unit: 'EA', total_price: 70, bonus_percent: 0, vat_percent: 15, savings_amount: 0, diet_category: 'Fish & Seafood' },
    { receipt_id: 'd2', name: 'SMÅGODT', quantity: 1, unit: 'EA', total_price: 20, bonus_percent: 0, vat_percent: 15, savings_amount: 0, diet_category: 'Candy & Sweets' },
    { receipt_id: 'd2', name: 'LAKS', quantity: 1, unit: 'EA', total_price: 80, bonus_percent: 0, vat_percent: 15, savings_amount: 0, diet_category: 'Fish & Seafood' },
    { receipt_id: 'd3', name: 'SMÅGODT', quantity: 1, unit: 'EA', total_price: 50, bonus_percent: 0, vat_percent: 15, savings_amount: 0, diet_category: 'Candy & Sweets' },
    { receipt_id: 'd3', name: 'LAKS', quantity: 1, unit: 'EA', total_price: 50, bonus_percent: 0, vat_percent: 15, savings_amount: 0, diet_category: 'Fish & Seafood' },
  ]

  it('computes % of monthly spend per category, matching a manual aggregation', () => {
    const rows = getMonthlyDietCategoryTrend(dietReceipts, dietItems)

    const candy = rows.filter(row => row.category === 'Candy & Sweets')
    const fish = rows.filter(row => row.category === 'Fish & Seafood')

    expect(candy).toEqual([
      { month: '2026-01', category: 'Candy & Sweets', spend: 30, shareOfTotal: 0.3, shareDeltaVsPreviousMonth: null },
      { month: '2026-02', category: 'Candy & Sweets', spend: 20, shareOfTotal: 0.2, shareDeltaVsPreviousMonth: expect.closeTo(-0.1) },
      { month: '2026-03', category: 'Candy & Sweets', spend: 50, shareOfTotal: 0.5, shareDeltaVsPreviousMonth: expect.closeTo(0.3) },
    ])

    expect(fish).toEqual([
      { month: '2026-01', category: 'Fish & Seafood', spend: 70, shareOfTotal: 0.7, shareDeltaVsPreviousMonth: null },
      { month: '2026-02', category: 'Fish & Seafood', spend: 80, shareOfTotal: 0.8, shareDeltaVsPreviousMonth: expect.closeTo(0.1) },
      { month: '2026-03', category: 'Fish & Seafood', spend: 50, shareOfTotal: 0.5, shareDeltaVsPreviousMonth: expect.closeTo(-0.3) },
    ])
  })

  it('treats a missing/unrecognised diet_category as Other rather than throwing', () => {
    const rows = getMonthlyDietCategoryTrend(
      [{ receipt_id: 'x1', date: '2026-01-05T10:00:00.000Z', chain: 'KIWI', total_amount: 10, currency: 'NOK' }],
      [{ receipt_id: 'x1', name: 'MYSTERY ITEM', quantity: 1, unit: 'EA', total_price: 10, bonus_percent: 0, vat_percent: 15, savings_amount: 0, diet_category: null }],
    )

    expect(rows).toEqual([
      { month: '2026-01', category: 'Other', spend: 10, shareOfTotal: 1, shareDeltaVsPreviousMonth: null },
    ])
  })
})
