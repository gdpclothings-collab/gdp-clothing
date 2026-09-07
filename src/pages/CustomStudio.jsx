import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Upload, X, Star, Users, Heart, PawPrint, Trophy, Gift, Sparkles, ShieldCheck, AlertTriangle, Shirt, Plus, Minus, Eye, Maximize2, Move, RotateCcw, Ruler, ZoomIn, ZoomOut, Info } from "lucide-react";
import { customerApi } from "@/lib/customerApi";
import { useCart } from "@/lib/CartContext";
import { resolveColorSwatch } from "@/lib/colorSwatches";
import {
  getMockupLayerStyle,
  preloadPreviewImages,
  resolveMockupNormalization,
  resolvePreviewCanvas,
} from "@/lib/garmentPreviewNormalization";
import {
  normalizeStyleTemplates,
  styleTemplateForName,
} from "@/lib/customStudioStyleTemplates";
import {
  findProductVariant,
  isProductVariantAvailable,
  normalizeVariantValue,
  sortApparelSizes,
} from "@/lib/productVariants";

const OCCASIONS = [
  {
    id: "love",
    label: "Love & Relationships",
    icon: Heart,
    summary: "Anniversaries, partners, Valentine's gifts and shared stories.",
    image: "https://images.unsplash.com/photo-1776266100238-7cb653b62c69?auto=format&fit=crop&w=1200&q=82",
    imagePosition: "object-center",
    options: ["Anniversary","Boyfriend","Girlfriend","Husband","Wife","Valentine's","Couple"],
  },
  {
    id: "family",
    label: "Family",
    icon: Users,
    summary: "Parents, grandparents, reunions and family milestones.",
    image: "https://images.unsplash.com/photo-1772510584577-055823ea298a?auto=format&fit=crop&w=1200&q=82",
    imagePosition: "object-center",
    options: ["Mom","Dad","Grandma","Grandpa","Mother's Day","Father's Day","Family Reunion"],
  },
  {
    id: "pets",
    label: "Pets",
    icon: PawPrint,
    summary: "Pet portraits, pet-parent gifts and meaningful memorials.",
    image: "https://images.unsplash.com/photo-1745544377336-b95d172463be?auto=format&fit=crop&w=1200&q=82",
    imagePosition: "object-center",
    options: ["Dog","Cat","Multiple Pets","Pet Memorial","Pet Mom / Dad"],
  },
  {
    id: "sports",
    label: "Sports & School",
    icon: Trophy,
    summary: "Game day, senior night, graduation and team achievements.",
    image: "https://images.unsplash.com/photo-1773949122578-8886f0ee48da?auto=format&fit=crop&w=1200&q=82",
    imagePosition: "object-center",
    options: ["Senior Night","Graduation","Football","Basketball","Volleyball","Baseball","Hockey","Dance / Cheer"],
  },
  {
    id: "events",
    label: "Life Events",
    icon: Gift,
    summary: "Birthdays, weddings, trips, retirements and celebrations.",
    image: "https://images.unsplash.com/photo-1758275557764-0fc337d4b747?auto=format&fit=crop&w=1200&q=82",
    imagePosition: "object-center",
    options: ["Birthday","Wedding","Bachelorette","Retirement","Vacation","Reunion"],
  },
  {
    id: "memorial",
    label: "Memorial",
    icon: Heart,
    summary: "Respectful tribute designs that preserve a meaningful memory.",
    image: "https://images.unsplash.com/photo-1762990006179-1d8d7c05eb89?auto=format&fit=crop&w=1200&q=82",
    imagePosition: "object-center",
    options: ["In Loving Memory","Celebration of Life","Memorial Event"],
  },
  {
    id: "other",
    label: "Just Because",
    icon: Sparkles,
    summary: "Best friends, inside jokes, personal ideas and spontaneous gifts.",
    image: "https://images.unsplash.com/photo-1755705153160-67b29c7718ee?auto=format&fit=crop&w=1200&q=82",
    imagePosition: "object-center",
    options: ["Best Friend","Inside Joke","Funny Shirt","For Myself","Designer's Choice"],
  },
];

const DESIGN_INTENSITY_LEVELS = {
  1: { label: "Clean", description: "Minimal layout with one clear focal point, restrained type and plenty of breathing room." },
  2: { label: "Light", description: "A little more styling with supporting type, subtle texture and a few graphic accents." },
  3: { label: "Balanced", description: "A balanced mix of portraits, typography, effects and negative space." },
  4: { label: "Bold", description: "Stronger layering, larger type, more image crops and more dramatic effects." },
  5: { label: "Maximum Chaos", description: "Full bootleg energy with dense collage, oversized type, textures, effects and multiple visual layers." },
};

const HIDDEN_INTENSITY_IMAGE = "__hidden__";

const DEFAULT_STUDIO_SETTINGS = {
  mobileFloatingCtaEnabled: false,
  intensityExamplesEnabled: true,
  intensityExampleImageUrl: "/images/design-intensity-bootleg.svg",
  intensityExamples: { "1": "", "2": "", "3": "", "4": "", "5": "" },
  showCombinedIntensityGuide: true,
  defaultDesignIntensity: 3,
  orderGuideEnabled: true,
  priceVisibility: "hidden",
  frontBackEnabled: true,
  frontBackFee: 10,
  styleTemplates: {},
};

function normalizeIntensityExamples(examples = {}) {
  return Object.fromEntries(
    [1, 2, 3, 4, 5].map((level) => {
      const raw = examples?.[level] ?? examples?.[String(level)] ?? "";
      const value = typeof raw === "string" ? raw : String(raw?.imageUrl || "");
      return [String(level), value];
    })
  );
}

function normalizeStudioSettings(settings = {}) {
  return {
    ...DEFAULT_STUDIO_SETTINGS,
    ...(settings || {}),
    intensityExamples: normalizeIntensityExamples(settings?.intensityExamples),
    styleTemplates: settings?.styleTemplates && typeof settings.styleTemplates === "object" ? settings.styleTemplates : {},
  };
}

function defaultArtworkState(template) {
  const defaults = template?.defaultTransform || {};
  return {
    scale: Number(defaults.scale ?? 100),
    rotation: Number(defaults.rotation ?? 0),
    offset: {
      x: Number(defaults.offset?.x ?? 0),
      y: Number(defaults.offset?.y ?? 0),
    },
    fitMode: defaults.fitMode === "fit" ? "fit" : "crop",
    sourcePhotoIndex: 0,
  };
}

function defaultArtworkStates(template) {
  return {
    front: defaultArtworkState(template),
    back: defaultArtworkState(template),
  };
}

const FALLBACK_GARMENT = {
  type: "T-Shirt",
  label: "Classic Tee",
  tier: "classic",
  price: 34.99,
  desc: "Traditional everyday fit."
};

function uniqueValues(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function activeProductVariants(product) {
  return (product?.variants || []).filter((variant) => variant?.active !== false);
}

function productColors(product) {
  if (!product) return [];
  const variants = activeProductVariants(product);
  if (variants.length) return uniqueValues(variants.map((variant) => variant.color));
  return uniqueValues(product.colors || []);
}

function productSizes(product, color = "") {
  if (!product) return [];
  const variants = activeProductVariants(product);
  if (!variants.length) return sortApparelSizes(product.sizes || []);

  const matching = color
    ? variants.filter((variant) => normalizeVariantValue(variant.color) === normalizeVariantValue(color))
    : variants;
  return sortApparelSizes(matching.map((variant) => variant.size));
}

function variantFor(product, color, size) {
  return findProductVariant(product, color, size);
}

function variantAvailable(product, variant) {
  return isProductVariantAvailable(product, variant);
}

function garmentFromProduct(product) {
  if (!product) return FALLBACK_GARMENT;
  return {
    id: product.id,
    type: product.type || "T-Shirt",
    // Product names are often more specific than the generic product type
    // (for example: "Long Sleeve Crew Neck Adult T-Shirt"). Keep that richer
    // description for mockup matching and fallback silhouette selection.
    previewType: [product.name, product.type].filter(Boolean).join(" "),
    label: product.name || "Custom garment",
    tier: product.customization?.garmentTier || "classic",
    price: Number(product.price || 0),
    desc: product.description || "Choose your blank, color and size.",
    image: product.images?.[0] || "",
    images: product.images || [],
    defaultColor: product.colors?.[0] || ""
  };
}

function swatchFor(product, color) {
  return resolveColorSwatch(product?.customization?.preview?.colorSwatches, color);
}

function normalizePreviewToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/grey/g, "gray")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function previewFileName(url) {
  const raw = String(url || "").split("/").pop() || "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function garmentImageMatchesType(url, type) {
  const name = normalizePreviewToken(previewFileName(url));
  const key = normalizePreviewToken(type);
  if (!name) return false;

  if (key.includes("baby") || key.includes("bodysuit") || key.includes("onesie")) {
    return name.includes("baby") || name.includes("bodysuit") || name.includes("onesie");
  }
  if (key.includes("toddler")) return name.includes("toddler");
  if (key.includes("youth") || key === "kids") return name.includes("youth") || name.includes("kids");
  if (key.includes("hoodie")) return name.includes("hoodie");
  if (key.includes("crewneck") || key.includes("crew neck") || key.includes("sweatshirt") || key.includes("sweater")) {
    return name.includes("crewneck") || name.includes("crew neck") || name.includes("sweatshirt") || name.includes("sweater");
  }
  if (key.includes("long sleeve")) {
    return name.includes("long sleeve") || name.includes("longsleeve");
  }
  if (key.includes("t shirt") || key.includes("tee")) {
    return name.includes("tee") || name.includes("t shirt") || name.includes("tshirt");
  }
  return true;
}

function hasStrictGarmentPreviewType(type) {
  const key = normalizePreviewToken(type);
  return [
    "baby", "bodysuit", "onesie", "toddler", "youth", "kids",
    "hoodie", "crewneck", "crew neck", "sweatshirt", "sweater",
    "long sleeve", "t shirt", "tee"
  ].some((token) => key.includes(token));
}

function studioCardImage(product) {
  // A Studio card image is an explicit UI asset and is intentionally separate
  // from production front/back mockups. This lets us recover a missing catalog
  // thumbnail without ever substituting a different garment model.
  const configuredCardImage =
    product?.customization?.preview?.cardImageUrl ||
    product?.customization?.cardImageUrl ||
    "";
  if (configuredCardImage) return configuredCardImage;

  const images = uniqueValues(product?.images || []);
  if (!images.length) return "";
  const type = [product?.name, product?.type].filter(Boolean).join(" ");
  return images.find((url) => garmentImageMatchesType(url, type)) || "";
}

function imageMatchesPreviewColor(url, color) {
  const name = normalizePreviewToken(previewFileName(url));
  const key = normalizePreviewToken(color);
  if (!name || !key) return false;

  if (key === "sport gray") return name.includes("sport gray") || name.includes("sportgray");
  if (key === "charcoal") return name.includes("charcoal");
  if (key === "dark heather") return name.includes("dark heather");
  if (key === "navy") return name.includes("navy");
  if (key === "royal") {
    if (name.includes("royal")) return true;
    return name.includes("blue") && !name.includes("navy") && !name.includes("sky");
  }
  if (key === "sand") return name.includes("sand") || name.includes("beige") || name.includes("tan");
  if (key === "forest") return name.includes("forest") || name.includes("forest green");
  return name.includes(key);
}

function previewImageForGarment(garment, color, side) {
  const images = uniqueValues(garment?.images || []);
  if (!images.length) return "";

  const previewType = garment?.previewType || garment?.type;
  const typeMatches = images.filter((url) => garmentImageMatchesType(url, previewType));

  // Every image here already belongs to the selected product. Storage URLs can
  // be UUID-based and may not contain garment/color keywords, so an empty
  // filename match must not force the generic SVG preview.
  const scopedImages = typeMatches.length
    ? typeMatches
    : (hasStrictGarmentPreviewType(previewType) ? [] : images);
  if (!scopedImages.length) return "";

  const candidates = scopedImages.filter((url) => {
    const name = normalizePreviewToken(previewFileName(url));
    const isBack = name.includes("back") || name.includes("rear");
    return side === "back" ? isBack : !isBack;
  });

  const exactColorMatch = candidates.find((url) => imageMatchesPreviewColor(url, color));
  if (exactColorMatch) return exactColorMatch;

  // On the front view, fall back to the selected product's own primary/front
  // image. This keeps the live preview visually matched to the garment card
  // instead of showing a different generic shirt silhouette.
  if (side === "front") {
    return candidates[0] ||
      scopedImages.find((url) => {
        const name = normalizePreviewToken(previewFileName(url));
        return !name.includes("back") && !name.includes("rear");
      }) ||
      garment?.image ||
      "";
  }

  // Never show a front product photo on the back view. If there is no back
  // mockup, StudioPreview will safely use the generated back silhouette.
  return candidates[0] || "";
}

function formatMeasurementNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function cmFromInches(value) {
  return Number((Number(value || 0) * 2.54).toFixed(1));
}

function measurementPair(widthIn, heightIn) {
  return `${formatMeasurementNumber(widthIn)} × ${formatMeasurementNumber(heightIn)} in · ${formatMeasurementNumber(cmFromInches(widthIn))} × ${formatMeasurementNumber(cmFromInches(heightIn))} cm`;
}

function measurementSingle(value) {
  return `${formatMeasurementNumber(value)}" / ${formatMeasurementNumber(cmFromInches(value))} cm`;
}

