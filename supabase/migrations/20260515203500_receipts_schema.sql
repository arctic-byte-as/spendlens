-- Phase 7: receipt analysis storage foundation

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  receipt_id text not null,
  date timestamptz not null,
  store text not null,
  chain text not null,
  total_amount numeric(12,2) not null,
  total_bonus numeric(12,2) not null default 0,
  savings_summary jsonb,
  currency text not null default 'NOK',
  imported_at timestamptz not null default now(),
  unique (user_id, receipt_id)
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  receipt_id text not null,
  item_guid text not null,
  name text not null,
  quantity numeric(12,3) not null,
  unit text,
  total_price numeric(12,2) not null,
  bonus numeric(12,2) not null default 0,
  bonus_percent numeric(6,2) not null default 0,
  vat_percent numeric(6,2) not null default 0,
  is_unknown boolean not null default false,
  savings_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, receipt_id, item_guid)
);

create index if not exists idx_receipts_user_date on public.receipts (user_id, date desc);
create index if not exists idx_receipts_user_chain on public.receipts (user_id, chain);
create index if not exists idx_receipt_items_user_name on public.receipt_items (user_id, name);

alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

drop policy if exists "Users can select own receipts" on public.receipts;
create policy "Users can select own receipts" on public.receipts
  for select using (user_id = auth.uid());

drop policy if exists "Users can insert own receipts" on public.receipts;
create policy "Users can insert own receipts" on public.receipts
  for insert with check (user_id = auth.uid());

drop policy if exists "Users can update own receipts" on public.receipts;
create policy "Users can update own receipts" on public.receipts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can delete own receipts" on public.receipts;
create policy "Users can delete own receipts" on public.receipts
  for delete using (user_id = auth.uid());

drop policy if exists "Users can select own receipt items" on public.receipt_items;
create policy "Users can select own receipt items" on public.receipt_items
  for select using (user_id = auth.uid());

drop policy if exists "Users can insert own receipt items" on public.receipt_items;
create policy "Users can insert own receipt items" on public.receipt_items
  for insert with check (user_id = auth.uid());

drop policy if exists "Users can update own receipt items" on public.receipt_items;
create policy "Users can update own receipt items" on public.receipt_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can delete own receipt items" on public.receipt_items;
create policy "Users can delete own receipt items" on public.receipt_items
  for delete using (user_id = auth.uid());
