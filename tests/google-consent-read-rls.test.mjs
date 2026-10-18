import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261018042000_policy_acceptances_owner_select.sql", "utf8");
const authComplete = readFileSync("src/pages/AuthComplete.jsx", "utf8");
const privacy = readFileSync("src/lib/privacyApi.js", "utf8");

test("previously recorded policy consent remains available only to its owner", () => {
  assert.match(migration, /create policy "policy_acceptances_read_own"/i);
  assert.match(migration, /on public\.policy_acceptances/i);
  assert.match(migration, /for select\s+to authenticated/i);
  assert.match(migration, /using \(user_id = \(select auth\.uid\(\)\)\)/i);
  assert.doesNotMatch(migration, /for all|using\s*\(\s*true\s*\)|to anon|security definer/i);
  assert.doesNotMatch(migration, /\b(?:grant|revoke|drop|delete|insert|update|truncate)\b(?:(?!--).)*;/i);
});

test("Google sign-in skips agreement when both current policy receipts exist", () => {
  assert.match(authComplete, /privacyApi\.getAccountPrivacy\(\)/);
  assert.match(authComplete, /item\.policy_key === "terms_conditions" && item\.policy_version === POLICY_VERSION/);
  assert.match(authComplete, /item\.policy_key === "privacy_policy" && item\.policy_version === POLICY_VERSION/);
  assert.match(authComplete, /if \(hasTerms && hasPrivacy\) \{\s*window\.location\.replace\(destination\)/);
  assert.match(authComplete, /const POLICY_VERSION = "2026-09-07"/);
  assert.match(privacy, /\.from\("policy_acceptances"\)/);
  assert.match(privacy, /\.eq\("user_id", user\.id\)/);
});

test("marketing remains an independent opt-in, not a condition for account access", () => {
  assert.match(authComplete, /const \[marketingConsent, setMarketingConsent\] = useState\(false\)/);
  assert.match(authComplete, /if \(!termsAccepted \|\| saving\)/);
  assert.doesNotMatch(authComplete, /if \(!marketingConsent\)/);
});