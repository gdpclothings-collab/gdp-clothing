/**
 * GDP's premium lettering is a pure, versioned style recipe. The same Canvas
 * painter is used for the interactive preview and the 300-DPI production file.
 * No text is flattened into a customer draft; only the preset id is stored.
 */
// Read from the supplied "storm edit.psd" (STORM text layer and the visible
// Sunset Skintones gradient-map adjustment), rather than sampled from a JPEG.
// Photoshop stores both gradients on a 0–4096 scale. The metallic gray ramp
// runs bottom-to-top (90 degrees); the adjustment maps each gray to its color.
/** @type {[number, number][]} */
const STORM_METALLIC_GRAY_STOPS = [
  [0, 98], [467, 102], [1013, 138], [1358, 137], [1870, 165],
  [2237, 211], [2705, 234], [3105, 212], [3406, 226],
  [3762, 255], [4074, 183],
];
/** @type {[number, [number, number, number]][]} */
const STORM_SUNSET_MAP_STOPS = [
  [614, [0, 0, 0]], [1434, [188, 77, 102]],
  [2867, [247, 231, 94]], [4096, [255, 255, 255]],
];

function interpolateStormSunset(gray) {
  const coordinate = gray / 255 * 4096;
  const upperIndex = STORM_SUNSET_MAP_STOPS.findIndex(([position]) => position >= coordinate);
  const end = Math.max(1, upperIndex < 0 ? STORM_SUNSET_MAP_STOPS.length - 1 : upperIndex);
  const [startPosition, startColor] = STORM_SUNSET_MAP_STOPS[end - 1];
  const [endPosition, endColor] = STORM_SUNSET_MAP_STOPS[end];
  const t = Math.max(0, Math.min(1, (coordinate - startPosition) / (endPosition - startPosition)));
  return `#${startColor.map((channel, index) => Math.round(channel + (endColor[index] - channel) * t).toString(16).padStart(2, '0')).join('')}`;
}

const STORM_SUNSET_TEXTURE = [...STORM_METALLIC_GRAY_STOPS].reverse().map(([position, gray]) => ({
  position: 1 - position / 4096,
  color: interpolateStormSunset(gray),
}));

