import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_LANDING_PAGE, mergeLandingPageConfig } from "@/lib/landingPageDefaults";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export const adminLandingPageApi = {
  async load() {
    const { data, error } = await supabase
      .from("store_settings")
      .select("homepage")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      if (error.code === "42703") return DEFAULT_LANDING_PAGE;
      throw error;
    }

    return mergeLandingPageConfig(data?.homepage);
  },

  async save(homepage) {
    const { data, error } = await supabase
      .from("store_settings")
      .update({ homepage })
      .eq("id", 1)
      .select("homepage")
      .single();

    if (error) throw error;
    return mergeLandingPageConfig(data?.homepage);
  },

  async uploadMedia(file) {
    if (!file) throw new Error("Choose an image to upload.");
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("Landing page media must be an image.");
    }
    if (Number(file.size || 0) > MAX_IMAGE_BYTES) {
      throw new Error("Image must be 12 MB or smaller.");
    }

    const safeName = String(file.name || "landing-image")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const unique = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const path = `site/home/${Date.now()}-${unique}-${safeName || "image"}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: false, cacheControl: "3600" });

    if (error) throw error;

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Could not create a public landing page image URL.");
    return data.publicUrl;
  },
};
