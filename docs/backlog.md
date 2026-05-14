# SpendLens — Product Backlog

> **Living document.** Owner: CPO. Last updated: 2026-05-14.
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
- 🟢 **Error monitoring** — Sentry free tier on the frontend
- 🟢 **Uptime monitoring** — UptimeRobot or Cloudflare Health Check on the production URL

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
