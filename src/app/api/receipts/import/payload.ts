const MAX_ITEM_NAME_LENGTH = 500
const MAX_RECEIPTS_PER_REQUEST = 500
const MAX_ITEMS_PER_REQUEST = 10000

type RawReceiptItem = {
  id: string
  name: string
  quantity: number
  unit: string | null
  totalPrice: number
  bonus: number
  bonusPercent: number
  vatPercent: number
  isUnknownProduct: boolean
  savingsAmount: number
}

type RawReceipt = {
  receiptId: string
  date: string
  store: string
  chain: string
  totalAmount: number
  totalBonus: number
  savingsSummary: unknown
  currency: string
  items: RawReceiptItem[]
}

export type ParsedReceiptImportPayload = {
  receipts: RawReceipt[]
  totalItems: number
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}: must be a finite number`)
  }
  return value
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}: must be a non-empty string`)
  }
  return value.trim()
}

function readOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readReceiptId(receipt: Record<string, unknown>): string {
  const receiptId = readOptionalString(receipt.receiptId)
  const batchId = readOptionalString(receipt.batchId)
  const resolved = receiptId ?? batchId

  if (!resolved) {
    throw new Error('Each receipt must include receiptId or batchId')
  }

  return resolved
}

function readDate(value: unknown): string {
  const date = readString(value, 'receipt date')
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid receipt date')
  }
  return parsed.toISOString()
}

function readItems(value: unknown): RawReceiptItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Each receipt must have an items array with at least one item')
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Invalid item at index ${index}`)
    }

    const row = item as Record<string, unknown>
    const savings = Array.isArray(row.savings) ? row.savings : []
    const savingsAmount = savings.reduce((sum, saving) => {
      if (!saving || typeof saving !== 'object' || Array.isArray(saving)) return sum
      const amount = (saving as Record<string, unknown>).amount
      return typeof amount === 'number' && Number.isFinite(amount) ? sum + amount : sum
    }, 0)

    return {
      id: readString(row.id, 'item id'),
      name: readString(row.name, 'item name').slice(0, MAX_ITEM_NAME_LENGTH),
      quantity: readNumber(row.quantity, 'item quantity'),
      unit: readOptionalString(row.unit),
      totalPrice: readNumber(row.totalPrice, 'item totalPrice'),
      bonus: row.bonus === undefined ? 0 : readNumber(row.bonus, 'item bonus'),
      bonusPercent: row.bonusPercent === undefined ? 0 : readNumber(row.bonusPercent, 'item bonusPercent'),
      vatPercent: row.vatPercent === undefined ? 0 : readNumber(row.vatPercent, 'item vatPercent'),
      isUnknownProduct: row.isUnknownProduct === true,
      savingsAmount,
    }
  })
}

function parseReceipt(value: unknown): RawReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid receipt entry')
  }

  const receipt = value as Record<string, unknown>

  return {
    receiptId: readReceiptId(receipt),
    date: readDate(receipt.date),
    store: readString(receipt.store, 'receipt store'),
    chain: readString(receipt.chain, 'receipt chain'),
    totalAmount: readNumber(receipt.totalAmount, 'receipt totalAmount'),
    totalBonus: receipt.totalBonus === undefined ? 0 : readNumber(receipt.totalBonus, 'receipt totalBonus'),
    savingsSummary: receipt.savingsSummary ?? null,
    currency: readOptionalString(receipt.currency) ?? 'NOK',
    items: readItems(receipt.items),
  }
}

export function parseReceiptsImportPayload(payload: unknown): ParsedReceiptImportPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid request body')
  }

  const body = payload as Record<string, unknown>
  if (!Array.isArray(body.receipts) || body.receipts.length === 0) {
    throw new Error('Body must include a non-empty receipts array')
  }

  if (body.receipts.length > MAX_RECEIPTS_PER_REQUEST) {
    throw new Error(`Maximum ${MAX_RECEIPTS_PER_REQUEST} receipts per request (received ${body.receipts.length})`)
  }

  const receipts = body.receipts.map(parseReceipt)
  const totalItems = receipts.reduce((sum, receipt) => sum + receipt.items.length, 0)

  if (totalItems > MAX_ITEMS_PER_REQUEST) {
    throw new Error(`Maximum ${MAX_ITEMS_PER_REQUEST} items per request (received ${totalItems})`)
  }

  return { receipts, totalItems }
}
