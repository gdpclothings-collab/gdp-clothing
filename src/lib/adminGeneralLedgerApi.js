import { supabase } from "@/lib/supabaseClient";

export const adminGeneralLedgerApi = {
  async load({ from = null, to = null, limit = 300 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_general_ledger", {
      p_from: from,
      p_to: to,
      p_limit: limit,
    });
    if (error) throw error;
    return data || {};
  },

  async recordManualJournal({ entryDate, reference = null, memo, lines }) {
    const { data, error } = await supabase.rpc("record_admin_manual_journal", {
      p_entry_date: entryDate,
      p_reference: reference || null,
      p_memo: memo,
      p_lines: lines,
    });
    if (error) throw error;
    return data || {};
  },

  async reverseJournal({ entryId, reversalDate, reason }) {
    const { data, error } = await supabase.rpc("reverse_admin_journal_entry", {
      p_entry_id: entryId,
      p_reversal_date: reversalDate,
      p_reason: reason,
    });
    if (error) throw error;
    return data || {};
  },
};
