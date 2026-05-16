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
