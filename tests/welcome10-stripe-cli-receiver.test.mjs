// No Stripe API keys and no outside network: validate the exact local receiver
// that the authenticated Stripe CLI will forward real test-mode events to.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const secret = "whsec_SYNTHETIC_LOCAL_RECEIVER_TEST_123456";
const origin = "http://127.0.0.1:4242";
const receiver = fileURLToPath(new URL("../scripts/qa/welcome10-stripe-cli-receiver.mjs", import.meta.url));
function event(type, id) {
  return {
    id, type, livemode: false, created: Math.floor(Date.now() / 1000),
    data: { object: { id: "cs_test_receiver_qa", metadata: { order_id: "fictional" } } },
  };
}
function signed(raw) {
  const t = Math.floor(Date.now() / 1000);
  return "t=" + t + ",v1=" + createHmac("sha256", secret).update(t + "." + raw).digest("hex");
}
async function post(data, options = {}) {
  const raw = JSON.stringify(data);
  const response = await fetch(origin + "/webhook", {
    method: "POST",
    headers: { "content-type": "application/json",
      "stripe-signature": options.signature ?? signed(raw) },
    body: options.raw ?? raw,
  });
  return { status: response.status, body: await response.json() };
}
async function status() {
  const r = await fetch(origin + "/qa/status");
  assert.equal(r.status, 200);
  return r.json();
}
test("CLI receiver: localhost synthetic HMAC, no production access, exact replay, invalid, live rejection and event types", async () => {
  const p = spawn(process.execPath, [receiver], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, STRIPE_LOCAL_WEBHOOK_SECRET: secret },
  });
  let procError = "";
  p.on("error", e => { procError = e.message; });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (procError || p.exitCode !== null) break;
      try {
        const s = await status();
        if (s.isolatedReceiver === true && s.mode === "test" && s.nonMutating === true) {
          ready = true; break;
        }
      } catch {}
      await sleep(100);
    }
    assert.ok(ready, "Local test receiver failed to start: " + procError);
    const paid = event("checkout.session.completed", "evt_qa_receiver_1");
    assert.equal((await post(paid)).status, 200);
    let s = await status();
    assert.equal(s.verified, 1);
    assert.equal(s.byType["checkout.session.completed"], 1);
    const replay = await fetch(origin + "/qa/replay", { method: "POST" });
    assert.equal(replay.status, 200);
    s = await status();
    assert.equal(s.verified, 1);
    assert.equal(s.duplicate, 1);
    const bad = await post(event("checkout.session.completed", "evt_qa_receiver_2"), {
      signature: "t=1,v1=" + "0".repeat(64),
    });
    assert.equal(bad.status, 400);
    assert.equal((await status()).invalid, 1);
    assert.equal((await post({ ...paid, id: "evt_qa_live", livemode: true })).status, 409);
    assert.equal((await status()).rejectedLive, 1);
    const refund = event("charge.refunded", "evt_qa_refund");
    assert.equal((await post(refund)).status, 200);
    const failure = event("payment_intent.payment_failed", "evt_qa_failed");
    assert.equal((await post(failure)).status, 200);
    s = await status();
    assert.equal(s.byType["charge.refunded"], 1);
    assert.equal(s.byType["payment_intent.payment_failed"], 1);
    assert.equal(s.verified, 3);
    assert.equal(s.nonMutating, true);
  } finally {
    p.kill();
    if (p.exitCode === null) await Promise.race([
      new Promise(resolve => p.once("close", resolve)), sleep(1000),
    ]);
  }
});
