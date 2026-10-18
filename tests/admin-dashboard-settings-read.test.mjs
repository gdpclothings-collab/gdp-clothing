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
