// ISOLATED STRIPE CLI RECEIVER (test events only).
// Run with Stripe CLI's temporary test listener secret. Never point to production.
// No database, Supabase API, orders, inventory, refunds, or payments are mutated.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";

const secret = process.env.STRIPE_LOCAL_WEBHOOK_SECRET || "";
assert.match(secret, /^whsec_[A-Za-z0-9_+-]{10,}$/, "Use only a Stripe CLI listener signing secret");
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  throw Error("Refusing live Stripe API credentials");
}
const source = readFileSync(new URL("../../supabase/functions/stripe-webhook/index.ts", import.meta.url), "utf8");
const begin = source.indexOf("function hex(bytes: ArrayBuffer) {");
const end = source.indexOf("async function releaseCheckoutReservations(", begin);
assert.ok(begin >= 0 && end > begin, "Actual checked-out signature verifier not found");
const signatureSource = source.slice(begin, end).replace(/:\s*(?:ArrayBuffer|string)\b/g, "");
const verify = runInNewContext(signatureSource + "\nverifyStripeSignature", {
  crypto: webcrypto, TextEncoder, Uint8Array,
});
const allowed = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
]);
const counts = { verified: 0, invalid: 0, rejectedLive: 0, duplicate: 0, byType: {} };
const seenIds = new Set();
// Ephemeral replay fixture only. Never written to disk or logged.
let lastSigned = null;
const server = createServer(async (request, response) => {
  const send = (code, body) => {
    response.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  };
  if (request.method === "GET" && request.url === "/qa/status") {
    return send(200, { isolatedReceiver: true, mode: "test", nonMutating: true, ...counts });
  }
  if (request.method === "POST" && request.url === "/qa/replay") {
    if (!lastSigned) return send(409, { error: "No previously verified event available" });
    // Replays the EXACT raw body + Stripe CLI signing header to our own localhost
    // endpoint. Never calls Stripe APIs or production. Valid for the 5-minute HMAC window.
    const replay = await fetch("http://127.0.0.1:4242/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": lastSigned.signature },
      body: lastSigned.raw,
    });
    return send(replay.status, { replayStatus: replay.status, duplicateExpected: true });
  }
  if (request.method !== "POST" || request.url !== "/webhook") return send(404, { error: "not found" });
  let body = "";
  for await (const chunk of request) {
    body += String(chunk);
    if (body.length > 1000000) return send(413, { error: "too large" });
  }
  let event;
  try { event = JSON.parse(body); } catch { return send(400, { error: "invalid JSON" }); }
  if (event.livemode !== false) {
    counts.rejectedLive++;
    return send(409, { error: "only Stripe sandbox events accepted" });
  }
  const signature = request.headers["stripe-signature"] || "";
  if (!await verify(body, signature, secret)) {
    counts.invalid++;
    return send(400, { error: "invalid Stripe signature" });
  }
  if (!allowed.has(event.type)) return send(200, { received: true, ignored: true });
  if (typeof event.id !== "string" || !/^evt_[a-zA-Z0-9_]+$/.test(event.id)) {
    return send(400, { error: "Event ID missing or malformed" });
  }
  lastSigned = { raw: body, signature };
  if (seenIds.has(event.id)) {
    counts.duplicate++;
    return send(200, { received: true, verified: true, duplicate: true, nonMutating: true });
  }
  seenIds.add(event.id);
  counts.verified++;
  counts.byType[event.type] = (counts.byType[event.type] || 0) + 1;
  // No payload, signing secret, customer details or event identifiers logged.
  console.log("PASS signed sandbox event: " + event.type);
  send(200, { received: true, verified: true, duplicate: false, nonMutating: true });
});
server.listen(4242, "127.0.0.1", () => {
  console.log("WELCOME10 Stripe CLI receiver: http://127.0.0.1:4242/webhook (test mode only)");
  console.log("No fulfillment, payment, refund, or database writes are performed.");
});
