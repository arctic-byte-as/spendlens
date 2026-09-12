// This file configures the initialization of Sentry on the client (browser).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from '@sentry/nextjs'
import { scrubEvent } from '@/lib/observability/scrub'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,

  // Epic 5-A is error-capture only for now, not distributed tracing — see
  // docs/backlog.md's note to start with Sentry alone and only add
  // OpenTelemetry spans if cross-service tracing becomes a real need.
  tracesSampleRate: 0,

  // Blocker story: strip financial/PII data before anything leaves the app.
  beforeSend(event) {
    return scrubEvent(event)
  },
  beforeSendTransaction(event) {
    return scrubEvent(event)
  },

  // No DSN configured yet — see docs/backlog.md Epic 5-A. Sentry.init() is a
  // safe no-op without a dsn, so this ships dark until SENTRY_DSN is set.
})
