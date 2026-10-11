/**
 * GDP Clothing — invoice release checkout isolation gate (read-only).
 * Checks that invoice preparation / issuance cannot replace the storefront's
 * checkout-gateway, Stripe payment confirmation, tax or inventory authority.
 * This script never calls external APIs, executes SQL, or charges customers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name) => readFileSync(name, "utf8");
const checkout = read("src/pages/CheckoutTwoStep.jsx");
const customer = read("src/lib/customerApi.js");
const checkoutEdge = read("supabase/functions/checkout/index.ts");
const checkoutGateway = read("supabase/functions/checkout-gateway/index.ts");
const pay = read("src/lib/paymentApi.js");
const payment = read("supabase/functions/payment-session/index.ts");
const webhook = read("supabase/functions/stripe-webhook/index.ts");
const invoiceEditor = read("src/components/admin/CreateInvoiceEditor.jsx");
const invoices = read("src/components/admin/InvoicesModule.jsx");
const adminDraftApi = read("src/lib/adminDraftOrdersApi.js");
const draftSql = read("supabase/migrations/20261010181000_atomic_manual_drafts.sql");
const issuerSql = read("supabase/migrations/20261011043000_invoice_issued_terms_snapshot.sql");
const strictSql = read("supabase/migrations/20261011033000_invoice_issuance_strict_aal2.sql");
const sharedTax = read("src/lib/sharedTaxConfiguration.js");

test("shopper checkout never calls privileged administrative invoice RPCs", () => {
  const customerCode = [checkout, customer, checkoutEdge, checkoutGateway, pay, payment, webhook].join("\n");
  for (const forbidden of [
    "save_admin_draft_atomic",
    "save_admin_invoice_draft_complete",
    "activate_admin_draft_atomic",
    "reserve_admin_invoice_number",
    "issue_admin_invoice_from_draft",
    "issue_admin_order_invoice",
  ]) {
    assert.ok(!customerCode.includes(forbidden), "Shopper checkout references admin invoice RPC: " + forbidden);
  }
  assert.match(customer, /checkout-gateway/);
  assert.match(checkoutGateway, /claim_checkout_session/);
  assert.match(checkout, /paymentClient\.stripe\.confirmPayment/);
  assert.match(webhook, /finalizePaidOrder/);
  assert.match(webhook, /apply_paid_order_inventory/);
  assert.match(webhook, /redeem_order_coupon/);
});

test("admin invoice editors do not invoke payment methods or Stripe checkout", () => {
  const adminUi = [invoiceEditor, invoices, adminDraftApi].join("\n");
  for (const forbidden of [
    "paymentIntents.create", "paymentIntents.confirm",
    "stripe.confirmPayment", "checkout-gateway",
    "payment-session", "stripe-webhook",
    "apply_paid_order_inventory", "redeem_order_coupon",
  ]) assert.ok(!adminUi.includes(forbidden), "Invoice admin UI references payment authority: " + forbidden);
  assert.match(adminDraftApi, /save_admin_draft_atomic/);
  assert.match(adminDraftApi, /save_admin_invoice_draft_complete/);
  assert.match(invoices, /issue_admin_invoice_from_draft/);
});

test("drafts remain unpaid and final issuance only freezes the ledger", () => {
  assert.match(draftSql, /'draft','draft','pending'/);
  assert.match(draftSql, /payment_status='pending'/);
  assert.match(draftSql, /if auth\.uid\(\) is null or not public\.is_admin\(\)/);
  assert.match(issuerSql, /coalesce\(auth\.jwt\(\)->>'aal','aal1'\) <> 'aal2'/);
  assert.match(strictSql, /coalesce\(auth\.jwt\(\)->>'aal','aal1'\) <> 'aal2'/);
  assert.match(issuerSql, /from public\.orders where id=p_order_id for update/);
  assert.match(issuerSql, /insert into public\.gdp_invoices/);
  assert.ok(!/payment_status\s*=\s*'paid'/.test(issuerSql), "Invoice issuance may not mark an unpaid order paid");
  assert.ok(!/apply_paid_order_inventory|redeem_order_coupon|checkout_sessions/.test(issuerSql),
    "Invoice issuance may not allocate paid inventory, redeem coupons, or modify checkout sessions");
});

test("shared tax readiness is read-only and does not rewire checkout", () => {
  assert.match(sharedTax, /supabase\.from\("tax_rules"\)\.select/);
  assert.match(sharedTax, /supabase\.rpc\("get_admin_tax_filing_controls"/);
  assert.ok(!/\.insert\s*\(|\.update\s*\(|\.delete\s*\(|stripe\.|apply_paid_order_inventory/.test(sharedTax),
    "Shared tax verification must not write collection rules or payment records");
  assert.match(checkoutEdge, /calculateTaxBreakdown/);
});
