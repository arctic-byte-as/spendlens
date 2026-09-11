// Diet-category taxonomy for Trumf receipt items, matching `docs/family-diet-analysis.md`.
// Classification is deterministic keyword matching (Norwegian grocery naming conventions) rather
// than an AI call: item names are stable once a receipt is imported, and a fixed, testable mapping
// keeps classification idempotent by construction. Ambiguous or unrecognised names fall back to
// 'Other' rather than guessing a specific category.

export const DIET_CATEGORIES = [
  'Vegetables',
  'Fruit',
  'Poultry',
  'Red Meat',
  'Processed Meat',
  'Fish & Seafood',
  'Legumes & Nuts',
  'Dairy - Milk',
  'Dairy - Yoghurt',
  'Dairy - Cheese',
  'Dairy - Cream/Butter',
  'Eggs',
  'Whole Grains & Oats',
  'Bread - Refined',
  'Pasta & Rice',
  'Oils & Condiments',
  'Spices & Baking',
  'Candy & Sweets',
  'Baked Sweets',
  'Chips & Snacks',
  'Ice Cream',
  'Sweet Drinks',
  'Juice',
  'Water & Tonic',
  'Alcohol',
  'Ready Meals & Pizza',
  'Other',
] as const

export type DietCategory = (typeof DIET_CATEGORIES)[number]

export type DietCategoryGroup = 'cut_out' | 'moderate' | 'eat_more' | 'everyday'

// Backlog: reuse the "Cut Out / Moderate / Eat More" framing from the diet analysis report as a
// filter/legend. Categories the report doesn't explicitly rank fall into 'everyday' rather than
// being forced into one of the three ranked buckets.
export const DIET_CATEGORY_GROUPS: Record<DietCategory, DietCategoryGroup> = {
  'Candy & Sweets': 'cut_out',
  'Processed Meat': 'cut_out',
  'Sweet Drinks': 'cut_out',
  'Chips & Snacks': 'cut_out',
  'Baked Sweets': 'cut_out',
  'Ice Cream': 'cut_out',

  'Dairy - Cheese': 'moderate',
  'Red Meat': 'moderate',
  Alcohol: 'moderate',
  'Bread - Refined': 'moderate',
  'Ready Meals & Pizza': 'moderate',
  Juice: 'moderate',

  'Fish & Seafood': 'eat_more',
  'Legumes & Nuts': 'eat_more',
  Vegetables: 'eat_more',
  Fruit: 'eat_more',
  'Whole Grains & Oats': 'eat_more',

  Poultry: 'everyday',
  'Dairy - Milk': 'everyday',
  'Dairy - Yoghurt': 'everyday',
  'Dairy - Cream/Butter': 'everyday',
  Eggs: 'everyday',
  'Oils & Condiments': 'everyday',
  'Pasta & Rice': 'everyday',
  'Spices & Baking': 'everyday',
  'Water & Tonic': 'everyday',
  Other: 'everyday',
}

