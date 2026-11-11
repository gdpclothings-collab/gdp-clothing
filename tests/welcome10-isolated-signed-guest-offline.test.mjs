// WELCOME10 isolated QA only. No Stripe API, Supabase network, database mutation or payment.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { verifyWelcomePaymentBinding } from "../supabase/functions/stripe-webhook/welcome-payment-binding.mjs";
import { verifyGuestWelcomeIdentity } from "../supabase/functions/checkout/welcome-guest-verification.mjs";

// Exercise the actual checked-out webhook's signature verifier, not a copied
// implementation. The selected self-contained functions have only three
// simple TypeScript type annotations removed for Node's isolated VM.
const webhookSource = readFileSync(new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url), "utf8");
const start = webhookSource.indexOf("function hex(bytes: ArrayBuffer) {");
const end = webhookSource.indexOf("async function releaseCheckoutReservations(", start);
assert.ok(start >= 0 && end > start, "Webhook verifier source not found: fail closed");
const verifierCode = webhookSource.slice(start, end).replace(/:\s*(?:ArrayBuffer|string)\b/g, "");
const verifySignature = runInNewContext(verifierCode + "\nverifyStripeSignature", {
  crypto: webcrypto, TextEncoder, Uint8Array,
});

const qaSecret = "whsec_SYNTHETIC_QA_only_not_a_real_Stripe_secret";
const wrongSecret = "whsec_SYNTHETIC_different_mode";
const timestamp = Math.floor(Date.now() / 1000);
const order = {
  id: "qa-order-1", payment_mode: "test", payment_status: "pending",
  stripe_checkout_session_id: "cs_test_qa_1", stripe_payment_intent_id: null,
};
const event = {
  id: "evt_qa_1", type: "checkout.session.completed", created: timestamp, livemode: false,
  data: { object: {
    id: "cs_test_qa_1", payment_intent: "pi_qa_1", payment_status: "paid",
    metadata: { order_id: "qa-order-1", payment_mode: "test" },
  } },
};
const body = JSON.stringify(event);
function signature(raw = body, secret = qaSecret, time = timestamp) {
  const digest = createHmac("sha256", secret).update(String(time) + "." + raw).digest("hex");
  return "t=" + time + ",v1=" + digest;
}

test("actual webhook HMAC verifier accepts fresh synthetic signed event", async () => {
  assert.equal(await verifySignature(body, signature(), qaSecret), true);
});

test("actual webhook verifier rejects tampering, wrong secret, missing signature, malformed timestamp", async () => {
  assert.equal(await verifySignature(body + " ", signature(), qaSecret), false);
  assert.equal(await verifySignature(body, signature(), wrongSecret), false);
  assert.equal(await verifySignature(body, "t=" + timestamp + ",v1=" + "0".repeat(64), qaSecret), false);
  assert.equal(await verifySignature(body, "", qaSecret), false);
  assert.equal(await verifySignature(body, "t=invalid,v1=bad", qaSecret), false);
});

test("actual webhook verifier rejects stale and far-future signature timestamps", async () => {
  assert.equal(await verifySignature(body, signature(body, qaSecret, timestamp - 301), qaSecret), false);
  assert.equal(await verifySignature(body, signature(body, qaSecret, timestamp + 301), qaSecret), false);
});

test("signed WELCOME10 event also requires matching persisted order, checkout session and mode", async () => {
  const verified = await verifySignature(body, signature(), qaSecret);
  assert.equal(verified, true);
  assert.deepEqual(verifyWelcomePaymentBinding({ event, order, signatureVerified: verified }), {
    verified: true, paymentIntentId: "pi_qa_1", eventId: "evt_qa_1",
  });
  assert.equal(verifyWelcomePaymentBinding({ event, order, signatureVerified: false }).verified, false);
  assert.equal(verifyWelcomePaymentBinding({
    event, order: { ...order, id: "wrong-order" }, signatureVerified: verified,
  }).verified, false);
  assert.equal(verifyWelcomePaymentBinding({
    event, order: { ...order, stripe_checkout_session_id: "cs_test_wrong" }, signatureVerified: verified,
  }).verified, false);
  assert.equal(verifyWelcomePaymentBinding({
    event, order: { ...order, payment_mode: "live" }, signatureVerified: verified,
  }).verified, false);
  assert.equal(verifyWelcomePaymentBinding({
    event, order: { ...order, stripe_payment_intent_id: "pi_other" }, signatureVerified: verified,
  }).verified, false);
});

test("replayed signed event is still restricted to the same already-paid order", async () => {
  const paid = { ...order, payment_status: "paid", stripe_payment_intent_id: "pi_qa_1" };
  assert.equal(verifyWelcomePaymentBinding({ event, order: paid, signatureVerified: true }).verified, true);
  assert.equal(verifyWelcomePaymentBinding({ event, order: { ...paid, id: "other" }, signatureVerified: true }).verified, false);
  // Database replay/idempotency has a separate real-PostgreSQL QA gate.
});

test("guest proof must come from Supabase Auth and match checkout email exactly", async () => {
  const token = "x".repeat(90);
  const verifiedUser = { id: "guest-qa", email: "qa@example.test", email_confirmed_at: "2026-11-11T00:00:00Z" };
  const getUser = async () => ({ data: { user: verifiedUser }, error: null });
  assert.deepEqual(await verifyGuestWelcomeIdentity(token, "QA@example.test", getUser), {
    email: "qa@example.test", userId: "guest-qa",
  });
  assert.equal(await verifyGuestWelcomeIdentity(token, "other@example.test", getUser), null);
  assert.equal(await verifyGuestWelcomeIdentity(token, "qa@example.test", async () => ({
    data: null, error: new Error("expired or revoked token"),
  })), null);
  assert.equal(await verifyGuestWelcomeIdentity(token, "qa@example.test", async () => ({
    data: { user: { ...verifiedUser, email_confirmed_at: null } }, error: null,
  })), null);
  assert.equal(await verifyGuestWelcomeIdentity("forged", "qa@example.test", getUser), null);
});

test("privileged webhook database client is created only after the signature gate", () => {
  const signatureGate = webhookSource.indexOf("if (!await verifyStripeSignature(rawBody, signature, webhookSecret))");
  const privilegedClient = webhookSource.indexOf("const service = createClient(supabaseUrl, serviceKey");
  assert.ok(signatureGate >= 0 && privilegedClient > signatureGate);
});
