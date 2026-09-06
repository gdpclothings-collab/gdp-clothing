import { supabase } from "@/lib/supabaseClient";
import { adminApi } from "@/lib/adminApi";

const mapSettings = (row) =>
  row
    ? {
        id: row.id,
        storeName: row.store_name,
        slogan: row.slogan,
        primaryColor: row.primary_color,
        currency: row.currency,
        timezone: row.timezone,
        orderPrefix: row.order_prefix,
        lowStockThreshold: row.low_stock_threshold,
        contactEmail: row.contact_email,
        phone: row.phone,
        address: row.address,
        facebook: row.facebook,
        instagram: row.instagram,
        tiktok: row.tiktok,
        youtube: row.youtube,
        footerText: row.footer_text,
        logo: row.logo,
        customStudioSettings: row.custom_studio_settings || {},
        updatedAt: row.updated_at,
      }
    : null;

export const adminSettingsApi = {
  async load() {
    const [settingsResult, profilesResult] = await Promise.all([
      supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("profiles").select("id, display_name, role, phone, created_at").order("created_at", { ascending: true }),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (profilesResult.error) throw profilesResult.error;

    return {
      settings: mapSettings(settingsResult.data),
      profiles: profilesResult.data || [],
    };
  },

  async save(settings) {
    await adminApi.saveStoreSettings(settings.id || 1, settings);
  },

  async loadCustomStudioSettings() {
    const { data, error } = await supabase
      .from("store_settings")
      .select("custom_studio_settings")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    return data?.custom_studio_settings || {};
  },

  async saveCustomStudioSettings(settings) {
    const { error } = await supabase
      .from("store_settings")
      .update({ custom_studio_settings: settings || {} })
      .eq("id", 1);

    if (error) throw error;
  },
};
