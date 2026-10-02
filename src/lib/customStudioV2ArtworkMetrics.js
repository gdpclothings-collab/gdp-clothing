const LEGACY_BOX_RATIO = 0.72;
const SAFE_TOLERANCE_IN = 0.03;
const TRUSTED_PHYSICAL_DPI_MIN = 150;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function readAscii(view, offset, length) {
  if (offset < 0 || offset + length > view.byteLength) return '';
  let text = '';
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(view.getUint8(offset + index));
  return text;
}

function normalizeDpi(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 30 && number <= 1200 ? number : 0;
}

function parsePngDensity(view) {
  if (view.byteLength < 33 || readAscii(view, 1, 3) !== 'PNG') return null;
  let offset = 8;
  while (offset + 12 <= view.byteLength) {
    const length = view.getUint32(offset, false);
    const type = readAscii(view, offset + 4, 4);
    const dataOffset = offset + 8;
    if (type === 'pHYs' && length >= 9 && dataOffset + 9 <= view.byteLength) {
      const unit = view.getUint8(dataOffset + 8);
      if (unit !== 1) return null;
      const dpiX = normalizeDpi(view.getUint32(dataOffset, false) * 0.0254);
      const dpiY = normalizeDpi(view.getUint32(dataOffset + 4, false) * 0.0254);
      if (dpiX && dpiY) return { dpiX, dpiY, source: 'png-pHYs' };
      return null;
    }
    if (type === 'IDAT' || type === 'IEND') break;
    offset = dataOffset + length + 4;
  }
  return null;
}

function tiffValue(view, tiffOffset, littleEndian, type, count, rawOffset, segmentEnd) {
  const typeSizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };
  const byteLength = (typeSizes[type] || 0) * count;
  if (!byteLength) return null;
  const valueOffset = byteLength <= 4 ? rawOffset : tiffOffset + view.getUint32(rawOffset, littleEndian);
  if (valueOffset < tiffOffset || valueOffset + byteLength > segmentEnd) return null;
  if (type === 3 && count >= 1) return view.getUint16(valueOffset, littleEndian);
  if (type === 4 && count >= 1) return view.getUint32(valueOffset, littleEndian);
  if (type === 5 && count >= 1) {
    const numerator = view.getUint32(valueOffset, littleEndian);
    const denominator = view.getUint32(valueOffset + 4, littleEndian);
    return denominator ? numerator / denominator : null;
  }
  return null;
}

function parseTiffDensity(view, tiffOffset, segmentEnd = view.byteLength) {
  if (tiffOffset < 0 || tiffOffset + 8 > segmentEnd) return null;
  const endian = readAscii(view, tiffOffset, 2);
  const littleEndian = endian === 'II';
  if (!littleEndian && endian !== 'MM') return null;
  if (view.getUint16(tiffOffset + 2, littleEndian) !== 42) return null;
  const ifdOffset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
  if (ifdOffset < tiffOffset || ifdOffset + 2 > segmentEnd) return null;
  const count = view.getUint16(ifdOffset, littleEndian);
  let dpiX = 0;
  let dpiY = 0;
  let unit = 2;
  for (let index = 0; index < count; index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    if (entry + 12 > segmentEnd) break;
    const tag = view.getUint16(entry, littleEndian);
    if (![0x011a, 0x011b, 0x0128].includes(tag)) continue;
    const type = view.getUint16(entry + 2, littleEndian);
    const valueCount = view.getUint32(entry + 4, littleEndian);
    const value = tiffValue(view, tiffOffset, littleEndian, type, valueCount, entry + 8, segmentEnd);
    if (tag === 0x011a) dpiX = Number(value || 0);
    if (tag === 0x011b) dpiY = Number(value || 0);
    if (tag === 0x0128) unit = Number(value || 2);
  }
  if (unit === 3) {
    dpiX *= 2.54;
    dpiY *= 2.54;
  }
  dpiX = normalizeDpi(dpiX);
  dpiY = normalizeDpi(dpiY);
  if (!dpiX && dpiY) dpiX = dpiY;
  if (!dpiY && dpiX) dpiY = dpiX;
  return dpiX && dpiY ? { dpiX, dpiY, source: 'exif' } : null;
}

