import { supabase } from "@/lib/supabaseClient";

const clampLimit = (value) => Math.max(25, Math.min(1000, Number(value) || 250));

const nonNegativeMoney = (value, label) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} cannot be negative.`);
  return Math.round(amount * 100) / 100;
};

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
      costItems: Array.isArray(data?.costItems) ? data.costItems : [],
      refunds: Array.isArray(data?.refunds) ? data.refunds : [],
      disputes: Array.isArray(data?.disputes) ? data.disputes : [],
      expenses: Array.isArray(data?.expenses) ? data.expenses : [],
    };
  },

  // Only the four editable production-cost columns are sent; snapshot identity and audit fields stay database-controlled.
  async updateCogs(orderItemId, costs) {
    if (!orderItemId) throw new Error("Order item is required.");

    const payload = {
      garment_unit_cost: nonNegativeMoney(costs.garmentUnitCost, "Garment cost"),
      print_unit_cost: nonNegativeMoney(costs.printUnitCost, "DTF / print cost"),
      packaging_unit_cost: nonNegativeMoney(costs.packagingUnitCost, "Packaging cost"),
      other_unit_cost: nonNegativeMoney(costs.otherUnitCost, "Other cost"),
    };

    const { data, error } = await supabase
      .from("finance_order_item_costs")
      .update(payload)
      .eq("order_item_id", orderItemId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
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
