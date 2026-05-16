-- Security hardening follow-ups from review thread:
-- 1) Prevent self-service toggling of rollout feature flags.
-- 2) Lock down execution of security-definer webhook status function.

revoke update (feature_flags) on table public.profiles from anon, authenticated;
grant update (feature_flags) on table public.profiles to service_role;

revoke execute on function public.mark_stripe_webhook_event(text, text, text) from public, anon, authenticated;
grant execute on function public.mark_stripe_webhook_event(text, text, text) to service_role;
