# SpendLens — Technical Specification

| Field | Value |
|---|---|
| Status | Living document |
| Last updated | 2026-05-14 |
| Primary model | `ANTHROPIC_MODEL`, default `claude-sonnet-4-6` |

---

## 1. Overview

SpendLens is a privacy-first personal finance web app. Users upload CSV bank transaction exports, Claude AI categorises spending, and the dashboard surfaces ranked savings recommendations. The primary user is the owner; friends can sign up with full data isolation via Supabase Row-Level Security.

Design aesthetic: **NASA Future + Ferrari Luce** — see §2 for colour tokens and typography.

---

## 2. Design System

### Colour Tokens

```css
--prancing-horse: #C8102E   /* Ferrari rosso — primary accent, CTA, warning */
--luce-cream:     #F5F0E8   /* warm off-white — main background */
--carbon:         #1A1A1A   /* near-black — primary text */
--bronze:         #8B6914   /* aged bronze — secondary accent, category labels */
--alcantara:      #2C2C2C   /* dark panel backgrounds (summary bar) */
--grid-line:      #E0D9CE   /* subtle warm dividers */
--positive:       #2D6A4F   /* savings, income, net positive */
--warning:        #C8102E   /* overspend — reuses prancing-horse */
```

### Typography

- **Display / Headers**: `Orbitron` (Google Fonts) — uppercase only, `letter-spacing: 0.2–0.3em`
- **Body / Labels**: `DM Mono` — clinical, readable at small sizes
- **Financial figures**: `Orbitron` tabular numbers, right-aligned

### Layout
- Full-bleed cream background, `max-width: 1200px`, centred
- Thin `1px` warm grid lines instead of cards or drop shadows
- Numbers right-aligned, monospaced
- Minimal motion: 150ms fade-in on data load only

**Visual reference**: `docs/mockup.html` — the canonical HTML/CSS mockup of the dashboard.

---

## 3. Architecture

```
┌─────────────────────────────────────┐
│  Browser (Next.js 14 App Router)     │
│                                      │
│  Server Components → DB queries      │
│  Client Components → interactivity   │
│  Papa Parse → CSV parsing            │
└───────────────┬─────────────────────┘
                │ Server Actions / API Routes
                ▼
┌─────────────────────────────────────┐
│  Next.js API Routes                  │
│                                      │
│  /api/upload       → Supabase Storage│
│  /api/process/[id] → AI pipeline     │
│  /api/insights/[id]→ insight fetch   │
│  /api/transactions/[id] → PATCH      │
└───────────────┬─────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
┌──────────────┐  ┌─────────────────┐
│  Supabase     │  │  Anthropic API   │
│  Postgres     │  │  claude-sonnet-4 │
│  Storage      │  │  -20250514       │
│  Auth         │  └─────────────────┘
└──────────────┘
```

---

## 4. Data Model

### `profiles`
```sql
id           uuid  references auth.users primary key
email        text
display_name text
feature_flags jsonb default '{}' -- per-user feature toggles, e.g. {"receipt_analysis": true}
created_at   timestamptz default now()
```

### `uploads`
```sql
id           uuid primary key default gen_random_uuid()
user_id      uuid references profiles(id) on delete cascade
filename     text
uploaded_at  timestamptz default now()
row_count    int
status       text  -- 'processing' | 'done' | 'error'
storage_path text  -- 'uploads/{user_id}/{upload_id}.csv'
```

### `transactions`
```sql
id           uuid primary key default gen_random_uuid()
user_id      uuid references profiles(id) on delete cascade
upload_id    uuid references uploads(id) on delete cascade
date         date
description  text
amount       numeric(12,2)   -- negative = debit, positive = credit
currency     text default 'NOK'
category     text            -- AI-assigned, user-editable
subcategory  text
merchant     text
is_recurring boolean default false
notes        text
created_at   timestamptz default now()
```

### `insights`
```sql
id              uuid primary key default gen_random_uuid()
user_id         uuid references profiles(id) on delete cascade
upload_id       uuid references uploads(id)
generated_at    timestamptz default now()
period_start    date
period_end      date
summary_json    jsonb
top_saving_tips jsonb  -- ordered array of saving recommendations
```

### RLS Policy (applied to all tables)
```sql
USING (user_id = auth.uid())
```

---

## 5. AI Pipeline

### Categorisation (`src/lib/ai/categorise.ts`)

- Model: configured by `ANTHROPIC_MODEL`; default `claude-sonnet-4-6`
- Batch size: **50 transactions** (hard limit — do not increase)
- Input: JSON array of `{ id, description, amount }`
- Output: JSON array of `{ id, category, subcategory, merchant, is_recurring }`
- Pre-flight: strip account numbers and IBANs client-side before sending to the server
- Unknown categories normalised to `OTHER`

**Category taxonomy** (uppercase):
`HOUSING · TRANSPORT · FOOD & DRINK · GROCERIES · HEALTH · SUBSCRIPTIONS · SHOPPING · TRAVEL · SAVINGS & INVESTMENTS · INCOME · CREDIT CARD · FEES · OTHER`

### Insights (`src/lib/ai/insights.ts`)

- Triggered after categorisation completes
- Input: aggregated category totals (not raw transactions)
- Output: ranked `top_saving_tips` array stored in `insights` table
- Each tip: `{ category, title, saving_amount, evidence }`

---

## 6. CSV Parsing

### Supported formats (auto-detected by header sniffing)
| Bank | Key headers |
|---|---|
| DNB | `Dato`, `Forklaring`, `Ut fra konto`, `Inn på konto` |
| Nordea | `Dato`, `Betalingstype`, `Tekst`, `Beløp` |
| Sbanken | `Dato`, `Til konto`, `Fra konto`, `Tekst`, `Beløp` |
| Sparebank 1 | `Dato`, `Beskrivelse`, `Beløp`, `Saldo` |
| Generic EN | `Date`, `Description`, `Amount` |
| Generic NO | `Dato`, `Beskrivelse`, `Beløp` |

### Amount convention
- Norwegian format: `1.234,56` (period thousands, comma decimal)
- **Negative = debit (spending), positive = credit (income)** — enforced at parse time

---

## 7. Page Map

```
/                       Landing + sign-in
/auth/callback          Magic link handler
/dashboard              Main view (redirects to /upload if no data)
/dashboard/receipts     Receipt analysis workspace (feature-flagged: receipt_analysis)
/upload                 CSV import wizard (3 steps)
/uploads                Import history
/transactions           Full transaction table
/settings               Profile, delete account
```

---

## 8. Environment Variables

### Public (safe to expose)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

### Server-only
| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |

---

## 9. Build & Test

```sh
npm run dev       # http://localhost:3000
npm test          # unit tests
npm run build     # production build
npm run lint      # ESLint
```

---

## 10. Privacy & Security

| Concern | Solution |
|---|---|
| Multi-user data isolation | RLS `USING (user_id = auth.uid())` on every table |
| CSV file isolation | Storage paths: `uploads/{user_id}/{upload_id}.csv` |
| AI prompt safety | Strip account numbers/IBANs client-side before API route; never include user PII in prompts |
| Session security | Supabase JWT, 1hr expiry, refresh token rotation; Next.js middleware protects `/dashboard/*` |
| Account deletion | `ON DELETE CASCADE` removes all user data; surfaced in `/settings` |

---

## 11. Known Issues / Open Questions

- No error recovery if AI categorisation fails mid-batch (`uploads.status` may stick at `processing`)
- No budget targets or goal tracking (v1 non-goal)
- Mobile layout is desktop-first only — responsive design pass needed
- No period-over-period comparison in dashboard yet
