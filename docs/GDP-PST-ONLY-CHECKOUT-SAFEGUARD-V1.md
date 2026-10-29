# GDP-PST-ONLY-CHECKOUT-SAFEGUARD-V1 — isolated implementation and release gate

## Verified business information (2026-10-29)
- Owner reports approximately CAD $500 total GDP Clothing sales since March 2026, no CRA GST/HST registration, and an issued Saskatchewan PST vendor account.
- Owner-supplied SETS screenshot displays **ACTIVE** Saskatchewan Provincial Sales Tax / Vendor licence. The licence issue date is 2026-10-04, but the **effective begin date is blank**, and the PST filing schedule remains unverified. Do not assume the issue date equals the tax collection effective date.
- The owner's revenue estimate is consistent with CRA small-supplier status if it includes all relevant worldwide taxable supplies and associated entities. This is not independent CRA verification.
- No account number, business PIN, or tax credential is included in this repository.

## Proposed behavior — off until explicitly approved
- The Supabase `checkout` Edge Function accepts the server-only setting `GDP_CHECKOUT_TAX_POLICY=sk_pst_only_small_supplier`, **only** with valid `GDP_GST_SMALL_SUPPLIER_REVIEWED_ON=YYYY-MM-DD` and `GDP_GST_SMALL_SUPPLIER_EXPIRES_ON=YYYY-MM-DD`. A review cannot authorize more than 93 days of non-collection and must not be expired or future-dated.
- The GST/HST finance row must explicitly be `registered=false` without an account number. The PST finance row must be `registered=true` with a nonblank account number and a valid, currently effective registration date. No registration records are written by this patch.
- Saskatchewan pickup and shipments to Saskatchewan use merchandise PST at 6%, no GST/HST, and the existing reviewed rule that excludes separately stated Saskatchewan-origin shipping from PST. Tax breakdown stores `policy=gst_small_supplier_pst_only`; `gst_hst_tax=0`, `pst_tax` and total come from one server quote before order creation. The customer sees **Saskatchewan PST (6%)**.
- Out-of-province delivery, missing/expired policy, incorrect tax components, mixed taxable/exempt goods with paid shipping, missing PST registration or unverified classification produce a tax-review `503`, with no order creation or payment attempt. These require a separate tax jurisdiction review. No client-supplied tax switches are accepted.
- With no `GDP_CHECKOUT_TAX_POLICY` setting, existing registered GST/PST collection checks remain unchanged. There is no implicit tax exemption from `registered=false` alone.
- Stripe Live Mode, signed webhook reconciliation, idempotency, reservations, discounts, approved designs, production gate and 300-DPI artwork generation are unchanged.

## Required before any production authorization
1. Verify the vendor licence **effective begin date** directly with Saskatchewan Ministry of Finance and confirm the SETS filing schedule; do not enter the public licence number or PIN into source code.
2. Confirm all relevant business and associated-person taxable revenue stays below CRA's $30,000 small-supplier threshold; set a revenue monitor and calendar for renewal of the time-limited review policy. Have a tax professional review first if uncertain.
3. Get business-specific PST classification for GDP garments, DTF film transfers/services, shipping, discounts and pickup. For destinations outside SK, determine provincial sales-tax obligations and add reviewed rules before enabling those shipments.
4. In a separately authorized secure administrative workflow, configure PST finance registration (account, effective date, filing frequency), and keep the GST registration row unregistered. No direct production SQL updates authorized here.
5. Run build, lint, TypeScript, `npm run test:tax-safeguard`, `npm run test:pst-only-safeguard`, checkout/payment reconciliation and print-parity suites. Test both SK shipping and local pickup in a protected preview with Stripe **test** cards and simulated failures, no live paid transaction.
6. Review coordinated Supabase Edge Function + Cloudflare frontend release, deployment of the imported helper, rollback, and tax setting activation with explicit separate permission. Do not merge, deploy, alter Stripe Live Mode or activate tax collection as part of this branch.

## Example server quote
- Taxable garment CAD $35.99 + separately stated shipping CAD $12.99 + PST CAD $2.16 + GST CAD $0.00 = CAD $51.14. This assumes approved SK freight rules, no coupon, and a current PST licence.

## Local regression execution (2026-10-29)
- **PASS** `npm ci --ignore-scripts --no-audit --no-fund`, `npm run build`, `npm run lint`, `npm run typecheck`, `git diff --check`.
- **PASS** `npm run test:pst-only-safeguard` and `npm run test:tax-safeguard`: SK shipment, pickup (including ON billing), coupon allocation, GST zero, 6% PST, valid/invalid PST registration, effective-date guard, expired/missing small-supplier policy, out-of-province fail-closed, trusted order total, 300-DPI source invariant.
- **PASS** `verify-payment-confirmation-authority`, `verify-checkout-terms-hotfix`, `verify-payment-fast-start`, `verify-michaels-style-payment`, `verify-production-hardening`, `verify-admin-payment-health`, `verify-checkout-shipping-zones`, `verify-checkout-shipping-profiles`, `verify-invoice-checkout-isolation`, `verify-invoice-ledger`, `verify-production-bypass-v2`, `verify-admin-production-files`, `verify-custom-studio-print-pipeline`, `verify-dtf-nesting` (25 checks), `verify-product-variants`, `verify-memorial-tribute`, `check-tax-breakdown`.
- Corrected an old `verify-payment-fast-start` source assertion so it checks the existing **additional tax-quote guard** on the Pay button. No payment behavior changed for this test repair.
- Build emitted one pre-existing circular chunk warning (`admin-products`/`admin-shared`); no build failure.
- **Not executed:** controlled browser checkout, actual Stripe test PaymentIntent/webhook-to-order reconciliation, Cloudflare preview, Supabase Edge Function deployment, visual/pixel comparison of actual 300-DPI production exports. Structural production-file regressions are not equivalent to production render parity.
- **Release: NO-GO.** Branch-only. No live tax record edits, Stripe mode changes, paid tests, production merge or deployment. Admin finance alignment may still report a GST rule/config mismatch until the non-collection policy and filing setup are reviewed together.

## Sources
- CRA GST/HST small supplier: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html
- Saskatchewan PST: https://www.saskatchewan.ca/Business/Taxes-Licensing-and-Reporting/Provincial-Taxes-Policies-and-Bulletins/Provincial-Sales-Tax
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
