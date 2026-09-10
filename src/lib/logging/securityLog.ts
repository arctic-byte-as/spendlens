/**
 * Structured security-event logger for abuse investigation.
 *
 * Shared by Epic 8-F (security logging: auth failures, rate limits, rejected
 * uploads, webhook signature failures, AI validation failures) and Epic 5-A
 * (general application error observability) — both want the same
 * actor/route/event-type/timestamp shape.
 *
 * Deliberately not a logging-service integration: this writes one JSON line
 * per event to stdout via console.log, which is enough for grepping server
 * logs or piping into a log aggregator later.
 */

export type SecurityEventType =
  | 'auth_failure'
  | 'rate_limit_exceeded'
  | 'upload_rejected'
  | 'webhook_signature_invalid'
  | 'ai_validation_failure'

export interface SecurityLogEvent {
  eventType: SecurityEventType
  /** API route or code path the event occurred on, e.g. "/api/upload". */
  route: string
  /** Who triggered the event: a user id, a hashed/opaque token id, an IP, or 'unknown'. Never a raw secret. */
  actor: string
  /** Short, non-sensitive human-readable reason, e.g. "file_too_large". */
  reason?: string
  /** Additional non-sensitive context. Sensitive-looking keys are redacted defensively. */
  metadata?: Record<string, string | number | boolean | null | undefined>
}

export interface SecurityLogRecord {
  timestamp: string
  level: 'security'
  eventType: SecurityEventType
  route: string
  actor: string
  reason?: string
  metadata?: Record<string, string | number | boolean | null>
}

const REDACTED = '[redacted]'
const MAX_VALUE_LENGTH = 200

// Defensive deny-list: even though callers are expected to only pass safe
// summary fields, redact anything shaped like a secret, financial detail, or
// raw payload so a mistake at a call site can't leak sensitive data.
const SENSITIVE_KEY_PATTERN =
  /token|secret|password|passwd|auth|cookie|session|card|iban|account|amount|balance|total|price|ssn|ccn|payload|prompt|body|content|csv|receipt|email|phone|address/i

function scrubMetadata(
  metadata: SecurityLogEvent['metadata']
): Record<string, string | number | boolean | null> | undefined {
  if (!metadata) return undefined

  const scrubbed: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue

    if (SENSITIVE_KEY_PATTERN.test(key)) {
      scrubbed[key] = REDACTED
      continue
    }

    if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
      scrubbed[key] = `${value.slice(0, MAX_VALUE_LENGTH)}…[truncated]`
      continue
    }

    scrubbed[key] = value
  }

  return scrubbed
}

export function logSecurityEvent(event: SecurityLogEvent): SecurityLogRecord {
  const record: SecurityLogRecord = {
    timestamp: new Date().toISOString(),
    level: 'security',
    eventType: event.eventType,
    route: event.route,
    actor: event.actor,
    ...(event.reason ? { reason: event.reason } : {}),
    ...(event.metadata ? { metadata: scrubMetadata(event.metadata) } : {}),
  }

  console.log(JSON.stringify(record))

  return record
}
