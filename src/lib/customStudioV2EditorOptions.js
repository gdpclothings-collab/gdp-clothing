export const V2_FONT_PRESETS = [
  { id: 'impact', label: 'Impact', family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" },
  { id: 'arial-black', label: 'Arial Black', family: "'Arial Black', Arial, sans-serif" },
  { id: 'trebuchet', label: 'Trebuchet', family: "'Trebuchet MS', sans-serif" },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif' },
  { id: 'times', label: 'Times', family: "'Times New Roman', serif" },
  { id: 'courier', label: 'Courier', family: "'Courier New', monospace" },
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
];

export const V2_TEXT_CURVES = [
  { id: 'straight', label: 'Straight' },
  { id: 'arc-up', label: 'Arc Up' },
  { id: 'arc-down', label: 'Arc Down' },
  { id: 'wave', label: 'Wave' },
];

export const V2_TEXT_EFFECTS = [
  { id: 'none', label: 'None' },
  { id: 'outline', label: 'Outline' },
  { id: 'shadow', label: 'Shadow' },
  { id: 'glow', label: 'Glow' },
];

export const V2_DEFAULT_STICKERS = [
  { id: 'star', label: 'Star', glyph: '★', category: 'shapes', enabled: true },
  { id: 'sparkle', label: 'Sparkle', glyph: '✦', category: 'effects', enabled: true },
  { id: 'cross', label: 'Cross', glyph: '✝', category: 'symbols', enabled: true },
  { id: 'flame', label: 'Flame', glyph: '🔥', category: 'effects', enabled: true },
  { id: 'halo', label: 'Halo', glyph: '◯', category: 'symbols', enabled: true },
  { id: 'heart', label: 'Heart', glyph: '♥', category: 'symbols', enabled: true },
  { id: 'lightning', label: 'Lightning', glyph: '⚡', category: 'effects', enabled: true },
  { id: 'dove', label: 'Dove', glyph: '🕊', category: 'memorial', enabled: true },
];

export function v2LayerId(prefix = 'layer') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeV2StickerLibrary(value = []) {
  const custom = Array.isArray(value) ? value.filter(Boolean) : [];
  const customById = Object.fromEntries(custom.map((item) => [String(item.id || ''), item]));
  const builtIns = V2_DEFAULT_STICKERS.map((base) => ({
    ...base,
    ...(customById[base.id] || {}),
    id: base.id,
    label: String(customById[base.id]?.label || base.label),
    glyph: String(customById[base.id]?.glyph || base.glyph),
    assetUrl: String(customById[base.id]?.assetUrl || ''),
    enabled: customById[base.id]?.enabled !== false,
  }));
  const extra = custom
    .filter((item) => item.id && !V2_DEFAULT_STICKERS.some((base) => base.id === item.id))
    .map((item) => ({
      id: String(item.id),
      label: String(item.label || 'Custom sticker'),
      glyph: String(item.glyph || '✦'),
      assetUrl: String(item.assetUrl || ''),
      category: String(item.category || 'custom'),
      enabled: item.enabled !== false,
    }));
  return [...builtIns, ...extra].filter((item) => item.enabled !== false);
}

export function createV2PhotoLayer(asset, index = 0, defaults = {}) {
  return {
    id: v2LayerId('photo'),
    type: 'photo',
    asset: { ...asset },
    transform: {
      scale: Number(defaults.scale ?? (index === 0 ? 100 : 68)),
      rotation: Number(defaults.rotation || 0),
      x: Number(defaults.x ?? ((index % 3) - 1) * 12),
      y: Number(defaults.y ?? ((index % 2) ? 8 : -6)),
    },
    order: Number(defaults.order ?? index),
    visible: true,
  };
}

export function createV2StickerLayer(sticker, index = 0) {
  return {
    id: v2LayerId('sticker'),
    type: 'sticker',
    stickerId: sticker?.id || 'sparkle',
    label: sticker?.label || 'Sticker',
    glyph: sticker?.glyph || '✦',
    assetUrl: sticker?.assetUrl || '',
    transform: {
      scale: 42,
      rotation: 0,
      x: ((index % 3) - 1) * 18,
      y: (index % 2 ? 22 : -22),
    },
    order: Number(index),
    visible: true,
  };
}

export function defaultV2TextStyle(path = 'bootleg') {
  return {
    fontFamily: path === 'memorial' ? 'Georgia, serif' : V2_FONT_PRESETS[0].family,
    fontScale: 100,
    color: '#ffffff',
    curve: 'straight',
    curveAmount: 45,
    effect: 'shadow',
    effectStrength: 45,
    rotation: 0,
    x: 0,
    y: 0,
  };
}
