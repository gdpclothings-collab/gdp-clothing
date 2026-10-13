import test from "node:test";
import assert from "node:assert/strict";
import { checkWelcomePaidOrderReservation } from "../supabase/functions/stripe-webhook/welcome-redemption-preflight.mjs";
function fakeService(row, error = null) {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error }) }) }) }) };
}
test("existing coupons bypass welcome preflight", async () => {
  assert.equal((await checkWelcomePaidOrderReservation({ order: { discount_code: "OTHER10" } })).ok, true);
});
test("missing welcome reservation fails closed", async () => {
  const result = await checkWelcomePaidOrderReservation({ service: fakeService(null), order: { id: "a", discount_code: "WELCOME10" } });
  assert.equal(result.reason, "reservation_missing");
});
test("released welcome reservation fails closed", async () => {
  const result = await checkWelcomePaidOrderReservation({ service: fakeService({ status: "released" }), order: { id: "a", discount_code: "WELCOME10" } });
  assert.equal(result.ok, false);
});
test("active welcome reservation passes preliminary webhook preflight", async () => {
  const result = await checkWelcomePaidOrderReservation({ service: fakeService({ status: "active", expires_at: "2026-10-12T00:00:00Z", discount_id: "d" }), order: { id: "a", discount_code: "WELCOME10" } });
  assert.equal(result.reason, "reservation_present_requires_atomic_redemption");
});
