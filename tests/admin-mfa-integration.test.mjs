import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideAdminMfaGate } from "../src/lib/adminMfaGateDecision.js";
import { requestAdminPaymentModeSwitch } from "../src/lib/paymentModeSecureSwitch.js";

const gate = readFileSync("src/components/AdminMfaGate.jsx", "utf8");
const backend = readFileSync("supabase/functions/admin-mfa-security/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261031023001_gdp_paymentmode_securefix_v1.sql", "utf8");
const verified = [{ id: "test-factor", status: "verified" }];
const pending = [{ id: "pending-factor", status: "unverified" }];

test("verified TOTP plus AAL1 requires challenge, even with stale grace record", () => {
  assert.equal(decideAdminMfaGate({ currentLevel: "aal1", totpFactors: verified, graceActive: true }), "challenge");
  assert.equal(decideAdminMfaGate({ currentLevel: "aal1", totpFactors: verified }), "challenge");
});
test("AAL2 session passes regardless of enrollment-state lag", () => {
  assert.equal(decideAdminMfaGate({ currentLevel: "aal2", totpFactors: verified, graceActive: true }), "allow");
});
test("grace applies only to users without a verified factor", () => {
  assert.equal(decideAdminMfaGate({ currentLevel: "aal1", totpFactors: pending, graceActive: true }), "grace");
  assert.equal(decideAdminMfaGate({ currentLevel: "aal1", totpFactors: pending, graceActive: false }), "enroll");
});
test("unknown assurance level fails closed when factor is verified", () => {
  assert.equal(decideAdminMfaGate({ currentLevel: null, totpFactors: verified, graceActive: true }), "challenge");
});
test("admin gate verifies factor and assurance before considering grace", () => {
  assert.match(gate, /decideAdminMfaGate\(/);
  assert.match(gate, /supabase\.auth\.mfa\.listFactors\(\)/);
  assert.match(gate, /supabase\.auth\.mfa\.challengeAndVerify\(/);
  assert.match(gate, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(gate, /currentLevel !== "aal2"/);
  assert.match(gate, /if \(decision === "challenge"\)/);
  assert.match(gate, /if \(decision === "grace"\)/);
});
test("backend validates authenticated user, admin role, verified factor and AAL2", () => {
  assert.match(backend, /userClient\.auth\.getUser\(token\)/);
  assert.match(backend, /profile\?\.role !== "admin"/);
  assert.match(backend, /payload\.aal !== "aal2"/);
  assert.match(backend, /hasVerifiedFactor/);
});
test("grace dashboard access never authorizes payment RPC without AAL2", async () => {
  assert.equal(decideAdminMfaGate({ currentLevel: "aal1", graceActive: true }), "grace");
  let invoked = false;
  const client = {
    auth: { mfa: { async getAuthenticatorAssuranceLevel() {
      return { data: { currentLevel: "aal1" }, error: null };
    } } },
    async rpc() { invoked = true; throw Error("RPC should not be invoked"); },
  };
  await assert.rejects(requestAdminPaymentModeSwitch(client, "live", "test"), /AAL2/);
  assert.equal(invoked, false);
  assert.match(migration, /auth\.jwt\(\)\s*->>\s*'aal'[^\n]*<>\s*'aal2'/);
  assert.match(migration, /not public\.is_admin\(\)/);
});
test("server rejects non-admin even when token has AAL2", () => {
  assert.match(backend, /profile\?\.role !== "admin"/);
  assert.match(migration, /not public\.is_admin\(\)/);
});
test("atomic payment-mode update has expected-value condition and conflict error", () => {
  assert.match(migration, /where\s+id\s*=\s*1\s+and\s+payment_mode\s*=\s*p_expected_mode/i);
  assert.match(migration, /Payment mode changed in another session/);
});
test("MFA challenge refresh is checked before verification is recorded", () => {
  const challenge = gate.indexOf("supabase.auth.mfa.challengeAndVerify(");
  const assurance = gate.indexOf("await supabase.auth.mfa.getAuthenticatorAssuranceLevel()", challenge);
  const recorded = gate.indexOf("await adminMfaSecurityApi.recordVerified()", challenge);
  assert.ok(challenge >= 0 && assurance > challenge && recorded > assurance);
});
