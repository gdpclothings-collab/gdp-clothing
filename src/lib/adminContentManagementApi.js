import { supabase } from "@/lib/supabaseClient";

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const adminContentManagementApi = {
  async load() {
    const [pagesResult, menusResult, productsResult, collectionsResult] =
      await Promise.all([
        supabase
          .from("content_pages")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase
          .from("navigation_menus")
          .select("*, navigation_items(*)")
          .order("name", { ascending: true }),
        supabase
          .from("products")
          .select("id, name, slug, status, images")
          .neq("status", "archived")
          .order("name", { ascending: true })
          .limit(500),
        supabase
          .from("collections")
          .select("id, name, slug, status")
          .neq("status", "archived")
          .order("name", { ascending: true })
          .limit(250),
      ]);

    for (const result of [
      pagesResult,
      menusResult,
      productsResult,
      collectionsResult,
    ]) {
      if (result.error) throw result.error;
    }

    return {
      pages: pagesResult.data || [],
      menus: (menusResult.data || []).map((menu) => ({
        ...menu,
        navigation_items: (menu.navigation_items || []).sort(
          (a, b) => Number(a.position || 0) - Number(b.position || 0)
        ),
      })),
      products: productsResult.data || [],
      collections: collectionsResult.data || [],
    };
  },

  async savePage(id, payload) {
    const body = {
      title: String(payload.title || "").trim(),
      slug: slugify(payload.slug || payload.title),
      page_type: payload.pageType || "page",
      excerpt: payload.excerpt || null,
      body: payload.body || {},
      seo: payload.seo || {},
      status: payload.status || "draft",
      published_at:
        payload.status === "published"
          ? payload.publishedAt || new Date().toISOString()
          : null,
    };

    const query = id
      ? supabase.from("content_pages").update(body).eq("id", id)
      : supabase.from("content_pages").insert(body);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async setPageStatus(id, status) {
    const { data, error } = await supabase
      .from("content_pages")
      .update({
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  },

  async saveMenu(id, payload) {
    const row = {
      name: String(payload.name || "").trim(),
      handle: slugify(payload.handle || payload.name),
      active: payload.active !== false,
    };

    const query = id
      ? supabase.from("navigation_menus").update(row).eq("id", id)
      : supabase.from("navigation_menus").insert(row);

    const { data, error } = await query.select("*").single();
    if (error) throw error;
    return data;
  },

  async replaceMenuItems(menuId, items) {
    const { error: clearError } = await supabase
      .from("navigation_items")
      .delete()
      .eq("menu_id", menuId);
    if (clearError) throw clearError;

    const cleanItems = (items || []).filter((item) =>
      String(item.label || "").trim()
    );

    if (!cleanItems.length) return [];

    const { data, error } = await supabase
      .from("navigation_items")
      .insert(
        cleanItems.map((item, index) => ({
          menu_id: menuId,
          label: String(item.label || "").trim(),
          link_type: item.linkType || "url",
          target_id: item.targetId || null,
          url: item.url || null,
          position: index,
          active: item.active !== false,
        }))
      )
      .select("*");

    if (error) throw error;
    return data || [];
  },

  async setMenuActive(id, active) {
    const { error } = await supabase
      .from("navigation_menus")
      .update({ active: Boolean(active) })
      .eq("id", id);

    if (error) throw error;
  },
};
