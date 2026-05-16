# Issue: Automate Supabase migrations on production deploy

**Status:** Backlog  
**Priority:** High  
**Area:** CI/CD, Supabase, production operations  
**Created:** 2026-05-16  

## Goal

Set up a safe CI/CD workflow so Supabase database migrations in `supabase/migrations/**` can be applied automatically when changes are merged to `main`, with guardrails to reduce production database risk.

## Context

SpendLens stores schema changes as SQL migration files under `supabase/migrations`. Today these migrations must be applied manually. This creates drift risk between the app code and the Supabase production schema.

We want a GitHub Actions workflow that validates migrations during PRs and deploys pending migrations to the production Supabase project after merge to `main`.

## Requirements

### 1. PR validation workflow

Create or update a GitHub Actions workflow that runs on pull requests touching:

- `supabase/migrations/**`
- `supabase/config.toml`
- application code that depends on database schema, if practical

The PR workflow should:

- check out the repo
- install the Supabase CLI
- start or reset a local Supabase database if supported in CI
- apply all migrations from scratch
- fail the PR if migrations cannot be applied cleanly
- run existing app tests after migrations are applied, where feasible

Acceptance criteria:

- A PR with a broken SQL migration fails CI.
- A PR with valid migrations passes.
- The workflow output clearly shows which migration failed.

### 2. Production migration workflow

Create a separate GitHub Actions workflow that runs on push to `main` when migration files change:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "supabase/migrations/**"
      - "supabase/config.toml"
```

The workflow should:

- check out the repo
- install the Supabase CLI using `supabase/setup-cli`
- authenticate using GitHub repository secrets
- link to the production Supabase project
- run `supabase db push`
- fail loudly if pending migrations cannot be applied

Required secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- any required database password or connection secret if the chosen CLI flow requires it

### 3. Production safety guard

Use a GitHub protected environment named `production` for the production migration job.

The first version should require manual approval before migrations run against production.

Acceptance criteria:

- Merging to `main` starts the migration workflow.
- The production job pauses for environment approval.
- After approval, pending migrations are applied to the production Supabase project.
- Without approval, no production database mutation occurs.

### 4. Migration discipline documentation

Add a short section to `docs/technical-spec.md` or a new `docs/database-migrations.md` covering:

- never edit migration files after they have been merged
- all schema changes must be forward-only
- destructive changes must be phased:
  1. add new structure
  2. backfill or migrate data
  3. switch application code
  4. remove old structure in a later migration
- RLS policies must be included with schema changes
- migrations should be tested locally before PR
- production migrations are applied by CI, not manually from a developer machine except for emergency recovery

### 5. Optional staging support

If a staging Supabase project exists or can be added, support this flow:

- PRs or merges to a staging branch apply migrations to staging first
- production deploy requires staging success
- document separate secrets:
  - `SUPABASE_STAGING_PROJECT_REF`
  - `SUPABASE_PRODUCTION_PROJECT_REF`

Do not block the first implementation on staging if no staging project exists.

## Non-goals

- Do not build custom migration tooling.
- Do not run destructive SQL automatically without a protected environment approval gate.
- Do not squash or rewrite existing migrations in this task.
- Do not change application database schema unless required to make CI work.

## Implementation notes

Preferred production workflow shape:

```yaml
name: Deploy Supabase migrations

on:
  push:
    branches: [main]
    paths:
      - "supabase/migrations/**"
      - "supabase/config.toml"

jobs:
  deploy-db:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - run: supabase link --project-ref "$SUPABASE_PROJECT_REF"
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}

      - run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Adjust commands if the current Supabase CLI version requires `--project-ref`, `--linked`, `--db-url`, or additional secrets.

## Final deliverables

- GitHub Actions workflow for PR migration validation.
- GitHub Actions workflow for production migration deployment.
- Documentation for required GitHub secrets and environment protection setup.
- Documentation for migration safety rules.
- Confirmation that existing migrations apply successfully in CI.
