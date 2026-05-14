create unique index if not exists transactions_user_fingerprint_idx
  on public.transactions (user_id, date, amount, description, currency);
