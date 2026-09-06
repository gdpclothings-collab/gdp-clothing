import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_LANDING_PAGE, mergeLandingPageConfig } from "@/lib/landingPageDefaults";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function safeFolder(value) {
  return String(value || "home")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/^\/+|\/+$/g, "") || "home";
}

async function readState() {
  const [settingsResult, draftResult] = await Promise.all([
    supabase
      .from("store_settings")
      .select("homepage, homepage_version, homepage_published_at, homepage_updated_at")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("landing_page_draft")
      .select("content, updated_at, updated_by")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (draftResult.error) throw draftResult.error;

  const published = mergeLandingPageConfig(settingsResult.data?.homepage);
  const draft = mergeLandingPageConfig(draftResult.data?.content || settingsResult.data?.homepage);

  return {
    draft,
    published,
    version: Number(settingsResult.data?.homepage_version || 1),
    publishedAt: settingsResult.data?.homepage_published_at || null,
    publishedUpdatedAt: settingsResult.data?.homepage_updated_at || null,
    draftUpdatedAt: draftResult.data?.updated_at || null,
  };
}

export const adminLandingPageApi = {
  async load() {
    return readState();
  },

  async saveDraft(homepage) {
    const { data: authData } = await supabase.auth.getUser();
    const payload = {
      content: mergeLandingPageConfig(homepage),
      updated_by: authData?.user?.id || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("landing_page_draft")
      .update(payload)
      .eq("id", 1)
      .select("content, updated_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const inserted = await supabase
        .from("landing_page_draft")
        .insert({ id: 1, ...payload })
        .select("content, updated_at")
        .single();
      if (inserted.error) throw inserted.error;
      return {
        draft: mergeLandingPageConfig(inserted.data.content),
        updatedAt: inserted.data.updated_at,
      };
    }

    return {
      draft: mergeLandingPageConfig(data.content),
      updatedAt: data.updated_at,
    };
  },

  async publish(homepage) {
    const content = mergeLandingPageConfig(homepage);
    const { error } = await supabase.rpc("publish_landing_page", { p_content: content });
    if (error) throw error;
    return readState();
  },

  async history() {
    const { data, error } = await supabase
      .from("landing_page_versions")
      .select("id, version, content, published_by, published_at")
      .order("version", { ascending: false })
      .limit(20);

    if (error) throw error;
    return (data || []).map((item) => ({
      ...item,
      content: mergeLandingPageConfig(item.content),
    }));
  },

  async restoreVersionToDraft(version) {
    const { data, error } = await supabase
      .from("landing_page_versions")
      .select("content")
      .eq("version", Number(version))
      .single();

    if (error) throw error;
    return adminLandingPageApi.saveDraft(data.content);
  },

  async uploadMedia(file, folder = "home") {
    if (!file) throw new Error("Choose an image to upload.");
    if (!ALLOWED_IMAGE_TYPES.has(String(file.type || "").toLowerCase())) {
      throw new Error("Use PNG, JPG, WebP, GIF, or AVIF. SVG uploads are disabled for storefront safety.");
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
    const path = "site/" + safeFolder(folder) + "/" + Date.now() + "-" + unique + "-" + (safeName || "image");

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: false, cacheControl: "3600" });

    if (error) throw error;

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Could not create a public storefront image URL.");
    return data.publicUrl;
  },
};

export { DEFAULT_LANDING_PAGE };
