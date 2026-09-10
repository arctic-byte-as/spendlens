import { classifyDietCategory, isDietCategory, DIET_CATEGORIES, DIET_CATEGORY_GROUPS } from './dietCategories'

describe('classifyDietCategory', () => {
  it('classifies known product names into the expected category', () => {
    expect(classifyDietCategory('KYLLINGFILET 700G PRIOR')).toBe('Poultry')
    expect(classifyDietCategory('KJØTTDEIG STORFE&SVIN 600G FOLKETS')).toBe('Red Meat')
    expect(classifyDietCategory('STJERNEBACON SKIVET 140G GILDE')).toBe('Processed Meat')
    expect(classifyDietCategory('SMÅGODT PR KG')).toBe('Candy & Sweets')
    expect(classifyDietCategory('RINGNES LITE 0,5LX6 BX')).toBe('Alcohol')
    expect(classifyDietCategory('LAKS PORSJONER U/SKINN 4X125G LERØY')).toBe('Fish & Seafood')
    expect(classifyDietCategory('SELBU BLÅ')).toBe('Dairy - Cheese')
    expect(classifyDietCategory('LETTMELK 1,75L')).toBe('Dairy - Milk')
    expect(classifyDietCategory('AGURK')).toBe('Vegetables')
    expect(classifyDietCategory('BLÅBÆR 400G')).toBe('Fruit')
    expect(classifyDietCategory('KIKERTER HERMETISK')).toBe('Legumes & Nuts')
  })

  it('prefers the more specific category when names could match multiple rules', () => {
    // Processed-meat keyword ("PØLSE") should win over the poultry keyword ("KYLLING").
    expect(classifyDietCategory('KYLLINGPØLSE 400G')).toBe('Processed Meat')
  })

  it('falls back deterministically to Other for unrecognised or ambiguous names', () => {
    expect(classifyDietCategory('XYZ UKJENT VARE 123')).toBe('Other')
    expect(classifyDietCategory('')).toBe('Other')
  })

  it('is idempotent — repeated calls on the same name return the same category', () => {
    const name = 'KYLLING HEL CA1,5-2KG PRIOR'
    const first = classifyDietCategory(name)
    const second = classifyDietCategory(name)
    expect(first).toBe(second)
  })

  it('is case-insensitive', () => {
    expect(classifyDietCategory('ringnes lite 0,5lx6 bx')).toBe(classifyDietCategory('RINGNES LITE 0,5LX6 BX'))
  })
})

describe('isDietCategory', () => {
  it('accepts every taxonomy value', () => {
    for (const category of DIET_CATEGORIES) {
      expect(isDietCategory(category)).toBe(true)
    }
  })

  it('rejects unknown strings and non-strings', () => {
    expect(isDietCategory('Not A Category')).toBe(false)
    expect(isDietCategory(123)).toBe(false)
    expect(isDietCategory(null)).toBe(false)
  })
})

describe('DIET_CATEGORY_GROUPS', () => {
  it('assigns every category to exactly one group', () => {
    for (const category of DIET_CATEGORIES) {
      expect(['cut_out', 'moderate', 'eat_more', 'everyday']).toContain(DIET_CATEGORY_GROUPS[category])
    }
  })
})
