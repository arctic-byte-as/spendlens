import type { Event } from '@sentry/nextjs'
import { scrubEvent, scrubText } from './scrub'

// Epic 5-A privacy-scrubbing story is a blocker: prove sensitive financial
// data does not survive in the payload Sentry would actually receive, rather
// than trusting the beforeSend wiring to be correct.

const FAKE_MERCHANT = 'Big Box Groceries Ltd'
const FAKE_DESCRIPTION = 'Card purchase at Big Box Groceries Ltd, weekly shop'
const FAKE_ACCOUNT_NUMBER = '87654321'
const FAKE_AMOUNT = '1234.56'
const FAKE_AUTH_TOKEN = 'Bearer sekrit-token-value'
const FAKE_SESSION_COOKIE = 'sb-access-token=abc.def.ghi'
const FAKE_CATEGORY = 'GROCERIES'
const FAKE_ITEM_NAME = 'Organic Bananas'
const SAFE_ROUTE = '/api/process'
const SAFE_EVENT_TYPE = 'ai_call_failed'

function buildFakeEvent(): Event {
  return {
    message: `Failed to parse Claude response: {"merchant": "${FAKE_MERCHANT}", "category": "${FAKE_CATEGORY}", "amount": ${FAKE_AMOUNT}}`,
    tags: { route: SAFE_ROUTE, event_type: SAFE_EVENT_TYPE },
    user: { id: 'user-123', email: 'real.user@example.com', ip_address: '203.0.113.5' },
    extra: {
      transaction: {
        merchant: FAKE_MERCHANT,
        description: FAKE_DESCRIPTION,
        amount: FAKE_AMOUNT,
        account_number: FAKE_ACCOUNT_NUMBER,
        category: FAKE_CATEGORY,
      },
      receiptItems: [{ item_name: FAKE_ITEM_NAME, amount: FAKE_AMOUNT }],
    },
    contexts: {
      importedRow: { description: FAKE_DESCRIPTION, account_id: 'acct_' + FAKE_ACCOUNT_NUMBER },
    },
    breadcrumbs: [
      {
        message: 'Categorisation batch completed',
        data: { merchant: FAKE_MERCHANT, amount: FAKE_AMOUNT },
      },
    ],
    exception: {
      values: [
        {
          type: 'Error',
          value: `Failed to parse Claude response: "merchant": "${FAKE_MERCHANT}", account ${FAKE_ACCOUNT_NUMBER}`,
          stacktrace: {
            frames: [
              {
                filename: 'src/lib/ai/categorise.ts',
                function: 'categoriseBatch',
                vars: { description: FAKE_DESCRIPTION, token: FAKE_AUTH_TOKEN },
              },
            ],
          },
        },
      ],
    },
    request: {
      headers: {
        authorization: FAKE_AUTH_TOKEN,
        cookie: FAKE_SESSION_COOKIE,
        'x-forwarded-for': '198.51.100.7',
        'user-agent': 'jest-test',
      },
      cookies: { 'sb-access-token': 'abc.def.ghi' },
      data: { description: FAKE_DESCRIPTION, amount: FAKE_AMOUNT },
    },
  }
}

describe('scrubEvent', () => {
  it('does not contain sensitive financial data anywhere in the outgoing payload', () => {
    const scrubbed = scrubEvent(buildFakeEvent())
    const payload = JSON.stringify(scrubbed)

    expect(payload).not.toContain(FAKE_MERCHANT)
    expect(payload).not.toContain(FAKE_DESCRIPTION)
    expect(payload).not.toContain(FAKE_ACCOUNT_NUMBER)
    expect(payload).not.toContain(FAKE_AMOUNT)
    expect(payload).not.toContain(FAKE_AUTH_TOKEN)
    expect(payload).not.toContain(FAKE_SESSION_COOKIE)
    expect(payload).not.toContain(FAKE_ITEM_NAME)
    expect(payload).not.toContain('real.user@example.com')
    expect(payload).not.toContain('203.0.113.5')
    expect(payload).not.toContain('198.51.100.7')
  })

  it('drops cookies entirely from the request payload', () => {
    const scrubbed = scrubEvent(buildFakeEvent())
    expect(scrubbed.request?.cookies).toBeUndefined()
  })

  it('keeps only an opaque user id, dropping email and ip', () => {
    const scrubbed = scrubEvent(buildFakeEvent())
    expect(scrubbed.user).toEqual({ id: 'user-123' })
  })

  it('preserves non-sensitive routing/debugging context', () => {
    const scrubbed = scrubEvent(buildFakeEvent())
    const payload = JSON.stringify(scrubbed)

    expect(scrubbed.tags?.route).toBe(SAFE_ROUTE)
    expect(scrubbed.tags?.event_type).toBe(SAFE_EVENT_TYPE)
    expect(payload).toContain('categoriseBatch')
    expect(payload).toContain('src/lib/ai/categorise.ts')
  })
})

describe('scrubText', () => {
  it('redacts quoted sensitive JSON fields embedded in free text', () => {
    const text = `bad response: {"merchant": "${FAKE_MERCHANT}", "category": "${FAKE_CATEGORY}"}`
    const result = scrubText(text)
    expect(result).not.toContain(FAKE_MERCHANT)
    expect(result).not.toContain(FAKE_CATEGORY)
  })

  it('redacts long digit sequences that look like account numbers', () => {
    expect(scrubText(`account ${FAKE_ACCOUNT_NUMBER} overdrawn`)).not.toContain(FAKE_ACCOUNT_NUMBER)
  })

  it('redacts currency-shaped amounts', () => {
    expect(scrubText(`charged ${FAKE_AMOUNT} NOK`)).not.toContain(FAKE_AMOUNT)
  })

  it('leaves ordinary short text untouched', () => {
    expect(scrubText('Unexpected response type from Claude')).toBe('Unexpected response type from Claude')
  })

  it('redacts Postgres constraint-violation style key=value pairs, not just JSON quoting', () => {
    const text = `duplicate key value violates unique constraint: Key (description)=(${FAKE_DESCRIPTION}) already exists`
    const result = scrubText(text)
    expect(result).not.toContain(FAKE_DESCRIPTION)
    expect(result).toContain('(description)=([redacted])')
  })

  it('redacts the whole value even when it contains a backslash-escaped quote', () => {
    const text = `bad response: {"description": "He said \\"hi\\" at the ${FAKE_MERCHANT} counter"}`
    const result = scrubText(text)
    expect(result).not.toContain(FAKE_MERCHANT)
    expect(result).not.toContain('counter')
  })

  it('redacts whole-number amounts explicitly marked with a currency label', () => {
    expect(scrubText('charged 150 kr for the order')).not.toContain('150')
    expect(scrubText('charged NOK 150 for the order')).not.toContain('150')
  })
})
