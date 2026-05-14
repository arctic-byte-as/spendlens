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
