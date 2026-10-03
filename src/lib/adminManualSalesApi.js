import { supabase } from "@/lib/supabaseClient";

const money = (value, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative amount.`);
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

export const adminManualSalesApi = {
  async load({ from = null, to = null, limit = 250 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_manual_sales", {
      p_from: from,
      p_to: to,
      p_limit: Math.max(25, Math.min(Number(limit) || 250, 1000)),
    });
    if (error) throw error;
    return data || { metrics: {}, sales: [] };
  },

  async createSale(sale) {
    const { data, error } = await supabase.rpc("create_admin_manual_sale", {
      p_occurred_at: sale.occurredAt,
      p_customer_name: sale.customerName?.trim() || null,
      p_reference: sale.reference?.trim() || null,
      p_payment_method: sale.paymentMethod || "cash",
      p_subtotal: money(sale.subtotal, "Subtotal"),
      p_discount: money(sale.discount || 0, "Discount"),
      p_shipping: money(sale.shipping || 0, "Shipping"),
      p_gst_hst_tax: money(sale.gstHstTax || 0, "GST/HST"),
      p_pst_tax: money(sale.pstTax || 0, "PST"),
      p_cogs: money(sale.cogs, "COGS"),
      p_notes: sale.notes?.trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async voidSale(id, reason) {
    const cleanReason = String(reason || "").trim();
    if (!cleanReason) throw new Error("A void reason is required.");
    const { data, error } = await supabase.rpc("void_admin_manual_sale", {
      p_sale_id: id,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },
};
