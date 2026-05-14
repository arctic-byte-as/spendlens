# SPENDLENS — Product Specification

### Personal Finance Intelligence · v1.0

-----

## OVERVIEW

**SpendLens** is a privacy-first personal finance web app that ingests CSV bank transaction exports, uses AI to categorise spending, and surfaces high-impact savings recommendations. Built for a primary owner with optional friend access, each user’s data is fully isolated.

Aesthetic direction: **NASA Future + Ferrari Luce** — clean uppercase letterforms, warm Italian luxury tones (cream, deep red, aged bronze), precision layout with generous negative space. Feels like a mission control dashboard inside a Maranello interior.

-----

## DESIGN SYSTEM

### Typography

- **Display / Headers**: `Orbitron` (Google Fonts) — uppercase only, wide tracking. Closest freely available match to NASA Future.
- **Body / Labels**: `DM Mono` — clean, clinical, readable at small sizes.
- **Accent numbers**: `Orbitron` tabular numbers for all financial figures.

### Colour Palette

```
--prancing-horse:   #C8102E   /* Ferrari rosso — primary accent */
--luce-cream:       #F5F0E8   /* warm off-white — main background */
--carbon:           #1A1A1A   /* near-black — primary text */
--bronze:           #8B6914   /* aged bronze — secondary accent */
--alcantara:        #2C2C2C   /* dark panel backgrounds */
--grid-line:        #E0D9CE   /* subtle warm dividers */
--positive:         #2D6A4F   /* savings / positive delta */
--warning:          #C8102E   /* overspend — reuses prancing horse */
```

### Layout Principles

- Full-bleed cream background, content max-width `1200px`, centred.
- Uppercase labels everywhere. No sentence case in UI chrome.
- Thin `1px` warm grid lines instead of cards/shadows.
- Numbers always right-aligned, monospaced.
- Minimal motion: subtle 150ms fade-ins on data load only.

-----

## ARCHITECTURE

```
Frontend  →  Next.js 14 (App Router, TypeScript)
Auth      →  Supabase Auth (email + magic link)
Database  →  Supabase Postgres (Row-Level Security enforced)
AI        →  Anthropic Claude API (`ANTHROPIC_MODEL`, default `claude-sonnet-4-6`)
Hosting   →  Vercel
Storage   →  Supabase Storage (raw CSV files, per-user bucket)
```

-----

## DATA MODEL

### `profiles`

```sql
id          uuid  references auth.users primary key
email       text
display_name text
created_at  timestamptz default now()
```

### `uploads`

```sql
id           uuid primary key default gen_random_uuid()
user_id      uuid references profiles(id) on delete cascade
filename     text
uploaded_at  timestamptz default now()
row_count    int
status       text  -- 'processing' | 'done' | 'error'
storage_path text  -- Supabase Storage path
```

### `transactions`

```sql
id              uuid primary key default gen_random_uuid()
user_id         uuid references profiles(id) on delete cascade
upload_id       uuid references uploads(id) on delete cascade
date            date
description     text
amount          numeric(12,2)   -- negative = debit, positive = credit
currency        text default 'NOK'
category        text            -- AI-assigned
subcategory     text            -- AI-assigned
merchant        text            -- AI-normalised merchant name
is_recurring    boolean default false
notes           text            -- user-editable
created_at      timestamptz default now()
```

### `insights`

```sql
id              uuid primary key default gen_random_uuid()
user_id         uuid references profiles(id) on delete cascade
upload_id       uuid references uploads(id)
generated_at    timestamptz default now()
period_start    date
period_end      date
summary_json    jsonb   -- full AI analysis blob
top_saving_tips jsonb   -- ordered array of saving recommendations
```

### Row-Level Security (RLS)

All tables enforce:

```sql
USING (user_id = auth.uid())
```

No user can read another user’s data. RLS enabled on every table. No service-role bypass in frontend.

-----

## USER FLOWS

### 1. Authentication

- Landing page with one-line value prop + “SIGN IN” button.
- Supabase magic link (email) — no passwords.
- On first sign-in, `profiles` row auto-created via Supabase trigger.
- Session persisted via Supabase JS client (httpOnly cookie in Next.js middleware).

### 2. CSV Upload

1. User lands on `/dashboard` — prompted to upload if no data.
1. Drag-and-drop or file picker, accepts `.csv` only.
1. Client-side CSV parse (Papa Parse) → preview table (first 5 rows).
1. User maps columns: `date`, `description`, `amount` (required); `currency` (optional).
1. On confirm: file uploaded to Supabase Storage, `uploads` row created.
1. Server Action processes rows → inserts into `transactions`.
1. AI categorisation job triggered (see below).

**Supported CSV formats** (auto-detected by header sniffing):

- DNB, Nordea, Sbanken, Sparebank 1, generic EN/NO exports.

### 3. AI Categorisation

- Batched: transactions sent to Claude API in groups of 50.
- System prompt instructs Claude to return structured JSON per transaction:
  
  ```json
  {
    "category": "FOOD & DRINK",
    "subcategory": "RESTAURANTS",
    "merchant": "McDonald's",
    "is_recurring": false
  }
  ```
