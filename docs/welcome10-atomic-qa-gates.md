# WELCOME10 atomic and webhook release gates

Status: **BLOCKED**. This is a QA specification, not evidence of passing tests.
No production SQL, Stripe event, merge, or deployment is authorized by this document.

## Database race tests (disposable PostgreSQL 17 only)

Create synthetic accounts, orders, a WELCOME10 discount row, and reservations. Run two independent SQL sessions with an explicit barrier so both calls overlap.

| Scenario | Expected result |
| --- | --- |
| Two pending orders, same normalized verified email, concurrent reservation | Exactly one active reservation; other fails |
| Two orders for same user ID but differing verified emails | Exactly one active reservation |
| Two orders for same email but different user IDs | Exactly one active reservation |
| Existing paid order (any discount or none) | Welcome reservation rejected |
| Existing consumed WELCOME10 redemption | Welcome reservation rejected |
| Same order retries active reservation | Idempotent; one row |
| Reservation expires, payment never succeeded | New reservation may succeed after cleanup |
| Payment succeeded before hold expiry, webhook arrives late | Must not incorrectly release/reassign redeemed identity |
| Guest email not verified | Checkout rejects before calling RPC |
| Wrong discount ID or inactive coupon | Rejected |
| Concurrent WELCOME10 with global usage limit of one | Exactly one active reservation |
| Simultaneous Stripe success and expiry/release | Paid order is reconciled; no double redemption |
| Repeated signed Stripe event | Exactly one redemption and usage increment |
| Stripe test event vs live order | Environment mismatch rejected |
| Ordinary coupons | Existing checkout and redemption unchanged |

## Findings from code review

1. The SQL draft serializes reservation attempts with `SELECT ... FOR UPDATE` on the discount row. This is a design argument, **not an executed concurrency test**.
2. `p_verified_email` is caller-supplied. The service-only RPC permission limits direct browser access but does not establish guest email ownership. Require a server-side verified identity proof.
3. `reserve_welcome10_coupon` checks previous paid orders and WELCOME10 redemption history; it does not implement atomic post-payment redemption or reconciliation.
4. The legacy `redeem_order_coupon` function can redeem based on order discount code alone. A dedicated atomic WELCOME10 redemption path or hardened conditional branch is required.
5. The webhook updates `payment_status` to `paid` before invoking coupon redemption and currently logs redemption errors. Do not silently count WELCOME10 as redeemed on an error.
6. The preflight helper is not called by the webhook. A `consumed` reservation is not itself proof of a matching redemption row.
7. Reservation expiry must be coordinated with Stripe payment timestamps and webhook delivery lag; never assume an expired hold means Stripe did not collect payment.
8. Test-mode and live-mode history rules must be specified and verified before launch.

## Release decision

**NO-GO** until PostgreSQL concurrency tests, verified identity, webhook integration, atomic redemption/idempotency, payment reconciliation, and checkout regression gates pass.

Default-off WELCOME10 guards must remain intact. No production database modifications or deployment without explicit approval.
