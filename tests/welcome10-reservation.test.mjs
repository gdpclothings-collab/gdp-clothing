import test from "node:test";
import assert from "node:assert/strict";
import { reserveWelcomeOrder } from "../supabase/functions/checkout/welcome-reservation.mjs";

const base = { orderId: "order-1", discountId: "discount-1", expiresAt: "2026-10-13T05:00:00Z" };
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
