-- User-defined custom categories
-- These supplement the canonical list in src/lib/transactions/categories.ts and
-- are passed to Claude at categorisation time so the AI can use them on future imports.

create table if not exists public.user_categories (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  created_at  timestamptz not null default now(),

  constraint user_categories_name_length check (char_length(name) between 1 and 50),
  unique (user_id, name)
);

alter table public.user_categories enable row level security;

create policy "Users manage own categories"
  on public.user_categories
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
