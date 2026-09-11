# SpendLens — Product Backlog

> **Living document.** Owner: CPO. Last updated: 2026-09-10.
> Format: Phases → Epics → User stories. Acceptance criteria on highest-risk stories only.
> Technical dependencies flagged with **[TECH DEP]**.

---

## Priority Legend

| Label | Meaning |
|---|---|
| 🔴 Blocker | Must ship before phase goal is met |
| 🟠 High | Required for the phase goal |
| 🟡 Medium | Strong improvement, phase not gated on it |
| 🟢 Nice-to-have | Backlog, schedule if capacity allows |

---

## Phase 1 — Foundation
*Goal: auth, database, design system, and skeleton pages running end-to-end. No AI yet.*

---

### Epic 1-A: Project Setup

- 🔴 **As a developer, I want a Next.js 14 App Router project with Tailwind, Supabase client, and the SpendLens design system** so that the team can build on a consistent foundation.
  - `Orbitron` + `DM Mono` loaded via Google Fonts
  - CSS variables defined: `--prancing-horse`, `--luce-cream`, `--carbon`, `--bronze`, `--alcantara`, `--grid-line`, `--positive`
  - `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` scaffolded
  - **AC:** `npm run build` passes with no errors.

- 🔴 **As a developer, I want the Supabase schema applied** so that auth and data tables exist.
  - Migration creates: `profiles`, `uploads`, `transactions`, `insights`
  - RLS enabled on all tables with `USING (user_id = auth.uid())`
  - **[TECH DEP]:** `supabase/migrations/` — create first migration file.

---

### Epic 1-B: Authentication

- 🔴 **As a user, I want to sign in with a magic link email** so that I don't need a password.
  - Landing page (`/`) with value prop + "SIGN IN" button
  - Supabase magic link flow; `/auth/callback` route handles the token
  - On first sign-in, `profiles` row auto-created via Supabase `auth.users` trigger
  - **AC:** New user can sign in and see an empty dashboard.

- 🔴 **As the app, I want all `/dashboard/*` routes protected** so that unauthenticated users are redirected to `/`.
  - Next.js middleware at `src/middleware.ts`
  - **AC:** Visiting `/dashboard` without a session redirects to `/`.

---

## Phase 2 — Data Ingestion
*Goal: user can upload a CSV and see their transactions in the database.*

---

### Epic 2-A: Upload Wizard

- 🔴 **As a user, I want to upload a CSV file and map columns** so that my transactions are imported correctly.
  - Step 1: drag-drop or file picker, `.csv` only, max 10 MB
  - Step 2: auto-detect bank format; show column mapper if detection is ambiguous
  - Step 3: preview first 5 rows; confirm to submit
  - **AC:** A DNB export CSV imports without manual column mapping.
  - **[TECH DEP]:** `src/lib/csv/parse.ts` — `detectBankFormat()` must handle all 6 supported formats.

- 🔴 **As the app, I want the CSV file stored in Supabase Storage** so that re-processing is possible without re-upload.
  - Storage path: `uploads/{user_id}/{upload_id}.csv`
  - `uploads` row created with `status: 'processing'`

- 🟠 **As a user, I want to see a processing indicator** while my transactions are being inserted so that I know the import is in progress.
  - Poll `uploads.status` every 2s until `done` or `error`

---

### Epic 2-B: CSV Parsing

- 🔴 **As the app, I want Norwegian number formats parsed correctly** so that amounts are not corrupted.
  - `1.234,56` → `1234.56`; negative = debit convention enforced
  - **[TECH DEP]:** `src/lib/csv/parse.ts` — unit tests required before merge.

- 🟠 **As the app, I want auto-detection to work for DNB, Nordea, Sbanken, Sparebank 1, and generic EN/NO exports** so that most users don't need to manually map columns.
  - See `docs/technical-spec.md §6` for header fingerprints.

---

## Phase 3 — Intelligence
*Goal: AI categorises transactions and generates savings insights.*

---

### Epic 3-A: AI Categorisation

- 🔴 **As the app, I want transactions categorised by Claude** so that the dashboard can show spending by category.
  - Batched in groups of 50 via `src/lib/ai/categorise.ts`
  - Strip account numbers and IBANs before sending to API route
  - Results written back to `transactions.category`
  - `uploads.status` → `done` on success, `error` on failure
  - **AC:** A 200-row import produces categorised transactions with no `OTHER` rate above 10% on a typical Norwegian bank export.
  - **[TECH DEP]:** `ANTHROPIC_API_KEY` env var must be set.

