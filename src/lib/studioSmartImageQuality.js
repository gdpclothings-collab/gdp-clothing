// Local-only, opt-in basic photo/artwork improvement. This is not generative AI.
const TARGET_PRINT_DPI = 300;
const MIN_USABLE_DPI = 200;
const MAX_ENHANCED_PIXELS = 6_000_000;
const MAX_ENHANCED_BYTES = 18 * 1024 * 1024;
const SUPPORTED_IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function positive(number) {
  const value = Number(number);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** @param {{ pixelWidth?: number, pixelHeight?: number, printWidthIn?: number, printHeightIn?: number, originalPixelWidth?: number, originalPixelHeight?: number }} [options] */
export function assessStudioImagePrintQuality({ pixelWidth, pixelHeight, printWidthIn, printHeightIn, originalPixelWidth, originalPixelHeight } = {}) {
  // Never claim that interpolated/upscaled pixels recovered real-world source detail.
  const widthPx = positive(originalPixelWidth) || positive(pixelWidth);
  const heightPx = positive(originalPixelHeight) || positive(pixelHeight);
  const widthIn = positive(printWidthIn);
  const heightIn = positive(printHeightIn);
  if (!widthPx || !heightPx || !widthIn || !heightIn) {
    return { tone: 'slate', label: 'Quality not checked', dpi: 0, recommendedWidthIn: 0, recommendedHeightIn: 0, message: 'Choose artwork and a print size to check print clarity.' };
  }
  const dpi = Math.min(widthPx / widthIn, heightPx / heightIn);
  const sourceRatio = Math.min(widthPx / TARGET_PRINT_DPI / widthIn, heightPx / TARGET_PRINT_DPI / heightIn);
  const recommendedWidthIn = Math.round(widthIn * sourceRatio * 10) / 10;
  const recommendedHeightIn = Math.round(heightIn * sourceRatio * 10) / 10;
  if (dpi >= TARGET_PRINT_DPI) {
    return { tone: 'emerald', label: 'Good for printing', dpi, recommendedWidthIn, recommendedHeightIn, message: 'Your file has enough source pixels for this print size. Check the preview before ordering.' };
  }
  const label = dpi >= MIN_USABLE_DPI ? 'Could be improved' : 'Low quality at this size';
  return {
    tone: dpi >= MIN_USABLE_DPI ? 'amber' : 'red',
    label,
    dpi,
    recommendedWidthIn,
    recommendedHeightIn,
    message: `This file may print soft or pixelated at this size. Try a smaller print (about ${recommendedWidthIn} × ${recommendedHeightIn} in or less for 300 DPI), or upload a larger original. Basic enhancement can improve appearance but cannot restore missing detail.`,
  };
}

export function chooseBasicEnhancementScale(width, height, maxOutputPixels = MAX_ENHANCED_PIXELS) {
  const pixels = positive(width) * positive(height);
  if (!pixels || pixels > maxOutputPixels) return 0;
  return Math.min(2, Math.sqrt(maxOutputPixels / pixels));
}

async function openLocalImage(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Unable to read this photo.'));
      image.src = objectUrl;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(objectUrl) };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/**
 * One modest interpolation + alpha-safe sharpening pass in the customer's browser.
 * It never sends photos to an external enhancement service.
 * Output resolution must not be treated as recovered source detail in print advice.
 */
export async function createBasicStudioEnhancement(file) {
  if (!file || !SUPPORTED_IMAGES.has(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  const opened = await openLocalImage(file);
  try {
    const scale = chooseBasicEnhancementScale(opened.width, opened.height);
    if (!scale) throw new Error('This image is already large. Please use the original to keep the best detail.');
    const width = Math.max(1, Math.round(opened.width * scale));
    const height = Math.max(1, Math.round(opened.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    if (!context) throw new Error('Image processing is unavailable on this device.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(opened.image, 0, 0, width, height);
    const frame = context.getImageData(0, 0, width, height);
    const source = frame.data;
    const result = new Uint8ClampedArray(source);
    // Conservative 4-neighbor sharpening avoids rewriting transparent edges.
    const stride = width * 4;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * stride + x * 4;
        if (source[i + 3] < 250 ||
            source[i - 1] < 240 || source[i + 7] < 240 ||
            source[i - stride + 3] < 240 || source[i + stride + 3] < 240) continue;
        for (let channel = 0; channel < 3; channel += 1) {
          const blurred = (source[i + channel] * 4 + source[i + channel - 4] +
            source[i + channel + 4] + source[i + channel - stride] +
            source[i + channel + stride]) / 8;
          result[i + channel] = Math.max(0, Math.min(255, source[i + channel] + (source[i + channel] - blurred) * 0.65));
        }
      }
    }
    frame.data.set(result);
    context.putImageData(frame, 0, 0);
    const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to create enhanced image.')), mimeType, 0.93));
    if (blob.size > MAX_ENHANCED_BYTES) throw new Error('The enhanced image is too large to upload. Keep the original image instead.');
    const baseName = String(file.name || 'image').replace(/\.[^.]+$/, '').slice(0, 90);
    const output = new File([blob], `${baseName}-basic-enhanced.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`, { type: mimeType });
    return { file: output, width, height, originalWidth: opened.width, originalHeight: opened.height, scale };
  } finally {
    opened.close();
  }
}