function recommendedPrintProfile(type, size, side = "front") {
  const key = normalizePreviewToken(type);
  const normalizedSize = String(size || "").toUpperCase().replace(/\s+/g, "");
  const isBack = side === "back";
  const pick = (map, fallback) => map[normalizedSize] || fallback;
  let profile;

  if (key.includes("baby") || key.includes("bodysuit") || key.includes("onesie")) {
    const fallback = { widthIn: 5.5, heightIn: 6.5, collarIn: 1.25, backCollarIn: 1.5, top: 31, width: 31, height: 28, collarAnchor: 22, placementLabel: "Centered torso" };
    profile = pick({
      "0-3M": { ...fallback, widthIn: 4.5, heightIn: 5.5, width: 27, height: 24 },
      "3-6M": { ...fallback, widthIn: 5, heightIn: 6, width: 29, height: 26 },
      "6-12M": fallback,
      "12-18M": { ...fallback, widthIn: 6, heightIn: 7, width: 33, height: 30 }
    }, fallback);
  } else if (key.includes("toddler")) {
    const fallback = { widthIn: 7, heightIn: 8, collarIn: 1.75, backCollarIn: 2, top: 30, width: 36, height: 34, collarAnchor: 21, placementLabel: "Centered chest" };
    profile = pick({
      "2T": { ...fallback, widthIn: 6, heightIn: 7, collarIn: 1.5, top: 31, width: 32, height: 31, collarAnchor: 22 },
      "3T": { ...fallback, widthIn: 6.5, heightIn: 7.5, collarIn: 1.6, top: 30.5, width: 34, height: 32.5, collarAnchor: 21.5 },
      "4T": fallback,
      "5T": { ...fallback, widthIn: 7.5, heightIn: 8.5, collarIn: 2, backCollarIn: 2.25, top: 29.5, width: 38, height: 36, collarAnchor: 20.5 }
    }, fallback);
  } else if (key.includes("youth") || key === "kids") {
    const fallback = { widthIn: 9, heightIn: 11, collarIn: 2.25, backCollarIn: 2.75, top: 29, width: 36, height: 38, collarAnchor: 20, placementLabel: "Centered chest" };
    profile = pick({
      "XS": { ...fallback, widthIn: 7.5, heightIn: 9.5, collarIn: 2, backCollarIn: 2.5, top: 30, width: 32, height: 35 },
      "S": { ...fallback, widthIn: 8.5, heightIn: 10.5, collarIn: 2, backCollarIn: 2.5, top: 29.5, width: 34, height: 36.5 },
      "M": fallback,
      "L": { ...fallback, widthIn: 9.5, heightIn: 11.5, collarIn: 2.5, backCollarIn: 3, top: 28.75, width: 37.5, height: 39, collarAnchor: 19.5 },
      "XL": { ...fallback, widthIn: 10, heightIn: 12, collarIn: 2.5, backCollarIn: 3, top: 28.5, width: 39, height: 40, collarAnchor: 19.5 }
    }, fallback);
  } else if (key.includes("hoodie")) {
    const fallback = { widthIn: 11, heightIn: 12.5, collarIn: 3.5, backCollarIn: 5, top: 32, width: 34.5, height: 32.5, collarAnchor: 20, bottomClearanceIn: 1.75, placementLabel: "Centered above pocket" };
    profile = pick({
      "S": { ...fallback, widthIn: 10, heightIn: 11.5, collarIn: 3.25, top: 33, width: 31.5, height: 30.5, collarAnchor: 21, bottomClearanceIn: 1.5 },
      "M": { ...fallback, widthIn: 10.5, heightIn: 12, collarIn: 3.25, top: 32.5, width: 33, height: 31.5, collarAnchor: 20.5, bottomClearanceIn: 1.5 },
      "L": fallback,
      "XL": { ...fallback, widthIn: 11.5, heightIn: 13, top: 31.5, width: 36, height: 33, collarAnchor: 19.5, bottomClearanceIn: 2 },
      "2XL": { ...fallback, widthIn: 11.5, heightIn: 13, collarIn: 3.75, top: 31.25, width: 36.5, height: 33.5, collarAnchor: 19.25, bottomClearanceIn: 2 },
      "3XL": { ...fallback, widthIn: 11.5, heightIn: 13, collarIn: 3.75, top: 31.25, width: 36.5, height: 33.5, collarAnchor: 19.25, bottomClearanceIn: 2 },
      "4XL": { ...fallback, widthIn: 11.5, heightIn: 13, collarIn: 3.75, top: 31.25, width: 36.5, height: 33.5, collarAnchor: 19.25, bottomClearanceIn: 2 },
      "5XL": { ...fallback, widthIn: 11.5, heightIn: 13, collarIn: 3.75, top: 31.25, width: 36.5, height: 33.5, collarAnchor: 19.25, bottomClearanceIn: 2 }
    }, fallback);
  } else if (key.includes("sweatshirt") || key.includes("sweater") || (key.includes("crew neck") && !key.includes("t shirt")) || key.includes("crewneck")) {
    const fallback = { widthIn: 11.5, heightIn: 14, collarIn: 2.75, backCollarIn: 3.25, top: 30, width: 36, height: 38, collarAnchor: 20, placementLabel: "Centered chest" };
    profile = pick({
      "S": { ...fallback, widthIn: 10.5, heightIn: 13, collarIn: 2.5, width: 34, height: 36 },
      "M": { ...fallback, widthIn: 11, heightIn: 13.5, width: 35, height: 37 },
      "L": fallback,
      "XL": { ...fallback, widthIn: 12, heightIn: 15, collarIn: 3, backCollarIn: 3.5, top: 29.5, width: 38, height: 40, collarAnchor: 19.5 }
    }, fallback);
  } else if (key.includes("t shirt") || key.includes("t-shirt") || key.includes("long sleeve") || key.includes("shirt")) {
    const fallback = { widthIn: 11.5, heightIn: 14.5, collarIn: 2.75, backCollarIn: 3.25, top: 28.75, width: 37, height: 39, collarAnchor: 19.5, placementLabel: "Centered chest" };
    profile = pick({
      "S": { ...fallback, widthIn: 10.5, heightIn: 13.5, collarIn: 2.5, backCollarIn: 3, top: 29.5, width: 34, height: 37, collarAnchor: 20 },
      "M": { ...fallback, widthIn: 11, heightIn: 14, collarIn: 2.5, backCollarIn: 3, top: 29, width: 35.5, height: 38, collarAnchor: 20 },
      "L": fallback,
      "XL": { ...fallback, widthIn: 12, heightIn: 15, collarIn: 3, backCollarIn: 3.5, top: 28.5, width: 38.5, height: 40, collarAnchor: 19 },
      "2XL": { ...fallback, widthIn: 12, heightIn: 15, collarIn: 3, backCollarIn: 3.5, top: 28.25, width: 39, height: 40.5, collarAnchor: 18.75 },
      "3XL": { ...fallback, widthIn: 12, heightIn: 15, collarIn: 3, backCollarIn: 3.5, top: 28.25, width: 39, height: 40.5, collarAnchor: 18.75 },
      "4XL": { ...fallback, widthIn: 12, heightIn: 15, collarIn: 3, backCollarIn: 3.5, top: 28.25, width: 39, height: 40.5, collarAnchor: 18.75 },
      "5XL": { ...fallback, widthIn: 12, heightIn: 15, collarIn: 3, backCollarIn: 3.5, top: 28.25, width: 39, height: 40.5, collarAnchor: 18.75 }
    }, fallback);
  } else {
    profile = { widthIn: 11, heightIn: 14, collarIn: 2.5, backCollarIn: 3, top: 29, width: 36, height: 38, collarAnchor: 20, placementLabel: "Centered", generic: true };
  }

  if (!isBack) {
    return recommendedFrontPrintProfile(key, normalizedSize, profile);
  }

  return recommendedBackPrintProfile(key, normalizedSize, profile);
}

function recommendedFrontPrintProfile(key, normalizedSize, profile) {
  let maxWidthIn = 12;
  let maxHeightIn = 16;

  if (key.includes("baby") || key.includes("bodysuit") || key.includes("onesie")) {
    maxWidthIn = 6;
    maxHeightIn = 7;
  } else if (key.includes("toddler")) {
    maxWidthIn = 7.5;
    maxHeightIn = 9;
  } else if (key.includes("youth") || key === "kids") {
    maxWidthIn = 10;
    maxHeightIn = 12;
  } else if (key.includes("hoodie")) {
    maxWidthIn = 12;
    maxHeightIn = 14;
  } else if (
    key.includes("sweatshirt") ||
    key.includes("sweater") ||
    key.includes("crewneck") ||
    (key.includes("crew neck") && !key.includes("t shirt"))
  ) {
    maxWidthIn = 12;
    maxHeightIn = 15;
  }

  return {
    ...profile,
    maxWidthIn,
    maxHeightIn,
    placementLabel: key.includes("baby") || key.includes("bodysuit") || key.includes("onesie")
      ? "Centered torso"
      : profile.placementLabel,
  };
}

function recommendedBackPrintProfile(key, normalizedSize, frontProfile) {
  const pick = (map, fallback) => map[normalizedSize] || fallback;
  let guide;

  if (key.includes("baby") || key.includes("bodysuit") || key.includes("onesie")) {
    guide = {
      ...pick({
        "0-3M": { widthIn: 3.5, heightIn: 4.5 },
        "3-6M": { widthIn: 4, heightIn: 5 },
        "6-12M": { widthIn: 4.5, heightIn: 5.5 },
        "12-18M": { widthIn: 5, heightIn: 6 },
      }, { widthIn: 4, heightIn: 5 }),
      collarIn: 1.25,
      maxWidthIn: 5,
      maxHeightIn: 6,
      topShift: 0.5,
    };
  } else if (key.includes("toddler")) {
    guide = {
      ...pick({
        "2T": { widthIn: 5.5, heightIn: 7 },
        "3T": { widthIn: 6, heightIn: 7.5 },
        "4T": { widthIn: 6, heightIn: 8 },
        "5T": { widthIn: 6.5, heightIn: 8.5 },
      }, { widthIn: 6, heightIn: 8 }),
      collarIn: normalizedSize === "5T" ? 2 : 1.75,
      maxWidthIn: 7.5,
      maxHeightIn: 9,
      topShift: 1,
    };
  } else if (key.includes("youth") || key === "kids") {
    guide = {
      ...pick({
        "XS": { widthIn: 7.5, heightIn: 9 },
        "S": { widthIn: 8, heightIn: 10 },
        "M": { widthIn: 8.5, heightIn: 10.5 },
        "L": { widthIn: 9, heightIn: 11 },
        "XL": { widthIn: 9.5, heightIn: 11.5 },
      }, { widthIn: 8.5, heightIn: 10.5 }),
      collarIn: 2.5,
      maxWidthIn: 10,
      maxHeightIn: 12,
      topShift: 1,
    };
  } else if (key.includes("hoodie")) {
    guide = {
      ...pick({
        "S": { widthIn: 10, heightIn: 11 },
        "M": { widthIn: 10.5, heightIn: 11.5 },
        "L": { widthIn: 11, heightIn: 12 },
        "XL": { widthIn: 11.5, heightIn: 12.5 },
        "2XL": { widthIn: 11.5, heightIn: 12.5 },
        "3XL": { widthIn: 12, heightIn: 13 },
        "4XL": { widthIn: 12, heightIn: 13 },
        "5XL": { widthIn: 12, heightIn: 13 },
      }, { widthIn: 11, heightIn: 12 }),
      collarIn: 6,
      maxWidthIn: 12,
      maxHeightIn: 14,
      topShift: 4,
    };
  } else if (key.includes("sweatshirt") || key.includes("sweater") || key.includes("crewneck") || (key.includes("crew neck") && !key.includes("t shirt"))) {
    guide = {
      ...pick({
        "S": { widthIn: 10, heightIn: 12 },
        "M": { widthIn: 10.5, heightIn: 12.5 },
        "L": { widthIn: 11, heightIn: 13 },
        "XL": { widthIn: 11.5, heightIn: 14 },
        "2XL": { widthIn: 12, heightIn: 14.5 },
        "3XL": { widthIn: 12, heightIn: 14.5 },
      }, { widthIn: 11, heightIn: 13 }),
      collarIn: 3.25,
      maxWidthIn: 12,
      maxHeightIn: 15,
      topShift: 1,
    };
  } else {
    guide = {
      ...pick({
        "XS": { widthIn: 10, heightIn: 12.5 },
        "S": { widthIn: 10.5, heightIn: 13 },
        "M": { widthIn: 11, heightIn: 14 },
        "L": { widthIn: 11.5, heightIn: 14.5 },
        "XL": { widthIn: 12, heightIn: 15 },
        "2XL": { widthIn: 12, heightIn: 15 },
        "3XL": { widthIn: 12, heightIn: 15 },
        "4XL": { widthIn: 12, heightIn: 15 },
        "5XL": { widthIn: 12, heightIn: 15 },
      }, { widthIn: 11, heightIn: 14 }),
      collarIn: 3.25,
      maxWidthIn: 12,
      maxHeightIn: 16,
      topShift: 1,
    };
  }

  const widthRatio = guide.widthIn / Math.max(1, Number(frontProfile.widthIn || guide.widthIn));
  const heightRatio = guide.heightIn / Math.max(1, Number(frontProfile.heightIn || guide.heightIn));

  return {
    ...frontProfile,
    widthIn: guide.widthIn,
    heightIn: guide.heightIn,
    maxWidthIn: guide.maxWidthIn,
    maxHeightIn: guide.maxHeightIn,
    collarIn: guide.collarIn,
    top: frontProfile.top + guide.topShift,
    width: Math.min(65, Math.max(22, frontProfile.width * widthRatio)),
    height: Math.min(62, Math.max(20, frontProfile.height * heightRatio)),
    bottomClearanceIn: null,
    placementLabel: key.includes("hoodie") ? "Centered below hood" : "Centered back",
  };
}

const MOODS = ["Funny","Emotional","Cool","Romantic","Loud","Vintage","Elegant","Designer's choice"];
const MOOD_PREVIEW_TREATMENTS = {
  Funny: {
    description: "Brighter, playful color with extra pop.",
    photoFilter: "saturate(1.2) contrast(1.04) brightness(1.03)",
    templateFilter: "saturate(1.25) contrast(1.04)",
  },
  Emotional: {
    description: "Softer contrast and warmer, more sentimental tones.",
    photoFilter: "saturate(.82) sepia(.12) contrast(.96) brightness(1.04)",
    templateFilter: "saturate(.9) brightness(1.03)",
  },
  Cool: {
    description: "Clean contrast with a cooler chrome-forward finish.",
    photoFilter: "saturate(.96) contrast(1.07) hue-rotate(3deg)",
    templateFilter: "saturate(1.06) contrast(1.05)",
  },
  Romantic: {
    description: "Warm rose, soft glow and richer skin-tone warmth.",
    photoFilter: "saturate(1.04) sepia(.08) brightness(1.03)",
    templateFilter: "saturate(1.12) sepia(.05)",
  },
  Loud: {
    description: "Maximum color punch, stronger contrast and high-energy impact.",
    photoFilter: "saturate(1.34) contrast(1.12) brightness(1.02)",
    templateFilter: "saturate(1.35) contrast(1.1)",
  },
  Vintage: {
    description: "Faded color, warm wash and distressed old-photo character.",
    photoFilter: "sepia(.34) saturate(.72) contrast(.94) brightness(.98)",
    templateFilter: "sepia(.22) saturate(.78) contrast(.96)",
  },
  Elegant: {
    description: "Restrained saturation with clean black, cream and gold polish.",
    photoFilter: "saturate(.72) contrast(1.04) brightness(1.03)",
    templateFilter: "saturate(.78) contrast(1.04) brightness(1.02)",
  },
  "Designer's choice": {
    description: "No forced filter — the GDP designer can choose the final treatment.",
    photoFilter: "none",
    templateFilter: "none",
  },
};

function moodPreviewTreatment(mood) {
  return MOOD_PREVIEW_TREATMENTS[mood] || {
    description: "Choose a mood to preview its color and contrast treatment.",
    photoFilter: "none",
    templateFilter: "none",
  };
}

const STEPS = ["Garment","Occasion","Style","Photos","Personalize","Timing","Review"];
const ORDER_GUIDE_STEPS = [
  { title: "Choose garment", detail: "Pick clothing, color, size, quantity and print placement." },
  { title: "Tell us the occasion", detail: "Share who or what the custom piece is for." },
  { title: "Choose your style", detail: "Pick the GDP design direction and mood you want." },
  { title: "Upload photos", detail: "Add your best-quality photos or artwork references." },
  { title: "Personalize it", detail: "Add names, dates, quotes, numbers and designer notes." },
  { title: "Timing & approval", detail: "Set your needed-by date and confirm artwork permissions." },
  { title: "Review & checkout", detail: "Final-check everything, add to cart and complete checkout." }
];
const AFTER_ORDER_STEPS = ["Order received","Artwork review","Proof / approval when required","Printing","Quality check","Pickup / shipping"];
const MAX_MB = 12;
const OPTIMIZE_ABOVE_MB = 2.5;
const MAX_UPLOAD_DIMENSION = 3600;

