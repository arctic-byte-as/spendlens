# Track A — Diet Insights + AI Prompt Hardening (sequential)

Work through these two SpendLens backlog epics in order, on a feature branch (never push to `main` directly),
opening a PR when each is done and tested. I'll review and test everything myself when I wake up.

Repo: "/Users/pete/code/github/Arctic Byte/spendlens". Read `docs/backlog.md` for full story text and
acceptance criteria before starting — the summaries below are pointers, not the full spec.

These two epics are sequenced together deliberately: both touch `src/lib/ai/insights.ts`. Epic 7-E adds new
functions to that file; Epic 8-D retrofits hardening onto it (and `categorise.ts`). Do 7-E first, fully, with
its own PR, then do 8-D on top of the finished result — don't interleave them or try to parallelize internally.

## 1. Epic 7-E — Claude Receipt & Diet Insights (`docs/backlog.md`, search "Epic 7-E")

Currently zero code exists for this epic. Build in this sequence, each as a working, tested increment:

a. `receiptInsights()` in `src/lib/ai/insights.ts` — receipt-level savings tips from pre-aggregated summaries
   (health ratio, VAT split, top 20 items, chain breakdown, savings rate), NOT raw JSON. Follow the existing
   `generateInsights()` pattern in the same file for how the Anthropic client/model/caching is set up.

b. Diet-category classification — new `src/lib/receipts/dietCategories.ts` mapping `receipt_items.name` to
   the taxonomy used in `docs/family-diet-analysis.md` (Vegetables, Poultry, Red Meat, Processed Meat,
   Candy & Sweets, Fish & Seafood, Legumes & Nuts, Dairy sub-types, Alcohol, etc.). Add a migration for
   `receipt_items.diet_category` (persisted, not recomputed per-request — see acceptance criteria in the
   backlog for idempotency requirements).

c. `getMonthlyDietCategoryTrend()` in `src/lib/receipts/analysis.ts` plus a new `/dashboard/receipts/diet`
   page (flag-gated behind `receipt_analysis`, same pattern as the existing `/dashboard/receipts` page)
   showing % of spend per diet category per month with month-over-month deltas.

d. `dietTrendInsights()` — AI narrative trend summary consuming only the aggregated monthly trend + fixed
   NNR-style targets (fish 2-3 meals/week, legumes 6-8% of food spend, processed meat max 50g/week — see the
   diet analysis report for the full target list). Typed structured output (per-category verdict:
   improving/worsening/flat + one sentence), not free-form chat. Cache in the `insights` table with
   `"source": "diet_trend"` tag, 24h TTL.

Write unit tests for the diet-category classification (stable mappings, deterministic fallback for ambiguous
names) and for `getMonthlyDietCategoryTrend()` (seeded multi-month data, assert % and deltas) — these are
separately listed in Epic 7-F of the backlog.

Run the full test suite and `npm run build`. Commit to a branch named `feat/receipt-diet-insights` and open
a PR before moving to step 2.

## 2. Epic 8-D — AI & Prompt-Injection Hardening (`docs/backlog.md`, search "Epic 8-D")

Currently zero code. Apply retroactively to the EXISTING AI call sites first (`src/lib/ai/categorise.ts`,
`src/lib/ai/insights.ts`, including the new functions you just added in step 1):
- Wrap user-controlled data (transaction descriptions, item names) in clear delimiters before including in prompts
- Prefer aggregate summaries over raw per-row data wherever the call site allows it
- Strip obvious PII before prompts
- Add tests for malformed model responses (bad JSON, wrong shape) and prompt-injection-shaped input
  (item/description text containing prompt-like instructions) — there are currently ZERO test files under
  `src/lib/ai/`, so this is greenfield test-writing, not just edge-case additions
- AC in the backlog: AI endpoints continue to return valid structured output or a safe error even under
  adversarial input — write a test that proves this, don't just assert it

Run the full test suite and `npm run build`. Commit to a new branch named `feat/ai-prompt-hardening`
(branched from the finished 7-E work, or rebased onto `main` once 7-E is merged — use your judgment on
which is cleaner given the actual state of things) and open a second PR.

## Ground rules

- **Branch + PR per epic, never push to `main` directly.**
- **Run the full test suite and `npm run build` before opening each PR.** Don't open a PR with failing tests
  or a broken build.
- **Do not deploy, do not touch Stripe live keys, do not merge your own PRs, do not touch anything under
  Phase 6 (Monetisation) or push migrations to a production Supabase project** — schema migrations should be
  new files under `supabase/migrations/` only, applied locally/in CI, never run against production.
- **Do not modify `docs/backlog.md` status markers yourself** — leave that for me to update after I review
  your work; just build against the acceptance criteria as written.
- If you finish both epics with time and context to spare, check Epic 7-C's remaining 🟡 story (verify the
  existing `/dashboard/receipts/import` upload UI still matches its story, since it may already be done —
  check before building anything) using the same branch/PR discipline.
- If you hit a decision that materially changes user-facing behavior or architecture (not just an
  implementation detail), stop and leave a clear note in the PR description rather than guessing — don't
  block the whole loop on it, just flag it and move to the next epic.

Loop through these two epics autonomously, in order, opening one PR per completed epic, until I wake up.
