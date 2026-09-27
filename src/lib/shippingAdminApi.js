import { supabase } from "@/lib/supabaseClient";

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const shippingAdminApi = {
  async load() {
    const [profiles, rates, packages, settings] = await Promise.all([
      supabase.from("shipping_profiles").select("*").order("priority", { ascending: true }),
      supabase.from("shipping_rates").select("*").order("priority", { ascending: true }),
      supabase.from("shipping_packages").select("*").order("is_default", { ascending: false }).order("name"),
      supabase.from("delivery_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    return {
      profiles: unwrap(profiles) || [],
      rates: unwrap(rates) || [],
      packages: unwrap(packages) || [],
      settings: unwrap(settings) || null,
    };
  },

  async saveSettings(data) {
    return unwrap(await supabase.from("delivery_settings").upsert({
      id: 1,
      local_pickup_enabled: Boolean(data.local_pickup_enabled),
      pickup_name: data.pickup_name || "Local Pickup",
      pickup_location: data.pickup_location || "GDP Clothing — Saskatoon",
      pickup_instructions: data.pickup_instructions || null,
      processing_min_days: Math.max(0, Number(data.processing_min_days || 0)),
      processing_max_days: Math.max(0, Number(data.processing_max_days || 0)),
      carrier_rates_enabled: Boolean(data.carrier_rates_enabled),
      carrier_name: data.carrier_name || "Canada Post",
      fallback_rate_enabled: Boolean(data.fallback_rate_enabled),
      fallback_rate: Math.max(0, Number(data.fallback_rate || 0)),
      updated_at: new Date().toISOString(),
    }).select().single());
  },

  async saveProfile(profile) {
    const payload = {
      name: profile.name || "General shipping",
      code: profile.code || String(profile.name || "general").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      active: profile.active !== false,
      origin_location: profile.origin_location || {},
      product_ids: profile.product_ids || [],
      priority: Number(profile.priority || 100),
    };
    if (profile.id) return unwrap(await supabase.from("shipping_profiles").update(payload).eq("id", profile.id).select().single());
    return unwrap(await supabase.from("shipping_profiles").insert(payload).select().single());
  },

  async saveRate(rate) {
    const payload = {
      profile_id: rate.profile_id,
      method_code: rate.method_code || "standard",
      label: rate.label || "Standard Shipping",
      description: rate.description || null,
      price: Math.max(0, Number(rate.price || 0)),
      min_order: rate.min_order === "" || rate.min_order == null ? null : Number(rate.min_order),
      max_order: rate.max_order === "" || rate.max_order == null ? null : Number(rate.max_order),
      zone_name: rate.zone_name || "Canada",
      country_codes: rate.country_codes?.length ? rate.country_codes : ["CA"],
      province_codes: rate.province_codes || [],
      postal_patterns: rate.postal_patterns || [],
      min_weight_grams: rate.min_weight_grams === "" || rate.min_weight_grams == null ? null : Number(rate.min_weight_grams),
      max_weight_grams: rate.max_weight_grams === "" || rate.max_weight_grams == null ? null : Number(rate.max_weight_grams),
      rate_source: rate.rate_source || "manual",
      fallback_price: rate.fallback_price === "" || rate.fallback_price == null ? null : Number(rate.fallback_price),
      priority: Number(rate.priority || 100),
      active: rate.active !== false,
    };
    if (rate.id) return unwrap(await supabase.from("shipping_rates").update(payload).eq("id", rate.id).select().single());
    return unwrap(await supabase.from("shipping_rates").insert(payload).select().single());
  },

  async deleteRate(id) {
    return unwrap(await supabase.from("shipping_rates").delete().eq("id", id));
  },

  async savePackage(pkg) {
    const payload = {
      name: pkg.name || "Package",
      package_type: pkg.package_type || "mailer",
      length_cm: Math.max(0, Number(pkg.length_cm || 0)),
      width_cm: Math.max(0, Number(pkg.width_cm || 0)),
      height_cm: Math.max(0, Number(pkg.height_cm || 0)),
      empty_weight_grams: Math.max(0, Number(pkg.empty_weight_grams || 0)),
      is_default: Boolean(pkg.is_default),
      active: pkg.active !== false,
      updated_at: new Date().toISOString(),
    };
    if (pkg.is_default) await supabase.from("shipping_packages").update({ is_default: false }).neq("id", pkg.id || "00000000-0000-0000-0000-000000000000");
    if (pkg.id) return unwrap(await supabase.from("shipping_packages").update(payload).eq("id", pkg.id).select().single());
    return unwrap(await supabase.from("shipping_packages").insert(payload).select().single());
  },
};
