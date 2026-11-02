import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLEANUP_BUCKETS, MIN_FILE_AGE_MS, MAX_BATCH,
  allowAccount, allowFile, allowOrder, isReferencedByText, createStorageReferenceMatcher,
  selectedTargets, validStoragePath,
} from "../supabase/functions/admin-data-cleanup/policy.mjs";
import { REQUIRED_REFERENCE_TABLES, scanStorageReferences } from "../supabase/functions/admin-data-cleanup/reference-scan.mjs";

const edge = readFileSync("supabase/functions/admin-data-cleanup/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261018024500_admin_data_cleanup.sql", "utf8");
const ui = readFileSync("src/components/admin/AdminDataCleanupModule.jsx", "utf8");
const settings = readFileSync("src/components/admin/SettingsModule.jsx", "utf8");
const api = readFileSync("src/lib/adminDataCleanupApi.js", "utf8");

test("only temporary upload buckets may be cleaned; traversal and current uploads protected", () => {
  assert.deepEqual([...CLEANUP_BUCKETS], ["customer-uploads", "dtf-artwork"]);
  assert.equal(MAX_BATCH, 10);
  for (const bad of ["../test.png", "a/../b.png", "a\\b.png", "/x.png", "x//y.png", "x\u0000y"]) {
    assert.equal(validStoragePath(bad), false, bad);
  }
  assert.equal(allowFile("artwork-production", "safe.png", "2026-01-01"), false);
  assert.equal(allowFile("product-images", "safe.png", "2026-01-01"), false);
  assert.equal(allowFile("customer-uploads", "older/file.png", new Date(Date.now() - MIN_FILE_AGE_MS - 10000).toISOString()), true);
  assert.equal(allowFile("customer-uploads", "just-uploaded.png", new Date().toISOString()), false);
  assert.equal(allowFile("dtf-artwork", "a.png", ""), false);
  assert.equal(isReferencedByText("folder/file.png", JSON.stringify({ src: "https://cdn.example/folder/file.png" })), true);
});

test("protected paid, refunded, shipping, or linked live orders cannot be deleted", () => {
  const testOrder = { payment_mode: "test", payment_status: "pending", status: "payment_failed", fulfillment_status: "unfulfilled" };
  assert.equal(allowOrder(testOrder), true);
  assert.equal(allowOrder({ ...testOrder, payment_status: "paid" }), false);
  assert.equal(allowOrder({ ...testOrder, payment_status: "refunded" }), false);
  assert.equal(allowOrder({ ...testOrder, status: "completed" }), false);
  assert.equal(allowOrder({ ...testOrder, fulfillment_status: "shipped" }), false);
  assert.equal(allowOrder({ ...testOrder, payment_mode: "live", stripe_payment_intent_id: "pi_live" }), false);
  assert.equal(allowOrder({ ...testOrder, payment_mode: "live", stripe_checkout_session_id: "cs_live" }), false);
  assert.equal(allowOrder({ ...testOrder, payment_mode: "live" }), true);
});

test("all admins, the current account and primary email are protected", () => {
  const user = { id: "u-customer", email: "test@example.com" };
  assert.equal(allowAccount(user, "customer", "u-admin"), true);
  assert.equal(allowAccount(user, "admin", "u-admin"), false);
  assert.equal(allowAccount(user, "unknown", "u-admin"), false);
  assert.equal(allowAccount(user, "customer", "u-customer"), false);
  assert.equal(allowAccount({ ...user, email: "GDPClothings@gmail.com" }, "customer", "u-admin"), false);
});

test("reject invalid, duplicated, oversized or empty batch selections", () => {
  assert.equal(selectedTargets([]), null);
  assert.equal(selectedTargets(["same", "same"]), null);
  assert.equal(selectedTargets(new Array(11).fill("x")), null);
  assert.deepEqual(selectedTargets(["a", "b"]), ["a", "b"]);
});

