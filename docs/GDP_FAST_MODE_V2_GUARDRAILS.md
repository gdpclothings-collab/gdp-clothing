# FAST MODE v2 guardrails

FAST MODE may shorten feedback loops but may not:
- merge a failing required check;
- treat a deployment as 100% before production smoke;
- modify production Supabase project identity;
- mark guest custom designs ordered/converted before confirmed payment;
- bypass Stripe webhook confirmation or idempotency controls;
- weaken inventory reservation/release correctness;
- skip auth/security validation for RED changes;
- hide a failing regression by deleting the assertion.

When a test is stale, update it to the current stable product contract and retain the behavior assertion.
