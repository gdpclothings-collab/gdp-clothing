import { supabase } from "@/lib/supabaseClient";

export const adminInventoryValuationApi = {
  async load(limit = 1000) {
    const { data, error } = await supabase.rpc("get_admin_inventory_valuation", { p_limit: limit });
    if (error) throw error;
    return data || {};
  },

  async setCostBasis(variantId, unitCost, reason) {
    const { data, error } = await supabase.rpc("set_admin_inventory_cost_basis", {
      p_variant_id: variantId,
      p_unit_cost: Number(unitCost),
      p_reason: String(reason || "").trim(),
    });
    if (error) throw error;
    return data || {};
  },
};
