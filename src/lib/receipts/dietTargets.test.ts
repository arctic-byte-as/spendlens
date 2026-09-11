import { computeDietCategoryVerdicts, type DietCategoryTarget } from './dietTargets'
import type { MonthlyDietCategoryShare } from './analysis'

const targets: DietCategoryTarget[] = [
  { category: 'Candy & Sweets', direction: 'decrease', description: 'decrease candy' },
  { category: 'Fish & Seafood', direction: 'increase', description: 'increase fish' },
]

function row(
  category: MonthlyDietCategoryShare['category'],
  month: string,
  shareOfTotal: number,
  shareDeltaVsPreviousMonth: number | null,
): MonthlyDietCategoryShare {
  return { month, category, spend: shareOfTotal * 100, shareOfTotal, shareDeltaVsPreviousMonth }
}

describe('computeDietCategoryVerdicts', () => {
  it('marks a decreasing target as improving when its share falls', () => {
    const trend = [row('Candy & Sweets', '2026-01', 0.3, null), row('Candy & Sweets', '2026-02', 0.2, -0.1)]
    const [verdict] = computeDietCategoryVerdicts(trend, targets)
    expect(verdict.category).toBe('Candy & Sweets')
    expect(verdict.verdict).toBe('improving')
    expect(Math.sign(verdict.deltaPct)).toBe(-1)
  })

  it('marks a decreasing target as worsening when its share rises', () => {
    const trend = [row('Candy & Sweets', '2026-01', 0.2, null), row('Candy & Sweets', '2026-02', 0.35, 0.15)]
    const verdicts = computeDietCategoryVerdicts(trend, targets)
    expect(verdicts.find(v => v.category === 'Candy & Sweets')?.verdict).toBe('worsening')
  })

  it('marks an increasing target as improving when its share rises', () => {
    const trend = [row('Fish & Seafood', '2026-01', 0.02, null), row('Fish & Seafood', '2026-02', 0.05, 0.03)]
    const verdicts = computeDietCategoryVerdicts(trend, targets)
    expect(verdicts.find(v => v.category === 'Fish & Seafood')?.verdict).toBe('improving')
  })

  it('marks an increasing target as worsening when its share falls', () => {
    const trend = [row('Fish & Seafood', '2026-01', 0.05, null), row('Fish & Seafood', '2026-02', 0.02, -0.03)]
    const verdicts = computeDietCategoryVerdicts(trend, targets)
    expect(verdicts.find(v => v.category === 'Fish & Seafood')?.verdict).toBe('worsening')
  })

  it('treats a negligible change as flat regardless of direction', () => {
    const trend = [row('Candy & Sweets', '2026-01', 0.2, null), row('Candy & Sweets', '2026-02', 0.201, 0.001)]
    const verdicts = computeDietCategoryVerdicts(trend, targets)
    expect(verdicts.find(v => v.category === 'Candy & Sweets')?.verdict).toBe('flat')
  })

  it('skips a category with fewer than 2 distinct months of data', () => {
    const trend = [row('Candy & Sweets', '2026-01', 0.2, null)]
    const verdicts = computeDietCategoryVerdicts(trend, targets)
    expect(verdicts.find(v => v.category === 'Candy & Sweets')).toBeUndefined()
  })

  it('verdict direction always matches the sign of the underlying month-over-month change', () => {
    const trend = [
      row('Candy & Sweets', '2026-01', 0.3, null),
      row('Candy & Sweets', '2026-02', 0.1, -0.2),
      row('Fish & Seafood', '2026-01', 0.02, null),
      row('Fish & Seafood', '2026-02', 0.08, 0.06),
    ]
    for (const verdict of computeDietCategoryVerdicts(trend, targets)) {
      if (verdict.verdict === 'flat') continue
      const movingTowardTarget =
        (verdict.direction === 'decrease' && verdict.deltaPct < 0) ||
        (verdict.direction === 'increase' && verdict.deltaPct > 0)
      expect(verdict.verdict === 'improving').toBe(movingTowardTarget)
    }
  })
})
