import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { enteringProduction, productionPaymentGate } from "../src/lib/productionPaymentGate.js";

const read = (path) => readFileSync(path, "utf8");
const fileUrl = pathToFileURL(process.cwd() + "/src/lib/productionPaymentGate.js").href;
const workflowSource = read("src/lib/orderWorkflow.js").replace(
  'from "@/lib/productionPaymentGate"',
  `from "${fileUrl}"`
);
const { getWorkflowIssues } = await import(`data:text/javascript;base64,${Buffer.from(workflowSource).toString("base64")}`);
const importSource = async (source) => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const cases = [
  ["live paid", { payment_status: "paid", payment_mode: "live" }, true, "Paid Live"],
  ["test paid", { payment_status: "paid", payment_mode: "test" }, false, "QA Only"],
  ["live pending", { payment_status: "pending", payment_mode: "live" }, false, "Production Blocked"],
  ["live failed", { payment_status: "failed", payment_mode: "live" }, false, "Production Blocked"],
  ["live refunded", { payment_status: "refunded", payment_mode: "live" }, false, "Production Blocked"],
  ["live partially refunded", { payment_status: "partially_refunded", payment_mode: "live" }, false, "Production Blocked"],
  ["test pending", { payment_status: "pending", payment_mode: "test" }, false, "Production Blocked"],
  ["unknown mode paid", { payment_status: "paid" }, false, "Production Blocked"],
];

for (const [label, payment, eligible, expectedLabel] of cases) {
  const gate = productionPaymentGate(payment);
  assert.equal(gate.canRelease, eligible, label);
  assert.equal(gate.label, expectedLabel, `${label} label`);
  const workflowIssues = getWorkflowIssues({
    ...payment,
    production_status: "not_started",
    productionStatus: "queued",
    design_status: "not_required",
  });
  assert.equal(workflowIssues.some((issue) => issue.includes("QA Only") || issue.includes("Production Blocked")), !eligible, `${label} workflow entry`);
}

assert.equal(enteringProduction("not_started", "queued"), true);
assert.equal(enteringProduction("not_started", "printing"), true);
assert.equal(enteringProduction("queued", "printing"), false);
assert.equal(enteringProduction("printing", "packing"), false);
assert.equal(enteringProduction("queued", "not_started"), false);

// Do not retroactively block an already-in-progress partial-refund adjustment.
const activeLegacy = getWorkflowIssues({
  payment_status: "partially_refunded", payment_mode: "live",
  production_status: "printing", productionStatus: "packing",
  design_status: "not_required",
});
assert.equal(activeLegacy.filter((issue) => /Production Blocked|QA Only/.test(issue)).length, 0);
const historicalTest = getWorkflowIssues({
  payment_status: "paid", payment_mode: "test",
  production_status: "queued", productionStatus: "printing",
  design_status: "not_required",
});
assert.ok(historicalTest.some((issue) => issue.includes("QA Only")), "historical test queue cannot advance");

// Exercise both API boundaries against fresh server-state reads, not just
// React's (possibly stale) order snapshot.
let currentDatabaseOrder = null;
globalThis.__gdpProductionTestSupabase = {
  from(table) {
    assert.equal(table, "orders");
    return {
      select() { return this; },
      eq() { return this; },
      async maybeSingle() { return { data: currentDatabaseOrder, error: null }; },
    };
  },
};
const prodPaymentSource = read("src/lib/adminProductionPaymentApi.js")
  .replace('import { supabase } from "@/lib/supabaseClient";', 'const supabase = globalThis.__gdpProductionTestSupabase;')
  .replace('from "@/lib/productionPaymentGate"', `from "${fileUrl}"`);
const { assertPaidLiveProductionEntry } = await importSource(prodPaymentSource);
currentDatabaseOrder = { production_status: "not_started", payment_status: "paid", payment_mode: "test" };
await assert.rejects(assertPaidLiveProductionEntry("order-test", "queued"), /QA Only/);
currentDatabaseOrder = { production_status: "not_started", payment_status: "failed", payment_mode: "live" };
await assert.rejects(assertPaidLiveProductionEntry("order-failed", "queued"), /Production Blocked/);
currentDatabaseOrder = { production_status: "not_started", payment_status: "paid", payment_mode: "live" };
await assert.doesNotReject(assertPaidLiveProductionEntry("order-live", "queued"));
currentDatabaseOrder = { production_status: "printing", payment_status: "partially_refunded", payment_mode: "live" };
await assert.doesNotReject(assertPaidLiveProductionEntry("order-existing", "packing"));
currentDatabaseOrder = { production_status: "queued", payment_status: "paid", payment_mode: "test" };
await assert.rejects(assertPaidLiveProductionEntry("order-old-test", "printing"), /QA Only/);

