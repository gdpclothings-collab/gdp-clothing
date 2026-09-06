import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_LANDING_PAGE, mergeLandingPageConfig } from "@/lib/landingPageDefaults";

export const storefrontContentApi = {
  async getHomepage() {
    const { data, error } = await supabase
      .from("store_settings")
      .select("homepage")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      // Backward-compatible fallback while the landing-page migration is being deployed.
      if (error.code === "42703") return DEFAULT_LANDING_PAGE;
      throw error;
    }

    return mergeLandingPageConfig(data?.homepage);
  },

  async getPage(slug) {
    const { data, error } = await supabase
      .from("content_pages")
      .select("id, title, slug, page_type, excerpt, body, seo, published_at, updated_at")
      .eq("slug", String(slug || "").trim().toLowerCase())
      .eq("status", "published")
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async getMenu(handle = "main-menu") {
    const { data, error } = await supabase
      .from("navigation_menus")
      .select("id, name, handle, navigation_items(id,label,link_type,target_id,url,position,active)")
      .eq("handle", handle)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      navigation_items: (data.navigation_items || [])
        .filter((item) => item.active)
        .sort((a, b) => Number(a.position || 0) - Number(b.position || 0)),
    };
  },
};
