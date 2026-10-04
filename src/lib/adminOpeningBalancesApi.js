import { supabase } from "@/lib/supabaseClient";

export const adminOpeningBalancesApi = {
  async load() {
    const { data, error } = await supabase.rpc("get_admin_opening_balance_cutover");
    if (error) throw error;
    return data || {};
  },

  async saveDraft({ cutoverDate, notes = null, lines = [] }) {
    const { data, error } = await supabase.rpc("save_admin_opening_balance_cutover", {
      p_cutover_date: cutoverDate,
      p_notes: notes || null,
      p_lines: lines,
    });
    if (error) throw error;
    return data || {};
  },

  async postCutover(cutoverId) {
    const { data, error } = await supabase.rpc("post_admin_opening_balance_cutover", {
      p_cutover_id: cutoverId,
    });
    if (error) throw error;
    return data || {};
  },

  async reverseCutover({ cutoverId, reversalDate, reason }) {
    const { data, error } = await supabase.rpc("reverse_admin_opening_balance_cutover", {
      p_cutover_id: cutoverId,
      p_reversal_date: reversalDate,
      p_reason: reason,
    });
    if (error) throw error;
    return data || {};
  },
};