test("backend authenticates AAL2 admin before any service-role operation", () => {
  assert.match(edge, /auth\.getUser\(token\)/);
  assert.match(edge, /tokenClaims\(token\)\.aal !== "aal2"/);
  assert.match(edge, /rpc\("is_admin_step_up_authorized"\)/);
  assert.match(edge, /profile\?\.role !== "admin"/);
  assert.match(edge, /await assertAdmin\(service, url, anon, getBearer\(req\)\)/);
  assert.match(edge, /storage\.from\(bucket\)\.remove\(\[path\]\)/);
  assert.match(edge, /rpc\("admin_cleanup_list_storage_files"/);
  assert.doesNotMatch(edge, /folders\.shift\(\)/);
  assert.match(edge, /auth\.admin\.deleteUser\(id\)/);
  assert.match(edge, /admin_cleanup_delete_test_order/);
  assert.doesNotMatch(edge, /DELETE FROM storage\.objects/i);
  assert.match(edge, /accountDependencies\(service, user\)/);
});

test("database has no browser grants, no RLS relaxation, and transactional financial protection", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /grant execute on function public\.admin_cleanup_delete_test_order\(uuid\) to service_role/i);
  assert.match(migration, /grant execute on function public\.admin_cleanup_owned_storage_count\(uuid\) to service_role/i);
  assert.match(migration, /finance_ledger_source_postings/);
  assert.match(migration, /order_inventory_reservations/);
  assert.match(migration, /guest_design_sessions/);
  assert.match(migration, /request\.jwt\.claim\.role/);
  assert.doesNotMatch(migration, /grant\s+(?:select|delete|update|insert)\s+on\s+public\.orders\s+to\s+(?:anon|authenticated)/i);
});

