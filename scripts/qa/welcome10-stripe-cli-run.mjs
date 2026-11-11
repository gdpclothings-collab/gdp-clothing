// GDP WELCOME10 STRIPE TEST-ONLY CLI QA.
// Requires Node.js 22+ and an authenticated Stripe CLI on this computer.
// Uses only test mode and localhost; never logs credentials or event bodies.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const cli = process.platform === "win32" ? "stripe.exe" : "stripe";
const receiverPath = fileURLToPath(new URL("./welcome10-stripe-cli-receiver.mjs", import.meta.url));
const origin = "http://127.0.0.1:4242";
const expectedAccount = "acct_1UCMFID0GnMtYBfi"; // public account identifier; not a credential
const eventTypes = ["checkout.session.completed", "payment_intent.payment_failed", "charge.refunded"];

for (const k of ["STRIPE_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_TEST_API_KEY"]) {
  const value = process.env[k];
  if (value && !/^(sk_test_|rk_test_)/.test(value)) throw Error("Refusing non-test Stripe credentials");
}
if (process.argv.length === 2) {
  console.log("DRY RUN ONLY: no Stripe API calls or charges were made.");
  console.log("Install Stripe CLI and Node.js 22+, then run stripe login and select GDP Clothing.");
  console.log("Next: node scripts/qa/welcome10-stripe-cli-run.mjs --run");
  process.exit(0);
}
assert.deepEqual(process.argv.slice(2), ["--run"], "Only --run is supported");

function spawnQuiet(cmd, args, extraEnv = {}) {
  return spawn(cmd, args, {
    cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true, env: { ...process.env, ...extraEnv },
  });
}
async function runQuiet(cmd, args, timeout = 90000) {
  const p = spawnQuiet(cmd, args);
  return new Promise(resolve => {
    let raw = "", finished = false;
    const done = ok => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ ok, raw });
    };
    const timer = setTimeout(() => { p.kill(); done(false); }, timeout);
    for (const stream of [p.stdout, p.stderr]) {
      stream.on("data", chunk => { raw = (raw + String(chunk)).slice(-14000); });
    }
    p.on("error", () => done(false));
    p.on("close", code => done(code === 0));
  });
}
async function poll(read, deadlineMs = 30000) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try {
      const value = await read();
      if (value) return value;
    } catch {}
    await delay(300);
  }
  throw Error("BLOCKED: local listener or signed Stripe event did not arrive");
}
async function currentStatus() {
  const r = await fetch(origin + "/qa/status", { signal: AbortSignal.timeout(2500) });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.isolatedReceiver, true);
  assert.equal(data.mode, "test");
  assert.equal(data.nonMutating, true);
  return data;
}
async function readySecret(listener) {
  return new Promise((resolve,reject) => {
    let output = "", finished = false;
    const done = (err, secret) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (err) reject(err); else resolve(secret);
    };
    const timer = setTimeout(() => done(Error("BLOCKED: Stripe listener startup timed out")), 45000);
    for (const stream of [listener.stdout, listener.stderr]) stream.on("data", chunk => {
      output = (output + String(chunk)).slice(-5000);
      const match = output.match(/Your webhook signing secret is\s+(whsec_[A-Za-z0-9_+-]{10,})/i);
      if (match) done(null, match[1]);
    });
    listener.on("error", () => done(Error("BLOCKED: Stripe CLI listener failed to start")));
    listener.on("close", () => done(Error("BLOCKED: Stripe CLI exited; run stripe login")));
  });
}
let listener, receiver;
const results = {};
try {
  const version = await runQuiet(cli, ["--version"], 10000);
  if (!version.ok) throw Error("BLOCKED: Stripe CLI unavailable. Install it from Stripe's official site.");
  const account = await runQuiet(cli, ["get", "/v1/account"], 25000);
  if (!account.ok) throw Error("BLOCKED: Stripe CLI is not logged in; run stripe login.");
  const id = account.raw.match(/"id"\s*:\s*"(acct_[A-Za-z0-9]+)"/)?.[1];
  if (id !== expectedAccount) throw Error("BLOCKED: CLI account does not match approved GDP Clothing account.");
  console.log("PASS: GDP Clothing Stripe CLI account preflight (test-only).");

  listener = spawnQuiet(cli, [
    "listen", "--forward-to", origin + "/webhook", "--events", eventTypes.join(","),
  ]);
  const tempSigningSecret = await readySecret(listener);
  receiver = spawnQuiet(process.execPath, [receiverPath], {
    STRIPE_LOCAL_WEBHOOK_SECRET: tempSigningSecret,
  });
  await poll(currentStatus, 15000);
  console.log("PASS: Local-only webhook receiver and Stripe listener ready.");

  const fake = {
    id: "evt_qa_invalid", type: "checkout.session.completed",
    livemode: false, data: { object: {} },
  };
  const bad = await fetch(origin + "/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bogus" },
    body: JSON.stringify(fake),
  });
  assert.equal(bad.status, 400);
  results.badSignature = "PASS";
  const spoofedLive = await fetch(origin + "/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=bogus" },
    body: JSON.stringify({ ...fake, id: "evt_qa_live", livemode: true }),
  });
  assert.equal(spoofedLive.status, 409);
  results.liveModeRejected = "PASS";
  console.log("PASS: invalid signature and simulated live mode rejected.");

  let delivered = 0;
  for (const eventType of eventTypes) {
    const before = await currentStatus();
    // Stripe CLI trigger creates TEST-mode fixture objects only.
    const trigger = await runQuiet(cli, ["trigger", eventType], 90000);
    if (!trigger.ok) {
      results[eventType] = "BLOCKED: Stripe CLI fixture unavailable";
      continue;
    }
    try {
      await poll(async () => {
        const after = await currentStatus();
        return (after.byType?.[eventType] || 0) > (before.byType?.[eventType] || 0);
      }, 40000);
      delivered++;
      results[eventType] = "PASS: genuine CLI signed delivery";
      console.log("PASS: genuine signed event " + eventType);
    } catch {
      results[eventType] = "BLOCKED: event not received by localhost";
    }
  }
  if (delivered) {
    const before = await currentStatus();
    const reply = await fetch(origin + "/qa/replay", { method: "POST" });
    const after = await currentStatus();
    assert.equal(reply.status, 200);
    assert.equal(after.verified, before.verified);
    assert.equal(after.duplicate, before.duplicate + 1);
    results.replay = "PASS: exact signed event idempotency";
  } else {
    results.replay = "BLOCKED: no genuine event to replay";
  }
  results.actualDbReconciliation = "BLOCKED: receiver intentionally has no database";
  results.productionChanges = 0;
  console.log("WELCOME10 SANDBOX QA REPORT: " + JSON.stringify(results, null, 2));
  if (delivered !== eventTypes.length) process.exitCode = 2;
} catch (e) {
  console.error(e instanceof Error ? e.message : "BLOCKED: Stripe sandbox test aborted");
  process.exitCode = 2;
} finally {
  if (receiver && receiver.exitCode === null) receiver.kill();
  if (listener && listener.exitCode === null) listener.kill();
}
