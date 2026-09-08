# GDP Clothing Production Testing

GDP Clothing uses a non-destructive production smoke canary against https://gdpclothing.ca.

## Production Smoke Bot

The GitHub Actions workflow .github/workflows/production-smoke.yml runs:

- after pushes to main, once the matching Cloudflare Pages deployment is successful
- every six hours
- manually through workflow_dispatch

It verifies:

1. Home page render and production security headers.
2. Mobile home layout and horizontal-overflow regression.
3. Published Shop catalog and product discovery.
4. Product detail and variant/customization controls.
5. Empty-cart safety state.
6. Guest checkout surface using a temporary browser-only cart while production checkout API calls are blocked.
7. Custom Studio on desktop and mobile.
8. DTF landing page and both DTF builder modes.
9. Login and registration surfaces.
10. Guest protection for Account and Admin routes.
11. Browser runtime errors and same-origin HTTP 5xx responses.

Screenshots and a JSON/Markdown report are retained as workflow artifacts for seven days.

## Transaction safety boundary

The production canary intentionally does not:

- submit a live Stripe payment
- create a paid production order
- upload customer artwork
- generate production files
- modify inventory
- change admin settings

A true payment-to-webhook-to-order test should run in a staging environment connected to Stripe test mode and a separate Supabase staging project. This gives full transaction coverage without creating live charges or polluting production order/inventory data.

## Recommended release gate

Before merging:

1. Build verification passes.
2. Typecheck and lint pass.
3. Security scan passes.
4. Cloudflare Pages preview check passes.

After merge/deploy:

1. Cloudflare Pages reports a successful production deployment for the merged commit.
2. Production Smoke Bot passes.
3. Supabase project is healthy and expected Edge Functions are active.
4. Supabase security/performance advisors are reviewed for new warnings.

A production smoke failure should be treated as a release incident until the failure is explained or repaired.
