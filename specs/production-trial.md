# Production trial spec

## Goal

Build the first usable version of SpendLens to the point where a human can:

1. create the required third-party accounts,
2. configure secrets and environment variables,
3. deploy the app, and
4. try the main flow in production.

## Scope for the next implementation phase

- Create the smallest app that demonstrates the core SpendLens value proposition.
- Include only the infrastructure required to run and verify that flow.
- Provide a clear deployment target and setup steps.

## Non-goals

- Broad feature completeness
- Advanced scaling work
- Nice-to-have integrations that are not required for the first production trial

## Acceptance criteria

- The repository contains runnable application code.
- The deployment path is documented.
- Required accounts, secrets, and environment variables are documented.
- A human can follow the docs to stand the app up and try the intended production flow.
