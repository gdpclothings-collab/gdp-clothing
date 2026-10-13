import test from "node:test";
import assert from "node:assert/strict";
import { reserveWelcomeOrder } from "../supabase/functions/checkout/welcome-reservation.mjs";

const base = { orderId: "order-1", discountId: "discount-1", expiresAt: "2099-10-13T05:00:00Z", verifiedEmail: "first@example.com" };
test("no verified identity means no reservation RPC", async () => {
  let calls = 0;
  const service = { rpc: async () => { calls++; return { data: true, error: null }; } };
  const result = await reserveWelcomeOrder({ ...base, service, identityVerified: false, paidHistoryChecked: true, atomicIdentityConstraintEnabled: true });
  assert.equal(result.reserved, false);
  assert.equal(calls, 0);
});
test("no atomic database guarantee means no reservation RPC", async () => {
  let calls = 0;
  const service = { rpc: async () => { calls++; return { data: true, error: null }; } };
  const result = await reserveWelcomeOrder({ ...base, service, identityVerified: true, paidHistoryChecked: true, atomicIdentityConstraintEnabled: false });
  assert.equal(result.reserved, false);
  assert.equal(calls, 0);
});
test("RPC failures fail closed", async () => {
  const service = { rpc: async () => ({ data: null, error: { message: "reservation conflict" } }) };
  const result = await reserveWelcomeOrder({ ...base, service, identityVerified: true, paidHistoryChecked: true, atomicIdentityConstraintEnabled: true });
  assert.equal(result.reserved, false);
});

test("successful dedicated atomic RPC returns reserved true", async () => {
  let rpcName = "";
  const service = { rpc: async (name, args) => {
    rpcName = name;
    assert.equal(args.p_verified_email, "first@example.com");
    return { data: { reserved: true }, error: null };
  }};
  const result = await reserveWelcomeOrder({ ...base, service, identityVerified: true, paidHistoryChecked: true, atomicIdentityConstraintEnabled: true });
  assert.equal(rpcName, "reserve_welcome10_coupon");
  assert.equal(result.reserved, true);
});
test("RPC response without confirmed reservation fails closed", async () => {
  const service = { rpc: async () => ({ data: { reserved: false }, error: null }) };
  const result = await reserveWelcomeOrder({ ...base, service, identityVerified: true, paidHistoryChecked: true, atomicIdentityConstraintEnabled: true });
  assert.equal(result.reserved, false);
});
