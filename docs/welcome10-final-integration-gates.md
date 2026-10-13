# WELCOME10 final integration release gates

Status: NO-GO. Integration code committed on isolated feature branch. No production migration, Edge Function deployment, merge, or promotion activation has occurred.

## Verified existing branch
- Checkout explicitly rejects WELCOME10 and validation reports promotion_not_enabled.
- Stripe webhook still invokes generic redeem_order_coupon and logs coupon failures.
- Local synthetic PostgreSQL tests passed sequential assertions, legacy-bypass guards and simultaneous reservation test. They do not prove production-schema behavior.

## Required atomic migration
1. Dedicated reserve_welcome10_coupon and redeem_welcome10_coupon are staged in a proposed migration. Shared lock ordering is order -> discount -> reservation; actual-schema concurrency QA is still required.
2. Patch existing reserve_order_coupon and redeem_order_coupon to reject WELCOME10 at DB layer. Keep ordinary coupon behavior unchanged.
3. Verify service_role-only EXECUTE and caller identity proof in the actual deployed database. Checkout currently requires an authenticated, email-confirmed Supabase account for WELCOME10; verified guest OTP without account creation is NOT implemented.
4. Verify second-redemption prevention for normalized email or user identity, usage-count idempotency, and handling of refunded order history.
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

## Current implementation posture (2026-10-12)
- Popup polls the checkout server's campaign status and remains invisible unless the server setting and an active database campaign both agree.
- Checkout rejects WELCOME10 until WELCOME10_PROMO_ENABLED=true is set server-side. The campaign migration inserts the coupon inactive.
- Only signed-in, email-confirmed Supabase users can currently use the code. Ordinary guest checkout is unchanged; discount eligibility for email-verified guest-only checkout remains a separate feature.
- WELCOME10 excludes DTF/gang-sheet items and rejects other quantity discounts; capped at CAD $15.
- The signed Stripe webhook handles WELCOME10 through a separately verified Checkout session and the dedicated redemption RPC. It queues failed redemptions for reconciliation and returns retryable 500.
- Production deployment is blocked pending disposable PostgreSQL migration tests, signed Stripe test webhooks, Cloudflare release verification, and completion of the guest policy decision.
