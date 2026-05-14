# SpendLens — Project Guidelines

## What This Is
A privacy-first personal finance web app. Users upload CSV bank exports, AI categorises spending, and the dashboard surfaces high-impact savings recommendations. Primary user is the owner; friends can sign up with full data isolation via RLS.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Auth**: Supabase Auth (email magic link)
- **Database**: Supabase Postgres with Row-Level Security on every table
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`) — categorisation + savings insights
- **CSV parsing**: Papa Parse (client-side)
- **Hosting**: Vercel
- **Storage**: Supabase Storage (raw CSV files, per-user prefix)

## Key Files
- `src/app/dashboard/page.tsx` — main dashboard view (summary bar, category chart, savings radar, transaction table)
- `src/app/upload/page.tsx` — CSV upload wizard (upload → column map → confirm)
- `src/lib/ai/categorise.ts` — Claude categorisation pipeline (batched, 50 transactions at a time)
- `src/lib/ai/insights.ts` — Claude savings insight generation
- `src/lib/supabase/server.ts` — server-side Supabase client (Next.js App Router)
- `src/lib/supabase/client.ts` — browser-side Supabase client
- `src/lib/csv/parse.ts` — CSV parsing + auto-detection of bank formats
- `supabase/migrations/` — all schema changes (never edit DB directly)
- `docs/technical-spec.md` — full technical specification
- `docs/backlog.md` — product backlog (Phase 1 foundation → Phase 5 polish)

## Build & Test
```sh
npm run dev       # Start Next.js dev server (http://localhost:3000)
npm test          # Run unit tests (Jest / Vitest)
npm run build     # Production build
npm run lint      # ESLint
```

## Critical Domain Knowledge
- All monetary values must use the currency stored per transaction (`currency` column, default `NOK`). Never hardcode a symbol.
- Transaction amounts: **negative = debit (spending), positive = credit (income)**. This is the DB convention — do not invert.
- AI categorisation is batched in groups of **50 transactions**. Do not send the full set in a single prompt.
- Strip account numbers and IBANs from transaction descriptions **client-side** before sending to the Claude API.
- Categories (top-level, uppercase): `HOUSING · TRANSPORT · FOOD & DRINK · GROCERIES · HEALTH · SUBSCRIPTIONS · SHOPPING · TRAVEL · SAVINGS & INVESTMENTS · INCOME · CREDIT CARD · FEES · OTHER`
- The design system is **NASA Future + Ferrari Luce** — see `docs/technical-spec.md §2` for colour tokens and typography rules.

## Conventions
- App Router only — no `pages/` directory
- Server Components by default; add `"use client"` only when browser APIs or interactivity require it
- All DB queries go through the server-side Supabase client (never the anon client from server components)
- No chart libraries — category bars are pure CSS
- Supabase RLS must cover every table; never use service-role key in the frontend
- CSV auto-detection via header sniffing: DNB, Nordea, Sbanken, Sparebank 1, generic EN/NO exports
