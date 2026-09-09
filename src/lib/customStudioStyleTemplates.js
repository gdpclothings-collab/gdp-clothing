export const GDP_STYLE_TEMPLATES = [
  {
    id: "flame-ice",
    name: "Flame Ice",
    description: "Electric blue flame frame with high-contrast white accents.",
    category: "photo_bootleg",
    thumbnail: "/images/gdp-styles/flame-ice.webp",
    fullAsset: "/images/gdp-styles/flame-ice.webp",
    assetUrl: "/images/gdp-styles/flame-ice.webp",
    active: true,
    enabled: true,
    sortOrder: 10,
    locked: true,
    photoZone: { x: 4, y: 3, width: 92, height: 91, shape: "rounded", radius: 4 },
    textZone: { x: 11, y: 79, width: 78, height: 16, align: "center", tone: "light" },
    defaultTransform: { scale: 92, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "fit" },
  },
  {
    id: "flame-neon",
    name: "Flame Neon",
    description: "Purple and hot-pink flame frame for a vivid neon bootleg look.",
    category: "photo_bootleg",
    thumbnail: "/images/gdp-styles/flame-neon.webp",
    fullAsset: "/images/gdp-styles/flame-neon.webp",
    assetUrl: "/images/gdp-styles/flame-neon.webp",
    active: true,
    enabled: true,
    sortOrder: 20,
    locked: true,
    photoZone: { x: 4, y: 3, width: 92, height: 91, shape: "rounded", radius: 4 },
    textZone: { x: 11, y: 79, width: 78, height: 16, align: "center", tone: "light" },
    defaultTransform: { scale: 92, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "fit" },
  },
  {
    id: "flame-heatwave",
    name: "Flame Heatwave",
    description: "Teal, violet and yellow flame frame with high-energy highlights.",
    category: "photo_bootleg",
    thumbnail: "/images/gdp-styles/flame-heatwave.webp",
    fullAsset: "/images/gdp-styles/flame-heatwave.webp",
    assetUrl: "/images/gdp-styles/flame-heatwave.webp",
    active: true,
    enabled: true,
    sortOrder: 30,
    locked: true,
    photoZone: { x: 4, y: 3, width: 92, height: 91, shape: "rounded", radius: 4 },
    textZone: { x: 11, y: 79, width: 78, height: 16, align: "center", tone: "light" },
    defaultTransform: { scale: 92, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "fit" },
  },
  {
    id: "flame-inferno",
    name: "Flame Inferno",
    description: "Orange, yellow and pink flame frame with a warm fire finish.",
    category: "photo_bootleg",
    thumbnail: "/images/gdp-styles/flame-inferno.webp",
    fullAsset: "/images/gdp-styles/flame-inferno.webp",
    assetUrl: "/images/gdp-styles/flame-inferno.webp",
    active: true,
    enabled: true,
    sortOrder: 40,
    locked: true,
    photoZone: { x: 4, y: 3, width: 92, height: 91, shape: "rounded", radius: 4 },
    textZone: { x: 11, y: 79, width: 78, height: 16, align: "center", tone: "light" },
    defaultTransform: { scale: 92, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "fit" },
  },
  {
    id: "flame-toxic",
    name: "Flame Toxic",
    description: "Acid green and yellow flame frame for a bold toxic-neon look.",
    category: "photo_bootleg",
    thumbnail: "/images/gdp-styles/flame-toxic.webp",
    fullAsset: "/images/gdp-styles/flame-toxic.webp",
    assetUrl: "/images/gdp-styles/flame-toxic.webp",
    active: true,
    enabled: true,
    sortOrder: 50,
    locked: true,
    photoZone: { x: 4, y: 3, width: 92, height: 91, shape: "rounded", radius: 4 },
    textZone: { x: 11, y: 79, width: 78, height: 16, align: "center", tone: "light" },
    defaultTransform: { scale: 92, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "fit" },
  },
];

function numberBetween(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeZone(base, override = {}) {
  return {
    ...base,
    ...(override || {}),
    x: numberBetween(override?.x, base.x, 0, 95),
    y: numberBetween(override?.y, base.y, 0, 95),
    width: numberBetween(override?.width, base.width, 5, 100),
    height: numberBetween(override?.height, base.height, 5, 100),
    radius: numberBetween(override?.radius, base.radius || 0, 0, 50),
    shape: ["rect", "rounded", "oval", "circle"].includes(override?.shape) ? override.shape : base.shape,
  };
}

export function normalizeStyleTemplates(overrides = {}) {
  const source = Array.isArray(overrides)
    ? Object.fromEntries(overrides.filter(Boolean).map((item) => [item.id || item.name, item]))
    : (overrides || {});

  return GDP_STYLE_TEMPLATES.map((base) => {
    const custom = source[base.id] || source[base.name] || {};
    const customTransform = custom.defaultTransform || {};
    const offset = customTransform.offset || {};
    const customAsset = String(custom.fullAsset || custom.assetUrl || base.fullAsset || base.assetUrl);
    const customThumbnail = String(custom.thumbnail || customAsset || base.thumbnail || base.assetUrl);
    const active = custom.active !== false && custom.enabled !== false;
    return {
      ...base,
      ...custom,
      id: base.id,
      name: String(custom.name || base.name),
      description: String(custom.description || base.description),
      category: "photo_bootleg",
      thumbnail: customThumbnail,
      fullAsset: customAsset,
      assetUrl: customAsset,
      active,
      enabled: active,
      locked: true,
      sortOrder: numberBetween(custom.sortOrder, base.sortOrder, 0, 999),
      photoZone: normalizeZone(base.photoZone, custom.photoZone),
      textZone: { ...base.textZone, ...(custom.textZone || {}) },
      defaultTransform: {
        ...base.defaultTransform,
        ...customTransform,
        scale: numberBetween(customTransform.scale, base.defaultTransform.scale, 55, 180),
        rotation: numberBetween(customTransform.rotation, base.defaultTransform.rotation, -18, 18),
        offset: {
          x: numberBetween(offset.x, base.defaultTransform.offset.x, -42, 42),
          y: numberBetween(offset.y, base.defaultTransform.offset.y, -42, 42),
        },
        fitMode: ["fit", "crop"].includes(customTransform.fitMode) ? customTransform.fitMode : base.defaultTransform.fitMode,
      },
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function styleTemplateForName(name, overrides = {}) {
  const templates = normalizeStyleTemplates(overrides);
  return templates.find((item) => item.name === name || item.id === name) || templates[0];
}

export function styleTemplateOverridesMap(templates = []) {
  return Object.fromEntries(
    templates.map((item) => [
      item.id,
      {
        name: item.name,
        description: item.description,
        category: "photo_bootleg",
        active: item.active !== false,
        enabled: item.active !== false,
        locked: true,
        sortOrder: Number(item.sortOrder || 0),
        thumbnail: item.thumbnail || item.assetUrl,
        fullAsset: item.fullAsset || item.assetUrl,
        assetUrl: item.fullAsset || item.assetUrl,
        photoZone: { ...item.photoZone },
        textZone: { ...item.textZone },
        defaultTransform: {
          ...item.defaultTransform,
          offset: { ...(item.defaultTransform?.offset || { x: 0, y: 0 }) },
        },
      },
    ])
  );
}
