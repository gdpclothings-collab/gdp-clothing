import { supabase } from "@/lib/supabaseClient";
import { normalizeApparelPricing } from "@/lib/apparelPricing";

const throwIfError = ({ error, data }) => {
  if (error) throw error;
  return data;
};

export const adminApparelPricingApi = {
  async load() {
    const row = throwIfError(
      await supabase
        .from("store_settings")
        .select("apparel_pricing")
        .eq("id", 1)
        .single()
    );
    return normalizeApparelPricing(row?.apparel_pricing || {});
  },

  async save(pricing) {
    const normalized = normalizeApparelPricing(pricing);
    throwIfError(
      await supabase
        .from("store_settings")
        .update({ apparel_pricing: normalized, updated_at: new Date().toISOString() })
        .eq("id", 1)
    );
    return normalized;
  },
};
