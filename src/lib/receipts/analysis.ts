import { DIET_CATEGORIES, isDietCategory, type DietCategory } from './dietCategories'

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
  diet_category?: string | null
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

// Backlog Epic 7-D defines health index as spend share where bonus_percent >= 15.
const HEALTHY_BONUS_THRESHOLD = 15
// Norway grocery VAT assumption: 15% = food.
const FOOD_VAT_PERCENT = 15
// Norway grocery VAT assumption: 25% = non-food.
const NON_FOOD_VAT_PERCENT = 25
// Track price trends for regular each-unit purchases.
const TRACKABLE_UNIT = 'EA'
// Backlog requirement: item must be purchased at least 3 times to appear in trend tracking.
const MIN_PURCHASES_FOR_TREND = 3
// Highlight monthly item price increases greater than 10%.
const SIGNIFICANT_PRICE_INCREASE_THRESHOLD = 0.1
// Backlog requirement: top 50 purchased items by spend.
const TOP_ITEMS_LIMIT = 50

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
  // Prefer the most common currency for the selected receipt set. If unavailable, default to NOK.
  const counts = new Map<string, number>()
  for (const receipt of receipts) {
    const currency = receipt.currency
    if (!currency) continue
    counts.set(currency, (counts.get(currency) ?? 0) + 1)
  }

  let selected = 'NOK'
  let selectedCount = 0
  for (const [currency, count] of Array.from(counts.entries())) {
    if (count > selectedCount) {
      selected = currency
      selectedCount = count
    }
  }
  return selected
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
    if (toNumber(item.bonus_percent) >= HEALTHY_BONUS_THRESHOLD) {
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

    if (vat === FOOD_VAT_PERCENT) current.foodSpend += spend
    if (vat === NON_FOOD_VAT_PERCENT) current.nonFoodSpend += spend

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
    if (unit !== TRACKABLE_UNIT) continue

    const group = byItem.get(item.name) ?? []
    group.push(item)
    byItem.set(item.name, group)
  }

  const trends: ItemPriceTrend[] = []

  for (const [itemName, rows] of Array.from(byItem.entries())) {
    if (rows.length < MIN_PURCHASES_FOR_TREND) continue

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
        increasedOverTenPercent:
          increaseVsPreviousPct > SIGNIFICANT_PRICE_INCREASE_THRESHOLD,
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

export type MonthlyDietCategoryShare = {
  month: string
  category: DietCategory
  spend: number
  shareOfTotal: number
  // Percentage-point change vs. the prior month in the dataset (e.g. +0.02 = up 2pp).
  // null when there is no prior month to compare against (first month in range).
  shareDeltaVsPreviousMonth: number | null
}

/**
 * % of spend per diet category per month, plus month-over-month share deltas.
 * `shareOfTotal` is each category's share of that month's *total* item spend (across all
 * categories, including 'Other'), so shares for a given month sum to 1 (barring rounding).
 */
export function getMonthlyDietCategoryTrend(
  receipts: ReceiptAnalysisRow[],
  items: ReceiptItemAnalysisRow[],
): MonthlyDietCategoryShare[] {
  const receiptMonths = createReceiptMonthMap(receipts)
  const monthlyTotals = new Map<string, number>()
  const monthlyCategorySpend = new Map<string, Map<DietCategory, number>>()

  for (const item of items) {
    const month = receiptMonths.get(item.receipt_id)
    if (!month) continue

    const category: DietCategory = isDietCategory(item.diet_category) ? item.diet_category : 'Other'
    const spend = spendValue(item.total_price)

    monthlyTotals.set(month, (monthlyTotals.get(month) ?? 0) + spend)

    const categoryMap = monthlyCategorySpend.get(month) ?? new Map<DietCategory, number>()
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + spend)
    monthlyCategorySpend.set(month, categoryMap)
  }

  const months = Array.from(monthlyTotals.keys()).sort()

  // Previous-month share per category, tracked while walking months in order so the delta is a
  // simple lookup rather than a second pass.
  const previousShare = new Map<DietCategory, number>()
  const rows: MonthlyDietCategoryShare[] = []

  months.forEach((month, monthIndex) => {
    const total = monthlyTotals.get(month) ?? 0
    const categoryMap = monthlyCategorySpend.get(month) ?? new Map<DietCategory, number>()

    for (const category of DIET_CATEGORIES) {
      const spend = categoryMap.get(category) ?? 0
      if (spend === 0 && !previousShare.has(category)) continue

      const shareOfTotal = total > 0 ? spend / total : 0
      const hasPrevious = monthIndex > 0
      const shareDeltaVsPreviousMonth = hasPrevious
        ? shareOfTotal - (previousShare.get(category) ?? 0)
        : null

      rows.push({ month, category, spend, shareOfTotal, shareDeltaVsPreviousMonth })
      previousShare.set(category, shareOfTotal)
    }
  })

  return rows
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
    .slice(0, TOP_ITEMS_LIMIT)
}
