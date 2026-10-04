import { supabase } from "@/lib/supabaseClient";

export const adminCashFlowApi = {
  async load({ periodFrom = null, periodTo = null } = {}) {
    const { data, error } = await supabase.rpc("get_admin_cash_flow_statement", {
      p_period_from: periodFrom,
      p_period_to: periodTo,
    });
    if (error) throw error;
    return data || {};
  },
};
