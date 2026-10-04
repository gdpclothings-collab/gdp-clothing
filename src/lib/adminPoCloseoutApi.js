import { supabase } from "@/lib/supabaseClient";

const text = (value) => String(value || "").trim();
const clampLimit = (value) => Math.max(25, Math.min(1000, Number(value) || 500));

export const adminPoCloseoutApi = {
  async load({ limit = 1000 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_purchasing", { p_limit: clampLimit(limit) });
    if (error) throw error;
    return data || { summary: {}, suppliers: [], purchaseOrders: [], receipts: [], events: [] };
  },

  async closeMatched(poId, note = "") {
    if (!poId) throw new Error("Purchase order is required.");
    const { data, error } = await supabase.rpc("close_admin_purchase_order", {
      p_po_id: poId,
      p_allow_exception: false,
      p_reason: text(note) || null,
    });
    if (error) throw error;
    return data;
  },

  async closeException(poId, reason) {
    const cleanReason = text(reason);
    if (!poId || !cleanReason) throw new Error("Purchase order and exception reason are required.");
    const { data, error } = await supabase.rpc("close_admin_purchase_order", {
      p_po_id: poId,
      p_allow_exception: true,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },

  async reopen(poId, reason) {
    const cleanReason = text(reason);
    if (!poId || !cleanReason) throw new Error("Purchase order and reopen reason are required.");
    const { data, error } = await supabase.rpc("reopen_admin_purchase_order", {
      p_po_id: poId,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },
};
