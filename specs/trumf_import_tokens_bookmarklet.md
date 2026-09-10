# Trumf receipt import: scoped import tokens + bookmarklet

## Context

SpendLens already has a working end-to-end pipeline for Trumf receipt data *after* a JSON file exists: `ReceiptImportWizard` → `POST /api/receipts/import` → validated, upserted into `receipts`/`receipt_items` (Phase 7, mostly shipped). What produces that JSON file, though, is not a real product feature — it's a browser-console script (documented in `specs/trumf_receipt_extractor_skill.md`) that was run by hand, once, through a Claude session using the user's live trumf.no cookies, ending in a manual file download and re-upload.

That doesn't scale to a second user. The user wants to re-pull their own Trumf data now, and — rather than repeat the one-off manual process — wants to design a real mechanism first: a browser bookmarklet that runs the same extraction logic and POSTs straight to SpendLens, instead of a file download/upload round-trip. This plan covers designing and phasing that mechanism. It intentionally stays behind the existing `receipt_analysis` feature flag and targets a small trusted user set, not a public launch.

Two decisions are already made (confirmed with the user):
1. **Delivery mechanism:** browser bookmarklet (not a full extension, not "stay manual," not "wait for an official API").
2. **Delivery target:** the bookmarklet POSTs the combined receipt JSON directly to a SpendLens API endpoint — no intermediate file.

## POC: extraction validated against live Trumf (2026-09-10)

Before building anything, we manually re-ran the documented extraction steps (`specs/trumf_receipt_extractor_skill.md` steps 1–6, unmodified) against the live `trumf.no` site, pasting each step into devtools console and inspecting real output together. This was a deliberate risk check: the spec is months old, and the whole plan below assumes Trumf's frontend still supports the React-fiber-walk + RSC-header-fetch technique.

**Result: fully confirmed, zero changes needed to the extraction logic.**
- Month expansion (`.ws-transaction-history-table__toggle-button` selector): still works, 12/12 months expanded.
- React fiber walk for transaction metadata (`__reactFiber*` key, `memoizedProps.transaction` shape with `batchId`, `transaksjonsTidspunkt`, `beskrivelse`, `belop`, etc.): still works, unchanged field names. 260 rows found, 245 had `hasReceipt: true`.
- RSC endpoint fetch (`fetch(url, { credentials: 'include', headers: { RSC: '1' } })`) + `varelinjer` parsing: still works, `Status: 200`, correct item-level data (`varelinjeGuid`, `produktBeskrivelse`, `momsProsent`, etc.) returned for a spot-checked receipt.

**New finding — a real, non-transient ~2.5% fetch-failure rate:** of 245 queued receipts, 239 fetched successfully and 6 consistently failed to return a `varelinjer`-bearing payload — even after 3 sequential retries with 1s backoff. The failing responses come back `200 OK` but contain the Next.js **loading/suspense shell** (`"Spinner"`, a `loading-*.js` chunk reference) instead of the resolved RSC payload, meaning the endpoint can return a non-final stream frame under some condition we haven't isolated. This ruled out our first hypothesis (a concurrency/streaming race from the 5-at-a-time batch fetch) since sequential retries didn't fix it either. The 6 failing batchIds cluster in the most recent ~3 weeks of purchases and include a couple of visibly different batchId shapes (longer IDs, e.g. `...1081969351001492000` vs the typical `...0000474...` pattern) — possibly a different receipt/order type. Root cause wasn't pinned down further (user chose to proceed rather than dig deeper right now).

**Implication for the plan:** this doesn't change the design in Design §1–5 below, but it upgrades the priority of one item already listed in Step 2 — the bookmarklet's per-receipt fetch needs real retry-with-backoff logic AND must gracefully report permanently-unfetchable receipts to the user (not silently drop them), since a real user won't have a console to notice a partial result. See the updated Step 2 scope.

**Immediate data pull — done manually, outside this plan's build:** the user completed the existing manual flow for their own re-import: ran steps 1–6 by hand, downloaded `all_receipts_trumf.json` (239 receipts, 0 errors after the retry pass), and will upload it via the existing `ReceiptImportWizard` at `/dashboard/receipts/import` separately. This was the fastest path to today's actual goal (get transactions in) and required no code changes — it's not part of the engineering work below, just confirms the wizard/API side (already shipped) is what receives the result.

