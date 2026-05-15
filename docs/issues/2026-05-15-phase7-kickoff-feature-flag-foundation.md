# Issue: Phase 7 kickoff — feature-flag foundation for receipt analysis

## Estimate

- Engineering: 4–8 hours
- Review + QA: 2–4 hours

## Scope

- Add `profiles.feature_flags` (`jsonb`, default `{}`) to support per-user feature rollout
- Add server-side `hasFlag(profile, flag)` helper
- Gate initial receipts route and top-nav exposure behind `receipt_analysis`
- Add focused tests for flag evaluation

## Acceptance Criteria

- `hasFlag({ feature_flags: { receipt_analysis: true } }, 'receipt_analysis')` returns `true`
- All non-boolean or missing values return `false`
- Users without `receipt_analysis` cannot access `/dashboard/receipts`
- Users with `receipt_analysis` can access `/dashboard/receipts`
