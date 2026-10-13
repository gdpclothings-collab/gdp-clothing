# WELCOME10 — isolated redemption specification

Status: DESIGN ONLY. Do not execute this against production or enable the popup.
Existing `discount-rules.mjs` deliberately returns false for WELCOME10.

## Contract

- Discount: 10% of eligible merchandise subtotal, maximum CAD 15.
- Only for a customer's first **paid** order, never a second order.
- No stacking with apparel quantity, product, collection, or other promotions.
- Shipping and taxes are excluded from the eligible subtotal.
- Never trust a browser-supplied `firstOrder` flag, customer ID, or email verification.
- Preserve existing coupons, order lifecycle, inventory reservations, and webhook idempotency.

## Identity and eligibility

Authenticated: server-verified auth user ID and verified account email.
Guest: normalized email **plus a verified ownership challenge** before any first-order benefit; email typed into checkout alone is insufficient. A guest who cannot verify ownership must not receive WELCOME10.
A matching prior paid order for either verified identity makes the offer ineligible.
A customer may have multiple email aliases; a verified email alone does not guarantee one redemption per human. Document that limitation and consider additional abuse signals without blocking legitimate households.

## Proposed data model (not migration SQL)

Private welcome_redemptions table:
- id UUID primary key
- campaign_code, normalized_email_hash, auth_user_id nullable
- order_id unique nullable; checkout_session_id nullable
- state: reserved | redeemed | released
- reservation_expires_at, redeemed_at, created_at, updated_at
- unique active reservation/redemption per verified identity and campaign, enforced transactionally

Do not expose the table through the public Data API. Service-only access via a narrowly scoped private transactional RPC. Avoid storing plaintext email in this table.

## Atomic operations

1. validate: read campaign configuration, server-computed cart discounts, verified identity, and prior paid orders; return ineligible on any uncertainty.
2. reserve: within a database transaction, serialize on a campaign+identity key, recheck paid-order history, and acquire an expiring reservation bound to the order. Repeated calls for the same order must be idempotent.
3. checkout: only apply WELCOME10 if the reservation succeeded; never silently apply the discount after a failed reservation. Do not count a pending order as redeemed.
4. verified Stripe webhook: idempotently mark reservation redeemed only for a successfully paid order. Tie it to the existing order/Stripe event idempotency boundary.
5. payment failure/expiry: release reservation, retaining paid redemptions forever. Expired reservations must be rechecked before reuse.
6. refunds/cancellations: define policy explicitly; default is not automatically restoring a redeemed welcome offer.

## Release gates

- New and returning authenticated customers
- Verified guest and unverified guest
- Previous paid orders across guest/auth identities
- Concurrent checkouts using same identity
- Repeated Stripe webhook deliveries and out-of-order events
- Expired/failed checkout and retry
- Coupon cap at CAD 15, tax and shipping unaffected
- No stacking with quantity and other promotions
- Legacy coupon/checkout and inventory reservation regression tests
- Admin enable/disable with audited access; no client-controlled eligibility
- Run schema security/RLS advisors, migration rehearsal, build, lint, typecheck, and checkout smoke tests before approval

## Deployment sequence

1. Implement private database migration and transactional tests in disposable local staging.
2. Implement checkout and webhook changes behind server-side feature flag default OFF.
3. Verify rollback and all release gates.
4. Open PR for review; do not merge or deploy without explicit approval.
5. Activate the campaign only after database + backend + frontend are verified together.
