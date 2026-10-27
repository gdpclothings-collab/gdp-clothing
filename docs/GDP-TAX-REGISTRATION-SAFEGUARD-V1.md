# GDP-TAX-REGISTRATION-SAFEGUARD-V1 — release gate (draft; not for deployment)

## Scope and evidence (2026-10-27)
- GitHub isolated branch only; no database writes, tax-rule updates, checkout service deployment, live payment changes, or real payments are authorized by this patch.
- `store_settings.payment_mode = live` stays unchanged. Stripe webhook, idempotency, inventory reservations, design locks, production release gates, and 300-DPI production layout code are unchanged.
- Both rows in `finance_tax_registration_settings` currently show `registered = false`, no account number, and no effective date. These application records are not proof that either tax is legally inapplicable.
- Saskatchewan rule: GST 5% on merchandise plus qualifying shipping and PST 6% on merchandise (shipping excluded only when separately stated, reasonable and Saskatchewan-origin).
- Historical example GDP-15528189-8701: merchandise CAD 35.99 + shipping CAD 12.99 + GST CAD 2.45 + PST CAD 2.16 = CAD 53.59; failed live payment, not paid.

## Safety behavior proposed
1. Server uses true checkout tax jurisdiction (Saskatoon pickup = SK; shipping uses destination).
2. Taxable merchandise and coupon allocations are calculated by the server using trusted product.taxable fields and server-calculated discounts.
3. If tax is chargeable and the applicable registration record is absent, `registered` is not true, account number is blank, or the effective date is future/invalid, checkout and quote return HTTP 503 without an order or charge. Do **not** silently drop GST/PST; an unregistered GST small supplier, for example, needs a separately verified non-collecting policy before allowing an untaxed live sale.
4. Mixed taxability with paid shipping, or mixed taxability with preview discounts that cannot be allocated authoritatively, is held for review rather than guessed. Ordinary all-taxable (the current 15 catalog products) uses the established tax computation when registration is verified.
5. Frontend waits for the authoritative quote, shows an explicit paused message and disables Continue/Pay. Stripe and storefront payment mode remain untouched.

## Mandatory release gates (all currently pending)
- Confirm Saskatchewan PST vendor licence, PST account number and effective date through SETS/Ministry. A submission confirmation number is insufficient proof.
- Confirm CRA GST/HST status: registered with effective date and account number, **or** legally documented small-supplier status and an explicitly reviewed non-collecting configuration. Do not fabricate a GST account.
- Obtain tax/accounting review of PST application to GDP DTF films, print services, shipping, free shipping, and out-of-province shipments. Flag mixed-product taxable/exempt/zero-rated orders for classification before enabling those scenarios.
- Run `npm run test:tax-safeguard`, `node scripts/verify-payment-confirmation-authority.mjs`, `node scripts/verify-checkout-terms-hotfix.mjs`, production/print parity regressions, `npm run lint`, `npm run typecheck`, and `npm run build`. Run mobile and desktop preview quote cases for SK shipping, SK pickup with ON billing, ON delivery, no-account, expired/future accounts, taxable/non-taxable product mix, targeted coupons, and simultaneous Pay clicks.
- Test a **sandbox** purchase in a private preview/controlled environment only. Verify Stripe event, Supabase paid state, approved design, 300-DPI export, and admin status. No real charge authorized.
- Deploy Supabase `checkout` Edge Function **with the new imported helper modules** and the reviewed frontend as a coordinated release; uncoordinated frontend/backend deployments can show stale taxes. Do not merge, publish, deploy, or change tax records without separate approval.
- Maintain rollback to known-good code. Do not use a live purchase as the smoke test.

## Government references
- Saskatchewan PST application: https://www.saskatchewan.ca/business/taxes-licensing-and-reporting/provincial-taxes-policies-and-bulletins/provincial-sales-tax/apply-for-a-pst-number
- CRA GST/HST registration and threshold: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html
- CRA GST/HST place of supply and rates: https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-place-supply.html
- Saskatchewan PST freight bulletin: https://sets.saskatchewan.ca/rptp/wcm/connect/982c7d32-722d-45f1-8195-cfe002836037/IN%2B2023-04%2BFreight%2Band%2BDelivery%2BServices.pdf?MOD=AJPERES
