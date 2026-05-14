-- Billing and subscription state on profiles.
--
-- This migration prepares the Stripe-backed monetisation rollout by adding
-- customer and subscription metadata used by API billing gates and webhooks.
--
-- Design notes:
-- - Keep defaults on free tier/status so all existing users remain valid.
-- - Keep `subscription_ends_at` nullable because it only applies to ended/cancelled periods.
-- - Keep RLS unchanged because `profiles` policies already scope rows to auth.uid().

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text not null default 'free',
  add column if not exists subscription_tier text not null default 'free',
  add column if not exists subscription_ends_at timestamptz;

-- Explicitly constrain accepted billing states.
alter table public.profiles
  drop constraint if exists profiles_subscription_status_check,
  add constraint profiles_subscription_status_check
    check (subscription_status in ('free', 'active', 'past_due', 'cancelled')),
  drop constraint if exists profiles_subscription_tier_check,
  add constraint profiles_subscription_tier_check
    check (subscription_tier in ('free', 'pro'));

-- One Stripe customer ID must map to one profile.
create unique index if not exists profiles_stripe_customer_id_unique_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.profiles.stripe_customer_id
  is 'Stripe Customer ID (cus_...) for linking billing records.';

comment on column public.profiles.subscription_status
  is 'Billing status: free, active, past_due, or cancelled.';

comment on column public.profiles.subscription_tier
  is 'Plan tier: free or pro.';

comment on column public.profiles.subscription_ends_at
  is 'Current period end timestamp for cancelled/ending subscriptions.';
