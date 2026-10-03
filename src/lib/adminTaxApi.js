import { supabase } from "@/lib/supabaseClient";

const money = (value, label) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} must be zero or greater.`);
  return Math.round(amount * 100) / 100;
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
};
