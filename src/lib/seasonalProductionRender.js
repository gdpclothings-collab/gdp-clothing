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

async function decodeBlob(blob) {
  if (!blob || !blob.size) throw productionLoadError();

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        image: bitmap,
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

async function loadCrossOriginImage(url) {
  const image = new Image();
  image.decoding = "async";
  image.crossOrigin = "anonymous";

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(productionLoadError()), LOAD_TIMEOUT_MS);
    const finish = (callback) => {
      window.clearTimeout(timeoutId);
      callback();
    };
    image.addEventListener("load", () => finish(() => resolve({ image, close: () => {} })), { once: true });
    image.addEventListener("error", () => finish(() => reject(productionLoadError())), { once: true });
    image.src = url;
  });
}

async function loadRenderableImage(source) {
  const url = String(source || "").trim();
  if (!url) throw new Error("A locked Seasonal artwork source is unavailable.");

  let lastError = null;
  for (let attempt = 0; attempt < LOAD_ATTEMPTS; attempt += 1) {
    try {
      const blob = await fetchImageBlob(url);
      return await decodeBlob(blob);
    } catch (error) {
      lastError = error;
      if (attempt < LOAD_ATTEMPTS - 1) await sleep(250 * (attempt + 1));
    }
  }

  // Some iOS/Safari builds intermittently fail fetch() for an image that the
  // browser image loader can still retrieve. This fallback keeps CORS enabled
  // so the production canvas remains exportable rather than becoming tainted.
  try {
    return await loadCrossOriginImage(url);
  } catch {
    throw lastError || productionLoadError();
  }
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

  const sourceByLayerId = new Map((sources || []).map((item) => [String(item?.layerId || ""), item?.previewUrl || item?.url || ""]));
  const sourceByArtworkId = new Map((sources || []).map((item) => [String(item?.artworkId || ""), item?.previewUrl || item?.url || ""]));
  const orderedLayers = layers.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  try {
    for (const layer of orderedLayers) {
      const source = sourceByLayerId.get(String(layer.layerId || "")) || sourceByArtworkId.get(String(layer.artworkId || layer.artwork_id || "")) || layer.previewUrl || layer.preview_url || "";
      const loaded = await loadRenderableImage(source);
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
        context.drawImage(loaded.image, -width / 2, -height / 2, width, height);
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
