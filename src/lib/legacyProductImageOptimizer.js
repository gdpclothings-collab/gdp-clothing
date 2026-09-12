import { supabase } from "@/lib/supabaseClient";
import {
  optimizeStorefrontImageUpload,
  STOREFRONT_IMAGE_CACHE_SECONDS,
  STOREFRONT_IMAGE_MAX_DIMENSION,
  STOREFRONT_IMAGE_QUALITY,
} from "@/lib/storefrontImageUpload";

const PRODUCT_BUCKET = "product-images";
const PUBLIC_PRODUCT_MARKER = "/storage/v1/object/public/product-images/";
const OPTIMIZED_PRODUCT_MARKER = `${PUBLIC_PRODUCT_MARKER}products/optimized/`;

function isDataImage(value) {
  return String(value || "").startsWith("data:image/");
}

function isSupabaseProductImage(value) {
  return String(value || "").includes(PUBLIC_PRODUCT_MARKER);
}

function isOptimizedProductImage(value) {
  return String(value || "").includes(OPTIMIZED_PRODUCT_MARKER);
}

function isCandidate(value) {
  return isDataImage(value) || (isSupabaseProductImage(value) && !isOptimizedProductImage(value));
}

function safeFilename(value) {
  return String(value || "product-image")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product-image";
}

function filenameFromUrl(value, fallback = "product-image") {
  if (isDataImage(value)) return `${fallback}.png`;
  try {
    const pathname = new URL(value).pathname;
    return decodeURIComponent(pathname.split("/").pop() || "") || fallback;
  } catch {
    return fallback;
  }
}

