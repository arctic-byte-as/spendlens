import { createReceiptImportPreview, extractReceiptsFromJson } from './importPreview'

const receipt = {
  receiptId: 'r-1',
  date: '2026-05-13T17:45:58.000Z',
  store: 'KIWI Flaskebekk',
  chain: 'KIWI',
  totalAmount: 1759.32,
  totalBonus: 59.93,
  items: [
    {
      id: 'line-1',
      name: 'BANANER BAMA',
      quantity: 0.782,
      unit: 'KG',
      totalPrice: 21.04,
      bonus: 3.16,
      bonusPercent: 15,
      vatPercent: 15,
      isUnknownProduct: false,
      savings: [],
    },
  ],
}

describe('receipt import preview helpers', () => {
  it('extracts receipts from the combined Trumf export shape', () => {
    expect(extractReceiptsFromJson({ generatedAt: 'now', receipts: [receipt] })).toEqual([receipt])
  })

  it('extracts one individual receipt file', () => {
    expect(extractReceiptsFromJson(receipt)).toEqual([receipt])
  })

  it('returns no receipts for unsupported JSON such as CSV-shaped data', () => {
    expect(extractReceiptsFromJson({ rows: [{ Date: '2026-05-13', Amount: '10' }] })).toEqual([])
  })

  it('deduplicates selected files and calculates preview metrics', () => {
    const preview = createReceiptImportPreview([
      receipt,
      receipt,
      {
        ...receipt,
        receiptId: 'r-2',
        date: '2026-05-14T08:00:00.000Z',
        chain: 'MENY',
        totalAmount: 100,
        items: [receipt.items[0], { ...receipt.items[0], id: 'line-2' }],
      },
    ])

    expect(preview.receiptCount).toBe(2)
    expect(preview.duplicateCount).toBe(1)
    expect(preview.chains).toEqual(['KIWI', 'MENY'])
    expect(preview.totalSpend).toBe(1859.32)
    expect(preview.totalItems).toBe(3)
    expect(preview.dateFrom).toBe('2026-05-13T17:45:58.000Z')
    expect(preview.dateTo).toBe('2026-05-14T08:00:00.000Z')
  })
})