function parseJpegDensity(view) {
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;
  let offset = 2;
  let jfif = null;
  let exif = null;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) { offset += 1; continue; }
    const marker = view.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > view.byteLength) break;
    const length = view.getUint16(offset, false);
    if (length < 2 || offset + length > view.byteLength) break;
    const dataOffset = offset + 2;
    const dataEnd = offset + length;
    if (marker === 0xe0 && length >= 16 && readAscii(view, dataOffset, 5) === 'JFIF\0') {
      const units = view.getUint8(dataOffset + 7);
      let dpiX = view.getUint16(dataOffset + 8, false);
      let dpiY = view.getUint16(dataOffset + 10, false);
      if (units === 2) { dpiX *= 2.54; dpiY *= 2.54; }
      if (units === 1 || units === 2) {
        dpiX = normalizeDpi(dpiX);
        dpiY = normalizeDpi(dpiY);
        if (dpiX && dpiY) jfif = { dpiX, dpiY, source: 'jpeg-jfif' };
      }
    }
    if (marker === 0xe1 && length >= 14 && readAscii(view, dataOffset, 6) === 'Exif\0\0') {
      exif = parseTiffDensity(view, dataOffset + 6, dataEnd) || exif;
    }
    offset += length;
  }
  return exif || jfif;
}

function parseWebpDensity(view) {
  if (view.byteLength < 16 || readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WEBP') return null;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const type = readAscii(view, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    const dataEnd = Math.min(view.byteLength, dataOffset + length);
    if (type === 'EXIF') {
      const prefix = readAscii(view, dataOffset, 6);
      const tiffOffset = prefix === 'Exif\0\0' ? dataOffset + 6 : dataOffset;
      return parseTiffDensity(view, tiffOffset, dataEnd);
    }
    offset = dataOffset + length + (length % 2);
  }
  return null;
}

export function readEmbeddedArtworkDensity(arrayBuffer, mimeType = '') {
  const view = new DataView(arrayBuffer);
  const type = String(mimeType || '').toLowerCase();
  if (type.includes('png') || readAscii(view, 1, 3) === 'PNG') return parsePngDensity(view);
  if (type.includes('jpeg') || type.includes('jpg') || (view.byteLength >= 2 && view.getUint16(0, false) === 0xffd8)) return parseJpegDensity(view);
  if (type.includes('webp') || readAscii(view, 8, 4) === 'WEBP') return parseWebpDensity(view);
  return null;
}

