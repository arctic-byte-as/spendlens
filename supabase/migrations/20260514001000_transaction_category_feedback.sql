alter table public.transactions
  add column if not exists category_source text default 'pending'
    check (category_source in ('pending', 'ai', 'user', 'failed')),
  add column if not exists category_corrected_at timestamptz;
