import { supabase } from "@/lib/supabaseClient";

const clampLimit = (value) => Math.max(25, Math.min(1000, Number(value) || 250));

const nonNegativeMoney = (value, label) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} cannot be negative.`);
  return Math.round(amount * 100) / 100;
};

export const adminFinanceApi = {
  async load({ from = null, to = null, limit = 250 } = {}) {
    let stripeSync = { ok: true, syncedAt: null, message: "" };

    try {
      const { data: syncData, error: syncError } = await supabase.functions.invoke("stripe-finance-sync", {
        body: { from: from || null, to: to || null },
      });
      if (syncError) throw syncError;
      if (syncData?.error) throw new Error(syncData.message || "Stripe settlement sync failed.");
      stripeSync = {
        ok: true,
        syncedAt: syncData?.syncedAt || null,
        message: syncData?.truncated ? "Stripe returned more settlement rows than the safe sync window; narrow the Finance date range." : "",
      };
    } catch (err) {
      console.warn("Stripe finance sync unavailable; using stored settlement data:", err);
      stripeSync = {
        ok: false,
        syncedAt: null,
        message: err?.message || "Stripe settlement sync is temporarily unavailable.",
      };
    }

    const args = {
      p_from: from || null,
      p_to: to || null,
      p_limit: clampLimit(limit),
    };

    const [financeResult, stripeResult] = await Promise.all([
      supabase.rpc("get_admin_finance_snapshot", args),
      supabase.rpc("get_admin_stripe_finance_snapshot", args),
    ]);

    if (financeResult.error) throw financeResult.error;
    if (stripeResult.error) throw stripeResult.error;

    const data = financeResult.data || {};
    const stripe = stripeResult.data || {};
    const feeByOrder = new Map(
      (Array.isArray(stripe.feesByOrder) ? stripe.feesByOrder : [])
        .map((row) => [row.order_id, row]),
    );

    const transactions = (Array.isArray(data.transactions) ? data.transactions : []).map((order) => {
      const settlement = feeByOrder.get(order.id);
      return {
        ...order,
        stripe_fee: Number(settlement?.stripe_fee || 0),
        stripe_gross: Number(settlement?.stripe_gross || 0),
        stripe_net: Number(settlement?.stripe_net || 0),
        stripe_fee_captured: Boolean(settlement?.fee_captured),
        stripe_last_transaction_at: settlement?.last_stripe_transaction_at || null,
      };
    });

    return {
      metrics: { ...(data.metrics || {}), ...(stripe.metrics || {}) },
      transactions,
      costItems: Array.isArray(data.costItems) ? data.costItems : [],
      refunds: Array.isArray(data.refunds) ? data.refunds : [],
      disputes: Array.isArray(data.disputes) ? data.disputes : [],
      expenses: Array.isArray(data.expenses) ? data.expenses : [],
      balanceTransactions: Array.isArray(stripe.balanceTransactions) ? stripe.balanceTransactions : [],
      payouts: Array.isArray(stripe.payouts) ? stripe.payouts : [],
      stripeSync,
    };
  },

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