async function imageDimensionsAndContentBounds(file) {
  let image = null;
  let objectUrl = '';
  let pixelWidth = 1;
  let pixelHeight = 1;
  let closeImage = () => {};
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      image = bitmap;
      pixelWidth = Math.max(1, Number(bitmap.width || 1));
      pixelHeight = Math.max(1, Number(bitmap.height || 1));
      closeImage = () => bitmap.close();
    } else {
      objectUrl = URL.createObjectURL(file);
      const htmlImage = new Image();
      htmlImage.decoding = 'async';
      htmlImage.src = objectUrl;
      await new Promise((resolve, reject) => {
        htmlImage.addEventListener('load', resolve, { once: true });
        htmlImage.addEventListener('error', () => reject(new Error('Artwork image could not be read.')), { once: true });
      });
      image = htmlImage;
      pixelWidth = Math.max(1, Number(htmlImage.naturalWidth || 1));
      pixelHeight = Math.max(1, Number(htmlImage.naturalHeight || 1));
    }
    const maxSample = 1024;
    const sampleScale = Math.min(1, maxSample / Math.max(pixelWidth, pixelHeight));
    const sampleWidth = Math.max(1, Math.round(pixelWidth * sampleScale));
    const sampleHeight = Math.max(1, Math.round(pixelHeight * sampleScale));
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!context) return { pixelWidth, pixelHeight, contentBounds: { left: 0, top: 0, right: 1, bottom: 1 } };
    context.clearRect(0, 0, sampleWidth, sampleHeight);
    context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let minX = sampleWidth;
    let minY = sampleHeight;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        if (pixels[(y * sampleWidth + x) * 4 + 3] <= 8) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    const contentBounds = maxX < minX || maxY < minY
      ? { left: 0, top: 0, right: 1, bottom: 1 }
      : {
          left: clamp(minX / sampleWidth, 0, 1),
          top: clamp(minY / sampleHeight, 0, 1),
          right: clamp((maxX + 1) / sampleWidth, 0, 1),
          bottom: clamp((maxY + 1) / sampleHeight, 0, 1),
        };
    return { pixelWidth, pixelHeight, contentBounds };
  } finally {
    closeImage();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function analyzeStudioV2ArtworkFile(file) {
  const [{ pixelWidth, pixelHeight, contentBounds }, buffer] = await Promise.all([
    imageDimensionsAndContentBounds(file),
    file.arrayBuffer(),
  ]);
  const density = readEmbeddedArtworkDensity(buffer, file.type);
  const dpiX = normalizeDpi(density?.dpiX);
  const dpiY = normalizeDpi(density?.dpiY);
  const hasPhysicalSize = Boolean(dpiX && dpiY);
  return {
    pixelWidth,
    pixelHeight,
    sourceDpiX: dpiX ? round(dpiX, 1) : 0,
    sourceDpiY: dpiY ? round(dpiY, 1) : 0,
    sourceDpi: dpiX && dpiY ? round(Math.min(dpiX, dpiY), 1) : 0,
    sourceWidthIn: hasPhysicalSize ? round(pixelWidth / dpiX, 4) : 0,
    sourceHeightIn: hasPhysicalSize ? round(pixelHeight / dpiY, 4) : 0,
    physicalSizeSource: hasPhysicalSize ? (density?.source || 'embedded') : 'not-embedded',
    contentBounds,
  };
}

function normalizedContentBounds(artwork) {
  const bounds = artwork?.contentBounds || {};
  const left = clamp(bounds.left ?? 0, 0, 1);
  const top = clamp(bounds.top ?? 0, 0, 1);
  const right = clamp(bounds.right ?? 1, left, 1);
  const bottom = clamp(bounds.bottom ?? 1, top, 1);
  return { left, top, right, bottom };
}

function containedBaseSize(artwork, profile, ratio = 1) {
  const pixelWidth = finitePositive(artwork?.pixelWidth) || 1;
  const pixelHeight = finitePositive(artwork?.pixelHeight) || 1;
  const boxWidth = finitePositive(profile?.widthIn) * ratio;
  const boxHeight = finitePositive(profile?.heightIn) * ratio;
  const containScale = Math.min(boxWidth / pixelWidth, boxHeight / pixelHeight);
  return { widthIn: pixelWidth * containScale, heightIn: pixelHeight * containScale };
}

function legacyBaseSize(artwork, profile) {
  return containedBaseSize(artwork, profile, LEGACY_BOX_RATIO);
}

function lowConfidenceDpiBaseSize(artwork, profile) {
  return containedBaseSize(artwork, profile, 1);
}

export function resolveUploadArtworkPlacement(artwork, profile, transform = {}) {
  const profileWidth = Math.max(0.01, finitePositive(profile?.widthIn));
  const profileHeight = Math.max(0.01, finitePositive(profile?.heightIn));
  const physicalWidth = finitePositive(artwork?.sourceWidthIn);
  const physicalHeight = finitePositive(artwork?.sourceHeightIn);
  const sourceDpi = finitePositive(artwork?.sourceDpi);
  const embeddedPhysicalSize = Boolean(physicalWidth && physicalHeight);
  const lowConfidenceEmbeddedDpi = Boolean(sourceDpi && sourceDpi < TRUSTED_PHYSICAL_DPI_MIN);
  const trustedPhysicalSize = embeddedPhysicalSize && !lowConfidenceEmbeddedDpi;
  const base = trustedPhysicalSize
    ? { widthIn: physicalWidth, heightIn: physicalHeight, source: 'embedded-physical-size' }
    : lowConfidenceEmbeddedDpi
      ? { ...lowConfidenceDpiBaseSize(artwork, profile), source: 'low-confidence-dpi-fit' }
      : { ...legacyBaseSize(artwork, profile), source: 'legacy-fit' };
  const scale = clamp(transform?.scale ?? 100, 30, 180) / 100;
  const widthIn = base.widthIn * scale;
  const heightIn = base.heightIn * scale;
  const centerXIn = profileWidth / 2 + clamp(transform?.x ?? 0, -42, 42) / 100 * profileWidth * LEGACY_BOX_RATIO;
  const centerYIn = profileHeight / 2 + clamp(transform?.y ?? 0, -42, 42) / 100 * profileHeight * LEGACY_BOX_RATIO;
  const radians = clamp(transform?.rotation ?? 0, -180, 180) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const bounds = normalizedContentBounds(artwork);
  const localCorners = [
    [(bounds.left - 0.5) * widthIn, (bounds.top - 0.5) * heightIn],
    [(bounds.right - 0.5) * widthIn, (bounds.top - 0.5) * heightIn],
    [(bounds.right - 0.5) * widthIn, (bounds.bottom - 0.5) * heightIn],
    [(bounds.left - 0.5) * widthIn, (bounds.bottom - 0.5) * heightIn],
  ];
  const corners = localCorners.map(([x, y]) => ({
    x: centerXIn + x * cos - y * sin,
    y: centerYIn + x * sin + y * cos,
  }));
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  const overflow = {
    left: Math.max(0, -minX),
    right: Math.max(0, maxX - profileWidth),
    top: Math.max(0, -minY),
    bottom: Math.max(0, maxY - profileHeight),
  };
  const outsideRecommendedArea = Object.values(overflow).some((value) => value > SAFE_TOLERANCE_IN);
  const pixelWidth = finitePositive(artwork?.pixelWidth);
  const pixelHeight = finitePositive(artwork?.pixelHeight);
  const effectiveDpiX = pixelWidth && widthIn ? pixelWidth / widthIn : 0;
  const effectiveDpiY = pixelHeight && heightIn ? pixelHeight / heightIn : 0;
  const effectiveDpi = effectiveDpiX && effectiveDpiY ? Math.min(effectiveDpiX, effectiveDpiY) : 0;
  return {
    baseWidthIn: base.widthIn,
    baseHeightIn: base.heightIn,
    sizeSource: base.source,
    widthIn,
    heightIn,
    centerXIn,
    centerYIn,
    widthPercent: base.widthIn / profileWidth * 100,
    heightPercent: base.heightIn / profileHeight * 100,
    centerXPercent: centerXIn / profileWidth * 100,
    centerYPercent: centerYIn / profileHeight * 100,
    effectiveDpi: effectiveDpi ? round(effectiveDpi, 1) : 0,
    outsideRecommendedArea,
    overflow,
    printableBounds: { minX, maxX, minY, maxY },
  };
}

export function studioV2ArtworkQuality(effectiveDpi) {
  const dpi = finitePositive(effectiveDpi);
  if (!dpi) return { label: 'Unknown', tone: 'slate' };
  if (dpi >= 300) return { label: 'Excellent', tone: 'emerald' };
  if (dpi >= 200) return { label: 'Acceptable', tone: 'amber' };
  return { label: 'Low resolution', tone: 'red' };
}

export function formatArtworkInches(value) {
  const number = round(value, 2);
  return Number.isInteger(number) ? String(number) : String(number).replace(/0$/, '');
}

export function describeArtworkOverflow(overflow = {}) {
  const entries = [
    ['left', overflow.left],
    ['right', overflow.right],
    ['top', overflow.top],
    ['bottom', overflow.bottom],
  ].filter(([, value]) => finitePositive(value) > SAFE_TOLERANCE_IN);
  if (!entries.length) return '';
  return entries.map(([edge, value]) => `${formatArtworkInches(value)} in past the ${edge} edge`).join(', ');
}
