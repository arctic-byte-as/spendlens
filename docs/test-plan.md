# SpendLens — Test Plan

| Field | Value |
|---|---|
| Status | Living document |
| Last updated | 2026-05-14 |
| Test runner | Jest (unit), manual (integration + E2E) |

---

## 1. Scope

This plan covers:

1. **Unit tests** — pure functions with no external dependencies (CSV parsing, amount formatting, description sanitisation)
2. **Integration tests** — API routes tested against a real Supabase project (staging environment)
3. **End-to-end tests** — full user journeys through the browser
4. **Manual verification checklist** — pre-merge sign-off for each feature area

---

## 2. Unit Tests (`npm test`)

All unit tests live in `src/lib/csv/__tests__/parse.test.ts` and run with Jest + ts-jest.

### 2.1 Bank Format Detection — `detectBankFormat`

| Test case | Input (headers) | Expected output |
|---|---|---|
| DNB format | `['Dato', 'Tekst', 'Beløp']` | `'dnb'` |
| Nordea format | `['Bokføringsdato', 'Beløp', 'Avsender']` | `'nordea'` |
| Sbanken format | `['Dato', 'Beskrivelse', 'Beløp', 'Sbanken']` | `'sbanken'` |
| Sparebank 1 format | `['Dato', 'Forklaring', 'Rentedato', 'Ut fra konto', 'Inn på konto']` | `'sparebank1'` |
| Generic EN format | `['Date', 'Description', 'Amount']` | `'generic_en'` |
| Generic NO format | `['Dato', 'Beskrivelse', 'Beløp']` | `'generic_no'` |
| Unknown format | `['Col1', 'Col2']` | `'unknown'` |

### 2.2 Norwegian Amount Parsing — `parseNorwegianAmount`

| Test case | Input | Expected output |
|---|---|---|
| Positive with thousands separator | `'1.234,56'` | `1234.56` |
| Negative amount | `'-1.234,56'` | `-1234.56` |
| Simple integer | `'500'` | `500` |
| Zero | `'0,00'` | `0` |
| English decimal (pass-through) | `'1234.56'` | `1234.56` |
| Empty / invalid | `''` | `NaN` or `0` |

### 2.3 Description Sanitisation — `sanitiseDescription`

| Test case | Input | Expected: no account number / IBAN |
|---|---|---|
| Contains Norwegian account number | `'Betaling 1234.56.78901 ref'` | account number removed |
| Contains IBAN | `'Transfer NO9386011117947'` | IBAN removed |
| Contains both | `'From NO1234567890123 acc 1234.56.78901'` | both removed |
| Clean description | `'Netflix'` | `'Netflix'` (unchanged) |

### 2.4 Full Transaction Parse — `parseTransactions`

| Test case | Expected behaviour |
|---|---|
| DNB CSV with 3 rows | Returns 3 `Transaction` objects with correct `date`, `description`, `amount`, `currency: 'NOK'` |
| Generic EN CSV | Correctly maps `Date`, `Description`, `Amount` columns |
| Row with missing amount | Skipped / returns `amount: 0` |
| Row with Norwegian amount format | `amount` parsed correctly (e.g. `-1.234,56` → `-1234.56`) |

**Run all unit tests:**

```bash
npm test
```

Expected: **14 tests pass, 0 failures**.

---

## 3. Integration Tests (Staging Supabase)

These require a live Supabase staging project with the schema applied. Run manually or in CI with secrets configured.

### 3.1 `POST /api/upload`

| Scenario | Setup | Expected response |
|---|---|---|
| Valid CSV, authenticated | Send `.csv` file, valid session cookie | `201` with `{ uploadId }` |
| Non-CSV file | Send `.txt` file | `400 { error: 'Only .csv files are accepted' }` |
| File > 10 MB | Send oversized file | `400 { error: 'File too large' }` |
| Unauthenticated | No session cookie | `401` |

### 3.2 `POST /api/process/[uploadId]`

| Scenario | Expected behaviour |
|---|---|
| Valid uploadId, CSV in storage | Transactions inserted into DB; `uploads.status = 'done'` |
| Invalid uploadId | `404` |
| CSV parse error | `uploads.status = 'error'`; no partial transactions left |
| AI categorisation returns unknown category | Category normalised to `'OTHER'` |

### 3.3 `GET /api/insights/[uploadId]`

| Scenario | Expected response |
|---|---|
| Upload with generated insights | `200` with `{ tips: [...] }` (up to 5 items) |
| Upload with no insights yet | `404` or empty `{ tips: [] }` |
| Unauthenticated | `401` |
| uploadId belongs to different user | `404` (RLS enforcement) |

### 3.4 `PATCH /api/transactions/[id]`

| Scenario | Payload | Expected response |
|---|---|---|
| Update category | `{ category: 'GROCERIES' }` | `200`, transaction updated in DB |
| Update notes | `{ notes: 'shared with flatmate' }` | `200` |
| Invalid category | `{ category: 'INVALID_CAT' }` | `400` |
| Transaction belongs to another user | Valid payload | `404` (RLS) |
| Unauthenticated | Valid payload | `401` |