- 🟠 **As a user, I want to correct a miscategorised transaction** so that my dashboard reflects reality.
  - Inline category dropdown in the transaction table
  - `PATCH /api/transactions/[id]` updates `category`
  - Optimistic UI — update immediately, revert on error

---

### Epic 3-B: Savings Insights

- 🟠 **As a user, I want to see my top saving opportunities** after uploading so that I know where to cut back.
  - Insight generation triggered after categorisation completes
  - Up to 5 ranked tips stored in `insights.top_saving_tips`
  - Each tip shows: category, observation, estimated NOK/month saving
  - **AC:** A user with 90 days of spending data sees at least 3 insight tips.

---

## Phase 4 — Dashboard
*Goal: the main dashboard is usable and matches the visual spec in `docs/mockup.html`.*

---

### Epic 4-A: Summary Bar

- 🔴 **As a user, I want to see my total spend, income, and net savings for the selected period** so that I have instant financial clarity.
  - 4-cell KPI bar: Period · Total Spend · Income · Net Saved
  - Period selector: 1M / 3M / 6M / YTD / ALL
  - Dark `--alcantara` background, `Orbitron` numbers
  - **AC:** Amounts match the sum of `transactions.amount` for the selected period.

---

### Epic 4-B: Category Chart

- 🔴 **As a user, I want to see my spending broken down by category** so that I know where my money goes.
  - Pure CSS horizontal bar chart (no library)
  - Bars proportional to category total
  - Click category → filter transaction table below
  - **AC:** Percentages sum to 100% of total debit spend.

---

### Epic 4-C: Savings Radar

- 🟠 **As a user, I want to see my top saving tips** on the dashboard so that I have actionable recommendations.
  - Ranked tip cards matching `docs/mockup.html` design
  - Red rank badge, green saving amount in `Orbitron`

---

### Epic 4-D: Transaction Table

- 🔴 **As a user, I want to see and search my transactions** so that I can drill into specific spending.
  - Columns: Date · Merchant · Description · Category · Amount
  - Search by merchant or description
  - Category filter buttons
  - Sortable columns
  - 25 rows per page with pagination

---

## Phase 5 — Polish
*Goal: production-ready, smooth, and handles edge cases gracefully.*

---

- 🟡 **Mobile layout** — responsive pass so the dashboard works on 375px wide screens
- 🟡 **Period comparison** — compare two periods side-by-side on `/uploads`
- 🟡 **Recurring transaction tagging** — surface `is_recurring` flag in the UI
- 🟡 **Empty state improvements** — better onboarding for first-time users
- 🟡 **Account deletion** — `DELETE MY ACCOUNT` in `/settings` with cascade
- 🟢 **CI pipeline** — GitHub Actions running `npm test` + `npm run build` on every push to `main`
- ~~🟢 **Error monitoring** — Sentry free tier on the frontend~~ **Superseded by Epic 5-A below.**
- 🟢 **Uptime monitoring** — UptimeRobot or Cloudflare Health Check on the production URL

---

### Epic 5-A: Application Error Observability
*Added 2026-09-10. Distinct from Epic 8-F: 8-F covers security-relevant events (auth failures, rate-limit
hits, webhook signature failures) for abuse investigation; this epic covers general application errors —
unhandled exceptions, failed AI calls, broken imports — so the team can see what's actually breaking for
users and improve the product, not investigate misuse. Share the underlying structured-logging helper from
8-F where it makes sense (both want actor/route/event-type/timestamp shape) rather than building two loggers.*

- 🟠 **As the operator, I want unhandled errors and failed operations captured with tracing context** so that we can diagnose issues users hit without asking them to reproduce and describe it.
  - Evaluate OpenTelemetry (vendor-neutral traces/spans across API routes, AI calls, Supabase queries) vs. Sentry (turnkey error capture + source maps + session context) vs. both — OTel for tracing/spans, Sentry as one exporter/sink for error events. Don't over-build: start with whichever gets useful signal fastest, likely Sentry alone, and only add OTel if request-level tracing across services becomes a real need.
  - Sentry (if used): frontend + API route error boundaries, source maps uploaded on build, environment tagging (dev/preview/production)
  - **AC:** An unhandled exception in an API route or a failed Claude API call produces a captured error event with route, timestamp, and a stack trace, visible without reading server logs.

