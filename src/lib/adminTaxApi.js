import { supabase } from "@/lib/supabaseClient";

const money = (value, label) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} must be zero or greater.`);
  return Math.round(amount * 100) / 100;
};

const taxType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!["gst_hst", "pst"].includes(normalized)) throw new Error("Select a valid tax type.");
  return normalized;
};

export const adminTaxApi = {
  async load({ from = null, to = null, limit = 250 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_tax_center", {
      p_from: from || null,
      p_to: to || null,
      p_limit: Math.max(25, Math.min(1000, Number(limit) || 250)),
    });
    if (error) throw error;
    return data || {};
  },

  async updateExpenseTax(expenseId, { gstHstTax, pstTax, itcEligible }) {
    if (!expenseId) throw new Error("Expense is required.");
    const { data, error } = await supabase.rpc("update_admin_expense_tax", {
      p_expense_id: expenseId,
      p_gst_hst_tax: money(gstHstTax, "GST/HST tax"),
      p_pst_tax: money(pstTax, "PST tax"),
      p_itc_eligible: Boolean(itcEligible),
    });
    if (error) throw error;
    return data;
  },

  async loadFilingControls(limit = 24) {
    const { data, error } = await supabase.rpc("get_admin_tax_filing_controls", {
      p_limit: Math.max(1, Math.min(100, Number(limit) || 24)),
    });
    if (error) throw error;
    return data || {};
  },

  async saveRegistration(values) {
    const registered = Boolean(values.registered);
    const frequency = registered ? String(values.filingFrequency || "unconfigured") : "unconfigured";
    const { data, error } = await supabase.rpc("upsert_admin_tax_registration", {
      p_tax_type: taxType(values.taxType),
      p_registered: registered,
      p_account_number: registered ? String(values.accountNumber || "").trim() || null : null,
      p_filing_frequency: frequency,
      p_effective_from: registered ? values.effectiveFrom || null : null,
      p_notes: String(values.notes || "").trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async createFilingPeriod(values) {
    if (!values.periodStart || !values.periodEnd) throw new Error("Filing period start and end dates are required.");
    const { data, error } = await supabase.rpc("create_admin_tax_filing_period", {
      p_tax_type: taxType(values.taxType),
      p_period_start: values.periodStart,
      p_period_end: values.periodEnd,
      p_due_date: values.dueDate || null,
      p_notes: String(values.notes || "").trim() || null,
    });
    if (error) throw error;
    return data;
  },

  async closeFilingPeriod(periodId, confirmEstimates = false) {
    if (!periodId) throw new Error("Filing period is required.");
    const { data, error } = await supabase.rpc("close_admin_tax_filing_period", {
      p_period_id: periodId,
      p_confirm_estimates: Boolean(confirmEstimates),
    });
    if (error) throw error;
    return data;
  },

  async reopenFilingPeriod(periodId, reason) {
    if (!periodId) throw new Error("Filing period is required.");
    if (!String(reason || "").trim()) throw new Error("Reopen reason is required.");
    const { data, error } = await supabase.rpc("reopen_admin_tax_filing_period", {
      p_period_id: periodId,
      p_reason: String(reason).trim(),
    });
    if (error) throw error;
    return data;
  },

  async markFilingPeriodFiled(periodId, reference) {
    if (!periodId) throw new Error("Filing period is required.");
    if (!String(reference || "").trim()) throw new Error("Filing reference is required.");
    const { data, error } = await supabase.rpc("mark_admin_tax_filing_period_filed", {
      p_period_id: periodId,
      p_filing_reference: String(reference).trim(),
    });
    if (error) throw error;
    return data;
  },
};