---

## 4. End-to-End Tests (Manual)

Run these in a browser against `http://localhost:3000` (dev) or the Vercel preview URL.

### 4.1 Authentication Flow

- [ ] Navigate to `/` — sign-in form is visible, no dashboard content
- [ ] Enter email → click "SEND MAGIC LINK" → success message shown
- [ ] Open magic link email → click link → redirected to `/dashboard`
- [ ] Refresh `/dashboard` — still authenticated (session persists)
- [ ] Navigate to `/` while authenticated — should redirect to `/dashboard` or show signed-in state
- [ ] Visit `/dashboard` in incognito (no session) → redirected to `/`

### 4.2 CSV Upload Flow

- [ ] Go to `/upload`
- [ ] Drag-and-drop a `.csv` file onto the drop zone — file name appears
- [ ] Click "NEXT" — column mapper loads with auto-detected columns pre-filled
- [ ] Verify column mapping dropdowns for `date`, `description`, `amount`
- [ ] Click "CONFIRM" — preview table shows first 5 rows
- [ ] Click "IMPORT" — processing spinner appears
- [ ] Status polling resolves to "done" — success message shown
- [ ] Navigate to `/uploads` — new import appears in list with status badge "DONE"

**Edge cases:**

- [ ] Attempt to upload a `.txt` file — rejected with error message
- [ ] Attempt to upload a file > 10 MB — rejected with error message
- [ ] Upload a valid CSV with Norwegian amounts (`1.234,56`) — amounts parsed correctly in transaction list

### 4.3 Upload History

- [ ] `/uploads` lists all imports with filename, date, row count, and status badge
- [ ] Status badges: green = DONE, yellow = PROCESSING, red = ERROR
- [ ] Clicking an upload navigates to the relevant dashboard view

### 4.4 Dashboard (after data import)

- [ ] Summary bar shows: period, total spend, income, net (correct sign + currency)
- [ ] Category chart renders all categories with proportional CSS bars
- [ ] Savings tips panel shows up to 5 ranked recommendations
- [ ] Transaction table shows paginated rows (25 per page)
- [ ] Sorting by date, amount, category works correctly
- [ ] Search/filter narrows the transaction list
- [ ] Inline category edit: click category cell → dropdown → save → row updates without page reload

### 4.5 RLS Data Isolation

- [ ] Sign in as User A, import a CSV
- [ ] Sign in as User B (different browser / incognito)
- [ ] User B cannot see User A's transactions, uploads, or insights (verify via `/uploads` and `/transactions`)

---

## 5. AI Categorisation Spot-Check

After a real CSV import, manually verify a sample of 10–20 transactions:

| Check | Expected |
|---|---|
| Supermarket transactions | Category = `GROCERIES` |
| Restaurant / cafe transactions | Category = `FOOD & DRINK` |
| Netflix / Spotify charges | Category = `SUBSCRIPTIONS` |
| Salary credit | Category = `INCOME` |
| Recurring rent payment | Category = `HOUSING`, `is_recurring = true` |
| Unknown merchant | Category = `OTHER` (not blank, not null) |
| Currency field | Matches the `currency` column in the CSV (default `NOK`) |

---

## 6. Security Checks

| Check | How to verify |
|---|---|
| RLS on all tables | Query `SELECT * FROM transactions` directly in Supabase SQL editor as anon role — should return 0 rows |
| No service-role key in client bundle | Search built output for `service_role` — should not appear |
| Account numbers stripped before AI | Add a test transaction description with a Norwegian account number; verify Anthropic request payload in logs has it removed |
| Auth middleware protects routes | Visit `/dashboard`, `/upload`, `/uploads`, `/transactions`, `/settings` without a session — each should redirect to `/` |
| Environment variable leakage | Check that `ANTHROPIC_API_KEY` is not prefixed with `NEXT_PUBLIC_` and does not appear in `_next/static` bundles |
| API guard usage baseline | Confirm authenticated API routes use `requireAuthenticatedRouteContext` |
| Stripe webhook idempotency | Replay same Stripe `event.id` twice; second delivery returns success without a second profile mutation |
| Stripe webhook failure semantics | Invalid signature returns `400`; internal processing failure returns `500` |

---

## 7. Regression Checklist (pre-merge)

- [ ] `npm test` — all 14 unit tests pass
- [ ] `npm run build` — zero TypeScript or build errors
- [ ] `npm run lint` — zero ESLint errors
- [ ] Authentication flow works end-to-end
- [ ] CSV upload + processing completes for at least one real bank file
- [ ] Dashboard renders with correct totals
- [ ] No console errors in browser DevTools on any page
- [ ] RLS verified: cross-user data access blocked
- [ ] `docs/security/api-security-audit.md` updated for route-level security posture changes
- [ ] `docs/security/sdlc-security-baseline.md` controls reviewed for this PR
