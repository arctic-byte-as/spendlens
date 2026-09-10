import type { DietCategory } from './dietCategories'
import type { MonthlyDietCategoryShare } from './analysis'

export type DietTargetDirection = 'decrease' | 'increase'

export type DietCategoryTarget = {
  category: DietCategory
  direction: DietTargetDirection
  description: string
}

// Fixed NNR-style targets, matching docs/family-diet-analysis.md's "Dietary Assessment" section.
// Only categories with a clear directional recommendation are tracked — everything else gets no
// verdict rather than an invented one.
export const DIET_CATEGORY_TARGETS: DietCategoryTarget[] = [
  { category: 'Candy & Sweets', direction: 'decrease', description: 'Cut bulk candy/smågodt — target ≤500 NOK/year' },
  { category: 'Processed Meat', direction: 'decrease', description: 'NNR: max ~50g/week for a family' },
  { category: 'Red Meat', direction: 'decrease', description: 'NNR: max 350-500g cooked red meat/week' },
  { category: 'Alcohol', direction: 'decrease', description: 'NNR 2023: no safe level of alcohol' },
  { category: 'Sweet Drinks', direction: 'decrease', description: 'Reduce sugary soda / sjokoladedrikk habit' },
  { category: 'Chips & Snacks', direction: 'decrease', description: 'Reduce ultra-processed snacking' },
  { category: 'Fish & Seafood', direction: 'increase', description: 'NNR: 2-3 fish meals/week (~600-900g for a family)' },
  { category: 'Legumes & Nuts', direction: 'increase', description: 'Target 6-8% of food spend' },
]

export type DietVerdict = 'improving' | 'worsening' | 'flat'

export type DietCategoryVerdictInput = {
  category: DietCategory
  direction: DietTargetDirection
  description: string
  verdict: DietVerdict
  latestSharePct: number
  deltaPct: number
}

// A change smaller than this (in share-of-spend percentage points) counts as 'flat' rather than
// improving/worsening — avoids noisy verdicts from rounding-level month-to-month movement.
const FLAT_THRESHOLD_PP = 0.005

/**
 * Deterministic verdict computation — the AI layer (dietTrendInsights) only writes the
 * one-sentence narrative on top of this, it never decides the verdict itself. This is what makes
 * "verdict direction matches the sign of the underlying change" guaranteed rather than hoped-for.
 */
export function computeDietCategoryVerdicts(
  trend: MonthlyDietCategoryShare[],
  targets: DietCategoryTarget[] = DIET_CATEGORY_TARGETS,
): DietCategoryVerdictInput[] {
  const results: DietCategoryVerdictInput[] = []

  for (const target of targets) {
    const rowsForCategory = trend
      .filter(row => row.category === target.category)
      .sort((a, b) => a.month.localeCompare(b.month))

    const latest = rowsForCategory[rowsForCategory.length - 1]
    if (!latest || latest.shareDeltaVsPreviousMonth === null) continue

    const delta = latest.shareDeltaVsPreviousMonth
    let verdict: DietVerdict
    if (Math.abs(delta) < FLAT_THRESHOLD_PP) {
      verdict = 'flat'
    } else if (target.direction === 'decrease') {
      verdict = delta < 0 ? 'improving' : 'worsening'
    } else {
      verdict = delta > 0 ? 'improving' : 'worsening'
    }

    results.push({
      category: target.category,
      direction: target.direction,
      description: target.description,
      verdict,
      latestSharePct: latest.shareOfTotal,
      deltaPct: delta,
    })
  }

  return results
}