test("Settings includes a standalone confirmation-driven, responsive cleanup panel", () => {
  assert.match(settings, /<AdminDataCleanupModule \/>/);
  assert.match(ui, /Admin \+ MFA/);
  assert.match(ui, /DELETE FILES/);
  assert.match(ui, /DELETE ORDERS/);
  assert.match(ui, /Type full email to enable deletion/);
  assert.match(ui, /AdminDataCleanupModule/);
  assert.match(api, /supabase\.functions\.invoke\("admin-data-cleanup"/);
});
test("metadata listing is bounded, service-only, and does not delete Storage rows", () => {
  const listing = readFileSync("supabase/migrations/20261018032000_admin_cleanup_fast_storage_listing.sql", "utf8");
  assert.match(listing, /p_bucket not in \('customer-uploads','dtf-artwork'\)/);
  assert.match(listing, /v_total > 2000/);
  assert.match(listing, /revoke all on function public\.admin_cleanup_list_storage_files\(text\) from public, anon, authenticated/);
  assert.match(listing, /grant execute on function public\.admin_cleanup_list_storage_files\(text\) to service_role/);
  assert.doesNotMatch(listing, /delete from storage\.objects/i);
});

test("server-only helpers honor legacy and current JWT role claim formats", () => {
  const compat = readFileSync("supabase/migrations/20261018035500_admin_cleanup_jwt_claim_role_compat.sql", "utf8");
  assert.equal(compat.match(/request\.jwt\.claims/g)?.length, 2);
  assert.match(compat, /admin_cleanup_list_storage_files/);
  assert.match(compat, /admin_cleanup_delete_test_order/);
  assert.match(compat, /revoke all on function public\.admin_cleanup_list_storage_files\(text\) from public, anon, authenticated/);
  assert.match(compat, /revoke all on function public\.admin_cleanup_delete_test_order\(uuid\) from public, anon, authenticated/);
});


function referenceService(rowsByTable = {}, { brokenTable = "", shortPage = false, missingCount = false } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        select(_columns, options = {}) {
          return {
            order(column, { ascending }) {
              assert.equal(column, "id");
              assert.equal(ascending, true);
              return {
                async range(start, end) {
                  calls.push({ table, start, end });
                  if (table === brokenTable) return { data: null, count: null, error: { message: "Read denied" } };
                  const rows = rowsByTable[table] || [];
                  const requested = rows.slice(start, end + 1);
                  return {
                    data: shortPage && table === "orders" ? requested.slice(0, 1) : requested,
                    count: options.count === "exact" ? (missingCount ? null : rows.length) : null,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("one-pass matching preserves every legacy plain, URL-encoded and overlapping path reference", () => {
  const paths = ["some/folder/art.png", "with space/photo #1.webp", "art.png", "encoded/über.png", "unreferenced/test.png"];
  const encoded = paths[1].split("/").map(encodeURIComponent).join("/");
  const content = JSON.stringify({ first: "https://cdn.example/" + encoded, second: "encoded/%C3%BCber.png", nested: "some/folder/art.png" });
  const matcher = createStorageReferenceMatcher(paths);
  matcher.scan(content.slice(0, 27));
  matcher.scan(content.slice(27));
  for (const path of paths) {
    assert.equal(matcher.isReferenced(path), isReferencedByText(path, content), path);
  }
  assert.throws(() => createStorageReferenceMatcher(["../traversal.png"]), /Invalid storage reference scan/);
  assert.throws(() => matcher.scan(null), /Incomplete storage reference data/);
});

test("reference scan verifies every required table and prevents false eligibility", async () => {
  assert.deepEqual(REQUIRED_REFERENCE_TABLES, [
    "orders", "order_items", "custom_designs", "design_proofs", "products",
    "product_variants", "artwork_library", "content_pages", "store_settings", "gdp_invoices",
  ]);
  const service = referenceService({
    orders: [{ id: "o1", memo: "customer-uploads/old/art.png" }],
    custom_designs: [{ id: "c1", settings: { url: "https://cdn.example/with%20space/photo%20%231.webp" } }],
  });
  const paths = ["customer-uploads/old/art.png", "with space/photo #1.webp", "unlinked/test.png"];
  const matcher = await scanStorageReferences(service, paths);
  assert.equal(matcher.isReferenced(paths[0]), true);
  assert.equal(matcher.isReferenced(paths[1]), true);
  assert.equal(matcher.isReferenced(paths[2]), false);
  assert.deepEqual(service.calls.map((x) => x.table), [...REQUIRED_REFERENCE_TABLES]);
});

test("reference scan catches references on later pages and rejects truncated results", async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => ({ id: String(i).padStart(6, "0"), url: i === 1000 ? "late/file.png" : "other" }));
  const service = referenceService({ orders: rows });
  const matcher = await scanStorageReferences(service, ["late/file.png"]);
  assert.equal(matcher.isReferenced("late/file.png"), true);
  assert.ok(service.calls.some((call) => call.table === "orders" && call.start === 1000));
  await assert.rejects(scanStorageReferences(referenceService({ orders: rows }, { shortPage: true }), ["late/file.png"]), /page incomplete/);
  await assert.rejects(scanStorageReferences(referenceService({}, { missingCount: true }), ["safe.png"]), /count unavailable/);
  await assert.rejects(scanStorageReferences(referenceService({}, { brokenTable: "custom_designs" }), ["safe.png"]), /scan incomplete/);
  await assert.rejects(scanStorageReferences(referenceService({ orders: Array.from({ length: 5000 }, (_, i) => ({ id: i })) }), ["safe.png"]), /exceeded safety limit/);
});

test("empty or invalid reference sets cannot accidentally authorize file deletion", async () => {
  const service = referenceService();
  const empty = await scanStorageReferences(service, []);
  assert.equal(empty.isReferenced("anything.png"), false);
  assert.equal(service.calls.length, 0);
  await assert.rejects(scanStorageReferences(service, ["../bad.png"]), /Invalid storage reference scan/);
  assert.match(edge, /scanStorageReferences\(service, candidates\)/);
  assert.match(edge, /scanStorageReferences\(service, paths\)/);
  assert.match(edge, /paths\.some\(\(path\) => references\.isReferenced\(path\)\)/);
  assert.doesNotMatch(edge, /referencedData\(/);
});

test("837-file regression stays bounded without rescanning entire reference JSON for each file", () => {
  const paths = Array.from({ length: 837 }, (_, i) => `guest/uploads/${String(i).padStart(4, "0")}/customer-artwork.png`);
  const matcher = createStorageReferenceMatcher(paths);
  const text = JSON.stringify({ data: "unrelated-data-".repeat(320000), referenced: paths[836] });
  matcher.scan(text);
  assert.equal(matcher.isReferenced(paths[836]), true);
  assert.equal(matcher.isReferenced(paths[0]), false);
});
