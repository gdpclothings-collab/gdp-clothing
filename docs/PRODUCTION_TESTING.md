# GDP Clothing Production Testing

GDP Clothing uses a layered testing model so live customers can browse and purchase normally while automated checks verify the storefront.

## Level 1 — Production smoke

`.github/workflows/production-smoke.yml` runs:

- after pushes to `main`, once the matching Cloudflare Pages deployment succeeds
- every six hours
- manually through `workflow_dispatch`

The base production canary verifies:

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

## Level 2 — Production wiring canary

The same production workflow also runs `scripts/production-wiring-smoke.mjs` to verify that the connected customer journey is still wired correctly:

1. Home exposes live product links.
2. Home products overlap the published Shop catalog.
3. A Home product card resolves to the matching Product Detail record/title.
4. When a sellable ready-to-wear item is available, the bot selects a real in-stock colour/size combination and adds it to the browser-local cart.
5. The Cart preserves the product identity and exposes Secure Checkout.
6. Cart reaches the Checkout UI and verifies the email, Place Order, and Stripe payment surfaces.

The canary never presses **Place order**. It also blocks write-like requests to checkout, order, inventory/reservation, and payment endpoints. Adding a normal ready-to-wear item to GDP Clothing's cart is browser-local state and does not reserve stock or create an order.

If every candidate product is custom-only or out of stock, the Product → Cart click-through is recorded as a warning/skip instead of falsely failing the store. The remaining Cart → Checkout wiring is still tested with an isolated browser-only canary item.

Screenshots plus JSON/Markdown reports are retained as workflow artifacts for seven days.

## Level 3 — Staging regression gate

`.github/workflows/staging-regression.yml` is manual-only and is intended for deeper regression testing against a dedicated staging environment.

Safety controls:

- it requires a staging URL supplied at run time
- it requires the exact confirmation `RUN_STAGING_REGRESSION`
- `scripts/assert-safe-staging-target.mjs` refuses known GDP production hosts, including `gdpclothing.ca`
- it does not run automatically against live customers

The staging workflow currently runs the full storefront smoke + wiring suite against the staging URL. When GDP has a separate Supabase staging project and Stripe test-mode environment, transactional tests should be added here for payment → webhook → order → inventory behavior.

## Production transaction safety boundary

Production automation intentionally does **not**:

- submit a live Stripe payment
- create a paid production order
- upload customer artwork as a real customer job
- generate fulfillment/production files
- decrement or reserve live inventory
- change Admin settings
- create refunds or cancellations

Real payment, webhook, inventory mutation, refund, and destructive Admin regression tests belong only in the isolated staging environment.

## Release gate

Before merging:

1. Build verification passes.
2. Typecheck/lint/build checks pass where configured.
3. Security scan passes.
4. Cloudflare Pages preview/deployment checks are healthy.

After merge/deploy:

1. Cloudflare Pages reports a successful production deployment for the merged commit.
2. Production Smoke Bot passes.
3. Production Wiring Canary passes or only contains an explained stock-related skip.
4. Supabase project health and expected Edge Functions are checked for backend-impacting releases.
5. New Supabase security/performance warnings are reviewed when schema/functions changed.

A production smoke or wiring failure should be treated as a release incident until the failure is explained or repaired.
