import { supabase } from "@/lib/supabaseClient";

const money = (value, label, { positive = false } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (positive && parsed <= 0)) {
    throw new Error(`${label} must be ${positive ? "greater than zero" : "a non-negative amount"}.`);
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

export const adminCashReconciliationApi = {
  async load({ from = null, to = null, limit = 90 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_cash_reconciliations", {
      p_from: from,
      p_to: to,
      p_limit: Math.max(7, Math.min(Number(limit) || 90, 366)),
    });
    if (error) throw error;
    return data || { metrics: {}, reconciliations: [], adjustments: [] };
  },

  async openDay({ businessDate, openingCash, notes = "" }) {
    if (!businessDate) throw new Error("Business date is required.");
    const { data, error } = await supabase.rpc("create_admin_cash_reconciliation", {
      p_business_date: businessDate,
      p_opening_cash: money(openingCash, "Opening cash"),
      p_notes: String(notes || "").trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async addAdjustment({ reconciliationId, type, amount, reason, reference = "" }) {
    const cleanReason = String(reason || "").trim();
    if (!reconciliationId) throw new Error("Cash reconciliation is required.");
    if (!cleanReason) throw new Error("Adjustment reason is required.");
    const { data, error } = await supabase.rpc("add_admin_cash_adjustment", {
      p_reconciliation_id: reconciliationId,
      p_adjustment_type: type,
      p_amount: money(amount, "Adjustment amount", { positive: true }),
      p_reason: cleanReason,
      p_reference: String(reference || "").trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async closeDay({ reconciliationId, actualCash, notes = "" }) {
    if (!reconciliationId) throw new Error("Cash reconciliation is required.");
    const { data, error } = await supabase.rpc("close_admin_cash_reconciliation", {
      p_reconciliation_id: reconciliationId,
      p_actual_cash: money(actualCash, "Actual cash"),
      p_close_notes: String(notes || "").trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async reopenDay({ reconciliationId, reason }) {
    const cleanReason = String(reason || "").trim();
    if (!reconciliationId) throw new Error("Cash reconciliation is required.");
    if (!cleanReason) throw new Error("Reopen reason is required.");
    const { data, error } = await supabase.rpc("reopen_admin_cash_reconciliation", {
      p_reconciliation_id: reconciliationId,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },
};
