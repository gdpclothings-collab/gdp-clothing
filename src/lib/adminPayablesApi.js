import { supabase } from "@/lib/supabaseClient";

const clampLimit = (value) => Math.max(25, Math.min(1000, Number(value) || 500));

const moneyValue = (value, label, { allowZero = true } = {}) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount <= 0)) {
    throw new Error(`${label} ${allowZero ? "cannot be negative" : "must be greater than zero"}.`);
  }
  return Math.round(amount * 100) / 100;
};

export const adminPayablesApi = {
  async load({ from = null, to = null, limit = 500 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_vendor_bills", {
      p_from: from || null,
      p_to: to || null,
      p_limit: clampLimit(limit),
    });
    if (error) throw error;
    return data || { summary: {}, bills: [], events: [] };
  },

  async create(bill) {
    const vendor = String(bill.vendor || "").trim();
    const description = String(bill.description || "").trim();
    if (!bill.issueDate || !bill.dueDate) throw new Error("Issue date and due date are required.");
    if (!vendor) throw new Error("Vendor is required.");
    if (!description) throw new Error("Description is required.");

    const { data, error } = await supabase.rpc("create_admin_vendor_bill", {
      p_issue_date: bill.issueDate,
      p_due_date: bill.dueDate,
      p_vendor: vendor,
      p_bill_number: String(bill.billNumber || "").trim() || null,
      p_category: String(bill.category || "miscellaneous").trim() || "miscellaneous",
      p_description: description,
      p_amount: moneyValue(bill.amount, "Bill amount", { allowZero: false }),
      p_gst_hst_tax: moneyValue(bill.gstHstTax, "GST/HST"),
      p_pst_tax: moneyValue(bill.pstTax, "PST"),
      p_itc_eligible: Boolean(bill.itcEligible),
      p_notes: String(bill.notes || "").trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async markPaid(billId, payment) {
    if (!billId) throw new Error("Bill is required.");
    const paymentMethod = String(payment.paymentMethod || "").trim();
    if (!payment.paidOn) throw new Error("Payment date is required.");
    if (!paymentMethod) throw new Error("Payment method is required.");

    const { data, error } = await supabase.rpc("mark_admin_vendor_bill_paid", {
      p_bill_id: billId,
      p_paid_on: payment.paidOn,
      p_payment_method: paymentMethod,
      p_payment_reference: String(payment.paymentReference || "").trim() || null,
      p_payment_note: String(payment.paymentNote || "").trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async void(billId, reason) {
    if (!billId) throw new Error("Bill is required.");
    const cleanReason = String(reason || "").trim();
    if (!cleanReason) throw new Error("Void reason is required.");
    const { data, error } = await supabase.rpc("void_admin_vendor_bill", {
      p_bill_id: billId,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },
};
