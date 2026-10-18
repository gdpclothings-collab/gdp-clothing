import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLEANUP_BUCKETS, MIN_FILE_AGE_MS, MAX_BATCH,
  allowAccount, allowFile, allowOrder, isReferencedByText,
  selectedTargets, validStoragePath,
} from "../supabase/functions/admin-data-cleanup/policy.mjs";

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