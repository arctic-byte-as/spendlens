-- Per-user feature flags for staged rollouts (Phase 7 kickoff).
-- This enables server-side gating of unfinished features like receipt analysis.

alter table public.profiles
  add column if not exists feature_flags jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_feature_flags_is_object_check,
  add constraint profiles_feature_flags_is_object_check
    check (jsonb_typeof(feature_flags) = 'object');

comment on column public.profiles.feature_flags
  is 'Per-user server-side feature flags as JSON object. Example: {"receipt_analysis": true}';