## Why a new auth mechanism is required

`/api/receipts/import` today uses `requireAuthenticatedRouteContext()` (`src/lib/api/guard.ts`), which is Supabase **cookie-session** auth (`supabase.auth.getUser()`). A bookmarklet executes in the JS context of `https://www.trumf.no` — it is a cross-origin, cookie-less caller from SpendLens's perspective. It cannot present a SpendLens session cookie, so a new lightweight, scoped credential is needed: a long-lived **import token** the user generates once inside SpendLens and embeds into their personal bookmarklet link.

Verified against the codebase: no existing API-key/PAT pattern exists in the repo. The closest precedent is the Stripe webhook route (`src/app/api/webhooks/stripe/route.ts`), which authenticates an external, cookie-less caller via a shared secret, uses `createAdminClient()` (`src/lib/supabase/admin.ts`, service-role, RLS-bypassing) to write on the caller's behalf, and uses a dedicated table (`stripe_webhook_events`) for idempotency/audit. The import-token design follows that same shape. Also verified: `src/middleware.ts` only guards page paths (`/dashboard`, `/upload`, `/uploads`, `/transactions`, `/settings`, `/receipts`), not `/api/*`, so a new token-authenticated API route is unaffected by it and needs its own auth path — which is what we're building.

## Design

### 1. Token model — new `import_tokens` table

New migration `supabase/migrations/20260910120000_receipt_import_tokens.sql`, following the naming and RLS conventions of `supabase/migrations/20260516202000_security_hardening_feature_flags_and_webhooks.sql`:

