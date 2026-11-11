// HERMETIC QA: exercises the checked-out browser OTP module with an in-memory
// Supabase Auth fake. No requests, real email sends, accounts or payments.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { verifyGuestWelcomeIdentity } from "../supabase/functions/checkout/welcome-guest-verification.mjs";

const raw = readFileSync(new URL("../src/lib/welcomeGuestEmail.js", import.meta.url), "utf8");
assert.match(raw, /persistSession:\s*false/);
assert.match(raw, /autoRefreshToken:\s*false/);
assert.match(raw, /detectSessionInUrl:\s*false/);
assert.match(raw, /shouldCreateUser:\s*true/);
assert.doesNotMatch(raw, /localStorage|sessionStorage|document\.cookie/);

function createHarness({ now = Date.now(), expiresIn = 180 } = {}) {
  let clock = now;
  let sequence = 0;
  const mailbox = new Map();
  const accounts = new Map();
  const sessions = new Map();
  const calls = [];
  const auth = {
    async signInWithOtp({ email, options }) {
      calls.push({ action: "send", email, options });
      if (options?.shouldCreateUser !== true) return { error: Error("signup disabled") };
      if (!accounts.has(email)) accounts.set(email, { id: "fake-account-" + accounts.size, email });
      const code = String(100001 + ++sequence);
      mailbox.set(email, { code, expiresAt: clock + 300000, consumed: false });
      return { data: { user: null, session: null }, error: null };
    },
    async verifyOtp({ email, token, type }) {
      calls.push({ action: "verify", email, type });
      const entry = mailbox.get(email);
      if (type !== "email" || !entry || entry.consumed || entry.code !== token || entry.expiresAt <= clock) {
        return { data: null, error: Error("invalid or expired one-time code") };
      }
      entry.consumed = true;
      const account = accounts.get(email);
      const accessToken = "qa_token_" + "a".repeat(70) + "_" + (++sequence);
      const user = { ...account, email_confirmed_at: "2026-11-11T00:00:00Z" };
      sessions.set(accessToken, { user, expiresAt: clock + expiresIn * 1000 });
      return { data: { user, session: { access_token: accessToken, expires_in: expiresIn } }, error: null };
    },
  };
  const source = raw.replace(/^import [^\n]*\r?\n/gm, "").replace(/^export /gm, "");
  assert.equal((raw.match(/^import /gm) || []).length, 2, "Auth module imports changed: update the isolated harness");
  const context = {
    createClient: (url, key, options) => {
      assert.equal(url, "http://127.0.0.1:54321");
      assert.equal(key, "LOCAL_FAKE_ONLY");
      assert.equal(options.auth.persistSession, false);
      return { auth };
    },
    supabaseUrl: "http://127.0.0.1:54321",
    supabasePublishableKey: "LOCAL_FAKE_ONLY",
    Date: class SimulatedDate extends Date { static now() { return clock; } },
  };
  runInNewContext(source + "\nglobalThis.qa = { clearWelcomeGuestProof, welcomeGuestTokenFor, sendWelcomeGuestOtp, verifyWelcomeGuestOtp };", context, { timeout: 1000 });
  return {
    api: context.qa, mailbox, accounts, calls,
    advance: (millis) => { clock += millis; },
    getUser: async (token) => {
      const entry = sessions.get(token);
      if (!entry || entry.expiresAt <= clock) return { data: { user: null }, error: Error("expired session") };
      return { data: { user: entry.user }, error: null };
    },
  };
}

test("new guest: normalized six-digit OTP creates only a fake passwordless identity", async () => {
  const h = createHarness();
  await h.api.sendWelcomeGuestOtp("  Buyer@Example.Test  ");
  assert.equal(h.accounts.size, 1);
  assert.equal(h.calls[0].email, "buyer@example.test");
  assert.equal(h.calls[0].options.shouldCreateUser, true);
  assert.match(h.mailbox.get("buyer@example.test").code, /^\d{6}$/);
  await h.api.verifyWelcomeGuestOtp("BUYER@example.test", h.mailbox.get("buyer@example.test").code);
  const access = h.api.welcomeGuestTokenFor(" buyer@example.test ");
  assert.match(access, /^qa_token_/);
  assert.equal(h.api.welcomeGuestTokenFor("different@example.test"), null);
  assert.deepEqual(await verifyGuestWelcomeIdentity(access, "buyer@example.test", h.getUser), {
    email: "buyer@example.test", userId: "fake-account-0",
  });
});

