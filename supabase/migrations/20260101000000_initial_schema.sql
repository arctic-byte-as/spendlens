-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- profiles
create table public.profiles (
  id           uuid references auth.users on delete cascade primary key,
  email        text,
  display_name text,
  created_at   timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (id = auth.uid());
create policy "Users can update own profile" on public.profiles
  for update using (id = auth.uid());
create policy "Users can insert own profile" on public.profiles
  for insert with check (id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- uploads
create table public.uploads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade not null,
  filename     text not null,
  uploaded_at  timestamptz default now(),
  row_count    int,
  status       text default 'processing' check (status in ('processing', 'done', 'error')),
  storage_path text
);
alter table public.uploads enable row level security;
create policy "Users can manage own uploads" on public.uploads
  for all using (user_id = auth.uid());

-- transactions
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade not null,
  upload_id    uuid references public.uploads(id) on delete cascade,
  date         date not null,
  description  text,
  amount       numeric(12,2) not null,
  currency     text default 'NOK',
  category     text,
  subcategory  text,
  merchant     text,
  is_recurring boolean default false,
  notes        text,
  created_at   timestamptz default now()
);
alter table public.transactions enable row level security;
create policy "Users can manage own transactions" on public.transactions
  for all using (user_id = auth.uid());

-- insights
create table public.insights (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  upload_id       uuid references public.uploads(id) on delete cascade,
  generated_at    timestamptz default now(),
  period_start    date,
  period_end      date,
  summary_json    jsonb,
  top_saving_tips jsonb
);
alter table public.insights enable row level security;
create policy "Users can manage own insights" on public.insights
  for all using (user_id = auth.uid());
