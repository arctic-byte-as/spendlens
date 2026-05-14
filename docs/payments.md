# SpendLens — Payments & Billing Technical Spec

| Field | Value |
|---|---|
| Status | Draft |
| Last updated | 2026-05-14 |
| Payment provider | Stripe |
| Billing model | Monthly flat-rate subscription |

---

## 1. Overview

SpendLens charges a flat monthly fee to cover Vercel hosting, Supabase, and Anthropic API costs. Stripe is the payment processor. Supabase stores subscription state, gated by RLS like all other tables. The Anthropic and Vercel platforms have no reseller or billing delegation capability — Stripe is the only viable path.

Users start on a **free tier** (limited uploads). A Stripe Checkout session upgrades them to **Pro**. The webhook keeps Supabase subscription state in sync.

---

## 2. Pricing Tiers

| Tier | Monthly price | Upload limit | AI features |
|---|---|---|---|
| Free | $0 | 1 lifetime trial upload (max 1,000 transactions) | Categorisation only (no insights) |
| Pro | $8 / month | Unlimited | Categorisation + Savings Insights |

> **Cost basis (estimated):** Vercel Hobby ~$0, Supabase Free ~$0, Claude Sonnet API ~$0.30–1.00 per active user/month at typical usage. $8 leaves ~$6–7 margin per Pro user.

> **Free tier rationale:** One upload of up to 1,000 transactions gives a new user a full end-to-end trial (real data, real categorisation) without risking abuse. After that single trial they must upgrade.

---

## 3. Architecture

```
Browser
  └─ "Upgrade" button
       └─ POST /api/billing/checkout          (creates Stripe Checkout Session)
            └─ redirect → Stripe hosted page
                 └─ user pays
                      └─ Stripe → POST /api/webhooks/stripe
                           └─ update profiles.subscription_* in Supabase
                                └─ AI routes check subscription before calling Claude
```

### Billing portal (manage / cancel)
```
"Manage billing" link
  └─ POST /api/billing/portal               (creates Stripe Billing Portal Session)
       └─ redirect → Stripe hosted portal
```

---

## 4. Data Model Changes

### `profiles` additions
```sql
stripe_customer_id    text unique           -- Stripe customer ID (cus_xxx)
subscription_status   text default 'free'  -- 'free' | 'active' | 'past_due' | 'cancelled'
subscription_tier     text default 'free'  -- 'free' | 'pro'
subscription_ends_at  timestamptz           -- current period end (for cancelled subs)
```

RLS remains `USING (user_id = auth.uid())` — no change.

**Migration file:** `supabase/migrations/20260514010000_billing_columns.sql`

---

## 5. New API Routes

### `POST /api/billing/checkout`
- **Auth:** required (redirect to `/` if no session)
- **Action:** calls `stripe.checkout.sessions.create` with `mode: 'subscription'`, the Pro price ID, and `customer_email` from `profiles`
- **Returns:** `{ url }` — the Stripe Checkout hosted URL; client redirects
- **On success:** Stripe fires `checkout.session.completed` webhook

### `POST /api/billing/portal`
- **Auth:** required
- **Action:** looks up `profiles.stripe_customer_id`, calls `stripe.billingPortal.sessions.create`
- **Returns:** `{ url }` — redirect to Stripe portal

### `POST /api/webhooks/stripe`
- **Auth:** none (public endpoint) — **must** verify `Stripe-Signature` header with `stripe.webhooks.constructEvent`
- **Events handled:**

| Event | Action |
|---|---|
| `checkout.session.completed` | Set `subscription_status = 'active'`, `subscription_tier = 'pro'`, store `stripe_customer_id` |
| `customer.subscription.updated` | Sync `subscription_status` and `subscription_ends_at` |
| `customer.subscription.deleted` | Set `subscription_status = 'cancelled'`, keep `subscription_tier = 'pro'` until `subscription_ends_at` |
| `invoice.payment_failed` | Set `subscription_status = 'past_due'` |

- **Security:** reject any request where `stripe.webhooks.constructEvent` throws. Return `400`.
- **Idempotency:** use `event.id` — safe to process the same event twice.

---

