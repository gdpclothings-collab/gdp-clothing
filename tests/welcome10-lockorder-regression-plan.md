# WELCOME10 lock-order regression gates (review only)

## Required invariant
Every function that can lock an order and campaign discount must lock **orders before discounts**. The dedicated reservation draft now follows this order, matching the current legacy redemption RPC. This is not proof that other RPCs or triggers follow it.

## Disposable PostgreSQL tests
1. Two simultaneous WELCOME10 reservations for different orders with the same normalized email: exactly one succeeds.
2. Two simultaneous reservations with the same user_id and different emails: exactly one succeeds.
3. Reserve same order twice: idempotent; only one hold.
4. Reserve WELCOME10 while legacy redeem attempts the same order: no 40P01 deadlock; legacy WELCOME10 path rejects.
5. Reserve WELCOME10 while another order's reservation expires: no deadlock or double use.
6. Legacy ordinary coupon reserve/redeem continues working unchanged.
7. Simulate serialization waits with lock_timeout and deadlock_timeout in disposable database.
8. Inspect release_order_coupon_reservation, cleanup functions, triggers, and webhook paths for inverted lock order.
9. Verify identity proof and first-paid-order eligibility server-side, not browser-controlled.
10. Do not merge or deploy until tests and schema/permission review pass.

## Known blockers
- Dedicated redemption function and verified Stripe linkage not yet wired.
- Existing WELCOME10 reservation draft depends on server-provided email verification; database cannot independently prove ownership.
- Existing legacy reservation guard draft must be tested against real schema.
- All SQL files under docs/sql-drafts are **not migrations** and must not be run in production.
