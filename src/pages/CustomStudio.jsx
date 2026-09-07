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
  return `${formatMeasurementNumber(widthIn)} Ã— ${formatMeasurementNumber(heightIn)} in Â· ${formatMeasurementNumber(cmFromInches(widthIn))} Ã— ${formatMeasurementNumber(cmFromInches(heightIn))} cm`;
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
    description: "No forced filter â€” the GDP designer can choose the final treatment.",
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
        const initialColor = colors.find((item) => item.toLowerCase() === requestedColor.toLowerCase()) || "";
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
    const nextColor = color && colors.includes(color) ? color : "";
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
              <ShieldCheck size={15} className="text-accent" /> Designer reviewed Â· Proof before printing Â· Secure checkout
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
              : <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold uppercase text-xs text-white shadow-sm disabled:opacity-40">{saving ? "Savingâ€¦" : "Add to cart"} <ArrowRight size={16}/></button>}
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
              <Field label="Who is this for? (optional)" value={recipientType} onChange={setRecipientType} placeholder="e.g. Dad, Sarah, Coach Mike, Milo the dogâ€¦" />
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
              #µêÚ$z{-®éÜj×˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´Ø‰œµÍ•½¹‘…ÉäÀ´Ô™±•à¥Ñ•µÌµ•¹©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´Ðˆøñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµáÌÕÁÁ•É…Í”Ñ•áÐµµÕÑ•µ™½É•É½Õ¹ˆùÍÑ¥µ…Ñ•ÕÍÑ½´ÍÕ‰Ñ½Ñ…°ð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµáÌÑ•áÐµµÕÑ•µ™½É•É½Õ¹µÐ´Äˆù	•™½É”…ÉÐ‘¥Í½Õ¹ÑÌ°Í¡¥ÁÁ¥¹œ°Ñ…à½È½ÕÁ½¸¸ð½‘¥Øøð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµ‘¥ÍÁ±…äÑ•áÐ´Ñá°ˆùìˆˆ€¬•ÍÑ¥µ…Ñ•‘MÕ‰Ñ½Ñ…°¹Ñ½¥á• È¥ôð½‘¥Øøð½‘¥Øùô(€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÉ•…Ñ•¹‘‘‘ô‘¥Í…‰±•õíÍ…Ù¥¹œñð€…É¥¡ÑÍ½¹™¥Éµ•ñð€……ÁÁÉ½Ù…±­¹½Ý±•‘•‘ô±…ÍÍ9…µ”ô‰Üµ™Õ±°µÐ´Ô‰œµ…•¹ÐÑ•áÐµ…•¹Ðµ™½É•É½Õ¹Áä´Ð™½¹Ðµ‰½±ÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”‘¥Í…‰±•é½Á…¥Ñä´ÔÀˆùíÍ…Ù¥¹œ€ü€‰M…Ù¥¹œÕÍÑ½´‘•Í¥»Š˜ˆ€è€‰‘ÕÍÑ½´=É‘•ÈÑ¼…ÉÐƒŠH‰ôð½‰ÕÑÑ½¸ø(€€€€€€€€€€ð½‘¥Øùô(€€€€€€€€ð½Í•Ñ¥½¸ø((€€€€€€€€€€ñ…Í¥‘”±…ÍÍ9…µ”ô‰ µ™¥Ð±œéÍÑ¥­ä±œéÑ½À´ÈÐÍÁ…”µä´Ðˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµ¡¥‘‘•¸É½Õ¹‘•µlÈÑÁát‰½É‘•È‰½É‘•Èµl‘Õ…t‰œµÝ¡¥Ñ”Í¡…‘½ÜµlÁ|ÄáÁá|ÔÕÁá}É‰„ ÈÔ°ÈÈ°Äà°¸ÀàÔ¥tˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´ÌÁà´ÐÁä´Ì¸Ô‰½É‘•Èµˆ‰½É‘•Èµl•‰”Õ‘t‰œµltˆø(€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlÄÁÁátÍ´éÑ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸Äá•µtÑ•áÐµ…•¹Ðˆù1¥Ù”…Éµ•¹ÐÁÉ•Ù¥•Üð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´™½¹ÐµÍ•µ¥‰½±µÐ´À¸ÔÑ•áÐµlŒÈÔÈÌÅ™tˆùíÁÉ½‘ÕÐü¹¹…µ”ñð€‰¡½½Í”„…Éµ•¹Ð‰ôð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑÕ±±ÍÉ••¹AÉ•Ù¥•Ü¡ÑÉÕ”¥ô±…ÍÍ9…µ”ô‰ ´äÜ´äÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµl‘‘Ùt‰œµÝ¡¥Ñ”Ñ•áÐµlŒÕÔàÔÅt¡½Ù•Èé‰½É‘•Èµ…•¹Ð¡½Ù•ÈéÑ•áÐµ…•¹Ðˆ…É¥„µ±…‰•°ô‰=Á•¸™Õ±°ÍÉ••¸ÁÉ•Ù¥•Üˆøñ5…á¥µ¥é”ÈÍ¥é”õìÄÕô€¼øð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€ñMÑÕ‘¥½AÉ•Ù¥•Ü(€€€€€€€€€€€€€€€…Éµ•¹Ðõí…Éµ•¹Ñô(€€€€€€€€€€€€€€€½±½ÈõíÁÉ•Ù¥•Ý½±½Éô(€€€€€€€€€€€€€€€Í¥‘”õíÁÉ•Ù¥•ÝM¥‘•ô(€€€€€€€€€€€€€€€Á±…•µ•¹ÐõíÁ±…•µ•¹Ñô(€€€€€€€€€€€€€€€Á¡½Ñ¼õíÁÉ•Ù¥•ÝÉÑÝ½É­A¡½Ñ½ô(€€€€€€€€€€€€€€€ÕÁ±½…‘¥¹œõíÕÁ±½…‘¥¹ô(€€€€€€€€€€€€€€€Á•ÉÍ½¹…±¥é…Ñ¥½¸õíÁ•ÉÍ½¹…±¥é…Ñ¥½¹ô(€€€€€€€€€€€€€€€é½½´õíÁÉ•Ù¥•Ýi½½µô(€€€€€€€€€€€€€€€Í•Ñi½½´õíÍ•ÑAÉ•Ù¥•Ýi½½µô(€€€€€€€€€€€€€€€…ÉÑÝ½É­M…±”õí…ÉÑÝ½É­M…±•ô(€€€€€€€€€€€€€€€…ÉÑÝ½É­I½Ñ…Ñ¥½¸õí…ÉÑÝ½É­I½Ñ…Ñ¥½¹ô(€€€€€€€€€€€€€€€…ÉÑÝ½É­=™™Í•Ðõí…ÉÑÝ½É­=™™Í•Ñô(€€€€€€€€€€€€€€€Í•ÑÉÑÝ½É­=™™Í•ÐõíÍ•ÑÉÑÝ½É­=™™Í•Ñô(€€€€€€€€€€€€€€€…ÉÑÝ½É­¥Ñ5½‘”õí…ÉÑÝ½É­¥Ñ5½‘•ô(€€€€€€€€€€€€€€€Í¡½ÝÕ¥‘•ÌõíÍ¡½ÝÕ¥‘•Íô(€€€€€€€€€€€€€€€Í¡½Ý5•…ÍÕÉ•µ•¹ÑÌõíÍ¡½Ý5•…ÍÕÉ•µ•¹ÑÍô(€€€€€€€€€€€€€€€Í¥é”õíÍ¥é•ô(€€€€€€€€€€€€€€€ÁÉ•Ù¥•Ý½¹™¥œõí½¹™¥œ¹ÁÉ•Ù¥•Üñðíõô(€€€€€€€€€€€€€€€ÍÑå±•Q•µÁ±…Ñ”õí…Ñ¥Ù•MÑå±•Q•µÁ±…Ñ•ô(€€€€€€€€€€€€€€€µ½½õí‘•Í¥¹5½½‘ô(€€€€€€€€€€€€€€¼ø((€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ð‰½É‘•ÈµÐ‰½É‘•Èµl•‰”Õ‘t‰œµltˆø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´Èˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰¥¹±¥¹”µ™±•àÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµl‘‘Ùt‰œµl˜Õ˜Á”åtÀ´Äˆø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑAÉ•Ù¥•ÝM¥‘” ‰™É½¹Ðˆ¥ô±…ÍÍ9…µ”õì‰É½Õ¹‘•µ±œÁà´ÌÁä´Ä¸ÔÑ•áÐµlÄÅÁát™½¹Ðµ‰½±ÕÁÁ•É…Í”€ˆ€¬€¡ÁÉ•Ù¥•ÝM¥‘”€ôôô€‰™É½¹Ðˆ€ü€‰‰œµlŒÄÜÌÈÑtÑ•áÐµÝ¡¥Ñ”ˆ€è€‰Ñ•áÐµlŒÜÔÙ˜ØÝtˆ¥ôùÉ½¹Ðð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑAÉ•Ù¥•ÝM¥‘” ‰‰…¬ˆ¥ô±…ÍÍ9…µ”õì‰É½Õ¹‘•µ±œÁà´ÌÁä´Ä¸ÔÑ•áÐµlÄÅÁát™½¹Ðµ‰½±ÕÁÁ•É…Í”€ˆ€¬€¡ÁÉ•Ù¥•ÝM¥‘”€ôôô€‰‰…¬ˆ€ü€‰‰œµlŒÄÜÌÈÑtÑ•áÐµÝ¡¥Ñ”ˆ€è€‰Ñ•áÐµlŒÜÔÙ˜ØÝtˆ¥ôù	…¬ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Äˆø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑAÉ•Ù¥•Ýi½½´¡Ø€ôø±…µÁAÉ•Ù¥•Ü¡Ø€´€¸Ä¤¥ô±…ÍÍ9…µ”ô‰ ´àÜ´àÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•Èµl‘‘Ùtˆ…É¥„µ±…‰•°ô‰i½½´½ÕÐˆøñi½½µ=ÕÐÍ¥é”õìÄÑô€¼øð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ü´ÄÀÑ•áÐµ•¹Ñ•È™½¹Ðµµ½¹¼Ñ•áÐµlÄÁÁátÑ•áÐµlŒÜÐÙ”ØÙtˆùí5…Ñ ¹É½Õ¹¡ÁÉ•Ù¥•Ýi½½´€¨€ÄÀÀ¥ô”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑAÉ•Ù¥•Ýi½½´¡Ø€ôø±…µÁAÉ•Ù¥•Ü¡Ø€¬€¸Ä¤¥ô±…ÍÍ9…µ”ô‰ ´àÜ´àÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•Èµl‘‘Ùtˆ…É¥„µ±…‰•°ô‰i½½´¥¸ˆøñi½½µ%¸Í¥é”õìÄÑô€¼øð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€€€íÁÉ•Ù¥•ÝÉÑÝ½É­A¡½Ñ¼€˜˜…Ñ¥Ù•M¥‘•!…ÍAÉ¥¹Ð€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÐÍÁ…”µä´Ìˆø(€€€€€€€€€€€€€€€€€íÁ¡½Ñ½Ì¹±•¹Ñ €ø€Ä€˜˜€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlåÁátÕÁÁ•É…Í”Ñ•áÐµlŒÜÔÙ˜ØÝtˆùÉÑÝ½É¬Á¡½Ñ¼ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñÍ•±•Ð(€€€€€€€€€€€€€€€€€€€€€Ù…±Õ”õí9Õµ‰•È¡…Ñ¥Ù•ÉÑÝ½É­MÑ…Ñ”¹Í½ÕÉ•A¡½Ñ½%¹‘•àñð€À¥ô(€€€€€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÍ•ÑÉÑÝ½É­M½ÕÉ•A¡½Ñ½%¹‘•à¡9Õµ‰•È¡”¹Ñ…É•Ð¹Ù…±Õ”¤¥ô(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰µÐ´ÄÜµ™Õ±°É½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµlÍt‰œµÝ¡¥Ñ”Áà´È¸ÔÁä´ÈÑ•áÐµáÌÑ•áÐµlŒÐÐÔÄÕtˆ(€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€íÁ¡½Ñ½Ì¹µ…À ¡Á¡½Ñ¼°¥¹‘•à¤€ôø€ñ½ÁÑ¥½¸­•äõíÁ¡½Ñ¼¹ÕÉ°ñð¥¹‘•áôÙ…±Õ”õí¥¹‘•áôùí¥¹‘•à€¬€Åô¸íÁ¡½Ñ¼¹¹…µ”ñð€‰UÁ±½…‘•Á¡½Ñ¼‰ôð½½ÁÑ¥½¸ø¥ô(€€€€€€€€€€€€€€€€€€€€ð½Í•±•Ðø(€€€€€€€€€€€€€€€€€€ð½‘¥Øùô(€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•ÑÝ••¸™½¹Ðµµ½¹¼Ñ•áÐµlåÁátÕÁÁ•É…Í”Ñ•áÐµlŒÜÔÙ˜ØÝtˆøñÍÁ…¸ù•Í¥¸Í¥é”ð½ÍÁ…¸øñÍÁ…¸ùí…ÉÑÝ½É­M…±•ô”ð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐÑåÁ”ô‰É…¹”ˆµ¥¸ôˆÔÔˆµ…àôˆÄÐÔˆÙ…±Õ”õí…ÉÑÝ½É­M…±•ô½¹¡…¹”õí”€ôøÍ•ÑÉÑÝ½É­M…±”¡9Õµ‰•È¡”¹Ñ…É•Ð¹Ù…±Õ”¤¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°…•¹ÐµlŒÄÜÌÈÑtˆ€¼ø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´È¥¹±¥¹”µ™±•àÉ½Õ¹‘•µ±œ‰½É‘•È‰½É‘•ÈµlÍt‰œµlÑÝtÀ´Äˆø(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑÉÑÝ½É­¥Ñ5½‘” ‰™¥Ðˆ¥ô±…ÍÍ9…µ”õì‰É½Õ¹‘•µµÁà´ÌÁä´Ä¸ÔÑ•áÐµlÄÁÁát™½¹Ðµ‰½±ÕÁÁ•É…Í”€ˆ€¬€¡…ÉÑÝ½É­¥Ñ5½‘”€ôôô€‰™¥Ðˆ€ü€‰‰œµlŒÄÜÌÈÑtÑ•áÐµÝ¡¥Ñ”ˆ€è€‰Ñ•áÐµlŒØÐÜÀÝtˆ¥ôù¥Ðƒ