- Columns: `id`, `user_id` (→ `profiles`), `token_hash` (sha256 of the raw token — raw token is never stored), `token_prefix` (first 8 chars, for UI display), `scope` (fixed `'receipts:import'`), `created_at`, `expires_at`, `last_used_at`, `revoked_at`, `request_count`.
- RLS: users can `select`/`update` (revoke) their own rows via `user_id = auth.uid()`. `insert`/`delete` revoked from `anon`/`authenticated`, granted only to `service_role` — mirrors how `20260516202000` locks down `profiles.feature_flags` writes.
- Token shape: random 32-byte value, base64url, prefixed `slr_imp_` for recognizability. Only `sha256(token)` is persisted (Node's built-in `crypto`, no new dependency).
- Lifetime: 90 days, **reusable** (not single-use) — a bookmarklet requiring re-auth every click isn't a real "one click" flow. Reusability is why revocation + rate limiting + narrow scope matter (below).
- One live token per user — generating a new one revokes the prior one, to keep the mental model and revocation story simple.

### 2. New API surface

- **`src/app/api/receipts/import-token/route.ts`** — `POST` (issue, revoking any prior token), `DELETE` (revoke), `GET` (status: prefix/expiry/last-used/request-count, never the secret). Auth: existing `requireAuthenticatedRouteContext()` + `hasFlag(profile, 'receipt_analysis')` — this is the normal logged-in user acting from inside SpendLens.
- **`src/app/api/receipts/import/importReceipts.ts`** (new, extracted) — pull the parse/upsert body of the current `route.ts` (everything after auth resolution) into `importReceipts(supabase, userId, requestBody)`. Existing `src/app/api/receipts/import/route.ts` becomes: auth → flag check → call `importReceipts`. This is a refactor, not new logic — `parseReceiptsImportPayload` (`payload.ts`) and the upsert/batch logic are reused verbatim from both callers, not duplicated.
- **`src/app/api/receipts/import/bookmarklet/route.ts`** (new, separate route rather than branching the existing one) — the cross-origin entry point the bookmarklet actually calls.
  - Why a separate route: keeps CORS/origin-check logic scoped to exactly the one route that needs it, rather than adding conditional CORS branching to the same-origin cookie-authenticated route and risking an accidental widened `Access-Control-Allow-Origin` there too. Matches the project's "every route classified as public/authenticated/webhook/admin-only" posture (Phase 8 / CISO doc).
  - Auth: new `src/lib/api/importTokenGuard.ts` — reads `Authorization: Bearer <token>` (header, not query param, so it doesn't land in logs/referrers), hashes + looks up via `createAdminClient()` (must bypass RLS — no `auth.uid()` session exists here), rejects on missing/revoked/expired, rate-limits (below), updates `last_used_at`/`request_count`, returns `{ supabase: adminClient, userId }` — same shape `importReceipts` already expects.
  - Still re-checks `hasFlag(profile, 'receipt_analysis')` server-side after resolving `userId` — defense in depth, independent of how the page-level gate was reached.
  - CORS: `OPTIONS` handler + response headers scoped to a **hardcoded** `const ALLOWED_ORIGIN = 'https://www.trumf.no'` (never reflect the request's `Origin` header — that's the classic CORS misconfiguration). The `POST` handler additionally verifies the request's `Origin` header server-side before processing, since CORS headers alone are advisory to non-browser clients — the token + scope-limited writes are the real control, origin-checking is defense in depth.

### 3. Security model / blast radius

- **Scope:** token can only hit `POST /api/receipts/import/bookmarklet` — no read/list/delete capability exists on any token-authenticated route, so a leaked token can't exfiltrate existing data.
- **Blast radius if leaked:** attacker can write extra "receipt" rows into that one user's account, bounded by the existing `MAX_RECEIPTS_PER_REQUEST` (500) / `MAX_ITEMS_PER_REQUEST` (10000) caps in `payload.ts`, and bounded to that one `user_id` (taken from the token row server-side, never from client input) — a data-integrity risk to one account, not a cross-account or confidentiality risk.
- **Rate limiting:** no rate-limit infra exists in the repo today. Add a minimal per-token rolling-window counter on the `import_tokens` row itself (no new infra/dependency), enforced in `importTokenGuard.ts` — generous enough for retries, capped enough to block abuse (e.g. ~20 req/hour). Note in the PR description that this partially satisfies backlog Epic 8-B (resource-abuse protection on expensive routes).
- **Revocation & expiry:** one-click revoke from the UI (Step 3 below), checked on every request; 90-day hard expiry.
- **No logging of the raw token** anywhere in `importTokenGuard.ts` — matches the project's existing "no secrets in logs" posture for the service-role key.
- Deferred to a follow-up (not built now): leak-notification email on new-token-generation or usage spikes; shortening token lifetime with silent refresh if the trusted-user pool grows. Flagged for the CISO agent / Phase 8, not part of this build.

### 4. The bookmarklet

- **`public/bookmarklet/trumf-import.js`** (new) — the extraction logic currently documented only as copy-paste snippets in `specs/trumf_receipt_extractor_skill.md` (expand months → walk React fiber for transaction metadata → fetch each receipt via the Next.js RSC endpoint with `credentials: 'include'` + `RSC: 1`) becomes real, versioned, readable source. Steps 5/6 in the spec (download-to-file) are **replaced** with a direct `fetch(SPENDLENS_API_BASE + '/api/receipts/import/bookmarklet', { method: 'POST', headers: { Authorization: 'Bearer ' + IMPORT_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ receipts }) })`, plus a small fixed-position on-page status indicator (progress/result), since there's no devtools console for a normal user to watch.
- The file is a **template** with `__SPENDLENS_API_BASE__` / `__IMPORT_TOKEN__` placeholders — never a static shared file with a real token in it. `src/lib/receipts/bookmarklet.ts` (new) exports `buildBookmarkletHref(token, apiBase)`, which substitutes the placeholders (inline template-string constant, not a filesystem read from a server component) and wraps the result as a `javascript:(function(){...})()` href.
- Install UX is the standard bookmarklet pattern: a styled `<a href={bookmarkletHref}>` the user drags to their bookmarks bar. Explicitly not pursuing a Tampermonkey/userscript variant in this iteration — second packaging format, second install flow, no immediate benefit; revisit only if bookmarklet length/CSP becomes a real blocker.
- `specs/trumf_receipt_extractor_skill.md` stays, updated to point at `public/bookmarklet/trumf-import.js` as the canonical/shipped version, keeping its own content as historical/debugging reference (useful if Trumf's frontend changes and the fiber-walk breaks).
- Shipping this as an inspectable static file (not minified/obfuscated) under `public/` is a small deliberate transparency choice worth keeping, given it's reading a third party's data using the user's own session.

### 5. Migration

Single file, as described in §1: `supabase/migrations/20260910120000_receipt_import_tokens.sql`.

## Phased build sequence

**Step 1 — Token + API plumbing, dogfood via the existing console script (no bookmarklet, no self-serve UI yet).**
- `import_tokens` migration.
- `src/lib/api/importTokenGuard.ts`, `src/app/api/receipts/import/importReceipts.ts` (extracted), refactor existing `route.ts` onto it.
- New `src/app/api/receipts/import-token/route.ts` and `src/app/api/receipts/import/bookmarklet/route.ts` (with CORS/origin checks).
- Issue the first token manually (authenticated call to the new route, not yet exposed in UI). Modify a local copy of the console script's final step to POST to the new endpoint with that token instead of downloading a file — validates the full path end-to-end with the same trust boundary as today (human-run via devtools), new transport only.
- Tests: `importTokenGuard` (valid/expired/revoked/malformed/rate-limited), `importReceipts` behavior-preservation (reuse existing `payload.test.ts` fixtures), CORS/origin-check test on the bookmarklet route.

**Step 2 — Package the bookmarklet.**
- `public/bookmarklet/trumf-import.js` + `src/lib/receipts/bookmarklet.ts`.
- **Per-receipt fetch retry + graceful partial-failure reporting** (elevated priority from the POC finding above): retry a receipt fetch (e.g. up to 3x with backoff) if the RSC response doesn't contain `varelinjer`; if still unresolved, record it as a named failure and surface a clear "`N` of `M` receipts imported, `K` could not be fetched" result in the on-page status UI rather than failing silently or blocking the whole import. Root cause of the ~2.5% failure rate (loading-shell response returned instead of resolved data, seen on 6/245 receipts, clustered in the most recent ~3 weeks and on a couple of differently-shaped batchIds) was not identified during the POC — worth a closer look here (e.g. inspect one of those receipts in the normal Trumf UI to check if it's a different transaction/order type) but the retry+report behavior should ship regardless of whether the cause is found.
- Update `specs/trumf_receipt_extractor_skill.md` to reference it.
- Token still issued out-of-band (developer-run), no self-serve page yet — consistent with "not going fully public."
- Test: template substitution produces a valid `javascript:` URI and never leaks raw placeholder tokens on substitution failure.

**Step 3 — Self-serve UI: `/dashboard/receipts/connect`.**
- New page (flag-gated exactly like `src/app/dashboard/receipts/import/page.tsx`): generate/revoke/view token status, render the personalized bookmarklet install link.
- Linked from `/dashboard/receipts/import`.
- This is the point where a new trusted user can self-serve the token + bookmarklet without a developer in the loop — while `receipt_analysis` itself stays a manually-set flag per the existing Phase 7 convention (self-serve token generation, not self-serve flag enablement).

**Step 4 (explicit backlog, not built now):** rate-limit tuning from real usage, leak-notification emails, shorter-lived auto-refreshing tokens if the user pool grows, CISO security pass before any rollout beyond the initial trusted set.

## Verification

- `npm test` — new unit tests for `importTokenGuard`, `importReceipts` extraction (behavior parity with current `payload.test.ts` coverage), CORS/origin handling.
- `npm run build` — must pass, per existing project convention before declaring work done.
- Manual end-to-end (Step 1): run the console script with its final step pointed at the new bookmarklet endpoint using a manually-issued token; confirm `receipts`/`receipt_items` rows appear and re-running is idempotent (no duplicate rows), matching the existing `POST /api/receipts/import` idempotency guarantee.
- Manual end-to-end (Step 2/3): drag the generated bookmarklet to a bookmarks bar, click it on `trumf.no/profil/kvitteringer` while logged in, confirm the on-page progress indicator completes and the dashboard reflects imported receipts.

## Status

- POC complete (2026-09-10): extraction technique validated live, no design changes needed, one new reliability finding folded into Step 2 scope (above).
- User's own data re-pull for today is already done manually (239/245 receipts, see POC section) and is being uploaded via the existing, already-shipped wizard — independent of the build below.
- Nothing in Design §1–5 or the phased sequence has been built yet. Next actor should start at **Step 1**.
