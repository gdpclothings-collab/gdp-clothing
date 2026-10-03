import { supabase } from "@/lib/supabaseClient";

const text = (value) => String(value || "").trim();
const limitValue = (value) => Math.max(25, Math.min(1000, Number(value) || 500));

const normalizeItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Add at least one purchase-order line item.");
  if (items.length > 100) throw new Error("A purchase order cannot exceed 100 line items.");
  return items.map((item, index) => {
    const description = text(item.description);
    const quantity = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    const gstHstTax = Number(item.gstHstTax || 0);
    const pstTax = Number(item.pstTax || 0);
    if (!description) throw new Error(`Line ${index + 1}: description is required.`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: quantity must be greater than zero.`);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error(`Line ${index + 1}: unit cost cannot be negative.`);
    if (!Number.isFinite(gstHstTax) || gstHstTax < 0 || !Number.isFinite(pstTax) || pstTax < 0) throw new Error(`Line ${index + 1}: tax amounts cannot be negative.`);
    return { sku: text(item.sku) || null, description, quantity, unitCost, gstHstTax, pstTax };
  });
};

const supplierArgs = (supplier) => ({
  p_name: text(supplier.name),
  p_contact_name: text(supplier.contactName) || null,
  p_email: text(supplier.email) || null,
  p_phone: text(supplier.phone) || null,
  p_website: text(supplier.website) || null,
  p_account_number: text(supplier.accountNumber) || null,
  p_payment_terms_days: Number(supplier.paymentTermsDays || 0),
  p_notes: text(supplier.notes) || null,
});

const poArgs = (po) => ({
  p_supplier_id: po.supplierId,
  p_order_date: po.orderDate,
  p_expected_date: po.expectedDate || null,
  p_notes: text(po.notes) || null,
  p_items: normalizeItems(po.items),
});

export const adminPurchasingApi = {
  async load({ limit = 500 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_purchasing", { p_limit: limitValue(limit) });
    if (error) throw error;
    return data || { summary: {}, suppliers: [], purchaseOrders: [], events: [] };
  },

  async createSupplier(supplier) {
    if (!text(supplier.name)) throw new Error("Supplier name is required.");
    const { data, error } = await supabase.rpc("create_admin_supplier", supplierArgs(supplier));
    if (error) throw error;
    return data;
  },

  async updateSupplier(supplierId, supplier) {
    if (!supplierId) throw new Error("Supplier is required.");
    const { data, error } = await supabase.rpc("update_admin_supplier", { p_supplier_id: supplierId, ...supplierArgs(supplier) });
    if (error) throw error;
    return data;
  },

  async archiveSupplier(supplierId, reason) {
    const cleanReason = text(reason);
    if (!supplierId || !cleanReason) throw new Error("Supplier and archive reason are required.");
    const { data, error } = await supabase.rpc("archive_admin_supplier", { p_supplier_id: supplierId, p_reason: cleanReason });
    if (error) throw error;
    return data;
  },

  async createPurchaseOrder(po) {
    if (!po.supplierId || !po.orderDate) throw new Error("Supplier and order date are required.");
    const { data, error } = await supabase.rpc("create_admin_purchase_order", poArgs(po));
    if (error) throw error;
    return data;
  },

  async updatePurchaseOrder(poId, po) {
    if (!poId) throw new Error("Purchase order is required.");
    const { data, error } = await supabase.rpc("update_admin_purchase_order", { p_po_id: poId, ...poArgs(po) });
    if (error) throw error;
    return data;
  },

  async approvePurchaseOrder(poId) {
    if (!poId) throw new Error("Purchase order is required.");
    const { data, error } = await supabase.rpc("approve_admin_purchase_order", { p_po_id: poId });
    if (error) throw error;
    return data;
  },

  async cancelPurchaseOrder(poId, reason) {
    const cleanReason = text(reason);
    if (!poId || !cleanReason) throw new Error("Purchase order and cancellation reason are required.");
    const { data, error } = await supabase.rpc("cancel_admin_purchase_order", { p_po_id: poId, p_reason: cleanReason });
    if (error) throw error;
    return data;
  },
};