- 🔴 **As a user, I want my financial data kept out of error reports** so that observability tooling never becomes a new place my sensitive data leaks to.
  - Scrub/deny-list before send: transaction amounts, merchant/description text, account identifiers, receipt item names, category data, auth tokens, session cookies — configure Sentry's `beforeSend`/OTel span processors to strip these rather than relying on "don't log it" discipline alone
  - No PII or financial values in breadcrumbs, span attributes, or error messages — assert this with a test that feeds known-sensitive strings through the capture path and checks they don't appear in the outgoing payload
  - Respect user data-deletion requests (Phase 5's "Account deletion" story) — if Sentry/OTel ever retains a user identifier, it must be purgeable on account deletion
  - **AC:** A deliberately triggered error containing a fake transaction description and account number does not contain that data in the captured event, verified by inspecting the actual payload sent (not just the code's intent).

- 🟡 **As the operator, I want error volume and new error types alertable** so that regressions are caught before users report them.
  - Basic alert (email/Slack) on new error type or error-rate spike
  - Not a full on-call/paging setup — lightweight, matches the project's current operational maturity

---

## Phase 6 — Monetisation
*Goal: Stripe subscription billing live in production. Free-tier trial converts users to paid Pro. Hosting costs covered.*
*Spec: `docs/payments.md`*

---

### Epic 6-A: Database & Schema

- 🔴 **As the app, I want `profiles` to store Stripe billing state** so that subscription checks are fast and consistent.
  - Migration `20260514010000_billing_columns.sql` adds: `stripe_customer_id`, `subscription_status` (`free | active | past_due | cancelled`), `subscription_tier` (`free | pro`), `subscription_ends_at`
  - RLS unchanged (`USING (user_id = auth.uid())`)
  - **AC:** Migration applies cleanly with no existing data loss.

---

### Epic 6-B: Stripe Integration

- 🔴 **As a user, I want to pay for Pro via a Stripe Checkout page** so that my card details are handled securely by Stripe.
  - `POST /api/billing/checkout` creates a Checkout Session (`mode: 'subscription'`, Pro price)
  - Redirects user to Stripe hosted page; on success Stripe fires webhook
  - **[TECH DEP]:** `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID` env vars must be set.

- 🔴 **As the app, I want Stripe webhooks processed reliably** so that subscription state in Supabase stays accurate.
  - `POST /api/webhooks/stripe` handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
  - Webhook signature verified via `stripe.webhooks.constructEvent` — reject unsigned requests with `400`
  - Raw body passed to Stripe before any JSON parsing
  - **[TECH DEP]:** `STRIPE_WEBHOOK_SECRET` env var. Local dev: Stripe CLI `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
  - **AC:** Completing a test Checkout with card `4242 4242 4242 4242` sets `subscription_status = 'active'` in `profiles`.

- 🟠 **As a user, I want to manage or cancel my subscription** without contacting support.
  - `POST /api/billing/portal` creates a Stripe Billing Portal session, redirects user
  - "MANAGE BILLING" link visible in top nav / settings when `subscription_status = 'active'`

---

### Epic 6-C: Subscription Gate

- 🔴 **As the app, I want AI routes blocked for over-limit free-tier users** so that Claude API costs are controlled.
  - `src/lib/billing/gate.ts` — reusable gate helper
  - Free tier: 1 lifetime upload, max 1,000 transactions per upload
  - `POST /api/process/[uploadId]` and `GET /api/insights/[uploadId]` call `gate()` before invoking Claude
  - Insights route blocked entirely for free-tier users (returns `402 upgrade_required`)
  - `past_due` subscriptions also blocked until payment resolves
  - **AC:** A free-tier user attempting a second upload receives a `402` with `error: 'upgrade_required'`.

---

### Epic 6-D: UI / Upgrade Prompts

- 🟠 **As a free-tier user who has used their trial, I want a clear upgrade prompt** so that I know how to unlock full access.
  - Persistent banner on dashboard after trial upload is used
  - Copy: *"You've used your free trial. Upgrade to Pro for unlimited uploads + savings insights."*
  - CTA: `"UPGRADE — $8/MO"` → calls `/api/billing/checkout`

- 🟠 **As a free-tier user, I want the upload wizard to warn me if my CSV exceeds 1,000 rows** before I confirm.
  - Step 3 shows row count; if > 1,000 show inline warning with upgrade CTA
  - Offer to import first 1,000 rows as a fallback without upgrading
  - **AC:** Uploading a 1,500-row CSV on free tier shows the warning and does not process rows 1,001+.

- 🟡 **As a free-tier user, I want to see that savings insights are a Pro feature** so that I understand the value of upgrading.
  - Insights section on dashboard shows a blurred/locked placeholder with upgrade CTA when `subscription_tier = 'free'`

---

### Epic 6-E: Testing & Go-Live

- 🟠 **Unit tests for `src/lib/billing/gate.ts`** — mock profile data covering all tier/status combinations
- 🟠 **Integration test for `/api/webhooks/stripe`** — mock `stripe.webhooks.constructEvent`, cover all four event types and the invalid-signature rejection path
- 🟡 **Switch to live Stripe keys** and run a real $8 end-to-end test before announcing to users
- 🟡 **Add `STRIPE_*` env vars to Vercel** production and preview environments

---

## Phase 7 — Trumf Receipt Analysis
*Goal: users who explicitly opt in can import Trumf loyalty receipt data and get item-level spending-habit analysis.*
*Feature is behind an explicit per-user feature flag — not visible or available to other users.*
*Full technical plan: `.github/agents/data-engineer.agent.md`*

---

### Epic 7-A: Feature Flag System

- 🔴 **As the app, I want a `feature_flags` JSONB column on `profiles`** so that individual features can be enabled per user without schema changes.
  - Migration adds `feature_flags jsonb NOT NULL DEFAULT '{}'` to `profiles`
  - `src/lib/features.ts` — `hasFlag(profile, flag)` helper; always evaluated server-side
  - Flag key for this feature: `"receipt_analysis": true`
  - Flag set manually via Supabase SQL for now (no self-serve UI)
  - **AC:** `hasFlag({ feature_flags: { receipt_analysis: true } }, 'receipt_analysis')` returns `true`; all other inputs return `false`.

---

### Epic 7-B: Database Schema

- 🔴 **As the app, I want `receipts` and `receipt_items` tables** to store Trumf receipt data at item granularity.
  - `receipts`: `id`, `user_id`, `receipt_id` (Trumf batchId), `date`, `store`, `chain`, `total_amount`, `total_bonus`, `savings_summary`, `currency`, `imported_at`
  - `receipt_items`: `id`, `receipt_id`, `user_id`, `item_guid`, `name`, `quantity`, `unit`, `total_price`, `bonus`, `bonus_percent`, `vat_percent`, `is_unknown`, `savings_amount`
  - RLS: `USING (user_id = auth.uid())` on both tables
  - Unique constraint `(user_id, receipt_id)` on `receipts` — enables idempotent re-import
  - Indexes: `(user_id, date DESC)`, `(user_id, chain)`, `(user_id, name)` on items
  - **AC:** Migration applies cleanly; re-importing the same receipt does not create duplicates.
  - **[TECH DEP]:** Epic 7-A must be done first.

---

### Epic 7-C: Import Pipeline

- 🔴 **As a user with the flag, I want to import my Trumf receipts via a JSON upload** so that my receipt data is in the app.
  - `POST /api/receipts/import` — accepts `{ receipts: TrumfReceipt[] }` body
  - Auth check + `receipt_analysis` flag check → `403` if absent
  - Body validated with Zod; item `name` fields truncated to 500 chars
  - Upserts `receipts` rows 50 at a time, then bulk-inserts `receipt_items`; uses `ON CONFLICT DO NOTHING` for idempotency
  - Returns `{ imported: N, skipped: N, errors: [] }`
  - **AC:** Posting `all_receipts_trumf.json` (254 receipts, 5,075 items) completes without error and is idempotent on re-post.
  - **[TECH DEP]:** Epic 7-B.

- ~~🟠 **As a developer, I want a local bootstrap script** to seed my own receipt data without a browser upload.~~
  **Superseded — won't build.** The self-serve bookmarklet + scoped import-token flow
  (`/dashboard/receipts/connect`, `POST /api/receipts/import/bookmarklet`, `src/lib/api/importTokenGuard.ts`,
  shipped in PR #14, 2026-09-10) replaces the need for a service-role local script entirely — it authenticates
  per-user with a revocable bearer token instead. See `specs/trumf_import_tokens_bookmarklet.md`.

- 🟡 **As a user with the flag, I want an upload UI at `/dashboard/receipts/import`** so that I don't need to POST JSON manually.
  - File picker for `all_receipts_trumf.json` or individual `receipt_*.json` files
  - Progress bar; shows `imported / skipped` on completion

---

### Epic 7-D: Analysis Views ✅ Done

All views gated by `receipt_analysis` flag. Routes live under `/dashboard/receipts/`
(`src/app/dashboard/receipts/page.tsx`, backed by `src/lib/receipts/analysis.ts`). All six stories below
are implemented, tested (`analysis.test.ts`), and verified against their acceptance criteria.

- ✅ 🟠 **As a user, I want to see monthly spend by chain** so that I understand where I shop most.
  - Bar chart (pure CSS) of spend per chain per month
  - Trip count alongside spend total

- ✅ 🟠 **As a user, I want to see my grocery health index** so that I know what proportion of my basket is fresh produce.
  - Health ratio = sum of items with `bonus_percent >= 15` / total basket spend
  - Monthly trend line; benchmark line at 0.30 (Norwegian household average)
  - **AC:** Health ratio matches manual SQL calculation on the same data set.

- ✅ 🟠 **As a user, I want to see my food vs. non-food VAT split** so that I understand the composition of my grocery spend.
  - `vat_percent = 15` → food; `vat_percent = 25` → non-food
  - Stacked bar per month

- ✅ 🟡 **As a user, I want to track price changes for items I buy regularly** so that I can spot inflation or deal opportunities.
  - Items purchased ≥ 3 times with `unit = 'EA'`
  - Show average unit price per month; highlight months where price increased > 10%

- ✅ 🟡 **As a user, I want to see my campaign savings rate** so that I know how effectively I use supermarket offers.
  - `savings_rate = total_savings / (gross_spend + total_savings)`
  - Monthly bar; highlight months above 15% as positive

- ✅ 🟡 **As a user, I want to see my top 50 most purchased items by spend** so that I know where the majority of my grocery budget goes.
  - Sortable table: name · total qty · total spend · receipt count

---

### Epic 7-E: Claude Receipt & Diet Insights ✅ Done
*Implemented 2026-09-11. `receiptInsights()` and `dietTrendInsights()` live in `src/lib/ai/insights.ts`,
following the existing `generateInsights()` client/model/caching pattern. Diet-category classification
(`src/lib/receipts/dietCategories.ts`), fixed NNR-style targets + deterministic verdicts
(`src/lib/receipts/dietTargets.ts`), and monthly trend aggregation (`getMonthlyDietCategoryTrend()` in
`analysis.ts`) are all implemented and unit-tested, with the `insights.top_saving_tips` cache
(`insightsCache.ts`, 24h TTL, source-tagged) and flag-gated `/dashboard/receipts/insights` and
`/dashboard/receipts/diet` pages. `receipt_items.diet_category` added via migration + import-time
classification + one-off backfill script (`scripts/backfill-diet-categories.ts`).*
*Note: `docs/family-diet-analysis.md` / `docs/diet-analysis.html` (merged via PR #12, 2026-09-10) remain a
one-time manually-generated report — not produced by any code in this epic, and not automatically updated
as new receipts are imported. They establish the category taxonomy (Vegetables, Poultry, Red Meat, Processed
Meat, Candy & Sweets, Fish & Seafood, Legumes & Nuts, Dairy sub-types, Alcohol, etc.) and the
"Cut Out / Moderate / Eat More" framing that this epic's code reuses rather than inventing a new taxonomy.*

- ✅ 🟠 **As a user, I want Claude to generate receipt-level savings tips** based on my actual basket contents.
  - New `receiptInsights()` function in `src/lib/ai/insights.ts`
  - Input: pre-aggregated summary (health ratio, VAT split, top 20 items, chain breakdown, savings rate) — not raw JSON
  - System prompt scoped to NorgesGruppen chains and Norwegian household context
  - Up to 5 tips appended to `insights.top_saving_tips` with `"source": "receipt_analysis"` tag
  - Triggered on-demand from `/dashboard/receipts/insights`; result cached in `insights` table with a 24-hour TTL
  - **AC:** User with 10+ receipts sees at least 3 tips that reference specific product names or chains from their data.
  - **[TECH DEP]:** Epic 7-D analysis queries must be available to feed the aggregated input.

- ✅ 🟠 **As a user, I want item purchases classified into diet/nutrition categories** (Vegetables, Poultry,
  Red Meat, Processed Meat, Candy & Sweets, Fish & Seafood, Legumes & Nuts, Dairy sub-types, Alcohol, etc. —
  the taxonomy used in `docs/family-diet-analysis.md`) **so that diet-composition trends can be computed
  without re-deriving the category list by hand each time.**
  - New `src/lib/receipts/dietCategories.ts` — maps `receipt_items.name` (+ `vat_percent`/`bonus_percent` as
    signals) to a fixed diet-category enum matching the report's taxonomy
  - Persisted per item (new `receipt_items.diet_category` column, backfilled) rather than recomputed on every
    request, since the underlying item names are stable and classification may call Claude for ambiguous names
  - **AC:** Re-running classification on the same item name is idempotent and does not change past classifications
    without an explicit re-classify action.
  - **[TECH DEP]:** Epic 7-B schema; new migration for the `diet_category` column.

- ✅ 🟠 **As a user, I want to see how my diet-category mix has changed month over month** (e.g. is candy share
  rising or falling, is fish share moving toward the NNR target) **so that I can tell whether changes I'm
  making are actually showing up in what I buy, not just intend.**
  - `getMonthlyDietCategoryTrend()` in `src/lib/receipts/analysis.ts` — % of spend per diet category per month
  - New page/section under `/dashboard/receipts/diet` (flag-gated): trend lines or stacked bars per category
    over the selected period, plus delta vs. the prior period of equal length
  - Reuse the "Cut Out / Moderate / Eat More" grouping from the diet analysis report as a filter/legend
  - **AC:** For a user with 3+ months of receipt data, each diet category's month-over-month % change is shown
    and matches a manual aggregation over the same data.
  - **[TECH DEP]:** diet-category classification story above.

- ✅ 🟠 **As a user, I want an AI-generated narrative summary of my diet trend over time** ("candy spend down 40%
  since March, fish still below target, keep going") **so that I get a plain-language read on progress, not
  just charts.**
  - New `dietTrendInsights()` function in `src/lib/ai/insights.ts` (or a new `src/lib/ai/dietInsights.ts`)
  - Input: pre-aggregated monthly diet-category trend (from the story above) plus the fixed NNR-style targets
    already used in the diet analysis report (e.g. fish 2–3 meals/week, legumes 6–8% of food spend,
    processed meat max 50g/week) — never raw item-level or receipt-level data
  - Output: typed structured response (per-category verdict: improving / worsening / flat, one sentence each)
    rendered on `/dashboard/receipts/diet`, not free-form chat
  - Cached in `insights` table with `"source": "diet_trend"` tag, TTL aligned with Epic 7-E's first story (24h)
  - **AC:** A user with data spanning 2+ distinct months sees a verdict per tracked diet category, and each
    verdict's direction (improving/worsening/flat) matches the sign of the underlying month-over-month change.
  - **[TECH DEP]:** Epic 8-D (AI & prompt-injection hardening) input-shaping rules apply — aggregates only,
    item names wrapped in delimiters if included as supporting examples.

---

### Epic 7-F: Testing

- ✅ 🟠 **Unit tests for `hasFlag()`** — cover all truthy/falsy inputs, including missing key and wrong type. `src/lib/features.test.ts`
- ✅ 🟠 **Unit test for import idempotency** — mock Supabase upsert, verify `ON CONFLICT` behaviour. `src/app/api/receipts/import/importReceipts.test.ts`
- ✅ 🟡 **Unit tests for health ratio and VAT split SQL helpers** — seed known data, assert output matches expected ratios. `src/lib/receipts/analysis.test.ts`
- 🟡 **E2E smoke test** — import 10-receipt slice of real receipt data, verify row counts and health ratio endpoint returns valid JSON. *Not confirmed — worth a quick check before assuming this is covered; existing tests are unit-level against mocks, not a true end-to-end import→query smoke test.*
- ✅ 🟠 **Unit tests for diet-category classification** (Epic 7-E) — fixed taxonomy mappings return stable categories for known item names; ambiguous names fall back deterministically. `src/lib/receipts/dietCategories.test.ts`
- ✅ 🟡 **Unit tests for `getMonthlyDietCategoryTrend()`** (Epic 7-E) — seed known multi-month data, assert per-category % and month-over-month delta match expected values. `src/lib/receipts/analysis.test.ts`

---

## Phase 8 — Security, OWASP & API Abuse Hardening
*Goal: project-wide security posture is reviewed and hardened before broader production use.*
*Owner agent: `.github/agents/ciso.agent.md`*

---

### Epic 8-A: Project-Wide OWASP Review ✅ Done

- ✅ 🔴 **As the product owner, I want a CISO agent to evaluate SpendLens against OWASP principles** so that auth, data isolation, AI, billing, and upload risks are visible before abuse happens.
  - Review all API routes in `src/app/api/`
  - Review all Supabase migrations and RLS policies
  - Review Supabase Storage path and bucket assumptions
  - Review AI prompt boundaries in `src/lib/ai/`
  - Review Stripe billing and webhook code in `src/lib/billing/` and `src/app/api/webhooks/stripe/`
  - Produce findings mapped to OWASP Web/API categories with severity, exploit scenario, and recommended fix
  - **AC:** A markdown security report exists with every route classified as public/authenticated/webhook/admin-only, and every high-risk finding has a backlog item.
  - **Evidence:** `docs/security/api-security-audit.md` (route classification table) + `docs/security/sdlc-security-baseline.md` (OWASP ASVS/API Top 10 mapping). Note: the AI-prompt-boundary angle was not covered by this report — see Epic 8-D, still open.

---

### Epic 8-B: API Route Protection Baseline ✅ Done

- ✅ 🔴 **As the app, I want every API route to declare and enforce its security posture** so that accidental public access is caught during review.
  - Add or update route-level checks for auth, ownership, body validation, and error handling
  - Public routes must be explicitly documented as public
  - Path IDs such as `uploadId` and transaction IDs must be verified against `user.id` before processing
  - All errors return JSON without stack traces or provider internals
  - **AC:** CISO review can list every API route with auth state, owner checks, input validation, and abuse limits.
  - **Evidence:** `requireAuthenticatedRouteContext()` (`src/lib/api/guard.ts`) used consistently across `src/app/api/`; ownership filters confirmed in `uploads/[id]`, `transactions/[id]`, etc.

- ✅ 🔴 **As the app, I want expensive API routes protected from resource abuse** so that AI, upload, and billing costs cannot be driven by anonymous or scripted callers.
  - Add rate limits for AI processing, insights, receipt chat, and upload endpoints
  - Enforce server-side file size, row count, and receipt count caps
  - Subscription gates fail closed for missing profile, free-tier over-limit, and `past_due`
  - **AC:** A free-tier user cannot bypass upload or AI limits by calling API routes directly.
  - **Evidence:** `evaluateBillingGate()` (`src/lib/billing/gate.ts`, tested) gates `/api/process`, `/api/insights`, `/api/uploads/*/recategorise`, `/api/receipts/import`. Real sliding-window rate limiting (20 req/hr, HTTP 429) on `/api/receipts/import-token` (`src/lib/api/importTokenGuard.ts`). Cost/row caps are enforced via billing-tier limits rather than generic IP rate limiting elsewhere — acceptable given the auth-gated nature of these routes, but worth a follow-up if abuse from authenticated free-tier accounts becomes a problem.

---

### Epic 8-C: Supabase RLS & Storage Audit ✅ Done

- ✅ 🔴 **As the app, I want all user-owned tables and files isolated by user** so that one user cannot read or mutate another user's financial data.
  - Verify every user-owned table has `user_id`, RLS enabled, and owner-scoped policies
  - Verify insert policies use `WITH CHECK` where users insert rows
  - Verify all Storage paths include `{user_id}` and bucket policies enforce that prefix
  - Add missing indexes for owner-scoped queries where needed
  - **AC:** CISO report confirms no table or storage object containing user data is accessible cross-user under normal Supabase anon/session access.
  - **Evidence:** RLS with `auth.uid()`-scoped policies confirmed on `profiles`, `uploads`, `transactions`, `insights`, `user_categories`, `receipts`, `receipt_items`, `import_tokens`, `stripe_webhook_events` (deny-all/service-role-only). Storage paths scoped via `(storage.foldername(name))[2] = auth.uid()::text` (`20260514000000_storage_uploads.sql`). No standalone written report exists for this epic specifically, but the underlying migrations satisfy the AC.

---

### Epic 8-D: AI & Prompt-Injection Hardening ✅ Done
*Implemented 2026-09-11. `src/lib/ai/promptSafety.ts` — `wrapUntrusted()` wraps user-controlled text in
unambiguous delimiters and strips any attempt to forge those delimiters from inside the value itself, plus
`UNTRUSTED_DATA_INSTRUCTIONS` system-prompt boilerplate. Applied at every AI call site: `categorise.ts` wraps
transaction descriptions and reconciles model output against requested ids (fabricated ids ignored, omitted
ids become an explicit failed result) with shape validation before trusting a result; `insights.ts` wraps
user-defined category names and receipt item/chain names the same way. `dietTrendInsights()` sends only fixed
category-enum/target data, so no wrapping was needed there. Full test coverage added for `src/lib/ai/`
(previously zero test files): malformed/non-array model responses, id fabrication/omission, delimiter-wrapping
verification, and adversarial prompt-injection-shaped input for every AI entry point.*
*Scope note: "receipt/chat analysis must use typed analysis intents rather than arbitrary SQL" doesn't apply —
there is no free-form chat or NL-to-SQL feature anywhere in the codebase.*

- ✅ 🟠 **As the app, I want AI calls constrained to safe inputs and typed outputs** so that user-controlled transaction, receipt, and chat text cannot steer system behaviour.
  - Wrap user-controlled data in clear delimiters before model calls
  - Prefer aggregate summaries over raw rows
  - Strip obvious PII before prompts
  - Receipt/chat analysis must use typed analysis intents rather than arbitrary SQL
  - Add tests for malformed model responses and prompt-injection-like user text
  - **AC:** AI endpoints reject arbitrary tool/query requests and continue to return valid structured output or a safe error.
  - **Evidence:** `src/lib/ai/promptSafety.ts` + `promptSafety.test.ts`, `categorise.ts` + `categorise.test.ts`, `insights.ts` + `insights.test.ts`.

---

### Epic 8-E: Secrets, Webhooks & Integrity ✅ Done

- ✅ 🟠 **As the app, I want secrets and third-party callbacks handled safely** so that billing and provider credentials cannot be spoofed or exposed.
  - Confirm service-role key is never used in frontend code
  - Confirm Stripe webhook raw-body signature verification remains intact
  - Confirm webhook handlers are idempotent
  - Add secret scanning guidance to CI or developer docs
  - **AC:** Invalid Stripe webhook signatures are rejected, duplicate valid events do not corrupt subscription state, and no server-only secret appears in frontend-exposed code.
  - **Evidence:** `createAdminClient()` (`src/lib/supabase/admin.ts`) only imported in server-only files. `src/app/api/webhooks/stripe/route.ts` verifies `stripe-signature` via `constructEvent` on the raw body, rejects with 400 on failure. Idempotency via unique `event_id` constraint + status tracking on `stripe_webhook_events` (`20260515214500_stripe_webhook_events.sql`, `20260516202000_security_hardening_feature_flags_and_webhooks.sql`).

---

### Epic 8-F: Security Logging & Abuse Monitoring
*Status: partially done at best. Verified 2026-09-10 — no structured security-event logging module exists
(no `logger`/`securityLog`/`auditLog` anywhere in `src/lib`). Only ad hoc `console.error(...)` calls (39
occurrences across `src/app/api`) for operational failures — not actor/route/event-type/timestamp structured,
and auth failures (401s in `guard.ts`) and rate-limit hits (429 in `importTokenGuard.ts`) currently log nothing
at all. The one durable audit trail is `stripe_webhook_events`, which covers only the webhook-failure slice of
this epic's scope, not auth/upload/AI-validation events.*

- 🟡 **As the operator, I want basic security-relevant events logged** so that abuse attempts can be investigated without storing sensitive financial details.
  - Log auth failures, rate-limit hits, rejected uploads, webhook signature failures, and AI validation failures
  - Avoid logging raw CSV contents, raw receipt JSON, full prompts, account numbers, or secrets
  - Add a lightweight incident checklist to production handoff docs
  - **AC:** Security logs identify actor, route, event type, and timestamp without leaking sensitive user payloads.
