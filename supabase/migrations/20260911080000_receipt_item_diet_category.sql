-- Epic 7-E: diet-category classification for receipt items.
-- Persisted per item (not recomputed on every request) since item names are stable and
-- classification is deterministic — see src/lib/receipts/dietCategories.ts.
-- New items are classified at import time (importReceipts.ts); pre-existing rows are backfilled
-- out-of-band via `npm run backfill:diet-categories` since classification logic lives in TypeScript.

alter table public.receipt_items
  add column if not exists diet_category text;

create index if not exists idx_receipt_items_user_diet_category
  on public.receipt_items (user_id, diet_category);
