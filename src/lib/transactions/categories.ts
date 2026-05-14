export const CATEGORIES = [
  'HOUSING', 'TRANSPORT', 'FOOD & DRINK', 'GROCERIES', 'HEALTH',
  'SUBSCRIPTIONS', 'SHOPPING', 'TRAVEL', 'SAVINGS & INVESTMENTS',
  'INCOME', 'CREDIT CARD', 'FEES', 'OTHER',
] as const

export type Category = typeof CATEGORIES[number]

export function isCanonicalCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}

/**
 * Validate that a user-supplied custom category name is well-formed.
 * Rules: 1–50 chars, uppercase letters/digits/spaces and & ' - only.
 * Call `value.toUpperCase().trim()` before passing in.
 */
export function isValidCategoryName(value: string): boolean {
  if (value.length === 0 || value.length > 50) return false
  return /^[A-Z0-9][A-Z0-9 &'\-]*$/.test(value)
}
