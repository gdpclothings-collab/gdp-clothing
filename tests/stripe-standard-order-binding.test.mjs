import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyStandardPaymentBinding as verify } from "../supabase/functions/stripe-webhook/standard-payment-binding.mjs";

const order = {
  id: "test-order", total: "35.99", payment_mode: "test", payment_status: "pending",
  stripe_payment_intent_id: "pi_expected", stripe_checkout_session_id: null,
};
const pi = {
  id: "evt_test", type: "payment_intent.succeeded", livemode: false,
  data: { object: {
    id: "pi_expected", amount_received: 3599, currency: "cad",
    metadata: { order_id: "test-order", payment_mode: "test" },
  } },
};
const signed = (event, existing = order) => verify({ event, order: existing, signatureVerified: true });

test("correctly linked signed PaymentIntent with correct amount is accepted", () => {
  assert.deepEqual(signed(pi), { verified: true, paymentIntentId: "pi_expected", eventId: "evt_test" });
});
test("unsigned or forged PaymentIntent is rejected", () => {
  assert.equal(verify({ event: pi, order }).verified, false);
  assert.equal(signed({ ...pi, data: { object: { ...pi.data.object, id: "pi_other" } } }).verified, false);
});
test("incorrect order ID or payment mode is rejected", () => {
  assert.equal(signed({ ...pi, data: { object: { ...pi.data.object, metadata: { order_id: "other", payment_mode: "test" } } } }).verified, false);
  assert.equal(signed({ ...pi, livemode: true }).verified, false);
});
test("amount mismatch, currency mismatch, absent amount, and invalid stored total are rejected", () => {
  assert.equal(signed({ ...pi, data: { object: { ...pi.data.object, amount_received: 1 } } }).verified, false);
  assert.equal(signed({ ...pi, data: { object: { ...pi.data.object, currency: "usd" } } }).verified, false);
  assert.equal(signed({ ...pi, data: { object: { ...pi.data.object, amount_received: undefined } } }).verified, false);
  assert.equal(signed(pi, { ...order, total: "not-a-price" }).verified, false);
});
test("unlinked PaymentIntent cannot finalize an existing Checkout Session order", () => {
  assert.equal(signed(pi, { ...order, stripe_payment_intent_id: null, stripe_checkout_session_id: "cs_expected" }).verified, false);
});
test("linked paid Checkout Session is accepted; wrong session or unpaid session rejected", () => {
  const csOrder = { ...order, stripe_payment_intent_id: null, stripe_checkout_session_id: "cs_expected" };
  const cs = { id: "evt_session", livemode: false, type: "checkout.session.completed", data: { object: {
    id: "cs_expected", payment_intent: "pi_expected", amount_total: 3599, currency: "cad",
    payment_status: "paid", metadata: { order_id: "test-order", payment_mode: "test" },
  } } };
  assert.equal(signed(cs, csOrder).verified, true);
  assert.equal(signed({ ...cs, data: { object: { ...cs.data.object, id: "cs_other" } } }, csOrder).verified, false);
  assert.equal(signed({ ...cs, data: { object: { ...cs.data.object, payment_status: "unpaid" } } }, csOrder).verified, false);
});
test("webhook requires binding on ordinary orders and ignores already-finalized orders", () => {
  const source = readFileSync(new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url), "utf8");
  assert.match(source, /verifyStandardPaymentBinding\(\{ event, order: existing, signatureVerified: true \}\)/);
  assert.match(source, /select\("id,discount_code,payment_mode,payment_status,total,stripe_checkout_session_id,stripe_payment_intent_id,test_inventory_workflow"\)/);
  assert.match(source, /\["paid", "refunded", "partially_refunded"\]\.includes\(existing\?\.payment_status\)/);
  assert.match(source, /await finalizePaidOrder\(service, String\(orderId\), matchedMode, verified\.paymentIntentId\)/);
});
