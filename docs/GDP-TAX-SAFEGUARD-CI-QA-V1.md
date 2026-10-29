# GDP-TAX-SAFEGUARD-CI-QA-V1 — read-only / branch-only QA report
Date: 2026-10-28
Branch: `fix/gdp-tax-registration-safeguard-v1-20261027`
Release decision: **NO-GO** (not merged, not deployed)

## Actual checks executed
- Executed `scripts/verify-gdp-tax-registration-safeguard-v1.mjs` assertions in an isolated JavaScript runtime against freshly fetched branch files. PASS.
- Executed `scripts/verify-payment-confirmation-authority.mjs` (including simulated duplicate Pay, failed card retry, paid-only confirmation and mode normalizers) in an isolated JavaScript runtime. PASS.
- Executed `scripts/verify-checkout-terms-hotfix.mjs` against freshly fetched branch files. PASS.
- Executed `scripts/verify-dtf-nesting.mjs` with original exported DTF nesting and film utilities. PASS (25 nesting checks).
- Executed `scripts/verify-product-variants.mjs` with original exported product/variant utilities. PASS.
- Executed actual extracted `getCheckoutRules()` against a mocked in-memory, read-only tax/shipping data source: SK shipping CAD 4.61 tax on CAD 35.99 + CAD 12.99 shipping; out-of-province customer SK pickup CAD 3.96; ON shipment CAD 6.37; missing PST registration rejected; mixed-taxability with paid shipping rejected; mixed-taxability local pickup CAD 2.20. All PASS. No database writes, orders, charges or live shopping actions.
- Compared GitHub blob SHAs to `main`: `src/lib/dtfGangSheet.js`, `src/lib/dtfNesting.js`, `supabase/functions/stripe-webhook/index.ts`, `checkout-gateway/index.ts`, `payment-session/index.ts`, `payment-preflight/index.ts`, and `src/pages/OrderConfirmation.jsx` are byte-for-byte unchanged. Original checkout DTF 300-DPI source sections and paid-only production default also unchanged.
- Stripe live API read-only: expected webhook endpoint enabled with Checkout/PaymentIntent success/failure events. Latest GDP payment intent `GDP-15528189-8701` (CAD 53.59) = `requires_payment_method`; Supabase order = `failed`. The only Supabase live order in the current records is failed; the six paid orders are in `test` mode.
- Live Supabase settings read-only: `store_settings.payment_mode = 'live'`, `test_inventory_workflow = false`; both finance registrations still have `registered=false`, no account number, no effective date.

## Branch-only defect fixed
- Registration effective date verification accepted impossible dates normalized by JavaScript `Date.parse`, e.g. 2026-02-31. The helper now rejects a non-roundtripping calendar date; explicit regression assertion added. No production configuration changed.

## Checks not executed — *must not* be represented as passed
- Full repository clone, `npm ci`, Vite `npm run build`, `npm run lint`, `npm run typecheck` could not run in this environment because the GitHub repo was only available through file-by-file connector access and the sandbox has no GitHub network access / local repository copy.
- No isolated branch CI workflow run appeared in the currently accessible GitHub status results.
- No browser test against a deployed branch build, payment UI with Stripe sandbox, or actual front/back 300-DPI export byte/pixel comparison. Structural parity of unchanged production files is not equivalent to render parity.
- No write to Stripe, Supabase, Cloudflare, GitHub main; no PR, no merge, no deployment.

## Release blockers
1. Government-verified Saskatchewan PST vendor registration and applicable date are unresolved in the system. A SETS application confirmation alone is not proof of an issued vendor licence.
2. CRA GST/HST status remains unresolved. A qualifying small supplier generally need not register unless it chooses to; before release, tax review must decide registered-collection vs authorized non-collection behavior. **Do not** fabricate an account number or silently charge GST.
3. With current flags both false, **this patch intentionally rejects ordinary taxable GDP checkout before payment**. Deploying it now would halt sales.
4. Mixed GST/PST taxability, DTF service classification, shipping treatment, out-of-province tax obligations and pickup location assumptions require business-specific review.
5. Build/lint/typecheck, actual browser/sandbox checkout, webhook-to-order reconciliation and 300-DPI production visual parity still need a safely isolated runner and documented passing results.
6. Consider coordinated frontend + Supabase checkout Edge Function release only after authorized approval; include new helper file in deployment bundle and have a tested rollback plan. Do not enable Cloudflare preview deployment where it violates the no-deploy instruction.

## Government references
- CRA GST/HST registration and small supplier rules: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html
- Saskatchewan PST registration: https://www.saskatchewan.ca/Business/Taxes-Licensing-and-Reporting/Provincial-Taxes-Policies-and-Bulletins/Provincial-Sales-Tax
- Saskatchewan freight PST treatment: https://sets.saskatchewan.ca/rptp/wcm/connect/982c7d32-722d-45f1-8195-cfe002836037/IN%2B2023-04%2BFreight%2Band%2BDelivery%2BServices.pdf?MOD=AJPERES