export const PREMIUM_TEXT_STYLES = [
  // STORM is Georgia Regular. Photoshop's 25px white and 10px black outer
  // strokes, 49px stroke emboss, 41px inner shadow and 80px satin are
  // approximated in scalable Canvas operations; no flattened text assets.
  { id: 'gold-chrome', label: 'Sunset Gold Chrome', family: 'Georgia, serif', fontWeight: 400, finish: 'sunset-emboss', stops: STORM_SUNSET_TEXTURE.map(({ color }) => color), positions: STORM_SUNSET_TEXTURE.map(({ position }) => position), accentIndex: 5, outline: '#000000', rim: '#c25c65', depth: '#4e112d', shine: '#ffffff', stroke: 0.035, extrusion: 0 },
  { id: 'silver-chrome', label: 'Silver Chrome', family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", stops: ['#ffffff', '#cce3f1', '#546e88', '#f4fcff', '#53627b'], outline: '#283d56', depth: '#263348', shine: '#ffffff', stroke: 0.07, extrusion: 0.065 },
  { id: 'neon-glow', label: 'Neon Glow', family: "'Arial Black', Arial, sans-serif", stops: ['#ffffff', '#f9abff', '#e02cff'], outline: '#710d98', glow: '#ed37ff', shine: '#ffffff', stroke: 0.065, extrusion: 0 },
  { id: 'retro-3d', label: 'Retro 3D', family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", stops: ['#ffef9a', '#ffab4b', '#f25d45'], outline: '#8c294f', depth: '#64308c', shine: '#fff5b9', stroke: 0.075, extrusion: 0.18 },
  { id: 'rose-gold', label: 'Rose Gold', family: "'Arial Black', Arial, sans-serif", stops: ['#fff4eb', '#f5afaf', '#aa5271', '#ffd5c9'], outline: '#733951', depth: '#56283b', shine: '#fffdfa', stroke: 0.055, extrusion: 0.07 },
  { id: 'ice-blue', label: 'Ice Blue', family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", stops: ['#ffffff', '#baf8ff', '#2c9bce', '#e9ffff'], outline: '#105275', depth: '#093d6b', shine: '#ffffff', stroke: 0.06, extrusion: 0.07 },
  { id: 'flame', label: 'Fire & Flame', family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", stops: ['#fff9bb', '#ffdd3e', '#fd651b', '#9e1525'], outline: '#551322', depth: '#4a1426', shine: '#fff9d0', stroke: 0.065, extrusion: 0.065 },
  { id: 'holographic', label: 'Holographic', family: "'Arial Black', Arial, sans-serif", stops: ['#bafaff', '#ffc7ff', '#7cf4bb', '#9eb7ff', '#ffb9da'], outline: '#68559e', depth: '#33487c', shine: '#ffffff', stroke: 0.065, extrusion: 0.055 },
  { id: 'royal-purple', label: 'Royal Purple', family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", stops: ['#f8e7ff', '#bd8dff', '#5e2bb3', '#a879f3'], outline: '#301364', depth: '#250c49', shine: '#ffffff', stroke: 0.07, extrusion: 0.11 },
  { id: 'emerald-metal', label: 'Emerald Metal', family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", stops: ['#edfff3', '#9dedb8', '#067e65', '#a5ffcc'], outline: '#064f4a', depth: '#09382d', shine: '#ffffff', stroke: 0.07, extrusion: 0.08 },
];

const PRESETS_BY_ID = Object.fromEntries(PREMIUM_TEXT_STYLES.map((preset) => [preset.id, preset]));
export function premiumTextPreset(id) { return PRESETS_BY_ID[String(id || '')] || null; }

export function normalizePremiumTextPresets(config = []) {
  const overrides = Array.isArray(config) ? config : Object.entries(config || {}).map(([id, settings]) => ({ id, ...settings }));
  const controls = Object.fromEntries(overrides.filter((entry) => entry && PRESETS_BY_ID[entry.id]).map((entry) => [entry.id, entry]));
  return PREMIUM_TEXT_STYLES.map((preset, index) => ({ ...preset, enabled: controls[preset.id]?.enabled !== false, order: Number.isFinite(Number(controls[preset.id]?.order)) ? Number(controls[preset.id].order) : index }))
    .sort((a, b) => a.order - b.order || PREMIUM_TEXT_STYLES.findIndex((preset) => preset.id === a.id) - PREMIUM_TEXT_STYLES.findIndex((preset) => preset.id === b.id));
}

export function applyPremiumTextPreset(style = {}, id) {
  const preset = premiumTextPreset(id);
  if (!preset) return { ...style, premiumTextPresetId: '' };
  // Keep the customer's words, selected layer, coordinates, size and rotation.
  const accent = preset.stops[preset.accentIndex ?? 1];
  return { ...style, premiumTextPresetId: preset.id, fontFamily: preset.family, curve: 'straight', color: accent, premiumAccentColor: accent, premiumOutlineColor: preset.outline, premiumDepthScale: 100 };
}

export function premiumTextEffectPadding(style, fontSize) {
  const preset = premiumTextPreset(style?.premiumTextPresetId);
  if (!preset) return fontSize * 0.08;
  if (preset.finish === 'sunset-emboss') return fontSize * 0.1;
  return fontSize * (0.12 + preset.stroke + preset.extrusion * Math.min(2, Math.max(0, Number(style?.premiumDepthScale ?? 100) / 100)) + (preset.glow ? 0.22 : 0));
}

/** Paint in print-canvas coordinate space. Caller sets font and transform. */
export function paintPremiumTextGlyph(ctx, value, x, y, fontSize, style, maxWidth) {
  const preset = premiumTextPreset(style?.premiumTextPresetId);
  if (!preset) return false;
  const text = String(value || '');
  if (!text) return true;
  const size = Math.max(1, Number(fontSize) || 1);
  const width = Number.isFinite(Number(maxWidth)) && Number(maxWidth) > 0 ? Number(maxWidth) : undefined;
  const fill = (px, py) => width ? ctx.fillText(text, px, py, width) : ctx.fillText(text, px, py);
  const stroke = (px, py) => width ? ctx.strokeText(text, px, py, width) : ctx.strokeText(text, px, py);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const depth = Math.max(0, size * preset.extrusion * Math.min(2, Math.max(0, Number(style?.premiumDepthScale ?? 100) / 100)));
  if (preset.finish !== 'sunset-emboss') {
    ctx.fillStyle = preset.depth || preset.outline;
    ctx.strokeStyle = preset.depth || preset.outline;
    ctx.lineWidth = size * preset.stroke * 1.25;
    for (let step = depth, count = 0; step >= 1 && count < 16; step -= Math.max(1, depth / 16), count += 1) {
      stroke(x + step * 0.65, y + step);
      fill(x + step * 0.65, y + step);
    }
    ctx.shadowColor = preset.glow || 'rgba(0,0,0,.72)';
    ctx.shadowBlur = size * (preset.glow ? 0.19 : 0.055);
    ctx.shadowOffsetX = preset.glow ? 0 : size * 0.028;
    ctx.shadowOffsetY = preset.glow ? 0 : size * 0.045;
  }
  if (preset.finish === 'sunset-emboss') {
    // Both PSD stroke effects are OUTSIDE: 25px white and 10px black. The
    // source uses a vertical scale of 4.67 on Georgia 398.135pt, giving an
    // effective font height of ~1859 PSD pixels. Ratio keeps print parity.
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.6, size * (2 * 25 / (398.13495 * 4.67)));
    stroke(x, y);
    ctx.strokeStyle = style?.premiumOutlineColor || preset.outline;
    ctx.lineWidth = Math.max(0.4, size * (2 * 10 / (398.13495 * 4.67)));
    stroke(x, y);
  } else {
    ctx.strokeStyle = style?.premiumOutlineColor || preset.outline;
    ctx.lineWidth = Math.max(1, size * preset.stroke);
    stroke(x, y);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  // Photoshop's mapped metallic bands must reach the actual top and bottom of
  // the editable glyphs. Text faces do not occupy an entire CSS font em.
  // Pixel-space Canvas metrics scale identically at preview and production DPI.
  const glyphMetrics = preset.finish === 'sunset-emboss' ? ctx.measureText?.(text) : null;
  const ascent = Number(glyphMetrics?.actualBoundingBoxAscent);
  const descent = Number(glyphMetrics?.actualBoundingBoxDescent);
  const hasGlyphMetrics = Number.isFinite(ascent) && Number.isFinite(descent) && ascent + descent > size * 0.2;
  const glyphTop = hasGlyphMetrics ? y - ascent : y - size * 0.38;
  const glyphBottom = hasGlyphMetrics ? y + descent : y + size * 0.38;
  const gradient = ctx.createLinearGradient(0, preset.finish === 'sunset-emboss' ? glyphTop : y - size * 0.57, 0, preset.finish === 'sunset-emboss' ? glyphBottom : y + size * 0.57);
  preset.stops.forEach((color, index) => gradient.addColorStop(preset.positions?.[index] ?? index / (preset.stops.length - 1), index === (preset.accentIndex ?? 1) ? (style?.premiumAccentColor || color) : color));
  ctx.fillStyle = gradient;
  fill(x, y);
  if (preset.finish === 'sunset-emboss') {
    // PSD: Bevel/Emboss (stroke emboss, 32% depth, 49px), 50% black inner
    // shadow and 26% Overlay satin. Canvas provides a scalable approximation
    // on arbitrary editable glyphs, not Photoshop's pixel-perfect filters.
    const emboss = Math.min(2, Math.max(0, Number(style?.premiumDepthScale ?? 100) / 100));
    ctx.globalAlpha = 0.62 * emboss;
    ctx.strokeStyle = '#fff8ce';
    ctx.lineWidth = Math.max(0.35, size * 0.012);
    stroke(x - size * 0.005, y - size * 0.014);
    ctx.globalAlpha = 0.46 * emboss;
    ctx.strokeStyle = '#641333';
    ctx.lineWidth = Math.max(0.3, size * 0.012);
    stroke(x + size * 0.005, y + size * 0.018);
    ctx.globalAlpha = 0.4 * emboss;
    ctx.strokeStyle = '#ed9290';
    ctx.lineWidth = Math.max(0.3, size * 0.009);
    stroke(x, y + size * 0.009);
  }
  if (preset.finish !== 'sunset-emboss') {
    // A fine highlight conveys a bevel without rasterizing the text.
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = preset.shine;
    ctx.lineWidth = Math.max(0.6, size * 0.012);
    ctx.shadowColor = 'transparent';
    stroke(x, y - size * 0.012);
  }
  ctx.restore();
  return true;
}

/** The shared painting order/geometry used at preview and print resolutions. */
export function paintPremiumTextLayout(ctx, layout, style) {
  if (!premiumTextPreset(style?.premiumTextPresetId) || !layout) return false;
  ctx.save();
  if (layout.horizontalFit < 1) {
    ctx.translate(layout.centerX, 0);
    ctx.scale(layout.horizontalFit, 1);
    ctx.translate(-layout.centerX, 0);
  }
  const preset = premiumTextPreset(style.premiumTextPresetId);
  const draw = (item, weight = 900) => {
    if (!item) return;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Number(item.rotation || 0) * Math.PI / 180);
    ctx.font = `${preset.fontWeight || weight} ${item.fontSize}px ${style.fontFamily || preset.family}`;
    paintPremiumTextGlyph(ctx, item.text, 0, 0, item.fontSize, style);
    ctx.restore();
  };
  if (layout.headline?.kind === 'straight') draw(layout.headline, 900);
  if (layout.headline?.kind === 'glyphs') layout.headline.glyphs.forEach((glyph) => draw({ ...glyph, text: glyph.character }, 900));
  draw(layout.subline, 700);
  draw(layout.message, 600);
  ctx.restore();
  return true;
}
