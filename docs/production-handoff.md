# Production handoff

## Current state

The repository is still at the planning stage. There is no application code or existing build/test stack in the repo yet.

## Immediate goal

Use GitHub cloud agents to build the smallest production-trial version of SpendLens: enough to configure the required accounts, deploy it, and exercise the core flow in production.

## Handoff expectations

- Work from the spec in `specs/production-trial.md`.
- Keep new infrastructure and dependencies minimal.
- Record every required external service, account, and secret as soon as it becomes necessary.
- Leave behind clear run, deploy, and validation instructions for the next human step.

## Required outputs from the next build phase

1. A runnable app in this repository.
2. Setup instructions for local and deployed environments.
3. A list of accounts/secrets needed to operate the app.
4. A documented deploy path for a production trial.

## Security handoff artifacts (required)

- API security inventory: `docs/security/api-security-audit.md`
- SDLC security baseline and evidence expectations: `docs/security/sdlc-security-baseline.md`
- Stripe billing/webhook security controls: `docs/payments.md`

## Security incident checklist

Security-relevant events (auth failures, rate-limit hits, rejected uploads, webhook
signature failures, AI validation failures) are logged as single-line JSON via
`logSecurityEvent` (`src/lib/logging/securityLog.ts`) to stdout — grep server logs for
`"level":"security"`. Each line has `timestamp`, `eventType`, `route`, `actor`, and
optionally `reason`/`metadata`. It never contains raw payloads, account numbers, or
secrets — sensitive-looking metadata keys are redacted before logging.

When investigating a suspected abuse incident:

1. **Scope it.** Grep stdout/log aggregator for `"level":"security"` in the affected
   window. Group by `eventType` and `actor` to see whether it's one actor hammering
   one route, or something broader.
2. **Check `auth_failure` and `rate_limit_exceeded` volume** for the `actor` (user id,
   IP, or import-token owner) — a spike suggests credential stuffing or token abuse.
3. **Check `upload_rejected` and `ai_validation_failure` volume** for the same actor —
   repeated rejections can mean someone probing input validation, not a one-off user
   mistake.
4. **Check `webhook_signature_invalid`** separately — this is unauthenticated by
   definition (it fires before the signature is verified), so correlate by request
   rate/IP at the edge/proxy layer, not by `actor`.
5. **Decide on action**: rate-limit or revoke the actor's import token/session,
   block the IP at the edge if available, or escalate — this project has no on-call
   paging yet, so escalation today means notifying the operator directly (Slack/email).
6. **Do not** pull raw request bodies, CSV contents, or receipt payloads into an
   incident writeup — the security log is designed to be enough on its own; if it
   isn't, that's a gap to fix in the logger, not a reason to dump raw payloads.
