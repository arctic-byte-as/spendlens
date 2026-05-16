export type ReceiptAnalysisRow = {
  receipt_id: string
  date: string
  chain: string
  total_amount: number | string
  currency: string | null
}

export type ReceiptItemAnalysisRow = {
  receipt_id: string
  name: string
  quantity: number | string
  unit: string | null
  total_price: number | string
  bonus_percent: number | string
  vat_percent: number | string
  savings_amount: number | string
}

export type MonthlyChainSpend = {
  month: string
  chain: string
  spend: number
  trips: number
}

export type MonthlyHealthRatio = {
  month: string
  healthySpend: number
  totalSpend: number
  ratio: number
}

export type MonthlyVatSplit = {
  month: string
  foodSpend: number
  nonFoodSpend: number
}

export type MonthlySavingsRate = {
  month: string
  savings: number
  grossSpend: number
  rate: number
}

export type ItemPriceTrendMonth = {
  month: string
  avgUnitPrice: number
  increaseVsPreviousPct: number
  increasedOverTenPercent: boolean
}

export type ItemPriceTrend = {
  itemName: string
  purchaseCount: number
  monthly: ItemPriceTrendMonth[]
}

export type TopPurchasedItem = {
  name: string
  totalQty: number
  totalSpend: number
  receiptCount: number
}

function toNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function monthKey(date: string): string {
  const parsed = new Date(date)
  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function spendValue(value: number | string): number {
  return Math.abs(toNumber(value))
}

function sortedEntries<T>(map: Map<string, T>): Array<[string, T]> {
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function createReceiptMonthMap(receipts: ReceiptAnalysisRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const receipt of receipts) {
    map.set(receipt.receipt_id, monthKey(receipt.date))
  }
  return map
}

export function getCurrency(receipts: ReceiptAnalysisRow[]): string {
  return receipts.find(receipt => receipt.currency)?.currency ?? 'NOK'
}

export function getMonthlyChainSpend(receipts: ReceiptAnalysisRow[]): MonthlyChainSpend[] {
  const monthly = new Map<string, { spend: number; trips: number }>()

  for (const receipt of receipts) {
    const key = `${monthKey(receipt.date)}::${receipt.chain || 'UNKNOWN'}`
    const current = monthly.get(key) ?? { spend: 0, trips: 0 }
    current.spend += spendValue(receipt.total_amount)
    current.trips += 1
    monthly.set(key, current)
  }

  return sortedEntries(monthly).map(([key, value]) => {
    const [month, chain] = key.split('::')
    return {
      month,
      chain,
      spend: value.spend,
      trips: value.trips,
    }
  })
}

export function getMonthlyHealthRatio(
  receipts: ReceiptAnalysisRow[],
  items: ReceiptItemAnalysisRow[],
): MonthlyHealthRatio[] {
  const receiptMonths = createReceiptMonthMap(receipts)
  const monthly = new Map<string, { healthySpend: number; totalSpend: number }>()

  for (const item of items) {
    const month = receiptMonths.get(item.receipt_id)
    if (!month) continue

    const current = monthly.get(month) ?? { healthySpend: 0, totalSpend: 0 }
    const spend = spendValue(item.total_price)
    current.totalSpend += spend
    if (toNumber(item.bonus_percent) >= 15) {
      current.healthySpend += spend
    }
    monthly.set(month, current)
  }

  return sortedEntries(monthly).map(([month, value]) => ({
    month,
    healthySpend: value.healthySpend,
    totalSpend: value.totalSpend,
    ratio: value.totalSpend > 0 ? value.healthySpend / value.totalSpend : 0,
  }))
}

export function getMonthlyVatSplit(
  receipts: ReceiptAnalysisRow[],
  items: ReceiptItemAnalysisRow[],
): MonthlyVatSplit[] {
  const receiptMonths = createReceiptMonthMap(receipts)
  const monthly = new Map<string, { foodSpend: number; nonFoodSpend: number }>()

  for (const item of items) {
    const month = receiptMonths.get(item.receipt_id)
    if (!month) continue

    const vat = toNumber(item.vat_percent)
    const spend = spendValue(item.total_price)
    const current = monthly.get(month) ?? { foodSpend: 0, nonFoodSpend: 0 }

    if (vat === 15) current.foodSpend += spend
    if (vat === 25) current.nonFoodSpend += spend

    monthly.set(month, current)
  }

  return sortedEntries(monthly).map(([month, value]) => ({
    month,
    foodSpend: value.foodSpend,
    nonFoodSpend: value.nonFoodSpend,
  }))
}

export function getMonthlySavingsRate(
  receipts: ReceiptAnalysisRow[],
  items: ReceiptItemAnalysisRow[],
): MonthlySavingsRate[] {
  const receiptMonths = createReceiptMonthMap(receipts)
  const monthly = new Map<string, { savings: number; grossSpend: number }>()

  for (const item of items) {
    const month = receiptMonths.get(item.receipt_id)
    if (!month) continue

    const current = monthly.get(month) ?? { savings: 0, grossSpend: 0 }
    current.grossSpend += spendValue(item.total_price)
    current.savings += spendValue(item.savings_amount)
    monthly.set(month, current)
  }

  return sortedEntries(monthly).map(([month, value]) => ({
    month,
    savings: value.savings,
    grossSpend: value.grossSpend,
    rate:
      value.grossSpend + value.savings > 0
        ? value.savings / (value.grossSpend + value.savings)
        : 0,
  }))
}

export function getItemPriceTrends(
  receipts: ReceiptAnalysisRow[],
  items: ReceiptItemAnalysisRow[],
): ItemPriceTrend[] {
  const receiptMonths = createReceiptMonthMap(receipts)
  const byItem = new Map<string, ReceiptItemAnalysisRow[]>()

  for (const item of items) {
    const month = receiptMonths.get(item.receipt_id)
    if (!month) continue
    const unit = item.unit?.trim().toUpperCase()
    if (unit !== 'EA') continue

    const group = byItem.get(item.name) ?? []
    group.push(item)
    byItem.set(item.name, group)
  }

  const trends: ItemPriceTrend[] = []

  for (const [itemName, rows] of Array.from(byItem.entries())) {
    if (rows.length < 3) continue

    const monthly = new Map<string, { totalPrice: number; totalQty: number }>()
    for (const row of rows) {
      const month = receiptMonths.get(row.receipt_id)
      if (!month) continue
      const qty = toNumber(row.quantity)
      if (qty <= 0) continue

      const current = monthly.get(month) ?? { totalPrice: 0, totalQty: 0 }
      current.totalPrice += spendValue(row.total_price)
      current.totalQty += qty
      monthly.set(month, current)
    }

    const monthlyRows = sortedEntries(monthly).map(([month, value]) => ({
      month,
      avgUnitPrice: value.totalQty > 0 ? value.totalPrice / value.totalQty : 0,
    }))

    if (monthlyRows.length === 0) continue

    const withIncreases: ItemPriceTrendMonth[] = monthlyRows.map((row, index) => {
      if (index === 0) {
        return {
          ...row,
          increaseVsPreviousPct: 0,
          increasedOverTenPercent: false,
        }
      }

      const previous = monthlyRows[index - 1].avgUnitPrice
      const increaseVsPreviousPct =
        previous > 0 ? (row.avgUnitPrice - previous) / previous : 0

      return {
        ...row,
        increaseVsPreviousPct,
        increasedOverTenPercent: increaseVsPreviousPct > 0.1,
      }
    })

    trends.push({
      itemName,
      purchaseCount: rows.length,
      monthly: withIncreases,
    })
  }

  return trends.sort((a, b) => {
    const aLatest = a.monthly[a.monthly.length - 1]?.avgUnitPrice ?? 0
    const bLatest = b.monthly[b.monthly.length - 1]?.avgUnitPrice ?? 0
    return bLatest - aLatest
  })
}

export function getTopPurchasedItems(items: ReceiptItemAnalysisRow[]): TopPurchasedItem[] {
  const byItem = new Map<
    string,
    { totalQty: number; totalSpend: number; receiptIds: Set<string> }
  >()

  for (const item of items) {
    const current = byItem.get(item.name) ?? {
      totalQty: 0,
      totalSpend: 0,
      receiptIds: new Set<string>(),
    }

    current.totalQty += toNumber(item.quantity)
    current.totalSpend += spendValue(item.total_price)
    current.receiptIds.add(item.receipt_id)
    byItem.set(item.name, current)
  }

  return Array.from(byItem.entries())
    .map(([name, value]) => ({
      name,
      totalQty: value.totalQty,
      totalSpend: value.totalSpend,
      receiptCount: value.receiptIds.size,
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 50)
}
