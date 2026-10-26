import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync("src/lib/adminDashboardApi.js", "utf8");
const smoke = readFileSync("scripts/admin-authenticated-smoke.mjs", "utf8");
const home = readFileSync("src/pages/AdminV2.jsx", "utf8");

test("admin Home uses only the existing step-up protected settings RPC", () => {
  assert.match(dashboard, /supabase\.rpc\("get_admin_store_settings"\)/);
  assert.doesNotMatch(dashboard, /\.from\("store_settings"\)/);
  assert.match(dashboard, /const authorizedSettings = unwrap\(settingsResult\)\.data/);
  assert.match(dashboard, /throw new Error\("Admin store settings response is unavailable or invalid\."\)/);
});

test("dashboard keeps minimal settings fields without propagating the private record", () => {
  const start = dashboard.indexOf("const settings = {");
  assert.ok(start > 0, "dashboard settings projection missing");
  const projection = dashboard.slice(start, dashboard.indexOf("};", start));
  for (const column of ["store_name", "currency", "timezone", "low_stock_threshold"]) {
    assert.match(projection, new RegExp(`\\b${column}: authorizedSettings\\.${column}\\b`));
  }
  assert.doesNotMatch(projection, /\.\.\.authorizedSettings/);
});

test("admin smoke waits for real RPC authorization and populated Home on desktop and mobile", () => {
  assert.match(smoke, /\/rest\/v1\/rpc\/get_admin_store_settings/);
  assert.match(smoke, /response\.status\(\) === 200/);
  assert.match(smoke, /Admin overview could not load/);
  assert.match(smoke, /permission denied for table store_settings/);
  assert.equal(smoke.match(/const settingsResponse = expectAdminDashboardSettingsResponse\(page\)/g)?.length, 2);
  assert.equal(smoke.match(/await assertAdminDashboardHasLoadedData\(page, settingsResponse\)/g)?.length, 2);
  assert.match(home, /Admin overview could not load/);
});

test("no database grants, RLS changes, or payment mutations in dashboard fix", () => {
  assert.doesNotMatch(dashboard, /service_role|CREATE POLICY|GRANT |DISABLE ROW LEVEL SECURITY|\.from\("payments"\)/i);
});

const settingsModule = readFileSync("src/components/admin/SettingsModule.jsx", "utf8");
const settingsApi = readFileSync("src/lib/adminSettingsApi.js", "utf8");
const generalAdminApi = readFileSync("src/lib/adminApi.js", "utf8");

test("payment-mode save is isolated from ordinary store settings and cannot mix pending edits", () => {
  assert.match(settingsModule, /const paymentModeChanged = savedForm\?\.paymentMode !== form\?\.paymentMode/);
  assert.match(settingsModule, /otherUnsavedChanges/);
  assert.match(settingsModule, /Save or discard other settings first/);
  assert.match(settingsModule, /adminSettingsApi\.savePaymentMode\(savedForm\.paymentMode, form\.paymentMode\)/);
  assert.match(settingsModule, /if \(paymentModeChanged\) \{\s*await adminSettingsApi\.savePaymentMode/);
});

test("payment-mode update requires verified MFA and writes only one column with optimistic match", () => {
  const start = settingsApi.indexOf("  async savePaymentMode(");
  assert.ok(start >= 0, "dedicated payment-mode method is missing");
  const body = settingsApi.slice(start, settingsApi.indexOf("\n  async loadDtfSettings()", start));
  assert.match(body, /getAuthenticatorAssuranceLevel\(\)/);
  assert.match(body, /assurance\?\.currentLevel !== "aal2"/);
  assert.match(body, /\.update\(\{ payment_mode: nextMode \}\)/);
  assert.match(body, /\.eq\("payment_mode", expectedMode\)/);
  assert.match(body, /\.select\("payment_mode"\)/);
  assert.match(body, /data\?\.payment_mode !== nextMode/);
  assert.doesNotMatch(body, /service_role|STRIPE_SECRET|\.from\("orders"\)|stripe-webhook/i);
});

test("ordinary settings save cannot silently reset payment mode from a stale or legacy form", () => {
  const start = generalAdminApi.indexOf("  async saveStoreSettings(");
  assert.ok(start >= 0, "ordinary store-settings method missing");
  const body = generalAdminApi.slice(start, generalAdminApi.indexOf("\n  },", start));
  assert.doesNotMatch(body, /\bpayment_mode\s*:/);
  assert.match(body, /hasOwnProperty\.call\(data, "testInventoryWorkflow"\)/);
});
