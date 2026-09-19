const BOOTLEG_TEMPLATE_MIN_SCALE = 25;
const BOOTLEG_TEMPLATE_MAX_SCALE = 400;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function positiveScale(value, fallback = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, numeric);
}

async function loadImage(source, message) {
  const url = String(source || '').trim();
  if (!url) throw new Error(message);
  const response = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!response.ok) throw new Error(message);
  const blob = await response.blob();
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
  }
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = 'async';
  image.src = objectUrl;
  await new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', () => reject(new Error(message)), { once: true });
  });
  return { image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(objectUrl) };
}

function canvasPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the protected 300 DPI production PNG.')), 'image/png');
  });
}

function createCanvas(profile, dpi) {
  const safeDpi = Math.max(72, Math.min(600, Math.round(Number(dpi) || 300)));
  const widthPx = Math.max(1, Math.round(Number(profile.widthIn) * safeDpi));
  const heightPx = Math.max(1, Math.round(Number(profile.heightIn) * safeDpi));
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('This browser cannot build the protected production file.');
  context.clearRect(0, 0, widthPx, heightPx);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return { canvas, context, widthPx, heightPx, safeDpi };
}

function photoLayers(editor) {
  if (Array.isArray(editor?.photos) && editor.photos.length) return editor.photos.filter((layer) => layer?.asset?.url && layer.visible !== false);
  if (editor?.photo?.url) return [{ id: 'primary-photo', asset: editor.photo, transform: editor.transform || {}, order: 0, visible: true }];
  return [];
}

