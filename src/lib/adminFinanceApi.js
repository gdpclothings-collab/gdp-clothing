import { supabase } from "@/lib/supabaseClient";

const clampLimit = (value) => Math.max(25, Math.min(1000, Number(value) || 250));

export const adminFinanceApi = {
  async load({ from = null, to = null, limit = 250 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_finance_snapshot", {
      p_from: from || null,
      p_to: to || null,
      p_limit: clampLimit(limit),
    });

    if (error) throw error;

    return {
      metrics: data?.metrics || {},
      transactions: Array.isArray(data?.transactions) ? data.transactions : [],
      refunds: Array.isArray(data?.refunds) ? data.refunds : [],
      disputes: Array.isArray(data?.disputes) ? data.disputes : [],
      expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    };
  },

  async createExpense(expense) {
    const payload = {
      occurred_on: expense.occurredOn,
      vendor: String(expense.vendor || "").trim() || null,
      category: expense.category || "miscellaneous",
      description: String(expense.description || "").trim(),
      amount: Number(expense.amount || 0),
      tax: Number(expense.tax || 0),
      currency: "CAD",
      payment_method: String(expense.paymentMethod || "").trim() || null,
      notes: String(expense.notes || "").trim() || null,
    };

    if (!payload.description) throw new Error("Expense description is required.");
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error("Expense amount must be greater than zero.");
    if (!Number.isFinite(payload.tax) || payload.tax < 0) throw new Error("Expense tax cannot be negative.");

    const { data, error } = await supabase
      .from("finance_expenses")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async deleteExpense(id) {
    const { error } = await supabase
      .from("finance_expenses")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
