# GDP FAST MODE v2

GDP Clothing uses a risk-aware fast delivery pipeline. Speed must come from targeted validation, parallel independent checks, cached dependencies, and immediate blocker diagnosis — never from bypassing production safety.

## Risk classification

- GREEN: copy, isolated styling, non-critical UI. Run targeted checks, build, deploy, production smoke.
- YELLOW: Custom Studio, cart, shipping, admin, DTF. Run targeted regression plus build/quality/security in parallel, then deploy and smoke.
- RED: checkout, Stripe/payment lifecycle, Supabase/database, authentication, inventory/reservations. Run targeted tests plus critical regressions, build, quality and security. Never bypass these gates.

## Blocker recovery

A failed check is an action trigger, not a waiting state:
1. Capture the exact failed job/step, logs and smoke artifacts.
2. Classify failure as product-code regression, stale/brittle test, infrastructure/transient failure, or deployment propagation.
3. Apply the smallest safe repair on the active branch.
4. Re-run the failed/affected test first.
5. After it passes, run the remaining required risk-tier checks.
6. Merge only when required pre-production gates are green.
7. Deploy to Cloudflare and run production smoke.
8. Declare 100% only after production verification passes.

Independent checks should continue in parallel after another independent check fails so all blockers are known in one cycle.

## Test contracts

Browser smoke tests should prefer stable accessibility roles/names and explicit data attributes over presentation-only class names or headings. Tests must handle known recovery/overlay states such as Custom Studio draft recovery before asserting the underlying workflow.

## Production definition

100% means: implementation complete; targeted tests pass; required regressions pass; build/quality/security gates pass; merged to main; Cloudflare production deployment succeeds; production smoke passes.

## Production safeguards

Production Supabase project is `mcmancxsqlhxnjhlnfkz`. Do not use or modify `ekxdjvwnbrchyyqbhrsq`. Payment conversion, inventory reservation/release, guest-design lifecycle, webhook confirmation, authentication and database changes remain RED-risk and cannot use a shortcut that weakens correctness or idempotency.
