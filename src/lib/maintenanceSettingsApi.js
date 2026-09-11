import { supabase } from "@/lib/supabaseClient";

export const DEFAULT_MAINTENANCE_SETTINGS = Object.freeze({
  enabled: false,
  eyebrow: "GDP CLOTHING",
  title: "We’re tuning things up.",
  message:
    "Our online store is temporarily unavailable while we make improvements. Thanks for your patience — we’ll be back shortly.",
  statusLabel: "Site maintenance",
  showEstimatedReturn: false,
  estimatedReturnAt: null,
  showContact: true,
  contactLabel: "Need help with an existing order?",
  showSocialLinks: true,
});

export function normalizeMaintenanceSettings(value) {
  const settings = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_MAINTENANCE_SETTINGS,
    ...settings,
    enabled: Boolean(settings.enabled),
    showEstimatedReturn: Boolean(settings.showEstimatedReturn),
    estimatedReturnAt: settings.estimatedReturnAt || null,
    showContact: settings.showContact !== false,
    showSocialLinks: settings.showSocialLinks !== false,
  };
}

function mapSnapshot(row) {
  return {
    storeName: row?.store_name || "GDP Clothing",
    logo: row?.logo || "",
    contactEmail: row?.contact_email || "",
    facebook: row?.facebook || "",
    instagram: row?.instagram || "",
    tiktok: row?.tiktok || "",
    maintenance: normalizeMaintenanceSettings(row?.maintenance_settings),
  };
}

async function loadSnapshot() {
  const { data, error } = await supabase
    .from("store_settings")
    .select(
      "store_name, logo, contact_email, facebook, instagram, tiktok, maintenance_settings"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return mapSnapshot(data);
}

export const maintenanceSettingsApi = {
  async loadPublic() {
    return loadSnapshot();
  },

  async loadAdmin() {
    return loadSnapshot();
  },

  async save(settings) {
    const normalized = normalizeMaintenanceSettings(settings);
    const { data, error } = await supabase
      .from("store_settings")
      .update({
        maintenance_settings: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select("maintenance_settings")
      .single();

    if (error) throw error;
    return normalizeMaintenanceSettings(data?.maintenance_settings);
  },
};
