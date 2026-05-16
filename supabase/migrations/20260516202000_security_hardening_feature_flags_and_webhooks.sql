-- Security hardening follow-ups from review thread:
-- 1) Prevent self-service toggling of rollout feature flags.
-- 2) Lock down execution of security-definer webhook status function.

REVOKE UPDATE(feature_flags) ON TABLE public.profiles FROM anon, authenticated;
GRANT UPDATE(feature_flags) ON TABLE public.profiles TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_stripe_webhook_event(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stripe_webhook_event(text, text, text) TO service_role;
