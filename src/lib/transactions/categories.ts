export const CATEGORIES = [
  'HOUSING', 'TRANSPORT', 'FOOD & DRINK', 'GROCERIES', 'HEALTH',
  'SUBSCRIPTIONS', 'SHOPPING', 'TRAVEL', 'SAVINGS & INVESTMENTS',
  'INCOME', 'FEES', 'OTHER',
] as const

export type Category = typeof CATEGORIES[number]

export function isCanonicalCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}
