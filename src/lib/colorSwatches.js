const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const DEFAULT_COLOR_SWATCHES = Object.freeze({
  black: "#171717",
  "vintage black": "#292929",
  white: "#f7f6f1",
  "sport grey": "#b7b8b3",
  "sport gray": "#b7b8b3",
  charcoal: "#4b4c4e",
  "dark heather": "#414347",
  navy: "#17243b",
  red: "#b52332",
  royal: "#2857a6",
  sand: "#d5c1a0",
  forest: "#294a39",
  green: "#294a39",
  "forest green": "#294a39",
  pink: "#eeb1c8",
  "sky blue": "#9ecae1",
  "light blue": "#9ecae1",
  "full color": "#dadada",
});

export function normalizeColorName(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidHexColor(value) {
  return HEX_COLOR_PATTERN.test(String(value || ""));
}

export function defaultColorSwatch(color, fallback = "#8b8b8b") {
  return DEFAULT_COLOR_SWATCHES[normalizeColorName(color)] || fallback;
}

export function resolveColorSwatch(swatches, color, fallback = "#8b8b8b") {
  const configured = swatches && typeof swatches === "object" ? swatches : {};
  const exact = configured[color];

  if (isValidHexColor(exact)) return exact.toLowerCase();

  const normalized = normalizeColorName(color);
  const matchingKey = Object.keys(configured).find(
    (key) => normalizeColorName(key) === normalized
  );
  const matchingValue = matchingKey ? configured[matchingKey] : null;

  if (isValidHexColor(matchingValue)) return matchingValue.toLowerCase();
  return defaultColorSwatch(color, fallback);
}
