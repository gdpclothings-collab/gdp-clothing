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

  async uploadIntensityExample(file, level) {
    if (!file) throw new Error("Choose an intensity example image to upload.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(String(file.type || ""))) {
      throw new Error("Intensity examples support JPG, PNG, or WEBP images.");
    }
    if (Number(file.size || 0) > 12 * 1024 * 1024) {
      throw new Error("Intensity example images must be 12 MB or smaller.");
    }

    const safeName = String(file.name || `intensity-${level}`)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const unique = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const path = `custom-studio/intensity/${level}/${Date.now()}-${unique}-${safeName || "example"}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, {
        upsert: false,
        cacheControl: "3600",
        contentType: file.type || undefined,
      });
    if (error) throw error;

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Could not create a public intensity example URL.");
    return data.publicUrl;
  },

  async saveCustomStudioSettings(settings) {
    const { error } = await supabase
      .from("store_settings")
      .update({ custom_studio_settings: settings || {} })
      .eq("id", 1);

    if (error) throw error;
  },
};
