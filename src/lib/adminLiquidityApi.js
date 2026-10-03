import { supabase } from "@/lib/supabaseClient";

export const adminLiquidityApi = {
  async load() {
    const { data, error } = await supabase.rpc("get_admin_liquidity_snapshot");
    if (error) throw error;
    return data || {};
  },
};
