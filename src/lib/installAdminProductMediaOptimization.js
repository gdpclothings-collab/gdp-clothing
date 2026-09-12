import { adminProductsApi } from "@/lib/adminProductsApi";
import { supabase } from "@/lib/supabaseClient";
import {
  optimizeStorefrontImageUpload,
  STOREFRONT_IMAGE_CACHE_SECONDS,
} from "@/lib/storefrontImageUpload";

let installed = false;

export function installAdminProductMediaOptimization() {
  if (installed) return;
  installed = true;

  adminProductsApi.uploadMedia = async (file) => {
    if (!file) throw new Error("Choose an image to upload.");
    if (!String(file.type || "").startsWith("image/")) {
      throw new Error("Product media currently supports image files.");
    }

    const result = await optimizeStorefrontImageUpload(file);
    const uploadFile = result.file || file;
    const safeName = String(uploadFile.name || "product-image")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const unique = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    const path = `products/${Date.now()}-${unique}-${safeName || "image"}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, uploadFile, {
        upsert: false,
        cacheControl: STOREFRONT_IMAGE_CACHE_SECONDS,
      });

    if (error) throw error;

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Could not create a public product image URL.");
    return data.publicUrl;
  };
}

installAdminProductMediaOptimization();
