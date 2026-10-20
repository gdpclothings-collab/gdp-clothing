import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20261019230500_harden_nine_rpc_definer_facades.sql", import.meta.url),
  "utf8",
);
const functions = [
  ["activate_admin_draft_atomic", "uuid", true],
  ["has_my_current_registration_policy_acceptances", "", false],
  ["issue_admin_invoice_from_draft", "uuid", true],
  ["issue_admin_order_invoice", "uuid", true],
  ["reserve_admin_invoice_number", "uuid", true],
  ["save_admin_draft_atomic", "uuid,jsonb,jsonb", true],
  ["save_admin_invoice_document_meta", "uuid,jsonb", true],
  ["save_admin_invoice_draft_complete", "uuid,jsonb,jsonb,jsonb", true],
  ["save_admin_invoice_layout_dates", "uuid,jsonb,date", true],
];

test("migration is one transactional forward-only change", () => {
  assert.match(sql, /\bbegin;[\s\S]*\bcommit;\s*$/i);
  assert.equal((sql.match(/\balter function public\./gi) || []).length, 9);
  assert.equal((sql.match(/^\s*security invoker\s*$/gim) || []).length, 9);
  assert.equal((sql.match(/\bset schema private;/gi) || []).length, 9);
  assert.doesNotMatch(sql, /\bdrop\s+(?:function|table|schema)\b/i);
  assert.doesNotMatch(sql, /\b(?:update|delete from|insert into)\s+public\.(?:orders|order_items|gdp_invoices)\b/i);
});

test("every existing browser RPC has a compatible invoker facade", () => {
  for (const [name, args] of functions) {
    assert.ok(sql.includes(`alter function public.${name}(${args}) set schema private;`), name);
    assert.ok(sql.includes(`revoke all on function public.${name}(${args}) from public, anon;`), name);
    assert.ok(sql.includes(`grant execute on function public.${name}(${args}) to authenticated, service_role;`), name);
    assert.ok(sql.includes(`revoke all on function private.${name}(${args}) from public, anon;`), name);
    assert.ok(sql.includes(`grant execute on function private.${name}(${args}) to authenticated, service_role;`), name);
    assert.ok(sql.includes(`select private.${name}(`), name);
  }
});

test("preserve policy-acceptance access while requiring strict AAL2 for six draft mutations", () => {
  const guardedNames = functions
    .filter(([name, , admin]) => admin && !name.startsWith("issue_admin_"))
    .map(([name, args]) => `'private.${name}(${args})'`);
  for (const signature of guardedNames) assert.ok(sql.includes(signature), signature);
  assert.equal(guardedNames.length, 6);
  assert.match(sql, /not public\.is_admin_step_up_authorized\(\).*?auth\.jwt\(\)->>''aal''.*?''aal2''/s);
  assert.ok(!guardedNames.some((x) => x.includes("has_my_current_registration_policy_acceptances")));
  assert.match(sql, /customer policy-acceptance lookup intentionally requires login, NOT admin\/MFA/i);
});

test("fail closed on production privilege drift and verify ACLs after creating shims", () => {
  assert.match(sql, /preflight: unexpected security state/);
  assert.match(sql, /private implementation already exists/);
  assert.match(sql, /has_function_privilege\('anon',v_private,'EXECUTE'\)/);
  assert.match(sql, /has_function_privilege\('authenticated',v_public,'EXECUTE'\)/);
  assert.match(sql, /notify pgrst, 'reload schema'/);
});
