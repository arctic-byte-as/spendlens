# Track C — Application Error Observability (OpenTelemetry / Sentry)

Work through this SpendLens backlog epic, on a feature branch (never push to `main` directly), opening a PR
when done and tested. I'll review and test everything myself when I wake up.

Repo: "/Users/pete/code/github/Arctic Byte/spendlens". Read `docs/backlog.md` for full story text and
acceptance criteria before starting — the summary below is a pointer, not the full spec.

**Note:** This is running as a separate parallel worktree alongside other agents working on other epics
(diet insights, AI hardening, security logging elsewhere in the same repo history). A separate track is
building a structured security-event logging helper for Epic 8-F — check `docs/backlog.md` Epic 5-A's note
about sharing that helper rather than building a second one, but if that track's PR isn't merged yet when
you get here, don't block on it: build your own minimal logging integration point and note in your PR that
it should be reconciled with 8-F's helper during review.

## Epic 5-A — Application Error Observability (`docs/backlog.md`, search "Epic 5-A")

New epic. General application error capture (unhandled exceptions, failed AI calls, broken imports) for
product improvement — distinct from Epic 8-F's security-event focus. Read the full story text in the
backlog for the three stories (capture unhandled errors with tracing context, scrub sensitive data before
send, alert on new error types). Key points:

- Evaluate OpenTelemetry vs. Sentry vs. both — don't over-build. Backlog guidance is to start with Sentry
  alone (turnkey, fast signal) and only add OpenTelemetry if cross-service request tracing becomes a real
  need. Use your judgment but document the choice and why in the PR description.
- The privacy-scrubbing story is marked 🔴 blocker, not optional — this app handles financial transactions
  and receipt data. Before sending anything to Sentry/OTel, strip transaction amounts, merchant/description
  text, account identifiers, receipt item names, category data, auth tokens, and session cookies. Write an
  actual test that feeds known-sensitive fake data through the capture path and asserts it does NOT appear
  in the outgoing payload — don't just trust `beforeSend` config to be correct, prove it.
- If you choose Sentry: this needs a Sentry account/DSN to fully wire up, which you likely won't have
  credentials for. Build everything up to that boundary (SDK integration, scrubbing, error boundaries, tests
  using a mocked/fake DSN) and clearly note in the PR what manual step (adding `SENTRY_DSN` to env) is
  needed before it goes live. Don't block the rest of the epic on missing credentials.

Run the full test suite and `npm run build`. Commit to a branch named `feat/error-observability` and open a PR.

## Ground rules

- **Branch + PR, never push to `main` directly.**
- **Run the full test suite and `npm run build` before opening the PR.** Don't open a PR with failing tests
  or a broken build.
- **Do not deploy, do not touch Stripe live keys, do not merge your own PR, do not touch anything under
  Phase 6 (Monetisation) or push migrations to a production Supabase project.**
- **Do not modify `docs/backlog.md` status markers yourself** — leave that for me to update after I review
  your work; just build against the acceptance criteria as written.
- If you finish with time and context to spare, check remaining Phase 5 polish items in the backlog, same
  branch/PR discipline, one PR per item — coordinate implicitly by checking open PRs first so you don't
  duplicate work another track already picked up.
- If you hit a decision that materially changes user-facing behavior or architecture (not just an
  implementation detail — e.g. "Sentry vs OTel" is fine to decide yourself, but anything touching how errors
  surface to end users is not), stop and leave a clear note in the PR description rather than guessing.

Work autonomously until I wake up.
