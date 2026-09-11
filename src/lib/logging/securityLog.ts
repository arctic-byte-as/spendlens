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

// Truncates by Unicode code point rather than UTF-16 code unit, so a surrogate pair (e.g. an
// emoji) straddling the cutoff is never split into an unpaired half.
function truncate(value: string, maxLength: number): string {
  const chars = Array.from(value)
  if (chars.length <= maxLength) return value
  return `${chars.slice(0, maxLength).join('')}…[truncated]`
}

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

    scrubbed[key] = typeof value === 'string' ? truncate(value, MAX_VALUE_LENGTH) : value
  }

  return scrubbed
}

export function logSecurityEvent(event: SecurityLogEvent): SecurityLogRecord {
  // actor/route/reason come straight from request data (e.g. X-Forwarded-For) at some call
  // sites, so they get the same length cap as metadata even though they're not deny-list scrubbed
  // — an attacker-controlled field shouldn't get a free pass just because it isn't in `metadata`.
  const record: SecurityLogRecord = {
    timestamp: new Date().toISOString(),
    level: 'security',
    eventType: event.eventType,
    route: truncate(event.route, MAX_VALUE_LENGTH),
    actor: truncate(event.actor, MAX_VALUE_LENGTH),
    ...(event.reason ? { reason: truncate(event.reason, MAX_VALUE_LENGTH) } : {}),
    ...(event.metadata ? { metadata: scrubMetadata(event.metadata) } : {}),
  }

  console.log(JSON.stringify(record))

  return record
}
