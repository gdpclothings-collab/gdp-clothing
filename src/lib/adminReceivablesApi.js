import { supabase } from "@/lib/supabaseClient";

const clampLimit = (value) => Math.max(25, Math.min(1000, Number(value) || 500));
const money = (value, label, { allowZero = true } = {}) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed <= 0)) {
    throw new Error(`${label} ${allowZero ? "cannot be negative" : "must be greater than zero"}.`);
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const invoiceArgs = (invoice) => {
  const customerName = String(invoice.customerName || "").trim();
  if (!invoice.issueDate || !invoice.dueDate) throw new Error("Issue date and due date are required.");
  if (!customerName) throw new Error("Customer name is required.");
  return {
    p_issue_date: invoice.issueDate,
    p_due_date: invoice.dueDate,
    p_customer_name: customerName,
    p_customer_email: String(invoice.customerEmail || "").trim() || null,
    p_customer_phone: String(invoice.customerPhone || "").trim() || null,
    p_reference: String(invoice.reference || "").trim() || null,
    p_subtotal: money(invoice.subtotal, "Subtotal", { allowZero: false }),
    p_discount: money(invoice.discount, "Discount"),
    p_shipping: money(invoice.shipping, "Shipping"),
    p_gst_hst_tax: money(invoice.gstHstTax, "GST/HST"),
    p_pst_tax: money(invoice.pstTax, "PST"),
    p_cogs: money(invoice.cogs, "COGS"),
    p_notes: String(invoice.notes || "").trim() || null,
  };
};

export const adminReceivablesApi = {
  async load({ limit = 500 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_customer_receivables", { p_limit: clampLimit(limit) });
    if (error) throw error;
    return data || { summary: {}, invoices: [], events: [] };
  },

  async create(invoice) {
    const { data, error } = await supabase.rpc("create_admin_customer_invoice", invoiceArgs(invoice));
    if (error) throw error;
    return data;
  },

  async update(invoiceId, invoice) {
    if (!invoiceId) throw new Error("Invoice is required.");
    const { data, error } = await supabase.rpc("update_admin_customer_invoice", {
      p_invoice_id: invoiceId,
      ...invoiceArgs(invoice),
    });
    if (error) throw error;
    return data;
  },

  async issue(invoiceId) {
    if (!invoiceId) throw new Error("Invoice is required.");
    const { data, error } = await supabase.rpc("issue_admin_customer_invoice", { p_invoice_id: invoiceId });
    if (error) throw error;
    return data;
  },

  async recordPayment(invoiceId, payment) {
    if (!invoiceId) throw new Error("Invoice is required.");
    if (!payment.paidOn) throw new Error("Payment date is required.");
    const method = String(payment.paymentMethod || "").trim();
    if (!method) throw new Error("Payment method is required.");
    const { data, error } = await supabase.rpc("record_admin_customer_invoice_payment", {
      p_invoice_id: invoiceId,
      p_paid_on: payment.paidOn,
      p_payment_method: method,
      p_amount: money(payment.amount, "Payment", { allowZero: false }),
      p_payment_reference: String(payment.paymentReference || "").trim() || null,
      p_payment_note: String(payment.paymentNote || "").trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async reversePayment(paymentId, reason) {
    if (!paymentId) throw new Error("Payment is required.");
    const cleanReason = String(reason || "").trim();
    if (!cleanReason) throw new Error("A reversal reason is required.");
    const { data, error } = await supabase.rpc("reverse_admin_customer_invoice_payment", {
      p_payment_id: paymentId,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },

  async void(invoiceId, reason) {
    if (!invoiceId) throw new Error("Invoice is required.");
    const cleanReason = String(reason || "").trim();
    if (!cleanReason) throw new Error("A void reason is required.");
    const { data, error } = await supabase.rpc("void_admin_customer_invoice", {
      p_invoice_id: invoiceId,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },
};