function clipZone(context, zone, widthPx, heightPx) {
  const x = Number(zone?.x || 0) / 100 * widthPx;
  const y = Number(zone?.y || 0) / 100 * heightPx;
  const width = Number(zone?.width || 100) / 100 * widthPx;
  const height = Number(zone?.height || 100) / 100 * heightPx;
  context.beginPath();
  if (zone?.shape === 'circle' || zone?.shape === 'oval') {
    context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (typeof context.roundRect === 'function' && zone?.shape === 'rounded') {
    context.roundRect(x, y, width, height, Math.min(width, height) * clamp(zone?.radius || 0, 0, 50) / 100);
  } else {
    context.rect(x, y, width, height);
  }
  context.clip();
  return { x, y, width, height };
}

function drawCover(context, loaded, rect, transform = {}) {
  const baseScale = Math.max(rect.width / Math.max(1, loaded.width), rect.height / Math.max(1, loaded.height));
  const userScale = clamp(transform.scale || 100, 30, 220) / 100;
  const drawWidth = loaded.width * baseScale * userScale;
  const drawHeight = loaded.height * baseScale * userScale;
  const centerX = rect.x + rect.width / 2 + clamp(transform.x || 0, -48, 48) / 100 * rect.width;
  const centerY = rect.y + rect.height / 2 + clamp(transform.y || 0, -48, 48) / 100 * rect.height;
  context.translate(centerX, centerY);
  context.rotate(clamp(transform.rotation || 0, -180, 180) * Math.PI / 180);
  context.drawImage(loaded.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
}

function drawTemplateArtwork(context, loaded, widthPx, heightPx, transform = {}) {
  const scale = clamp(transform.scale ?? 100, BOOTLEG_TEMPLATE_MIN_SCALE, BOOTLEG_TEMPLATE_MAX_SCALE) / 100;
  const centerX = widthPx * (0.5 + clamp(transform.x ?? 0, -50, 50) / 100);
  const centerY = heightPx * (0.5 + clamp(transform.y ?? 0, -50, 50) / 100);
  context.save();
  context.translate(centerX, centerY);
  context.rotate(clamp(transform.rotation ?? 0, -180, 180) * Math.PI / 180);
  context.drawImage(loaded.image, -widthPx * scale / 2, -heightPx * scale / 2, widthPx * scale, heightPx * scale);
  context.restore();
}

function textEffect(context, style, baseSize) {
  const effect = style.effect || 'shadow';
  const strength = clamp(style.effectStrength ?? 45, 0, 100) / 100;
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  if (effect === 'shadow') {
    context.shadowColor = 'rgba(0,0,0,.82)';
    context.shadowBlur = Math.max(2, baseSize * (0.08 + strength * 0.12));
    context.shadowOffsetX = baseSize * (0.04 + strength * 0.035);
    context.shadowOffsetY = baseSize * (0.05 + strength * 0.045);
  } else if (effect === 'glow') {
    context.shadowColor = style.color || '#ffffff';
    context.shadowBlur = Math.max(4, baseSize * (0.15 + strength * 0.3));
  }
}

function paintGlyph(context, glyph, x, y, style, maxWidth) {
  const bounded = Number.isFinite(Number(maxWidth)) && Number(maxWidth) > 0;
  if (style.effect === 'outline') {
    context.strokeStyle = '#111111';
    context.lineWidth = Math.max(2, Number(style.fontPx || 20) * 0.08);
    context.lineJoin = 'round';
    if (bounded) context.strokeText(glyph, x, y, Number(maxWidth));
    else context.strokeText(glyph, x, y);
  }
  if (bounded) context.fillText(glyph, x, y, Number(maxWidth));
  else context.fillText(glyph, x, y);
}

function resolveTextMetrics(zone, style, widthPx, heightPx, freeTextLayout = false) {
  const x = Number(zone?.x || 10) / 100 * widthPx;
  const y = Number(zone?.y || 78) / 100 * heightPx;
  const width = Number(zone?.width || 80) / 100 * widthPx;
  const height = Number(zone?.height || 18) / 100 * heightPx;
  const legacyOffsetX = clamp(style.x || 0, -42, 42) / 100 * width;
  const legacyOffsetY = clamp(style.y || 0, -42, 42) / 100 * height;
  const legacyCenterX = x + width / 2 + legacyOffsetX;
  const legacyCenterY = y + height / 2 + legacyOffsetY;
  const directX = Number(style.canvasX);
  const directY = Number(style.canvasY);
  const centerX = freeTextLayout && Number.isFinite(directX) ? clamp(directX, 0, 100) / 100 * widthPx : legacyCenterX;
  const centerY = freeTextLayout && Number.isFinite(directY) ? clamp(directY, 0, 100) / 100 * heightPx : legacyCenterY;
  const fontScale = freeTextLayout ? positiveScale(style.fontScale) : clamp(style.fontScale || 100, 55, 180);
  return { x, y, width, height, centerX, centerY, fontScale };
}

function drawArcText(context, text, zone, style, direction, widthPx, heightPx, freeTextLayout = false) {
  const metrics = resolveTextMetrics(zone, style, widthPx, heightPx, freeTextLayout);
  const fontSize = Math.max(12, metrics.height * 0.24 * metrics.fontScale / 100);
  const amount = clamp(style.curveAmount ?? 45, 0, 100) / 100;
  const span = (0.7 + amount * 1.15) * Math.PI;
  const radius = Math.max(metrics.width * 0.2, metrics.width / Math.max(0.8, span));
  const centerX = metrics.centerX;
  const baselineY = freeTextLayout ? metrics.centerY - metrics.height * 0.04 : metrics.y + metrics.height * 0.46 + clamp(style.y || 0, -42, 42) / 100 * metrics.height;
  const centerY = direction === 'up' ? baselineY + radius : baselineY - radius;
  const base = direction === 'up' ? -Math.PI / 2 : Math.PI / 2;
  const characters = [...text];
  context.save();
  context.font = `900 ${fontSize}px ${style.fontFamily || 'Arial, sans-serif'}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = style.color || '#ffffff';
  style.fontPx = fontSize;
  textEffect(context, style, fontSize);
  characters.forEach((character, index) => {
    const t = characters.length <= 1 ? 0.5 : index / (characters.length - 1);
    const angle = base - span / 2 + span * t;
    const px = centerX + Math.cos(angle) * radius;
    const py = centerY + Math.sin(angle) * radius;
    context.save();
    context.translate(px, py);
    context.rotate(direction === 'up' ? angle + Math.PI / 2 : angle - Math.PI / 2);
    paintGlyph(context, character, 0, 0, style, freeTextLayout ? undefined : fontSize * 1.5);
    context.restore();
  });
  context.restore();
}

function drawWaveText(context, text, zone, style, widthPx, heightPx, freeTextLayout = false) {
  const metrics = resolveTextMetrics(zone, style, widthPx, heightPx, freeTextLayout);
  const fontSize = Math.max(12, metrics.height * 0.24 * metrics.fontScale / 100);
  const chars = [...text];
  const amount = clamp(style.curveAmount ?? 45, 0, 100) / 100;
  const amplitude = metrics.height * (0.08 + amount * 0.2);
  const startX = freeTextLayout ? metrics.centerX - metrics.width * 0.42 : metrics.x + metrics.width * 0.08 + clamp(style.x || 0, -42, 42) / 100 * metrics.width;
  const baselineY = freeTextLayout ? metrics.centerY - metrics.height * 0.08 : metrics.y + metrics.height * 0.42 + clamp(style.y || 0, -42, 42) / 100 * metrics.height;
  context.save();
  context.font = `900 ${fontSize}px ${style.fontFamily || 'Arial, sans-serif'}`;
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = style.color || '#ffffff';
  style.fontPx = fontSize; textEffect(context, style, fontSize);
  chars.forEach((character, index) => {
    const t = chars.length <= 1 ? 0.5 : index / (chars.length - 1);
    const px = startX + t * metrics.width * 0.84;
    const phase = t * Math.PI * 2;
    const py = baselineY + Math.sin(phase) * amplitude;
    const slope = Math.cos(phase) * amplitude * Math.PI * 2 / Math.max(1, metrics.width * 0.84);
    context.save(); context.translate(px, py); context.rotate(Math.atan(slope)); paintGlyph(context, character, 0, 0, style, freeTextLayout ? undefined : fontSize * 1.4); context.restore();
  });
  context.restore();
}

function drawStyledText(context, text = {}, zone = {}, style = {}, widthPx, heightPx) {
  const headline = String(text.headline || '').trim().toUpperCase();
  const subline = String(text.subline || '').trim();
  const message = String(text.message || '').trim();
  if (!headline && !subline && !message) return;
  const freeTextLayout = style.freeTextLayout === true;
  const metrics = resolveTextMetrics(zone, style, widthPx, heightPx, freeTextLayout);

  if (headline && style.curve === 'arc-up') drawArcText(context, headline, zone, { ...style }, 'up', widthPx, heightPx, freeTextLayout);
  else if (headline && style.curve === 'arc-down') drawArcText(context, headline, zone, { ...style }, 'down', widthPx, heightPx, freeTextLayout);
  else if (headline && style.curve === 'wave') drawWaveText(context, headline, zone, { ...style }, widthPx, heightPx, freeTextLayout);
  else if (headline) {
    const headlineY = freeTextLayout ? metrics.centerY - metrics.height * 0.2 : metrics.y + metrics.height * 0.3 + clamp(style.y || 0, -42, 42) / 100 * metrics.height;
    const headlineX = freeTextLayout ? metrics.centerX : metrics.x + metrics.width / 2 + clamp(style.x || 0, -42, 42) / 100 * metrics.width;
    const size = Math.max(12, metrics.height * 0.24 * metrics.fontScale / 100);
    context.save();
    context.translate(headlineX, headlineY);
    context.rotate(clamp(style.rotation || 0, freeTextLayout ? -180 : -25, freeTextLayout ? 180 : 25) * Math.PI / 180);
    context.font = `900 ${size}px ${style.fontFamily || 'Arial, sans-serif'}`;
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = style.color || '#ffffff';
    style.fontPx = size; textEffect(context, style, size); paintGlyph(context, headline, 0, 0, style, freeTextLayout ? undefined : metrics.width * 0.96);
    context.restore();
  }

  context.save();
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = style.color || '#ffffff';
  if (subline) {
    const size = Math.max(10, metrics.height * 0.14 * metrics.fontScale / 100);
    const sublineX = freeTextLayout ? metrics.centerX : metrics.x + metrics.width / 2 + clamp(style.x || 0, -42, 42) / 100 * metrics.width;
    const sublineY = freeTextLayout ? metrics.centerY + metrics.height * 0.12 : metrics.y + metrics.height * 0.62 + clamp(style.y || 0, -42, 42) / 100 * metrics.height;
    context.font = `700 ${size}px ${style.fontFamily || 'Arial, sans-serif'}`; textEffect(context, style, size);
    if (freeTextLayout) context.fillText(subline, sublineX, sublineY);
    else context.fillText(subline, sublineX, sublineY, metrics.width * 0.95);
  }
  if (message) {
    const size = Math.max(9, metrics.height * 0.1 * metrics.fontScale / 100);
    const messageX = freeTextLayout ? metrics.centerX : metrics.x + metrics.width / 2 + clamp(style.x || 0, -42, 42) / 100 * metrics.width;
    const messageY = freeTextLayout ? metrics.centerY + metrics.height * 0.34 : metrics.y + metrics.height * 0.84 + clamp(style.y || 0, -42, 42) / 100 * metrics.height;
    context.font = `600 ${size}px ${style.fontFamily || 'Arial, sans-serif'}`; textEffect(context, style, size);
    if (freeTextLayout) context.fillText(message, messageX, messageY);
    else context.fillText(message, messageX, messageY, metrics.width * 0.92);
  }
  context.restore();
}

async function drawStickers(context, stickers, widthPx, heightPx) {
  const ordered = (stickers || []).filter((layer) => layer?.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  for (const layer of ordered) {
    const transform = layer.transform || {};
    const size = clamp(transform.scale || 42, 12, 85) / 100 * widthPx;
    const centerX = widthPx * (0.5 + clamp(transform.x || 0, -48, 48) / 100);
    const centerY = heightPx * (0.5 + clamp(transform.y || 0, -48, 48) / 100);
    context.save();
    context.translate(centerX, centerY);
    context.rotate(clamp(transform.rotation || 0, -180, 180) * Math.PI / 180);
    if (layer.assetUrl) {
      const loaded = await loadImage(layer.assetUrl, 'A sticker asset could not be reopened.');
      try {
        const scale = Math.min(size / Math.max(1, loaded.width), size / Math.max(1, loaded.height));
        const width = loaded.width * scale; const height = loaded.height * scale;
        context.drawImage(loaded.image, -width / 2, -height / 2, width, height);
      } finally { loaded.close(); }
    } else {
      context.font = `${Math.max(18, size * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#ffffff';
      context.fillText(layer.glyph || '✦', 0, 0, size);
    }
    context.restore();
  }
}

export async function renderProtectedStudioV2PngAdvanced({ product, size, side, editor, template, profile, dpi = 300 }) {
  if (!template?.assetUrl) throw new Error('The locked GDP template is unavailable.');
  const photos = photoLayers(editor).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  if (!photos.length) throw new Error('The customer photo is unavailable.');
  const resolvedProfile = profile(product, size, side);
  const output = createCanvas(resolvedProfile, dpi);

  for (const layer of photos) {
    const loaded = await loadImage(layer.asset?.url, 'A customer photo layer could not be reopened.');
    try {
      output.context.save();
      const rect = clipZone(output.context, template.photoZone || {}, output.widthPx, output.heightPx);
      drawCover(output.context, loaded, rect, layer.transform || {});
      output.context.restore();
    } finally { loaded.close(); }
  }

  const lockedArtwork = await loadImage(template.assetUrl, 'The locked GDP template could not be reopened.');
  try { drawTemplateArtwork(output.context, lockedArtwork, output.widthPx, output.heightPx, editor.textStyle?.templateTransform || {}); }
  finally { lockedArtwork.close(); }

  drawStyledText(output.context, editor.text || {}, template.textZone || {}, editor.textStyle || {}, output.widthPx, output.heightPx);
  await drawStickers(output.context, editor.stickers || [], output.widthPx, output.heightPx);

  return {
    blob: await canvasPng(output.canvas),
    widthPx: output.widthPx,
    heightPx: output.heightPx,
    widthIn: resolvedProfile.widthIn,
    heightIn: resolvedProfile.heightIn,
    dpi: output.safeDpi,
    mimeType: 'image/png',
    profile: resolvedProfile,
  };
}