function inferMimeType(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

async function fetchImageFile(url, fallbackName) {
  const response = await fetch(url, { cache: "no-store", credentials: "omit" });
  if (!response.ok) throw new Error(`Image download failed (${response.status}).`);

  const blob = await response.blob();
  const name = filenameFromUrl(url, fallbackName);
  const type = blob.type || inferMimeType(name);
  if (!String(type).startsWith("image/")) {
    throw new Error("Downloaded file is not a supported image.");
  }

  return new File([blob], name, { type, lastModified: Date.now() });
}

async function getReusableBackup(productId, imageIndex, originalUrl) {
  const { data, error } = await supabase
    .from("product_image_optimization_backup")
    .select("id, optimized_url, status, original_bytes, optimized_bytes, optimized_width, optimized_height")
    .eq("product_id", productId)
    .eq("image_index", imageIndex)
    .eq("original_url", originalUrl)
    .neq("status", "reverted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function prepareOptimizedCopy(product, imageIndex, originalUrl) {
  const existing = await getReusableBackup(product.id, imageIndex, originalUrl);
  if (existing?.optimized_url) {
    return {
      backupId: existing.id,
      optimizedUrl: existing.optimized_url,
      originalBytes: Number(existing.original_bytes || 0),
      optimizedBytes: Number(existing.optimized_bytes || 0),
      width: existing.optimized_width,
      height: existing.optimized_height,
      reused: true,
    };
  }

  const sourceFile = await fetchImageFile(
    originalUrl,
    `${safeFilename(product.name)}-${imageIndex + 1}`
  );
  const result = await optimizeStorefrontImageUpload(sourceFile);

  if (!result.optimized || !result.file) {
    return {
      skipped: true,
      reason: "already-efficient",
      originalBytes: Number(result.originalBytes || sourceFile.size || 0),
      width: result.width || result.originalWidth || null,
      height: result.height || result.originalHeight || null,
    };
  }

  const unique = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const uploadName = safeFilename(result.file.name || `product-${imageIndex + 1}.webp`);
  const path = `products/optimized/${product.id}/${Date.now()}-${imageIndex}-${unique}-${uploadName}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(path, result.file, {
      upsert: false,
      cacheControl: STOREFRONT_IMAGE_CACHE_SECONDS,
      contentType: "image/webp",
    });
  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(path);
  const optimizedUrl = publicData?.publicUrl;
  if (!optimizedUrl) throw new Error("Could not create optimized product image URL.");

  const backupPayload = {
    product_id: product.id,
    image_index: imageIndex,
    original_url: originalUrl,
    optimized_url: optimizedUrl,
    original_bytes: Number(result.originalBytes || sourceFile.size || 0),
    optimized_bytes: Number(result.optimizedBytes || result.file.size || 0),
    original_width: result.originalWidth || null,
    original_height: result.originalHeight || null,
    optimized_width: result.width || null,
    optimized_height: result.height || null,
    status: "prepared",
    applied_at: null,
    reverted_at: null,
  };

  const { data: backup, error: backupError } = await supabase
    .from("product_image_optimization_backup")
    .insert(backupPayload)
    .select("id")
    .single();
  if (backupError) throw backupError;

  return {
    backupId: backup.id,
    optimizedUrl,
    originalBytes: backupPayload.original_bytes,
    optimizedBytes: backupPayload.optimized_bytes,
    width: backupPayload.optimized_width,
    height: backupPayload.optimized_height,
    reused: false,
  };
}

export async function scanLegacyProductImages() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, status, images")
    .order("name", { ascending: true });
  if (error) throw error;

  let totalImages = 0;
  let candidates = 0;
  let alreadyOptimized = 0;
  let localOrExternal = 0;
  let dataImages = 0;

  for (const product of data || []) {
    for (const image of product.images || []) {
      totalImages += 1;
      if (isDataImage(image)) {
        dataImages += 1;
        candidates += 1;
      } else if (isOptimizedProductImage(image)) {
        alreadyOptimized += 1;
      } else if (isSupabaseProductImage(image)) {
        candidates += 1;
      } else {
        localOrExternal += 1;
      }
    }
  }

  return {
    products: data || [],
    productCount: (data || []).length,
    totalImages,
    candidates,
    alreadyOptimized,
    localOrExternal,
    dataImages,
    maxDimension: STOREFRONT_IMAGE_MAX_DIMENSION,
    quality: STOREFRONT_IMAGE_QUALITY,
  };
}

export async function optimizeLegacyProductImages({ onProgress } = {}) {
  const scan = await scanLegacyProductImages();
  let processed = 0;
  let optimized = 0;
  let skipped = 0;
  let preparedNotApplied = 0;
  let originalBytes = 0;
  let optimizedBytes = 0;
  const errors = [];

  const emit = (extra = {}) => {
    onProgress?.({
      processed,
      total: scan.candidates,
      optimized,
      skipped,
      preparedNotApplied,
      errors: errors.length,
      ...extra,
    });
  };

  emit({ phase: "starting" });

  for (const product of scan.products) {
    const originalImages = Array.isArray(product.images) ? product.images : [];
    if (!originalImages.some(isCandidate)) continue;

    const nextImages = [...originalImages];
    const prepared = [];

    for (let index = 0; index < originalImages.length; index += 1) {
      const originalUrl = originalImages[index];
      if (!isCandidate(originalUrl)) continue;

      emit({
        phase: "processing",
        productId: product.id,
        productName: product.name,
        imageIndex: index,
      });

      try {
        const item = await prepareOptimizedCopy(product, index, originalUrl);
        if (item.skipped) {
          skipped += 1;
        } else {
          nextImages[index] = item.optimizedUrl;
          prepared.push({ ...item, imageIndex: index, originalUrl });
        }
      } catch (err) {
        errors.push({
          productId: product.id,
          productName: product.name,
          imageIndex: index,
          message: err?.message || "Image optimization failed.",
        });
      } finally {
        processed += 1;
        emit({
          phase: "processing",
          productId: product.id,
          productName: product.name,
          imageIndex: index,
        });
      }
    }

    if (!prepared.length) continue;

    const { error: productError } = await supabase
      .from("products")
      .update({ images: nextImages })
      .eq("id", product.id);

    if (productError) {
      preparedNotApplied += prepared.length;
      errors.push({
        productId: product.id,
        productName: product.name,
        imageIndex: null,
        message: `Optimized copies were created, but product references were not updated: ${productError.message}`,
      });
      continue;
    }

    const backupIds = prepared.map((item) => item.backupId).filter(Boolean);
    if (backupIds.length) {
      const { error: markError } = await supabase
        .from("product_image_optimization_backup")
        .update({
          status: "applied",
          applied_at: new Date().toISOString(),
          reverted_at: null,
        })
        .in("id", backupIds);

      if (markError) {
        errors.push({
          productId: product.id,
          productName: product.name,
          imageIndex: null,
          message: `Product was optimized, but backup status could not be finalized: ${markError.message}`,
        });
      }
    }

    for (const item of prepared) {
      optimized += 1;
      originalBytes += Number(item.originalBytes || 0);
      optimizedBytes += Number(item.optimizedBytes || 0);
    }
  }

  const savedBytes = Math.max(0, originalBytes - optimizedBytes);
  const savedPercent = originalBytes > 0
    ? Math.round((savedBytes / originalBytes) * 1000) / 10
    : 0;

  const result = {
    ...scan,
    processed,
    optimized,
    skipped,
    preparedNotApplied,
    errors,
    originalBytes,
    optimizedBytes,
    savedBytes,
    savedPercent,
  };

  emit({ phase: "complete", result });
  return result;
}

export async function restoreOriginalProductImages({ onProgress } = {}) {
  const { data: backups, error } = await supabase
    .from("product_image_optimization_backup")
    .select("id, product_id, image_index, original_url, optimized_url, status")
    .eq("status", "applied")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const grouped = new Map();
  for (const backup of backups || []) {
    const rows = grouped.get(backup.product_id) || [];
    rows.push(backup);
    grouped.set(backup.product_id, rows);
  }

  let processed = 0;
  let restored = 0;
  let skipped = 0;
  const errors = [];

  for (const [productId, rows] of grouped.entries()) {
    onProgress?.({
      phase: "restoring",
      processed,
      total: grouped.size,
      restored,
      skipped,
      errors: errors.length,
    });

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, images")
      .eq("id", productId)
      .single();

    if (productError) {
      errors.push({ productId, message: productError.message });
      processed += 1;
      continue;
    }

    const nextImages = [...(product.images || [])];
    const restoredIds = [];

    for (const row of rows) {
      if (nextImages[row.image_index] === row.optimized_url) {
        nextImages[row.image_index] = row.original_url;
        restoredIds.push(row.id);
      } else {
        skipped += 1;
      }
    }

    if (restoredIds.length) {
      const { error: restoreError } = await supabase
        .from("products")
        .update({ images: nextImages })
        .eq("id", productId);

      if (restoreError) {
        errors.push({ productId, message: restoreError.message });
      } else {
        restored += restoredIds.length;
        const { error: markError } = await supabase
          .from("product_image_optimization_backup")
          .update({
            status: "reverted",
            reverted_at: new Date().toISOString(),
          })
          .in("id", restoredIds);

        if (markError) {
          errors.push({ productId, message: `References restored but rollback metadata was not updated: ${markError.message}` });
        }
      }
    }

    processed += 1;
  }

  const result = { processed, total: grouped.size, restored, skipped, errors };
  onProgress?.({ phase: "complete", ...result });
  return result;
}
