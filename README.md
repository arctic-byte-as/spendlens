# SpendLens

> Privacy-first personal finance intelligence — upload your bank CSV, get AI-powered spending insights.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20DB-green?logo=supabase)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)

---

## Overview

SpendLens ingests CSV bank transaction exports, uses Claude AI to categorise spending, and surfaces high-impact savings recommendations on a mission-control-style dashboard. Each user's data is fully isolated via Supabase Row-Level Security.

**Key features**

- Magic-link sign-in — no passwords
- Auto-detects DNB, Nordea, Sbanken, Sparebank 1 and generic CSV formats
- AI categorisation (Claude `claude-sonnet-4-20250514`) batched at 50 transactions
- CSS-only category bar chart — zero chart library dependencies
- Inline category correction and transaction notes
- Full data isolation per user (Postgres RLS on every table)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Auth | Supabase Auth (email magic link) |
| Database | Supabase Postgres + Row-Level Security |
| AI | Anthropic Claude API |
| Storage | Supabase Storage (per-user CSV bucket) |
| Hosting | Vercel |

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/arctic-byte-as/spendlens.git
cd spendlens
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 3. Apply database migrations

In the Supabase dashboard → **SQL Editor**, run the migration file:

```
supabase/migrations/20260101000000_initial_schema.sql
```

This creates the `profiles`, `uploads`, `transactions` and `insights` tables with RLS policies and the auto-profile trigger.

### 4. Configure Supabase Storage

Create a storage bucket named **`uploads`** in your Supabase project (Storage → New bucket). Set it to **private**.

### 5. Configure Supabase Auth

In Supabase → Authentication → URL Configuration, set:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: `http://localhost:3000/auth/callback`

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Jest) |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Landing / sign-in
│   ├── auth/callback/            # Magic link PKCE handler
│   ├── dashboard/                # Main dashboard
│   ├── upload/                   # CSV upload wizard
│   ├── uploads/                  # Import history
│   ├── transactions/             # Full transaction table
│   ├── settings/                 # Profile + account deletion
│   └── api/
│       ├── upload/               # POST — store CSV, create upload row
│       ├── process/[uploadId]/   # POST — parse, insert, AI categorise
│       ├── insights/[uploadId]/  # GET  — fetch insight JSON
│       └── transactions/[id]/    # PATCH — update category / notes
├── components/
│   ├── TopNav.tsx
│   ├── UploadWizard.tsx
│   └── ColumnMapper.tsx
└── lib/
    ├── supabase/
    │   ├── server.ts             # SSR Supabase client
    │   └── client.ts             # Browser Supabase client
    ├── csv/
    │   └── parse.ts              # Bank format detection + parsing
    └── ai/
        ├── categorise.ts         # Claude categorisation pipeline
        └── insights.ts           # Savings insight generation
```

---

## Deployment (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Add all environment variables from `.env.local.example` in the Vercel project settings.
3. In Supabase → Authentication → URL Configuration, add your Vercel production URL to **Redirect URLs** (e.g. `https://spendlens.vercel.app/auth/callback`).
4. Deploy — Vercel picks up Next.js automatically.

---

## Documentation

| Document | Description |
|---|---|
| [`docs/technical-spec.md`](docs/technical-spec.md) | Full technical specification |
| [`docs/product-spec.md`](docs/product-spec.md) | Product specification and user flows |
| [`docs/backlog.md`](docs/backlog.md) | Feature backlog by phase |
| [`docs/test-plan.md`](docs/test-plan.md) | Test plan and coverage guide |

---

## Supported Bank CSV Formats

SpendLens auto-detects the following formats by sniffing CSV headers:

| Bank | Detection headers |
|---|---|
| DNB | `Dato`, `Tekst`, `Belop` |
| Nordea | `Bokforingsdato`, `Belop`, `Avsender` |
| Sbanken | `Dato`, `Beskrivelse`, `Belop` (Sbanken variant) |
| Sparebank 1 | `Dato`, `Forklaring`, `Rentedato`, `Ut fra konto`, `Inn pa konto` |
| Generic EN | `Date`, `Description`, `Amount` |
| Generic NO | `Dato`, `Beskrivelse`, `Belop` |

---

## Privacy

- No user PII is sent to the Anthropic API — account numbers and IBANs are stripped client-side before any AI call.
- All data is partitioned by `user_id` with Postgres RLS (`USING (user_id = auth.uid())`).
- CSV files are stored in per-user prefixed storage paths (`uploads/{user_id}/{upload_id}.csv`).

---

*SpendLens — precision over noise.*
