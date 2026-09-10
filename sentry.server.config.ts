// This file configures the initialization of Sentry on the server (Node.js runtime).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from '@/lib/observability/scrub'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,

  // Epic 5-A is error-capture only for now — see sentry.client.config.ts.
  tracesSampleRate: 0,

  beforeSend(event) {
    return scrubEvent(event)
  },
  beforeSendTransaction(event) {
    return scrubEvent(event)
  },

  // No DSN configured yet — see docs/backlog.md Epic 5-A. Sentry.init() is a
  // safe no-op without a dsn, so this ships dark until SENTRY_DSN is set.
})
