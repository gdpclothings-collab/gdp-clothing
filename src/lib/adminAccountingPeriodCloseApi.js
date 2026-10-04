import { supabase } from "@/lib/supabaseClient";

export const adminAccountingPeriodCloseApi = {
  async load() {
    const { data, error } = await supabase.rpc("get_admin_accounting_period_close");
    if (error) throw error;
    return data || {};
  },

  async preview(periodStart) {
    const { data, error } = await supabase.rpc("preview_admin_accounting_period_close", {
      p_period_start: periodStart,
    });
    if (error) throw error;
    return data || {};
  },

  async close({ periodStart, notes = null }) {
    const { data, error } = await supabase.rpc("close_admin_accounting_period", {
      p_period_start: periodStart,
      p_close_notes: notes || null,
    });
    if (error) throw error;
    return data || {};
  },

  async reopen({ periodCloseId, reason }) {
    const { data, error } = await supabase.rpc("reopen_admin_accounting_period", {
      p_period_close_id: periodCloseId,
      p_reason: reason,
    });
    if (error) throw error;
    return data || {};
  },
};