function qualityFor(width, height) {
  const longest = Math.max(width || 0, height || 0);
  if (longest >= 1800) return "excellent";
  if (longest >= 1000) return "usable";
  return "replace_recommended";
}

function readLocalImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const result = { img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, url };
      resolve(result);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    img.src = url;
  });
}

async function prepareImageForUpload(file) {
  const local = await readLocalImage(file);
  const { img, width, height, url } = local;
  const longest = Math.max(width, height);
  const isPng = file.type === "image/png";
  const shouldOptimize = isPng || file.size > OPTIMIZE_ABOVE_MB * 1024 * 1024 || longest > MAX_UPLOAD_DIMENSION;

  if (!shouldOptimize) {
    URL.revokeObjectURL(url);
    return { file, width, height };
  }

  const scale = Math.min(1, MAX_UPLOAD_DIMENSION / longest);
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(url);
    return { file, width, height };
  }
  ctx.drawImage(img, 0, 0, outputWidth, outputHeight);

  // WebP keeps PNG transparency while greatly reducing mobile upload size.
  const outputType = file.type === "image/webp" || isPng ? "image/webp" : "image/jpeg";
  const blob = await new Promise(resolve => canvas.toBlob(resolve, outputType, 0.9));
  URL.revokeObjectURL(url);

  if (!blob) return { file, width, height };
  if (!isPng && blob.size >= file.size) return { file, width, height };
  const baseName = file.name.replace(/\.[^.]+$/, "") || "gdp-photo";
  const extension = outputType === "image/webp" ? ".webp" : ".jpg";
  const optimized = new File([blob], baseName + extension, { type: outputType, lastModified: file.lastModified });
  return { file: optimized, width: outputWidth, height: outputHeight };
}

async function uploadWithRetry(file, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await customerApi.uploadArtwork(file);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 650));
    }
  }
  throw lastError || new Error("Upload failed.");
}

