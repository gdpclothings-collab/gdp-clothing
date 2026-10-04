import { supabase } from "@/lib/supabaseClient";

const clampLimit = (value) => Math.max(25, Math.min(1000, Number(value) || 500));
const moneyValue = (value, label) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} cannot be negative.`);
  return Math.round(amount * 100) / 100;
};
const text = (value) => String(value || "").trim();

export const adminVendorCreditsApi = {
  async load({ limit = 1000 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_vendor_credits", { p_limit: clampLimit(limit) });
    if (error) throw error;
    return data || { summary: {}, credits: [], returns: [], returnableReceipts: [], openBills: [], suppliers: [], purchaseOrders: [], creditEvents: [], returnEvents: [] };
  },

  async createCredit(form) {
    if (!form.issueDate) throw new Error("Credit issue date is required.");
    const description = text(form.description);
    if (!description) throw new Error("Credit description is required.");
    const amount = moneyValue(form.amount, "Credit amount");
    const gst = moneyValue(form.gstHstTax, "GST/HST");
    const pst = moneyValue(form.pstTax, "PST");
    if (amount + gst + pst <= 0) throw new Error("Vendor credit total must be greater than zero.");
    const { data, error } = await supabase.rpc("create_admin_vendor_credit", {
      p_issue_date: form.issueDate,
      p_vendor: text(form.vendor) || null,
      p_credit_number: text(form.creditNumber) || null,
      p_description: description,
      p_amount: amount,
      p_gst_hst_tax: gst,
      p_pst_tax: pst,
      p_supplier_id: form.supplierId || null,
      p_purchase_order_id: form.purchaseOrderId || null,
      p_notes: text(form.notes) || null,
    });
    if (error) throw error;
    return data;
  },

  async applyCredit(creditId, billId, note = "") {
    if (!creditId || !billId) throw new Error("Credit and open bill are required.");
    const { data, error } = await supabase.rpc("apply_admin_vendor_credit", {
      p_credit_id: creditId,
      p_bill_id: billId,
      p_note: text(note) || null,
    });
    if (error) throw error;
    return data;
  },

  async reverseApplication(applicationId, reason) {
    const cleanReason = text(reason);
    if (!applicationId || !cleanReason) throw new Error("Credit application and reversal reason are required.");
    const { data, error } = await supabase.rpc("reverse_admin_vendor_credit_application", {
      p_application_id: applicationId,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },

  async voidCredit(creditId, reason) {
    const cleanReason = text(reason);
    if (!creditId || !cleanReason) throw new Error("Credit and void reason are required.");
    const { data, error } = await supabase.rpc("void_admin_vendor_credit", { p_credit_id: creditId, p_reason: cleanReason });
    if (error) throw error;
    return data;
  },

  async postReturn(form) {
    const reason = text(form.reason);
    const items = (Array.isArray(form.items) ? form.items : [])
      .map((item) => ({ purchaseReceiptItemId: item.purchaseReceiptItemId, quantityReturned: Number(item.quantityReturned || 0) }))
      .filter((item) => item.purchaseReceiptItemId && item.quantityReturned > 0);
    if (!form.receiptId || !form.returnDate || !reason) throw new Error("Receipt, return date and reason are required.");
    if (!items.length) throw new Error("Enter a return quantity for at least one received line.");
    const { data, error } = await supabase.rpc("post_admin_purchase_return", {
      p_receipt_id: form.receiptId,
      p_return_date: form.returnDate,
      p_reason: reason,
      p_notes: text(form.notes) || null,
      p_items: items,
    });
    if (error) throw error;
    return data;
  },

  async reverseReturn(returnId, reason) {
    const cleanReason = text(reason);
    if (!returnId || !cleanReason) throw new Error("Purchase return and reversal reason are required.");
    const { data, error } = await supabase.rpc("reverse_admin_purchase_return", { p_return_id: returnId, p_reason: cleanReason });
    if (error) throw error;
    return data;
  },
};