- Categories (top-level):
  `HOUSING · TRANSPORT · FOOD & DRINK · GROCERIES · HEALTH · SUBSCRIPTIONS · SHOPPING · TRAVEL · SAVINGS & INVESTMENTS · INCOME · FEES · OTHER`
- Results written back to `transactions` table.
- `uploads.status` updated to `done`.

### 4. Dashboard

Single-page layout with four zones:

#### A — SUMMARY BAR (top, full width)

```
PERIOD: JAN–MAR 2025   |   TOTAL SPEND: 47,320 NOK   |   INCOME: 62,400 NOK   |   NET: +15,080 NOK
```

#### B — CATEGORY BREAKDOWN (left, 60%)

- Horizontal bar chart per category.
- Bars rendered in CSS (no chart library dependency).
- % of total spend labelled right-aligned.
- Click to expand → transaction list for that category.

#### C — SAVINGS RADAR (right, 40%)

- Ordered list of AI-generated saving tips, e.g.:
  
  ```
  #1  SUBSCRIPTIONS   — 4 overlapping streaming services  →  SAVE ~890 NOK/MO
  #2  FOOD & DRINK    — 23 restaurant visits this month   →  COOK 3× MORE / SAVE ~2,100 NOK/MO
  ```
- Each tip expandable with specific transactions cited.

#### D — TRANSACTION TABLE (bottom)

- Sortable by date / amount / category.
- Inline category edit (user can correct AI categorisation).
- Search / filter bar.
- Pagination, 25 rows per page.

### 5. Multi-Upload / History

- `/uploads` page lists all previous imports.
- User can compare two periods side-by-side.
- Delete upload → cascades to transactions + insights.

-----

## PRIVACY & MULTI-USER

|Concern               |Solution                                                                                                                             |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------|
|Friends trying the app|They sign up with their own email. RLS means zero data crossover.                                                                    |
|Your data vs theirs   |Completely separate `user_id` partitioning at DB level.                                                                              |
|CSV files             |Stored in per-user prefixed Storage bucket paths: `uploads/{user_id}/{upload_id}.csv`                                                |
|AI processing         |Raw transaction descriptions sent to Anthropic API. No user PII in prompts — strip account numbers, IBANs client-side before sending.|
|Session security      |Supabase JWT, 1hr expiry, refresh token rotation. Next.js middleware protects all `/dashboard/*` routes.                             |
|Account deletion      |Supabase `on delete cascade` removes all user data. Add “DELETE MY ACCOUNT” in settings.                                             |

-----

## PAGE MAP

```
/                       Landing + sign-in
/auth/callback          Magic link handler
/dashboard              Main view (redirects to /upload if no data)
/upload                 CSV import wizard
/uploads                Import history
/transactions           Full transaction table
/settings               Profile, delete account
```

-----

## COMPONENT BREAKDOWN

```
<TopNav />              Logo · nav links · user avatar
<SummaryBar />          Period selector + 4 KPI cells
<CategoryChart />       CSS bar chart, clickable
<SavingsTips />         Ranked recommendations list
<TransactionTable />    Sortable, filterable, editable inline
<UploadWizard />        Step 1: upload → Step 2: map columns → Step 3: confirm
<ColumnMapper />        Dropdown column assignment UI
<InsightCard />         Single saving recommendation
<AuthGate />            Next.js middleware wrapper
```

-----

## API ROUTES / SERVER ACTIONS

|Route                     |Method|Purpose                                                 |
|--------------------------|------|--------------------------------------------------------|
|`/api/upload`             |POST  |Receive CSV, store in Supabase Storage, queue processing|
|`/api/process/[uploadId]` |POST  |Parse CSV, insert transactions, run AI categorisation   |
|`/api/insights/[uploadId]`|GET   |Return latest insight JSON for an upload                |
|`/api/transactions/[id]`  |PATCH |Update category / notes on a single transaction         |

-----

## NON-GOALS (v1.0)

- No bank API / Open Banking integration (CSV only).
- No budget-setting or goal tracking.
- No mobile app (responsive web only).
- No shared views between users.
- No export / reporting PDF.

-----

## BUILD ORDER

```
Phase 1 — Foundation
  ✦ Next.js + Supabase project setup
  ✦ Auth flow (magic link)
  ✦ DB schema + RLS policies
  ✦ Design system (CSS variables, fonts, base components)

Phase 2 — Data Ingestion
  ✦ Upload wizard + column mapper
  ✦ CSV parse + transaction insert
  ✦ Upload history page

Phase 3 — Intelligence
  ✦ Claude categorisation pipeline
  ✦ Savings insight generation
  ✦ Inline category correction

Phase 4 — Dashboard
  ✦ Summary bar
  ✦ Category chart
  ✦ Savings radar
  ✦ Transaction table

Phase 5 — Polish
  ✦ Norwegian bank CSV auto-detection
  ✦ Period comparison
  ✦ Settings + account deletion
  ✦ Responsive layout
```

-----

## ENV VARIABLES

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-side only, never exposed to client
ANTHROPIC_API_KEY=              # server-side only
ANTHROPIC_MODEL=claude-sonnet-4-6
```

-----

*SPENDLENS — precision over noise.*
