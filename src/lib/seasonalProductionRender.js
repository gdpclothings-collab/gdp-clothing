import { verifySeasonalPrintMaster } from './seasonalPrintMaster.js';

function positiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

const LOAD_TIMEOUT_MS = 15000;
const LOAD_ATTEMPTS = 3;

function productionLoadError() {
  return new Error("A Seasonal artwork source could not be loaded for production. Check your connection and retry. Your approved design is still preserved.");
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function decodeBlob(blob, format) {
  if (!blob || !blob.size) throw productionLoadError();

  if (format === "png" && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        image: bitmap,
        width: bitmap.width, height: bitmap.height,
        close: () => bitmap.close?.(),
      };
    } catch {
      // Safari can reject createImageBitmap for otherwise valid image blobs
      // (notably some SVG/WebP variants). Fall through to an HTMLImageElement.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  try {
    await new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => reject(productionLoadError()), LOAD_TIMEOUT_MS);
      const finish = (callback) => {
        window.clearTimeout(timeoutId);
        callback();
      };
      image.addEventListener("load", () => finish(resolve), { once: true });
      image.addEventListener("error", () => finish(() => reject(productionLoadError())), { once: true });
    });
    try { await image.decode?.(); } catch { /* the loaded image is still drawable */ }
    return {
      image,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function fetchImageBlob(url) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = window.setTimeout(() => controller?.abort(), LOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      credentials: "omit",
      cache: "no-store",
      mode: "cors",
      signal: controller?.signal,
    });
    if (!response.ok) throw productionLoadError();
    const blob = await response.blob();
    if (!blob?.size) throw productionLoadError();
    return blob;
  } catch {
    throw productionLoadError();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// Crop is measured against ORIGINAL ink pixels. Preview thumbnails are never
// accepted as a print source, even during network or signing failures.
function validatePngCrop(source, decoded) {
  const rect = source.inkBboxPx;
  const [left, top, right, bottom] = Array.isArray(rect) ? rect.map(Number) : [];
  if (![left, top, right, bottom].every(Number.isInteger) ||
      left < 0 || top < 0 || right <= left || bottom <= top ||
      right > decoded.width || bottom > decoded.height) {
    throw new Error("The Seasonal production master ink boundaries are invalid. Printing stopped.");
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// Vector masters have no raster ink bounding box in the library. Sample their
// alpha bounds to trim whitespace before scaling the original SVG into the
// full-resolution print canvas; never use a rasterized preview for vector ink.
function measureSvgInk(decoded) {
  if (!decoded.width || !decoded.height) throw new Error("The approved vector artwork has no valid dimensions.");
  const scale = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
  const w = Math.max(1, Math.round(decoded.width * scale));
  const h = Math.max(1, Math.round(decoded.height * scale));
  const probe = document.createElement("canvas");
  probe.width = w; probe.height = h;
  try {
    const context = probe.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Vector ink boundaries cannot be inspected.");
    context.drawImage(decoded.image, 0, 0, w, h);
    const data = context.getImageData(0, 0, w, h).data;
    let left = w, top = h, right = -1, bottom = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < 2) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    if (right < left || bottom < top) throw new Error("The approved vector artwork contains no visible ink.");
    return {
      x: left / w * decoded.width,
      y: top / h * decoded.height,
      width: (right - left + 1) / w * decoded.width,
      height: (bottom - top + 1) / h * decoded.height,
    };
  } finally {
    probe.width = 1; probe.height = 1;
  }
}

async function loadApprovedMaster(source) {
  const url = String(source?.signedUrl || "");
  if (!/^https:\/\//.test(url) || !["png", "svg"].includes(source?.format)) {
    throw new Error("The approved high-resolution Seasonal source is missing.");
  }

  let lastError = null;
  for (let attempt = 0; attempt < LOAD_ATTEMPTS; attempt += 1) {
    let blob;
    try {
      blob = await fetchImageBlob(url);
    } catch (error) {
      lastError = error;
      if (attempt < LOAD_ATTEMPTS - 1) await sleep(250 * (attempt + 1));
      continue;
    }
    if (blob.size > 100 * 1024 * 1024) throw new Error("The Seasonal source exceeds the production limit.");
    // Hash-check the exact downloaded bytes BEFORE decoding or compositing.
    await verifySeasonalPrintMaster(blob, source.sourceSha256, source.format);
    const decoded = await decodeBlob(blob, source.format);
    try {
      const crop = source.format === "png" ? validatePngCrop(source, decoded) : measureSvgInk(decoded);
      return { ...decoded, crop };
    } catch (error) {
      decoded.close();
      throw error;
    }
  }
  throw lastError || productionLoadError();
}

function canvasPng(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Could not create the Seasonal production PNG. Please retry.")),
        "image/png"
      );
    } catch {
      reject(new Error("Could not create the Seasonal production PNG. Please retry."));
    }
  });
}

