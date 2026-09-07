import { supabase } from "@/lib/supabaseClient";
import { normalizeDtfSettings } from "@/lib/dtfGangSheet";

const safeFileName = (name = "artwork") =>
  String(name)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "artwork";

export const dtfGangSheetApi = {
  async load() {
    const [settingsResult, productResult] = await Promise.all([
      supabase
        .from("store_settings")
        .select("dtf_settings")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("products")
        .select("*")
        .eq("slug", "dtf-gang-sheet")
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (settingsResult.error) throw settingsResult.error;
    if (productResult.error) throw productResult.error;

    return {
      settings: normalizeDtfSettings(settingsResult.data?.dtf_settings || {}),
      product: productResult.data || null,
    };
  },

  async uploadArtwork(files = []) {
    const validFiles = files.filter(Boolean);
    if (!validFiles.length) return [];

    const descriptors = validFiles.map((file) => ({
      name: safeFileName(file.name),
      type: String(file.type || "application/octet-stream"),
      size: Number(file.size || 0),
    }));

    const { data, error } = await supabase.functions.invoke("checkout", {
      body: {
        action: "createDtfUpload",
        files: descriptors,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.message || "Could not prepare artwork upload.");

    const slots = Array.isArray(data?.uploads) ? data.uploads : [];
    if (slots.length !== validFiles.length) {
      throw new Error("Artwork upload preparation returned an incomplete response.");
    }

    const uploaded = [];
    for (let index = 0; index < validFiles.length; index += 1) {
      const file = validFiles[index];
      const slot = slots[index];
      const { error: uploadError } = await supabase.storage
        .from("dtf-artwork")
        .uploadToSignedUrl(slot.path, slot.token, file, {
          contentType: file.type || undefined,
        });

      if (uploadError) throw uploadError;
      uploaded.push({
        path: slot.path,
        name: file.name,
        type: file.type,
        size: file.size,
      });
    }

    return uploaded;
  },
};
