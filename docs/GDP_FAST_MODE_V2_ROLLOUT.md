# FAST MODE v2 rollout

The repository-wide rollout is intentionally additive. Existing build verification, quality audit, safe merge and production smoke remain authoritative. FAST MODE v2 adds classification and failure recovery around them instead of deleting safety coverage.

Current rollout sequence:
1. Harden the currently failing Custom Studio smoke contract.
2. Add PR risk classification.
3. Add failed-workflow blocker reporting.
4. Add classifier contract tests.
5. Validate this PR with existing CI.
6. Safe merge.
7. Verify Cloudflare production and production smoke.

This avoids a large CI rewrite while the checkout/payment recovery is fresh in production.
