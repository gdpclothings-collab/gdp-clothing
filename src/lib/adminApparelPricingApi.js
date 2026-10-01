import { supabase } from "@/lib/supabaseClient";
import { normalizeApparelPricing } from "@/lib/apparelPricing";

const throwIfError = ({ error, data }) => {
  if (error) throw error;
  return data;
};

export const adminApparelPricingApi = {
  async load() {
    const pricing = throwIfError(
      await supabase.rpc("get_admin_apparel_pricing")
    );
    return normalizeApparelPricing(pricing || {});
  },

  async save(pricing) {
    const normalized = normalizeApparelPricing(pricing);
    const saved = throwIfError(
      await supabase.rpc("save_admin_apparel_pricing", {
        p_pricing: normalized,
      })
    );
    return normalizeApparelPricing(saved || normalized);
  },
};
