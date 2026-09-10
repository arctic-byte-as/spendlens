# Track B — Security Logging & Abuse Monitoring

Work through this SpendLens backlog epic, on a feature branch (never push to `main` directly), opening a PR
when done and tested. I'll review and test everything myself when I wake up.

Repo: "/Users/pete/code/github/Arctic Byte/spendlens". Read `docs/backlog.md` for full story text and
acceptance criteria before starting — the summary below is a pointer, not the full spec.

**Note:** This is running as a separate parallel worktree alongside other agents working on other epics
(diet insights, AI hardening, error observability elsewhere in the same repo history). Don't touch
`src/lib/ai/` beyond wiring your logging calls into it if genuinely needed — another track owns hardening
that file's contents. Stay focused on the logging helper and its call sites below.

## Epic 8-F — Security Logging & Abuse Monitoring (`docs/backlog.md`, search "Epic 8-F")

Currently only ad hoc `console.error`. Add a small structured logging helper (actor, route, event type,
timestamp — no raw payloads, no secrets, no account numbers) and wire it into:
- auth failures (401s in `src/lib/api/guard.ts`)
- rate-limit hits (429 in `src/lib/api/importTokenGuard.ts`)
- rejected uploads
- webhook signature failures
- AI validation failures (if a validation/parse-failure path already exists in `src/lib/ai/` — don't invent
  one, just hook into what's there)

Keep this simple — a structured console/stdout logger is fine, this is not asking for a logging service
integration. Read the full acceptance criteria in the backlog before starting.

Write tests proving the logger produces the expected structured shape and that sensitive fields (raw
payloads, secrets, account numbers) are never included.

Run the full test suite and `npm run build`. Commit to a branch named `feat/security-logging` and open a PR.

## Ground rules

- **Branch + PR, never push to `main` directly.**
- **Run the full test suite and `npm run build` before opening the PR.** Don't open a PR with failing tests
  or a broken build.
- **Do not deploy, do not touch Stripe live keys, do not merge your own PR, do not touch anything under
  Phase 6 (Monetisation) or push migrations to a production Supabase project.**
- **Do not modify `docs/backlog.md` status markers yourself** — leave that for me to update after I review
  your work; just build against the acceptance criteria as written.
- If you finish with time and context to spare, check remaining Phase 5 polish items in the backlog, same
  branch/PR discipline, one PR per item.
- If you hit a decision that materially changes user-facing behavior or architecture (not just an
  implementation detail), stop and leave a clear note in the PR description rather than guessing.

Work autonomously until I wake up.
