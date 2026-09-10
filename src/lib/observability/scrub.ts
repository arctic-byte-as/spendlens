import type { Event } from '@sentry/nextjs'

// Deny-list of field-name fragments that must never leave the app in an error
// report, per docs/backlog.md Epic 5-A's privacy-scrubbing story. Matched as a
// case-insensitive substring against object keys, so `merchant_name`,
// `receipt_item_name`, etc. are all caught by their shorter root term.
const SENSITIVE_KEY_TERMS = [
  'amount',
  'balance',
  'total',
  'price',
  'merchant',
  'description',
  'payee',
  'account_number',
  'accountnumber',
  'account_id',
  'iban',
  'card_number',
  'cardnumber',
  'item_name',
  'items',
  'line_item',
  'receipt_item',
  'category',
  'subcategory',
  'token',
  'auth',
  'secret',
  'password',
  'session',
  'cookie',
  'email',
]

const REDACTED = '[redacted]'

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_TERMS.some((term) => lower.includes(term))
}

// Best-effort redaction of sensitive values that leak into free text (e.g. an
// embedded JSON snippet in an error message, or an account number typed into
// a log line) rather than arriving as a structured field we can key off of.
export function scrubText(text: string): string {
  let result = text

  // "merchant": "Some Store", category: 'GROCERIES', etc. — JSON/object-literal
  // style key-value pairs for any deny-listed key, quoted with " or '.
  const keyPattern = SENSITIVE_KEY_TERMS.join('|')
  const jsonKeyValue = new RegExp(
    `(["'](?:[\\w-]*(?:${keyPattern})[\\w-]*)["']\\s*:\\s*)(["'])(?:(?!\\2).)*\\2`,
    'gi'
  )
  result = result.replace(jsonKeyValue, (_match, prefix: string, quote: string) => `${prefix}${quote}${REDACTED}${quote}`)

  // Long digit runs — account numbers, card numbers, IBAN-ish sequences.
  result = result.replace(/\b\d{6,}\b/g, `[${REDACTED}-number]`)

  // Currency-shaped amounts, e.g. 1234.56 / 1,234.56 / 1234,56.
  result = result.replace(/\b\d+(?:[.,]\d{3})*[.,]\d{2}\b/g, `[${REDACTED}-amount]`)

  return result
}

function scrubDeep(value: unknown): unknown {
  if (typeof value === 'string') return scrubText(value)
  if (Array.isArray(value)) return value.map(scrubDeep)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? REDACTED : scrubDeep(val)
    }
    return out
  }
  return value
}

function scrubHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(headers)) {
    out[key] = /^(authorization|cookie|set-cookie|x-api-key)$/i.test(key) ? REDACTED : value
  }
  return out
}

/**
 * Sentry `beforeSend` / `beforeSendTransaction` implementation shared by the
 * client, server, and edge configs. Strips transaction amounts, merchant and
 * description text, account identifiers, receipt item names, category data,
 * auth tokens, and session cookies before an event leaves the app — see
 * docs/backlog.md Epic 5-A ("kept out of error reports").
 */
export function scrubEvent<E extends Event>(event: E): E {
  const scrubbed: Event = { ...event }

  if (scrubbed.extra) scrubbed.extra = scrubDeep(scrubbed.extra) as Event['extra']
  if (scrubbed.contexts) scrubbed.contexts = scrubDeep(scrubbed.contexts) as Event['contexts']
  if (scrubbed.tags) scrubbed.tags = scrubDeep(scrubbed.tags) as Event['tags']

  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? scrubText(crumb.message) : crumb.message,
      data: crumb.data ? (scrubDeep(crumb.data) as Record<string, unknown>) : crumb.data,
    }))
  }

  if (scrubbed.message) scrubbed.message = scrubText(scrubbed.message)

  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((value) => ({
        ...value,
        value: value.value ? scrubText(value.value) : value.value,
        stacktrace: value.stacktrace
          ? {
              ...value.stacktrace,
              frames: value.stacktrace.frames?.map((frame) =>
                frame.vars ? { ...frame, vars: scrubDeep(frame.vars) as Record<string, unknown> } : frame
              ),
            }
          : value.stacktrace,
      })),
    }
  }

  if (scrubbed.request) {
    const { cookies: _cookies, headers, data, ...restRequest } = scrubbed.request
    scrubbed.request = {
      ...restRequest,
      ...(headers ? { headers: scrubHeaders(headers) as Record<string, string> } : {}),
      ...(data !== undefined ? { data: scrubDeep(data) } : {}),
      // Cookies are dropped entirely — never needed to diagnose an app error.
    }
  }

  if (scrubbed.user) {
    // Keep only an opaque user id (needed so a report can be tied to an
    // account-deletion request); drop email/username/ip_address.
    scrubbed.user = scrubbed.user.id ? { id: scrubbed.user.id } : undefined
  }

  return scrubbed as E
}
