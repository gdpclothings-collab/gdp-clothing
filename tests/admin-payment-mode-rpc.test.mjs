import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { requestAdminPaymentModeSwitch } from "../src/lib/paymentModeSecureSwitch.js";

const migration = readFileSync(
  "supabase/migrations/20261031023001_gdp_paymentmode_securefix_v1.sql",
  "utf8"
);

function mockClient({ aal = "aal2", response = { data: null, error: null } } = {}) {
  const calls = [];
  const client = {
    auth: { mfa: { async getAuthenticatorAssuranceLevel() {
      calls.push("mfa");
      return { data: { currentLevel: aal }, error: null };
    } } },
    async rpc(name, params) {
      calls.push({ name, params });
      return response;
    },
    from() {
      throw new Error("Direct store_settings access is forbidden");
    },
  };
  return { client, calls };
}

for (const [before, after] of [["live", "test"], ["test", "live"]]) {
  test(`payment-mode ${before} to ${after} uses only secure RPC (simulated, no charge)`, async () => {
    const { client, calls } = mockClient({ response: { data: after, error: null } });
    assert.equal(await requestAdminPaymentModeSwitch(client, before, after), after);
    assert.deepEqual(calls, ["mfa", {
      name: "set_admin_payment_mode",
      params: { p_expected_mode: before, p_next_mode: after },
    }]);
  });
}

test("rejects invalid and unchanged payment modes before accessing the database", async () => {
  const { client, calls } = mockClient();
  for (const [before, after] of [["live", "live"], ["test", "unknown"], [null, "live"]]) {
    await assert.rejects(requestAdminPaymentModeSwitch(client, before, after), /Invalid payment-mode change/);
  }
  assert.deepEqual(calls, []);
});

test("rejects an AAL1 session without invoking the RPC", async () => {
  const { client, calls } = mockClient({ aal: "aal1" });
  await assert.rejects(requestAdminPaymentModeSwitch(client, "live", "test"), /MFA \(AAL2\)/);
  assert.deepEqual(calls, ["mfa"]);
});

for (const [code, message] of [
  ["42501", /authorized admin session/],
  ["22023", /Invalid payment-mode change/],
  ["P0001", /another session/],
  ["P0002", /Store settings are missing/],
  ["XX000", /could not be saved/],
]) {
  test(`explicitly handles RPC error ${code}`, async () => {
    const { client } = mockClient({ response: { data: null, error: { code } } });
    await assert.rejects(requestAdminPaymentModeSwitch(client, "live", "test"), message);
  });
}

test("rejects an unverified success response", async () => {
  const { client } = mockClient({ response: { data: "live", error: null } });
  await assert.rejects(requestAdminPaymentModeSwitch(client, "live", "test"), /could not be verified/);
});

test("SQL confines privileged logic to private schema and enforces real server-side AAL2", () => {
  assert.match(migration, /create function private\.set_admin_payment_mode\(p_expected_mode text, p_next_mode text\)/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /auth\.uid\(\) is null/i);
  assert.match(migration, /auth\.jwt\(\)\s*->>\s*'aal'[^\n]*<>\s*'aal2'/i);
  assert.match(migration, /not public\.is_admin\(\)/i);
  assert.match(migration, /update public\.store_settings\s+set payment_mode\s*=\s*p_next_mode\s+where id\s*=\s*1\s+and payment_mode\s*=\s*p_expected_mode/i);
  assert.match(migration, /create function public\.set_admin_payment_mode/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /revoke all on function public\.set_admin_payment_mode\(text, text\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.set_admin_payment_mode\(text, text\) to authenticated/i);
  assert.doesNotMatch(migration, /grant\s+(?:select|update)\s+on\s+(?:public\.)?store_settings|alter\s+policy|drop\s+policy|disable\s+row\s+level\s+security/i);
  assert.doesNotMatch(migration, /stripe|tax_rate|order_items|webhook/i);
});
