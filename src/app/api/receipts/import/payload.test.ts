import { parseReceiptsImportPayload } from './payload'

describe('parseReceiptsImportPayload', () => {
  it('parses a valid payload and truncates long item names', () => {
    const payload = {
      receipts: [
        {
          batchId: 'abc-123',
          date: '2026-05-01T12:00:00.000Z',
          store: 'Meny Storo',
          chain: 'MENY',
          totalAmount: 199.5,
          totalBonus: 8,
          savingsSummary: { campaignSavings: 3 },
          items: [
            {
              id: 'line-1',
              name: 'A'.repeat(700),
              quantity: 2,
              unit: 'EA',
              totalPrice: 49.5,
              bonus: 2,
              bonusPercent: 4,
              vatPercent: 15,
              savings: [{ amount: 1.5 }, { amount: 0.5 }],
            },
          ],
        },
      ],
    }

    const parsed = parseReceiptsImportPayload(payload)

    expect(parsed.receipts).toHaveLength(1)
    expect(parsed.totalItems).toBe(1)
    expect(parsed.receipts[0].receiptId).toBe('abc-123')
    expect(parsed.receipts[0].items[0].name).toHaveLength(500)
    expect(parsed.receipts[0].items[0].savingsAmount).toBe(2)
    expect(parsed.receipts[0].currency).toBe('NOK')
  })

  it('requires a non-empty receipts array', () => {
    expect(() => parseReceiptsImportPayload({ receipts: [] })).toThrow('Body must include a non-empty receipts array')
  })

  it('requires receiptId or batchId on each receipt', () => {
    expect(() => parseReceiptsImportPayload({
      receipts: [{
        date: '2026-05-01T12:00:00.000Z',
        store: 'Meny',
        chain: 'MENY',
        totalAmount: 10,
        items: [{ id: '1', name: 'Apple', quantity: 1, totalPrice: 10 }],
      }],
    })).toThrow('Each receipt must include receiptId or batchId')
  })

  it('rejects invalid numeric fields', () => {
    expect(() => parseReceiptsImportPayload({
      receipts: [{
        receiptId: 'abc',
        date: '2026-05-01T12:00:00.000Z',
        store: 'Meny',
        chain: 'MENY',
        totalAmount: '19',
        items: [{ id: '1', name: 'Apple', quantity: 1, totalPrice: 10 }],
      }],
    })).toThrow('Invalid receipt totalAmount')
  })
})
