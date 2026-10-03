import { supabase } from "@/lib/supabaseClient";

const nonNegativeMoney = (value, label) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} cannot be negative.`);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const positiveMoney = (value, label) => {
  const amount = nonNegativeMoney(value, label);
  if (amount <= 0) throw new Error(`${label} must be greater than zero.`);
  return amount;
};

const clean = (value) => String(value || "").trim();

function expenseArgs(expense) {
  const description = clean(expense.description);
  if (!expense.occurredOn) throw new Error("Expense date is required.");
  if (!description) throw new Error("Expense description is required.");

  const gstHstTax = expense.gstHstTax === "" || expense.gstHstTax == null
    ? null
    : nonNegativeMoney(expense.gstHstTax, "GST/HST");
  const pstTax = expense.pstTax === "" || expense.pstTax == null
    ? null
    : nonNegativeMoney(expense.pstTax, "PST");
  const tax = gstHstTax !== null || pstTax !== null
    ? Math.round(((gstHstTax || 0) + (pstTax || 0)) * 100) / 100
    : nonNegativeMoney(expense.tax, "Expense tax");

  return {
    p_occurred_on: expense.occurredOn,
    p_vendor: clean(expense.vendor) || null,
    p_category: clean(expense.category) || "miscellaneous",
    p_description: description,
    p_amount: positiveMoney(expense.amount, "Expense amount"),
    p_tax: tax,
    p_gst_hst_tax: gstHstTax,
    p_pst_tax: pstTax,
    p_itc_eligible: Boolean(expense.itcEligible),
    p_payment_method: clean(expense.paymentMethod) || null,
    p_receipt_reference: clean(expense.receiptReference) || null,
    p_notes: clean(expense.notes) || null,
  };
}

export const adminExpenseControlsApi = {
  async load({ from = null, to = null, limit = 500 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_expense_controls", {
      p_from: from,
      p_to: to,
      p_limit: Math.max(25, Math.min(Number(limit) || 500, 1000)),
    });
    if (error) throw error;
    return data || { summary: {}, expenses: [], events: [] };
  },

  async create(expense) {
    const { data, error } = await supabase.rpc("create_admin_finance_expense", expenseArgs(expense));
    if (error) throw error;
    return data;
  },

  async correct(id, expense, reason) {
    const cleanReason = clean(reason);
    if (!id) throw new Error("Expense is required.");
    if (!cleanReason) throw new Error("Correction reason is required.");
    const { data, error } = await supabase.rpc("correct_admin_finance_expense", {
      p_expense_id: id,
      ...expenseArgs(expense),
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },

  async void(id, reason) {
    const cleanReason = clean(reason);
    if (!id) throw new Error("Expense is required.");
    if (!cleanReason) throw new Error("Void reason is required.");
    const { data, error } = await supabase.rpc("void_admin_finance_expense", {
      p_expense_id: id,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },
};
