const OPTIMIZABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// 1400px keeps product-detail media crisp on high-density displays while
// avoiding multi-megabyte storefront assets. Product cards render much smaller
// than this, so one 1400px source remains a good quality/bandwidth compromise.
export const STOREFRONT_IMAGE_MAX_DIMENSION = 1400;
export const STOREFRONT_IMAGE_QUALITY = 0.82;
export const STOREFRONT_IMAGE_CACHE_SECONDS = "31536000";

function webpName(filename = "product-image") {
  const base = String(filename || "product-image")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "product-image";
  return `${base}.webp`;
}

function decodeWithHtmlImage(file) {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined" || typeof URL === "undefined") {
      reject(new Error("Image decoding is not available in this environment."));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode image."));
    };
    image.src = objectUrl;
  });
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close?.(),
      };
    } catch {
      // Fall back to the HTML image decoder below.
    }
  }
  return decodeWithHtmlImage(file);
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}

/**
 * Creates a storefront-friendly WebP before upload. Product media is display
 * media, so keeping the browser-served copy reasonably sized avoids sending
 * multi-megabyte PNG originals to every shopper. If the browser cannot safely
 * optimize the image, the original file is returned unchanged.
 */
export async function optimizeStorefrontImageUpload(
  file,
  {
    maxDimension = STOREFRONT_IMAGE_MAX_DIMENSION,
    quality = STOREFRONT_IMAGE_QUALITY,
  } = {}
) {
  if (!file || !OPTIMIZABLE_IMAGE_TYPES.has(String(file.type || "").toLowerCase())) {
    return { file, optimized: false };
  }

  if (typeof document === "undefined") {
    return { file, optimized: false };
  }

  let decoded;
  try {
    decoded = await decodeImage(file);
    const originalWidth = decoded.width || 0;
    const originalHeight = decoded.height || 0;
    const largestSide = Math.max(originalWidth, originalHeight);
    if (!largestSide) return { file, optimized: false };

    const scale = Math.min(1, Number(maxDimension) / largestSide);
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return { file, optimized: false };

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);

    const blob = await canvasToWebp(canvas, quality);
    if (!blob) return { file, optimized: false };

    // Avoid replacing an already-efficient source with a larger encoded copy.
    if (blob.size >= file.size * 0.95) {
      return {
        file,
        optimized: false,
        originalBytes: file.size,
        originalWidth,
        originalHeight,
        width,
        height,
      };
    }

    const optimizedFile = new File([blob], webpName(file.name), {
      type: "image/webp",
      lastModified: file.lastModified || Date.now(),
    });

    return {
      file: optimizedFile,
      optimized: true,
      originalBytes: file.size,
      optimizedBytes: optimizedFile.size,
      originalWidth,
      originalHeight,
      width,
      height,
    };
  } catch {
    return { file, optimized: false };
  } finally {
    decoded?.cleanup?.();
  }
}
