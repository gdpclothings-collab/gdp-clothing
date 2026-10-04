import { supabase } from "@/lib/supabaseClient";

export const adminFinancialStatementsApi = {
  async load({ asOf = null, periodFrom = null, periodTo = null } = {}) {
    const { data, error } = await supabase.rpc("get_admin_financial_statements", {
      p_as_of: asOf,
      p_period_from: periodFrom,
      p_period_to: periodTo,
    });
    if (error) throw error;
    return data || {};
  },
};
