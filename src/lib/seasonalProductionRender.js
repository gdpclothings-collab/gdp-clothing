function positiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

async function loadRenderableImage(source) {
  const url = String(source || "").trim();
  if (!url) throw new Error("A locked Seasonal artwork source is unavailable.");

  const response = await fetch(url, { credentials: "omit", cache: "force-cache" });
  if (!response.ok) throw new Error("A locked Seasonal artwork source could not be reopened.");
  const blob = await response.blob();

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      image: bitmap,
      close: () => bitmap.close?.(),
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", () => reject(new Error("A locked Seasonal artwork source could not be decoded.")), { once: true });
  });
  try { await image.decode?.(); } catch { /* loaded image is still usable */ }
  return {
    image,
    close: () => URL.revokeObjectURL(objectUrl),
  };
}

function canvasPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not create the Seasonal production PNG.")),
      "image/png"
    );
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

  return {
    blob: await canvasPng(canvas),
    widthPx,
    heightPx,
    widthIn,
    heightIn,
    dpi: safeDpi,
    mimeType: "image/png",
  };
}
