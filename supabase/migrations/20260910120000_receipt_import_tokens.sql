-- Phase 7/8: scoped import tokens for cross-origin Trumf receipt import (bookmarklet flow).
-- See specs/trumf_import_tokens_bookmarklet.md for design/rationale.

create table if not exists public.import_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  token_hash text not null unique,
  token_prefix text not null,
  scope text not null default 'receipts:import' check (scope = 'receipts:import'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  request_count integer not null default 0
);

create index if not exists idx_import_tokens_user_id on public.import_tokens (user_id);

alter table public.import_tokens enable row level security;

drop policy if exists "Users can select own import tokens" on public.import_tokens;
create policy "Users can select own import tokens" on public.import_tokens
  for select using (user_id = auth.uid());

drop policy if exists "Users can update own import tokens" on public.import_tokens;
create policy "Users can update own import tokens" on public.import_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Issuing (insert) and hard-deleting tokens is service-role only: token minting and
-- revocation bookkeeping goes through the server route using createAdminClient(),
-- mirroring how 20260516202000 locks down profiles.feature_flags writes.
revoke insert, delete on table public.import_tokens from anon, authenticated;
grant insert, delete on table public.import_tokens to service_role;
