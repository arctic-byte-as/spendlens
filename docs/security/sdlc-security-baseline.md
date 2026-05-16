# SpendLens SDLC Security Baseline

| Field | Value |
|---|---|
| Status | Living document |
| Last updated | 2026-05-16 |
| Security framework references | OWASP ASVS, OWASP API Security Top 10 |

## Secure delivery requirements

1. **Design review**
   - Changes touching API routes, billing, auth, storage, or AI prompts must include a security impact note in PR description.
2. **Implementation guardrails**
   - Authenticated API routes must use `requireAuthenticatedRouteContext`.
   - User-owned records must enforce owner filters in queries in addition to RLS.
   - Public webhooks must verify source signatures.
   - Test-auth bootstrap endpoints must be disabled in production (`NODE_ENV`/`VERCEL_ENV`) and require signed short-lived requests.
   - Server-enforced feature flags must be backed by DB privileges that prevent self-service mutation by end users.
3. **Validation gates**
   - Run `npm run lint`, `npm test`, and `npm run build` on each security-relevant change.
   - Run parallel validation (Code Review + CodeQL) before finalizing.
4. **Operational evidence**
   - Keep API security inventory current (`docs/security/api-security-audit.md`).
   - Keep Stripe/webhook controls current (`docs/payments.md`).
   - Keep webhook idempotency/audit log migration in schema history.

## Audit trail expectations for PRs

Each PR with API or billing changes should capture:

- Routes changed and auth model (public/authenticated/webhook)
- Ownership/data isolation checks added or confirmed
- Input validation boundaries (body/size/count)
- Abuse controls (billing gates, rate limits, request caps)
- Verification evidence (`lint`, `test`, `build`, CodeQL)
- Production control evidence for any test-auth hook (`404` when disabled, no production test-auth env vars configured)

## Incident-readiness minimum

- Log webhook failures with no secrets or raw payload dumps.
- Preserve billing callback evidence in `stripe_webhook_events`.
- Treat any suspected cross-user access as Sev-1 and rotate affected keys/secrets.
