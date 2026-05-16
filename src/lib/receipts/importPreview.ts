export type ReceiptImportItem = {
  id: string
  name: string
  quantity: number
  unit?: string | null
  totalPrice: number
  bonus?: number
  bonusPercent?: number
  vatPercent?: number
  isUnknownProduct?: boolean
  savings?: Array<{ amount?: number }>
}

export type ReceiptImportReceipt = {
  receiptId?: string
  batchId?: string
  date: string
  store: string
  chain: string
  totalAmount: number
  totalBonus?: number
  savingsSummary?: unknown
  currency?: string
  items: ReceiptImportItem[]
}

export type ReceiptImportPreview = {
  receipts: ReceiptImportReceipt[]
  receiptCount: number
  duplicateCount: number
  dateFrom: string | null
  dateTo: string | null
  chains: string[]
  totalSpend: number
  totalItems: number
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function receiptKey(receipt: ReceiptImportReceipt): string {
  return receipt.receiptId || receipt.batchId || ''
}

function looksLikeReceipt(value: unknown): value is ReceiptImportReceipt {
  if (!isObject(value)) return false
  const maybeReceiptId = typeof value.receiptId === 'string' || typeof value.batchId === 'string'
  return (
    maybeReceiptId &&
    typeof value.date === 'string' &&
    typeof value.store === 'string' &&
    typeof value.chain === 'string' &&
    typeof value.totalAmount === 'number' &&
    Array.isArray(value.items)
  )
}

export function extractReceiptsFromJson(value: unknown): ReceiptImportReceipt[] {
  if (Array.isArray(value)) {
    return value.filter(looksLikeReceipt)
  }

  if (isObject(value) && Array.isArray(value.receipts)) {
    return value.receipts.filter(looksLikeReceipt)
  }

  if (looksLikeReceipt(value)) {
    return [value]
  }

  return []
}

export function createReceiptImportPreview(receipts: ReceiptImportReceipt[]): ReceiptImportPreview {
  const seen = new Set<string>()
  const unique: ReceiptImportReceipt[] = []
  let duplicateCount = 0

  for (const receipt of receipts) {
    const key = receiptKey(receipt)
    if (key && seen.has(key)) {
      duplicateCount += 1
      continue
    }
    if (key) seen.add(key)
    unique.push(receipt)
  }

  const timestamps = unique
    .map(receipt => new Date(receipt.date).getTime())
    .filter(value => Number.isFinite(value))
    .sort((a, b) => a - b)

  const chains = Array.from(new Set(unique.map(receipt => receipt.chain).filter(Boolean))).sort()
  const totalSpend = unique.reduce((sum, receipt) => sum + receipt.totalAmount, 0)
  const totalItems = unique.reduce((sum, receipt) => sum + receipt.items.length, 0)

  return {
    receipts: unique,
    receiptCount: unique.length,
    duplicateCount,
    dateFrom: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null,
    dateTo: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
    chains,
    totalSpend,
    totalItems,
  }
}
