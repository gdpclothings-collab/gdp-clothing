import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ledger = readFileSync("supabase/migrations/20261010021500_admin_invoice_ledger.sql", "utf8");
const issuer = readFileSync("supabase/migrations/20261011033000_invoice_issuance_strict_aal2.sql", "utf8");
const terms = readFileSync("supabase/migrations/20261011043000_invoice_issued_terms_snapshot.sql", "utf8");
const ui = readFileSync("src/components/admin/InvoicesModule.jsx", "utf8");

test("official invoice ledger has unique invoice and order IDs", () => {
  assert.match(ledger, /order_id uuid not null unique/);
  assert.match(ledger, /invoice_number text not null unique/);
  assert.match(ledger, /create trigger gdp_invoices_immutable/);
});
test("final issuance preserves authorization, row locking, and immutability", () => {
  assert.match(terms, /auth\.uid\(\) is null or not public\.is_admin\(\)/);
  assert.match(terms, /coalesce\(auth\.jwt\(\)->>'aal','aal1'\) <> 'aal2'/);
  assert.match(terms, /for update/);
  assert.match(terms, /v_order\.status in \('cancelled','refunded','partially_refunded'\)/);
  assert.match(terms, /Order totals inconsistent/);
  assert.match(terms, /Order tax breakdown requires review/);
  assert.match(issuer, /issue_admin_invoice_from_draft/);
  assert.match(terms, /grant execute on function public\.issue_admin_order_invoice\(uuid\) to authenticated/);
});
test("issued invoice freezes dates, financials, and identity data", () => {
  for (const item of [
    "'invoice_document_meta',v_order.invoice_document_meta",
    "'invoice_due_date',v_order.invoice_due_date",
    "'invoice_payment_terms',v_order.invoice_payment_terms",
    "'order_date',v_order.created_at",
    "'payment_status_at_issue',v_order.payment_status",
    "'customer_email',v_order.customer_email",
    "'billing_address',v_order.billing_address",
    "'total',v_order.total",
  ]) assert.ok(terms.includes(item), "Missing archived field: " + item);
  assert.match(ui, /invoice_due_date/);
  assert.match(ui, /snapshot\.order_date/);
  assert.match(ui, /snapshot\.payment_status_at_issue/);
  assert.match(ui, /snapshot\.items/);
});
test("MFA review and issuance use separate, explicit confirmation controls", () => {
  assert.match(ui, /getAuthenticatorAssuranceLevel/);
  assert.match(ui, /Confirm official invoice issuance/);
  assert.match(ui, /requestIssueConfirmation/);
  assert.match(ui, /issue_admin_invoice_from_draft/);
  assert.match(ui, /predates immutable due-date snapshots/);
});
