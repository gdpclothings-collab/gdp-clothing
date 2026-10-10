import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20261010021500_admin_invoice_ledger.sql", "utf8");
const ui = readFileSync("src/components/admin/InvoicesModule.jsx", "utf8");

test("invoice ledger provides unique order and invoice IDs", () => {
  assert.match(sql, /order_id uuid not null unique/);
  assert.match(sql, /invoice_number text not null unique/);
  assert.match(sql, /for update/);
});
test("database invoice issuance is admin-only and immutable", () => {
  assert.match(sql, /if auth\.uid\(\) is null or not public\.is_admin\(\)/);
  assert.match(sql, /create trigger gdp_invoices_immutable/);
  assert.match(sql, /raise exception 'Issued invoices are immutable/);
});
test("refunded, cancelled or financially inconsistent orders cannot be invoiced", () => {
  assert.match(sql, /v_order\.status in \('cancelled', 'refunded', 'partially_refunded'\)/);
  assert.match(sql, /Order totals are inconsistent/);
  assert.match(sql, /Order tax breakdown requires review/);
});
test("issued invoice uses archived line items, date and payment state", () => {
  assert.match(sql, /'order_date', v_order\.created_at/);
  assert.match(sql, /'payment_status_at_issue', v_order\.payment_status/);
  assert.match(ui, /created_at: snapshot\.order_date/);
  assert.match(ui, /payment_status: snapshot\.payment_status_at_issue/);
  assert.match(ui, /order_items: snapshot\.items/);
});
test("invoice UI discloses missing tax registration workflow", () => {
  assert.match(ui, /Tax registration numbers and credit notes are not yet supported/);
});
