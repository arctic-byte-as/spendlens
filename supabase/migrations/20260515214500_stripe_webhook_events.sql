-- Phase 7/8 security hardening: webhook idempotency + audit trail

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  livemode boolean not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_stripe_webhook_events_received_at
  on public.stripe_webhook_events (received_at desc);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "No direct access to stripe webhook events" on public.stripe_webhook_events;
create policy "No direct access to stripe webhook events"
  on public.stripe_webhook_events
  for all
  using (false)
  with check (false);

create or replace function public.mark_stripe_webhook_event(
  p_event_id text,
  p_status text,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stripe_webhook_events
  set
    status = p_status,
    error_code = p_error_code,
    processed_at = case
      when p_status in ('processed', 'failed') then now()
      else processed_at
    end
  where event_id = p_event_id;
end;
$$;
