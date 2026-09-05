import { supabase } from "@/lib/supabaseClient";

export const storefrontContentApi = {
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
