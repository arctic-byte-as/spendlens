import { importReceipts } from './importReceipts'

const VALID_RECEIPT = {
  batchId: 'batch-1',
  date: '2026-05-01T12:00:00.000Z',
  store: 'Meny Storo',
  chain: 'MENY',
  totalAmount: 199.5,
  totalBonus: 8,
  savingsSummary: { campaignSavings: 3 },
  items: [
    {
      id: 'line-1',
      name: 'Lettmelk 1,75L',
      quantity: 2,
      unit: 'EA',
      totalPrice: 49.5,
      bonus: 2,
      bonusPercent: 4,
      vatPercent: 15,
      savings: [{ amount: 1.5 }],
    },
  ],
}

function createSupabaseMock(existingReceiptIds: string[] = []) {
  const upsertCalls: { table: string; rows: unknown[]; options: unknown }[] = []

  const from = jest.fn((table: string) => {
    if (table === 'receipts') {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            in: jest.fn(() =>
              Promise.resolve({
                data: existingReceiptIds.map(receipt_id => ({ receipt_id })),
                error: null,
              })
            ),
          })),
        })),
        upsert: jest.fn((rows: unknown[], options: unknown) => {
          upsertCalls.push({ table: 'receipts', rows, options })
          return Promise.resolve({ error: null })
        }),
      }
    }

    if (table === 'receipt_items') {
      return {
        upsert: jest.fn((rows: unknown[], options: unknown) => {
          upsertCalls.push({ table: 'receipt_items', rows, options })
          return Promise.resolve({ error: null })
        }),
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return { from, upsertCalls }
}

describe('importReceipts', () => {
  it('returns 400 for an invalid payload without touching supabase', async () => {
    const { from } = createSupabaseMock()

    const response = await importReceipts({ from } as never, 'user-1', { receipts: [] })

    expect(response.status).toBe(400)
    expect(from).not.toHaveBeenCalled()
  })

  it('imports new receipts and reports zero skipped', async () => {
    const { from, upsertCalls } = createSupabaseMock()

    const response = await importReceipts({ from } as never, 'user-1', { receipts: [VALID_RECEIPT] })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ imported: 1, skipped: 0, errors: [] })

    const receiptUpsert = upsertCalls.find(call => call.table === 'receipts')
    expect(receiptUpsert?.rows).toEqual([
      expect.objectContaining({ user_id: 'user-1', receipt_id: 'batch-1' }),
    ])

    const itemUpsert = upsertCalls.find(call => call.table === 'receipt_items')
    expect(itemUpsert?.rows).toEqual([
      expect.objectContaining({
        user_id: 'user-1',
        receipt_id: 'batch-1',
        item_guid: 'line-1',
        diet_category: 'Dairy - Milk',
      }),
    ])
  })

  it('skips receipts that already exist for the user (idempotent re-import)', async () => {
    const { from, upsertCalls } = createSupabaseMock(['batch-1'])

    const response = await importReceipts({ from } as never, 'user-1', { receipts: [VALID_RECEIPT] })
    const body = await response.json()

    expect(body).toEqual({ imported: 0, skipped: 1, errors: [] })
    expect(upsertCalls).toHaveLength(0)
  })

  it('returns 500 when the receipt upsert fails', async () => {
    const from = jest.fn((table: string) => {
      if (table === 'receipts') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              in: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
          upsert: jest.fn(() => Promise.resolve({ error: { message: 'boom' } })),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await importReceipts({ from } as never, 'user-1', { receipts: [VALID_RECEIPT] })

    expect(response.status).toBe(500)
  })
})