export default function CustomStudio() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [product, setProduct] = useState(null);
  const [occasionGroup, setOccasionGroup] = useState("");
  const [occasion, setOccasion] = useState("");
  const [recipientType, setRecipientType] = useState("");
  const [designStyle, setDesignStyle] = useState("");
  const [designMood, setDesignMood] = useState("");
  const [designIntensity, setDesignIntensity] = useState(null);
  const [garment, setGarment] = useState(FALLBACK_GARMENT);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [placement, setPlacement] = useState("front");
  const [groupGarments, setGroupGarments] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [warn, setWarn] = useState("");
  const [personalization, setPersonalization] = useState({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "" });
  const [story, setStory] = useState("");
  const [needByDate, setNeedByDate] = useState("");
  const [priority, setPriority] = useState("standard");
  const [proofRequired, setProofRequired] = useState(true);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [approvalAcknowledged, setApprovalAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewSide, setPreviewSide] = useState("front");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [artworkStates, setArtworkStates] = useState(() => defaultArtworkStates());
  const activeArtworkState = artworkStates[previewSide] || artworkStates.front;
  const artworkScale = Number(activeArtworkState.scale ?? 92);
  const artworkRotation = Number(activeArtworkState.rotation ?? 0);
  const artworkOffset = activeArtworkState.offset || { x: 0, y: 0 };
  const artworkFitMode = activeArtworkState.fitMode || "fit";
  const updateArtworkState = (field, valueOrUpdater) => {
    setArtworkStates((currentStates) => {
      const current = currentStates[previewSide] || defaultArtworkState();
      const currentValue = current[field];
      const nextValue = typeof valueOrUpdater === "function"
        ? valueOrUpdater(currentValue)
        : valueOrUpdater;
      return {
        ...currentStates,
        [previewSide]: { ...current, [field]: nextValue },
      };
    });
  };
  const setArtworkScale = (value) => updateArtworkState("scale", value);
  const setArtworkRotation = (value) => updateArtworkState("rotation", value);
  const setArtworkOffset = (value) => updateArtworkState("offset", value);
  const setArtworkFitMode = (value) => updateArtworkState("fitMode", value);
  const setArtworkSourcePhotoIndex = (value) => updateArtworkState("sourcePhotoIndex", value);
  const [showGuides, setShowGuides] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showIntensityExamples, setShowIntensityExamples] = useState(false);
  const [studioSettings, setStudioSettings] = useState(() => normalizeStudioSettings(DEFAULT_STUDIO_SETTINGS));
  const [showOrderGuide, setShowOrderGuide] = useState(DEFAULT_STUDIO_SETTINGS.orderGuideEnabled);
  const mobileEndRef = useRef(null);
  const [mobileDockVisible, setMobileDockVisible] = useState(true);
  const styleTemplates = normalizeStyleTemplates(studioSettings.styleTemplates);
  const activeStyleTemplate = designStyle ? styleTemplateForName(designStyle, studioSettings.styleTemplates) : null;

  useEffect(() => {
    const node = mobileEndRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setMobileDockVisible(!entry.isIntersecting),
      { rootMargin: "0px 0px 96px 0px", threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const productId = params.get("product");
        const requestedOccasionGroup = String(params.get("occasion") || "").toLowerCase();
        if (requestedOccasionGroup && OCCASIONS.some((group) => group.id === requestedOccasionGroup)) {
          setOccasionGroup(requestedOccasionGroup);
        }
        const [studioCatalog, loadedStudioSettings] = await Promise.all([
          customerApi.getStudioCatalog(),
          customerApi.getCustomStudioSettings().catch(() => ({})),
        ]);
        const nextStudioSettings = normalizeStudioSettings(loadedStudioSettings);
        let p = null;
        if (productId) {
          const requestedBlank = studioCatalog.find((item) => item.id === productId);
          if (requestedBlank) {
            p = requestedBlank;
          } else if (studioCatalog.length) {
            const legacyProduct = await customerApi.getProduct(productId);
            p = studioCatalog.find((item) => item.type === legacyProduct?.type) || null;
          } else {
            p = await customerApi.getProduct(productId);
          }
        }

        if (!active) return;
        setStudioSettings(nextStudioSettings);
        setShowOrderGuide(nextStudioSettings.orderGuideEnabled !== false);
        setCatalog(studioCatalog);
        if (!p) return;

        const colors = productColors(p);
        const requestedColor = String(params.get("color") || "");
        const initialColor = colors.find((item) => item.toLowerCase() === requestedColor.toLowerCase()) || colors[0] || "";
        const sizes = productSizes(p, initialColor);
        const requestedSize = String(params.get("size") || "");
        const initialSize = sizes.find((item) => item.toLowerCase() === requestedSize.toLowerCase()) || "";
        setProduct(p);
        setGarment(garmentFromProduct(p));
        setColor(initialColor);
        setSize(initialSize);
        setProofRequired(p?.customization?.proofRequired !== false);
      } catch (error) {
        if (active) setWarn(error?.message || "Could not load the Custom Studio garment catalog.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const chooseProduct = (nextProduct) => {
    if (!nextProduct) return;
    const colors = productColors(nextProduct);
    const nextColor = color && colors.includes(color) ? color : colors[0] || "";
    const sizes = productSizes(nextProduct, nextColor);
    const nextSize = size && sizes.includes(size) ? size : "";
    setProduct(nextProduct);
    setGarment(garmentFromProduct(nextProduct));
    setColor(nextColor);
    setSize(nextSize);
    setGroupGarments([]);
    setProofRequired(nextProduct?.customization?.proofRequired !== false);
    const allowedStyles = nextProduct?.customization?.allowedStyles || [];
    const styleStillAllowed = Boolean(designStyle) && (!allowedStyles.length || allowedStyles.includes(designStyle));
    if (designStyle && !styleStillAllowed) {
      setDesignStyle("");
      setArtworkStates(defaultArtworkStates());
    }
    setPreviewSide("front");
  };

  const config = product?.customization || {};
  const mobileFloatingCtaEnabled = studioSettings.mobileFloatingCtaEnabled === true;
  const priceVisibility = ["hidden", "total", "all"].includes(studioSettings.priceVisibility) ? studioSettings.priceVisibility : "hidden";
  const showGarmentPrices = priceVisibility === "all";
  const showOrderPrice = priceVisibility !== "hidden";
  const intensityExamplesEnabled = studioSettings.intensityExamplesEnabled !== false;
  const intensityExampleImageUrl = studioSettings.intensityExampleImageUrl || DEFAULT_STUDIO_SETTINGS.intensityExampleImageUrl;
  const intensityImages = normalizeIntensityExamples(studioSettings.intensityExamples);
  const recommendedIntensity = Math.min(5, Math.max(1, Number(studioSettings.defaultDesignIntensity || 3)));
  const selectedIntensityImage = designIntensity ? (intensityImages[String(designIntensity)] || "") : "";
  const hasIntensityOverrides = Object.values(intensityImages).some((value) => Boolean(value));
  const showCombinedIntensityGuide = studioSettings.showCombinedIntensityGuide !== false;
  const intensityLevel = DESIGN_INTENSITY_LEVELS[designIntensity] || DESIGN_INTENSITY_LEVELS[recommendedIntensity];
  const allowedStyleNames = config.allowedStyles || [];
  const configuredStyleOptions = styleTemplates.filter((style) =>
    style.enabled && (!allowedStyleNames.length || allowedStyleNames.includes(style.name))
  );
  const styleOptions = configuredStyleOptions.length
    ? configuredStyleOptions
    : styleTemplates.filter((style) => style.enabled);
  const chooseStyleTemplate = (style) => {
    if (!style) return;
    setDesignStyle(style.name);
    setArtworkStates((current) => ({
      front: {
        ...defaultArtworkState(style),
        sourcePhotoIndex: Number(current?.front?.sourcePhotoIndex || 0),
      },
      back: {
        ...defaultArtworkState(style),
        sourcePhotoIndex: Number(current?.back?.sourcePhotoIndex || 0),
      },
    }));
  };
  const maxPhotos = Number(config.maxPhotos || 10);
  const minPhotos = Number(config.minPhotos || 1);
  const revisions = Number(config.includedRevisions || 2);
  const rushFee = Number(config.rushDesignFee || 10) + Number(config.rushProductionFee || 15);
  const frontBackEnabled = studioSettings.frontBackEnabled !== false;
  const frontBackFee = Math.max(0, Number(studioSettings.frontBackFee ?? 10) || 0);
  const availableColors = productColors(product);
  const availableSizes = productSizes(product, color);
  const previewColor = color || availableColors[0] || garment?.defaultColor || "Black";
  const selectedVariant = variantFor(product, color, size);
  const selectedAvailable = variantAvailable(product, selectedVariant);

  useEffect(() => {
    if (size && availableSizes.length && !availableSizes.includes(size)) {
      setSize("");
    }
  }, [color, product?.id, size, availableSizes.join("|")]);

  useEffect(() => {
    if (!frontBackEnabled && placement !== "front") {
      setPlacement("front");
      setPreviewSide("front");
    }
  }, [frontBackEnabled, placement]);

  const extrasPerUnit = (frontBackEnabled && placement === "front_back" ? frontBackFee : 0) + (priority === "rush" ? rushFee : 0);
  const priceFor = (itemColor, itemSize) => {
    if (!product) return 0;
    const variant = variantFor(product, itemColor, itemSize);
    const base = variant?.price == null ? Number(product?.price || garment.price || 0) : Number(variant.price || 0);
    return Math.round((base + extrasPerUnit) * 100) / 100;
  };

  const unitPrice = priceFor(color, size);
  const totalUnits = qty + groupGarments.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const estimatedSubtotal = Math.round((
    unitPrice * qty +
    groupGarments.reduce((sum, item) => sum + priceFor(item.color, item.size) * Number(item.quantity || 0), 0)
  ) * 100) / 100;
  const primaryPhoto = photos.find(photo => photo.isPrimary) || photos[0] || null;
  const artworkPhotoForSide = (side) => {
    const state = artworkStates[side] || defaultArtworkState();
    const index = Math.min(
      Math.max(0, Number(state.sourcePhotoIndex || 0)),
      Math.max(0, photos.length - 1)
    );
    return photos[index] || primaryPhoto;
  };
  const previewArtworkPhoto = artworkPhotoForSide(previewSide);
  const frontArtworkPhoto = artworkPhotoForSide("front");
  const backArtworkPhoto = artworkPhotoForSide("back");
  const activeSideHasPrint =
    (previewSide === "front" && placement !== "back") ||
    (previewSide === "back" && placement !== "front");

  const resetPreviewPlacement = () => {
    setArtworkStates((current) => ({
      ...current,
      [previewSide]: {
        ...defaultArtworkState(activeStyleTemplate),
        sourcePhotoIndex: Number(current?.[previewSide]?.sourcePhotoIndex || 0),
      },
    }));
    setPreviewZoom(1);
  };

  async function uploadFiles(files) {
    setWarn("");
    const incoming = Array.from(files).slice(0, maxPhotos - photos.length);
    if (!incoming.length || uploading) return;

    const valid = [];
    const errors = [];
    for (const file of incoming) {
      if (file.size > MAX_MB * 1024 * 1024) errors.push(file.name + " is larger than " + MAX_MB + "MB.");
      else if (!["image/jpeg","image/png","image/webp"].includes(file.type)) errors.push(file.name + " is not JPG, PNG, or WEBP.");
      else valid.push(file);
    }
    if (errors.length) setWarn(errors.join(" "));
    if (!valid.length) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: valid.length });
    const results = new Array(valid.length);
    let cursor = 0;
    let completed = 0;

    async function worker() {
      while (cursor < valid.length) {
        const index = cursor++;
        const original = valid[index];
        try {
          const prepared = await prepareImageForUpload(original);
          const uploaded = await uploadWithRetry(prepared.file);
          results[index] = {
            url: uploaded.file_url,
            path: uploaded.storage_path,
            name: original.name,
            width: prepared.width,
            height: prepared.height,
            quality: qualityFor(prepared.width, prepared.height)
          };
        } catch (error) {
          errors.push(error?.message || ("Upload failed for " + original.name + "."));
        } finally {
          completed += 1;
          setUploadProgress({ done: completed, total: valid.length });
        }
      }
    }

    const workerCount = window.innerWidth < 768 ? 1 : Math.min(2, valid.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const uploadedPhotos = results.filter(Boolean);
    setPhotos(prev => {
      const hadPrimary = prev.some(p => p.isPrimary);
      return [...prev, ...uploadedPhotos.map((photo, index) => ({ ...photo, isPrimary: !hadPrimary && index === 0 }))];
    });
    if (errors.length) setWarn(errors.join(" "));
    setUploading(false);
  }

  const setPrimary = index => setPhotos(prev => prev.map((photo, i) => ({ ...photo, isPrimary: i === index })));
  const removePhoto = index => {
    setPhotos(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length && !next.some(p => p.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
    setArtworkStates((current) => {
      const adjustSourceIndex = (state) => {
        const sourceIndex = Number(state?.sourcePhotoIndex || 0);
        const nextIndex = sourceIndex === index ? 0 : (sourceIndex > index ? sourceIndex - 1 : sourceIndex);
        return { ...state, sourcePhotoIndex: Math.max(0, nextIndex) };
      };
      return {
        front: adjustSourceIndex(current.front),
        back: adjustSourceIndex(current.back),
      };
    });
  };

  const addGroupGarment = () => setGroupGarments(prev => [...prev, { size, color, quantity: 1 }]);
  const updateGroup = (index, patch) => setGroupGarments(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  const removeGroup = index => setGroupGarments(prev => prev.filter((_, i) => i !== index));

  const canContinue = () => {
    if (step === 1) return Boolean(product) && Boolean(color) && Boolean(size) && selectedAvailable;
    if (step === 2) return Boolean(occasionGroup) && Boolean(occasion);
    if (step === 3) return Boolean(designStyle) && Boolean(designMood);
    if (step === 4) return photos.length >= minPhotos && Boolean(designIntensity);
    if (step === 6) return rightsConfirmed && approvalAcknowledged;
    return true;
  };

  async function createAndAdd() {
    if (!rightsConfirmed || !approvalAcknowledged || photos.length < minPhotos) return;
    if (!product?.id) {
      setWarn("Choose a garment before adding your custom design to cart.");
      return;
    }
    if (!color || !size) {
      setWarn("Choose a color and size before adding your custom design to cart.");
      return;
    }
    if (!occasion || !designStyle || !designMood || !designIntensity) {
      setWarn("Complete the occasion, GDP style, mood and design intensity before adding to cart.");
      return;
    }
    if (product?.variants?.length && !selectedAvailable) {
      setWarn("The selected color and size is currently unavailable. Choose another variant.");
      return;
    }

    setSaving(true);
    try {
      let primaryIndex = photos.findIndex(p => p.isPrimary);
      if (primaryIndex < 0) primaryIndex = 0;
      const productId = product.id;
      const normalizedGroups = groupGarments.map((item) => {
        const variant = variantFor(product, item.color, item.size);
        return {
          ...item,
          variantId: variant?.id || null,
          variantName: variant?.name || "",
          unitPrice: priceFor(item.color, item.size)
        };
      });

      const design = await customerApi.createCustomDesign({
        productId,
        productName: product?.name || garment.label,
        name: personalization.name || (occasion + " Custom Design"),
        designStyle,
        photos: photos.map(p => p.url),
        photoAssets: photos,
        personalization: {
          ...personalization,
          previewState: {
            version: 5,
            side: previewSide,
            styleTemplateId: activeStyleTemplate?.id || null,
            styleTemplateAssetUrl: activeStyleTemplate?.assetUrl || "",
            styleTemplatePhotoZone: activeStyleTemplate?.photoZone || null,
            styleTemplateTextZone: activeStyleTemplate?.textZone || null,
            designMood,
            moodTreatmentVersion: 1,
            artworkScale,
            artworkRotation,
            artworkOffset,
            artworkFitMode,
            viewZoom: previewZoom,
            sourcePhotoIndex: Number(activeArtworkState.sourcePhotoIndex || 0),
            artworkBySide: {
              front: { ...artworkStates.front },
              back: { ...artworkStates.back },
            },
            garmentId: productId,
            variantId: selectedVariant?.id || null,
            conceptOnly: true,
            templateComposite: true
          }
        },
        placement,
        color,
        size,
        previewUrl: photos[primaryIndex]?.url || "",
        occasion,
        recipientType,
        designMood,
        story,
        designIntensity,
        garmentTier: garment.tier,
        needByDate: needByDate || undefined,
        priority,
        proofRequired,
        revisionAllowance: revisions,
        primaryPhotoIndex: primaryIndex,
        customerConfirmedRights: rightsConfirmed,
        approvalPolicyAcknowledged: approvalAcknowledged,
        additionalGarments: normalizedGroups,
        status: "in_cart"
      });

      const common = {
        productId,
        name: product?.name || garment.label,
        image: product?.images?.[0] || photos[primaryIndex]?.url || "",
        isCustom: true,
        customDesignId: design.id,
        fulfillmentMode: product?.fulfillmentMode || "in_house",
        designStyle,
        occasion,
        needByDate,
        priority,
        proofRequired
      };

      addItem({
        ...common,
        variantId: selectedVariant?.id || null,
        variant: selectedVariant?.name || garment.label,
        price: unitPrice,
        size,
        color,
        quantity: qty
      });

      normalizedGroups.forEach((item) => {
        addItem({
          ...common,
          variantId: item.variantId,
          variant: item.variantName || garment.label,
          price: item.unitPrice,
          size: item.size,
          color: item.color,
          quantity: Number(item.quantity || 1)
        });
      });

      navigate("/cart");
    } catch (error) {
      setWarn(error?.message || "Could not save your custom design.");
      setSaving(false);
    }
  }

  const activeOccasion = OCCASIONS.find(group => group.id === occasionGroup) || null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F4F7FA_0%,#EDF2F6_38%,#F8FAFC_100%)]">
      <div className="max-w-[1540px] mx-auto px-4 lg:px-8 py-6 md:py-10">
        <div className="relative overflow-hidden rounded-[28px] border border-[#DCE3EA] bg-[linear-gradient(135deg,#FFFFFF_0%,#f3ece2_100%)] px-5 py-7 md:px-9 md:py-9 mb-7 shadow-[0_20px_60px_rgba(32,28,22,.07)]">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/[0.06] blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.28em] text-accent">GDP Custom Studio</span>
              <h1 className="font-display text-4xl md:text-6xl leading-[.94] mt-2 text-[#17324D]">MAKE IT PERSONAL</h1>
              <p className="text-[#69645d] max-w-2xl mt-3 leading-relaxed">Turn your favorite people, pets and memories into wearable art. Build the concept here, then a real GDP designer reviews it before production.</p>
            </div>
            <div className="inline-flex items-center gap-2 self-start lg:self-auto rounded-full border border-[#ded7cd] bg-white/75 px-3.5 py-2 text-[11px] font-semibold text-[#4f4b46] shadow-sm">
              <ShieldCheck size={15} className="text-accent" /> Designer reviewed · Proof before printing · Secure checkout
            </div>
          </div>
        </div>

        <div className="mb-7">
          <div className="md:hidden mb-3">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wide text-[#736d65]"><span>Step {step} of {STEPS.length}</span><span>{STEPS[step - 1]}</span></div>
            <div className="h-1.5 rounded-full bg-[#E3E9EF] mt-2 overflow-hidden"><div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${(step / STEPS.length) * 100}%` }} /></div>
          </div>
          <div className="hidden md:flex items-center gap-0 rounded-2xl border border-[#DCE3EA] bg-white/70 p-2 shadow-sm overflow-x-auto">
            {STEPS.map((label, index) => {
              const number = index + 1;
              const complete = step > number;
              const active = step === number;
              return <React.Fragment key={label}>
                <button onClick={() => number < step && setStep(number)} className={"group flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap transition " + (active ? "bg-[#17324D] text-white shadow-sm" : complete ? "text-accent" : "text-[#8b857d]")}>
                  <span className={"grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold " + (active ? "border-white/30" : complete ? "border-accent/30 bg-accent/[0.06]" : "border-[#d8d2c9]")}>{complete ? <Check size={12} /> : number}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
                </button>
                {number < STEPS.length && <div className={"h-px min-w-5 flex-1 " + (complete ? "bg-accent/35" : "bg-[#ddd7cf]")} />}
              </React.Fragment>;
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#DCE3EA] bg-white px-3 py-2.5 shadow-sm">
            <button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE3EA] bg-white px-4 py-2.5 font-bold uppercase text-xs text-[#17324D] hover:border-[#9fb0c0]"><ArrowLeft size={16}/>{step === 1 ? "Back" : "Previous"}</button>
            {step < STEPS.length
              ? <button disabled={!canContinue()} onClick={() => canContinue() && setStep(step + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#17324D] px-5 py-2.5 font-bold uppercase text-xs text-white shadow-sm disabled:opacity-40">Continue <ArrowRight size={16}/></button>
              : <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold uppercase text-xs text-white shadow-sm disabled:opacity-40">{saving ? "Saving…" : "Add to cart"} <ArrowRight size={16}/></button>}
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[#DCE3EA] bg-white/75 shadow-sm">
            <button
              type="button"
              onClick={() => setShowOrderGuide((visible) => !visible)}
              aria-expanded={showOrderGuide}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[#fbf8f3] transition"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles size={15} className="text-accent" />
                <span className="text-[12px] md:text-[13px] font-extrabold uppercase tracking-[0.07em] text-[#26231f]">How Custom Orders Work</span>
                <span className="hidden sm:inline text-[12px] leading-relaxed text-[#5f5951]">A quick guide from blank garment to finished order.</span>
              </span>
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-accent">{showOrderGuide ? "Hide guide" : "View guide"}</span>
            </button>

            {showOrderGuide && <div className="border-t border-[#ebe5dc]">
              <div className="overflow-x-auto">
                <div className="grid min-w-[1120px] grid-cols-7 divide-x divide-[#e4ddd3]">
                  {ORDER_GUIDE_STEPS.map((guide, index) => {
                    const number = index + 1;
                    const active = number === step;
                    const complete = number < step;
                    return <button
                      type="button"
                      key={guide.title}
                      onClick={() => number < step && setStep(number)}
                      className={"p-4 text-left transition " + (active ? "bg-accent/[0.065]" : complete ? "bg-[#F8FAFC]" : "bg-white/50") + (number < step ? " hover:bg-[#f7f2eb]" : "")}
                    >
                      <div className="flex items-center gap-2">
                        <span className={"grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[10px] font-bold " + (active ? "border-accent bg-accent text-white" : complete ? "border-accent/40 text-accent" : "border-[#d0c8bd] text-[#5f5951]")}>{complete ? <Check size={12}/> : number}</span>
                        <span className={"text-[11px] md:text-[12px] font-extrabold uppercase tracking-[0.035em] leading-tight " + (active ? "text-accent" : "text-[#302c27]")}>{guide.title}</span>
                      </div>
                      <p className="mt-2.5 text-[12px] leading-[1.55] font-medium text-[#5a544c]">{guide.detail}</p>
                    </button>;
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-[#ebe5dc] bg-[#17212B] px-4 py-3 text-white sm:flex-row sm:items-center">
                <span className="shrink-0 text-[10px] md:text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">After you order</span>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[11px] md:text-[12px] font-medium text-white/85">
                  {AFTER_ORDER_STEPS.map((item, index) => <React.Fragment key={item}>
                    <span className="inline-flex items-center gap-1.5"><Check size={12} className="text-accent" />{item}</span>
                    {index < AFTER_ORDER_STEPS.length - 1 && <ArrowRight size={11} className="hidden sm:block text-white/35" />}
                  </React.Fragment>)}
                </div>
              </div>
            </div>}
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)] gap-6 items-start">
          <section className="bg-[#FFFFFF] border border-[#e2dcd3] rounded-[24px] p-4 md:p-8 min-h-[560px] shadow-[0_18px_50px_rgba(28,24,20,.055)]">
          {step === 2 && <div>
            <StepTitle eyebrow="Start with the reason" title="WHAT ARE YOU MAKING?" text="Choose the story first. The occasion helps us match the emotion, composition and visual direction before you upload photos." />

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {OCCASIONS.map(group => {
                const Icon = group.icon;
                const selected = occasionGroup === group.id;
                return <button
                  type="button"
                  key={group.id}
                  aria-pressed={selected}
                  onClick={() => { setOccasionGroup(group.id); setOccasion(""); }}
                  className={"group overflow-hidden rounded-[20px] border bg-white text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 " + (selected
                    ? "border-accent shadow-[0_16px_38px_rgba(25,22,18,.11)] -translate-y-0.5"
                    : "border-[#ddd7ce] hover:border-[#b8aea2] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(25,22,18,.08)]")}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#ece7df]">
                    <img
                      src={group.image}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className={"h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] " + (group.imagePosition || "")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/5" />
                    <span className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-white/90 text-[#1f1c18] shadow-sm backdrop-blur">
                      <Icon size={17} strokeWidth={2.2} />
                    </span>
                    {selected && <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-white shadow-sm">
                      <Check size={12} strokeWidth={3} /> Selected
                    </span>}
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <div className="text-[18px] font-extrabold leading-tight text-white drop-shadow-sm">{group.label}</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="min-h-[40px] text-[13px] font-medium leading-[1.55] text-[#6b645c]">{group.summary}</p>
                    <div className={"mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] " + (selected ? "text-accent" : "text-[#4e4943]")}>
                      {selected ? "Occasion selected" : "Choose occasion"} <ArrowRight size={13} />
                    </div>
                  </div>
                </button>;
              })}
            </div>

            <div className="mt-7 rounded-[20px] border border-[#e3ddd4] bg-[#faf8f4] p-4 md:p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#756f67]">Choose a specific occasion</label>
                  <p className="mt-1 text-sm font-semibold text-[#292621]">{activeOccasion ? `What best describes this ${activeOccasion.label.toLowerCase()} design?` : "Choose an occasion category above first."}</p>
                </div>
                <span className="text-[11px] font-semibold text-[#8a837a]">{activeOccasion?.options.length || 0} options</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(activeOccasion?.options || []).map(option => {
                  const selected = occasion === option;
                  return <button
                    type="button"
                    key={option}
                    aria-pressed={selected}
                    onClick={() => setOccasion(option)}
                    className={"rounded-full border px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 " + (selected
                      ? "border-[#1d1b18] bg-[#1d1b18] text-white shadow-sm"
                      : "border-[#d9d2c8] bg-white text-[#4d4841] hover:border-[#a69d91] hover:bg-[#fffdfa]")}
                  >
                    {option}
                  </button>;
                })}
              </div>
            </div>

            <div className="mt-5 rounded-[20px] border border-[#e9e3db] bg-white px-4 pb-4 pt-1 md:px-5 md:pb-5">
              <Field label="Who is this for? (optional)" value={recipientType} onChange={setRecipientType} placeholder="e.g. Dad, Sarah, Coach Mike, Milo the dog…" />
              <p className="mt-2 text-xs leading-relaxed text-[#817a72]">A name or relationship gives the designer more context. You can add exact names, dates and wording later.</p>
            </div>
          </div>}

          {step === 3 && <div>
            <StepTitle eyebrow="Choose the visual direction" title="PICK A GDP STYLE" text="You choose the vibe. Our designer handles the actual composition." />
            <div className="grid md:grid-cols-2 gap-3">
              {styleOptions.map((style) => <button key={style.id} onClick={() => chooseStyleTemplate(style)} className={"grid min-h-[112px] grid-cols-[1fr_92px] items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 " + (designStyle === style.name ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.06)]" : "border-[#ddd7ce] bg-white/55 hover:border-accent hover:-translate-y-0.5")}>
                <div className="min-w-0">
                  <div className="font-bold">{style.name}</div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{style.description}</p>
                  <div className="mt-2 text-[9px] font-mono uppercase tracking-[0.12em] text-[#8a8279]">Photo-ready template</div>
                </div>
                <div className="relative aspect-square overflow-hidden rounded-xl border border-[#e2dcd3] bg-[linear-gradient(45deg,#f0ede8_25%,transparent_25%),linear-gradient(-45deg,#f0ede8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0ede8_75%),linear-gradient(-45deg,transparent_75%,#f0ede8_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0px]">
                  <img src={style.assetUrl} alt="" loading="lazy" className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] object-contain" />
                </div>
              </button>)}
            </div>
            <div className="mt-6">
              <label className="font-mono text-xs uppercase text-muted-foreground">Mood</label>
              <p className="mt-1 text-xs leading-relaxed text-[#7d766d]">Mood keeps the selected GDP layout but changes its live color, contrast and atmosphere.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {MOODS.map(mood => <button key={mood} onClick={() => setDesignMood(mood)} className={"px-3 py-2 border text-sm transition " + (designMood === mood ? "bg-[#17324D] text-white border-[#17324D] shadow-sm" : "border-border bg-white hover:border-[#9aa8b5]")}>{mood}</button>)}
              </div>
              <div className="mt-3 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] px-3 py-2.5 text-xs text-[#52616F]">
                {designMood ? <><span className="font-semibold text-[#17324D]">{designMood} preview:</span> {moodPreviewTreatment(designMood).description}</> : <span>Choose a mood to apply a live preview treatment.</span>}
              </div>
            </div>
          </div>}

          {step === 1 && <div>
            <StepTitle eyebrow="Choose your blank" title="CLOTHING, COLOR & SIZE" text="Pick the exact garment first. Colors, sizes, pricing and availability update automatically for that clothing type." />

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {(catalog.length ? catalog : (product ? [product] : [])).map((option) => {
                const optionGarment = garmentFromProduct(option);
                const optionImage = studioCardImage(option);
                const active = product?.id === option.id;
                return <button
                  type="button"
                  key={option.id}
                  onClick={() => chooseProduct(option)}
                  className={"group overflow-hidden rounded-2xl border text-left transition-all duration-200 " + (active ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.08)]" : "border-[#ddd7ce] bg-white/70 hover:border-accent hover:-translate-y-0.5")}
                >
                  <div className="aspect-[2/1] sm:aspect-[16/10] bg-[#f1ede6] overflow-hidden grid place-items-center">
                    {optionImage
                      ? <img src={optionImage} alt="" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
                      : <div className="h-[88%] aspect-[360/430]" aria-hidden="true">
                          <GarmentShape
                            type={optionGarment.previewType || optionGarment.type}
                            color={option?.colors?.[0] || "Black"}
                            side="front"
                          />
                        </div>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold leading-tight">{option.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{option.type || option.category || "Custom garment"}</div>
                      </div>
                      {active && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-white"><Check size={13}/></span>}
                    </div>
                    {showGarmentPrices && <div className="font-mono text-sm mt-3">From {"$" + Number(optionGarment.price).toFixed(2)}</div>}
                  </div>
                </button>;
              })}
            </div>

            {!product && catalog.length === 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No Custom Studio garments are currently published.</div>}
            {!product && catalog.length > 0 && <div className="mt-5 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 text-sm text-[#52616F]">Choose a garment above to begin. Nothing has been selected for you.</div>}

            {product && <>
              <div className="mt-7">
                <div className="flex items-center justify-between gap-3">
                  <label className="font-mono text-xs uppercase text-muted-foreground">Color</label>
                  <span className="text-xs font-semibold">{color}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availableColors.map((optionColor) => (
                    <button
                      type="button"
                      key={optionColor}
                      onClick={() => setColor(optionColor)}
                      className={"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition " + (color === optionColor ? "border-[#17324D] bg-[#17324D] text-white shadow-sm" : "border-[#ddd7ce] bg-white hover:border-[#aaa39a]")}
                    >
                      <span
                        className="h-5 w-5 rounded-full border border-black/15 shadow-inner"
                        style={{ backgroundColor: swatchFor(product, optionColor) }}
                      />
                      {optionColor}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-[1fr_auto] gap-5 mt-6 items-start">
                <div>
                  <label className="font-mono text-xs uppercase text-muted-foreground">Size</label>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                    {availableSizes.map((optionSize) => {
                      const optionVariant = variantFor(product, color, optionSize);
                      const enabled = variantAvailable(product, optionVariant);
                      const optionPrice = optionVariant?.price == null ? Number(product.price || 0) : Number(optionVariant.price || 0);
                      return <button
                        type="button"
                        key={optionSize}
                        disabled={!enabled}
                        onClick={() => enabled && setSize(optionSize)}
                        title={!enabled ? "Unavailable" : ""}
                        className={"w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:w-auto sm:min-w-14 " + (size === optionSize ? "border-accent bg-accent/[0.07] text-accent" : enabled ? "border-[#ddd7ce] bg-white hover:border-accent" : "border-[#e5e0d9] bg-[#f4f1ec] text-[#aaa39a] line-through cursor-not-allowed")}
                      >
                        <span>{optionSize}</span>
                        {showGarmentPrices && optionVariant?.price != null && optionPrice !== Number(product.price || 0) && <span className="block text-[8px] font-mono mt-0.5">{"$" + optionPrice.toFixed(2)}</span>}
                      </button>;
                    })}
                  </div>
                  {product.trackInventory === false && <div className="mt-2 text-[10px] text-[#817b73]">Made to order · inventory tracking is currently off for this blank.</div>}
                </div>

                <div>
                  <label className="font-mono text-xs uppercase text-muted-foreground">Quantity</label>
                  <div className="mt-2 flex items-center rounded-xl border border-[#ddd7ce] bg-white overflow-hidden w-fit">
                    <button type="button" onClick={() => setQty(v => Math.max(1,v-1))} className="p-2.5 hover:bg-[#f5f1eb]"><Minus size={15}/></button>
                    <span className="px-5 font-mono min-w-14 text-center">{qty}</span>
                    <button type="button" onClick={() => setQty(v => Math.min(99,v+1))} className="p-2.5 hover:bg-[#f5f1eb]"><Plus size={15}/></button>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="font-mono text-xs uppercase text-muted-foreground">Print sides</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Choice active={placement === "front"} onClick={() => { setPlacement("front"); setPreviewSide("front"); }}>Front only</Choice>
                  {frontBackEnabled && <Choice active={placement === "back"} onClick={() => { setPlacement("back"); setPreviewSide("back"); }}>Back only</Choice>}
                  {frontBackEnabled && <Choice active={placement === "front_back"} onClick={() => setPlacement("front_back")}>Front + back{showGarmentPrices ? " (+$" + frontBackFee.toFixed(2) + ")" : ""}</Choice>}
                </div>
                <p className="mt-2 text-[10px] text-[#817b73]">{frontBackEnabled ? "Front is the default. Back is optional and uses the Custom Studio additional-print surcharge." : "Custom Studio is currently configured for front printing only."}</p>
              </div>

              <div className="mt-7 border-t border-border pt-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold">Same design, different sizes or colors</div>
                    <p className="text-sm text-muted-foreground">Build a family, team or event order without recreating the design.</p>
                  </div>
                  <button type="button" onClick={addGroupGarment} className="text-accent text-sm font-bold inline-flex items-center gap-1 whitespace-nowrap"><Plus size={15}/> Add garment</button>
                </div>
                {groupGarments.map((item,index) => (
                  <GroupRow
                    key={index}
                    item={item}
                    product={product}
                    onChange={patch => updateGroup(index,patch)}
                    onRemove={() => removeGroup(index)}
                  />
                ))}
              </div>

              {!selectedAvailable && product?.variants?.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Choose an available size before continuing.</div>
              )}
            </>}
          </div>}

          {step === 4 && <div>
            <StepTitle eyebrow="Your memories" title="UPLOAD YOUR BEST PHOTOS" text={"Upload " + minPhotos + "–" + maxPhotos + " photos. We check resolution before you order so poor source images do not become surprise print problems."} />
            <label className={"border-2 border-dashed border-border min-h-44 flex flex-col items-center justify-center hover:border-accent " + (uploading ? "cursor-wait opacity-80" : "cursor-pointer")}>
              <Upload size={28}/>
              <div className="font-bold mt-2">{uploading ? "Optimizing & uploading…" : "Upload photos"}</div>
              {uploading && uploadProgress.total > 0 && <div className="font-mono text-xs mt-1">{uploadProgress.done}/{uploadProgress.total} complete · {Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</div>}
              <div className="text-xs text-muted-foreground mt-1">JPG, PNG or WEBP · max {MAX_MB}MB each</div>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={e => uploadFiles(e.target.files)} />
            </label>
            {warn && <div className="mt-3 bg-destructive/10 text-destructive px-3 py-2 text-sm flex items-center gap-2"><AlertTriangle size={15}/>{warn}</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              {photos.map((photo,index) => <PhotoCard key={photo.url} photo={photo} onPrimary={() => setPrimary(index)} onRemove={() => removePhoto(index)} />)}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-3">{photos.length}/{maxPhotos} photos</div>

            <div className="mt-7 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 md:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#64788A]">Design intensity</div>
                  <div className="mt-1 font-bold text-[#17324D]">How bold should the finished design feel?</div>
                  <p className="mt-1 text-xs leading-relaxed text-[#64707C]">Choose the visual density after selecting your photos. 3/5 Balanced is the recommended starting point.</p>
                </div>
                {intensityExamplesEnabled && <button type="button" onClick={() => setShowIntensityExamples(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#C9D4DE] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#17324D] hover:border-[#17324D]"><Info size={13}/> View examples</button>}
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {Object.entries(DESIGN_INTENSITY_LEVELS).map(([level, item]) => <button
                  key={level}
                  type="button"
                  onClick={() => setDesignIntensity(Number(level))}
                  className={"rounded-xl border px-1.5 py-3 text-center transition " + (Number(level) === designIntensity ? "border-[#17324D] bg-[#17324D] text-white shadow-sm" : "border-[#C9D4DE] bg-white text-[#44515D] hover:border-[#17324D]")}
                >
                  <div className="text-sm font-black">{level}/5</div>
                  <div className="mt-1 hidden text-[9px] font-semibold uppercase sm:block">{item.label}</div>
                </button>)}
              </div>
              <div className="mt-3 rounded-xl border border-[#DCE3EA] bg-white p-3">
                <div className="text-sm font-bold text-[#17324D]">{designIntensity ? `${designIntensity}/5 · ${intensityLevel.label}` : `Not selected · ${recommendedIntensity}/5 recommended`}</div>
                <p className="mt-1 text-[12px] leading-relaxed text-[#64707C]">{designIntensity ? intensityLevel.description : "Choose an intensity after reviewing your uploaded photos."}</p>
              </div>
            </div>
          </div>}

          {step === 5 && <div>
            <StepTitle eyebrow="Make it yours" title="TEXT + STORY" text="Separate printed text from designer notes so instructions never accidentally appear on the shirt." />
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Main name / headline" value={personalization.name} onChange={v => setPersonalization({...personalization,name:v})} placeholder="BIG MIKE" />
              <Field label="Nickname" value={personalization.nickname} onChange={v => setPersonalization({...personalization,nickname:v})} placeholder="THE LEGEND" />
              <Field label="Dates / year" value={personalization.dates} onChange={v => setPersonalization({...personalization,dates:v})} placeholder="1966 · 2026" />
              <Field label="Number" value={personalization.number} onChange={v => setPersonalization({...personalization,number:v})} placeholder="23" />
              <Field label="Quote or printed message" value={personalization.quote} onChange={v => setPersonalization({...personalization,quote:v})} placeholder="Forever in our hearts" />
              <Field label="Additional printed text" value={personalization.message} onChange={v => setPersonalization({...personalization,message:v})} placeholder="Optional" />
            </div>
            <TextArea label="Tell us the story" value={story} onChange={setStory} placeholder="Dad loves fishing, classic cars, and embarrassing us with dad jokes…" />
            <TextArea label="Notes for our designer — NOT printed" value={personalization.instructions} onChange={v => setPersonalization({...personalization,instructions:v})} placeholder="Use photo #1 in the center. Make the name large. Keep the overall look vintage." />
          </div>}

          {step === 6 && <div>
            <StepTitle eyebrow="Set expectations" title="TIMING + DESIGN PROOF" text="We would rather be transparent about timing than promise a date we cannot meet." />
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Need it by</label><input type="date" value={needByDate} onChange={e => setNeedByDate(e.target.value)} className="w-full border border-border bg-background px-3 py-2 mt-1"/></div>
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Priority</label><div className="flex gap-2 mt-1"><Choice active={priority === "standard"} onClick={() => setPriority("standard")}>Standard</Choice><Choice active={priority === "rush"} onClick={() => setPriority("rush")}>Rush (+{"$" + rushFee})</Choice></div></div>
            </div>
            <div className="mt-6 border border-border p-4"><div className="flex items-start gap-3"><ShieldCheck size={22} className="text-accent shrink-0"/><div><div className="font-bold">GDP Design Guarantee</div><p className="text-sm text-muted-foreground mt-1">{proofRequired ? "You receive a proof before printing with " + revisions + " included revision(s)." : "This product is configured to skip proofing."}</p></div></div></div>
            <label className="flex items-start gap-3 mt-5 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} className="mt-1"/><span>I confirm I own or have permission to reproduce the photos and artwork I submitted. <Link to="/pages/custom-artwork-policy" target="_blank" className="font-semibold text-accent hover:underline">Upload policy</Link></span></label>
            <label className="flex items-start gap-3 mt-3 text-sm"><input type="checkbox" checked={approvalAcknowledged} onChange={e => setApprovalAcknowledged(e.target.checked)} className="mt-1"/><span>I understand production begins after artwork approval and approved artwork cannot be changed after production starts. Customer uploads follow the <Link to="/pages/data-retention" target="_blank" className="font-semibold text-accent hover:underline">retention policy</Link>.</span></label>
          </div>}

          {step === 7 && <div>
            <StepTitle eyebrow="Final check" title="REVIEW YOUR CUSTOM ORDER" text="Nothing is printed yet. This saves your design and adds the selected garments to your cart." />
            <div className="grid md:grid-cols-2 gap-4">
              <ReviewCard label="Occasion" value={occasion || "Not selected"} sub={recipientType} />
              <ReviewCard label="Style" value={designStyle || "Not selected"} sub={designStyle ? `${designMood || "No mood"} · ${designIntensity ? `Intensity ${designIntensity}/5` : "Intensity not selected"}` : ""} />
              <ReviewCard label="Garment" value={product?.name || "Not selected"} sub={product ? `${color || "No color"} · ${size || "No size"} · Qty ${qty}` : ""} />
              <ReviewCard
                label="Print"
                value={placement === "front_back" ? "Front + back" : placement === "back" ? "Back only" : "Front only"}
                sub={placement === "front_back" ? "Two independent artwork placements saved." : "One print side selected."}
              />
              {placement !== "back" && <ReviewCard label="Front artwork" value={frontArtworkPhoto?.name || "Primary photo"} sub={"Scale " + Number(artworkStates.front?.scale ?? 92) + "% · rotation " + Number(artworkStates.front?.rotation ?? 0) + "°"} />}
              {placement !== "front" && <ReviewCard label="Back artwork" value={backArtworkPhoto?.name || "Primary photo"} sub={"Scale " + Number(artworkStates.back?.scale ?? 92) + "% · rotation " + Number(artworkStates.back?.rotation ?? 0) + "°"} />}
              <ReviewCard label="Photos" value={photos.length + " uploaded"} sub={photos.some(p => p.quality === "replace_recommended") ? "One or more photos should ideally be replaced." : "Photo quality check complete."} />
              <ReviewCard label="Proof" value={proofRequired ? "Required before print" : "Proof skipped"} sub={proofRequired ? revisions + " included revision(s)" : ""} />
              <ReviewCard label="Timing" value={priority === "rush" ? "Rush" : "Standard"} sub={needByDate ? "Need by " + needByDate : "No event date selected"} />
            </div>
            {groupGarments.length > 0 && <div className="mt-4 border border-border p-4"><div className="font-bold">Additional shirts using the same design</div>{groupGarments.map((g,i) => <div key={i} className="text-sm text-muted-foreground mt-1">{g.quantity}× {g.color} · {g.size}</div>)}</div>}
            {personalization.instructions && <div className="mt-4 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] p-4"><div className="font-mono text-[10px] uppercase tracking-wide text-[#64788A]">Designer notes · not printed</div><div className="mt-1 text-sm leading-relaxed text-[#44515D]">{personalization.instructions}</div></div>}
            {showOrderPrice && <div className="mt-6 bg-secondary p-5 flex items-end justify-between gap-4"><div><div className="font-mono text-xs uppercase text-muted-foreground">Estimated custom subtotal</div><div className="text-xs text-muted-foreground mt-1">Before cart discounts, shipping, tax or coupon.</div></div><div className="font-display text-4xl">{"$" + estimatedSubtotal.toFixed(2)}</div></div>}
            <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="w-full mt-5 bg-accent text-accent-foreground py-4 font-bold uppercase tracking-wide disabled:opacity-50">{saving ? "Saving custom design…" : "Add Custom Order to Cart →"}</button>
          </div>}
        </section>

          <aside className="h-fit lg:sticky lg:top-24 space-y-4">
            <div className="overflow-hidden rounded-[24px] border border-[#dcd5ca] bg-white shadow-[0_18px_55px_rgba(25,22,18,.085)]">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[#ebe5dc] bg-[#FFFFFF]">
                <div>
                  <div className="font-mono text-[10px] sm:text-[9px] uppercase tracking-[0.18em] text-accent">Live garment preview</div>
                  <div className="text-sm font-semibold mt-0.5 text-[#25231f]">{product?.name || "Choose a garment"}</div>
                </div>
                <button type="button" onClick={() => setFullscreenPreview(true)} className="h-9 w-9 grid place-items-center rounded-xl border border-[#ddd6cc] bg-white text-[#5d5851] hover:border-accent hover:text-accent" aria-label="Open full screen preview"><Maximize2 size={15} /></button>
              </div>

              <StudioPreview
                garment={garment}
                color={previewColor}
                side={previewSide}
                placement={placement}
                photo={previewArtworkPhoto}
                uploading={uploading}
                personalization={personalization}
                zoom={previewZoom}
                setZoom={setPreviewZoom}
                artworkScale={artworkScale}
                artworkRotation={artworkRotation}
                artworkOffset={artworkOffset}
                setArtworkOffset={setArtworkOffset}
                artworkFitMode={artworkFitMode}
                showGuides={showGuides}
                showMeasurements={showMeasurements}
                size={size}
                previewConfig={config.preview || {}}
                styleTemplate={activeStyleTemplate}
                mood={designMood}
              />

              <div className="p-4 border-t border-[#ebe5dc] bg-[#FFFFFF]">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl border border-[#ddd6cc] bg-[#f5f0e9] p-1">
                    <button type="button" onClick={() => setPreviewSide("front")} className={"rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase " + (previewSide === "front" ? "bg-[#17324D] text-white" : "text-[#756f67]")}>Front</button>
                    <button type="button" onClick={() => setPreviewSide("back")} className={"rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase " + (previewSide === "back" ? "bg-[#17324D] text-white" : "text-[#756f67]")}>Back</button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPreviewZoom(v => clampPreview(v - .1))} className="h-8 w-8 grid place-items-center rounded-lg border border-[#ddd6cc]" aria-label="Zoom out"><ZoomOut size={14} /></button>
                    <span className="w-10 text-center font-mono text-[10px] text-[#746e66]">{Math.round(previewZoom * 100)}%</span>
                    <button type="button" onClick={() => setPreviewZoom(v => clampPreview(v + .1))} className="h-8 w-8 grid place-items-center rounded-lg border border-[#ddd6cc]" aria-label="Zoom in"><ZoomIn size={14} /></button>
                  </div>
                </div>

                {previewArtworkPhoto && activeSideHasPrint && <div className="mt-4 space-y-3">
                  {photos.length > 1 && <div>
                    <div className="font-mono text-[9px] uppercase text-[#756f67]">Artwork photo</div>
                    <select
                      value={Number(activeArtworkState.sourcePhotoIndex || 0)}
                      onChange={(e) => setArtworkSourcePhotoIndex(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-[#DCE3EA] bg-white px-2.5 py-2 text-xs text-[#44515D]"
                    >
                      {photos.map((photo, index) => <option key={photo.url || index} value={index}>{index + 1}. {photo.name || "Uploaded photo"}</option>)}
                    </select>
                  </div>}
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-[#756f67]"><span>Design size</span><span>{artworkScale}%</span></div>
                    <input type="range" min="55" max="145" value={artworkScale} onChange={e => setArtworkScale(Number(e.target.value))} className="w-full accent-[#17324D]" />
                    <div className="mt-2 inline-flex rounded-lg border border-[#DCE3EA] bg-[#F4F7FA] p-1">
                      <button type="button" onClick={() => setArtworkFitMode("fit")} className={"rounded-md px-3 py-1.5 text-[10px] font-bold uppercase " + (artworkFitMode === "fit" ? "bg-[#17324D] text-white" : "text-[#64707C]")}>Fit · no crop</button>
                      <button type="button" onClick={() => setArtworkFitMode("crop")} className={"rounded-md px-3 py-1.5 text-[10px] font-bold uppercase " + (artworkFitMode === "crop" ? "bg-[#17324D] text-white" : "text-[#64707C]")}>Crop to fill</button>
                    </div>
                    {artworkFitMode === "crop" && <p className="mt-2 text-[10px] leading-relaxed text-[#8A5A48]">Crop to Fill intentionally trims image edges to fill the artwork box. Use Fit · No Crop to keep the complete image visible.</p>}
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-[#756f67]"><span>Rotation</span><span>{artworkRotation}°</span></div>
                    <input type="range" min="-12" max="12" value={artworkRotation} onChange={e => setArtworkRotation(Number(e.target.value))} className="w-full accent-[#d9273e]" />
                  </div>
                </div>}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button type="button" onClick={() => setShowGuides(v => !v)} className="inline-flex items-center gap-1.5 text-[11px] sm:text-[10px] font-semibold text-[#706a62] hover:text-accent"><Eye size={13} /> {showGuides ? "Hide print guide" : "Show print guide"}</button>
                    <button type="button" onClick={() => setShowMeasurements(v => !v)} className="inline-flex items-center gap-1.5 text-[11px] sm:text-[10px] font-semibold text-[#706a62] hover:text-accent"><Ruler size={13} /> {showMeasurements ? "Hide measurements" : "Show measurements"}</button>
                  </div>
                  <button type="button" onClick={resetPreviewPlacement} className="inline-flex items-center gap-1.5 text-[11px] sm:text-[10px] font-semibold text-[#706a62] hover:text-accent"><RotateCcw size={13} /> Reset</button>
                </div>
                <p className="mt-2 text-[10px] font-mono uppercase tracking-wide text-[#8f887f]">Recommended print zone updates after you choose a garment and size.</p>
                <p className="mt-2 text-[11px] sm:text-[10px] leading-relaxed text-[#7d766d]">Artwork controls activate after you choose a GDP style and upload a photo. Nothing is applied automatically.</p>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#ddd6cc] bg-[#17212B] text-white p-5 shadow-[0_14px_40px_rgba(20,18,16,.11)]">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Your order</div>
              <div className="font-display text-3xl mt-2">{occasion || "Build your order"}</div>
              <SummaryRow label="Style" value={designStyle ? designStyle.replace("GDP ","") : "Not selected"} />
              <SummaryRow label="Garment" value={product?.name || "Not selected"} />
              <SummaryRow label="Size / Color" value={size && color ? `${size} / ${color}` : "Not selected"} />
              <SummaryRow label="Photos" value={photos.length + "/" + maxPhotos} />
              <SummaryRow label="Total shirts" value={totalUnits} />
              <SummaryRow label="Proof" value={proofRequired ? "Before print" : "Skipped"} />
              {showOrderPrice && <div className="border-t border-white/15 mt-5 pt-4 flex justify-between items-end"><span className="text-[10px] uppercase font-mono text-white/45">{priceVisibility === "total" ? "Estimated subtotal" : "Unit price"}</span><span className="font-display text-3xl">{"$" + (priceVisibility === "total" ? estimatedSubtotal : unitPrice).toFixed(2)}</span></div>}
            </div>
          </aside>
      </div>

        <div ref={mobileEndRef} className="mt-6 flex justify-between gap-3 pb-8 md:pb-0">
          <button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d9d2c8] bg-white px-5 py-3 font-bold uppercase text-xs text-[#332f2a] shadow-sm hover:border-[#aaa198]"><ArrowLeft size={16}/>{step === 1 ? "Back" : "Previous"}</button>
          {step < STEPS.length && <button disabled={!canContinue()} onClick={() => canContinue() && setStep(step + 1)} className="inline-flex items-center gap-2 rounded-xl bg-[#17324D] text-white px-6 py-3 font-bold uppercase text-xs shadow-lg disabled:opacity-40">Continue <ArrowRight size={16}/></button>}
        </div>

        {mobileFloatingCtaEnabled && mobileDockVisible && <div className="md:hidden fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-white/10 bg-[#17324D]/95 backdrop-blur-xl text-white p-2 pl-3 shadow-2xl flex items-center justify-between gap-3">
          <div><div className="font-mono text-[8px] uppercase tracking-widest text-white/45">Custom piece</div><div className="font-display text-xl leading-none mt-1">{showOrderPrice ? "$" + (priceVisibility === "total" ? estimatedSubtotal : unitPrice).toFixed(2) : "GDP Studio"}</div></div>
          {step < STEPS.length ? <button disabled={!canContinue()} onClick={() => canContinue() && setStep(step + 1)} className="rounded-xl bg-white text-[#17324D] px-4 py-2.5 text-xs font-bold uppercase disabled:opacity-40">Continue →</button> : <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="rounded-xl bg-accent text-white px-4 py-2.5 text-xs font-bold uppercase disabled:opacity-40">{saving ? "Saving…" : "Add to cart →"}</button>}
        </div>}

        {showIntensityExamples && <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/70 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label="Design intensity examples">
          <button type="button" className="absolute inset-0" onClick={() => setShowIntensityExamples(false)} aria-label="Close design intensity examples" />
          <div className="relative z-10 w-full max-h-[92dvh] overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#F4F7FA] shadow-2xl sm:max-w-5xl sm:rounded-[28px]">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#ded8cf] bg-[#F4F7FA]/95 px-4 py-3.5 backdrop-blur sm:px-5">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent">Design intensity guide</div>
                <div className="mt-0.5 font-bold text-[#24211e]">From clean to full bootleg energy</div>
              </div>
              <button type="button" onClick={() => setShowIntensityExamples(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#d8d1c7] bg-white text-[#39342f]" aria-label="Close"><X size={16}/></button>
            </div>
            <div className="p-3 sm:p-5">
              {showCombinedIntensityGuide ? (
                !hasIntensityOverrides ? (
                  <div className="overflow-hidden rounded-2xl border border-[#ddd6cd] bg-white">
                    <img
                      src={intensityExampleImageUrl}
                      alt="Five bootleg rap T-shirt examples showing design intensity from 1 out of 5 clean to 5 out of 5 maximum chaos"
                      className="block h-auto w-full"
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        const fallback = DEFAULT_STUDIO_SETTINGS.intensityExampleImageUrl;
                        if (event.currentTarget.getAttribute("src") !== fallback) {
                          event.currentTarget.src = fallback;
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(DESIGN_INTENSITY_LEVELS).map(([level, item]) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => { setDesignIntensity(Number(level)); setShowIntensityExamples(false); }}
                        className={"grid w-full grid-cols-[68px_1fr] gap-3 overflow-hidden rounded-2xl border text-left transition sm:grid-cols-[78px_1fr_210px] " + (Number(level) === designIntensity ? "border-accent bg-accent/[0.045]" : "border-[#ddd6cd] bg-white hover:border-accent")}
                      >
                        <div className="grid place-items-center bg-[#1c1b19] px-2 py-4 text-white">
                          <div className="text-center">
                            <div className="text-xl font-black">{level}/5</div>
                            <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-white/60">{item.label}</div>
                          </div>
                        </div>
                        <div className="self-center py-3 pr-3 sm:pr-0">
                          <div className="text-sm font-bold text-[#292622]">{item.label}</div>
                          <div className="mt-1 text-[11px] leading-relaxed text-[#746d64]">{item.description}</div>
                        </div>
                        <div className="col-span-2 aspect-[16/9] bg-[#181818] sm:col-span-1 sm:aspect-auto sm:min-h-[118px]">
                          <IntensityExampleVisual src={intensityImages[level]} label={`${level}/5 ${item.label}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[#ddd6cd] bg-[#181818]">
                  <div className="aspect-[4/5] sm:aspect-[16/9]">
                    <IntensityExampleVisual src={selectedIntensityImage} label={`${designIntensity}/5 ${intensityLevel.label}`} large />
                  </div>
                  <div className="bg-white p-4">
                    <div className="text-sm font-bold">{designIntensity}/5 · {intensityLevel.label}</div>
                    <div className="mt-1 text-xs leading-relaxed text-[#746d64]">{intensityLevel.description}</div>
                  </div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
                {Object.entries(DESIGN_INTENSITY_LEVELS).map(([level, item]) => <button
                  key={level}
                  type="button"
                  onClick={() => {
                    setDesignIntensity(Number(level));
                    if (showCombinedIntensityGuide) setShowIntensityExamples(false);
                  }}
                  className={"rounded-xl border px-1 py-2 text-center transition sm:p-3 sm:text-left " + (Number(level) === designIntensity ? "border-accent bg-accent/[0.06]" : "border-[#ddd6cd] bg-white hover:border-accent")}
                >
                  <div className="text-[10px] font-bold sm:text-xs">{level}/5<span className="hidden sm:inline"> · {item.label}</span></div>
                </button>)}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-[#817970]">Examples are visual direction only. Your final GDP artwork is customized to your photos, story and selected style.</p>
            </div>
          </div>
        </div>}

        {fullscreenPreview && <div className="fixed inset-0 z-[90] bg-[#111]/95 backdrop-blur-sm p-3 md:p-7">
          <div className="h-full max-w-5xl mx-auto rounded-[28px] overflow-hidden bg-[#f4efe7] border border-white/10 flex flex-col">
            <div className="h-16 shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 bg-[#17324D] text-white">
              <div><div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">GDP Custom Studio</div><div className="font-semibold">Full-screen garment preview</div></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowMeasurements(v => !v)} className={"h-9 w-9 grid place-items-center rounded-xl border " + (showMeasurements ? "border-accent bg-accent/15 text-white" : "border-white/15 text-white/75")} aria-label={showMeasurements ? "Hide measurements" : "Show measurements"}><Ruler size={15}/></button>
                <button type="button" onClick={() => setPreviewZoom(v => clampPreview(v - .1))} className="h-9 w-9 grid place-items-center rounded-xl border border-white/15"><ZoomOut size={15}/></button>
                <span className="w-12 text-center font-mono text-[10px]">{Math.round(previewZoom * 100)}%</span>
                <button type="button" onClick={() => setPreviewZoom(v => clampPreview(v + .1))} className="h-9 w-9 grid place-items-center rounded-xl border border-white/15"><ZoomIn size={15}/></button>
                <button type="button" onClick={() => setFullscreenPreview(false)} className="h-9 w-9 grid place-items-center rounded-xl bg-white text-[#17324D]" aria-label="Close full screen preview"><X size={16}/></button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <StudioPreview garment={garment} color={previewColor} side={previewSide} placement={placement} photo={previewArtworkPhoto} uploading={uploading} personalization={personalization} zoom={previewZoom} setZoom={setPreviewZoom} artworkScale={artworkScale} artworkRotation={artworkRotation} artworkOffset={artworkOffset} setArtworkOffset={setArtworkOffset} artworkFitMode={artworkFitMode} showGuides={showGuides} showMeasurements={showMeasurements} size={size} previewConfig={config.preview || {}} styleTemplate={activeStyleTemplate} mood={designMood} fullscreen />
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}

function IntensityExampleVisual({ src, label, className = "", large = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src === HIDDEN_INTENSITY_IMAGE) {
    return (
      <div className={"h-full w-full grid place-items-center bg-[#222] text-center text-white/55 " + className}>
        <div><X size={large ? 26 : 18} className="mx-auto"/><div className="mt-1 text-[9px] uppercase tracking-wide">Example removed</div></div>
      </div>
    );
  }

  if (src && !failed) {
    return <img src={src} alt={label} className={"h-full w-full object-cover " + className} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  }

  return (
    <div className={"h-full w-full grid place-items-center bg-[radial-gradient(circle_at_50%_32%,#393939_0%,#191919_55%,#101010_100%)] text-white text-center " + className}>
      <div className="px-4">
        <Shirt size={large ? 34 : 24} className="mx-auto text-white/45"/>
        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em]">GDP default</div>
        <div className="mt-1 text-[9px] text-white/45">{label}</div>
      </div>
    </div>
  );
}

function clampPreview(value) {
  return Math.min(1.8, Math.max(0.7, Number(Number(value).toFixed(2))));
}

function StudioPreview({ garment, color, side, placement, photo, uploading = false, personalization, zoom, setZoom, artworkScale, artworkRotation, artworkOffset, setArtworkOffset, artworkFitMode = "crop", showGuides, showMeasurements, size, previewConfig = {}, styleTemplate, mood = "", fullscreen = false }) {
  const dragRef = useRef(null);
  const blankArtwork =
    (side === "back" && placement === "front") ||
    (side === "front" && placement === "back");
  const hasPreviewText = Boolean(
    String(personalization?.name || "").trim() ||
    String(personalization?.dates || "").trim() ||
    String(personalization?.quote || "").trim()
  );
  // The selected GDP style is itself printable artwork, so it should appear
  // immediately in the garment preview even before the customer uploads a photo.
  const canDrag = Boolean(photo && styleTemplate && !blankArtwork && setArtworkOffset);
  const previewSettings = /** @type {any} */ (previewConfig || {});
  const colorPreview = previewSettings?.colorMockups?.[color] || {};
  const frontMockupUrl =
    colorPreview.frontUrl ||
    (
      color === garment?.defaultColor
        ? (previewSettings.cardImageUrl || "")
        : ""
    ) ||
    previewSettings.frontMockupUrl ||
    previewImageForGarment(garment, color, "front");
  const backMockupUrl =
    colorPreview.backUrl ||
    previewSettings.backMockupUrl ||
    previewImageForGarment(garment, color, "back");
  const mockupUrl = side === "back" ? backMockupUrl : frontMockupUrl;
  const previewCanvas = resolvePreviewCanvas(previewSettings);
  const mockupNormalization = resolveMockupNormalization(previewSettings, side);
  const mockupLayerStyle = getMockupLayerStyle(mockupNormalization);

  useEffect(() => {
    preloadPreviewImages([frontMockupUrl, backMockupUrl]);
  }, [frontMockupUrl, backMockupUrl]);
  const configuredNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const defaultProfile = recommendedPrintProfile(garment?.previewType || garment?.type, size, side);
  const configuredGuide = previewSettings?.printGuide?.[side] || {};
  const sizeKey = String(size || "").toUpperCase().replace(/\s+/g, "");
  const configuredSizeGuide = configuredGuide?.sizeScalingEnabled === false
    ? {}
    : (configuredGuide?.sizeOverrides?.[sizeKey] || configuredGuide?.sizeOverrides?.[size] || {});
  const profile = {
    ...defaultProfile,
    collarIn: configuredNumber(configuredSizeGuide.collarIn ?? configuredGuide.collarIn, defaultProfile.collarIn),
    widthIn: configuredNumber(configuredSizeGuide.widthIn ?? configuredGuide.widthIn, defaultProfile.widthIn),
    heightIn: configuredNumber(configuredSizeGuide.heightIn ?? configuredGuide.heightIn, defaultProfile.heightIn),
    maxWidthIn: configuredNumber(configuredGuide.maxWidthIn, defaultProfile.maxWidthIn || defaultProfile.widthIn),
    maxHeightIn: configuredNumber(configuredGuide.maxHeightIn, defaultProfile.maxHeightIn || defaultProfile.heightIn),
  };
  const configuredArea = previewSettings?.printArea?.[side] || {};
  const useCustomArea = previewSettings?.printAreaMode === "custom" || configuredArea?.mode === "custom" || profile.generic === true;
  const printArea = {
    top: useCustomArea ? configuredNumber(configuredArea.top, profile.top) : profile.top,
    width: useCustomArea ? configuredNumber(configuredArea.width, profile.width) : profile.width,
    height: useCustomArea ? configuredNumber(configuredArea.height, profile.height) : profile.height
  };
  const printAreaStyle = {
    top: printArea.top + "%",
    width: printArea.width + "%",
    height: printArea.height + "%"
  };
  const maxAreaWidth = Math.min(78, printArea.width * (configuredNumber(profile.maxWidthIn, profile.widthIn) / Math.max(0.1, profile.widthIn)));
  const maxAreaHeight = Math.min(70, printArea.height * (configuredNumber(profile.maxHeightIn, profile.heightIn) / Math.max(0.1, profile.heightIn)));
  const maxPrintAreaStyle = {
    top: printArea.top + "%",
    width: maxAreaWidth + "%",
    height: maxAreaHeight + "%"
  };
  const artworkLayerStyle = {
    left: (50 + Number(artworkOffset?.x || 0)) + "%",
    top: (50 + Number(artworkOffset?.y || 0)) + "%",
    transform: `translate(-50%, -50%) scale(${artworkScale / 100}) rotate(${artworkRotation}deg)`,
    transformOrigin: "center center"
  };
  const template = styleTemplate || null;
  const moodTreatment = moodPreviewTreatment(mood);
  const photoZone = template?.photoZone || { x: 10, y: 8, width: 80, height: 64, shape: "rounded", radius: 10 };
  const textZone = template?.textZone || { x: 10, y: 80, width: 80, height: 15, align: "center", tone: "light" };
  const zoneRadius = photoZone.shape === "circle" || photoZone.shape === "oval"
    ? "50%"
    : photoZone.shape === "rect"
      ? "0"
      : `${Number(photoZone.radius || 8)}%`;
  const photoZoneStyle = {
    left: `${Number(photoZone.x || 0)}%`,
    top: `${Number(photoZone.y || 0)}%`,
    width: `${Number(photoZone.width || 100)}%`,
    height: `${Number(photoZone.height || 100)}%`,
    borderRadius: zoneRadius,
  };
  const textZoneStyle = {
    left: `${Number(textZone.x || 0)}%`,
    top: `${Number(textZone.y || 0)}%`,
    width: `${Number(textZone.width || 100)}%`,
    height: `${Number(textZone.height || 15)}%`,
  };
  const collarAnchor = Math.min(printArea.top - 2, Number(profile.collarAnchor || 20));
  const collarGuideHeight = Math.max(2, printArea.top - collarAnchor);

  const onPointerDown = (event) => {
    if (!canDrag) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { x: event.clientX, y: event.clientY, startX: artworkOffset.x, startY: artworkOffset.y, width: rect.width, height: rect.height };
  };
  const onPointerMove = (event) => {
    if (!dragRef.current || !canDrag) return;
    const start = dragRef.current;
    const clamp = (v) => Math.min(42, Math.max(-42, v));
    setArtworkOffset({
      x: clamp(start.startX + ((event.clientX - start.x) / Math.max(1, start.width)) * 100),
      y: clamp(start.startY + ((event.clientY - start.y) / Math.max(1, start.height)) * 100)
    });
  };
  const stopDrag = () => { dragRef.current = null; };
  const onWheel = (event) => {
    if (!setZoom) return;
    event.preventDefault();
    setZoom(value => clampPreview(value + (event.deltaY < 0 ? .08 : -.08)));
  };

  return <div onWheel={onWheel} className={"relative overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#fffdf8_0%,#eee7dc_68%,#e4dbcf_100%)] " + (fullscreen ? "h-full" : "h-[370px] sm:h-[430px]")}>
    <div className="absolute inset-x-0 top-3 z-30 text-center pointer-events-none"><span className="rounded-full border border-[#ddd6cc] bg-white/80 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-[#817b71]">{side} view</span></div>

    {showMeasurements && <div className="absolute left-3 top-11 z-30 max-w-[238px] rounded-xl border border-[#d8d2c8] bg-white/90 backdrop-blur px-3 py-2.5 shadow-sm pointer-events-none">
      <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-accent">{side === "back" ? "Back print guide" : "Front print guide"} · {size || "—"}</div>
      <div className="mt-1 text-[10px] font-bold text-[#292621]">Recommended · {measurementPair(profile.widthIn, profile.heightIn)}</div>
      <div className="mt-1 text-[8px] font-semibold text-[#6f6a63]">Maximum safe area · {measurementPair(profile.maxWidthIn, profile.maxHeightIn)}</div>
      <div className="mt-1 text-[8px] leading-relaxed text-[#625c54]">{profile.placementLabel} · ↓ {measurementSingle(profile.collarIn)} from {String(garment?.previewType || garment?.type || "").toLowerCase().includes("hoodie") ? "hood seam" : "collar"}</div>
      {configuredGuide?.sizeScalingEnabled !== false && <div className="mt-1 text-[8px] text-[#7a746c]">Size-aware preset is active for {size || "this size"}.</div>}
      {profile.bottomClearanceIn && <div className="mt-1 text-[8px] font-semibold text-[#8a514b]">Keep ≥ {measurementSingle(profile.bottomClearanceIn)} above pocket.</div>}
    </div>}

    <div className="absolute inset-0 grid place-items-center transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
      <div
        className={"relative " + (fullscreen ? "w-[min(55vh,520px)]" : "w-[275px] sm:w-[305px]")}
        style={{ aspectRatio: `${previewCanvas.width} / ${previewCanvas.height}` }}
      >
        {mockupUrl ? (
          <img
            src={mockupUrl}
            alt={(garment?.label || "Custom garment") + " " + side + " mockup"}
            className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,.18)]"
            style={mockupLayerStyle}
            draggable="false"
          />
        ) : (
          <GarmentShape type={garment?.previewType || garment?.type || "T-Shirt"} color={color} side={side} />
        )}

        {showMeasurements && <div className="absolute inset-0 z-20 pointer-events-none select-none">
          <div className="absolute w-px bg-accent/65" style={{ left: "50%", top: collarAnchor + "%", height: collarGuideHeight + "%" }}>
            <span className="absolute -left-1 top-0 h-px w-2 bg-accent/70" />
            <span className="absolute -left-1 bottom-0 h-px w-2 bg-accent/70" />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-[#ead3d6] bg-white/90 px-1 py-0.5 font-mono text-[7px] text-accent">{formatMeasurementNumber(profile.collarIn)}"</span>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 rounded-sm border border-dotted border-[#7b8794]/75 bg-[#17324D]/[0.015]" style={maxPrintAreaStyle}>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[6px] uppercase tracking-wide text-[#65717d]">maximum safe area</span>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2" style={printAreaStyle}>
            <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-accent/55" />
            <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-md bg-[#FFFFFF]/90 px-1 py-0.5 font-mono text-[7px] uppercase tracking-wide text-[#8b565c]">center</span>

            <div className="absolute -top-2 left-0 right-0 h-px bg-accent/70">
              <span className="absolute left-0 -top-1 h-2 w-px bg-accent/70" />
              <span className="absolute right-0 -top-1 h-2 w-px bg-accent/70" />
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-[#ead3d6] bg-white/95 px-1.5 py-0.5 font-mono text-[7px] font-semibold text-accent">{formatMeasurementNumber(profile.widthIn)}" wide</span>
            </div>

            <div className="absolute -right-2 top-0 bottom-0 w-px bg-accent/70">
              <span className="absolute -left-1 top-0 h-px w-2 bg-accent/70" />
              <span className="absolute -left-1 bottom-0 h-px w-2 bg-accent/70" />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-[#ead3d6] bg-white/95 px-1 py-0.5 font-mono text-[7px] font-semibold text-accent">{formatMeasurementNumber(profile.heightIn)}" high</span>
            </div>

            {profile.bottomClearanceIn && <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#ead3d6] bg-white/95 px-1.5 py-0.5 font-mono text-[7px] text-[#8a514b]">↑ {formatMeasurementNumber(profile.bottomClearanceIn)}" pocket clearance</span>}
          </div>
        </div>}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          style={printAreaStyle}
          className={"absolute left-1/2 -translate-x-1/2 overflow-hidden select-none touch-none " + (showGuides ? " border border-dashed border-accent/65 bg-white/[0.03]" : "") + (canDrag ? " cursor-grab active:cursor-grabbing" : "")}
        >
          {!styleTemplate ? null : blankArtwork ? (
            <div className="absolute inset-0 grid place-items-center text-center px-2 text-[8px] uppercase tracking-wide text-[#8b847a]">No back print selected</div>
          ) : (
            <>
              <div
                className={"absolute z-10 overflow-hidden transition-all duration-200 " + (showGuides ? "ring-1 ring-white/35" : "")}
                style={photoZoneStyle}
              >
                {photo ? (
                  artworkFitMode === "crop" ? (
                    <div className="absolute h-full w-full pointer-events-none" style={artworkLayerStyle}>
                      <img
                        src={photo.url}
                        alt="Customer photo preview"
                        draggable="false"
                        className="h-full w-full object-cover pointer-events-none transition-[filter] duration-200"
                        style={{ filter: moodTreatment.photoFilter }}
                      />
                    </div>
                  ) : (
                    <img
                      src={photo.url}
                      alt="Customer photo preview"
                      draggable="false"
                      className="absolute max-h-full max-w-full object-contain pointer-events-none transition-[filter] duration-200"
                      style={{ ...artworkLayerStyle, filter: moodTreatment.photoFilter }}
                    />
                  )
                ) : (
                  <div className="absolute inset-0 grid place-items-center rounded-[inherit] border border-dashed border-white/45 bg-[#17324D]/[0.08] text-center px-3 pointer-events-none">
                    <div>
                      <Upload size={16} className="mx-auto text-white/85 drop-shadow"/>
                      <div className="mt-1 text-[6px] font-bold uppercase tracking-[0.14em] text-white/90 drop-shadow">Photo goes here</div>
                    </div>
                  </div>
                )}
              </div>

              {template?.assetUrl && (
                <img
                  key={template.id}
                  src={template.assetUrl}
                  alt={template.name + " artwork overlay"}
                  draggable="false"
                  className="absolute inset-0 z-20 h-full w-full object-fill pointer-events-none transition-[filter,opacity] duration-200"
                  style={{ filter: moodTreatment.templateFilter }}
                />
              )}

              {hasPreviewText && (
                <div
                  className={"absolute z-30 grid content-center px-2 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,.75)] " + (textZone?.tone === "dark" ? "text-[#26211d]" : "text-white")}
                  style={textZoneStyle}
                >
                  <div className={textZone?.align === "left" ? "text-left" : textZone?.align === "right" ? "text-right" : "text-center"}>
                    {personalization?.name && <div className="font-display text-sm leading-none uppercase tracking-wide">{personalization.name}</div>}
                    {personalization?.dates && <div className="font-mono text-[6px] mt-0.5">{personalization.dates}</div>}
                    {personalization?.quote && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.quote}</div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {uploading && photo && styleTemplate && !blankArtwork && <div className="absolute left-1/2 top-12 z-40 -translate-x-1/2 pointer-events-none">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#C9D4DE] bg-white/90 px-3 py-1.5 text-[9px] font-semibold text-[#17324D] shadow-sm backdrop-blur">
        <Upload size={11} /> Uploading new artwork… current preview stays visible
      </span>
    </div>}

    <div className="absolute bottom-3 left-3 right-3 z-30 flex items-end justify-between gap-2 pointer-events-none">
      <span className="rounded-xl border border-[#d8d2c8] bg-white/80 backdrop-blur px-2.5 py-1.5 text-[9px] uppercase tracking-wide text-[#817b71]">{color} · {garment?.label || "Custom garment"}</span>
      {!blankArtwork && <span className="rounded-xl border border-[#d8d2c8] bg-white/80 backdrop-blur px-2.5 py-1.5 text-[9px] uppercase tracking-wide text-[#817b71] inline-flex items-center gap-1">{photo ? <><Move size={10}/> Drag to position</> : <><Sparkles size={10}/> {template?.name?.replace("GDP ","")} · {mood}</>}</span>}
    </div>
  </div>;
}

function GarmentShape({ type, color, side }) {
  const palette = garmentPalette(color);
  const key = normalizePreviewToken(type);
  const isHoodie = key.includes("hoodie");
  const isCrew = key.includes("crewneck") || key.includes("crew neck") || key.includes("sweatshirt") || key.includes("sweater");
  const isLongSleeve = key.includes("long sleeve");
  const isBaby = key.includes("baby") || key.includes("bodysuit") || key.includes("onesie");
  const isToddler = key.includes("toddler");
  const isYouth = key.includes("youth") || key === "kids";

  const longSleeveBody = "M123 70 L84 86 L49 112 L18 271 L63 280 L94 151 L98 392 L262 392 L266 151 L297 280 L342 271 L311 112 L276 86 L237 70 C224 91 204 101 180 101 C156 101 136 91 123 70 Z";
  // Traced from the approved Adult Long Sleeve Tee mockup so fallback views
  // preserve the same sleeve length, shoulder width and body proportions.
  const longSleeveTeeFrontBody = "M147 114 L107 201 L68 421 L55 632 L72 769 L144 768 L188 462 L213 375 L195 761 L341 779 L533 775 L603 761 L588 382 L612 470 L651 768 L720 773 L739 707 L744 602 L735 449 L701 237 L664 126 L490 33 L413 46 L309 33 Z";
  const longSleeveTeeBackBody = "M145 116 L103 212 L68 412 L54 624 L72 768 L139 766 L193 425 L214 359 L190 754 L222 769 L327 778 L529 775 L605 758 L584 359 L607 432 L660 766 L726 769 L746 609 L734 433 L701 238 L660 124 L491 32 L307 32 Z";
  const longSleeveTeeTransform = "translate(0 35) scale(.45)";

  return <svg viewBox="0 0 360 430" role="img" aria-label={color + " " + type + " " + side + " mockup"} className="w-full h-auto drop-shadow-[0_18px_22px_rgba(0,0,0,.18)]">
    {isHoodie ? <>
      <path d="M124 89 C130 48 151 25 180 25 C209 25 230 48 236 89 L216 111 C208 82 197 68 180 68 C163 68 152 82 144 111 Z" fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      <path d={longSleeveBody} fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      {side === "front" && <>
        <path d="M139 284 Q180 266 221 284 L214 340 H146 Z" fill="none" stroke={palette.seam} strokeWidth="2" opacity=".55" />
        <path d="M158 87 L174 131 M202 87 L186 131" stroke={palette.seam} strokeWidth="2" opacity=".55" />
      </>}
    </> : isBaby ? <>
      <path d="M132 72 L94 87 L57 136 L87 158 L110 134 L110 292 L136 322 L151 392 L180 369 L209 392 L224 322 L250 292 L250 134 L273 158 L303 136 L266 87 L228 72 C218 91 201 101 180 101 C159 101 142 91 132 72 Z" fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      <path d="M151 72 C156 88 166 94 180 94 C194 94 204 88 209 72" fill="none" stroke={palette.seam} strokeWidth="3" opacity=".62" />
      <path d="M151 392 Q180 405 209 392" fill="none" stroke={palette.seam} strokeWidth="2" opacity=".5" />
      {side === "front" && <>
        <circle cx="166" cy="384" r="2.4" fill={palette.seam} />
        <circle cx="180" cy="388" r="2.4" fill={palette.seam} />
        <circle cx="194" cy="384" r="2.4" fill={palette.seam} />
      </>}
    </> : isCrew ? <>
      <path d={longSleeveBody} fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      <path d="M149 69 C154 86 165 93 180 93 C195 93 206 86 211 69" fill="none" stroke={palette.seam} strokeWidth="6" opacity=".62" />
      <path d="M98 365 L262 365" stroke={palette.seam} strokeWidth="6" opacity=".42" />
      <path d="M20 258 L64 268 M296 268 L340 258" stroke={palette.seam} strokeWidth="6" opacity=".42" />
    </> : isLongSleeve ? <>
      <path
        d={side === "back" ? longSleeveTeeBackBody : longSleeveTeeFrontBody}
        transform={longSleeveTeeTransform}
        fill={palette.base}
        stroke={palette.stroke}
        strokeWidth="4"
      />
      <path
        d={side === "back"
          ? "M307 43 C342 58 367 64 400 64 C433 64 458 58 491 43"
          : "M309 43 C336 73 365 87 400 87 C435 87 464 73 490 43"}
        transform={longSleeveTeeTransform}
        fill="none"
        stroke={palette.seam}
        strokeWidth="10"
        opacity=".62"
      />
      <path d="M74 730 L143 730 M657 730 L722 730" transform={longSleeveTeeTransform} fill="none" stroke={palette.seam} strokeWidth="9" opacity=".4" />
      <path d="M205 742 C300 765 500 765 594 742" transform={longSleeveTeeTransform} fill="none" stroke={palette.seam} strokeWidth="5" opacity=".28" />
    </> : isToddler ? <>
      <path d="M132 78 L93 94 L52 148 L84 171 L108 146 L108 358 L252 358 L252 146 L276 171 L308 148 L267 94 L228 78 C218 96 201 105 180 105 C159 105 142 96 132 78 Z" fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      <path d="M153 77 C157 92 166 99 180 99 C194 99 203 92 207 77" fill="none" stroke={palette.seam} strokeWidth="3" opacity=".6" />
    </> : isYouth ? <>
      <path d="M128 74 L86 91 L38 151 L76 178 L103 148 L103 376 L257 376 L257 148 L284 178 L322 151 L274 91 L232 74 C221 93 203 102 180 102 C157 102 139 93 128 74 Z" fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      <path d="M151 73 C155 88 165 95 180 95 C195 95 205 88 209 73" fill="none" stroke={palette.seam} strokeWidth="3" opacity=".6" />
    </> : <>
      <path d="M123 70 L78 88 L27 154 L70 184 L96 151 L96 392 L264 392 L264 151 L290 184 L333 154 L282 88 L237 70 C224 91 204 101 180 101 C156 101 136 91 123 70 Z" fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      <path d="M149 69 C154 85 164 92 180 92 C196 92 206 85 211 69" fill="none" stroke={palette.seam} strokeWidth="3" opacity=".6" />
    </>}
    <path d="M116 93 C139 105 157 112 180 112 C203 112 221 105 244 93" fill="none" stroke={palette.highlight} strokeWidth="13" opacity=".2" />
  </svg>;
}

function garmentPalette(color) {
  const key = String(color || "Black").toLowerCase();
  if (key.includes("black")) return { base: "#171717", stroke: "#050505", seam: "#4f4f4f", highlight: "#6a6a6a" };
  if (key.includes("white")) return { base: "#f4f1eb", stroke: "#c8c2b8", seam: "#aaa49a", highlight: "#ffffff" };
  if (key.includes("sport grey") || key.includes("sport gray") || key === "grey" || key === "gray") return { base: "#b8b9b5", stroke: "#858682", seam: "#777874", highlight: "#ddddda" };
  if (key.includes("sand")) return { base: "#c8b79b", stroke: "#958166", seam: "#8f7a5f", highlight: "#f0e1c8" };
  if (key.includes("navy")) return { base: "#202b3b", stroke: "#0b1220", seam: "#667085", highlight: "#64748b" };
  if (key.includes("royal")) return { base: "#2857a6", stroke: "#17376f", seam: "#6f91cd", highlight: "#7aa0df" };
  if (key.includes("red")) return { base: "#ad2735", stroke: "#68151e", seam: "#ce6873", highlight: "#df7d87" };
  if (key.includes("pink")) return { base: "#e9afc3", stroke: "#b6788d", seam: "#d38fa6", highlight: "#f8d6e1" };
  if (key.includes("forest") || key.includes("green")) return { base: "#29463b", stroke: "#10231c", seam: "#72877f", highlight: "#6f9385" };
  if (key.includes("charcoal") || key.includes("heather")) return { base: "#414141", stroke: "#222", seam: "#707070", highlight: "#7b7b7b" };
  if (key.includes("vintage")) return { base: "#272422", stroke: "#101010", seam: "#595553", highlight: "#68615e" };
  return { base: "#17324D", stroke: "#050505", seam: "#4b4b4b", highlight: "#555555" };
}

function StepTitle({ eyebrow, title, text }) {
  return <div className="mb-7"><div className="font-mono text-[9px] uppercase tracking-[0.22em] text-accent">{eyebrow}</div><h2 className="font-display text-4xl md:text-5xl leading-none mt-1.5 text-[#1d1b18]">{title}</h2><p className="text-sm text-[#716b63] mt-2.5 max-w-2xl leading-relaxed">{text}</p></div>;
}
function Field({ label, value, onChange, placeholder }) {
  return <div className="mt-4"><label className="font-mono text-[10px] uppercase tracking-wide text-[#756f67]">{label}</label><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-[#dcd5cc] bg-white/70 px-3.5 py-3 mt-1.5 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"/></div>;
}
function TextArea({ label, value, onChange, placeholder }) {
  return <div className="mt-5"><label className="font-mono text-[10px] uppercase tracking-wide text-[#756f67]">{label}</label><textarea rows={4} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-[#dcd5cc] bg-white/70 px-3.5 py-3 mt-1.5 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"/></div>;
}
function SelectField({ label, value, onChange, options }) {
  return <div><label className="font-mono text-[10px] uppercase tracking-wide text-[#756f67]">{label}</label><select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-[#dcd5cc] bg-white/70 px-3.5 py-3 mt-1.5 outline-none focus:border-accent">{options.map(option => <option key={option}>{option}</option>)}</select></div>;
}
function Choice({ active, onClick, children }) {
  return <button type="button" onClick={onClick} className={"rounded-xl border px-3.5 py-2.5 text-sm transition " + (active ? "border-accent bg-accent/[0.06] text-accent shadow-sm" : "border-[#ddd6cc] bg-white/60 text-[#5f5a53] hover:border-[#aaa198]")}>{children}</button>;
}
function ReviewCard({ label, value, sub }) {
  return <div className="rounded-2xl border border-[#dfd8cf] bg-white/65 p-4"><div className="font-mono text-[9px] uppercase tracking-wide text-[#867f76]">{label}</div><div className="font-bold mt-1 text-[#292621]">{value}</div>{sub && <div className="text-xs text-[#7a746c] mt-1">{sub}</div>}</div>;
}
function SummaryRow({ label, value }) {
  return <div className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:justify-between sm:gap-3"><span className="opacity-55">{label}</span><span className="break-words font-medium sm:max-w-[68%] sm:text-right">{value}</span></div>;
}
function GroupRow({ item, product, onChange, onRemove }) {
  const colors = productColors(product);
  const sizes = productSizes(product, item.color);
  const changeColor = (nextColor) => {
    const nextSizes = productSizes(product, nextColor);
    const nextSize = nextSizes.includes(item.size) ? item.size : (nextSizes[0] || item.size);
    onChange({ color: nextColor, size: nextSize });
  };

  return <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px_36px] gap-2 mt-3">
    <select value={item.color} onChange={e => changeColor(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
      {colors.map(v => <option key={v}>{v}</option>)}
    </select>
    <select value={item.size} onChange={e => onChange({size:e.target.value})} className="rounded-lg border border-border bg-background px-2 py-2 text-sm">
      {sizes.map(v => {
        const variant = variantFor(product, item.color, v);
        return <option key={v} value={v} disabled={!variantAvailable(product, variant)}>{v}{!variantAvailable(product, variant) ? " — unavailable" : ""}</option>;
      })}
    </select>
    <input type="number" min="1" max="99" value={item.quantity} onChange={e => onChange({quantity:Math.max(1, Math.min(99, Number(e.target.value) || 1))})} className="rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
    <button type="button" onClick={onRemove} className="rounded-lg border border-border hover:bg-[#f4f1ec]" aria-label="Remove garment"><X size={14} className="mx-auto"/></button>
  </div>;
}
function PhotoCard({ photo, onPrimary, onRemove }) {
  const qClass = photo.quality === "excellent" ? "text-green-600" : photo.quality === "usable" ? "text-amber-600" : "text-destructive";
  const qLabel = photo.quality === "excellent" ? "Great quality" : photo.quality === "usable" ? "May look slightly soft" : "Low resolution";
  return <div className="rounded-2xl border border-[#ddd6cc] bg-white relative overflow-hidden shadow-sm"><div className="aspect-square overflow-hidden bg-[#f3efe8]"><img src={photo.url} alt={photo.name} className="w-full h-full object-cover"/></div><button onClick={onRemove} className="absolute top-2 right-2 rounded-lg bg-white/90 p-1.5 shadow-sm"><X size={13}/></button><div className="p-3"><button onClick={onPrimary} className={"text-[9px] uppercase font-mono flex items-center gap-1 " + (photo.isPrimary ? "text-accent" : "text-[#7c766e]")}><Star size={12} className={photo.isPrimary ? "fill-accent" : ""}/>{photo.isPrimary ? "Primary photo" : "Make primary"}</button><div className={"mt-1.5 text-[9px] uppercase font-mono " + qClass}>{qLabel}</div><div className="text-[9px] text-[#8a847c]">{photo.width}×{photo.height}</div></div></div>;
}