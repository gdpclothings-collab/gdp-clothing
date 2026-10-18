import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edge = readFileSync("supabase/functions/own-policy-acceptance-status/index.ts","utf8");
const callback = readFileSync("src/pages/AuthComplete.jsx","utf8");
const privacy = readFileSync("src/lib/privacyApi.js","utf8");

test("Google OAuth checks saved terms + privacy once, and redirects on both receipts",()=>{
  assert.match(callback, /privacyApi\.getOwnPolicyAcceptanceStatus\(\)/);
  assert.match(callback, /status\?\.policyVersion === POLICY_VERSION && status\.termsAccepted === true/);
  assert.match(callback, /status\?\.policyVersion === POLICY_VERSION && status\.privacyAccepted === true/);
  assert.match(callback, /if \(hasTerms && hasPrivacy\) \{\s*window\.location\.replace\(destination\)/);
  assert.doesNotMatch(callback, /privacyApi\.getAccountPrivacy\(\)/);
  assert.equal((callback.match(/const POLICY_VERSION = "2026-09-07"/g)||[]).length,1);
});

test("receipt API requires verified JWT and reads only current user's receipts",()=>{
  assert.match(edge, /req\.headers\.get\("Authorization"\)/);
  assert.match(edge, /auth\.auth\.getUser\(token\)/);
  assert.match(edge, /\.eq\("user_id", userId\)/);
  assert.match(edge, /\.eq\("policy_version", POLICY_VERSION\)/);
  assert.match(edge, /\.in\("policy_key", \["terms_conditions", "privacy_policy"\]\)/);
  assert.match(edge, /termsAccepted: accepted\.has\("terms_conditions"\)/);
  assert.match(edge, /privacyAccepted: accepted\.has\("privacy_policy"\)/);
  assert.match(edge, /Cache-Control": "no-store"/);
  assert.match(edge, /if \(req\.method !== "POST"\)/);
  assert.match(edge, /if \(!token\).*401/);
  assert.match(edge, /if \(userError \|\| !userId\).*401/);
  assert.doesNotMatch(edge, /body\.userId|body\.email|raw_user_meta_data|\.auth\.admin\.|mfa\.unenroll/i);
  assert.doesNotMatch(edge, /\.insert\(|\.update\(|\.delete\(|CREATE POLICY|grant /i);
});

test("the client rejects missing/invalid responses instead of requesting agreement",()=>{
  assert.match(privacy, /supabase\.functions\.invoke\("own-policy-acceptance-status"/);
  assert.match(privacy, /if \(error\) throw error/);
  assert.match(privacy, /if \(data\?\.error\) throw new Error\(data\.error\)/);
  assert.match(privacy, /Could not verify saved Terms agreement/);
  assert.match(privacy, /Could not verify saved Privacy agreement/);
});

test("marketing opt-in remains optional and the existing consent writer is unchanged",()=>{
  assert.match(callback, /const \[marketingConsent, setMarketingConsent\] = useState\(false\)/);
  assert.match(callback, /if \(!termsAccepted \|\| saving\)/);
  assert.match(callback, /privacyApi\.recordRegistrationAcceptance\(/);
  assert.doesNotMatch(callback, /if \(!marketingConsent\)/);
});