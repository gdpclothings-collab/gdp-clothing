// HERMETIC INTEGRATION HARNESS: localhost HTTP delivery with synthetic HMAC
// signatures, actual checked-out signature verifier and WELCOME10 business
// helpers, fake canonical orders, holds and RPCs. Not Stripe CLI or a live
// Supabase Edge Function: those separate release gates stay BLOCKED.
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import { verifyWelcomePaymentBinding } from "../supabase/functions/stripe-webhook/welcome-payment-binding.mjs";
import { checkWelcomePaidOrderReservation } from "../supabase/functions/stripe-webhook/welcome-redemption-preflight.mjs";
import { redeemWelcomeOrder } from "../supabase/functions/stripe-webhook/welcome-redemption-adapter.mjs";
import { recordWelcomeReconciliation } from "../supabase/functions/stripe-webhook/welcome-reconciliation.mjs";

const webhookSource = readFileSync(new URL("../supabase/functions/stripe-webhook/index.ts", import.meta.url), "utf8");
const begin = webhookSource.indexOf("function hex(bytes: ArrayBuffer) {");
const end = webhookSource.indexOf("async function releaseCheckoutReservations(", begin);
assert.ok(begin >= 0 && end > begin, "Actual webhook HMAC verifier cannot be extracted: fail closed");
const verifierSource = webhookSource.slice(begin, end).replace(/:\s*(?:ArrayBuffer|string)\b/g, "");
const verifyStripeSignature = runInNewContext(verifierSource + "\nverifyStripeSignature", {
  crypto: webcrypto, TextEncoder, Uint8Array,
});
assert.match(webhookSource, /if \(!await verifyStripeSignature\(rawBody, signature, webhookSecret\)\)/);
assert.match(webhookSource, /const service = createClient\(supabaseUrl, serviceKey/);
assert.ok(webhookSource.indexOf("if (!await verifyStripeSignature(rawBody, signature, webhookSecret))") <
          webhookSource.indexOf("const service = createClient(supabaseUrl, serviceKey"));

const testSecret = "whsec_LOCAL_SYNTHETIC_OTP_QA_ONLY";
const wrongSecret = "whsec_WRONG_OTP_QA_SECRET";
const nowSecs = () => Math.floor(Date.now() / 1000);

function makeEvent(type, order, overrides = {}) {
  const isIntent = type === "payment_intent.succeeded";
  const obj = isIntent ? {
    id: "pi_qa_1",
    metadata: { order_id: order.id, payment_mode: "test" },
  } : {
    id: order.stripe_checkout_session_id,
    payment_intent: "pi_qa_1",
    payment_status: "paid",
    metadata: { order_id: order.id, payment_mode: "test" },
  };
  return {
    id: "evt_qa_" + Math.random().toString(36).slice(2),
    type, created: nowSecs(), livemode: false,
    data: { object: { ...obj, ...overrides } },
  };
}
function signedHeader(raw, secret = testSecret, time = nowSecs()) {
  return "t=" + time + ",v1=" + createHmac("sha256", secret).update(String(time) + "." + raw).digest("hex");
}
function createFixture() {
  const created = new Date(Date.now() - 120000).toISOString();
  const expires = new Date(Date.now() + 120000).toISOString();
  const order = {
    id: "fake-order-qa", discount_code: "WELCOME10",
    payment_status: "pending", payment_mode: "test",
    customer_email: "buyer@example.test",
    stripe_checkout_session_id: "cs_test_qa_1", stripe_payment_intent_id: null,
    subtotal: 100, discount: 10,
  };
  const hold = { order_id: order.id, discount_id: "fake-campaign", status: "active", created_at: created, expires_at: expires };
  const state = { order, hold, redemptions: 0, usageCount: 0, reconciliation: [], rpcCount: 0, failRedemption: false, dbReads: 0 };
  const service = {
    from(table) {
      assert.equal(table, "order_coupon_reservations");
      return { select() { return { eq(_column, orderId) {
        return { async maybeSingle() {
          state.dbReads++;
          return { data: orderId === state.order.id ? { ...state.hold } : null, error: null };
        } };
      } }; } };
    },
    async rpc(name, args) {
      state.rpcCount++;
      if (name === "redeem_welcome10_coupon") {
        if (state.failRedemption) return { data: null, error: Error("synthetic DB failure") };
        assert.equal(args.p_order_id, state.order.id);
        if (state.hold.status === "consumed" && state.redemptions === 1)
          return { data: { redeemed: true, existing: true }, error: null };
        const signedPaid = Date.parse(args.p_signed_paid_at);
        if (state.hold.status !== "active" || state.order.payment_status !== "paid" ||
            signedPaid < Date.parse(state.hold.created_at) || signedPaid > Date.parse(state.hold.expires_at) ||
            state.order.discount > 15 || state.order.discount > state.order.subtotal * 0.10)
          return { data: null, error: Error("WELCOME_FAIL_CLOSED") };
        state.hold.status = "consumed";
        state.redemptions++;
        state.usageCount++;
        return { data: { redeemed: true, existing: false }, error: null };
      }
      if (name === "record_welcome10_reconciliation") {
        const existing = state.reconciliation.find(x => x.p_order_id === args.p_order_id &&
             x.p_payment_intent_id === args.p_payment_intent_id);
        if (!existing) state.reconciliation.push({ ...args });
        return { error: null };
      }
      if (name === "resolve_welcome10_reconciliation") return { error: null };
      throw Error("Unexpected RPC: " + name);
    },
  };
  return { state, service };
}

async function startLocalWebhook(fixture) {
  const { state, service } = fixture;
  const server = createServer(async (req, res) => {
    const reply = (status, value) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
    if (req.method !== "POST" || req.url !== "/webhook") return reply(405, { error: "method" });
    let raw = "";
    for await (const chunk of req) raw += chunk.toString("utf8");
    let event;
    try { event = JSON.parse(raw); } catch { return reply(400, { error: "json" }); }
    // No live-mode signing key is present in this fully synthetic process.
    if (event.livemode !== false) return reply(503, { error: "test-mode only" });
    const signature = req.headers["stripe-signature"] || "";
    if (!await verifyStripeSignature(raw, signature, testSecret)) return reply(400, { error: "signature" });
    try {
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"].includes(event.type)) {
        if (event.data?.object?.payment_status === "unpaid") return reply(200, { payment_pending: true });
        const matchingOrder = event.data?.object?.metadata?.order_id === state.order.id ? state.order : null;
        if (!matchingOrder) return reply(409, { error: "order missing" });
        const binding = verifyWelcomePaymentBinding({ event, order: matchingOrder, signatureVerified: true });
        if (binding.reason === "checkout_session_confirmation_required") return reply(200, { awaiting_checkout_session: true });
        if (!binding.verified) return reply(409, { error: binding.reason });
        // Local fixture emulates the persisted-paid check preceding the real RPC.
        state.order.payment_status = "paid";
        state.order.stripe_payment_intent_id = binding.paymentIntentId;
        const preflight = await checkWelcomePaidOrderReservation({ service, order: state.order });
        const redemption = preflight.ok ? await redeemWelcomeOrder({
          service, order: state.order, orderId: state.order.id, signedStripeEventVerified: true,
          paymentLinkVerified: true, integrationEnabled: true,
          signedPaidAt: Number.isFinite(Number(event.created)) && event.created > 0
            ? new Date(event.created * 1000).toISOString() : null,
        }) : { redeemed: false, reason: preflight.reason };
        if (!redemption.redeemed) {
          await recordWelcomeReconciliation({
            service, orderId: state.order.id, eventId: binding.eventId, paymentIntentId: binding.paymentIntentId,
            paymentMode: "test", reason: redemption.reason || "redemption_failed",
            verifiedPaymentBinding: true, integrationEnabled: true,
          });
          return reply(500, { reconciliation_required: true });
        }
        return reply(200, { received: true, existing: redemption.existing });
      }
      if (event.type === "charge.refunded" && event.data?.object?.payment_intent === state.order.stripe_payment_intent_id) {
        state.order.payment_status = Number(event.data.object.amount_refunded || 0) >= Number(event.data.object.amount || 0)
          ? "refunded" : "partially_refunded";
        return reply(200, { received: true });
      }
      return reply(200, { received: true });
    } catch {
      return reply(500, { error: "fail closed" });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    post: async (event, { secret = testSecret, raw = null, signature = null } = {}) => {
      const body = raw ?? JSON.stringify(event);
      const response = await fetch("http://127.0.0.1:" + address.port + "/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "stripe-signature": signature || signedHeader(body, secret) },
        body,
      });
      return { status: response.status, data: await response.json() };
    },
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("HTTP signed checkout event redeems once and repeated signed delivery is idempotent", async () => {
  const fixture = createFixture();
  const local = await startLocalWebhook(fixture);
  try {
    const event = makeEvent("checkout.session.completed", fixture.state.order);
    const first = await local.post(event);
    assert.equal(first.status, 200);
    assert.equal(first.data.existing, false);
    const second = await local.post(event);
    assert.equal(second.status, 200);
    assert.equal(second.data.existing, true);
    assert.equal(fixture.state.redemptions, 1);
    assert.equal(fixture.state.usageCount, 1);
    assert.equal(fixture.state.hold.status, "consumed");
  } finally { await local.stop(); }
});

test("PaymentIntent before confirmed Checkout session is deferred without redemption", async () => {
  const fixture = createFixture();
  const local = await startLocalWebhook(fixture);
  try {
    const paymentIntent = makeEvent("payment_intent.succeeded", fixture.state.order);
    const early = await local.post(paymentIntent);
    assert.equal(early.status, 200);
    assert.equal(early.data.awaiting_checkout_session, true);
    assert.equal(fixture.state.redemptions, 0);
    const confirmed = await local.post(makeEvent("checkout.session.completed", fixture.state.order));
    assert.equal(confirmed.status, 200);
    assert.equal(fixture.state.redemptions, 1);
  } finally { await local.stop(); }
});

test("tampered, incorrectly signed and live-mode events fail before database access", async () => {
  const fixture = createFixture();
  const local = await startLocalWebhook(fixture);
  try {
    const event = makeEvent("checkout.session.completed", fixture.state.order);
    assert.equal((await local.post(event, { secret: wrongSecret })).status, 400);
    const original = JSON.stringify(event);
    const altered = JSON.stringify({ ...event, id: "evt_tampered" });
    assert.equal((await local.post(event, { raw: altered, signature: signedHeader(original) })).status, 400);
    assert.equal((await local.post({ ...event, livemode: true })).status, 503);
    assert.equal(fixture.state.dbReads, 0);
    assert.equal(fixture.state.redemptions, 0);
  } finally { await local.stop(); }
});

test("wrong signed order, session, mode, or missing paid status cannot redeem", async () => {
  const fixture = createFixture();
  const local = await startLocalWebhook(fixture);
  try {
    const valid = makeEvent("checkout.session.completed", fixture.state.order);
    assert.equal((await local.post({ ...valid, data: { object: { ...valid.data.object, metadata: { order_id: "not-our-order", payment_mode: "test" } } } })).status, 409);
    assert.equal((await local.post({ ...valid, data: { object: { ...valid.data.object, id: "cs_test_wrong" } } })).status, 409);
    assert.equal((await local.post({ ...valid, data: { object: { ...valid.data.object, metadata: { order_id: fixture.state.order.id, payment_mode: "live" } } } })).status, 409);
    assert.equal((await local.post({ ...valid, data: { object: { ...valid.data.object, payment_status: "unpaid" } } })).status, 200);
    assert.equal(fixture.state.redemptions, 0);
    assert.equal(fixture.state.usageCount, 0);
  } finally { await local.stop(); }
});

test("a late-arriving signed webhook honors a payment timestamp from before hold expiry", async () => {
  const fixture = createFixture();
  const local = await startLocalWebhook(fixture);
  try {
    fixture.state.hold.expires_at = new Date(Date.now() - 10000).toISOString();
    const event = makeEvent("checkout.session.completed", fixture.state.order);
    event.created = nowSecs() - 60;
    const res = await local.post(event);
    assert.equal(res.status, 200);
    assert.equal(fixture.state.redemptions, 1);
  } finally { await local.stop(); }
});

test("redemption failure records a synthetic reconciliation request and preserves 5xx retry", async () => {
  const fixture = createFixture();
  fixture.state.failRedemption = true;
  const local = await startLocalWebhook(fixture);
  try {
    const event = makeEvent("checkout.session.completed", fixture.state.order);
    assert.equal((await local.post(event)).status, 500);
    assert.equal(fixture.state.redemptions, 0);
    assert.equal(fixture.state.reconciliation.length, 1);
    assert.equal(fixture.state.reconciliation[0].p_order_id, fixture.state.order.id);
    assert.equal((await local.post(event)).status, 500);
    assert.equal(fixture.state.reconciliation.length, 1);
  } finally { await local.stop(); }
});

test("synthetic full and partial refund events update paid order status", async () => {
  const fixture = createFixture();
  const local = await startLocalWebhook(fixture);
  try {
    const paid = await local.post(makeEvent("checkout.session.completed", fixture.state.order));
    assert.equal(paid.status, 200);
    const partial = makeEvent("charge.refunded", fixture.state.order, {
      payment_intent: "pi_qa_1", amount: 10000, amount_refunded: 2000,
    });
    assert.equal((await local.post(partial)).status, 200);
    assert.equal(fixture.state.order.payment_status, "partially_refunded");
    const full = makeEvent("charge.refunded", fixture.state.order, {
      payment_intent: "pi_qa_1", amount: 10000, amount_refunded: 10000,
    });
    assert.equal((await local.post(full)).status, 200);
    assert.equal(fixture.state.order.payment_status, "refunded");
    assert.equal(fixture.state.redemptions, 1);
    assert.match(webhookSource, /event\.type === "charge\.refunded"/);
  } finally { await local.stop(); }
});
