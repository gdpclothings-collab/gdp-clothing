export const GDP_STYLE_TEMPLATES = [
  {
    id: "classic-90s",
    name: "GDP Classic 90s",
    description: "Layered portraits, chrome type, clouds and full retro energy.",
    assetUrl: "/images/gdp-styles/classic-90s.svg",
    enabled: true,
    sortOrder: 10,
    photoZone: { x: 16, y: 9, width: 68, height: 57, shape: "rounded", radius: 16 },
    textZone: { x: 12, y: 78, width: 76, height: 16, align: "center", tone: "light" },
    defaultTransform: { scale: 108, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "crop" },
  },
  {
    id: "y2k",
    name: "GDP Y2K",
    description: "Metallic type, stars, glow effects and early-2000s attitude.",
    assetUrl: "/images/gdp-styles/y2k.svg",
    enabled: true,
    sortOrder: 20,
    photoZone: { x: 19, y: 8, width: 62, height: 59, shape: "oval", radius: 50 },
    textZone: { x: 14, y: 79, width: 72, height: 15, align: "center", tone: "light" },
    defaultTransform: { scale: 110, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "crop" },
  },
  {
    id: "vintage-wash",
    name: "GDP Vintage Wash",
    description: "Muted colors, distressed graphics and old-photo texture.",
    assetUrl: "/images/gdp-styles/vintage-wash.svg",
    enabled: true,
    sortOrder: 30,
    photoZone: { x: 16, y: 10, width: 68, height: 57, shape: "rounded", radius: 8 },
    textZone: { x: 13, y: 78, width: 74, height: 16, align: "center", tone: "dark" },
    defaultTransform: { scale: 108, rotation: -1, offset: { x: 0, y: 0 }, fitMode: "crop" },
  },
  {
    id: "sports-hype",
    name: "GDP Sports Hype",
    description: "Player portraits, number, team colors and season highlights.",
    assetUrl: "/images/gdp-styles/sports-hype.svg",
    enabled: true,
    sortOrder: 40,
    photoZone: { x: 18, y: 13, width: 64, height: 49, shape: "rounded", radius: 10 },
    textZone: { x: 11, y: 78, width: 78, height: 15, align: "center", tone: "light" },
    defaultTransform: { scale: 112, rotation: 0, offset: { x: 0, y: -1 }, fitMode: "crop" },
  },
  {
    id: "memorial",
    name: "GDP Memorial",
    description: "Respectful composition with names, dates and meaningful text.",
    assetUrl: "/images/gdp-styles/memorial.svg",
    enabled: true,
    sortOrder: 50,
    photoZone: { x: 23, y: 8, width: 54, height: 61, shape: "oval", radius: 50 },
    textZone: { x: 19, y: 76, width: 62, height: 18, align: "center", tone: "dark" },
    defaultTransform: { scale: 108, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "crop" },
  },
  {
    id: "love-story",
    name: "GDP Love Story",
    description: "Couple-focused composition for anniversaries and gifts.",
    assetUrl: "/images/gdp-styles/love-story.svg",
    enabled: true,
    sortOrder: 60,
    photoZone: { x: 18, y: 7, width: 64, height: 59, shape: "oval", radius: 46 },
    textZone: { x: 16, y: 78, width: 68, height: 15, align: "center", tone: "light" },
    defaultTransform: { scale: 108, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "crop" },
  },
  {
    id: "pet-legend",
    name: "GDP Pet Legend",
    description: "Bold pet portraits, names and playful personality.",
    assetUrl: "/images/gdp-styles/pet-legend.svg",
    enabled: true,
    sortOrder: 70,
    photoZone: { x: 22, y: 9, width: 56, height: 56, shape: "circle", radius: 50 },
    textZone: { x: 14, y: 78, width: 72, height: 15, align: "center", tone: "light" },
    defaultTransform: { scale: 112, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "crop" },
  },
  {
    id: "minimal",
    name: "GDP Minimal",
    description: "Cleaner layout, fewer photos and quieter typography.",
    assetUrl: "/images/gdp-styles/minimal.svg",
    enabled: true,
    sortOrder: 80,
    photoZone: { x: 18, y: 9, width: 64, height: 61, shape: "rounded", radius: 8 },
    textZone: { x: 16, y: 78, width: 68, height: 14, align: "center", tone: "dark" },
    defaultTransform: { scale: 104, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "crop" },
  },
  {
    id: "designers-choice",
    name: "GDP Designer's Choice",
    description: "Tell us the story and let a GDP designer choose the direction.",
    assetUrl: "/images/gdp-styles/designers-choice.svg",
    enabled: true,
    sortOrder: 90,
    photoZone: { x: 16, y: 8, width: 68, height: 58, shape: "rounded", radius: 9 },
    textZone: { x: 13, y: 78, width: 74, height: 15, align: "center", tone: "light" },
    defaultTransform: { scale: 110, rotation: 0, offset: { x: 0, y: 0 }, fitMode: "crop" },
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
    return {
      ...base,
      ...custom,
      id: base.id,
      name: base.name,
      description: custom.description || base.description,
      assetUrl: String(custom.assetUrl || base.assetUrl),
      enabled: custom.enabled !== false,
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
        enabled: item.enabled !== false,
        sortOrder: Number(item.sortOrder || 0),
        assetUrl: item.assetUrl,
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
