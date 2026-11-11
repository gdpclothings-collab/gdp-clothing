// Presentation-only assets. Never use these in product details, garment
// mockups, art proofs, or checkout: those must use real catalog/order media.
const ROOT = "/images/aurora";

export const AURORA_IMAGES = Object.freeze({
  homeHero: `${ROOT}/home_hero.webp`,
  shopHero: `${ROOT}/shop_hero.webp`,
  studioHero: `${ROOT}/studio_hero.webp`,
  dtfHero: `${ROOT}/dtf_hero.webp`,
  aboutHero: `${ROOT}/about_hero.webp`,
  contactHero: `${ROOT}/contact_hero.webp`,
  faqHero: `${ROOT}/faq_hero.webp`,
  shippingSupport: `${ROOT}/shipping_support.webp`,
  footerAmbient: `${ROOT}/footer_ambient.webp`,
  tees: `${ROOT}/category_tees.webp`,
  hoodies: `${ROOT}/category_hoodies.webp`,
  custom: `${ROOT}/category_custom.webp`,
  collections: `${ROOT}/category_collections.webp`,
  love: `${ROOT}/occasion_love.webp`,
  family: `${ROOT}/occasion_family.webp`,
  memorial: `${ROOT}/occasion_memorial.webp`,
  sports: `${ROOT}/occasion_sports.webp`,
  events: `${ROOT}/occasion_events.webp`,
  pets: `${ROOT}/occasion_pets.webp`,
});

// These are presentation-only campaign replacements, not mutations to the CMS.
// Product detail photos, actual garment proofs, and admin-stored media remain
// authoritative; only mapped storefront campaign placements use this imagery.

/** @type {Array<[RegExp, keyof typeof AURORA_IMAGES]>} */
const CATEGORY_ASSETS = [
  [/category=T-Shirt/i, "tees"],
  [/category=Hoodie/i, "hoodies"],
  [/view=collections/i, "collections"],
  [/^\/custom-studio(?:\?|$)/i, "custom"],
];

/** @type {Array<[RegExp, keyof typeof AURORA_IMAGES]>} */
const OCCASION_ASSETS = [
  [/occasion=love/i, "love"],
  [/occasion=family/i, "family"],
  [/occasion=memorial/i, "memorial"],
  [/occasion=sports/i, "sports"],
  [/occasion=events/i, "events"],
  [/occasion=pets/i, "pets"],
];

export function auroraCategoryAsset(url) {
  const found = CATEGORY_ASSETS.find(([pattern]) => pattern.test(String(url || "")));
  return found ? AURORA_IMAGES[found[1]] : null;
}

export function auroraOccasionAsset(url) {
  const found = OCCASION_ASSETS.find(([pattern]) => pattern.test(String(url || "")));
  return found ? AURORA_IMAGES[found[1]] : null;
}

export function auroraPromoAsset(url) {
  const value = String(url || "");
  if (/^\/custom-studio(?:\?|$)/.test(value)) return AURORA_IMAGES.custom;
  if (/^\/pages\/about(?:\?|$)/.test(value)) return AURORA_IMAGES.aboutHero;
  if (/^\/shop(?:\?|$)/.test(value)) return AURORA_IMAGES.shopHero;
  return null;
}
