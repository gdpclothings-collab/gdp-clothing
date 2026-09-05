import { supabase } from "@/lib/supabaseClient";

export const adminMarketsApi = {
  async load() {
    const [marketsResult, profilesResult, ratesResult, taxesResult] = await Promise.all([
      supabase.from("markets").select("*").order("is_primary", { ascending: false }).order("name"),
      supabase.from("shipping_profiles").select("*").order("name"),
      supabase
        .from("shipping_rates")
        .select("*, shipping_profiles(name), markets(name, code)")
        .order("created_at", { ascending: false }),
      supabase
        .from("tax_rules")
        .select("*, markets(name, code)")
        .order("priority", { ascending: true })
        .order("country_code", { ascending: true }),
    ]);

    for (const result of [marketsResult, profilesResult, ratesResult, taxesResult]) {
      if (result.error) throw result.error;
    }

    return {
      markets: marketsResult.data || [],
      profiles: profilesResult.data || [],
      rates: ratesResult.data || [],
      taxes: taxesResult.data || [],
    };
  },

  async saveMarket(id, payload) {
    if (payload.isPrimary) {
      await supabase.from("markets").update({ is_primary: false }).eq("is_primary", true);
    }

    const row = {
      code: String(payload.code || "").trim().toUpperCase(),
      name: String(payload.name || "").trim(),
      countries: payload.countries || [],
      currency: payload.currency || "CAD",
      language: payload.language || "en",
      domain: payload.domain || null,
      pricing_adjustment: Number(payload.pricingAdjustment || 0),
      active: payload.active !== false,
      is_primary: Boolean(payload.isPrimary),
      config: payload.config || {},
    };

    const query = id
      ? supabase.from("markets").update(row).eq("id", id)
      : supabase.from("markets").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async saveShippingRate(id, payload) {
    const row = {
      profile_id: payload.profileId,
      market_id: payload.marketId || null,
      name: String(payload.name || "").trim(),
      method_code: String(payload.methodCode || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      price: Number(payload.price || 0),
      min_order: payload.minOrder === "" || payload.minOrder == null ? null : Number(payload.minOrder),
      max_order: payload.maxOrder === "" || payload.maxOrder == null ? null : Number(payload.maxOrder),
      min_delivery_days: payload.minDeliveryDays === "" || payload.minDeliveryDays == null ? null : Number(payload.minDeliveryDays),
      max_delivery_days: payload.maxDeliveryDays === "" || payload.maxDeliveryDays == null ? null : Number(payload.maxDeliveryDays),
      active: payload.active !== false,
      conditions: payload.conditions || {},
    };

    const query = id
      ? supabase.from("shipping_rates").update(row).eq("id", id)
      : supabase.from("shipping_rates").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async saveTaxRule(id, payload) {
    const row = {
      market_id: payload.marketId || null,
      country_code: String(payload.countryCode || "").trim().toUpperCase(),
      region_code: String(payload.regionCode || "").trim().toUpperCase() || null,
      name: String(payload.name || "").trim(),
      rate: Number(payload.ratePercent || 0) / 100,
      tax_shipping: Boolean(payload.taxShipping),
      active: payload.active !== false,
      priority: Number(payload.priority || 100),
      config: payload.config || {},
    };

    const query = id
      ? supabase.from("tax_rules").update(row).eq("id", id)
      : supabase.from("tax_rules").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async setMarketActive(id, active) {
    const { error } = await supabase.from("markets").update({ active }).eq("id", id);
    if (error) throw error;
  },

  async setShippingRateActive(id, active) {
    const { error } = await supabase.from("shipping_rates").update({ active }).eq("id", id);
    if (error) throw error;
  },

  async setTaxRuleActive(id, active) {
    const { error } = await supabase.from("tax_rules").update({ active }).eq("id", id);
    if (error) throw error;
  },
};