export async function renderSeasonalProductionPng(renderSnapshot, sources = [], dpi = 300) {
  const snapshot = renderSnapshot || {};
  const layers = Array.isArray(snapshot.layers) ? [...snapshot.layers] : [];
  if (!layers.length) throw new Error("The locked Seasonal design has no printable artwork layers.");

  const firstLayer = layers[0] || {};
  const widthIn = positiveNumber(snapshot.printArea?.width, positiveNumber(firstLayer.area_width));
  const heightIn = positiveNumber(snapshot.printArea?.height, positiveNumber(firstLayer.area_height));
  if (!widthIn || !heightIn) throw new Error("The locked Seasonal print area is invalid.");

  const safeDpi = Math.max(72, Math.min(600, Math.round(Number(dpi) || 300)));
  const widthPx = Math.max(1, Math.round(widthIn * safeDpi));
  const heightPx = Math.max(1, Math.round(heightIn * safeDpi));
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("This browser cannot build the Seasonal production file.");
  context.clearRect(0, 0, widthPx, heightPx);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const sourceByArtworkId = new Map((sources || []).map((item) => [String(item?.artworkId || ""), item]));
  if (sourceByArtworkId.size === 0) throw new Error("Approved Seasonal print masters were not provided. The design has not been changed.");
  const orderedLayers = layers.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  try {
    for (const layer of orderedLayers) {
      const source = sourceByArtworkId.get(String(layer.artworkId || layer.artwork_id || ""));
      if (!source || String(layer.sourceSha256 || "").toLowerCase() !== source.sourceSha256) {
        throw new Error("The approved Seasonal print master is not verified. Your design is preserved.");
      }
      const loaded = await loadApprovedMaster(source);
      try {
        const x = Number(layer.x || 0) * safeDpi;
        const y = Number(layer.y || 0) * safeDpi;
        const width = positiveNumber(layer.width) * safeDpi;
        const height = positiveNumber(layer.height) * safeDpi;
        if (!width || !height) throw new Error("A locked Seasonal artwork layer has invalid print dimensions.");
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const radians = Number(layer.rotation || 0) * Math.PI / 180;

        context.save();
        context.translate(centerX, centerY);
        context.rotate(radians);
        context.drawImage(loaded.image, loaded.crop.x, loaded.crop.y, loaded.crop.width, loaded.crop.height, -width / 2, -height / 2, width, height);
        context.restore();
      } finally {
        loaded.close();
      }
    }

    const blob = await canvasPng(canvas);
    return {
      blob,
      widthPx,
      heightPx,
      widthIn,
      heightIn,
      dpi: safeDpi,
      mimeType: "image/png",
    };
  } finally {
    // Release the large 300-DPI backing store as soon as the PNG is encoded.
    // This materially reduces memory pressure on iPhone/iPad Safari.
    canvas.width = 1;
    canvas.height = 1;
  }
}
