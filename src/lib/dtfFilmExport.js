import { normalizeArtworkRotation } from "@/lib/dtfGangSheet";

const MAX_CANVAS_SIDE = 12000;

const loadImage = (source) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Could not load artwork: ${source || "missing source"}`));
  image.src = source;
});

const canvasBlob = (canvas, type = "image/png", quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the export file.")), type, quality);
});

export const watermarkApplies = (settings, target) => Boolean(
  settings?.watermarkedPreviewEnabled &&
  (settings.watermarkApplyTo === "all" || settings.watermarkApplyTo === target)
);

export function drawWatermark(context, width, height, settings = {}) {
  const text = String(settings.watermarkText || "GDP Clothing Preview");
  const opacity = Number(settings.watermarkOpacity || 0.2);
  const size = Math.max(10, Number(settings.watermarkSize || 28));
  const position = settings.watermarkPosition || "repeated";
  context.save();
  context.globalAlpha = opacity;
  context.fillStyle = "#111111";
  context.font = `700 ${size}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (position === "centered") {
    context.translate(width / 2, height / 2);
    context.rotate(-Math.PI / 6);
    context.fillText(text, 0, 0);
  } else if (position === "corner") {
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.fillText(text, width - 18, height - 18);
  } else {
    const stepX = Math.max(220, context.measureText(text).width + 90);
    const stepY = Math.max(120, size * 4);
    context.rotate(-Math.PI / 6);
    for (let y = -height; y < height * 1.8; y += stepY) {
      for (let x = -width; x < width * 1.8; x += stepX) context.fillText(text, x, y);
    }
  }
  context.restore();
}

export async function renderFilmSegment({ items, width, startY = 0, length, dpi = 300, background = null, watermark = null }) {
  const safeDpi = Math.max(72, Number(dpi || 300));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * safeDpi));
  canvas.height = Math.max(1, Math.round(length * safeDpi));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create film exports.");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else context.clearRect(0, 0, canvas.width, canvas.height);

  const imageItems = items.filter((item) => item.previewUrl || item.exportUrl);
  const images = await Promise.all(imageItems.map((item) => loadImage(item.exportUrl || item.previewUrl)));
  imageItems.forEach((item, index) => {
    const image = images[index];
    const centerX = (Number(item.x || 0) + Number(item.width || 0) / 2) * safeDpi;
    const centerY = (Number(item.y || 0) + Number(item.height || 0) / 2 - startY) * safeDpi;
    const drawWidth = Number(item.width || 0) * safeDpi;
    const drawHeight = Number(item.height || 0) * safeDpi;
    const crop = item.cropBounds;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(normalizeArtworkRotation(item.rotation) * Math.PI / 180);
    if (crop && item.exportUrl) {
      const sx = Number(crop.left || 0) * image.naturalWidth;
      const sy = Number(crop.top || 0) * image.naturalHeight;
      const sw = (Number(crop.right || 1) - Number(crop.left || 0)) * image.naturalWidth;
      const sh = (Number(crop.bottom || 1) - Number(crop.top || 0)) * image.naturalHeight;
      context.drawImage(image, sx, sy, sw, sh, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    } else context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
  });
  if (watermark) drawWatermark(context, canvas.width, canvas.height, watermark);
  return canvas;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadFilmPreview({ items, width, length, settings, filename = "dtf-film-preview.jpg" }) {
  const dpi = Math.max(20, Math.min(96, Math.floor(Math.min(1400 / length, 900 / width))));
  const canvas = await renderFilmSegment({
    items, width, length, dpi, background: "#f8f8f6",
    watermark: watermarkApplies(settings, "download") ? settings : null,
  });
  downloadBlob(await canvasBlob(canvas, "image/jpeg", 0.9), filename);
}

export async function exportProductionPackage({ items, width, length, settings, orderNumber = "DTF", itemId = "film" }) {
  const unsupported = items.filter((item) => !item.exportUrl || String(item.type || "").includes("pdf"));
  if (unsupported.length) throw new Error("Production export needs image source files. Open PDF artwork separately before printing.");
  const [{ default: JSZip }, { jsPDF }] = await Promise.all([import("jszip"), import("jspdf")]);
  const dpi = Number(settings?.recommendedDpi || 300);
  const maxLengthByCanvas = Math.floor(MAX_CANVAS_SIDE / dpi);
  const segmentLength = Math.max(1, Math.min(Number(settings?.productionSegmentLength || 120), maxLengthByCanvas));
  const segmentCount = Math.ceil(length / segmentLength);
  const base = `${String(orderNumber).replace(/[^a-z0-9-]+/gi, "-")}_${width}x${length}_${String(itemId).slice(0, 8)}`;
  const zip = new JSZip();
  const pdf = new jsPDF({ orientation: length >= width ? "portrait" : "landscape", unit: "in", format: [width, Math.min(segmentLength, length)], compress: true });
  for (let index = 0; index < segmentCount; index += 1) {
    const startY = index * segmentLength;
    const partLength = Math.min(segmentLength, length - startY);
    const canvas = await renderFilmSegment({ items, width, startY, length: partLength, dpi });
    const blob = await canvasBlob(canvas, "image/png");
    const partName = `${base}_part-${String(index + 1).padStart(2, "0")}.png`;
    zip.file(partName, blob);
    if (index > 0) pdf.addPage([width, partLength], partLength >= width ? "portrait" : "landscape");
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, partLength, undefined, "FAST");
  }
  zip.file(`${base}_print.pdf`, pdf.output("blob"));
  zip.file(`${base}_layout.json`, JSON.stringify({ orderNumber, width, length, dpi, exportedAt: new Date().toISOString(), layout: items.map(({ exportUrl, previewUrl, ...item }) => item) }, null, 2));
  downloadBlob(await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }), `${base}_production.zip`);
}
