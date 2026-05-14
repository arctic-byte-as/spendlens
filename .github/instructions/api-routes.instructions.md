---
description: "Use when working on Next.js API routes, Server Actions, or any server-side data handling in src/app/api/ or src/lib/supabase/."
applyTo: "src/app/api/**"
---

# API Route Guidelines

## Route Map

| Route | Method | Purpose |
|---|---|---|
| `/api/upload` | POST | Receive CSV, store in Supabase Storage, create `uploads` row |
| `/api/process/[uploadId]` | POST | Parse CSV, insert transactions, trigger AI categorisation |
| `/api/insights/[uploadId]` | GET | Return latest insight JSON for an upload |
| `/api/transactions/[id]` | PATCH | Update `category` or `notes` on a single transaction |

## Auth
Every API route must verify the Supabase session. Use the server-side Supabase client:

```ts
import { createServerClient } from '@/lib/supabase/server'

const supabase = createServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return new Response('Unauthorized', { status: 401 })
```

Never use the anon client in API routes — it bypasses session context needed by RLS.

## File Upload (`/api/upload`)
- Validate: `.csv` extension, content-type `text/csv`, max size 10 MB
- Store at `uploads/{user.id}/{uploadId}.csv` in Supabase Storage
- Create `uploads` row with `status: 'processing'`
- Return `{ uploadId }` — client then calls `/api/process/[uploadId]`
- Reject with 400 if file is not `.csv`, 413 if over size limit

## Processing (`/api/process/[uploadId]`)
- Verify the `uploads` row belongs to `user.id` before processing
- Parse CSV server-side with Papa Parse (already installed)
- Insert all transactions in a single `supabase.from('transactions').insert(rows)` call
- Trigger `src/lib/ai/categorise.ts` — this is async, update `uploads.status` to `done` or `error`
- On partial failure: set `uploads.status = 'error'`, log the batch index that failed

## Transaction PATCH (`/api/transactions/[id]`)
- Only allow updating `category` and `notes` — reject any other fields
- Validate `category` is in the canonical list before writing
- RLS enforces ownership — but still verify `user_id = user.id` before the update as defence-in-depth

## Error Responses
All errors return JSON: `{ error: string }` with appropriate HTTP status code.
No stack traces or internal error messages in responses — log server-side only.
