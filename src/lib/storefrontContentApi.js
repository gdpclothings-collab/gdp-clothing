import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_LANDING_PAGE, mergeLandingPageConfig } from "@/lib/landingPageDefaults";

const SOCIAL_COLUMNS = "instagram, facebook, tiktok, youtube";

function safeSocialUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function withStorewideSocial(homepage, settings) {
  const content = mergeLandingPageConfig(homepage);
  if (!settings) return content;

  return {
    ...content,
    footer: {
      ...content.footer,
      social: {
        instagram: safeSocialUrl(settings.instagram),
        facebook: safeSocialUrl(settings.facebook),
        tiktok: safeSocialUrl(settings.tiktok),
        youtube: safeSocialUrl(settings.youtube),
      },
    },
  };
}

async function getPublishedHomepage() {
  const { data, error } = await supabase
    .from("store_settings")
    .select(`homepage, ${SOCIAL_COLUMNS}`)
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (error.code === "42703" || /homepage.*column|column.*homepage/i.test(error.message || "")) {
      return DEFAULT_LANDING_PAGE;
    }
    throw error;
  }

  return withStorewideSocial(data?.homepage, data);
}

export const storefrontContentApi = {
  async getHomepage(options = {}) {
    if (options.previewDraft) {
      const [draftResult, settingsResult] = await Promise.all([
        supabase.from("landing_page_draft").select("content").eq("id", 1).maybeSingle(),
        supabase.from("store_settings").select(SOCIAL_COLUMNS).eq("id", 1).maybeSingle(),
      ]);

      if (!draftResult.error && draftResult.data?.content && !settingsResult.error) {
        return withStorewideSocial(draftResult.data.content, settingsResult.data);
      }
    }

    return getPublishedHomepage();
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

export function isLandingDraftPreview() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("cmsPreview") === "draft";
}
