import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WELCOME_GUEST_HEADER, validGuestProofToken,
  verifiedGuestEmailFromAuth, verifyGuestWelcomeIdentity,
} from "../supabase/functions/checkout/welcome-guest-verification.mjs";

const token = "a".repeat(90);
const user = { id: "verified-user", email: " Buyer@Example.com ", email_confirmed_at: "2026-10-31T00:00:00Z" };

test("guest proof header and token shape are constrained", () => {
  assert.equal(WELCOME_GUEST_HEADER, "x-gdp-welcome-guest-authorization");
  assert.equal(validGuestProofToken(token), token);
  for (const invalid of ["", "abc", "not a bearer token", "a".repeat(8200), "foo\nbar"]) {
    assert.equal(validGuestProofToken(invalid), null);
  }
});

test("verified account email must match the exact normalized checkout email", () => {
  assert.deepEqual(verifiedGuestEmailFromAuth(user, "buyer@example.com"), { email: "buyer@example.com", userId: "verified-user" });
  assert.equal(verifiedGuestEmailFromAuth(user, "other@example.com"), null);
  assert.equal(verifiedGuestEmailFromAuth({ ...user, email_confirmed_at: null }, "buyer@example.com"), null);
  assert.equal(verifiedGuestEmailFromAuth({ ...user, is_anonymous: true }, "buyer@example.com"), null);
  assert.equal(verifiedGuestEmailFromAuth({ ...user, id: null }, "buyer@example.com"), null);
});

test("server verifies with Supabase Auth, never trusts a browser-supplied email", async () => {
  let calls = 0;
  const getUser = async (received) => { calls++; assert.equal(received, token); return { data: { user }, error: null }; };
  assert.deepEqual(await verifyGuestWelcomeIdentity(token, "buyer@example.com", getUser), { email: "buyer@example.com", userId: "verified-user" });
  assert.equal(calls, 1);
  assert.equal(await verifyGuestWelcomeIdentity("forged", "buyer@example.com", getUser), null);
  assert.equal(calls, 1);
  assert.equal(await verifyGuestWelcomeIdentity(token, "attacker@example.com", getUser), null);
  assert.equal(await verifyGuestWelcomeIdentity(token, "buyer@example.com", async () => ({ error: new Error("bad token") })), null);
  assert.equal(await verifyGuestWelcomeIdentity(token, "buyer@example.com", async () => { throw Error("Auth down"); }), null);
});

test("guest proof never enters checkout JSON or persistent storage", () => {
  const frontend = readFileSync("src/lib/welcomeGuestEmail.js", "utf8");
  const api = readFileSync("src/lib/customerApi.js", "utf8");
  const gateway = readFileSync("supabase/functions/checkout-gateway/index.ts", "utf8");
  assert.match(frontend, /persistSession:\s*false/);
  assert.match(frontend, /shouldCreateUser:\s*true/);
  assert.doesNotMatch(frontend, /localStorage|sessionStorage/);
  assert.match(api, /headers:\s*\{\s*"x-gdp-welcome-guest-authorization": welcomeGuestToken\s*\}/);
  assert.match(gateway, /String\(body\?\.discountCode \|\| ""\)\.trim\(\)\.toUpperCase\(\) === "WELCOME10"/);
  assert.doesNotMatch(gateway, /body\.guestAuthToken|body\.welcomeGuestToken/);
});

test("guest checkout email changes and expired proofs invalidate WELCOME10", () => {
  const checkout = readFileSync("src/pages/CheckoutTwoStep.jsx", "utf8");
  assert.match(checkout, /key === "email"[\s\S]*clearWelcomeGuestProof\(\)/);
  assert.match(checkout, /welcomeRequested && !user && !welcomeGuestTokenFor\(form\.email\)/);
  assert.match(checkout, /welcomeRequested && !appliedDiscount/);
  assert.match(checkout, /welcomeRequested && !user \? welcomeGuestTokenFor\(form\.email\) : null/);
});
