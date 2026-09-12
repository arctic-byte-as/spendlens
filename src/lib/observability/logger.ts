import * as Sentry from '@sentry/nextjs'
import { scrubText } from './scrub'

/**
 * Minimal structured error-capture helper for Epic 5-A (application error
 * observability). Epic 8-F (security-event logging) wants the same
 * actor/route/event-type/timestamp shape for a different purpose (abuse
 * investigation vs. product-improvement diagnostics) — see docs/backlog.md.
 * If 8-F's logger lands first, reconcile these into one helper rather than
 * keeping two; this one intentionally stays small so that merge is cheap.
 */
export interface CaptureErrorContext {
  /** API route or app area the error occurred in, e.g. "/api/process". */
  route: string
  /** What the app was trying to do, e.g. "ai_categorisation_failed". */
  eventType: string
  /** Opaque user id, if known. Never an email or other PII. */
  actor?: string | null
  /** Extra structured context — scrubbed by Sentry's beforeSend before send. */
  extra?: Record<string, unknown>
}

export function captureError(error: unknown, context: CaptureErrorContext): void {
  // This console.error line bypasses Sentry's beforeSend scrubbing entirely (it's a separate
  // sink), so the message gets the same scrubText() treatment here rather than going out raw.
  const rawMessage = error instanceof Error ? error.message : String(error)
  console.error(
    JSON.stringify({
      actor: context.actor ?? 'anonymous',
      route: context.route,
      event_type: context.eventType,
      timestamp: new Date().toISOString(),
      error: scrubText(rawMessage),
    })
  )

  Sentry.withScope((scope) => {
    scope.setTag('route', context.route)
    scope.setTag('event_type', context.eventType)
    if (context.actor) scope.setUser({ id: context.actor })
    if (context.extra) scope.setExtras(context.extra)
    Sentry.captureException(error)
  })
}