// Ordered keyword lists (Norwegian grocery naming). Order matters: earlier entries win when a name
// could match more than one category (e.g. "KYLLINGPØLSE" should hit Processed Meat via "PØLSE"
// before Poultry via "KYLLING").
const KEYWORD_RULES: Array<{ category: DietCategory; keywords: string[] }> = [
  {
    category: 'Candy & Sweets',
    keywords: [
      'SMÅGODT', 'GODTERI', 'SJOKOLADE', 'SJOKO', 'NUTELLA', 'MELLOMBAR', 'TWIST', 'NAPOLEON',
      'FIRKLØVER', 'KVIKK LUNSJ', 'FREIA', 'NIDAR', 'LAKRIS', 'DRØM', 'SMIL', 'BOUNTY', 'MARS',
      'SNICKERS', 'STRATOS', 'NON STOP', 'SMASH', 'GODTPOSE', 'PICK N MIX', 'PIRATOS', 'KIT KAT',
    ],
  },
  {
    category: 'Baked Sweets',
    keywords: ['KAKE', 'BOLLER SØT', 'SKOLEBOLLE', 'KANELBOLLE', 'MUFFINS', 'WIENERBRØD', 'DONUT', 'VAFLER', 'KJEKS'],
  },
  {
    category: 'Ice Cream',
    keywords: ['IS KREM', 'ISKREM', ' IS ', 'SOFTIS', 'MAGNUM', 'SORBET', 'PALETT'],
  },
  {
    category: 'Chips & Snacks',
    keywords: ['CHIPS', 'POTETGULL', 'SUPERCHIPS', 'KIMS', 'NACHOS', 'POPCORN', 'POMMES FRITES', 'SNACKS'],
  },
  {
    category: 'Sweet Drinks',
    keywords: ['COLA', 'BRUS', 'SOLO', 'FANTA', 'SPRITE', 'PEPSI', 'JULEBRUS', 'SJOKOLADEDRIKK', 'ENERGIDRIKK', 'MONSTER', 'RED BULL'],
  },
  {
    category: 'Juice',
    keywords: ['JUICE', 'PRESSET', 'NEKTAR', 'SMOOTHIE'],
  },
  {
    category: 'Water & Tonic',
    keywords: ['FARRIS', 'TONIC', 'FARRIS BRUS', 'MINERALVANN', ' VANN'],
  },
  {
    // Note: deliberately no bare "VIN" keyword — it is a substring of common Norwegian words like
    // "SVIN" (pork), so wine must be matched via its actual compound forms (RØDVIN, HVITVIN, ...).
    // " ØL " is space-bounded (not a bare substring) because "ØL" also occurs inside unrelated
    // compounds such as "PØLSE" (sausage) — bounding it to a standalone word avoids that collision.
    category: 'Alcohol',
    keywords: [
      ' ØL ', 'JULEØL', 'PILS', 'LAGER', 'IPA', 'CIDER', 'RØDVIN', 'HVITVIN', 'RINGNES', 'AASS', 'HANSA',
      'MACK', 'GRANS', 'CARLSBERG', 'HEINEKEN', 'SELTZER', 'RADLER', 'BULMERS', 'BAILEYS', 'AKEVITT',
    ],
  },
  {
    category: 'Ready Meals & Pizza',
    keywords: ['PIZZA', 'GRANDIOSA', 'RISTORANTE', 'TACO', 'FERDIGRETT', 'FERDIGMAT', 'WOK RETT'],
  },
  {
    category: 'Processed Meat',
    keywords: [
      'BACON', 'SALAMI', 'PØLSE', 'SKINKE', 'CHORIZO', 'KNACKER', 'KNACKWURST', 'LEVERPOSTEI',
      'SERVELAT', 'SPEKEMAT', 'SPEKEBRETT', 'SPEKESKINKE', 'KYLLINGPØLSE', 'WIENERPØLSE', 'MORTADELLA',
    ],
  },
  {
    category: 'Poultry',
    keywords: ['KYLLING', 'KALKUN', 'AND GOURMET', 'AND ', 'FAVORITTKYLLING', 'HOVELSRUD'],
  },
  {
    category: 'Fish & Seafood',
    keywords: [
      'LAKS', 'TORSK', 'HYSE', 'MAKRELL', 'SILD', 'REKER', 'FISK', 'FISKEKAKER', 'FISKEPINNER',
      'SKREI', 'ØRRET', 'TUNFISK', 'KVEITE', 'SEI ', 'BLÅSKJELL',
    ],
  },
  {
    category: 'Red Meat',
    keywords: [
      'STORFE', 'SVIN', 'LAMMEDEIG', 'LAMMEKOTELETT', 'LAM ', 'BIFF', 'ENTRECOTE', 'INDREFILET',
      'YTREFILET', 'SVINEKAM', 'SVINESTEK', 'GRILLFILET', 'TYNNRIBBE', 'KJØTTDEIG', 'KJØTTBOLLER',
      'JULESKINKE RÅ',
    ],
  },
  {
    category: 'Legumes & Nuts',
    keywords: [
      'BØNNER', 'KIKERTER', 'LINSER', 'NØTTER', 'MANDLER', 'CASHEW', 'PEANØTT', 'VALNØTT', 'HASSELNØTT',
      'TOFU', 'FALAFEL', 'PISTASJ',
    ],
  },
  {
    category: 'Dairy - Cheese',
    keywords: ['OST ', 'NORVEGIA', 'SELBU BLÅ', 'JARLSBERG', 'FETA', 'MOZZARELLA', 'COTTAGE CHEESE', 'BRIE', 'GEITOST', 'PARMESAN'],
  },
  {
    category: 'Dairy - Yoghurt',
    keywords: ['YOGHURT', 'YOGURT', 'SKYR', 'GRESK YOG'],
  },
  {
    category: 'Dairy - Cream/Butter',
    keywords: ['FLØTE', 'SMØR', 'CREME FRAICHE', 'RØMME', 'MARGARIN'],
  },
  {
    category: 'Dairy - Milk',
    keywords: ['LETTMELK', 'HELMELK', 'SKUMMET MELK', 'MELK ', 'KEFIR'],
  },
  {
    category: 'Eggs',
    keywords: ['EGG '],
  },
  {
    category: 'Whole Grains & Oats',
    keywords: ['HAVRE', 'GROVBRØD', 'GROVT BRØD', 'MYSLI', 'MÜSLI', 'GRYN', 'QUINOA', 'FULLKORN'],
  },
  {
    category: 'Bread - Refined',
    keywords: ['BRØD', 'TORTILLA', 'LOMPE', 'BAGUETTE', 'RUNDSTYKKE', 'YOGHURTBRØD'],
  },
  {
    category: 'Pasta & Rice',
    keywords: ['PASTA', 'SPAGHETTI', 'RIS ', 'NUDLER', 'MAKARONI'],
  },
  {
    category: 'Oils & Condiments',
    keywords: ['OLIVENOLJE', 'RAPSOLJE', 'MATOLJE', 'KETCHUP', 'BBQ SAUS', 'MAJONES', 'SENNEP', 'DRESSING', 'PESTO'],
  },
  {
    category: 'Spices & Baking',
    keywords: ['KRYDDER', 'BAKEPULVER', 'VANILJESUKKER', 'MEL ', 'HVETEMEL', 'GJÆR', 'KORIANDER', 'BASILIKUM'],
  },
  {
    category: 'Vegetables',
    keywords: [
      'AGURK', 'GULROT', 'SALAT', 'BROKKOLI', 'BLOMKÅL', 'PAPRIKA', 'LØK', 'TOMAT', 'POTET',
      'SQUASH', 'ZUCCHINI', 'RØDBET', 'SØTPOTET', 'GRØNNSAK', 'SPINAT', 'KÅL', 'PURRE', 'SOPP',
    ],
  },
  {
    category: 'Fruit',
    keywords: [
      'EPLE', 'BANAN', 'APPELSIN', 'BLÅBÆR', 'JORDBÆR', 'BRINGEBÆR', 'DRUER', 'PÆRE', 'SITRON',
      'LIME', 'MANGO', 'ANANAS', 'FRUKT', 'KIWI FRUKT', 'VANNMELON', 'MELON',
    ],
  },
]

/**
 * Classify a receipt item name into the diet-category taxonomy from `docs/family-diet-analysis.md`.
 * Pure function of the item name (case/diacritic-insensitive substring match) — same input always
 * yields the same category, which keeps persisted classifications idempotent by construction.
 * Unmatched or genuinely ambiguous names deterministically fall back to 'Other'.
 */
export function classifyDietCategory(itemName: string): DietCategory {
  const normalised = ` ${itemName.trim().toUpperCase()} `

  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (normalised.includes(keyword.toUpperCase())) {
        return rule.category
      }
    }
  }

  return 'Other'
}

export function isDietCategory(value: unknown): value is DietCategory {
  return typeof value === 'string' && (DIET_CATEGORIES as readonly string[]).includes(value)
}
