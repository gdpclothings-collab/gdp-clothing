import test from "node:test";
import assert from "node:assert/strict";
import { redeemWelcomeOrder } from "../supabase/functions/stripe-webhook/welcome-redemption-adapter.mjs";
const order = { id: "order-1", discount_code: "WELCOME10", payment_status: "paid" };
const verified = { signedStripeEventVerified: true, paymentLinkVerified: true, integrationEnabled: true, signedPaidAt: "2026-10-12T18:00:00.000Z" };
test("ordinary coupons are unaffected", async () => {
  const result = await redeemWelcomeOrder({ order: { ...order, discount_code: "SAVE5" } });
  assert.equal(result.handled, false);
});
test("disabled by default", async () => {
  const result = await redeemWelcomeOrder({ order, orderId: order.id });
  assert.equal(result.redeemed, false);
});
test("signed Stripe event and payment link both required", async () => {
  let calls = 0;
  const service = { rpc: async () => { calls++; return { data: { redeemed: true } }; } };
  const result = await redeemWelcomeOrder({ service, order, orderId: order.id, integrationEnabled: true, paymentLinkVerified: true });
  assert.equal(result.redeemed, false);
  assert.equal(calls, 0);
});
test("paid order ID must match", async () => {
  const result = await redeemWelcomeOrder({ ...verified, service: { rpc: async () => ({ data: { redeemed: true } }) }, order, orderId: "wrong" });
  assert.equal(result.redeemed, false);
});
test("dedicated RPC success", async () => {
  const service = { rpc: async (name, args) => {
    assert.equal(name, "redeem_welcome10_coupon");
    assert.deepEqual(args, { p_order_id: order.id, p_signed_paid_at: verified.signedPaidAt });
    return { data: { redeemed: true, existing: false } };
  }};
  const result = await redeemWelcomeOrder({ ...verified, service, order, orderId: order.id });
  assert.equal(result.redeemed, true);
});
test("RPC errors require reconciliation", async () => {
  const service = { rpc: async () => ({ error: { message: "offline" } }) };
  const result = await redeemWelcomeOrder({ ...verified, service, order, orderId: order.id });
  assert.equal(result.reason, "reconciliation_required");
});
test("RPC exception requires reconciliation", async () => {
  const service = { rpc: async () => { throw new Error("offline"); } };
  const result = await redeemWelcomeOrder({ ...verified, service, order, orderId: order.id });
  assert.equal(result.reason, "reconciliation_required");
});