Ü¹¼É½Àð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑÉÑÝ½É­¥Ñ5½‘” ‰É½Àˆ¥ô±…ÍÍ9…µ”õì‰É½Õ¹‘•µµÁà´ÌÁä´Ä¸ÔÑ•áÐµlÄÁÁát™½¹Ðµ‰½±ÕÁÁ•É…Í”€ˆ€¬€¡…ÉÑÝ½É­¥Ñ5½‘”€ôôô€‰É½Àˆ€ü€‰‰œµlŒÄÜÌÈÑtÑ•áÐµÝ¡¥Ñ”ˆ€è€‰Ñ•áÐµlŒØÐÜÀÝtˆ¥ôùÉ½ÀÑ¼™¥±°ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€í…ÉÑÝ½É­¥Ñ5½‘”€ôôô€‰É½Àˆ€˜˜€ñÀ±…ÍÍ9…µ”ô‰µÐ´ÈÑ•áÐµlÄÁÁát±•…‘¥¹œµÉ•±…á•Ñ•áÐµlŒáÕÐátˆùÉ½ÀÑ¼¥±°¥¹Ñ•¹Ñ¥½¹…±±äÑÉ¥µÌ¥µ…”•‘•ÌÑ¼™¥±°Ñ¡”…ÉÑÝ½É¬‰½à¸UÍ”¥Ðƒ
Ü9¼É½ÀÑ¼­••ÀÑ¡”½µÁ±•Ñ”¥µ…”Ù¥Í¥‰±”¸ð½Àùô(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à©ÕÍÑ¥™äµ‰•ÑÝ••¸™½¹Ðµµ½¹¼Ñ•áÐµlåÁátÕÁÁ•É…Í”Ñ•áÐµlŒÜÔÙ˜ØÝtˆøñÍÁ…¸ùI½Ñ…Ñ¥½¸ð½ÍÁ…¸øñÍÁ…¸ùí…ÉÑÝ½É­I½Ñ…Ñ¥½¹÷
Àð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐÑåÁ”ô‰É…¹”ˆµ¥¸ôˆ´ÄÈˆµ…àôˆÄÈˆÙ…±Õ”õí…ÉÑÝ½É­I½Ñ…Ñ¥½¹ô½¹¡…¹”õí”€ôøÍ•ÑÉÑÝ½É­I½Ñ…Ñ¥½¸¡9Õµ‰•È¡”¹Ñ…É•Ð¹Ù…±Õ”¤¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°…•¹ÐµläÈÜÍ•tˆ€¼ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øùô((€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´Ì™±•à™±•àµÝÉ…À¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´Èˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à™±•àµÝÉ…À¥Ñ•µÌµ•¹Ñ•È…Àµà´Ð…Àµä´Èˆø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑM¡½ÝÕ¥‘•Ì¡Ø€ôø€…Ø¥ô±…ÍÍ9…µ”ô‰¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÑ•áÐµlÄÅÁátÍ´éÑ•áÐµlÄÁÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµlŒÜÀÙ„ØÉt¡½Ù•ÈéÑ•áÐµ…•¹Ðˆøñå”Í¥é”õìÄÍô€¼øíÍ¡½ÝÕ¥‘•Ì€ü€‰!¥‘”ÁÉ¥¹ÐÕ¥‘”ˆ€è€‰M¡½ÜÁÉ¥¹ÐÕ¥‘”‰ôð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑM¡½Ý5•…ÍÕÉ•µ•¹ÑÌ¡Ø€ôø€…Ø¥ô±…ÍÍ9…µ”ô‰¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÑ•áÐµlÄÅÁátÍ´éÑ•áÐµlÄÁÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµlŒÜÀÙ„ØÉt¡½Ù•ÈéÑ•áÐµ…•¹ÐˆøñIÕ±•ÈÍ¥é”õìÄÍô€¼øíÍ¡½Ý5•…ÍÕÉ•µ•¹ÑÌ€ü€‰!¥‘”µ•…ÍÕÉ•µ•¹ÑÌˆ€è€‰M¡½Üµ•…ÍÕÉ•µ•¹ÑÌ‰ôð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õíÉ•Í•ÑAÉ•Ù¥•ÝA±…•µ•¹Ñô±…ÍÍ9…µ”ô‰¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÑ•áÐµlÄÅÁátÍ´éÑ•áÐµlÄÁÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµlŒÜÀÙ„ØÉt¡½Ù•ÈéÑ•áÐµ…•¹ÐˆøñI½Ñ…Ñ•ÜÍ¥é”õìÄÍô€¼øI•Í•Ðð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰µÐ´ÈÑ•áÐµlÄÁÁát™½¹Ðµµ½¹¼ÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒá˜ààÝ™tˆùI•½µµ•¹‘•ÁÉ¥¹Ðé½¹”ÕÁ‘…Ñ•Ì…™Ñ•Èå½Ô¡½½Í”„…Éµ•¹Ð…¹Í¥é”¸ð½Àø(€€€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰µÐ´ÈÑ•áÐµlÄÅÁátÍ´éÑ•áÐµlÄÁÁát±•…‘¥¹œµÉ•±…á•Ñ•áÐµlŒÝÜØÙ‘tˆùÉÑÝ½É¬½¹ÑÉ½±Ì…Ñ¥Ù…Ñ”…™Ñ•Èå½Ô¡½½Í”„@ÍÑå±”…¹ÕÁ±½…„Á¡½Ñ¼¸9½Ñ¡¥¹œ¥Ì…ÁÁ±¥•…ÕÑ½µ…Ñ¥…±±ä¸ð½Àø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•µlÈÉÁát‰½É‘•È‰½É‘•Èµl‘‘Ùt‰œµlŒÄÜÈÄÉ	tÑ•áÐµÝ¡¥Ñ”À´ÔÍ¡…‘½ÜµlÁ|ÄÑÁá|ÐÁÁá}É‰„ ÈÀ°Äà°ÄØ°¸ÄÄ¥tˆø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸É•µtÑ•áÐµÝ¡¥Ñ”¼ÐÔˆùe½ÕÈ½É‘•Èð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµ‘¥ÍÁ±…äÑ•áÐ´Íá°µÐ´Èˆùí½…Í¥½¸ñð€‰	Õ¥±å½ÕÈ½É‘•È‰ôð½‘¥Øø(€€€€€€€€€€€€€€ñMÕµµ…ÉåI½Ü±…‰•°ô‰MÑå±”ˆÙ…±Õ”õí‘•Í¥¹MÑå±”€ü‘•Í¥¹MÑå±”¹É•Á±…” ‰@€ˆ°ˆˆ¤€è€‰9½ÐÍ•±•Ñ•‰ô€¼ø(€€€€€€€€€€€€€€ñMÕµµ…ÉåI½Ü±…‰•°ô‰…Éµ•¹ÐˆÙ…±Õ”õíÁÉ½‘ÕÐü¹¹…µ”ñð€‰9½ÐÍ•±•Ñ•‰ô€¼ø(€€€€€€€€€€€€€€ñMÕµµ…ÉåI½Ü±…‰•°ô‰M¥é”€¼½±½ÈˆÙ…±Õ”õíÍ¥é”€˜˜½±½È€ü€‘íÍ¥é•ô€¼€‘í½±½Éõ€€è€‰9½ÐÍ•±•Ñ•‰ô€¼ø(€€€€€€€€€€€€€€ñMÕµµ…ÉåI½Ü±…‰•°ô‰A¡½Ñ½ÌˆÙ…±Õ”õíÁ¡½Ñ½Ì¹±•¹Ñ €¬€ˆ¼ˆ€¬µ…áA¡½Ñ½Íô€¼ø(€€€€€€€€€€€€€€ñMÕµµ…ÉåI½Ü±…‰•°ô‰Q½Ñ…°Í¡¥ÉÑÌˆÙ…±Õ”õíÑ½Ñ…±U¹¥ÑÍô€¼ø(€€€€€€€€€€€€€€ñMÕµµ…ÉåI½Ü±…‰•°ô‰AÉ½½˜ˆÙ…±Õ”õíÁÉ½½™I•ÅÕ¥É•€ü€‰	•™½É”ÁÉ¥¹Ðˆ€è€‰M­¥ÁÁ•‰ô€¼ø(€€€€€€€€€€€€€íÍ¡½Ý=É‘•ÉAÉ¥”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰½É‘•ÈµÐ‰½É‘•ÈµÝ¡¥Ñ”¼ÄÔµÐ´ÔÁÐ´Ð™±•à©ÕÍÑ¥™äµ‰•ÑÝ••¸¥Ñ•µÌµ•¹ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áÐµlÄÁÁátÕÁÁ•É…Í”™½¹Ðµµ½¹¼Ñ•áÐµÝ¡¥Ñ”¼ÐÔˆùíÁÉ¥•Y¥Í¥‰¥±¥Ñä€ôôô€‰Ñ½Ñ…°ˆ€ü€‰ÍÑ¥µ…Ñ•ÍÕ‰Ñ½Ñ…°ˆ€è€‰U¹¥ÐÁÉ¥”‰ôð½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”ô‰™½¹Ðµ‘¥ÍÁ±…äÑ•áÐ´Íá°ˆùìˆˆ€¬€¡ÁÉ¥•Y¥Í¥‰¥±¥Ñä€ôôô€‰Ñ½Ñ…°ˆ€ü•ÍÑ¥µ…Ñ•‘MÕ‰Ñ½Ñ…°€èÕ¹¥ÑAÉ¥”¤¹Ñ½¥á• È¥ôð½ÍÁ…¸øð½‘¥Øùô(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½…Í¥‘”ø(€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÉ•˜õíµ½‰¥±•¹‘I•™ô±…ÍÍ9…µ”ô‰µÐ´Ø™±•à©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´ÌÁˆ´àµéÁˆ´Àˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÍÑ•À€ôôô€Ä€ü¹…Ù¥…Ñ” ´Ä¤€èÍ•ÑMÑ•À¡ÍÑ•À€´€Ä¥ô±…ÍÍ9…µ”ô‰¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµlåÉŒát‰œµÝ¡¥Ñ”Áà´ÔÁä´Ì™½¹Ðµ‰½±ÕÁÁ•É…Í”Ñ•áÐµáÌÑ•áÐµlŒÌÌÉ˜É…tÍ¡…‘½ÜµÍ´¡½Ù•Èé‰½É‘•Èµl……„ÄäátˆøñÉÉ½Ý1•™ÐÍ¥é”õìÄÙô¼ùíÍÑ•À€ôôô€Ä€ü€‰	…¬ˆ€è€‰AÉ•Ù¥½ÕÌ‰ôð½‰ÕÑÑ½¸ø(€€€€€€€€€íÍÑ•À€ðMQAL¹±•¹Ñ €˜˜€ñ‰ÕÑÑ½¸‘¥Í…‰±•õì……¹½¹Ñ¥¹Õ” ¥ô½¹±¥¬õì ¤€ôø…¹½¹Ñ¥¹Õ” ¤€˜˜Í•ÑMÑ•À¡ÍÑ•À€¬€Ä¥ô±…ÍÍ9…µ”ô‰¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÈÉ½Õ¹‘•µá°‰œµlŒÄÜÌÈÑtÑ•áÐµÝ¡¥Ñ”Áà´ØÁä´Ì™½¹Ðµ‰½±ÕÁÁ•É…Í”Ñ•áÐµáÌÍ¡…‘½Üµ±œ‘¥Í…‰±•é½Á…¥Ñä´ÐÀˆù½¹Ñ¥¹Õ”€ñÉÉ½ÝI¥¡ÐÍ¥é”õìÄÙô¼øð½‰ÕÑÑ½¸ùô(€€€€€€€€ð½‘¥Øø((€€€€€€€íµ½‰¥±•±½…Ñ¥¹Ñ…¹…‰±•€˜˜µ½‰¥±•½­Y¥Í¥‰±”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰µé¡¥‘‘•¸™¥á•¥¹Í•Ðµà´Ì‰½ÑÑ½´´Ìè´ÐÀµàµ…ÕÑ¼µ…àµÜµµÉ½Õ¹‘•´Éá°‰½É‘•È‰½É‘•ÈµÝ¡¥Ñ”¼ÄÀ‰œµlŒÄÜÌÈÑt¼äÔ‰…­‘É½Àµ‰±ÕÈµá°Ñ•áÐµÝ¡¥Ñ”À´ÈÁ°´ÌÍ¡…‘½Ü´Éá°™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´Ìˆø(€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµláÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘•ÍÐÑ•áÐµÝ¡¥Ñ”¼ÐÔˆùÕÍÑ½´Á¥•”ð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµ‘¥ÍÁ±…äÑ•áÐµá°±•…‘¥¹œµ¹½¹”µÐ´ÄˆùíÍ¡½Ý=É‘•ÉAÉ¥”€ü€ˆˆ€¬€¡ÁÉ¥•Y¥Í¥‰¥±¥Ñä€ôôô€‰Ñ½Ñ…°ˆ€ü•ÍÑ¥µ…Ñ•‘MÕ‰Ñ½Ñ…°€èÕ¹¥ÑAÉ¥”¤¹Ñ½¥á• È¤€è€‰@MÑÕ‘¥¼‰ôð½‘¥Øøð½‘¥Øø(€€€€€€€€€íÍÑ•À€ðMQAL¹±•¹Ñ €ü€ñ‰ÕÑÑ½¸‘¥Í…‰±•õì……¹½¹Ñ¥¹Õ” ¥ô½¹±¥¬õì ¤€ôø…¹½¹Ñ¥¹Õ” ¤€˜˜Í•ÑMÑ•À¡ÍÑ•À€¬€Ä¥ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµÝ¡¥Ñ”Ñ•áÐµlŒÄÜÌÈÑtÁà´ÐÁä´È¸ÔÑ•áÐµáÌ™½¹Ðµ‰½±ÕÁÁ•É…Í”‘¥Í…‰±•é½Á…¥Ñä´ÐÀˆù½¹Ñ¥¹Õ”ƒŠHð½‰ÕÑÑ½¸ø€è€ñ‰ÕÑÑ½¸½¹±¥¬õíÉ•…Ñ•¹‘‘‘ô‘¥Í…‰±•õíÍ…Ù¥¹œñð€…É¥¡ÑÍ½¹™¥Éµ•ñð€……ÁÁÉ½Ù…±­¹½Ý±•‘•‘ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰œµ…•¹ÐÑ•áÐµÝ¡¥Ñ”Áà´ÐÁä´È¸ÔÑ•áÐµáÌ™½¹Ðµ‰½±ÕÁÁ•É…Í”‘¥Í…‰±•é½Á…¥Ñä´ÐÀˆùíÍ…Ù¥¹œ€ü€‰M…Ù¥¹ŸŠ˜ˆ€è€‰‘Ñ¼…ÉÐƒŠH‰ôð½‰ÕÑÑ½¸ùô(€€€€€€€€ð½‘¥Øùô((€€€€€€€íÍ¡½Ý%¹Ñ•¹Í¥Ñåá…µÁ±•Ì€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ð´ÀèµläÙt™±•à¥Ñ•µÌµ•¹©ÕÍÑ¥™äµ•¹Ñ•È‰œµ‰±…¬¼ÜÀÍ´é¥Ñ•µÌµ•¹Ñ•ÈÍ´éÀ´ÔˆÉ½±”ô‰‘¥…±½œˆ…É¥„µµ½‘…°ô‰ÑÉÕ”ˆ…É¥„µ±…‰•°ô‰•Í¥¸¥¹Ñ•¹Í¥Ñä•á…µÁ±•Ìˆø(€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ð´Àˆ½¹±¥¬õì ¤€ôøÍ•ÑM¡½Ý%¹Ñ•¹Í¥Ñåá…µÁ±•Ì¡™…±Í”¥ô…É¥„µ±…‰•°ô‰±½Í”‘•Í¥¸¥¹Ñ•¹Í¥Ñä•á…µÁ±•Ìˆ€¼ø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É•±…Ñ¥Ù”è´ÄÀÜµ™Õ±°µ…àµ µläÉ‘Ù¡t½Ù•É™±½Üµäµ…ÕÑ¼É½Õ¹‘•µÐµlÈáÁát‰½É‘•È‰½É‘•ÈµÝ¡¥Ñ”¼ÄÀ‰œµlÑÝtÍ¡…‘½Ü´Éá°Í´éµ…àµÜ´Õá°Í´éÉ½Õ¹‘•µlÈáÁátˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÑ¥­äÑ½À´Àè´ÄÀ™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´Ð‰½É‘•Èµˆ‰½É‘•Èµl‘•á™t‰œµlÑÝt¼äÔÁà´ÐÁä´Ì¸Ô‰…­‘É½Àµ‰±ÕÈÍ´éÁà´Ôˆø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸É•µtÑ•áÐµ…•¹Ðˆù•Í¥¸¥¹Ñ•¹Í¥ÑäÕ¥‘”ð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´À¸Ô™½¹Ðµ‰½±Ñ•áÐµlŒÈÐÈÄÅ•tˆùÉ½´±•…¸Ñ¼™Õ±°‰½½Ñ±•œ•¹•Éäð½‘¥Øø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑM¡½Ý%¹Ñ•¹Í¥Ñåá…µÁ±•Ì¡™…±Í”¥ô±…ÍÍ9…µ”ô‰É¥ ´äÜ´äÍ¡É¥¹¬´ÀÁ±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµláÅŒÝt‰œµÝ¡¥Ñ”Ñ•áÐµlŒÌäÌÐÉ™tˆ…É¥„µ±…‰•°ô‰±½Í”ˆøñ`Í¥é”õìÄÙô¼øð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰À´ÌÍ´éÀ´Ôˆø(€€€€€€€€€€€€€íÍ¡½Ý½µ‰¥¹•‘%¹Ñ•¹Í¥ÑåÕ¥‘”€ü€ (€€€€€€€€€€€€€€€€…¡…Í%¹Ñ•¹Í¥Ñå=Ù•ÉÉ¥‘•Ì€ü€ (€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµ¡¥‘‘•¸É½Õ¹‘•´Éá°‰½É‘•È‰½É‘•Èµl‘‘Ù‘t‰œµÝ¡¥Ñ”ˆø(€€€€€€€€€€€€€€€€€€€€ñ¥µœ(€€€€€€€€€€€€€€€€€€€€€ÍÉŒõí¥¹Ñ•¹Í¥Ñåá…µÁ±•%µ…•UÉ±ô(€€€€€€€€€€€€€€€€€€€€€…±Ðô‰¥Ù”‰½½Ñ±•œÉ…ÀPµÍ¡¥ÉÐ•á…µÁ±•ÌÍ¡½Ý¥¹œ‘•Í¥¸¥¹Ñ•¹Í¥Ñä™É½´€Ä½ÕÐ½˜€Ô±•…¸Ñ¼€Ô½ÕÐ½˜€Ôµ…á¥µÕ´¡…½Ìˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰‰±½¬ µ…ÕÑ¼Üµ™Õ±°ˆ(€€€€€€€€€€€€€€€€€€€€€±½…‘¥¹œô‰±…éäˆ(€€€€€€€€€€€€€€€€€€€€€‘•½‘¥¹œô‰…Íå¹Œˆ(€€€€€€€€€€€€€€€€€€€€€½¹ÉÉ½Èõì¡•Ù•¹Ð¤€ôøì(€€€€€€€€€€€€€€€€€€€€€€€½¹ÍÐ™…±±‰…¬€ôU1Q}MQU%=}MQQ%9L¹¥¹Ñ•¹Í¥Ñåá…µÁ±•%µ…•UÉ°ì(€€€€€€€€€€€€€€€€€€€€€€€¥˜€¡•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹•ÑÑÑÉ¥‰ÕÑ” ‰ÍÉŒˆ¤€„ôô™…±±‰…¬¤ì(€€€€€€€€€€€€€€€€€€€€€€€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹ÍÉŒ€ô™…±±‰…¬ì(€€€€€€€€€€€€€€€€€€€€€€€ô(€€€€€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ÍÁ…”µä´È¸Ôˆø(€€€€€€€€€€€€€€€€€€€í=‰©•Ð¹•¹ÑÉ¥•Ì¡M%9}%9Q9M%Qe}1Y1L¤¹µ…À ¡m±•Ù•°°¥Ñ•µt¤€ôø€ (€€€€€€€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€€€€€€€­•äõí±•Ù•±ô(€€€€€€€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøìÍ•Ñ•Í¥¹%¹Ñ•¹Í¥Ñä¡9Õµ‰•È¡±•Ù•°¤¤ìÍ•ÑM¡½Ý%¹Ñ•¹Í¥Ñåá…µÁ±•Ì¡™…±Í”¤ìõô(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õì‰É¥Üµ™Õ±°É¥µ½±ÌµlØáÁá|Å™Ét…À´Ì½Ù•É™±½Üµ¡¥‘‘•¸É½Õ¹‘•´Éá°‰½É‘•ÈÑ•áÐµ±•™ÐÑÉ…¹Í¥Ñ¥½¸Í´éÉ¥µ½±ÌµlÜáÁá|Å™É|ÈÄÁÁát€ˆ€¬€¡9Õµ‰•È¡±•Ù•°¤€ôôô‘•Í¥¹%¹Ñ•¹Í¥Ñä€ü€‰‰½É‘•Èµ…•¹Ð‰œµ…•¹Ð½lÀ¸ÀÐÕtˆ€è€‰‰½É‘•Èµl‘‘Ù‘t‰œµÝ¡¥Ñ”¡½Ù•Èé‰½É‘•Èµ…•¹Ðˆ¥ô(€€€€€€€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥Á±…”µ¥Ñ•µÌµ•¹Ñ•È‰œµlŒÅŒÅˆÄåtÁà´ÈÁä´ÐÑ•áÐµÝ¡¥Ñ”ˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµ•¹Ñ•Èˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµá°™½¹Ðµ‰±…¬ˆùí±•Ù•±ô¼Ôð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´À¸ÔÑ•áÐµláÁát™½¹Ðµ‰½±ÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµÝ¡¥Ñ”¼ØÀˆùí¥Ñ•´¹±…‰•±ôð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Í•±˜µ•¹Ñ•ÈÁä´ÌÁÈ´ÌÍ´éÁÈ´Àˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´™½¹Ðµ‰½±Ñ•áÐµlŒÈäÈØÈÉtˆùí¥Ñ•´¹±…‰•±ôð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµlÄÅÁát±•…‘¥¹œµÉ•±…á•Ñ•áÐµlŒÜÐÙØÑtˆùí¥Ñ•´¹‘•ÍÉ¥ÁÑ¥½¹ôð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½°µÍÁ…¸´È…ÍÁ•ÐµlÄØ¼åt‰œµlŒÄàÄàÄátÍ´é½°µÍÁ…¸´ÄÍ´é…ÍÁ•Ðµ…ÕÑ¼Í´éµ¥¸µ µlÄÄáÁátˆø(€€€€€€€€€€€€€€€€€€€€€€€€€€ñ%¹Ñ•¹Í¥Ñåá…µÁ±•Y¥ÍÕ…°ÍÉŒõí¥¹Ñ•¹Í¥Ñå%µ…•Ím±•Ù•±uô±…‰•°õí€‘í±•Ù•±ô¼Ô€‘í¥Ñ•´¹±…‰•±õô€¼ø(€€€€€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€€€€€¤¥ô(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰½Ù•É™±½Üµ¡¥‘‘•¸É½Õ¹‘•´Éá°‰½É‘•È‰½É‘•Èµl‘‘Ù‘t‰œµlŒÄàÄàÄátˆø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…ÍÁ•ÐµlÐ¼ÕtÍ´é…ÍÁ•ÐµlÄØ¼åtˆø(€€€€€€€€€€€€€€€€€€€€ñ%¹Ñ•¹Í¥Ñåá…µÁ±•Y¥ÍÕ…°ÍÉŒõíÍ•±•Ñ•‘%¹Ñ•¹Í¥Ñå%µ…•ô±…‰•°õí€‘í‘•Í¥¹%¹Ñ•¹Í¥Ñåô¼Ô€‘í¥¹Ñ•¹Í¥Ñå1•Ù•°¹±…‰•±õô±…É”€¼ø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰‰œµÝ¡¥Ñ”À´Ðˆø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´™½¹Ðµ‰½±ˆùí‘•Í¥¹%¹Ñ•¹Í¥Ñåô¼Ôƒ
Üí¥¹Ñ•¹Í¥Ñå1•Ù•°¹±…‰•±ôð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµáÌ±•…‘¥¹œµÉ•±…á•Ñ•áÐµlŒÜÐÙØÑtˆùí¥¹Ñ•¹Í¥Ñå1•Ù•°¹‘•ÍÉ¥ÁÑ¥½¹ôð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÐÉ¥É¥µ½±Ì´Ô…À´Ä¸ÔÍ´é…À´Èˆø(€€€€€€€€€€€€€€€í=‰©•Ð¹•¹ÑÉ¥•Ì¡M%9}%9Q9M%Qe}1Y1L¤¹µ…À ¡m±•Ù•°°¥Ñ•µt¤€ôø€ñ‰ÕÑÑ½¸(€€€€€€€€€€€€€€€€€­•äõí±•Ù•±ô(€€€€€€€€€€€€€€€€€ÑåÁ”ô‰‰ÕÑÑ½¸ˆ(€€€€€€€€€€€€€€€€€½¹±¥¬õì ¤€ôøì(€€€€€€€€€€€€€€€€€€€Í•Ñ•Í¥¹%¹Ñ•¹Í¥Ñä¡9Õµ‰•È¡±•Ù•°¤¤ì(€€€€€€€€€€€€€€€€€€€¥˜€¡Í¡½Ý½µ‰¥¹•‘%¹Ñ•¹Í¥ÑåÕ¥‘”¤Í•ÑM¡½Ý%¹Ñ•¹Í¥Ñåá…µÁ±•Ì¡™…±Í”¤ì(€€€€€€€€€€€€€€€€€õô(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õì‰É½Õ¹‘•µá°‰½É‘•ÈÁà´ÄÁä´ÈÑ•áÐµ•¹Ñ•ÈÑÉ…¹Í¥Ñ¥½¸Í´éÀ´ÌÍ´éÑ•áÐµ±•™Ð€ˆ€¬€¡9Õµ‰•È¡±•Ù•°¤€ôôô‘•Í¥¹%¹Ñ•¹Í¥Ñä€ü€‰‰½É‘•Èµ…•¹Ð‰œµ…•¹Ð½lÀ¸ÀÙtˆ€è€‰‰½É‘•Èµl‘‘Ù‘t‰œµÝ¡¥Ñ”¡½Ù•Èé‰½É‘•Èµ…•¹Ðˆ¥ô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµlÄÁÁát™½¹Ðµ‰½±Í´éÑ•áÐµáÌˆùí±•Ù•±ô¼ÔñÍÁ…¸±…ÍÍ9…µ”ô‰¡¥‘‘•¸Í´é¥¹±¥¹”ˆøƒ
Üí¥Ñ•´¹±…‰•±ôð½ÍÁ…¸øð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø¥ô(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰µÐ´ÌÑ•áÐµlÄÁÁát±•…‘¥¹œµÉ•±…á•Ñ•áÐµlŒàÄÜäÜÁtˆùá…µÁ±•Ì…É”Ù¥ÍÕ…°‘¥É•Ñ¥½¸½¹±ä¸e½ÕÈ™¥¹…°@…ÉÑÝ½É¬¥ÌÕÍÑ½µ¥é•Ñ¼å½ÕÈÁ¡½Ñ½Ì°ÍÑ½Éä…¹Í•±•Ñ•ÍÑå±”¸ð½Àø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øùô((€€€€€€€í™Õ±±ÍÉ••¹AÉ•Ù¥•Ü€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰™¥á•¥¹Í•Ð´ÀèµläÁt‰œµlŒÄÄÅt¼äÔ‰…­‘É½Àµ‰±ÕÈµÍ´À´ÌµéÀ´Üˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ µ™Õ±°µ…àµÜ´Õá°µàµ…ÕÑ¼É½Õ¹‘•µlÈáÁát½Ù•É™±½Üµ¡¥‘‘•¸‰œµl˜Ñ•™”Ýt‰½É‘•È‰½É‘•ÈµÝ¡¥Ñ”¼ÄÀ™±•à™±•àµ½°ˆø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰ ´ÄØÍ¡É¥¹¬´À™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´ÐÁà´ÐµéÁà´Ø‰œµlŒÄÜÌÈÑtÑ•áÐµÝ¡¥Ñ”ˆø(€€€€€€€€€€€€€€ñ‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸É•µtÑ•áÐµÝ¡¥Ñ”¼ÐÔˆù@ÕÍÑ½´MÑÕ‘¥¼ð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹ÐµÍ•µ¥‰½±ˆùÕ±°µÍÉ••¸…Éµ•¹ÐÁÉ•Ù¥•Üð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È…À´Èˆø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑM¡½Ý5•…ÍÕÉ•µ•¹ÑÌ¡Ø€ôø€…Ø¥ô±…ÍÍ9…µ”õì‰ ´äÜ´äÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µá°‰½É‘•È€ˆ€¬€¡Í¡½Ý5•…ÍÕÉ•µ•¹ÑÌ€ü€‰‰½É‘•Èµ…•¹Ð‰œµ…•¹Ð¼ÄÔÑ•áÐµÝ¡¥Ñ”ˆ€è€‰‰½É‘•ÈµÝ¡¥Ñ”¼ÄÔÑ•áÐµÝ¡¥Ñ”¼ÜÔˆ¥ô…É¥„µ±…‰•°õíÍ¡½Ý5•…ÍÕÉ•µ•¹ÑÌ€ü€‰!¥‘”µ•…ÍÕÉ•µ•¹ÑÌˆ€è€‰M¡½Üµ•…ÍÕÉ•µ•¹ÑÌ‰ôøñIÕ±•ÈÍ¥é”õìÄÕô¼øð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑAÉ•Ù¥•Ýi½½´¡Ø€ôø±…µÁAÉ•Ù¥•Ü¡Ø€´€¸Ä¤¥ô±…ÍÍ9…µ”ô‰ ´äÜ´äÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÝ¡¥Ñ”¼ÄÔˆøñi½½µ=ÕÐÍ¥é”õìÄÕô¼øð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ü´ÄÈÑ•áÐµ•¹Ñ•È™½¹Ðµµ½¹¼Ñ•áÐµlÄÁÁátˆùí5…Ñ ¹É½Õ¹¡ÁÉ•Ù¥•Ýi½½´€¨€ÄÀÀ¥ô”ð½ÍÁ…¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑAÉ•Ù¥•Ýi½½´¡Ø€ôø±…µÁAÉ•Ù¥•Ü¡Ø€¬€¸Ä¤¥ô±…ÍÍ9…µ”ô‰ ´äÜ´äÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµÝ¡¥Ñ”¼ÄÔˆøñi½½µ%¸Í¥é”õìÄÕô¼øð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑÕ±±ÍÉ••¹AÉ•Ù¥•Ü¡™…±Í”¥ô±…ÍÍ9…µ”ô‰ ´äÜ´äÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µá°‰œµÝ¡¥Ñ”Ñ•áÐµlŒÄÜÌÈÑtˆ…É¥„µ±…‰•°ô‰±½Í”™Õ±°ÍÉ••¸ÁÉ•Ù¥•Üˆøñ`Í¥é”õìÄÙô¼øð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à´Äµ¥¸µ ´Àˆø(€€€€€€€€€€€€€€ñMÑÕ‘¥½AÉ•Ù¥•Ü…Éµ•¹Ðõí…Éµ•¹Ñô½±½ÈõíÁÉ•Ù¥•Ý½±½ÉôÍ¥‘”õíÁÉ•Ù¥•ÝM¥‘•ôÁ±…•µ•¹ÐõíÁ±…•µ•¹ÑôÁ¡½Ñ¼õíÁÉ•Ù¥•ÝÉÑÝ½É­A¡½Ñ½ôÕÁ±½…‘¥¹œõíÕÁ±½…‘¥¹ôÁ•ÉÍ½¹…±¥é…Ñ¥½¸õíÁ•ÉÍ½¹…±¥é…Ñ¥½¹ôé½½´õíÁÉ•Ù¥•Ýi½½µôÍ•Ñi½½´õíÍ•ÑAÉ•Ù¥•Ýi½½µô…ÉÑÝ½É­M…±”õí…ÉÑÝ½É­M…±•ô…ÉÑÝ½É­I½Ñ…Ñ¥½¸õí…ÉÑÝ½É­I½Ñ…Ñ¥½¹ô…ÉÑÝ½É­=™™Í•Ðõí…ÉÑÝ½É­=™™Í•ÑôÍ•ÑÉÑÝ½É­=™™Í•ÐõíÍ•ÑÉÑÝ½É­=™™Í•Ñô…ÉÑÝ½É­¥Ñ5½‘”õí…ÉÑÝ½É­¥Ñ5½‘•ôÍ¡½ÝÕ¥‘•ÌõíÍ¡½ÝÕ¥‘•ÍôÍ¡½Ý5•…ÍÕÉ•µ•¹ÑÌõíÍ¡½Ý5•…ÍÕÉ•µ•¹ÑÍôÍ¥é”õíÍ¥é•ôÁÉ•Ù¥•Ý½¹™¥œõí½¹™¥œ¹ÁÉ•Ù¥•ÜñðíõôÍÑå±•Q•µÁ±…Ñ”õí…Ñ¥Ù•MÑå±•Q•µÁ±…Ñ•ôµ½½õí‘•Í¥¹5½½‘ô™Õ±±ÍÉ••¸€¼ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øùô(€€€€€€ð½‘¥Øø(€€€€ð½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸%¹Ñ•¹Í¥Ñåá…µÁ±•Y¥ÍÕ…°¡ìÍÉŒ°±…‰•°°±…ÍÍ9…µ”€ô€ˆˆ°±…É”€ô™…±Í”ô¤ì(€½¹ÍÐm™…¥±•°Í•Ñ…¥±•‘t€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì(€ÕÍ•™™•Ð  ¤€ôøÍ•Ñ…¥±•¡™…±Í”¤°mÍÉt¤ì((€¥˜€¡ÍÉŒ€ôôô!%9}%9Q9M%Qe}%5¤ì(€€€É•ÑÕÉ¸€ (€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õì‰ µ™Õ±°Üµ™Õ±°É¥Á±…”µ¥Ñ•µÌµ•¹Ñ•È‰œµlŒÈÈÉtÑ•áÐµ•¹Ñ•ÈÑ•áÐµÝ¡¥Ñ”¼ÔÔ€ˆ€¬±…ÍÍ9…µ•ôø(€€€€€€€€ñ‘¥Øøñ`Í¥é”õí±…É”€ü€ÈØ€è€Äáô±…ÍÍ9…µ”ô‰µàµ…ÕÑ¼ˆ¼øñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”ˆùá…µÁ±”É•µ½Ù•ð½‘¥Øøð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€¤ì(€ô((€¥˜€¡ÍÉŒ€˜˜€…™…¥±•¤ì(€€€É•ÑÕÉ¸€ñ¥µœÍÉŒõíÍÉô…±Ðõí±…‰•±ô±…ÍÍ9…µ”õì‰ µ™Õ±°Üµ™Õ±°½‰©•Ðµ½Ù•È€ˆ€¬±…ÍÍ9…µ•ô±½…‘¥¹œô‰±…éäˆ‘•½‘¥¹œô‰…Íå¹Œˆ½¹ÉÉ½Èõì ¤€ôøÍ•Ñ…¥±•¡ÑÉÕ”¥ô€¼øì(€ô((€É•ÑÕÉ¸€ (€€€€ñ‘¥Ø±…ÍÍ9…µ”õì‰ µ™Õ±°Üµ™Õ±°É¥Á±…”µ¥Ñ•µÌµ•¹Ñ•È‰œµmÉ…‘¥…°µÉ…‘¥•¹Ð¡¥É±•}…Ñ|ÔÀ•|ÌÈ”°ŒÌäÌäÌå|À”°ŒÄäÄäÄå|ÔÔ”°ŒÄÀÄÀÄÁ|ÄÀÀ”¥tÑ•áÐµÝ¡¥Ñ”Ñ•áÐµ•¹Ñ•È€ˆ€¬±…ÍÍ9…µ•ôø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰Áà´Ðˆø(€€€€€€€€ñM¡¥ÉÐÍ¥é”õí±…É”€ü€ÌÐ€è€ÈÑô±…ÍÍ9…µ”ô‰µàµ…ÕÑ¼Ñ•áÐµÝ¡¥Ñ”¼ÐÔˆ¼ø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÈÑ•áÐµlÄÁÁát™½¹Ðµ‰½±ÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸ÄÉ•µtˆù@‘•™…Õ±Ðð½‘¥Øø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµlåÁátÑ•áÐµÝ¡¥Ñ”¼ÐÔˆùí±…‰•±ôð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½‘¥Øø(€€¤ì)ô()™Õ¹Ñ¥½¸±…µÁAÉ•Ù¥•Ü¡Ù…±Õ”¤ì(€É•ÑÕÉ¸5…Ñ ¹µ¥¸ Ä¸à°5…Ñ ¹µ…à À¸Ü°9Õµ‰•È¡9Õµ‰•È¡Ù…±Õ”¤¹Ñ½¥á• È¤¤¤¤ì)ô()™Õ¹Ñ¥½¸MÑÕ‘¥½AÉ•Ù¥•Ü¡ì…Éµ•¹Ð°½±½È°Í¥‘”°Á±…•µ•¹Ð°Á¡½Ñ¼°ÕÁ±½…‘¥¹œ€ô™…±Í”°Á•ÉÍ½¹…±¥é…Ñ¥½¸°é½½´°Í•Ñi½½´°…ÉÑÝ½É­M…±”°…ÉÑÝ½É­I½Ñ…Ñ¥½¸°…ÉÑÝ½É­=™™Í•Ð°Í•ÑÉÑÝ½É­=™™Í•Ð°…ÉÑÝ½É­¥Ñ5½‘”€ô€‰É½Àˆ°Í¡½ÝÕ¥‘•Ì°Í¡½Ý5•…ÍÕÉ•µ•¹ÑÌ°Í¥é”°ÁÉ•Ù¥•Ý½¹™¥œ€ôíô°ÍÑå±•Q•µÁ±…Ñ”°µ½½€ô€ˆˆ°™Õ±±ÍÉ••¸€ô™…±Í”ô¤ì(€½¹ÍÐ‘É…I•˜€ôÕÍ•I•˜¡¹Õ±°¤ì(€½¹ÍÐ‰±…¹­ÉÑÝ½É¬€ô(€€€€¡Í¥‘”€ôôô€‰‰…¬ˆ€˜˜Á±…•µ•¹Ð€ôôô€‰™É½¹Ðˆ¤ñð(€€€€¡Í¥‘”€ôôô€‰™É½¹Ðˆ€˜˜Á±…•µ•¹Ð€ôôô€‰‰…¬ˆ¤ì(€½¹ÍÐ¡…ÍAÉ•Ù¥•ÝQ•áÐ€ô	½½±•…¸ (€€€MÑÉ¥¹œ¡Á•ÉÍ½¹…±¥é…Ñ¥½¸ü¹¹…µ”ñð€ˆˆ¤¹ÑÉ¥´ ¤ñð(€€€MÑÉ¥¹œ¡Á•ÉÍ½¹…±¥é…Ñ¥½¸ü¹‘…Ñ•Ìñð€ˆˆ¤¹ÑÉ¥´ ¤ñð(€€€MÑÉ¥¹œ¡Á•ÉÍ½¹…±¥é…Ñ¥½¸ü¹ÅÕ½Ñ”ñð€ˆˆ¤¹ÑÉ¥´ ¤(€€¤ì(€€¼¼Q¡”Í•±•Ñ•@ÍÑå±”¥Ì¥ÑÍ•±˜ÁÉ¥¹Ñ…‰±”…ÉÑÝ½É¬°Í¼¥ÐÍ¡½Õ±…ÁÁ•…È(€€¼¼¥µµ•‘¥…Ñ•±ä¥¸Ñ¡”…Éµ•¹ÐÁÉ•Ù¥•Ü•Ù•¸‰•™½É”Ñ¡”ÕÍÑ½µ•ÈÕÁ±½…‘Ì„Á¡½Ñ¼¸(€½¹ÍÐ…¹É…œ€ô	½½±•…¸¡Á¡½Ñ¼€˜˜ÍÑå±•Q•µÁ±…Ñ”€˜˜€…‰±…¹­ÉÑÝ½É¬€˜˜Í•ÑÉÑÝ½É­=™™Í•Ð¤ì(€½¹ÍÐÁÉ•Ù¥•ÝM•ÑÑ¥¹Ì€ô€¼¨¨ÑåÁ”í…¹åô€¨¼€¡ÁÉ•Ù¥•Ý½¹™¥œñðíô¤ì(€½¹ÍÐ½±½ÉAÉ•Ù¥•Ü€ôÁÉ•Ù¥•ÝM•ÑÑ¥¹Ìü¹½±½É5½­ÕÁÌü¹m½±½Étñðíôì(€½¹ÍÐ™É½¹Ñ5½­ÕÁUÉ°€ô(€€€½±½ÉAÉ•Ù¥•Ü¹™É½¹ÑUÉ°ñð(€€€€ (€€€€€½±½È€ôôô…Éµ•¹Ðü¹‘•™…Õ±Ñ½±½È(€€€€€€€€ü€¡ÁÉ•Ù¥•ÝM•ÑÑ¥¹Ì¹…É‘%µ…•UÉ°ñð€ˆˆ¤(€€€€€€€€è€ˆˆ(€€€€¤ñð(€€€ÁÉ•Ù¥•ÝM•ÑÑ¥¹Ì¹™É½¹Ñ5½­ÕÁUÉ°ñð(€€€ÁÉ•Ù¥•Ý%µ…•½É…Éµ•¹Ð¡…Éµ•¹Ð°½±½È°€‰™É½¹Ðˆ¤ì(€½¹ÍÐ‰…­5½­ÕÁUÉ°€ô(€€€½±½ÉAÉ•Ù¥•Ü¹‰…­UÉ°ñð(€€€ÁÉ•Ù¥•ÝM•ÑÑ¥¹Ì¹‰…­5½­ÕÁUÉ°ñð(€€€ÁÉ•Ù¥•Ý%µ…•½É…Éµ•¹Ð¡…Éµ•¹Ð°½±½È°€‰‰…¬ˆ¤ì(€½¹ÍÐµ½­ÕÁUÉ°€ôÍ¥‘”€ôôô€‰‰…¬ˆ€ü‰…­5½­ÕÁUÉ°€è™É½¹Ñ5½­ÕÁUÉ°ì(€½¹ÍÐÁÉ•Ù¥•Ý…¹Ù…Ì€ôÉ•Í½±Ù•AÉ•Ù¥•Ý…¹Ù…Ì¡ÁÉ•Ù¥•ÝM•ÑÑ¥¹Ì¤ì(€½¹ÍÐµ½­ÕÁ9½Éµ…±¥é…Ñ¥½¸€ôÉ•Í½±Ù•5½­ÕÁ9½Éµ…±¥é…Ñ¥½¸¡ÁÉ•Ù¥•ÝM•ÑÑ¥¹Ì°Í¥‘”¤ì(€½¹ÍÐµ½­ÕÁ1…å•ÉMÑå±”€ô•Ñ5½­ÕÁ1…å•ÉMÑå±”¡µ½­ÕÁ9½Éµ…±¥é…Ñ¥½¸¤ì((€ÕÍ•™™•Ð  ¤€ôøì(€€€ÁÉ•±½…‘AÉ•Ù¥•Ý%µ…•Ì¡m™É½¹Ñ5½­ÕÁUÉ°°‰…­5½­ÕÁUÉ±t¤ì(€ô°m™É½¹Ñ5½­ÕÁUÉ°°‰…­5½­ÕÁUÉ±t¤ì(€½¹ÍÐ½¹™¥ÕÉ•‘9Õµ‰•È€ô€¡Ù…±Õ”°™…±±‰…¬¤€ôøì(€€€½¹ÍÐÁ…ÉÍ•€ô9Õµ‰•È¡Ù…±Õ”¤ì(€€€É•ÑÕÉ¸9Õµ‰•È¹¥Í¥¹¥Ñ”¡Á…ÉÍ•¤€˜˜Á…ÉÍ•€ø€À€üÁ…ÉÍ•€è™…±±‰…¬ì(€ôì(€½¹ÍÐ‘•™…Õ±ÑAÉ½™¥±”€ôÉ•½µµ•¹‘•‘AÉ¥¹ÑAÉ½™¥±”¡…Éµ•¹Ðü¹ÁÉ•Ù¥•ÝQåÁ”ñð…Éµ•¹Ðü¹ÑåÁ”°Í¥é”°Í¥‘”¤ì(€½¹ÍÐ½¹™¥ÕÉ•‘Õ¥‘”€ôÁÉ•Ù¥•ÝM•ÑÑ¥¹Ìü¹ÁÉ¥¹ÑÕ¥‘”ü¹mÍ¥‘•tñðíôì(€½¹ÍÐÍ¥é•-•ä€ôMÑÉ¥¹œ¡Í¥é”ñð€ˆˆ¤¹Ñ½UÁÁ•É…Í” ¤¹É•Á±…” ½qÌ¬½œ°€ˆˆ¤ì(€½¹ÍÐ½¹™¥ÕÉ•‘M¥é•Õ¥‘”€ô½¹™¥ÕÉ•‘Õ¥‘”ü¹Í¥é•M…±¥¹¹…‰±•€ôôô™…±Í”(€€€€üíô(€€€€è€¡½¹™¥ÕÉ•‘Õ¥‘”ü¹Í¥é•=Ù•ÉÉ¥‘•Ìü¹mÍ¥é•-•åtñð½¹™¥ÕÉ•‘Õ¥‘”ü¹Í¥é•=Ù•ÉÉ¥‘•Ìü¹mÍ¥é•tñðíô¤ì(€½¹ÍÐÁÉ½™¥±”€ôì(€€€€¸¸¹‘•™…Õ±ÑAÉ½™¥±”°(€€€½±±…É%¸è½¹™¥ÕÉ•‘9Õµ‰•È¡½¹™¥ÕÉ•‘M¥é•Õ¥‘”¹½±±…É%¸€üü½¹™¥ÕÉ•‘Õ¥‘”¹½±±…É%¸°‘•™…Õ±ÑAÉ½™¥±”¹½±±…É%¸¤°(€€€Ý¥‘Ñ¡%¸è½¹™¥ÕÉ•‘9Õµ‰•È¡½¹™¥ÕÉ•‘M¥é•Õ¥‘”¹Ý¥‘Ñ¡%¸€üü½¹™¥ÕÉ•‘Õ¥‘”¹Ý¥‘Ñ¡%¸°‘•™…Õ±ÑAÉ½™¥±”¹Ý¥‘Ñ¡%¸¤°(€€€¡•¥¡Ñ%¸è½¹™¥ÕÉ•‘9Õµ‰•È¡½¹™¥ÕÉ•‘M¥é•Õ¥‘”¹¡•¥¡Ñ%¸€üü½¹™¥ÕÉ•‘Õ¥‘”¹¡•¥¡Ñ%¸°‘•™…Õ±ÑAÉ½™¥±”¹¡•¥¡Ñ%¸¤°(€€€µ…á]¥‘Ñ¡%¸è½¹™¥ÕÉ•‘9Õµ‰•È¡½¹™¥ÕÉ•‘Õ¥‘”¹µ…á]¥‘Ñ¡%¸°‘•™…Õ±ÑAÉ½™¥±”¹µ…á]¥‘Ñ¡%¸ñð‘•™…Õ±ÑAÉ½™¥±”¹Ý¥‘Ñ¡%¸¤°(€€€µ…á!•¥¡Ñ%¸è½¹™¥ÕÉ•‘9Õµ‰•È¡½¹™¥ÕÉ•‘Õ¥‘”¹µ…á!•¥¡Ñ%¸°‘•™…Õ±ÑAÉ½™¥±”¹µ…á!•¥¡Ñ%¸ñð‘•™…Õ±ÑAÉ½™¥±”¹¡•¥¡Ñ%¸¤°(€ôì(€½¹ÍÐ½¹™¥ÕÉ•‘É•„€ôÁÉ•Ù¥•ÝM•ÑÑ¥¹Ìü¹ÁÉ¥¹ÑÉ•„ü¹mÍ¥‘•tñðíôì(€½¹ÍÐÕÍ•ÕÍÑ½µÉ•„€ôÁÉ•Ù¥•ÝM•ÑÑ¥¹Ìü¹ÁÉ¥¹ÑÉ•…5½‘”€ôôô€‰ÕÍÑ½´ˆñð½¹™¥ÕÉ•‘É•„ü¹µ½‘”€ôôô€‰ÕÍÑ½´ˆñðÁÉ½™¥±”¹•¹•É¥Œ€ôôôÑÉÕ”ì(€½¹ÍÐÁÉ¥¹ÑÉ•„€ôì(€€€Ñ½ÀèÕÍ•ÕÍÑ½µÉ•„€ü½¹™¥ÕÉ•‘9Õµ‰•È¡½¹™¥ÕÉ•‘É•„¹Ñ½À°ÁÉ½™¥±”¹Ñ½À¤€èÁÉ½™¥±”¹Ñ½À°(€€€Ý¥‘Ñ èÕÍ•ÕÍÑ½µÉ•„€ü½¹™¥ÕÉ•‘9Õµ‰•È¡½¹™¥ÕÉ•‘É•„¹Ý¥‘Ñ °ÁÉ½™¥±”¹Ý¥‘Ñ ¤€èÁÉ½™¥±”¹Ý¥‘Ñ °(€€€¡•¥¡ÐèÕÍ•ÕÍÑ½µÉ•„€ü½¹™¥ÕÉ•‘9Õµ‰•È¡½¹™¥ÕÉ•‘É•„¹¡•¥¡Ð°ÁÉ½™¥±”¹¡•¥¡Ð¤€èÁÉ½™¥±”¹¡•¥¡Ð(€ôì(€½¹ÍÐÁÉ¥¹ÑÉ•…MÑå±”€ôì(€€€Ñ½ÀèÁÉ¥¹ÑÉ•„¹Ñ½À€¬€ˆ”ˆ°(€€€Ý¥‘Ñ èÁÉ¥¹ÑÉ•„¹Ý¥‘Ñ €¬€ˆ”ˆ°(€€€¡•¥¡ÐèÁÉ¥¹ÑÉ•„¹¡•¥¡Ð€¬€ˆ”ˆ(€ôì(€½¹ÍÐµ…áÉ•…]¥‘Ñ €ô5…Ñ ¹µ¥¸ Üà°ÁÉ¥¹ÑÉ•„¹Ý¥‘Ñ €¨€¡½¹™¥ÕÉ•‘9Õµ‰•È¡ÁÉ½™¥±”¹µ…á]¥‘Ñ¡%¸°ÁÉ½™¥±”¹Ý¥‘Ñ¡%¸¤€¼5…Ñ ¹µ…à À¸Ä°ÁÉ½™¥±”¹Ý¥‘Ñ¡%¸¤¤¤ì(€½¹ÍÐµ…áÉ•…!•¥¡Ð€ô5…Ñ ¹µ¥¸ ÜÀ°ÁÉ¥¹ÑÉ•„¹¡•¥¡Ð€¨€¡½¹™¥ÕÉ•‘9Õµ‰•È¡ÁÉ½™¥±”¹µ…á!•¥¡Ñ%¸°ÁÉ½™¥±”¹¡•¥¡Ñ%¸¤€¼5…Ñ ¹µ…à À¸Ä°ÁÉ½™¥±”¹¡•¥¡Ñ%¸¤¤¤ì(€½¹ÍÐµ…áAÉ¥¹ÑÉ•…MÑå±”€ôì(€€€Ñ½ÀèÁÉ¥¹ÑÉ•„¹Ñ½À€¬€ˆ”ˆ°(€€€Ý¥‘Ñ èµ…áÉ•…]¥‘Ñ €¬€ˆ”ˆ°(€€€¡•¥¡Ðèµ…áÉ•…!•¥¡Ð€¬€ˆ”ˆ(€ôì(€½¹ÍÐ…ÉÑÝ½É­1…å•ÉMÑå±”€ôì(€€€±•™Ðè€ ÔÀ€¬9Õµ‰•È¡…ÉÑÝ½É­=™™Í•Ðü¹àñð€À¤¤€¬€ˆ”ˆ°(€€€Ñ½Àè€ ÔÀ€¬9Õµ‰•È¡…ÉÑÝ½É­=™™Í•Ðü¹äñð€À¤¤€¬€ˆ”ˆ°(€€€ÑÉ…¹Í™½É´èÑÉ…¹Í±…Ñ” ´ÔÀ”°€´ÔÀ”¤Í…±” ‘í…ÉÑÝ½É­M…±”€¼€ÄÀÁô¤É½Ñ…Ñ” ‘í…ÉÑÝ½É­I½Ñ…Ñ¥½¹õ‘•œ¥€°(€€€ÑÉ…¹Í™½Éµ=É¥¥¸è€‰•¹Ñ•È•¹Ñ•Èˆ(€ôì(€½¹ÍÐÑ•µÁ±…Ñ”€ôÍÑå±•Q•µÁ±…Ñ”ñð¹Õ±°ì(€½¹ÍÐµ½½‘QÉ•…Ñµ•¹Ð€ôµ½½‘AÉ•Ù¥•ÝQÉ•…Ñµ•¹Ð¡µ½½¤ì(€½¹ÍÐÁ¡½Ñ½i½¹”€ôÑ•µÁ±…Ñ”ü¹Á¡½Ñ½i½¹”ñðìàè€ÄÀ°äè€à°Ý¥‘Ñ è€àÀ°¡•¥¡Ðè€ØÐ°Í¡…Á”è€‰É½Õ¹‘•ˆ°É…‘¥ÕÌè€ÄÀôì(€½¹ÍÐÑ•áÑi½¹”€ôÑ•µÁ±…Ñ”ü¹Ñ•áÑi½¹”ñðìàè€ÄÀ°äè€àÀ°Ý¥‘Ñ è€àÀ°¡•¥¡Ðè€ÄÔ°…±¥¸è€‰•¹Ñ•Èˆ°Ñ½¹”è€‰±¥¡Ðˆôì(€½¹ÍÐé½¹•I…‘¥ÕÌ€ôÁ¡½Ñ½i½¹”¹Í¡…Á”€ôôô€‰¥É±”ˆñðÁ¡½Ñ½i½¹”¹Í¡…Á”€ôôô€‰½Ù…°ˆ(€€€€ü€ˆÔÀ”ˆ(€€€€èÁ¡½Ñ½i½¹”¹Í¡…Á”€ôôô€‰É•Ðˆ(€€€€€€ü€ˆÀˆ(€€€€€€è€‘í9Õµ‰•È¡Á¡½Ñ½i½¹”¹É…‘¥ÕÌñð€à¥ô•€ì(€½¹ÍÐÁ¡½Ñ½i½¹•MÑå±”€ôì(€€€±•™Ðè€‘í9Õµ‰•È¡Á¡½Ñ½i½¹”¹àñð€À¥ô•€°(€€€Ñ½Àè€‘í9Õµ‰•È¡Á¡½Ñ½i½¹”¹äñð€À¥ô•€°(€€€Ý¥‘Ñ è€‘í9Õµ‰•È¡Á¡½Ñ½i½¹”¹Ý¥‘Ñ ñð€ÄÀÀ¥ô•€°(€€€¡•¥¡Ðè€‘í9Õµ‰•È¡Á¡½Ñ½i½¹”¹¡•¥¡Ðñð€ÄÀÀ¥ô•€°(€€€‰½É‘•ÉI…‘¥ÕÌèé½¹•I…‘¥ÕÌ°(€ôì(€½¹ÍÐÑ•áÑi½¹•MÑå±”€ôì(€€€±•™Ðè€‘í9Õµ‰•È¡Ñ•áÑi½¹”¹àñð€À¥ô•€°(€€€Ñ½Àè€‘í9Õµ‰•È¡Ñ•áÑi½¹”¹äñð€À¥ô•€°(€€€Ý¥‘Ñ è€‘í9Õµ‰•È¡Ñ•áÑi½¹”¹Ý¥‘Ñ ñð€ÄÀÀ¥ô•€°(€€€¡•¥¡Ðè€‘í9Õµ‰•È¡Ñ•áÑi½¹”¹¡•¥¡Ðñð€ÄÔ¥ô•€°(€ôì(€½¹ÍÐ½±±…É¹¡½È€ô5…Ñ ¹µ¥¸¡ÁÉ¥¹ÑÉ•„¹Ñ½À€´€È°9Õµ‰•È¡ÁÉ½™¥±”¹½±±…É¹¡½Èñð€ÈÀ¤¤ì(€½¹ÍÐ½±±…ÉÕ¥‘•!•¥¡Ð€ô5…Ñ ¹µ…à È°ÁÉ¥¹ÑÉ•„¹Ñ½À€´½±±…É¹¡½È¤ì((€½¹ÍÐ½¹A½¥¹Ñ•É½Ý¸€ô€¡•Ù•¹Ð¤€ôøì(€€€¥˜€ ……¹É…œ¤É•ÑÕÉ¸ì(€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹Í•ÑA½¥¹Ñ•É…ÁÑÕÉ”ü¸¡•Ù•¹Ð¹Á½¥¹Ñ•É%¤ì(€€€½¹ÍÐÉ•Ð€ô•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹•Ñ	½Õ¹‘¥¹±¥•¹ÑI•Ð ¤ì(€€€‘É…I•˜¹ÕÉÉ•¹Ð€ôìàè•Ù•¹Ð¹±¥•¹Ñ`°äè•Ù•¹Ð¹±¥•¹Ñd°ÍÑ…ÉÑ`è…ÉÑÝ½É­=™™Í•Ð¹à°ÍÑ…ÉÑdè…ÉÑÝ½É­=™™Í•Ð¹ä°Ý¥‘Ñ èÉ•Ð¹Ý¥‘Ñ °¡•¥¡ÐèÉ•Ð¹¡•¥¡Ðôì(€ôì(€½¹ÍÐ½¹A½¥¹Ñ•É5½Ù”€ô€¡•Ù•¹Ð¤€ôøì(€€€¥˜€ …‘É…I•˜¹ÕÉÉ•¹Ðñð€……¹É…œ¤É•ÑÕÉ¸ì(€€€½¹ÍÐÍÑ…ÉÐ€ô‘É…I•˜¹ÕÉÉ•¹Ðì(€€€½¹ÍÐ±…µÀ€ô€¡Ø¤€ôø5…Ñ ¹µ¥¸ ÐÈ°5…Ñ ¹µ…à ´ÐÈ°Ø¤¤ì(€€€Í•ÑÉÑÝ½É­=™™Í•Ð¡ì(€€€€€àè±…µÀ¡ÍÑ…ÉÐ¹ÍÑ…ÉÑ`€¬€ ¡•Ù•¹Ð¹±¥•¹Ñ`€´ÍÑ…ÉÐ¹à¤€¼5…Ñ ¹µ…à Ä°ÍÑ…ÉÐ¹Ý¥‘Ñ ¤¤€¨€ÄÀÀ¤°(€€€€€äè±…µÀ¡ÍÑ…ÉÐ¹ÍÑ…ÉÑd€¬€ ¡•Ù•¹Ð¹±¥•¹Ñd€´ÍÑ…ÉÐ¹ä¤€¼5…Ñ ¹µ…à Ä°ÍÑ…ÉÐ¹¡•¥¡Ð¤¤€¨€ÄÀÀ¤(€€€ô¤ì(€ôì(€½¹ÍÐÍÑ½ÁÉ…œ€ô€ ¤€ôøì‘É…I•˜¹ÕÉÉ•¹Ð€ô¹Õ±°ìôì(€½¹ÍÐ½¹]¡••°€ô€¡•Ù•¹Ð¤€ôøì(€€€¥˜€ …Í•Ñi½½´¤É•ÑÕÉ¸ì(€€€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€€€Í•Ñi½½´¡Ù…±Õ”€ôø±…µÁAÉ•Ù¥•Ü¡Ù…±Õ”€¬€¡•Ù•¹Ð¹‘•±Ñ…d€ð€À€ü€¸Àà€è€´¸Àà¤¤¤ì(€ôì((€É•ÑÕÉ¸€ñ‘¥Ø½¹]¡••°õí½¹]¡••±ô±…ÍÍ9…µ”õì‰É•±…Ñ¥Ù”½Ù•É™±½Üµ¡¥‘‘•¸‰œµmÉ…‘¥…°µÉ…‘¥•¹Ð¡¥É±•}…Ñ|ÔÀ•|ÌÔ”°™™™‘˜á|À”°••”Ý‘|Øà”°”Ñ‘‰™|ÄÀÀ”¥t€ˆ€¬€¡™Õ±±ÍÉ••¸€ü€‰ µ™Õ±°ˆ€è€‰ µlÌÜÁÁátÍ´é µlÐÌÁÁátˆ¥ôø(€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ðµà´ÀÑ½À´Ìè´ÌÀÑ•áÐµ•¹Ñ•ÈÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰É½Õ¹‘•µ™Õ±°‰½É‘•È‰½É‘•Èµl‘‘Ùt‰œµÝ¡¥Ñ”¼àÀÁà´È¸ÔÁä´Ä™½¹Ðµµ½¹¼Ñ•áÐµláÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸ÄÙ•µtÑ•áÐµlŒàÄÝˆÜÅtˆùíÍ¥‘•ôÙ¥•Üð½ÍÁ…¸øð½‘¥Øø((€€€íÍ¡½Ý5•…ÍÕÉ•µ•¹ÑÌ€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´ÌÑ½À´ÄÄè´ÌÀµ…àµÜµlÈÌáÁátÉ½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµláÉŒát‰œµÝ¡¥Ñ”¼äÀ‰…­‘É½Àµ‰±ÕÈÁà´ÌÁä´È¸ÔÍ¡…‘½ÜµÍ´Á½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµláÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸ÄÉ•µtÑ•áÐµ…•¹ÐˆùíÍ¥‘”€ôôô€‰‰…¬ˆ€ü€‰	…¬ÁÉ¥¹ÐÕ¥‘”ˆ€è€‰É½¹ÐÁÉ¥¹ÐÕ¥‘”‰ôƒ
ÜíÍ¥é”ñð€‹ŠP‰ôð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµlÄÁÁát™½¹Ðµ‰½±Ñ•áÐµlŒÈäÈØÈÅtˆùI•½µµ•¹‘•ƒ
Üíµ•…ÍÕÉ•µ•¹ÑA…¥È¡ÁÉ½™¥±”¹Ý¥‘Ñ¡%¸°ÁÉ½™¥±”¹¡•¥¡Ñ%¸¥ôð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµláÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµlŒÙ˜Ù„ØÍtˆù5…á¥µÕ´Í…™”…É•„ƒ
Üíµ•…ÍÕÉ•µ•¹ÑA…¥È¡ÁÉ½™¥±”¹µ…á]¥‘Ñ¡%¸°ÁÉ½™¥±”¹µ…á!•¥¡Ñ%¸¥ôð½‘¥Øø(€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµláÁát±•…‘¥¹œµÉ•±…á•Ñ•áÐµlŒØÈÕŒÔÑtˆùíÁÉ½™¥±”¹Á±…•µ•¹Ñ1…‰•±ôƒ
ÜƒŠLíµ•…ÍÕÉ•µ•¹ÑM¥¹±”¡ÁÉ½™¥±”¹½±±…É%¸¥ô™É½´íMÑÉ¥¹œ¡…Éµ•¹Ðü¹ÁÉ•Ù¥•ÝQåÁ”ñð…Éµ•¹Ðü¹ÑåÁ”ñð€ˆˆ¤¹Ñ½1½Ý•É…Í” ¤¹¥¹±Õ‘•Ì ‰¡½½‘¥”ˆ¤€ü€‰¡½½Í•…´ˆ€è€‰½±±…È‰ôð½‘¥Øø(€€€€€í½¹™¥ÕÉ•‘Õ¥‘”ü¹Í¥é•M…±¥¹¹…‰±•€„ôô™…±Í”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµláÁátÑ•áÐµlŒÝ„ÜÐÙtˆùM¥é”µ…Ý…É”ÁÉ•Í•Ð¥Ì…Ñ¥Ù”™½ÈíÍ¥é”ñð€‰Ñ¡¥ÌÍ¥é”‰ô¸ð½‘¥Øùô(€€€€€íÁÉ½™¥±”¹‰½ÑÑ½µ±•…É…¹•%¸€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµláÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµlŒá„ÔÄÑ‰tˆù-••ÀƒŠ&”íµ•…ÍÕÉ•µ•¹ÑM¥¹±”¡ÁÉ½™¥±”¹‰½ÑÑ½µ±•…É…¹•%¸¥ô…‰½Ù”Á½­•Ð¸ð½‘¥Øùô(€€€€ð½‘¥Øùô((€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ð´ÀÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÑÉ…¹Í¥Ñ¥½¸µÑÉ…¹Í™½É´‘ÕÉ…Ñ¥½¸´ÈÀÀˆÍÑå±”õíìÑÉ…¹Í™½É´èÍ…±” ‘íé½½µô¥€õôø(€€€€€€ñ‘¥Ø(€€€€€€€±…ÍÍ9…µ”õì‰É•±…Ñ¥Ù”€ˆ€¬€¡™Õ±±ÍÉ••¸€ü€‰Üµmµ¥¸ ÔÕÙ °ÔÈÁÁà¥tˆ€è€‰ÜµlÈÜÕÁátÍ´éÜµlÌÀÕÁátˆ¥ô(€€€€€€€ÍÑå±”õíì…ÍÁ•ÑI…Ñ¥¼è€‘íÁÉ•Ù¥•Ý…¹Ù…Ì¹Ý¥‘Ñ¡ô€¼€‘íÁÉ•Ù¥•Ý…¹Ù…Ì¹¡•¥¡Ñõ€õô(€€€€€€ø(€€€€€€€íµ½­ÕÁUÉ°€ü€ (€€€€€€€€€€ñ¥µœ(€€€€€€€€€€€ÍÉŒõíµ½­ÕÁUÉ±ô(€€€€€€€€€€€…±Ðõì¡…Éµ•¹Ðü¹±…‰•°ñð€‰ÕÍÑ½´…Éµ•¹Ðˆ¤€¬€ˆ€ˆ€¬Í¥‘”€¬€ˆµ½­ÕÀ‰ô(€€€€€€€€€€€±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ð´À µ™Õ±°Üµ™Õ±°½‰©•Ðµ½¹Ñ…¥¸‘É½ÀµÍ¡…‘½ÜµlÁ|ÄáÁá|ÈÉÁá}É‰„ À°À°À°¸Äà¥tˆ(€€€€€€€€€€€ÍÑå±”õíµ½­ÕÁ1…å•ÉMÑå±•ô(€€€€€€€€€€€‘É……‰±”ô‰™…±Í”ˆ(€€€€€€€€€€¼ø(€€€€€€€€¤€è€ (€€€€€€€€€€ñ…Éµ•¹ÑM¡…Á”ÑåÁ”õí…Éµ•¹Ðü¹ÁÉ•Ù¥•ÝQåÁ”ñð…Éµ•¹Ðü¹ÑåÁ”ñð€‰PµM¡¥ÉÐ‰ô½±½Èõí½±½ÉôÍ¥‘”õíÍ¥‘•ô€¼ø(€€€€€€€€¥ô((€€€€€€€íÍ¡½Ý5•…ÍÕÉ•µ•¹ÑÌ€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ð´Àè´ÈÀÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”Í•±•Ðµ¹½¹”ˆø(€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”ÜµÁà‰œµ…•¹Ð¼ØÔˆÍÑå±”õíì±•™Ðè€ˆÔÀ”ˆ°Ñ½Àè½±±…É¹¡½È€¬€ˆ”ˆ°¡•¥¡Ðè½±±…ÉÕ¥‘•!•¥¡Ð€¬€ˆ”ˆõôø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”€µ±•™Ð´ÄÑ½À´À µÁàÜ´È‰œµ…•¹Ð¼ÜÀˆ€¼ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”€µ±•™Ð´Ä‰½ÑÑ½´´À µÁàÜ´È‰œµ…•¹Ð¼ÜÀˆ€¼ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´ÈÑ½À´Ä¼È€µÑÉ…¹Í±…Ñ”µä´Ä¼ÈÝ¡¥Ñ•ÍÁ…”µ¹½ÝÉ…ÀÉ½Õ¹‘•µµ‰½É‘•È‰½É‘•Èµl•…ÍÙt‰œµÝ¡¥Ñ”¼äÀÁà´ÄÁä´À¸Ô™½¹Ðµµ½¹¼Ñ•áÐµlÝÁátÑ•áÐµ…•¹Ðˆùí™½Éµ…Ñ5•…ÍÕÉ•µ•¹Ñ9Õµ‰•È¡ÁÉ½™¥±”¹½±±…É%¸¥ôˆð½ÍÁ…¸ø(€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´Ä¼È€µÑÉ…¹Í±…Ñ”µà´Ä¼ÈÉ½Õ¹‘•µÍ´‰½É‘•È‰½É‘•Èµ‘½ÑÑ•‰½É‘•ÈµlŒÝˆàÜäÑt¼ÜÔ‰œµlŒÄÜÌÈÑt½lÀ¸ÀÄÕtˆÍÑå±”õíµ…áAÉ¥¹ÑÉ•…MÑå±•ôø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”‰½ÑÑ½´´Ä±•™Ð´Ä¼È€µÑÉ…¹Í±…Ñ”µà´Ä¼ÈÝ¡¥Ñ•ÍÁ…”µ¹½ÝÉ…ÀÉ½Õ¹‘•µµ‰œµÝ¡¥Ñ”¼äÀÁà´Ä¸ÔÁä´À¸Ô™½¹Ðµµ½¹¼Ñ•áÐµlÙÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒØÔÜÄÝ‘tˆùµ…á¥µÕ´Í…™”…É•„ð½ÍÁ…¸ø(€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´Ä¼È€µÑÉ…¹Í±…Ñ”µà´Ä¼ÈˆÍÑå±”õíÁÉ¥¹ÑÉ•…MÑå±•ôø(€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ðµä´À±•™Ð´Ä¼È‰½É‘•Èµ°‰½É‘•Èµ‘…Í¡•‰½É‘•Èµ…•¹Ð¼ÔÔˆ€¼ø(€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´Ä¼ÈÑ½À´Ä€µÑÉ…¹Í±…Ñ”µà´Ä¼ÈÉ½Õ¹‘•µµ‰œµlt¼äÀÁà´ÄÁä´À¸Ô™½¹Ðµµ½¹¼Ñ•áÐµlÝÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒáˆÔØÕtˆù•¹Ñ•Èð½ÍÁ…¸ø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”€µÑ½À´È±•™Ð´ÀÉ¥¡Ð´À µÁà‰œµ…•¹Ð¼ÜÀˆø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´À€µÑ½À´Ä ´ÈÜµÁà‰œµ…•¹Ð¼ÜÀˆ€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”É¥¡Ð´À€µÑ½À´Ä ´ÈÜµÁà‰œµ…•¹Ð¼ÜÀˆ€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´Ä¼È€µÑÉ…¹Í±…Ñ”µà´Ä¼È€µÑÉ…¹Í±…Ñ”µä´Ä¼ÈÝ¡¥Ñ•ÍÁ…”µ¹½ÝÉ…ÀÉ½Õ¹‘•µµ‰½É‘•È‰½É‘•Èµl•…ÍÙt‰œµÝ¡¥Ñ”¼äÔÁà´Ä¸ÔÁä´À¸Ô™½¹Ðµµ½¹¼Ñ•áÐµlÝÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµ…•¹Ðˆùí™½Éµ…Ñ5•…ÍÕÉ•µ•¹Ñ9Õµ‰•È¡ÁÉ½™¥±”¹Ý¥‘Ñ¡%¸¥ôˆÝ¥‘”ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”€µÉ¥¡Ð´ÈÑ½À´À‰½ÑÑ½´´ÀÜµÁà‰œµ…•¹Ð¼ÜÀˆø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”€µ±•™Ð´ÄÑ½À´À µÁàÜ´È‰œµ…•¹Ð¼ÜÀˆ€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”€µ±•™Ð´Ä‰½ÑÑ½´´À µÁàÜ´È‰œµ…•¹Ð¼ÜÀˆ€¼ø(€€€€€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´ÈÑ½À´Ä¼È€µÑÉ…¹Í±…Ñ”µä´Ä¼ÈÝ¡¥Ñ•ÍÁ…”µ¹½ÝÉ…ÀÉ½Õ¹‘•µµ‰½É‘•È‰½É‘•Èµl•…ÍÙt‰œµÝ¡¥Ñ”¼äÔÁà´ÄÁä´À¸Ô™½¹Ðµµ½¹¼Ñ•áÐµlÝÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµ…•¹Ðˆùí™½Éµ…Ñ5•…ÍÕÉ•µ•¹Ñ9Õµ‰•È¡ÁÉ½™¥±”¹¡•¥¡Ñ%¸¥ôˆ¡¥ ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€íÁÉ½™¥±”¹‰½ÑÑ½µ±•…É…¹•%¸€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´Ä¼ÈÑ½Àµ™Õ±°µÐ´Ä€µÑÉ…¹Í±…Ñ”µà´Ä¼ÈÝ¡¥Ñ•ÍÁ…”µ¹½ÝÉ…ÀÉ½Õ¹‘•µµ‰½É‘•È‰½É‘•Èµl•…ÍÙt‰œµÝ¡¥Ñ”¼äÔÁà´Ä¸ÔÁä´À¸Ô™½¹Ðµµ½¹¼Ñ•áÐµlÝÁátÑ•áÐµlŒá„ÔÄÑ‰tˆûŠDí™½Éµ…Ñ5•…ÍÕÉ•µ•¹Ñ9Õµ‰•È¡ÁÉ½™¥±”¹‰½ÑÑ½µ±•…É…¹•%¸¥ôˆÁ½­•Ð±•…É…¹”ð½ÍÁ…¸ùô(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øùô((€€€€€€€€ñ‘¥Ø(€€€€€€€€€½¹A½¥¹Ñ•É½Ý¸õí½¹A½¥¹Ñ•É½Ý¹ô(€€€€€€€€€½¹A½¥¹Ñ•É5½Ù”õí½¹A½¥¹Ñ•É5½Ù•ô(€€€€€€€€€½¹A½¥¹Ñ•ÉUÀõíÍÑ½ÁÉ…ô(€€€€€€€€€½¹A½¥¹Ñ•É…¹•°õíÍÑ½ÁÉ…ô(€€€€€€€€€ÍÑå±”õíÁÉ¥¹ÑÉ•…MÑå±•ô(€€€€€€€€€±…ÍÍ9…µ”õì‰…‰Í½±ÕÑ”±•™Ð´Ä¼È€µÑÉ…¹Í±…Ñ”µà´Ä¼È½Ù•É™±½Üµ¡¥‘‘•¸Í•±•Ðµ¹½¹”Ñ½Õ µ¹½¹”€ˆ€¬€¡Í¡½ÝÕ¥‘•Ì€ü€ˆ‰½É‘•È‰½É‘•Èµ‘…Í¡•‰½É‘•Èµ…•¹Ð¼ØÔ‰œµÝ¡¥Ñ”½lÀ¸ÀÍtˆ€è€ˆˆ¤€¬€¡…¹É…œ€ü€ˆÕÉÍ½ÈµÉ…ˆ…Ñ¥Ù”éÕÉÍ½ÈµÉ…‰‰¥¹œˆ€è€ˆˆ¥ô(€€€€€€€€ø(€€€€€€€€€ì…ÍÑå±•Q•µÁ±…Ñ”€ü¹Õ±°€è‰±…¹­ÉÑÝ½É¬€ü€ (€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ð´ÀÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÑ•áÐµ•¹Ñ•ÈÁà´ÈÑ•áÐµláÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒáˆàÐÝ…tˆù9¼‰…¬ÁÉ¥¹ÐÍ•±•Ñ•ð½‘¥Øø(€€€€€€€€€€¤€è€ (€€€€€€€€€€€€ðø(€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€±…ÍÍ9…µ”õì‰…‰Í½±ÕÑ”è´ÄÀ½Ù•É™±½Üµ¡¥‘‘•¸ÑÉ…¹Í¥Ñ¥½¸µ…±°‘ÕÉ…Ñ¥½¸´ÈÀÀ€ˆ€¬€¡Í¡½ÝÕ¥‘•Ì€ü€‰É¥¹œ´ÄÉ¥¹œµÝ¡¥Ñ”¼ÌÔˆ€è€ˆˆ¥ô(€€€€€€€€€€€€€€€ÍÑå±”õíÁ¡½Ñ½i½¹•MÑå±•ô(€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€íÁ¡½Ñ¼€ü€ (€€€€€€€€€€€€€€€€€…ÉÑÝ½É­¥Ñ5½‘”€ôôô€‰É½Àˆ€ü€ (€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ” µ™Õ±°Üµ™Õ±°Á½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆÍÑå±”õí…ÉÑÝ½É­1…å•ÉMÑå±•ôø(€€€€€€€€€€€€€€€€€€€€€€ñ¥µœ(€€€€€€€€€€€€€€€€€€€€€€€ÍÉŒõíÁ¡½Ñ¼¹ÕÉ±ô(€€€€€€€€€€€€€€€€€€€€€€€…±Ðô‰ÕÍÑ½µ•ÈÁ¡½Ñ¼ÁÉ•Ù¥•Üˆ(€€€€€€€€€€€€€€€€€€€€€€€‘É……‰±”ô‰™…±Í”ˆ(€€€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰ µ™Õ±°Üµ™Õ±°½‰©•Ðµ½Ù•ÈÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ÑÉ…¹Í¥Ñ¥½¸µm™¥±Ñ•Ét‘ÕÉ…Ñ¥½¸´ÈÀÀˆ(€€€€€€€€€€€€€€€€€€€€€€€ÍÑå±”õíì™¥±Ñ•Èèµ½½‘QÉ•…Ñµ•¹Ð¹Á¡½Ñ½¥±Ñ•Èõô(€€€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€€€ñ¥µœ(€€€€€€€€€€€€€€€€€€€€€ÍÉŒõíÁ¡½Ñ¼¹ÕÉ±ô(€€€€€€€€€€€€€€€€€€€€€…±Ðô‰ÕÍÑ½µ•ÈÁ¡½Ñ¼ÁÉ•Ù¥•Üˆ(€€€€€€€€€€€€€€€€€€€€€‘É……‰±”ô‰™…±Í”ˆ(€€€€€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”µ…àµ µ™Õ±°µ…àµÜµ™Õ±°½‰©•Ðµ½¹Ñ…¥¸Á½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ÑÉ…¹Í¥Ñ¥½¸µm™¥±Ñ•Ét‘ÕÉ…Ñ¥½¸´ÈÀÀˆ(€€€€€€€€€€€€€€€€€€€€€ÍÑå±”õíì€¸¸¹…ÉÑÝ½É­1…å•ÉMÑå±”°™¥±Ñ•Èèµ½½‘QÉ•…Ñµ•¹Ð¹Á¡½Ñ½¥±Ñ•Èõô(€€€€€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€€€€€¤(€€€€€€€€€€€€€€€€¤€è€ (€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ð´ÀÉ¥Á±…”µ¥Ñ•µÌµ•¹Ñ•ÈÉ½Õ¹‘•µm¥¹¡•É¥Ñt‰½É‘•È‰½É‘•Èµ‘…Í¡•‰½É‘•ÈµÝ¡¥Ñ”¼ÐÔ‰œµlŒÄÜÌÈÑt½lÀ¸ÀátÑ•áÐµ•¹Ñ•ÈÁà´ÌÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆø(€€€€€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€€€€€ñUÁ±½…Í¥é”õìÄÙô±…ÍÍ9…µ”ô‰µàµ…ÕÑ¼Ñ•áÐµÝ¡¥Ñ”¼àÔ‘É½ÀµÍ¡…‘½Üˆ¼ø(€€€€€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´ÄÑ•áÐµlÙÁát™½¹Ðµ‰½±ÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸ÄÑ•µtÑ•áÐµÝ¡¥Ñ”¼äÀ‘É½ÀµÍ¡…‘½ÜˆùA¡½Ñ¼½•Ì¡•É”ð½‘¥Øø(€€€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€€íÑ•µÁ±…Ñ”ü¹…ÍÍ•ÑUÉ°€˜˜€ (€€€€€€€€€€€€€€€€ñ¥µœ(€€€€€€€€€€€€€€€€€­•äõíÑ•µÁ±…Ñ”¹¥‘ô(€€€€€€€€€€€€€€€€€ÍÉŒõíÑ•µÁ±…Ñ”¹…ÍÍ•ÑUÉ±ô(€€€€€€€€€€€€€€€€€…±ÐõíÑ•µÁ±…Ñ”¹¹…µ”€¬€ˆ…ÉÑÝ½É¬½Ù•É±…ä‰ô(€€€€€€€€€€€€€€€€€‘É……‰±”ô‰™…±Í”ˆ(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”¥¹Í•Ð´Àè´ÈÀ µ™Õ±°Üµ™Õ±°½‰©•Ðµ™¥±°Á½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ÑÉ…¹Í¥Ñ¥½¸µm™¥±Ñ•È±½Á…¥Ñåt‘ÕÉ…Ñ¥½¸´ÈÀÀˆ(€€€€€€€€€€€€€€€€€ÍÑå±”õíì™¥±Ñ•Èèµ½½‘QÉ•…Ñµ•¹Ð¹Ñ•µÁ±…Ñ•¥±Ñ•Èõô(€€€€€€€€€€€€€€€€¼ø(€€€€€€€€€€€€€€¥ô((€€€€€€€€€€€€€í¡…ÍAÉ•Ù¥•ÝQ•áÐ€˜˜€ (€€€€€€€€€€€€€€€€ñ‘¥Ø(€€€€€€€€€€€€€€€€€±…ÍÍ9…µ”õì‰…‰Í½±ÕÑ”è´ÌÀÉ¥½¹Ñ•¹Ðµ•¹Ñ•ÈÁà´ÈÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”‘É½ÀµÍ¡…‘½ÜµlÁ|ÅÁá|ÉÁá}É‰„ À°À°À°¸ÜÔ¥t€ˆ€¬€¡Ñ•áÑi½¹”ü¹Ñ½¹”€ôôô€‰‘…É¬ˆ€ü€‰Ñ•áÐµlŒÈØÈÄÅ‘tˆ€è€‰Ñ•áÐµÝ¡¥Ñ”ˆ¥ô(€€€€€€€€€€€€€€€€€ÍÑå±”õíÑ•áÑi½¹•MÑå±•ô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”õíÑ•áÑi½¹”ü¹…±¥¸€ôôô€‰±•™Ðˆ€ü€‰Ñ•áÐµ±•™Ðˆ€èÑ•áÑi½¹”ü¹…±¥¸€ôôô€‰É¥¡Ðˆ€ü€‰Ñ•áÐµÉ¥¡Ðˆ€è€‰Ñ•áÐµ•¹Ñ•È‰ôø(€€€€€€€€€€€€€€€€€€€íÁ•ÉÍ½¹…±¥é…Ñ¥½¸ü¹¹…µ”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµ‘¥ÍÁ±…äÑ•áÐµÍ´±•…‘¥¹œµ¹½¹”ÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”ˆùíÁ•ÉÍ½¹…±¥é…Ñ¥½¸¹¹…µ•ôð½‘¥Øùô(€€€€€€€€€€€€€€€€€€€íÁ•ÉÍ½¹…±¥é…Ñ¥½¸ü¹‘…Ñ•Ì€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlÙÁátµÐ´À¸ÔˆùíÁ•ÉÍ½¹…±¥é…Ñ¥½¸¹‘…Ñ•Íôð½‘¥Øùô(€€€€€€€€€€€€€€€€€€€íÁ•ÉÍ½¹…±¥é…Ñ¥½¸ü¹ÅÕ½Ñ”€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµlÙÁát±•…‘¥¹œµÑ¥¡ÐµÐ´À¸Ô±¥¹”µ±…µÀ´ÈˆùíÁ•ÉÍ½¹…±¥é…Ñ¥½¸¹ÅÕ½Ñ•ôð½‘¥Øùô(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ð¼ø(€€€€€€€€€€¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½‘¥Øø((€€€íÕÁ±½…‘¥¹œ€˜˜Á¡½Ñ¼€˜˜ÍÑå±•Q•µÁ±…Ñ”€˜˜€…‰±…¹­ÉÑÝ½É¬€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”±•™Ð´Ä¼ÈÑ½À´ÄÈè´ÐÀ€µÑÉ…¹Í±…Ñ”µà´Ä¼ÈÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆø(€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä¸ÔÝ¡¥Ñ•ÍÁ…”µ¹½ÝÉ…ÀÉ½Õ¹‘•µ™Õ±°‰½É‘•È‰½É‘•ÈµlåÑt‰œµÝ¡¥Ñ”¼äÀÁà´ÌÁä´Ä¸ÔÑ•áÐµlåÁát™½¹ÐµÍ•µ¥‰½±Ñ•áÐµlŒÄÜÌÈÑtÍ¡…‘½ÜµÍ´‰…­‘É½Àµ‰±ÕÈˆø(€€€€€€€€ñUÁ±½…Í¥é”õìÄÅô€¼øUÁ±½…‘¥¹œ¹•Ü…ÉÑÝ½É¯Š˜ÕÉÉ•¹ÐÁÉ•Ù¥•ÜÍÑ…åÌÙ¥Í¥‰±”(€€€€€€ð½ÍÁ…¸ø(€€€€ð½‘¥Øùô((€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”‰½ÑÑ½´´Ì±•™Ð´ÌÉ¥¡Ð´Ìè´ÌÀ™±•à¥Ñ•µÌµ•¹©ÕÍÑ¥™äµ‰•ÑÝ••¸…À´ÈÁ½¥¹Ñ•Èµ•Ù•¹ÑÌµ¹½¹”ˆø(€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµláÉŒát‰œµÝ¡¥Ñ”¼àÀ‰…­‘É½Àµ‰±ÕÈÁà´È¸ÔÁä´Ä¸ÔÑ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒàÄÝˆÜÅtˆùí½±½Éôƒ
Üí…Éµ•¹Ðü¹±…‰•°ñð€‰ÕÍÑ½´…Éµ•¹Ð‰ôð½ÍÁ…¸ø(€€€€€ì…‰±…¹­ÉÑÝ½É¬€˜˜€ñÍÁ…¸±…ÍÍ9…µ”ô‰É½Õ¹‘•µá°‰½É‘•È‰½É‘•ÈµláÉŒát‰œµÝ¡¥Ñ”¼àÀ‰…­‘É½Àµ‰±ÕÈÁà´È¸ÔÁä´Ä¸ÔÑ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒàÄÝˆÜÅt¥¹±¥¹”µ™±•à¥Ñ•µÌµ•¹Ñ•È…À´ÄˆùíÁ¡½Ñ¼€ü€ðøñ5½Ù”Í¥é”õìÄÁô¼øÉ…œÑ¼Á½Í¥Ñ¥½¸ð¼ø€è€ðøñMÁ…É­±•ÌÍ¥é”õìÄÁô¼øíÑ•µÁ±…Ñ”ü¹¹…µ”ü¹É•Á±…” ‰@€ˆ°ˆˆ¥ôƒ
Üíµ½½‘ôð¼ùôð½ÍÁ…¸ùô(€€€€ð½‘¥Øø(€€ð½‘¥Øøì)ô()™Õ¹Ñ¥½¸…Éµ•¹ÑM¡…Á”¡ìÑåÁ”°½±½È°Í¥‘”ô¤ì(€½¹ÍÐÁ…±•ÑÑ”€ô…Éµ•¹ÑA…±•ÑÑ”¡½±½È¤ì(€½¹ÍÐ­•ä€ô¹½Éµ…±¥é•AÉ•Ù¥•ÝQ½­•¸¡ÑåÁ”¤ì(€½¹ÍÐ¥Í!½½‘¥”€ô­•ä¹¥¹±Õ‘•Ì ‰¡½½‘¥”ˆ¤ì(€½¹ÍÐ¥ÍÉ•Ü€ô­•ä¹¥¹±Õ‘•Ì ‰É•Ý¹•¬ˆ¤ñð­•ä¹¥¹±Õ‘•Ì ‰É•Ü¹•¬ˆ¤ñð­•ä¹¥¹±Õ‘•Ì ‰ÍÝ•…ÑÍ¡¥ÉÐˆ¤ñð­•ä¹¥¹±Õ‘•Ì ‰ÍÝ•…Ñ•Èˆ¤ì(€½¹ÍÐ¥Í1½¹M±••Ù”€ô­•ä¹¥¹±Õ‘•Ì ‰±½¹œÍ±••Ù”ˆ¤ì(€½¹ÍÐ¥Í	…‰ä€ô­•ä¹¥¹±Õ‘•Ì ‰‰…‰äˆ¤ñð­•ä¹¥¹±Õ‘•Ì ‰‰½‘åÍÕ¥Ðˆ¤ñð­•ä¹¥¹±Õ‘•Ì ‰½¹•Í¥”ˆ¤ì(€½¹ÍÐ¥ÍQ½‘‘±•È€ô­•ä¹¥¹±Õ‘•Ì ‰Ñ½‘‘±•Èˆ¤ì(€½¹ÍÐ¥Íe½ÕÑ €ô­•ä¹¥¹±Õ‘•Ì ‰å½ÕÑ ˆ¤ñð­•ä€ôôô€‰­¥‘Ìˆì((€½¹ÍÐ±½¹M±••Ù•	½‘ä€ô€‰4ÄÈÌ€ÜÀ0àÐ€àØ0Ðä€ÄÄÈ0Äà€ÈÜÄ0ØÌ€ÈàÀ0äÐ€ÄÔÄ0äà€ÌäÈ0ÈØÈ€ÌäÈ0ÈØØ€ÄÔÄ0ÈäÜ€ÈàÀ0ÌÐÈ€ÈÜÄ0ÌÄÄ€ÄÄÈ0ÈÜØ€àØ0ÈÌÜ€ÜÀÈÈÐ€äÄ€ÈÀÐ€ÄÀÄ€ÄàÀ€ÄÀÄÄÔØ€ÄÀÄ€ÄÌØ€äÄ€ÄÈÌ€ÜÀhˆì(€€¼¼QÉ…•™É½´Ñ¡”…ÁÁÉ½Ù•‘Õ±Ð1½¹œM±••Ù”Q•”µ½­ÕÀÍ¼™…±±‰…¬Ù¥•ÝÌ(€€¼¼ÁÉ•Í•ÉÙ”Ñ¡”Í…µ”Í±••Ù”±•¹Ñ °Í¡½Õ±‘•ÈÝ¥‘Ñ …¹‰½‘äÁÉ½Á½ÉÑ¥½¹Ì¸(€½¹ÍÐ±½¹M±••Ù•Q••É½¹Ñ	½‘ä€ô€‰4ÄÐÜ€ÄÄÐ0ÄÀÜ€ÈÀÄ0Øà€ÐÈÄ0ÔÔ€ØÌÈ0ÜÈ€ÜØä0ÄÐÐ€ÜØà0Äàà€ÐØÈ0ÈÄÌ€ÌÜÔ0ÄäÔ€ÜØÄ0ÌÐÄ€ÜÜä0ÔÌÌ€ÜÜÔ0ØÀÌ€ÜØÄ0Ôàà€ÌàÈ0ØÄÈ€ÐÜÀ0ØÔÄ€ÜØà0ÜÈÀ€ÜÜÌ0ÜÌä€ÜÀÜ0ÜÐÐ€ØÀÈ0ÜÌÔ€ÐÐä0ÜÀÄ€ÈÌÜ0ØØÐ€ÄÈØ0ÐäÀ€ÌÌ0ÐÄÌ€ÐØ0ÌÀä€ÌÌhˆì(€½¹ÍÐ±½¹M±••Ù•Q••	…­	½‘ä€ô€‰4ÄÐÔ€ÄÄØ0ÄÀÌ€ÈÄÈ0Øà€ÐÄÈ0ÔÐ€ØÈÐ0ÜÈ€ÜØà0ÄÌä€ÜØØ0ÄäÌ€ÐÈÔ0ÈÄÐ€ÌÔä0ÄäÀ€ÜÔÐ0ÈÈÈ€ÜØä0ÌÈÜ€ÜÜà0ÔÈä€ÜÜÔ0ØÀÔ€ÜÔà0ÔàÐ€ÌÔä0ØÀÜ€ÐÌÈ0ØØÀ€ÜØØ0ÜÈØ€ÜØä0ÜÐØ€ØÀä0ÜÌÐ€ÐÌÌ0ÜÀÄ€ÈÌà0ØØÀ€ÄÈÐ0ÐäÄ€ÌÈ0ÌÀÜ€ÌÈhˆì(€½¹ÍÐ±½¹M±••Ù•Q••QÉ…¹Í™½É´€ô€‰ÑÉ…¹Í±…Ñ” À€ÌÔ¤Í…±” ¸ÐÔ¤ˆì((€É•ÑÕÉ¸€ñÍÙœÙ¥•Ý	½àôˆÀ€À€ÌØÀ€ÐÌÀˆÉ½±”ô‰¥µœˆ…É¥„µ±…‰•°õí½±½È€¬€ˆ€ˆ€¬ÑåÁ”€¬€ˆ€ˆ€¬Í¥‘”€¬€ˆµ½­ÕÀ‰ô±…ÍÍ9…µ”ô‰Üµ™Õ±° µ…ÕÑ¼‘É½ÀµÍ¡…‘½ÜµlÁ|ÄáÁá|ÈÉÁá}É‰„ À°À°À°¸Äà¥tˆø(€€€í¥Í!½½‘¥”€ü€ðø(€€€€€€ñÁ…Ñ ô‰4ÄÈÐ€àäÄÌÀ€Ðà€ÄÔÄ€ÈÔ€ÄàÀ€ÈÔÈÀä€ÈÔ€ÈÌÀ€Ðà€ÈÌØ€àä0ÈÄØ€ÄÄÄÈÀà€àÈ€ÄäÜ€Øà€ÄàÀ€ØàÄØÌ€Øà€ÄÔÈ€àÈ€ÄÐÐ€ÄÄÄhˆ™¥±°õíÁ…±•ÑÑ”¹‰…Í•ôÍÑÉ½­”õíÁ…±•ÑÑ”¹ÍÑÉ½­•ôÍÑÉ½­•]¥‘Ñ ôˆÈˆ€¼ø(€€€€€€ñÁ…Ñ õí±½¹M±••Ù•	½‘åô™¥±°õíÁ…±•ÑÑ”¹‰…Í•ôÍÑÉ½­”õíÁ…±•ÑÑ”¹ÍÑÉ½­•ôÍÑÉ½­•]¥‘Ñ ôˆÈˆ€¼ø(€€€€€íÍ¥‘”€ôôô€‰™É½¹Ðˆ€˜˜€ðø(€€€€€€€€ñÁ…Ñ ô‰4ÄÌä€ÈàÐDÄàÀ€ÈØØ€ÈÈÄ€ÈàÐ0ÈÄÐ€ÌÐÀ ÄÐØhˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆÈˆ½Á…¥Ñäôˆ¸ÔÔˆ€¼ø(€€€€€€€€ñÁ…Ñ ô‰4ÄÔà€àÜ0ÄÜÐ€ÄÌÄ4ÈÀÈ€àÜ0ÄàØ€ÄÌÄˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆÈˆ½Á…¥Ñäôˆ¸ÔÔˆ€¼ø(€€€€€€ð¼ùô(€€€€ð¼ø€è¥Í	…‰ä€ü€ðø(€€€€€€ñÁ…Ñ ô‰4ÄÌÈ€ÜÈ0äÐ€àÜ0ÔÜ€ÄÌØ0àÜ€ÄÔà0ÄÄÀ€ÄÌÐ0ÄÄÀ€ÈäÈ0ÄÌØ€ÌÈÈ0ÄÔÄ€ÌäÈ0ÄàÀ€ÌØä0ÈÀä€ÌäÈ0ÈÈÐ€ÌÈÈ0ÈÔÀ€ÈäÈ0ÈÔÀ€ÄÌÐ0ÈÜÌ€ÄÔà0ÌÀÌ€ÄÌØ0ÈØØ€àÜ0ÈÈà€ÜÈÈÄà€äÄ€ÈÀÄ€ÄÀÄ€ÄàÀ€ÄÀÄÄÔä€ÄÀÄ€ÄÐÈ€äÄ€ÄÌÈ€ÜÈhˆ™¥±°õíÁ…±•ÑÑ”¹‰…Í•ôÍÑÉ½­”õíÁ…±•ÑÑ”¹ÍÑÉ½­•ôÍÑÉ½­•]¥‘Ñ ôˆÈˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4ÄÔÄ€ÜÈÄÔØ€àà€ÄØØ€äÐ€ÄàÀ€äÐÄäÐ€äÐ€ÈÀÐ€àà€ÈÀä€ÜÈˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆÌˆ½Á…¥Ñäôˆ¸ØÈˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4ÄÔÄ€ÌäÈDÄàÀ€ÐÀÔ€ÈÀä€ÌäÈˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆÈˆ½Á…¥Ñäôˆ¸Ôˆ€¼ø(€€€€€íÍ¥‘”€ôôô€‰™É½¹Ðˆ€˜˜€ðø(€€€€€€€€ñ¥É±”àôˆÄØØˆäôˆÌàÐˆÈôˆÈ¸Ðˆ™¥±°õíÁ…±•ÑÑ”¹Í•…µô€¼ø(€€€€€€€€ñ¥É±”àôˆÄàÀˆäôˆÌààˆÈôˆÈ¸Ðˆ™¥±°õíÁ…±•ÑÑ”¹Í•…µô€¼ø(€€€€€€€€ñ¥É±”àôˆÄäÐˆäôˆÌàÐˆÈôˆÈ¸Ðˆ™¥±°õíÁ…±•ÑÑ”¹Í•…µô€¼ø(€€€€€€ð¼ùô(€€€€ð¼ø€è¥ÍÉ•Ü€ü€ðø(€€€€€€ñÁ…Ñ õí±½¹M±••Ù•	½‘åô™¥±°õíÁ…±•ÑÑ”¹‰…Í•ôÍÑÉ½­”õíÁ…±•ÑÑ”¹ÍÑÉ½­•ôÍÑÉ½­•]¥‘Ñ ôˆÈˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4ÄÐä€ØäÄÔÐ€àØ€ÄØÔ€äÌ€ÄàÀ€äÌÄäÔ€äÌ€ÈÀØ€àØ€ÈÄÄ€Øäˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆØˆ½Á…¥Ñäôˆ¸ØÈˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4äà€ÌØÔ0ÈØÈ€ÌØÔˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆØˆ½Á…¥Ñäôˆ¸ÐÈˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4ÈÀ€ÈÔà0ØÐ€ÈØà4ÈäØ€ÈØà0ÌÐÀ€ÈÔàˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆØˆ½Á…¥Ñäôˆ¸ÐÈˆ€¼ø(€€€€ð¼ø€è¥Í1½¹M±••Ù”€ü€ðø(€€€€€€ñÁ…Ñ (€€€€€€€õíÍ¥‘”€ôôô€‰‰…¬ˆ€ü±½¹M±••Ù•Q••	…­	½‘ä€è±½¹M±••Ù•Q••É½¹Ñ	½‘åô(€€€€€€€ÑÉ…¹Í™½É´õí±½¹M±••Ù•Q••QÉ…¹Í™½Éµô(€€€€€€€™¥±°õíÁ…±•ÑÑ”¹‰…Í•ô(€€€€€€€ÍÑÉ½­”õíÁ…±•ÑÑ”¹ÍÑÉ½­•ô(€€€€€€€ÍÑÉ½­•]¥‘Ñ ôˆÐˆ(€€€€€€¼ø(€€€€€€ñÁ…Ñ (€€€€€€€õíÍ¥‘”€ôôô€‰‰…¬ˆ(€€€€€€€€€€ü€‰4ÌÀÜ€ÐÌÌÐÈ€Ôà€ÌØÜ€ØÐ€ÐÀÀ€ØÐÐÌÌ€ØÐ€ÐÔà€Ôà€ÐäÄ€ÐÌˆ(€€€€€€€€€€è€‰4ÌÀä€ÐÌÌÌØ€ÜÌ€ÌØÔ€àÜ€ÐÀÀ€àÜÐÌÔ€àÜ€ÐØÐ€ÜÌ€ÐäÀ€ÐÌ‰ô(€€€€€€€ÑÉ…¹Í™½É´õí±½¹M±••Ù•Q••QÉ…¹Í™½Éµô(€€€€€€€™¥±°ô‰¹½¹”ˆ(€€€€€€€ÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µô(€€€€€€€ÍÑÉ½­•]¥‘Ñ ôˆÄÀˆ(€€€€€€€½Á…¥Ñäôˆ¸ØÈˆ(€€€€€€¼ø(€€€€€€ñÁ…Ñ ô‰4ÜÐ€ÜÌÀ0ÄÐÌ€ÜÌÀ4ØÔÜ€ÜÌÀ0ÜÈÈ€ÜÌÀˆÑÉ…¹Í™½É´õí±½¹M±••Ù•Q••QÉ…¹Í™½Éµô™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆäˆ½Á…¥Ñäôˆ¸Ðˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4ÈÀÔ€ÜÐÈÌÀÀ€ÜØÔ€ÔÀÀ€ÜØÔ€ÔäÐ€ÜÐÈˆÑÉ…¹Í™½É´õí±½¹M±••Ù•Q••QÉ…¹Í™½Éµô™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆÔˆ½Á…¥Ñäôˆ¸Èàˆ€¼ø(€€€€ð¼ø€è¥ÍQ½‘‘±•È€ü€ðø(€€€€€€ñÁ…Ñ ô‰4ÄÌÈ€Üà0äÌ€äÐ0ÔÈ€ÄÐà0àÐ€ÄÜÄ0ÄÀà€ÄÐØ0ÄÀà€ÌÔà0ÈÔÈ€ÌÔà0ÈÔÈ€ÄÐØ0ÈÜØ€ÄÜÄ0ÌÀà€ÄÐà0ÈØÜ€äÐ0ÈÈà€ÜàÈÄà€äØ€ÈÀÄ€ÄÀÔ€ÄàÀ€ÄÀÔÄÔä€ÄÀÔ€ÄÐÈ€äØ€ÄÌÈ€Üàhˆ™¥±°õíÁ…±•ÑÑ”¹‰…Í•ôÍÑÉ½­”õíÁ…±•ÑÑ”¹ÍÑÉ½­•ôÍÑÉ½­•]¥‘Ñ ôˆÈˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4ÄÔÌ€ÜÜÄÔÜ€äÈ€ÄØØ€ää€ÄàÀ€ääÄäÐ€ää€ÈÀÌ€äÈ€ÈÀÜ€ÜÜˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆÌˆ½Á…¥Ñäôˆ¸Øˆ€¼ø(€€€€ð¼ø€è¥Íe½ÕÑ €ü€ðø(€€€€€€ñÁ…Ñ ô‰4ÄÈà€ÜÐ0àØ€äÄ0Ìà€ÄÔÄ0ÜØ€ÄÜà0ÄÀÌ€ÄÐà0ÄÀÌ€ÌÜØ0ÈÔÜ€ÌÜØ0ÈÔÜ€ÄÐà0ÈàÐ€ÄÜà0ÌÈÈ€ÄÔÄ0ÈÜÐ€äÄ0ÈÌÈ€ÜÐÈÈÄ€äÌ€ÈÀÌ€ÄÀÈ€ÄàÀ€ÄÀÈÄÔÜ€ÄÀÈ€ÄÌä€äÌ€ÄÈà€ÜÐhˆ™¥±°õíÁ…±•ÑÑ”¹‰…Í•ôÍÑÉ½­”õíÁ…±•ÑÑ”¹ÍÑÉ½­•ôÍÑÉ½­•]¥‘Ñ ôˆÈˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4ÄÔÄ€ÜÌÄÔÔ€àà€ÄØÔ€äÔ€ÄàÀ€äÔÄäÔ€äÔ€ÈÀÔ€àà€ÈÀä€ÜÌˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆÌˆ½Á…¥Ñäôˆ¸Øˆ€¼ø(€€€€ð¼ø€è€ðø(€€€€€€ñÁ…Ñ ô‰4ÄÈÌ€ÜÀ0Üà€àà0ÈÜ€ÄÔÐ0ÜÀ€ÄàÐ0äØ€ÄÔÄ0äØ€ÌäÈ0ÈØÐ€ÌäÈ0ÈØÐ€ÄÔÄ0ÈäÀ€ÄàÐ0ÌÌÌ€ÄÔÐ0ÈàÈ€àà0ÈÌÜ€ÜÀÈÈÐ€äÄ€ÈÀÐ€ÄÀÄ€ÄàÀ€ÄÀÄÄÔØ€ÄÀÄ€ÄÌØ€äÄ€ÄÈÌ€ÜÀhˆ™¥±°õíÁ…±•ÑÑ”¹‰…Í•ôÍÑÉ½­”õíÁ…±•ÑÑ”¹ÍÑÉ½­•ôÍÑÉ½­•]¥‘Ñ ôˆÈˆ€¼ø(€€€€€€ñÁ…Ñ ô‰4ÄÐä€ØäÄÔÐ€àÔ€ÄØÐ€äÈ€ÄàÀ€äÈÄäØ€äÈ€ÈÀØ€àÔ€ÈÄÄ€Øäˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹Í•…µôÍÑÉ½­•]¥‘Ñ ôˆÌˆ½Á…¥Ñäôˆ¸Øˆ€¼ø(€€€€ð¼ùô(€€€€ñÁ…Ñ ô‰4ÄÄØ€äÌÄÌä€ÄÀÔ€ÄÔÜ€ÄÄÈ€ÄàÀ€ÄÄÈÈÀÌ€ÄÄÈ€ÈÈÄ€ÄÀÔ€ÈÐÐ€äÌˆ™¥±°ô‰¹½¹”ˆÍÑÉ½­”õíÁ…±•ÑÑ”¹¡¥¡±¥¡ÑôÍÑÉ½­•]¥‘Ñ ôˆÄÌˆ½Á…¥Ñäôˆ¸Èˆ€¼ø(€€ð½ÍÙœøì)ô()™Õ¹Ñ¥½¸…Éµ•¹ÑA…±•ÑÑ”¡½±½È¤ì(€½¹ÍÐ­•ä€ôMÑÉ¥¹œ¡½±½Èñð€‰	±…¬ˆ¤¹Ñ½1½Ý•É…Í” ¤ì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰‰±…¬ˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆŒÄÜÄÜÄÜˆ°ÍÑÉ½­”è€ˆŒÀÔÀÔÀÔˆ°Í•…´è€ˆŒÑ˜Ñ˜Ñ˜ˆ°¡¥¡±¥¡Ðè€ˆŒÙ„Ù„Ù„ˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰Ý¡¥Ñ”ˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆ˜Ñ˜Å•ˆˆ°ÍÑÉ½­”è€ˆŒáŒÉˆàˆ°Í•…´è€ˆ……„Ðå„ˆ°¡¥¡±¥¡Ðè€ˆ™™™™™˜ˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰ÍÁ½ÉÐÉ•äˆ¤ñð­•ä¹¥¹±Õ‘•Ì ‰ÍÁ½ÉÐÉ…äˆ¤ñð­•ä€ôôô€‰É•äˆñð­•ä€ôôô€‰É…äˆ¤É•ÑÕÉ¸ì‰…Í”è€ˆˆáˆåˆÔˆ°ÍÑÉ½­”è€ˆŒàÔàØàÈˆ°Í•…´è€ˆŒÜÜÜàÜÐˆ°¡¥¡±¥¡Ðè€ˆ‘‘‘‘‘„ˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰Í…¹ˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆŒáˆÜåˆˆ°ÍÑÉ½­”è€ˆŒäÔàÄØØˆ°Í•…´è€ˆŒá˜Ý„Õ˜ˆ°¡¥¡±¥¡Ðè€ˆ˜Á”ÅŒàˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰¹…Ùäˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆŒÈÀÉˆÍˆˆ°ÍÑÉ½­”è€ˆŒÁˆÄÈÈÀˆ°Í•…´è€ˆŒØØÜÀàÔˆ°¡¥¡±¥¡Ðè€ˆŒØÐÜÐáˆˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰É½å…°ˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆŒÈàÔÝ„Øˆ°ÍÑÉ½­”è€ˆŒÄÜÌÜÙ˜ˆ°Í•…´è€ˆŒÙ˜äÅˆ°¡¥¡±¥¡Ðè€ˆŒÝ…„Á‘˜ˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰É•ˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆ…ÈÜÌÔˆ°ÍÑÉ½­”è€ˆŒØàÄÔÅ”ˆ°Í•…´è€ˆ”ØàÜÌˆ°¡¥¡±¥¡Ðè€ˆ‘˜ÝàÜˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰Á¥¹¬ˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆ”å…™ŒÌˆ°ÍÑÉ½­”è€ˆˆØÜàáˆ°Í•…´è€ˆÌá™„Øˆ°¡¥¡±¥¡Ðè€ˆ˜áÙ”Äˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰™½É•ÍÐˆ¤ñð­•ä¹¥¹±Õ‘•Ì ‰É••¸ˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆŒÈäÐØÍˆˆ°ÍÑÉ½­”è€ˆŒÄÀÈÌÅŒˆ°Í•…´è€ˆŒÜÈàÜÝ˜ˆ°¡¥¡±¥¡Ðè€ˆŒÙ˜äÌàÔˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰¡…É½…°ˆ¤ñð­•ä¹¥¹±Õ‘•Ì ‰¡•…Ñ¡•Èˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆŒÐÄÐÄÐÄˆ°ÍÑÉ½­”è€ˆŒÈÈÈˆ°Í•…´è€ˆŒÜÀÜÀÜÀˆ°¡¥¡±¥¡Ðè€ˆŒÝˆÝˆÝˆˆôì(€¥˜€¡­•ä¹¥¹±Õ‘•Ì ‰Ù¥¹Ñ…”ˆ¤¤É•ÑÕÉ¸ì‰…Í”è€ˆŒÈÜÈÐÈÈˆ°ÍÑÉ½­”è€ˆŒÄÀÄÀÄÀˆ°Í•…´è€ˆŒÔäÔÔÔÌˆ°¡¥¡±¥¡Ðè€ˆŒØàØÄÕ”ˆôì(€É•ÑÕÉ¸ì‰…Í”è€ˆŒÄÜÌÈÑˆ°ÍÑÉ½­”è€ˆŒÀÔÀÔÀÔˆ°Í•…´è€ˆŒÑˆÑˆÑˆˆ°¡¥¡±¥¡Ðè€ˆŒÔÔÔÔÔÔˆôì)ô()™Õ¹Ñ¥½¸MÑ•ÁQ¥Ñ±”¡ì•å•‰É½Ü°Ñ¥Ñ±”°Ñ•áÐô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µˆ´Üˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµlÀ¸ÈÉ•µtÑ•áÐµ…•¹Ðˆùí•å•‰É½Ýôð½‘¥Øøñ È±…ÍÍ9…µ”ô‰™½¹Ðµ‘¥ÍÁ±…äÑ•áÐ´Ñá°µéÑ•áÐ´Õá°±•…‘¥¹œµ¹½¹”µÐ´Ä¸ÔÑ•áÐµlŒÅÅˆÄátˆùíÑ¥Ñ±•ôð½ ÈøñÀ±…ÍÍ9…µ”ô‰Ñ•áÐµÍ´Ñ•áÐµlŒÜÄÙˆØÍtµÐ´È¸Ôµ…àµÜ´Éá°±•…‘¥¹œµÉ•±…á•ˆùíÑ•áÑôð½Àøð½‘¥Øøì)ô)™Õ¹Ñ¥½¸¥•±¡ì±…‰•°°Ù…±Õ”°½¹¡…¹”°Á±…•¡½±‘•Èô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´Ðˆøñ±…‰•°±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlÄÁÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒÜÔÙ˜ØÝtˆùí±…‰•±ôð½±…‰•°øñ¥¹ÁÕÐÙ…±Õ”õíÙ…±Õ•ô½¹¡…¹”õí”€ôø½¹¡…¹”¡”¹Ñ…É•Ð¹Ù…±Õ”¥ôÁ±…•¡½±‘•ÈõíÁ±…•¡½±‘•Éô±…ÍÍ9…µ”ô‰Üµ™Õ±°É½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµl‘Õt‰œµÝ¡¥Ñ”¼ÜÀÁà´Ì¸ÔÁä´ÌµÐ´Ä¸Ô½ÕÑ±¥¹”µ¹½¹”ÑÉ…¹Í¥Ñ¥½¸™½ÕÌé‰½É‘•Èµ…•¹Ð™½ÕÌéÉ¥¹œ´È™½ÕÌéÉ¥¹œµ…•¹Ð¼ÄÀˆ¼øð½‘¥Øøì)ô)™Õ¹Ñ¥½¸Q•áÑÉ•„¡ì±…‰•°°Ù…±Õ”°½¹¡…¹”°Á±…•¡½±‘•Èô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´Ôˆøñ±…‰•°±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlÄÁÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒÜÔÙ˜ØÝtˆùí±…‰•±ôð½±…‰•°øñÑ•áÑ…É•„É½ÝÌõìÑôÙ…±Õ”õíÙ…±Õ•ô½¹¡…¹”õí”€ôø½¹¡…¹”¡”¹Ñ…É•Ð¹Ù…±Õ”¥ôÁ±…•¡½±‘•ÈõíÁ±…•¡½±‘•Éô±…ÍÍ9…µ”ô‰Üµ™Õ±°É½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµl‘Õt‰œµÝ¡¥Ñ”¼ÜÀÁà´Ì¸ÔÁä´ÌµÐ´Ä¸Ô½ÕÑ±¥¹”µ¹½¹”ÑÉ…¹Í¥Ñ¥½¸™½ÕÌé‰½É‘•Èµ…•¹Ð™½ÕÌéÉ¥¹œ´È™½ÕÌéÉ¥¹œµ…•¹Ð¼ÄÀˆ¼øð½‘¥Øøì)ô)™Õ¹Ñ¥½¸M•±•Ñ¥•±¡ì±…‰•°°Ù…±Õ”°½¹¡…¹”°½ÁÑ¥½¹Ìô¤ì(€É•ÑÕÉ¸€ñ‘¥Øøñ±…‰•°±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlÄÁÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒÜÔÙ˜ØÝtˆùí±…‰•±ôð½±…‰•°øñÍ•±•ÐÙ…±Õ”õíÙ…±Õ•ô½¹¡…¹”õí”€ôø½¹¡…¹”¡”¹Ñ…É•Ð¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰Üµ™Õ±°É½Õ¹‘•µá°‰½É‘•È‰½É‘•Èµl‘Õt‰œµÝ¡¥Ñ”¼ÜÀÁà´Ì¸ÔÁä´ÌµÐ´Ä¸Ô½ÕÑ±¥¹”µ¹½¹”™½ÕÌé‰½É‘•Èµ…•¹Ðˆùí½ÁÑ¥½¹Ì¹µ…À¡½ÁÑ¥½¸€ôø€ñ½ÁÑ¥½¸­•äõí½ÁÑ¥½¹ôùí½ÁÑ¥½¹ôð½½ÁÑ¥½¸ø¥ôð½Í•±•Ðøð½‘¥Øøì)ô)™Õ¹Ñ¥½¸¡½¥”¡ì…Ñ¥Ù”°½¹±¥¬°¡¥±‘É•¸ô¤ì(€É•ÑÕÉ¸€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õí½¹±¥­ô±…ÍÍ9…µ”õì‰É½Õ¹‘•µá°‰½É‘•ÈÁà´Ì¸ÔÁä´È¸ÔÑ•áÐµÍ´ÑÉ…¹Í¥Ñ¥½¸€ˆ€¬€¡…Ñ¥Ù”€ü€‰‰½É‘•Èµ…•¹Ð‰œµ…•¹Ð½lÀ¸ÀÙtÑ•áÐµ…•¹ÐÍ¡…‘½ÜµÍ´ˆ€è€‰‰½É‘•Èµl‘‘Ùt‰œµÝ¡¥Ñ”¼ØÀÑ•áÐµlŒÕ˜Õ„ÔÍt¡½Ù•Èé‰½É‘•Èµl……„Ääátˆ¥ôùí¡¥±‘É•¹ôð½‰ÕÑÑ½¸øì)ô)™Õ¹Ñ¥½¸I•Ù¥•Ý…É¡ì±…‰•°°Ù…±Õ”°ÍÕˆô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•´Éá°‰½É‘•È‰½É‘•Èµl‘™á™t‰œµÝ¡¥Ñ”¼ØÔÀ´Ðˆøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµµ½¹¼Ñ•áÐµlåÁátÕÁÁ•É…Í”ÑÉ…­¥¹œµÝ¥‘”Ñ•áÐµlŒàØÝ˜ÜÙtˆùí±…‰•±ôð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½¹Ðµ‰½±µÐ´ÄÑ•áÐµlŒÈäÈØÈÅtˆùíÙ…±Õ•ôð½‘¥ØùíÍÕˆ€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµáÌÑ•áÐµlŒÝ„ÜÐÙtµÐ´ÄˆùíÍÕ‰ôð½‘¥Øùôð½‘¥Øøì)ô)™Õ¹Ñ¥½¸MÕµµ…ÉåI½Ü¡ì±…‰•°°Ù…±Õ”ô¤ì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µÐ´Ì™±•à™±•àµ½°…À´ÄÑ•áÐµÍ´Í´é™±•àµÉ½ÜÍ´é©ÕÍÑ¥™äµ‰•ÑÝ••¸Í´é…À´ÌˆøñÍÁ…¸±…ÍÍ9…µ”ô‰½Á…¥Ñä´ÔÔˆùí±…‰•±ôð½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”ô‰‰É•…¬µÝ½É‘Ì™½¹Ðµµ•‘¥Õ´Í´éµ…àµÜµlØà•tÍ´éÑ•áÐµÉ¥¡ÐˆùíÙ…±Õ•ôð½ÍÁ…¸øð½‘¥Øøì)ô)™Õ¹Ñ¥½¸É½ÕÁI½Ü¡ì¥Ñ•´°ÁÉ½‘ÕÐ°½¹¡…¹”°½¹I•µ½Ù”ô¤ì(€½¹ÍÐ½±½ÉÌ€ôÁÉ½‘ÕÑ½±½ÉÌ¡ÁÉ½‘ÕÐ¤ì(€½¹ÍÐÍ¥é•Ì€ôÁÉ½‘ÕÑM¥é•Ì¡ÁÉ½‘ÕÐ°¥Ñ•´¹½±½È¤ì(€½¹ÍÐ¡…¹•½±½È€ô€¡¹•áÑ½±½È¤€ôøì(€€€½¹ÍÐ¹•áÑM¥é•Ì€ôÁÉ½‘ÕÑM¥é•Ì¡ÁÉ½‘ÕÐ°¹•áÑ½±½È¤ì(€€€½¹ÍÐ¹•áÑM¥é”€ô¹•áÑM¥é•Ì¹¥¹±Õ‘•Ì¡¥Ñ•´¹Í¥é”¤€ü¥Ñ•´¹Í¥é”€è€¡¹•áÑM¥é•ÍlÁtñð¥Ñ•´¹Í¥é”¤ì(€€€½¹¡…¹”¡ì½±½Èè¹•áÑ½±½È°Í¥é”è¹•áÑM¥é”ô¤ì(€ôì((€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰É¥É¥µ½±Ìµmµ¥¹µ…à À°Å™È¥}µ¥¹µ…à À°Å™È¥|àÁÁá|ÌÙÁát…À´ÈµÐ´Ìˆø(€€€€ñÍ•±•ÐÙ…±Õ”õí¥Ñ•´¹½±½Éô½¹¡…¹”õí”€ôø¡…¹•½±½È¡”¹Ñ…É•Ð¹Ù…±Õ”¥ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰½É‘•È‰½É‘•Èµ‰½É‘•È‰œµ‰…­É½Õ¹Áà´ÈÁä´ÈÑ•áÐµÍ´ˆø(€€€€€í½±½ÉÌ¹µ…À¡Ø€ôø€ñ½ÁÑ¥½¸­•äõíÙôùíÙôð½½ÁÑ¥½¸ø¥ô(€€€€ð½Í•±•Ðø(€€€€ñÍ•±•ÐÙ…±Õ”õí¥Ñ•´¹Í¥é•ô½¹¡…¹”õí”€ôø½¹¡…¹”¡íÍ¥é”é”¹Ñ…É•Ð¹Ù…±Õ•ô¥ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰½É‘•È‰½É‘•Èµ‰½É‘•È‰œµ‰…­É½Õ¹Áà´ÈÁä´ÈÑ•áÐµÍ´ˆø(€€€€€íÍ¥é•Ì¹µ…À¡Ø€ôøì(€€€€€€€½¹ÍÐÙ…É¥…¹Ð€ôÙ…É¥…¹Ñ½È¡ÁÉ½‘ÕÐ°¥Ñ•´¹½±½È°Ø¤ì(€€€€€€€É•ÑÕÉ¸€ñ½ÁÑ¥½¸­•äõíÙôÙ…±Õ”õíÙô‘¥Í…‰±•õì…Ù…É¥…¹ÑÙ…¥±…‰±”¡ÁÉ½‘ÕÐ°Ù…É¥…¹Ð¥ôùíÙõì…Ù…É¥…¹ÑÙ…¥±…‰±”¡ÁÉ½‘ÕÐ°Ù…É¥…¹Ð¤€ü€ˆƒŠPÕ¹…Ù…¥±…‰±”ˆ€è€ˆ‰ôð½½ÁÑ¥½¸øì(€€€€€ô¥ô(€€€€ð½Í•±•Ðø(€€€€ñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•Èˆµ¥¸ôˆÄˆµ…àôˆääˆÙ…±Õ”õí¥Ñ•´¹ÅÕ…¹Ñ¥Ñåô½¹¡…¹”õí”€ôø½¹¡…¹”¡íÅÕ…¹Ñ¥Ñäé5…Ñ ¹µ…à Ä°5…Ñ ¹µ¥¸ ää°9Õµ‰•È¡”¹Ñ…É•Ð¹Ù…±Õ”¤ñð€Ä¤¥ô¥ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰½É‘•È‰½É‘•Èµ‰½É‘•È‰œµ‰…­É½Õ¹Áà´ÈÁä´ÈÑ•áÐµÍ´ˆ¼ø(€€€€ñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ½¹±¥¬õí½¹I•µ½Ù•ô±…ÍÍ9…µ”ô‰É½Õ¹‘•µ±œ‰½É‘•È‰½É‘•Èµ‰½É‘•È¡½Ù•Èé‰œµl˜Ñ˜Å•tˆ…É¥„µ±…‰•°ô‰I•µ½Ù”…Éµ•¹Ðˆøñ`Í¥é”õìÄÑô±…ÍÍ9…µ”ô‰µàµ…ÕÑ¼ˆ¼øð½‰ÕÑÑ½¸ø(€€ð½‘¥Øøì)ô)™Õ¹Ñ¥½¸A¡½Ñ½…É¡ìÁ¡½Ñ¼°½¹AÉ¥µ…Éä°½¹I•µ½Ù”ô¤ì(€½¹ÍÐÅ±…ÍÌ€ôÁ¡½Ñ¼¹ÅÕ…±¥Ñä€ôôô€‰•á•±±•¹Ðˆ€ü€‰Ñ•áÐµÉ••¸´ØÀÀˆ€èÁ¡½Ñ¼¹ÅÕ…±¥Ñä€ôôô€‰ÕÍ…‰±”ˆ€ü€‰Ñ•áÐµ…µ‰•È´ØÀÀˆ€è€‰Ñ•áÐµ‘•ÍÑÉÕÑ¥Ù”ˆì(€½¹ÍÐÅ1…‰•°€ôÁ¡½Ñ¼¹ÅÕ…±¥Ñä€ôôô€‰•á•±±•¹Ðˆ€ü€‰É•…ÐÅÕ…±¥Ñäˆ€èÁ¡½Ñ¼¹ÅÕ…±¥Ñä€ôôô€‰ÕÍ…‰±”ˆ€ü€‰5…ä±½½¬Í±¥¡Ñ±äÍ½™Ðˆ€è€‰1½ÜÉ•Í½±ÕÑ¥½¸ˆì(€É•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰É½Õ¹‘•´Éá°‰½É‘•È‰½É‘•Èµl‘‘Ùt‰œµÝ¡¥Ñ”É•±…Ñ¥Ù”½Ù•É™±½Üµ¡¥‘‘•¸Í¡…‘½ÜµÍ´ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÍÁ•ÐµÍÅÕ…É”½Ù•É™±½Üµ¡¥‘‘•¸‰œµl˜Í•™”átˆøñ¥µœÍÉŒõíÁ¡½Ñ¼¹ÕÉ±ô…±ÐõíÁ¡½Ñ¼¹¹…µ•ô±…ÍÍ9…µ”ô‰Üµ™Õ±° µ™Õ±°½‰©•Ðµ½Ù•Èˆ¼øð½‘¥Øøñ‰ÕÑÑ½¸½¹±¥¬õí½¹I•µ½Ù•ô±…ÍÍ9…µ”ô‰…‰Í½±ÕÑ”Ñ½À´ÈÉ¥¡Ð´ÈÉ½Õ¹‘•µ±œ‰œµÝ¡¥Ñ”¼äÀÀ´Ä¸ÔÍ¡…‘½ÜµÍ´ˆøñ`Í¥é”õìÄÍô¼øð½‰ÕÑÑ½¸øñ‘¥Ø±…ÍÍ9…µ”ô‰À´Ìˆøñ‰ÕÑÑ½¸½¹±¥¬õí½¹AÉ¥µ…Éåô±…ÍÍ9…µ”õì‰Ñ•áÐµlåÁátÕÁÁ•É…Í”™½¹Ðµµ½¹¼™±•à¥Ñ•µÌµ•¹Ñ•È…À´Ä€ˆ€¬€¡Á¡½Ñ¼¹¥ÍAÉ¥µ…Éä€ü€‰Ñ•áÐµ…•¹Ðˆ€è€‰Ñ•áÐµlŒÝŒÜØÙ•tˆ¥ôøñMÑ…ÈÍ¥é”õìÄÉô±…ÍÍ9…µ”õíÁ¡½Ñ¼¹¥ÍAÉ¥µ…Éä€ü€‰™¥±°µ…•¹Ðˆ€è€ˆ‰ô¼ùíÁ¡½Ñ¼¹¥ÍAÉ¥µ…Éä€ü€‰AÉ¥µ…ÉäÁ¡½Ñ¼ˆ€è€‰5…­”ÁÉ¥µ…Éä‰ôð½‰ÕÑÑ½¸øñ‘¥Ø±…ÍÍ9…µ”õì‰µÐ´Ä¸ÔÑ•áÐµlåÁátÕÁÁ•É…Í”™½¹Ðµµ½¹¼€ˆ€¬Å±…ÍÍôùíÅ1…‰•±ôð½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰Ñ•áÐµlåÁátÑ•áÐµlŒá„àÐÝtˆùíÁ¡½Ñ¼¹Ý¥‘Ñ¡÷]íÁ¡½Ñ¼¹¡•¥¡Ñôð½‘¥Øøð½‘¥Øøð½‘¥Øøì)ô(