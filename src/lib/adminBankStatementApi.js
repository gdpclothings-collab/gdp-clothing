import { supabase } from "@/lib/supabaseClient";

const clean = (value) => String(value || "").trim();

const balanceMoney = (value, label) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error(`${label} must be a valid amount.`);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const adminBankStatementApi = {
  async load({ from = null, to = null, limit = 100 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_bank_statement_reconciliations", {
      p_from: from,
      p_to: to,
      p_limit: Math.max(10, Math.min(Number(limit) || 100, 500)),
    });
    if (error) throw error;
    return data || { metrics: {}, statements: [], events: [] };
  },

  async open({ periodStart, periodEnd, openingBalance, notes = "" }) {
    if (!periodStart || !periodEnd) throw new Error("Statement start and end dates are required.");
    if (periodStart > periodEnd) throw new Error("Statement start date cannot be after the end date.");
    const { data, error } = await supabase.rpc("create_admin_bank_statement_reconciliation", {
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_opening_balance: balanceMoney(openingBalance, "Opening balance"),
      p_notes: clean(notes) || null,
    });
    if (error) throw error;
    return data;
  },

  async close({ reconciliationId, statementClosingBalance, closeNotes = "" }) {
    if (!reconciliationId) throw new Error("Bank statement reconciliation is required.");
    const { data, error } = await supabase.rpc("close_admin_bank_statement_reconciliation", {
      p_reconciliation_id: reconciliationId,
      p_statement_closing_balance: balanceMoney(statementClosingBalance, "Statement closing balance"),
      p_close_notes: clean(closeNotes) || null,
    });
    if (error) throw error;
    return data;
  },

  async reopen({ reconciliationId, reason }) {
    const cleanReason = clean(reason);
    if (!reconciliationId) throw new Error("Bank statement reconciliation is required.");
    if (!cleanReason) throw new Error("Reopen reason is required.");
    const { data, error } = await supabase.rpc("reopen_admin_bank_statement_reconciliation", {
      p_reconciliation_id: reconciliationId,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },
};
