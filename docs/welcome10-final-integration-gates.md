# WELCOME10 final integration release gates

Status: NO-GO. Review-only. Do not enable promotion, run production SQL, merge, or deploy.

## Verified existing branch
- Checkout explicitly rejects WELCOME10 and validation reports promotion_not_enabled.
- Stripe webhook still invokes generic redeem_order_coupon and logs coupon failures.
- Local synthetic PostgreSQL tests passed sequential assertions, legacy-bypass guards and simultaneous reservation test. They do not prove production-schema behavior.

## Required atomic migration
1. Build dedicated reserve_welcome10_coupon and redeem_welcome10_coupon against exact public schema, with consistent campaign -> order -> reservation lock ordering.
2. Patch existing reserve_order_coupon and redeem_order_coupon to reject WELCOME10 at DB layer. Keep ordinary coupon behavior unchanged.
3. Verify service_role-only EXECUTE and caller identity proof. Do not trust user-supplied verified-email flags.
4. Reject second redemption for same normalized email or user identity; preserve usage-count idempotency.
5. Ensure reservation expiry/release reconciles against Stripe's verified payment timestamps and checkout session/payment intent.
6. Guard direct writes outside RPC paths, including privileges and any trusted service-role code.

## Webhook
- Match signed Stripe event, order ID, payment mode, payment intent/session.
- Route WELCOME10 to dedicated atomic redemption, ordinary coupons to legacy path.
- On redemption failure persist reconciliation-needed state and surface alert; do not merely log success or issue duplicate discounts.
- Handle webhook retries and out-of-order events; verify refunded/cancelled policies.

## QA / deployment
- Run exact-schema disposable Postgres tests including 2+ concurrent sessions, lock-order deadlocks, expired holds, replay, other paid order, usage limit, legacy bypass, normal coupons.
- Run Stripe test-mode signed webhook and retry simulations.
- Check checkout, guest identity, tax/shipping exclusions, 10% up to CAD $15, no stacking, DTF/gangsheet exclusions.
- Review PR and CI; get explicit approval for production migration and later frontend deployment separately.