## 6. Subscription Gate

The following routes must check subscription status **before** calling the Anthropic API:

- `POST /api/process/[uploadId]` — categorisation
- `GET /api/insights/[uploadId]` — insights generation

### Constants
```typescript
const FREE_TIER_UPLOAD_LIMIT = 1          // lifetime uploads allowed on free tier
const FREE_TIER_TRANSACTION_LIMIT = 1000  // max rows in the single free upload
```

### Gate logic
```typescript
// Pseudocode — see src/lib/billing/gate.ts
const profile = await getProfile(userId)

if (profile.subscription_status === 'past_due') {
  return NextResponse.json({ error: 'payment_required' }, { status: 402 })
}

// Free tier: one lifetime trial upload (≤ 1,000 transactions)
if (profile.subscription_tier === 'free') {
  const totalUploads = await countTotalUploads(userId)
  if (totalUploads >= FREE_TIER_UPLOAD_LIMIT) {
    return NextResponse.json({ error: 'upgrade_required' }, { status: 402 })
  }
  // Enforce row cap — checked before processing begins
  if (isProcessRoute && rowCount > FREE_TIER_TRANSACTION_LIMIT) {
    return NextResponse.json({ error: 'row_limit_exceeded' }, { status: 402 })
  }
  // Insights blocked on free tier
  if (isInsightsRoute) {
    return NextResponse.json({ error: 'upgrade_required' }, { status: 402 })
  }
}
```

**Helper file:** `src/lib/billing/gate.ts`

---

## 7. UI Changes

### Dashboard — upgrade prompt
- When `subscription_tier === 'free'` and `totalUploads >= 1`: show a persistent banner
  - `"You've used your free trial. Upgrade to Pro for unlimited uploads + savings insights."`
  - CTA: `"UPGRADE — $8/MO"` → calls `/api/billing/checkout`

### Dashboard / Settings — billing management
- When `subscription_status === 'active'`: show `"MANAGE BILLING"` link in top nav or settings page
  - Calls `/api/billing/portal`

### Upload wizard — gate on Step 3 confirm
- Before submitting, client checks free trial status via a lightweight `/api/billing/status` endpoint
  - Returns `{ trialUsed: boolean, rowLimit: number | null }`
- If trial already used: block Step 3 with upgrade CTA inline
- If `rowLimit` applies and the parsed CSV exceeds 1,000 rows: show inline warning
  - `"Your free trial supports up to 1,000 transactions. This file has X rows — upgrade to import all of them."`
  - Allow import of first 1,000 rows as a fallback option

---

## 8. Environment Variables

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...` / `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from Stripe webhook endpoint (`whsec_...`) |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for the Pro monthly plan (`price_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key (only needed if using Stripe.js client-side) |

Add all to `.env.local` for development and to Vercel environment variables for production.

---

## 9. Stripe Setup Checklist

- [ ] Create Stripe account (test mode first)
- [ ] Create a Product: "SpendLens Pro" with a recurring monthly price of $8
- [ ] Copy the `price_xxx` ID → `STRIPE_PRO_PRICE_ID`
- [ ] Create a Webhook endpoint in Stripe dashboard pointing to `https://your-domain.com/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`
- [ ] For local dev: use [Stripe CLI](https://stripe.com/docs/stripe-cli) `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

## 10. Security Notes

- **Never** expose `STRIPE_SECRET_KEY` to the browser. It is server-only.
- **Always** verify the webhook signature — do not trust event data that fails `constructEvent`.
- The `/api/webhooks/stripe` route must be excluded from CSRF protection (it is a raw POST from Stripe, not a form). In Next.js App Router this is the default for API routes.
- Use `stripe.webhooks.constructEvent` with the raw request body — do **not** parse it with `JSON.parse` before passing to Stripe.

---

## 11. Testing

- Use Stripe test mode keys during development (`sk_test_...`, `pk_test_...`)
- Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (payment failed)
- Use the Stripe CLI to replay webhook events: `stripe events resend evt_xxx`
- Unit test `src/lib/billing/gate.ts` with mocked profile data
- Integration test the webhook handler with a mocked `stripe.webhooks.constructEvent`