test("returning address: resend invalidates old code; only new code creates a proof", async () => {
  const h = createHarness();
  await h.api.sendWelcomeGuestOtp("buyer@example.test");
  const oldCode = h.mailbox.get("buyer@example.test").code;
  await h.api.sendWelcomeGuestOtp("buyer@example.test");
  const newCode = h.mailbox.get("buyer@example.test").code;
  assert.equal(h.accounts.size, 1);
  await assert.rejects(() => h.api.verifyWelcomeGuestOtp("buyer@example.test", oldCode), /invalid or expired/);
  assert.equal(h.api.welcomeGuestTokenFor("buyer@example.test"), null);
  await h.api.verifyWelcomeGuestOtp("buyer@example.test", newCode);
  assert.ok(h.api.welcomeGuestTokenFor("buyer@example.test"));
  await assert.rejects(() => h.api.verifyWelcomeGuestOtp("buyer@example.test", newCode), /invalid or expired/);
  assert.equal(h.api.welcomeGuestTokenFor("buyer@example.test"), null);
});

test("wrong email and malformed codes never establish an identity", async () => {
  const h = createHarness();
  await assert.rejects(() => h.api.sendWelcomeGuestOtp("not-an-email"), /valid email/);
  assert.equal(h.calls.length, 0);
  await h.api.sendWelcomeGuestOtp("buyer@example.test");
  const code = h.mailbox.get("buyer@example.test").code;
  await assert.rejects(() => h.api.verifyWelcomeGuestOtp("buyer@example.test", "abc"), /verification code/);
  await assert.rejects(() => h.api.verifyWelcomeGuestOtp("wrong@example.test", code), /invalid or expired/);
  assert.equal(h.api.welcomeGuestTokenFor("buyer@example.test"), null);
});

test("expired OTP and expired JWT are rejected, including client 30-second expiry buffer", async () => {
  const h = createHarness({ expiresIn: 60 });
  await h.api.sendWelcomeGuestOtp("buyer@example.test");
  const code = h.mailbox.get("buyer@example.test").code;
  h.advance(300001);
  await assert.rejects(() => h.api.verifyWelcomeGuestOtp("buyer@example.test", code), /invalid or expired/);
  await h.api.sendWelcomeGuestOtp("buyer@example.test");
  await h.api.verifyWelcomeGuestOtp("buyer@example.test", h.mailbox.get("buyer@example.test").code);
  const access = h.api.welcomeGuestTokenFor("buyer@example.test");
  h.advance(30001);
  assert.equal(h.api.welcomeGuestTokenFor("buyer@example.test"), null);
  h.advance(30000);
  assert.equal(await verifyGuestWelcomeIdentity(access, "buyer@example.test", h.getUser), null);
});

test("browser reload or checkout email change clears in-memory proof; no persistence", async () => {
  const h = createHarness();
  await h.api.sendWelcomeGuestOtp("buyer@example.test");
  await h.api.verifyWelcomeGuestOtp("buyer@example.test", h.mailbox.get("buyer@example.test").code);
  assert.ok(h.api.welcomeGuestTokenFor("buyer@example.test"));
  assert.equal(h.api.welcomeGuestTokenFor("changed@example.test"), null);
  h.api.clearWelcomeGuestProof();
  assert.equal(h.api.welcomeGuestTokenFor("buyer@example.test"), null);
  const newPageContext = createHarness();
  assert.equal(newPageContext.api.welcomeGuestTokenFor("buyer@example.test"), null);
});

test("server-side Auth lookup rejects forged, wrong-address and expired session proofs", async () => {
  const h = createHarness();
  await h.api.sendWelcomeGuestOtp("buyer@example.test");
  await h.api.verifyWelcomeGuestOtp("buyer@example.test", h.mailbox.get("buyer@example.test").code);
  const access = h.api.welcomeGuestTokenFor("buyer@example.test");
  assert.equal(await verifyGuestWelcomeIdentity("forged", "buyer@example.test", h.getUser), null);
  assert.equal(await verifyGuestWelcomeIdentity(access, "other@example.test", h.getUser), null);
  assert.deepEqual(await verifyGuestWelcomeIdentity(access, "buyer@example.test", h.getUser), {
    email: "buyer@example.test", userId: "fake-account-0",
  });
  h.advance(200000);
  assert.equal(await verifyGuestWelcomeIdentity(access, "buyer@example.test", h.getUser), null);
});

test("guest paths remain explicitly OFF when the server release flag is absent", () => {
  const server = readFileSync("supabase/functions/checkout/index.ts", "utf8");
  const client = readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
  assert.match(server, /if \(!welcomeGuestOtpReleased\(\)\) return null/);
  assert.match(client, /if \(!status\.guestOtpEnabled\) return setError/);
  assert.match(client, /if \(!status\.guestOtpEnabled\) throw new Error/);
});
