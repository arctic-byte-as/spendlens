// One-off backfill for receipt_items imported before the diet_category column existed.
// New imports classify at insert time (see importReceipts.ts) — this script only needs to run
// once against existing production data, never as part of the app runtime.
import { createAdminClient } from '../src/lib/supabase/admin'
import { classifyDietCategory } from '../src/lib/receipts/dietCategories'

const PAGE_SIZE = 500

async function main() {
  const supabase = createAdminClient()
  let updated = 0

  for (;;) {
    const { data: rows, error } = await supabase
      .from('receipt_items')
      .select('id, name')
      .is('diet_category', null)
      .limit(PAGE_SIZE)

    if (error) {
      console.error('Failed to fetch receipt_items:', error)
      process.exit(1)
    }

    if (!rows || rows.length === 0) break

    for (const row of rows as Array<{ id: string; name: string }>) {
      const diet_category = classifyDietCategory(row.name)
      const { error: updateError } = await supabase
        .from('receipt_items')
        .update({ diet_category })
        .eq('id', row.id)

      if (updateError) {
        console.error(`Failed to update receipt_item ${row.id}:`, updateError)
        process.exit(1)
      }
      updated += 1
    }

    console.log(`Classified ${updated} items so far...`)
  }

  console.log(`Done. Classified ${updated} receipt_items.`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
