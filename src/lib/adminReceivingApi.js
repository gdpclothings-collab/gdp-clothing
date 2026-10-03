import { supabase } from "@/lib/supabaseClient";

const text = (value) => String(value || "").trim();
const clampLimit = (value) => Math.max(25, Math.min(1000, Number(value) || 500));
const moneyValue = (value, label, { allowZero = true } = {}) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount <= 0)) throw new Error(`${label} ${allowZero ? "cannot be negative" : "must be greater than zero"}.`);
  return Math.round(amount * 100) / 100;
};

export const adminReceivingApi = {
  async load({ limit = 1000 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_purchasing", { p_limit: clampLimit(limit) });
    if (error) throw error;
    return data || { summary: {}, suppliers: [], purchaseOrders: [], receipts: [], inventoryVariants: [], locations: [], events: [] };
  },

  async linkInventoryVariant(purchaseOrderItemId, inventoryVariantId) {
    if (!purchaseOrderItemId) throw new Error("Purchase order line is required.");
    const { data, error } = await supabase.rpc("link_admin_purchase_order_item_inventory_variant", {
      p_purchase_order_item_id: purchaseOrderItemId,
      p_inventory_variant_id: inventoryVariantId || null,
    });
    if (error) throw error;
    return data;
  },

  async postReceipt(poId, receipt) {
    if (!poId) throw new Error("Purchase order is required.");
    if (!receipt.receivedDate) throw new Error("Received date is required.");
    const items = (receipt.items || []).map((item) => ({
      purchaseOrderItemId: item.purchaseOrderItemId,
      quantityReceived: Number(item.quantityReceived || 0),
    })).filter((item) => item.purchaseOrderItemId && Number.isFinite(item.quantityReceived) && item.quantityReceived > 0);
    if (!items.length) throw new Error("Enter a quantity for at least one line.");
    const { data, error } = await supabase.rpc("post_admin_purchase_receipt", {
      p_po_id: poId,
      p_received_date: receipt.receivedDate,
      p_location_id: receipt.locationId || null,
      p_notes: text(receipt.notes) || null,
      p_items: items,
    });
    if (error) throw error;
    return data;
  },

  async reverseReceipt(receiptId, reason) {
    const cleanReason = text(reason);
    if (!receiptId || !cleanReason) throw new Error("Receipt and reversal reason are required.");
    const { data, error } = await supabase.rpc("reverse_admin_purchase_receipt", {
      p_receipt_id: receiptId,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },

  async createLinkedBill(poId, bill) {
    if (!poId) throw new Error("Purchase order is required.");
    if (!bill.issueDate || !bill.dueDate) throw new Error("Issue date and due date are required.");
    const description = text(bill.description);
    if (!description) throw new Error("Description is required.");
    const { data, error } = await supabase.rpc("create_admin_vendor_bill_from_purchase_order", {
      p_po_id: poId,
      p_issue_date: bill.issueDate,
      p_due_date: bill.dueDate,
      p_bill_number: text(bill.billNumber) || null,
      p_category: text(bill.category) || "garments",
      p_description: description,
      p_amount: moneyValue(bill.amount, "Bill amount", { allowZero: false }),
      p_gst_hst_tax: moneyValue(bill.gstHstTax, "GST/HST"),
      p_pst_tax: moneyValue(bill.pstTax, "PST"),
      p_itc_eligible: Boolean(bill.itcEligible),
      p_notes: text(bill.notes) || null,
    });
    if (error) throw error;
    return data;
  },
};