const dtfApiSource = read("src/lib/adminDtfGangSheetApi.js")
  .replace('import { supabase } from "@/lib/supabaseClient";', 'const supabase = globalThis.__gdpProductionTestSupabase;')
  .replace('import { calculateDtfPrice, normalizeDtfSettings } from "@/lib/dtfGangSheet";', 'const calculateDtfPrice = () => ({ price: 0 }); const normalizeDtfSettings = (value) => value;')
  .replace('from "@/lib/productionPaymentGate"', `from "${fileUrl}"`);
const { adminDtfGangSheetApi } = await importSource(dtfApiSource);
currentDatabaseOrder = { payment_status: "paid", payment_mode: "test" };
await assert.rejects(adminDtfGangSheetApi.assertProductionExportReady("order-test"), /QA Only/);
currentDatabaseOrder = { payment_status: "pending", payment_mode: "live" };
await assert.rejects(adminDtfGangSheetApi.assertProductionExportReady("order-pending"), /Production Blocked/);
currentDatabaseOrder = { payment_status: "paid", payment_mode: "live" };
await assert.doesNotReject(adminDtfGangSheetApi.assertProductionExportReady("order-live"));

const exportSource = read("src/lib/dtfFilmExport.js").replace('import { normalizeArtworkRotation } from "@/lib/dtfGangSheet";', 'const normalizeArtworkRotation = () => 0;');
const { exportProductionPackage } = await importSource(exportSource);
let authorizationCalls = 0;
await assert.rejects(exportProductionPackage({ items: [], width: 34, length: 36 }), /payment authorization is required/);
await assert.rejects(exportProductionPackage({ items: [], width: 34, length: 36, authorizeProduction: async () => { authorizationCalls += 1; throw new Error("QA Only"); } }), /QA Only/);
await assert.rejects(exportProductionPackage({ items: [{ type: "pdf" }], width: 34, length: 36, authorizeProduction: async () => { authorizationCalls += 1; } }), /image source files/);
assert.equal(authorizationCalls, 2, "fresh authorization must run before any rendering or ZIP generation");
delete globalThis.__gdpProductionTestSupabase;

const migration = read("supabase/migrations/20261026031641_enforce_paid_live_production_entry.sql");
assert.match(migration, /create trigger orders_enforce_paid_live_production_entry/i);
assert.match(migration, /before insert or update of production_status, payment_status, payment_mode/i);
assert.match(migration, /old\.production_status = 'not_started'/);
assert.match(migration, /new\.payment_status is distinct from 'paid'/);
assert.match(migration, /new\.payment_mode is distinct from 'live'/);
assert.match(migration, /old\.production_status is distinct from new\.production_status/);
assert.doesNotMatch(migration, /update public\.orders\s+set/i, "migration must not rewrite orders");
assert.doesNotMatch(migration, /security definer/i, "guard must execute as invoker");

const ordersApi = read("src/lib/adminOrdersApi.js");
const productionApi = read("src/lib/adminProductionApi.js");
const paymentApi = read("src/lib/adminProductionPaymentApi.js");
assert.match(ordersApi, /assertPaidLiveProductionEntry\(orderId,productionStatus\)/);
assert.match(ordersApi, /assertPaidLiveProductionEntry\(orderId,values\.productionStatus\)/);
assert.match(productionApi, /assertPaidLiveProductionEntry\(orderId, productionStatus\)/);
assert.match(paymentApi, /\.select\("id, production_status, payment_status, payment_mode"\)/);

const dtfApi = read("src/lib/adminDtfGangSheetApi.js");
const dtfAdmin = read("src/components/admin/DTFGangSheetAdminModule.jsx");
const dtfExport = read("src/lib/dtfFilmExport.js");
assert.match(dtfApi, /paymentMode: order\.payment_mode/);
assert.match(dtfApi, /async assertProductionExportReady\(orderId\)/);
assert.match(dtfApi, /\.select\("id, payment_status, payment_mode"\)/);
assert.match(dtfAdmin, /form\.adminProductionExportEnabled && productionPaymentGate\(entry\)\.canRelease/);
assert.match(dtfAdmin, /authorizeProduction: \(\) => adminDtfGangSheetApi\.assertProductionExportReady\(entry\.orderId\)/);
assert.match(dtfExport, /if \(typeof authorizeProduction !== "function"\) throw/);
assert.match(dtfExport, /await authorizeProduction\(\);/);
assert.match(dtfExport, /const dpi = Number\(settings\?\.recommendedDpi \|\| 300\)/);
assert.match(dtfExport, /export async function downloadFilmPreview/);

console.log(`PASS: ${cases.length} payment-mode scenarios, live-read API transitions, DTF authorization before ZIP generation, SQL policy, admin routes and 300-DPI invariant`);
