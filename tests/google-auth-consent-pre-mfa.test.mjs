import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/AuthComplete.jsx", "utf8");
const sql = readFileSync("supabase/migrations/20261018033800_google_auth_policy_acceptance_check.sql", "utf8");

test("existing Google users are not prompted because their admin consent listing is hidden before MFA", () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /supabase\.rpc\(\s*"has_my_current_registration_policy_acceptances"/);
  assert.doesNotMatch(page, /privacyApi\.getAccountPrivacy\(\)/);
  assert.match(page, /if \(hasCurrentAcceptance === true\) \{\s*window\.location\.replace\(destination\)/);
  assert.match(page, /if \(acceptanceError\) throw acceptanceError/);
});

test("new Google consent saves server-side and verifies it before redirect", () => {
  assert.match(page, /privacyApi\.recordRegistrationAcceptance\(/);
  assert.equal(page.match(/"has_my_current_registration_policy_acceptances"/g)?.length, 2);
  assert.match(page, /if \(persisted !== true\)/);
  assert.match(page, /throw new Error\("Your agreement could not be saved/);
  assert.match(page, /if \(persistenceError\) throw persistenceError/);
  assert.match(page, /if \(!termsAccepted \|\| saving\)/);
});

test("own-policy lookup is boolean-only, tied to current auth.uid and both current policies", () => {
  assert.match(sql, /returns boolean/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /pa\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /pa\.policy_key = 'terms_conditions'/);
  assert.match(sql, /pa\.policy_key = 'privacy_policy'/);
  assert.equal(sql.match(/pa\.policy_version = '2026-09-07'/g)?.length, 2);
  assert.match(page, /const POLICY_VERSION = "2026-09-07"/);
  assert.match(sql, /revoke all on function public\.has_my_current_registration_policy_acceptances\(\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.has_my_current_registration_policy_acceptances\(\)\s+to authenticated/i);
  assert.doesNotMatch(sql, /alter policy|create policy|grant select on|set row_security|service_role/i);
});
