import { supabase } from "@/lib/supabaseClient";

const clean = (value) => String(value || "").trim();

const positiveMoney = (value, label) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${label} must be greater than zero.`);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const optionalMoney = (value, label) => {
  if (value === "" || value == null) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${label} cannot be negative.`);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

export const adminBankReconciliationApi = {
  async load({ from = null, to = null, limit = 500 } = {}) {
    const { data, error } = await supabase.rpc("get_admin_bank_reconciliation", {
      p_from: from,
      p_to: to,
      p_limit: Math.max(25, Math.min(Number(limit) || 500, 1000)),
    });
    if (error) throw error;
    return data || { metrics: {}, entries: [], unmatchedStripePayouts: [], events: [] };
  },

  async create(entry) {
    const description = clean(entry.description);
    const sourceType = clean(entry.sourceType) || "other";
    const sourceReference = clean(entry.sourceReference) || null;
    if (!entry.occurredOn) throw new Error("Bank transaction date is required.");
    if (!description) throw new Error("Bank transaction description is required.");
    if (!['credit', 'debit'].includes(entry.direction)) throw new Error("Choose Credit or Debit.");
    if (sourceType === "stripe_payout" && !sourceReference) throw new Error("Choose a Stripe payout to match.");

    const { data, error } = await supabase.rpc("create_admin_bank_entry", {
      p_occurred_on: entry.occurredOn,
      p_direction: entry.direction,
      p_amount: positiveMoney(entry.amount, "Bank amount"),
      p_description: description,
      p_reference: clean(entry.reference) || null,
      p_source_type: sourceType,
      p_source_reference: sourceReference,
      p_expected_amount: sourceType === "stripe_payout" ? null : optionalMoney(entry.expectedAmount, "Expected amount"),
      p_notes: clean(entry.notes) || null,
    });
    if (error) throw error;
    return data;
  },

  async void(id, reason) {
    const cleanReason = clean(reason);
    if (!id) throw new Error("Bank entry is required.");
    if (!cleanReason) throw new Error("Void reason is required.");
    const { data, error } = await supabase.rpc("void_admin_bank_entry", {
      p_bank_entry_id: id,
      p_reason: cleanReason,
    });
    if (error) throw error;
    return data;
  },
};
