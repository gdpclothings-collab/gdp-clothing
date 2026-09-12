import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Upload, X, Star, Heart, Sparkles, ShieldCheck, AlertTriangle, Shirt, Plus, Minus, Maximize2, Move, Ruler, ZoomIn, ZoomOut, Lock, Unlock, Trash2 } from "lucide-react";
import SeasonalStudio from "@/components/storefront/SeasonalStudio";
import {
  AdvancedEditorPanel,
  EditableOverlayLayers,
  PhotoBrushEditor,
  createPhotoLayer,
  createStickerLayer,
  createTextLayer,
  normalizeEditorTools,
  normalizeStickerLibrary,
} from "@/components/storefront/CustomStudioAdvancedEditor";
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

const DESIGN_PATHS = [
  { id: "seasonal", label: "Seasonal Designs", description: "Browse ready-made holiday and seasonal artwork.", icon: Sparkles },
  { id: "bootleg", label: "Photo Bootleg Designs", description: "Choose a locked GDP layout, then add and position your own photo and text.", icon: Star },
  { id: "memorial", label: "Memorial Tribute Designs", description: "Choose a protected remembrance layout, add a portrait, and personalize the name, dates and message.", icon: Heart },
  { id: "upload", label: "Upload My Own Artwork", description: "Upload your own artwork and control its size, placement and proportions.", icon: Upload },
];

const DESIGN_INTENSITY_LEVELS = {
  1: { label: "Clean", description: "Minimal layout with one clear focal point, restrained type and plenty of breathing room." },
  2: { label: "Light", description: "A little more styling with supporting type, subtle texture and a few graphic accents." },
  3: { label: "Balanced", description: "A balanced mix of portraits, typography, effects and negative space." },
  4: { label: "Bold", description: "Stronger layering, larger type, more image crops and more dramatic effects." },
  5: { label: "Maximum Chaos", description: "Full bootleg energy with dense collage, oversized type, textures, effects and multiple visual layers." },
};

const HIDDEN_INTENSITY_IMAGE = "__hidden__";
const NO_TEMPLATE_STYLE = "No Template — Upload Only";

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
  editorTools: {
    erase: true,
    restore: true,
    stickers: true,
    text: true,
    freeStretch: true,
    autoBackgroundRemoval: true,
  },
  stickerLibrary: [],
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
    editorTools: normalizeEditorTools(settings?.editorTools),
    stickerLibrary: normalizeStickerLibrary(settings?.stickerLibrary),
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
    stretchX: 100,
    stretchY: 100,
    constrainRatio: true,
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

const MOODS = ["Original", "Warm", "Cool", "Vintage", "Vibrant", "Monochrome"];
const MOOD_PREVIEW_TREATMENTS = {
  Original: {
    description: "Keeps the artwork's original colors.",
    photoFilter: "none",
    templateFilter: "none",
  },
  Warm: {
    description: "Adds a subtle warm finish to the complete print.",
    photoFilter: "saturate(.92) sepia(.13) brightness(1.02)",
    templateFilter: "saturate(.94) sepia(.08) brightness(1.01)",
  },
  Cool: {
    description: "Clean contrast with a cooler chrome-forward finish.",
    photoFilter: "saturate(.96) contrast(1.07) hue-rotate(3deg)",
    templateFilter: "saturate(1.06) contrast(1.05)",
  },
  Vibrant: {
    description: "Increases saturation and contrast for a bolder print.",
    photoFilter: "saturate(1.34) contrast(1.12) brightness(1.02)",
    templateFilter: "saturate(1.35) contrast(1.1)",
  },
  Vintage: {
    description: "Faded color, warm wash and distressed old-photo character.",
    photoFilter: "sepia(.34) saturate(.72) contrast(.94) brightness(.98)",
    templateFilter: "sepia(.22) saturate(.78) contrast(.96)",
  },
  Monochrome: {
    description: "Converts the complete print to polished black and white.",
    photoFilter: "grayscale(1) contrast(1.08)",
    templateFilter: "grayscale(1) contrast(1.08)",
  },
};

function moodPreviewTreatment(mood) {
  return MOOD_PREVIEW_TREATMENTS[mood] || {
    description: "Choose a color finish to apply to the exact printable result.",
    photoFilter: "none",
    templateFilter: "none",
  };
}

const STEPS = ["Garment","Choose Design","Customize","Timing & Approval","Review"];
const ORDER_GUIDE_STEPS = [
  { title: "Choose garment", detail: "Pick clothing, color, size and quantity." },
  { title: "Choose your design", detail: "Select Seasonal Designs, Photo Bootleg Designs, Memorial Tribute Designs or Upload My Own Artwork." },
  { title: "Customize", detail: "Choose your print side, add artwork or photos, position every layer and personalize text in one workspace." },
  { title: "Timing & approval", detail: "Set your needed-by date and confirm artwork permissions." },
  { title: "Review & checkout", detail: "Final-check the exact result, add to cart and complete checkout." }
];
const AFTER_ORDER_STEPS = ["Order received", "Payment confirmed", "Approved file locked", "Printing", "Quality check", "Pickup / shipping"];
const MAX_MB = 12;
const OPTIMIZE_ABOVE_MB = 2.5;
const MAX_UPLOAD_DIMENSION = 3600;
const STUDIO_DRAFT_KEY = "gdp.custom-studio.draft.v2";
const STUDIO_DRAFT_VERSION = 2;
const STUDIO_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const STUDIO_DRAFT_SAVE_DELAY_MS = 550;

function readStudioDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STUDIO_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Number(parsed?.version || 0) !== STUDIO_DRAFT_VERSION) return null;
    const updatedAt = Date.parse(parsed?.updatedAt || "");
    if (Number.isFinite(updatedAt) && Date.now() - updatedAt > STUDIO_DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(STUDIO_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function serializablePhotoAsset(photo = {}) {
  const safePhoto = /** @type {any} */ ({ ...(photo || {}) });
  delete safePhoto.sourceFile;
  return safePhoto;
}

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

async function prepareImageForUpload(file, preserveOriginal = false) {
  const local = await readLocalImage(file);
  const { img, width, height, url } = local;
  if (preserveOriginal) {
    URL.revokeObjectURL(url);
    return { file, width, height };
  }
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

async function removePhotoBackground(file) {
  if (!file || !String(file.type || "").startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Automatic background cleanup supports PNG, JPG and WEBP photos.");
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Could not read this photo for background cleanup."));
      nextImage.src = sourceUrl;
    });

    const width = Number(image.naturalWidth || 0);
    const height = Number(image.naturalHeight || 0);
    if (!width || !height) throw new Error("Photo dimensions could not be detected.");

    const sampleScale = Math.min(1, 760 / Math.max(width, height));
    const sampleWidth = Math.max(2, Math.round(width * sampleScale));
    const sampleHeight = Math.max(2, Math.round(height * sampleScale));
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) throw new Error("Background cleanup is not supported by this browser.");
    sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const samplePixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;

    const rgbAt = (index) => {
      const offset = index * 4;
      return [samplePixels[offset], samplePixels[offset + 1], samplePixels[offset + 2]];
    };
    const colorDistance = (a, b) => {
      const dr = a[0] - b[0];
      const dg = a[1] - b[1];
      const db = a[2] - b[2];
      return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
    };
    const lightness = (rgb) => rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;

    const borderPalette = [];
    const strideX = Math.max(1, Math.floor(sampleWidth / 28));
    const strideY = Math.max(1, Math.floor(sampleHeight / 28));
    for (let x = 0; x < sampleWidth; x += strideX) {
      borderPalette.push(rgbAt(x));
      borderPalette.push(rgbAt((sampleHeight - 1) * sampleWidth + x));
    }
    for (let y = 0; y < sampleHeight; y += strideY) {
      borderPalette.push(rgbAt(y * sampleWidth));
      borderPalette.push(rgbAt(y * sampleWidth + sampleWidth - 1));
    }

    const paletteDistance = (rgb) => {
      let best = Infinity;
      for (const sample of borderPalette) {
        best = Math.min(best, colorDistance(rgb, sample));
        if (best < 10) break;
      }
      return best;
    };

    const mask = new Uint8Array(sampleWidth * sampleHeight);
    const queue = new Uint32Array(sampleWidth * sampleHeight);
    let head = 0;
    let tail = 0;
    const seed = (index) => {
      if (index < 0 || index >= mask.length || mask[index]) return;
      mask[index] = 1;
      queue[tail++] = index;
    };

    for (let x = 0; x < sampleWidth; x += 1) {
      seed(x);
      seed((sampleHeight - 1) * sampleWidth + x);
    }
    for (let y = 1; y < sampleHeight - 1; y += 1) {
      seed(y * sampleWidth);
      seed(y * sampleWidth + sampleWidth - 1);
    }

    const canJoinBackground = (fromIndex, nextIndex) => {
      if (nextIndex < 0 || nextIndex >= mask.length || mask[nextIndex]) return false;
      const from = rgbAt(fromIndex);
      const next = rgbAt(nextIndex);
      const localDistance = colorDistance(from, next);
      const nextLight = lightness(next);
      const fromLight = lightness(from);
      const borderDistance = paletteDistance(next);

      // Strong subject edges stop the flood. Background gradients and room
      // colors can still connect to the border palette, unlike the previous
      // light-background-only cleanup.
      if (localDistance <= 24 && borderDistance <= 105) return true;
      if (localDistance <= 15 && borderDistance <= 135) return true;
      if (nextLight >= 235 && fromLight >= 205) return true;
      return false;
    };

    while (head < tail) {
      const index = queue[head++];
      const x = index % sampleWidth;
      const y = Math.floor(index / sampleWidth);
      const neighbors = [];
      if (x > 0) neighbors.push(index - 1);
      if (x + 1 < sampleWidth) neighbors.push(index + 1);
      if (y > 0) neighbors.push(index - sampleWidth);
      if (y + 1 < sampleHeight) neighbors.push(index + sampleWidth);
      for (const neighbor of neighbors) {
        if (!canJoinBackground(index, neighbor)) continue;
        mask[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }

    const removedRatio = tail / Math.max(1, mask.length);
    if (removedRatio < 0.04 || removedRatio > 0.92) {
      throw new Error("Automatic background cleanup was not confident enough, so the original photo was preserved.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Background cleanup is not supported by this browser.");
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    let removed = 0;

    const sampleMaskAt = (sx, sy) => {
      const x = Math.min(sampleWidth - 1, Math.max(0, sx));
      const y = Math.min(sampleHeight - 1, Math.max(0, sy));
      return mask[y * sampleWidth + x] === 1;
    };

    for (let y = 0; y < height; y += 1) {
      const sampleY = Math.min(sampleHeight - 1, Math.floor((y / height) * sampleHeight));
      for (let x = 0; x < width; x += 1) {
        const sampleX = Math.min(sampleWidth - 1, Math.floor((x / width) * sampleWidth));
        const offset = (y * width + x) * 4;
        if (sampleMaskAt(sampleX, sampleY)) {
          pixels[offset + 3] = 0;
          removed += 1;
          continue;
        }

        // Feather one sample-pixel around the cutout instead of leaving a
        // visibly harsh halo on the garment preview.
        const touchesBackground =
          sampleMaskAt(sampleX - 1, sampleY) ||
          sampleMaskAt(sampleX + 1, sampleY) ||
          sampleMaskAt(sampleX, sampleY - 1) ||
          sampleMaskAt(sampleX, sampleY + 1);
        if (touchesBackground) pixels[offset + 3] = Math.min(pixels[offset + 3], 190);
      }
    }

    if (removed < Math.max(24, width * height * 0.03)) {
      throw new Error("Automatic background cleanup was not confident enough, so the original photo was preserved.");
    }

    context.putImageData(imageData, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not create the cleaned photo.");
    const cleanName = String(file.name || "photo").replace(/\.[^.]+$/, "") + "-background-removed.png";
    return new File([blob], cleanName, { type: "image/png", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
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

async function captureElementAsPng(elementId, targetWidthPx, fileName) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("The final preview is not ready yet. Please try again.");
  await document.fonts?.ready;
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (!image.complete) await new Promise((resolve) => image.addEventListener("load", resolve, { once: true }));
    try { await image.decode?.(); } catch { /* html2canvas reports unreadable assets below */ }
  }));
  const { default: html2canvas } = await import("html2canvas");
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) throw new Error("The final preview has no printable area.");
  const scale = Math.max(1, targetWidthPx / rect.width);
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale,
    useCORS: true,
    logging: false,
    imageTimeout: 15000,
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not create the production PNG.");
  const upload = await uploadWithRetry(new File([blob], fileName, { type: "image/png" }));
  return { upload, widthPx: canvas.width, heightPx: canvas.height };
}

async function sha256Snapshot(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function CustomStudio() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [step, setStep] = useState(1);
  const [seasonalMode, setSeasonalMode] = useState(false);
  const [seasonalDraft, setSeasonalDraft] = useState(null);
  const [designPath, setDesignPath] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [product, setProduct] = useState(null);
  const [designMood, setDesignMood] = useState("Original");
  const [designIntensity, setDesignIntensity] = useState(3);
  const [garment, setGarment] = useState(FALLBACK_GARMENT);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [placement, setPlacement] = useState("front");
  const [previewSide, setPreviewSide] = useState("front");
  const [designStylesBySide, setDesignStylesBySide] = useState({ front: "", back: "" });
  const designStyleForSide = (side) => String(designStylesBySide?.[side] || "");
  const frontDesignStyle = designStyleForSide("front");
  const backDesignStyle = designStyleForSide("back");
  const designStyle = designStyleForSide(previewSide);
  const orderDesignStyle = placement === "back" ? backDesignStyle : (frontDesignStyle || backDesignStyle);
  const [groupGarments, setGroupGarments] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [editorLayersBySide, setEditorLayersBySide] = useState({ front: [], back: [] });
  const editorLayers = editorLayersBySide[previewSide] || [];
  const setEditorLayers = (valueOrUpdater) => {
    setEditorLayersBySide((current) => {
      const currentLayers = current[previewSide] || [];
      const nextLayers = typeof valueOrUpdater === "function" ? valueOrUpdater(currentLayers) : valueOrUpdater;
      return { ...current, [previewSide]: nextLayers };
    });
  };
  const [selectedEditorLayerIds, setSelectedEditorLayerIds] = useState({ front: "photo", back: "photo" });
  const selectedEditorLayerId = selectedEditorLayerIds[previewSide] || "photo";
  const setSelectedEditorLayerId = (value) => setSelectedEditorLayerIds((current) => ({ ...current, [previewSide]: value }));
  const activatePrintSide = (side = previewSide) => {
    setPlacement((current) => {
      // Once both print sides are active, choosing or editing artwork on either
      // side must never disable the opposite side. Side switching is view-only.
      if (current === "front_back") return current;
      if (side === "back") return current === "front" ? "front_back" : "back";
      return current === "back" ? "front_back" : "front";
    });
  };
  const [photoBrushOpen, setPhotoBrushOpen] = useState(false);
  const editorHistoryRef = useRef([]);
  const editorRedoRef = useRef([]);
  const [editorHistoryVersion, setEditorHistoryVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [uploadTasks, setUploadTasks] = useState([]);
  const [draftStatus, setDraftStatus] = useState("idle");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const draftSaveTimerRef = useRef(null);
  const [warn, setWarn] = useState("");
  const [personalization, setPersonalization] = useState({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "" });
  const [memorialNameConfirmed, setMemorialNameConfirmed] = useState(false);
  const [needByDate, setNeedByDate] = useState("");
  const [priority, setPriority] = useState("standard");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [approvalAcknowledged, setApprovalAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [artworkStates, setArtworkStates] = useState(() => defaultArtworkStates());
  const activeArtworkState = artworkStates[previewSide] || artworkStates.front;
  const artworkScale = Number(activeArtworkState.scale ?? 92);
  const artworkStretchX = Number(activeArtworkState.stretchX ?? 100);
  const artworkStretchY = Number(activeArtworkState.stretchY ?? 100);
  const artworkConstrainRatio = activeArtworkState.constrainRatio !== false;
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
  const setArtworkStretchX = (value) => updateArtworkState("stretchX", value);
  const setArtworkStretchY = (value) => updateArtworkState("stretchY", value);
  const setArtworkConstrainRatio = (value) => {
    updateArtworkState("constrainRatio", value);
    if (value) {
      updateArtworkState("stretchX", 100);
      updateArtworkState("stretchY", 100);
    }
  };
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
  const styleTemplateForSide = (side) => {
    const sideStyle = designStyleForSide(side);
    if (!sideStyle || designPath === "upload" || sideStyle === NO_TEMPLATE_STYLE) return null;
    return styleTemplateForName(sideStyle, studioSettings.styleTemplates);
  };
  const activeStyleTemplate = designStyle ? styleTemplateForSide(previewSide) : null;
  const activePreviewTemplate = activeStyleTemplate;
  const editorTools = normalizeEditorTools(studioSettings.editorTools);
  const stickerLibrary = normalizeStickerLibrary(studioSettings.stickerLibrary);

  const currentEditorSnapshot = () => ({
    layersBySide: JSON.parse(JSON.stringify(editorLayersBySide || { front: [], back: [] })),
    photos: JSON.parse(JSON.stringify(photos || [])),
    artworkStates: JSON.parse(JSON.stringify(artworkStates || defaultArtworkStates(activeStyleTemplate))),
  });
  const checkpointEditor = () => {
    editorHistoryRef.current = [...editorHistoryRef.current, currentEditorSnapshot()].slice(-40);
    editorRedoRef.current = [];
    setEditorHistoryVersion((value) => value + 1);
  };
  const restoreEditorSnapshot = (snapshot) => {
    if (!snapshot) return;
    const nextLayersBySide = snapshot.layersBySide || { front: snapshot.layers || [], back: [] };
    setEditorLayersBySide(nextLayersBySide);
    if (Array.isArray(snapshot.photos)) setPhotos(snapshot.photos);
    setArtworkStates(snapshot.artworkStates || defaultArtworkStates(activeStyleTemplate));
    setSelectedEditorLayerIds({
      front: nextLayersBySide.front?.find((layer) => layer.type === "photo")?.id || "photo",
      back: nextLayersBySide.back?.find((layer) => layer.type === "photo")?.id || "photo",
    });
  };
  const undoEditor = () => {
    const previous = editorHistoryRef.current.pop();
    if (!previous) return;
    editorRedoRef.current.push(currentEditorSnapshot());
    restoreEditorSnapshot(previous);
    setEditorHistoryVersion((value) => value + 1);
  };
  const redoEditor = () => {
    const next = editorRedoRef.current.pop();
    if (!next) return;
    editorHistoryRef.current.push(currentEditorSnapshot());
    restoreEditorSnapshot(next);
    setEditorHistoryVersion((value) => value + 1);
  };
  const patchEditorLayer = (layerId, patch, options = {}) => {
    if (!layerId || !patch) return;
    if (options.history !== false) checkpointEditor();
    setEditorLayers((current) => current.map((layer) => layer.id === layerId ? { ...layer, ...patch } : layer));
  };
  const addTextLayer = () => {
    checkpointEditor();
    activatePrintSide();
    const layer = createTextLayer();
    setEditorLayers((current) => [...current, layer]);
    setSelectedEditorLayerId(layer.id);
  };
  const addStickerLayer = (sticker) => {
    checkpointEditor();
    activatePrintSide();
    const layer = createStickerLayer(sticker);
    setEditorLayers((current) => [...current, layer]);
    setSelectedEditorLayerId(layer.id);
  };
  const addPhotoLayer = (photo) => {
    if (!photo) return;
    checkpointEditor();
    activatePrintSide();
    const layer = createPhotoLayer(photo, editorLayers.filter((item) => item.type === "photo").length);
    setEditorLayers((current) => [...current, layer]);
    setSelectedEditorLayerId(layer.id);
  };
  const copyFrontDesignToBack = () => {
    checkpointEditor();
    const copiedLayers = JSON.parse(JSON.stringify(editorLayersBySide.front || [])).map((layer) => ({
      ...layer,
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${layer.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));
    setEditorLayersBySide((current) => ({ ...current, back: copiedLayers }));
    setDesignStylesBySide((current) => ({ ...current, back: current.front || "" }));
    setArtworkStates((current) => ({ ...current, back: JSON.parse(JSON.stringify(current.front || defaultArtworkState(styleTemplateForSide("front")))) }));
    setPlacement("front_back");
    setPreviewSide("back");
    setSelectedEditorLayerIds((current) => ({ ...current, back: copiedLayers[0]?.id || "photo" }));
  };
  const duplicateEditorLayer = (layerId) => {
    const source = editorLayers.find((layer) => layer.id === layerId);
    if (!source) return;
    checkpointEditor();
    const duplicate = source.type === "text"
      ? createTextLayer(source.text)
      : source.type === "photo"
        ? createPhotoLayer(photos.find((photo) => String(photo.id || "") === String(source.photoId || "")), editorLayers.filter((layer) => layer.type === "photo").length)
        : createStickerLayer(stickerLibrary.find((item) => item.id === source.stickerId));
    Object.assign(duplicate, source, { id: duplicate.id, x: Math.min(96, Number(source.x || 50) + 4), y: Math.min(96, Number(source.y || 50) + 4) });
    setEditorLayers((current) => [...current, duplicate]);
    setSelectedEditorLayerId(duplicate.id);
  };
  const deleteEditorLayer = (layerId) => {
    if (!editorLayers.some((layer) => layer.id === layerId)) return;
    checkpointEditor();
    const backHasLockedTemplate = previewSide === "back" && Boolean(styleTemplateForSide("back"));
    if (previewSide === "back" && editorLayers.length === 1 && !backHasLockedTemplate) {
      setPlacement((current) => current === "front_back" ? "front" : current);
    }
    setEditorLayers((current) => current.filter((layer) => layer.id !== layerId));
    setSelectedEditorLayerId("photo");
  };
  const moveEditorLayer = (layerId, direction) => {
    const index = editorLayers.findIndex((layer) => layer.id === layerId);
    if (index < 0) return;
    const target = Math.min(editorLayers.length - 1, Math.max(0, index + Number(direction || 0)));
    if (target === index) return;
    checkpointEditor();
    setEditorLayers((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };
  const resetEditorLayer = (layerId) => {
    const source = editorLayers.find((layer) => layer.id === layerId);
    if (!source) return;
    checkpointEditor();
    const reset = source.type === "text"
      ? createTextLayer(source.text)
      : source.type === "photo"
        ? createPhotoLayer(photos.find((photo) => String(photo.id || "") === String(source.photoId || "")), editorLayers.filter((layer) => layer.type === "photo").findIndex((layer) => layer.id === source.id))
        : createStickerLayer(stickerLibrary.find((item) => item.id === source.stickerId));
    reset.id = source.id;
    setEditorLayers((current) => current.map((layer) => layer.id === layerId ? reset : layer));
  };
  const resetAllEditable = () => {
    checkpointEditor();
    setEditorLayers((current) => current
      .filter((layer) => layer.type === "photo")
      .map((layer, index) => {
        const photo = photos.find((item) => String(item.id || "") === String(layer.photoId || ""));
        const reset = createPhotoLayer(photo, index);
        reset.id = layer.id;
        return reset;
      }));
    setArtworkStates((current) => ({
      ...current,
      [previewSide]: defaultArtworkState(activeStyleTemplate),
    }));
    setPreviewZoom(1);
    const firstPhotoLayer = editorLayers.find((layer) => layer.type === "photo");
    setSelectedEditorLayerId(firstPhotoLayer?.id || "photo");
  };

  useEffect(() => {
    if (step > 1) setShowOrderGuide(false);
  }, [step]);

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
        if (location.state?.seasonalDraft) {
          setSeasonalDraft(location.state.seasonalDraft);
          setSeasonalMode(true);
        }
      } catch (error) {
        if (active) setWarn(error?.message || "Could not load the Custom Studio garment catalog.");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const restoreStudioDraft = (draft) => {
    if (!draft) return false;
    const requestedProductId = String(params.get("product") || "");
    const savedProductId = String(draft.productId || "");
    if (requestedProductId && savedProductId && requestedProductId !== savedProductId) return false;

    const draftProduct = catalog.find((item) => String(item.id) === savedProductId)
      || catalog.find((item) => String(item.id) === requestedProductId)
      || null;
    if (!draftProduct) return false;

    const colors = productColors(draftProduct);
    const restoredColor = colors.includes(draft.color) ? draft.color : (colors[0] || "");
    const sizes = productSizes(draftProduct, restoredColor);
    const restoredSize = sizes.includes(draft.size) ? draft.size : "";
    const restoredPhotos = Array.isArray(draft.photos) ? draft.photos.map((photo) => ({
      ...photo,
      sourceFile: null,
      processingStatus: photo?.processingStatus === "processing" ? "failed" : photo?.processingStatus,
      processingMessage: photo?.processingStatus === "processing"
        ? "Background processing was interrupted. Tap retry to continue."
        : photo?.processingMessage,
    })) : [];

    setProduct(draftProduct);
    setGarment(garmentFromProduct(draftProduct));
    setColor(restoredColor);
    setSize(restoredSize);
    setQty(Math.max(1, Math.min(99, Number(draft.qty || 1))));
    setStep(Math.max(1, Math.min(STEPS.length, Number(draft.step || 1))));
    setDesignPath(String(draft.designPath || ""));
    setDesignStylesBySide(
      draft.designStylesBySide && typeof draft.designStylesBySide === "object"
        ? { front: String(draft.designStylesBySide.front || ""), back: String(draft.designStylesBySide.back || "") }
        : { front: String(draft.designStyle || ""), back: "" }
    );
    setDesignMood("Original");
    setDesignIntensity(Math.max(1, Math.min(5, Number(draft.designIntensity || 3))));
    setPlacement(["front", "back", "front_back"].includes(draft.placement) ? draft.placement : "front");
    setPreviewSide(draft.previewSide === "back" ? "back" : "front");
    setGroupGarments(Array.isArray(draft.groupGarments) ? draft.groupGarments : []);
    setPhotos(restoredPhotos);
    setEditorLayersBySide(draft.editorLayersBySide || { front: [], back: [] });
    setSelectedEditorLayerIds(draft.selectedEditorLayerIds || { front: "photo", back: "photo" });
    setPersonalization({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "", ...(draft.personalization || {}) });
    setMemorialNameConfirmed(Boolean(draft.memorialNameConfirmed));
    setNeedByDate(String(draft.needByDate || ""));
    setPriority(draft.priority === "rush" ? "rush" : "standard");
    setArtworkStates(draft.artworkStates || defaultArtworkStates());
    setPreviewZoom(clampPreview(draft.previewZoom || 1));
    const restoredSeasonalDraft =
      draft.designPath === "seasonal" && draft.seasonalDraft?.artworkId
        ? draft.seasonalDraft
        : null;
    setSeasonalDraft(restoredSeasonalDraft);
    setSeasonalMode(Boolean(restoredSeasonalDraft));
    setRightsConfirmed(false);
    setApprovalAcknowledged(false);
    setPendingDraft(null);
    setDraftRestored(true);
    setDraftStatus("saved");
    setDraftReady(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  };

  const startFreshStudio = () => {
    try {
      window.localStorage.removeItem(STUDIO_DRAFT_KEY);
    } catch {
      // Starting fresh should still work when browser storage is unavailable.
    }
    setSeasonalDraft(null);
    setSeasonalMode(false);
    setPendingDraft(null);
    setDraftRestored(false);
    setDraftStatus("idle");
    setDraftReady(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  useEffect(() => {
    if (draftReady || pendingDraft || !catalog.length || location.state?.seasonalDraft) return;
    const draft = readStudioDraft();
    if (!draft) {
      setDraftReady(true);
      return;
    }

    const requestedProductId = String(params.get("product") || "");
    const savedProductId = String(draft.productId || "");
    if (requestedProductId && savedProductId && requestedProductId !== savedProductId) {
      setDraftReady(true);
      return;
    }

    if (location.state?.resumeStudioDraft === true || params.get("resume") === "1") {
      if (!restoreStudioDraft(draft)) setDraftReady(true);
      return;
    }

    setPendingDraft(draft);
    setDraftStatus("saved");
  }, [catalog, draftReady, pendingDraft]);

  useEffect(() => {
    if (!draftReady || saving || !product?.id || typeof window === "undefined") return undefined;
    setDraftStatus("saving");
    if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current);

    draftSaveTimerRef.current = window.setTimeout(() => {
      const snapshot = {
        version: STUDIO_DRAFT_VERSION,
        updatedAt: new Date().toISOString(),
        productId: product.id,
        step,
        designPath,
        designStyle: orderDesignStyle,
        designStylesBySide,
        designMood,
        designIntensity,
        color,
        size,
        qty,
        placement,
        previewSide,
        groupGarments,
        photos: photos.map(serializablePhotoAsset),
        editorLayersBySide,
        selectedEditorLayerIds,
        personalization,
        memorialNameConfirmed,
        needByDate,
        priority,
        artworkStates,
        previewZoom,
        seasonalDraft,
      };
      try {
        window.localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(snapshot));
        setDraftStatus("saved");
      } catch {
        setDraftStatus("error");
      }
    }, STUDIO_DRAFT_SAVE_DELAY_MS);

    return () => {
      if (draftSaveTimerRef.current) window.clearTimeout(draftSaveTimerRef.current);
    };
  }, [draftReady, seasonalMode, saving, product?.id, step, designPath, designStylesBySide, orderDesignStyle, designMood, designIntensity, color, size, qty, placement, previewSide, groupGarments, photos, editorLayersBySide, selectedEditorLayerIds, personalization, memorialNameConfirmed, needByDate, priority, artworkStates, previewZoom, seasonalDraft]);

  const chooseProduct = (nextProduct) => {
    if (!nextProduct) return;
    const colors = productColors(nextProduct);
    const nextColor = color && colors.includes(color) ? color : colors[0] || "";
    const sizes = productSizes(nextProduct, nextColor);
    const nextSize = size && sizes.includes(size) ? size : (seasonalMode ? sizes[0] || "" : "");
    setProduct(nextProduct);
    setGarment(garmentFromProduct(nextProduct));
    setColor(nextColor);
    setSize(nextSize);
    setGroupGarments([]);
    const allowedStyles = nextProduct?.customization?.allowedStyles || [];
    const styleStillAllowed = (value) => !value || designPath === "upload" || designPath === "memorial" || value === NO_TEMPLATE_STYLE || !allowedStyles.length || allowedStyles.includes(value);
    const nextFrontStyle = styleStillAllowed(frontDesignStyle) ? frontDesignStyle : "";
    const nextBackStyle = styleStillAllowed(backDesignStyle) ? backDesignStyle : "";
    if (nextFrontStyle !== frontDesignStyle || nextBackStyle !== backDesignStyle) {
      setDesignStylesBySide({ front: nextFrontStyle, back: nextBackStyle });
      setArtworkStates((current) => ({
        front: nextFrontStyle === frontDesignStyle ? current.front : defaultArtworkState(),
        back: nextBackStyle === backDesignStyle ? current.back : defaultArtworkState(),
      }));
    }
    setPreviewSide("front");
  };

  const chooseColor = (nextColor) => {
    setColor(nextColor);
    const sizes = productSizes(product, nextColor);
    if (!sizes.includes(size)) setSize(seasonalMode ? sizes[0] || "" : "");
  };

  const config = product?.customization || {};
  const mobileFloatingCtaEnabled = studioSettings.mobileFloatingCtaEnabled === true;
  const priceVisibility = ["hidden", "total", "all"].includes(studioSettings.priceVisibility) ? studioSettings.priceVisibility : "hidden";
  const showGarmentPrices = priceVisibility === "all";
  const showOrderPrice = priceVisibility !== "hidden";
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
  const matchingStyleOptions = designPath === "bootleg"
    ? styleOptions.filter((style) => style.category === "photo_bootleg" && style.locked !== false)
    : designPath === "memorial"
      ? styleTemplates.filter((style) => style.enabled && style.category === "memorial_tribute" && style.locked !== false)
      : styleOptions;
  const chooseStyleTemplate = (style) => {
    if (!style) return;
    const side = previewSide;
    setDesignStylesBySide((current) => ({ ...current, [side]: style.name }));
    setDesignMood("Original");
    setDesignIntensity(3);
    activatePrintSide(side);
    setArtworkStates((current) => ({
      ...current,
      [side]: {
        ...defaultArtworkState(style),
        sourcePhotoIndex: Number(current?.[side]?.sourcePhotoIndex || 0),
      },
    }));
  };
  const chooseNoTemplate = () => {
    if (activeStyleTemplate && typeof window !== "undefined" && !window.confirm("Switch to a blank design? Your uploaded photos and text will be preserved. The GDP template will be removed.")) return;
    const side = previewSide;
    setDesignStylesBySide((current) => ({ ...current, [side]: NO_TEMPLATE_STYLE }));
    setDesignMood("Original");
    setArtworkStates((current) => ({ ...current, [side]: defaultArtworkState() }));
  };
  const maxPhotos = Number(config.maxPhotos || 10);
  const minPhotos = Number(config.minPhotos || 1);
  const memorialDetailsReady = designPath !== "memorial" || (Boolean(String(personalization.name || "").trim()) && memorialNameConfirmed);
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
  const printSummaryForSide = (side) => {
    const sideEnabled = side === "front" ? placement !== "back" : placement !== "front";
    if (!sideEnabled) return "No print";
    const styleName = designStyleForSide(side);
    if (styleName) return styleName.replace(/^GDP\s+/, "");
    const visibleLayers = (editorLayersBySide[side] || []).filter((layer) => layer?.visible !== false);
    if (visibleLayers.length) return `${visibleLayers.length} editable layer${visibleLayers.length === 1 ? "" : "s"}`;
    if (designPath === "upload" && photos.length) return "Uploaded artwork";
    return "Print enabled";
  };
  const activePhotoIndex = photos.length
    ? Math.min(Math.max(0, Number(activeArtworkState.sourcePhotoIndex || 0)), photos.length - 1)
    : -1;
  const selectedEditorLayer = editorLayers.find((layer) => layer.id === selectedEditorLayerId) || null;
  const selectedPhotoLayer = selectedEditorLayer?.type === "photo" ? selectedEditorLayer : null;
  const selectedPhotoIndex = selectedPhotoLayer
    ? photos.findIndex((photo) => String(photo?.id || "") === String(selectedPhotoLayer.photoId || ""))
    : activePhotoIndex;
  const selectedPhotoAsset = selectedPhotoIndex >= 0 ? photos[selectedPhotoIndex] : previewArtworkPhoto;
  const editorOutsideWarning = selectedEditorLayer
    ? (
        Number(selectedEditorLayer.x || 50) < 7 ||
        Number(selectedEditorLayer.x || 50) > 93 ||
        Number(selectedEditorLayer.y || 50) < 7 ||
        Number(selectedEditorLayer.y || 50) > 93 ||
        (selectedEditorLayer.type === "photo" && Number(selectedEditorLayer.size || 62) > 135)
          ? "Part of your design is outside the printable area. Reposition or resize it before approval."
          : ""
      )
    : (
        previewArtworkPhoto && (Math.abs(Number(artworkOffset.x || 0)) > 34 || Math.abs(Number(artworkOffset.y || 0)) > 34 || artworkScale > 132)
          ? "Part of your design may be outside the printable area. Reposition or resize it before approval."
          : ""
      );

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

    const taskRows = valid.map((file, index) => ({
      id: `upload-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      stage: "preparing",
      progress: 8,
      message: "Preparing photo…",
    }));
    setUploadTasks(taskRows);
    const updateUploadTask = (index, patch) => {
      const taskId = taskRows[index]?.id;
      if (!taskId) return;
      setUploadTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...patch } : task));
    };

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
          updateUploadTask(index, { stage: "preparing", progress: 15, message: "Optimizing photo…" });
          const prepared = await prepareImageForUpload(original, designPath === "upload");
          updateUploadTask(index, { stage: "uploading", progress: 32, message: "Uploading photo…" });
          let originalUpload = null;
          let activeUpload = null;
          let activePrepared = prepared;
          let cleanedUpload = null;
          let cleanedPrepared = null;
          let removalMessage = "";

          if ((designPath === "bootleg" || designPath === "memorial") && editorTools.autoBackgroundRemoval !== false) {
            try {
              updateUploadTask(index, { stage: "removing_background", progress: 48, message: "Removing background…" });
              const processed = await customerApi.removePhotoBackground(prepared.file);
              originalUpload = processed?.originalPath
                ? { file_url: processed.originalUrl, storage_path: processed.originalPath }
                : null;
              if (processed?.ok && processed?.cleanedUrl && processed?.cleanedPath) {
                cleanedUpload = { file_url: processed.cleanedUrl, storage_path: processed.cleanedPath };
                cleanedPrepared = { file: prepared.file, width: prepared.width, height: prepared.height };
                activeUpload = cleanedUpload;
                activePrepared = cleanedPrepared;
              } else {
                removalMessage = processed?.message || "Background removal failed. Please retry.";
              }
            } catch (error) {
              removalMessage = error?.message || "Background removal failed. Please retry.";
            }
          }

          if (!originalUpload) {
            updateUploadTask(index, { stage: "uploading", progress: 72, message: "Uploading photo…" });
            originalUpload = await uploadWithRetry(prepared.file);
          }
          if (!activeUpload) activeUpload = originalUpload;
          updateUploadTask(index, { stage: "preparing_preview", progress: 90, message: "Preparing preview…" });

          results[index] = {
            id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `photo-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
            url: activeUpload.file_url,
            path: activeUpload.storage_path,
            name: original.name,
            width: activePrepared.width,
            height: activePrepared.height,
            quality: qualityFor(activePrepared.width, activePrepared.height),
            originalUrl: originalUpload.file_url,
            originalPath: originalUpload.storage_path,
            originalWidth: prepared.width,
            originalHeight: prepared.height,
            cleanedUrl: cleanedUpload?.file_url || "",
            cleanedPath: cleanedUpload?.storage_path || "",
            cleanedWidth: cleanedPrepared?.width || 0,
            cleanedHeight: cleanedPrepared?.height || 0,
            backgroundRemoved: Boolean(cleanedUpload),
            autoBackgroundRemoval: (designPath === "bootleg" || designPath === "memorial") && editorTools.autoBackgroundRemoval !== false,
            processingStatus: cleanedUpload ? "removed" : (removalMessage ? "failed" : "original"),
            processingMessage: removalMessage,
            sourceFile: prepared.file,
          };
          updateUploadTask(index, removalMessage
            ? { stage: "needs_attention", progress: 100, message: "Uploaded · background removal needs retry" }
            : { stage: "ready", progress: 100, message: "Ready ✓" });
        } catch (error) {
          const message = error?.message || ("Upload failed for " + original.name + ".");
          errors.push(message);
          updateUploadTask(index, { stage: "failed", progress: 100, message });
        } finally {
          completed += 1;
          setUploadProgress({ done: completed, total: valid.length });
        }
      }
    }

    const workerCount = window.innerWidth < 768 ? 1 : Math.min(2, valid.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    const uploadedPhotos = results.filter(Boolean);
    if (uploadedPhotos.length) checkpointEditor();
    setPhotos(prev => {
      const hadPrimary = prev.some(p => p.isPrimary);
      return [...prev, ...uploadedPhotos.map((photo, index) => ({ ...photo, isPrimary: !hadPrimary && index === 0 }))];
    });
    if (uploadedPhotos.length) {
      const photoLayerStart = editorLayers.filter((layer) => layer.type === "photo").length;
      // A failed AI result remains available for retry/manual refinement but is
      // never placed on the garment with its rectangular original background.
      const readyPhotos = uploadedPhotos.filter((photo) => photo.processingStatus !== "failed");
      const nextPhotoLayers = readyPhotos.map((photo, index) => createPhotoLayer(photo, photoLayerStart + index));
      if (nextPhotoLayers.length) activatePrintSide();
      setEditorLayers((current) => [...current, ...nextPhotoLayers]);
      setSelectedEditorLayerId(nextPhotoLayers[0]?.id || "photo");
    }
    if (errors.length) setWarn(errors.join(" "));
    setUploading(false);
    const completedTaskIds = new Set(taskRows.map((task) => task.id));
    window.setTimeout(() => {
      taskRows.forEach((task) => URL.revokeObjectURL(task.previewUrl));
      setUploadTasks((current) => current.filter((task) => !completedTaskIds.has(task.id)));
    }, 2200);
  }

  const setPrimary = index => setPhotos(prev => prev.map((photo, i) => ({ ...photo, isPrimary: i === index })));
  const togglePhotoBackground = index => {
    if (index < 0 || !photos[index]?.cleanedUrl || !photos[index]?.originalUrl) return;
    checkpointEditor();
    setPhotos(prev => prev.map((photo, i) => {
      if (i !== index || !photo.cleanedUrl || !photo.originalUrl) return photo;
      const useCleaned = !photo.backgroundRemoved;
      return {
        ...photo,
        backgroundRemoved: useCleaned,
        url: useCleaned ? photo.cleanedUrl : photo.originalUrl,
        path: useCleaned ? photo.cleanedPath : photo.originalPath,
        width: useCleaned ? photo.cleanedWidth : photo.originalWidth,
        height: useCleaned ? photo.cleanedHeight : photo.originalHeight,
        quality: qualityFor(
          useCleaned ? photo.cleanedWidth : photo.originalWidth,
          useCleaned ? photo.cleanedHeight : photo.originalHeight
        )
      };
    }));
  };
  const togglePhotoBackgroundById = photoId => {
    const index = photos.findIndex((photo) => String(photo?.id || "") === String(photoId || ""));
    if (index >= 0) togglePhotoBackground(index);
  };
  const retryPhotoBackground = async (index) => {
    const photo = photos[index];
    if (!photo || photo.processingStatus === "processing") return;
    setPhotos((current) => current.map((item, i) => i === index ? { ...item, processingStatus: "processing", processingMessage: "" } : item));
    try {
      let sourceFile = photo.sourceFile || null;
      if (!sourceFile && photo.originalUrl) {
        const response = await fetch(photo.originalUrl);
        if (!response.ok) throw new Error("The saved original photo could not be reopened. Please upload it again.");
        const blob = await response.blob();
        sourceFile = new File([blob], photo.name || "gdp-photo", { type: blob.type || "image/png", lastModified: Date.now() });
      }
      if (!sourceFile) throw new Error("The original photo is unavailable. Please upload it again.");
      const processed = await customerApi.removePhotoBackground(sourceFile);
      if (!processed?.ok || !processed?.cleanedUrl || !processed?.cleanedPath) {
        throw new Error(processed?.message || "Background removal failed. Please retry.");
      }
      const updated = {
        ...photo,
        url: processed.cleanedUrl,
        path: processed.cleanedPath,
        originalUrl: processed.originalUrl || photo.originalUrl,
        originalPath: processed.originalPath || photo.originalPath,
        cleanedUrl: processed.cleanedUrl,
        cleanedPath: processed.cleanedPath,
        cleanedWidth: photo.originalWidth || photo.width,
        cleanedHeight: photo.originalHeight || photo.height,
        backgroundRemoved: true,
        processingStatus: "removed",
        processingMessage: "",
      };
      checkpointEditor();
      setPhotos((current) => current.map((item, i) => i === index ? updated : item));
      if (!editorLayers.some((layer) => layer.type === "photo" && String(layer.photoId) === String(photo.id))) {
        const layer = createPhotoLayer(updated, editorLayers.filter((item) => item.type === "photo").length);
        setEditorLayers((current) => [...current, layer]);
        setSelectedEditorLayerId(layer.id);
      }
    } catch (error) {
      setPhotos((current) => current.map((item, i) => i === index ? {
        ...item,
        processingStatus: "failed",
        processingMessage: error?.message || "Background removal failed. Please retry.",
      } : item));
    }
  };
  const removePhoto = index => {
    if (index < 0 || index >= photos.length) return;
    checkpointEditor();
    const removedPhotoId = String(photos[index]?.id || "");
    setPhotos(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length && !next.some(p => p.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
    if (removedPhotoId) {
      setEditorLayersBySide((current) => ({
        front: (current.front || []).filter((layer) => !(layer.type === "photo" && String(layer.photoId || "") === removedPhotoId)),
        back: (current.back || []).filter((layer) => !(layer.type === "photo" && String(layer.photoId || "") === removedPhotoId)),
      }));
      if (selectedPhotoLayer && String(selectedPhotoLayer.photoId || "") === removedPhotoId) {
        const nextPhotoLayer = editorLayers.find((layer) => layer.type === "photo" && String(layer.photoId || "") !== removedPhotoId);
        setSelectedEditorLayerId(nextPhotoLayer?.id || "photo");
      }
    }
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

  const applyPhotoBrushEdit = async ({ file, width, height }) => {
    if (selectedPhotoIndex < 0 || !file) return;
    const uploaded = await customerApi.uploadArtwork(file);
    checkpointEditor();
    setPhotos((current) => current.map((photo, index) => index === selectedPhotoIndex ? {
      ...photo,
      url: uploaded.file_url,
      path: uploaded.storage_path,
      editedUrl: uploaded.file_url,
      editedPath: uploaded.storage_path,
      editedWidth: Number(width || photo.width || 0),
      editedHeight: Number(height || photo.height || 0),
      width: Number(width || photo.width || 0),
      height: Number(height || photo.height || 0),
      quality: qualityFor(Number(width || photo.width || 0), Number(height || photo.height || 0)),
    } : photo));
  };

  const resetActivePhoto = () => {
    if (selectedPhotoIndex < 0) return;
    checkpointEditor();
    setPhotos((current) => current.map((photo, index) => {
      if (index !== selectedPhotoIndex) return photo;
      const useCleaned = Boolean(photo.backgroundRemoved && photo.cleanedUrl);
      return {
        ...photo,
        url: useCleaned ? photo.cleanedUrl : (photo.originalUrl || photo.url),
        path: useCleaned ? photo.cleanedPath : (photo.originalPath || photo.path),
        width: useCleaned ? photo.cleanedWidth : (photo.originalWidth || photo.width),
        height: useCleaned ? photo.cleanedHeight : (photo.originalHeight || photo.height),
      };
    }));
    if (selectedPhotoLayer) {
      const reset = createPhotoLayer(photos[selectedPhotoIndex], editorLayers.filter((layer) => layer.type === "photo").findIndex((layer) => layer.id === selectedPhotoLayer.id));
      reset.id = selectedPhotoLayer.id;
      setEditorLayers((current) => current.map((layer) => layer.id === selectedPhotoLayer.id ? reset : layer));
    } else {
      resetPreviewPlacement();
    }
  };

  const deleteActivePhoto = () => {
    if (selectedPhotoIndex < 0) return;
    const photo = photos[selectedPhotoIndex];
    if (designPath === "bootleg" && photo && typeof window !== "undefined") {
      const photoId = String(photo.id || "");
      const usedSides = ["front", "back"].filter((side) => (editorLayersBySide[side] || []).some((layer) => layer.type === "photo" && String(layer.photoId || "") === photoId));
      const usedMessage = usedSides.length ? ` It is currently placed on ${usedSides.join(" and ")}.` : "";
      const label = String(photo.name || "this uploaded photo");
      const confirmed = window.confirm(`Delete "${label}" from this custom project?${usedMessage} This removes every editable instance of the photo from both fabrics. Protected GDP template artwork will stay.`);
      if (!confirmed) return;
    }
    removePhoto(selectedPhotoIndex);
  };

  const addGroupGarment = () => setGroupGarments(prev => [...prev, { size, color, quantity: 1 }]);
  const updateGroup = (index, patch) => setGroupGarments(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  const removeGroup = index => setGroupGarments(prev => prev.filter((_, i) => i !== index));

  const canContinue = () => {
    if (step === 1) return Boolean(product) && Boolean(color) && Boolean(size) && selectedAvailable;
    if (step === 2) return Boolean(designPath);
    if (step === 3) {
      return Boolean(orderDesignStyle) && photos.length >= minPhotos && memorialDetailsReady;
    }
    if (step === 4) return rightsConfirmed && approvalAcknowledged;
    return true;
  };

  const continueHint = () => {
    if (canContinue()) return "";
    if (step === 1) {
      if (!product) return "Choose a garment to continue.";
      if (!color) return "Choose a garment color to continue.";
      if (!size) return "Choose a size to continue.";
      if (!selectedAvailable) return "This color and size combination is unavailable.";
    }
    if (step === 2) return "Choose a design path to continue.";
    if (step === 3) {
      if (!orderDesignStyle) return "Choose an artwork style to continue.";
      if (photos.length < minPhotos) return `Upload at least ${minPhotos} photo${minPhotos === 1 ? "" : "s"} to continue.`;
      if (designPath === "memorial" && !String(personalization.name || "").trim()) return "Enter the memorial name exactly as it should be printed.";
      if (designPath === "memorial" && !memorialNameConfirmed) return "Verify the memorial name spelling to continue.";
    }
    if (step === 4) return "Confirm both artwork rights and proof approval terms to continue.";
    return "Complete the required choices to continue.";
  };

  const focusMissingRequirement = () => {
    let targetId = "custom-studio-workspace";
    let panelTab = "";
    if (step === 3) {
      if (!orderDesignStyle) { targetId = "custom-studio-artwork-style"; panelTab = "design"; }
      else if (photos.length < minPhotos) { targetId = "custom-studio-photo-upload"; panelTab = "photos"; }
      else if (designPath === "memorial" && (!String(personalization.name || "").trim() || !memorialNameConfirmed)) { targetId = "custom-studio-memorial-details"; panelTab = "details"; }
    }
    if (panelTab) {
      window.dispatchEvent(new CustomEvent("gdp-studio-open-tab", { detail: { tab: panelTab } }));
    }
    window.setTimeout(() => {
      const target = document.getElementById(targetId) || document.getElementById("gdp-touch-studio-panel") || document.getElementById("custom-studio-workspace");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof target.animate === "function") {
        target.animate(
          [
            { boxShadow: "0 0 0 0 rgba(217,39,62,0)" },
            { boxShadow: "0 0 0 4px rgba(217,39,62,.28)" },
            { boxShadow: "0 0 0 0 rgba(217,39,62,0)" },
          ],
          { duration: 900, easing: "ease-out" }
        );
      }
    }, panelTab ? 80 : 0);
  };

  const handleContinue = () => {
    if (!canContinue()) {
      focusMissingRequirement();
      return;
    }
    setStep(step + 1);
    window.requestAnimationFrame(() => {
      document.getElementById("custom-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
    if (!designPath || !orderDesignStyle) {
      setWarn("Complete the design path and artwork before adding to cart.");
      return;
    }
    if (designPath === "memorial" && !memorialDetailsReady) {
      setWarn("Enter the memorial name and verify its spelling before approval.");
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

      const approvedAt = new Date().toISOString();
      const serializeStyleTemplate = (template) => template ? {
        id: template.id,
        assetUrl: template.assetUrl || "",
        photoZone: template.photoZone || null,
        textZone: template.textZone || null,
      } : null;
      const frontStyleTemplate = styleTemplateForSide("front");
      const backStyleTemplate = styleTemplateForSide("back");
      const primaryStyleTemplate = placement === "back" ? backStyleTemplate : (frontStyleTemplate || backStyleTemplate);
      const renderSnapshot = {
        version: 2,
        designPath,
        designStyle: orderDesignStyle,
        designStylesBySide: { front: frontDesignStyle, back: backDesignStyle },
        template: serializeStyleTemplate(primaryStyleTemplate),
        templatesBySide: {
          front: serializeStyleTemplate(frontStyleTemplate),
          back: serializeStyleTemplate(backStyleTemplate),
        },
        colorFinish: designMood,
        placement,
        garment: { id: productId, variantId: selectedVariant?.id || null, color, size },
        personalization: {
          ...personalization,
          memorialNameVerified: designPath === "memorial" ? memorialNameConfirmed : false,
          memorialNameVerifiedAt: designPath === "memorial" && memorialNameConfirmed ? approvedAt : null,
        },
        editableLayers: (editorLayersBySide.front || []).map((layer) => ({ ...layer })),
        editableLayersBySide: {
          front: (editorLayersBySide.front || []).map((layer) => ({ ...layer })),
          back: (editorLayersBySide.back || []).map((layer) => ({ ...layer })),
        },
        stickerLibrary: stickerLibrary.map((item) => ({ ...item })),
        artworkBySide: {
          front: { ...artworkStates.front, photoPath: frontArtworkPhoto?.path || null },
          back: { ...artworkStates.back, photoPath: backArtworkPhoto?.path || null },
        },
      };
      const lockedHash = await sha256Snapshot(renderSnapshot);
      const printedSides = placement === "front_back" ? ["front", "back"] : [placement === "back" ? "back" : "front"];
      const productionFiles = {};
      for (const side of printedSides) {
        const profile = recommendedPrintProfile(garment?.previewType || garment?.type, size, side);
        const rendered = await captureElementAsPng(
          `gdp-production-${side}`,
          Math.round(Number(profile.widthIn || 12) * 300),
          `gdp-${lockedHash.slice(0, 12)}-${side}-300dpi.png`
        );
        productionFiles[side] = {
          path: rendered.upload.storage_path,
          widthPx: rendered.widthPx,
          heightPx: rendered.heightPx,
          widthIn: Number(profile.widthIn || 12),
          heightIn: Number(profile.heightIn || 16),
          dpi: 300,
          mimeType: "image/png",
        };
      }
      const mockupSide = placement === "back" ? "back" : "front";
      const customerMockup = await captureElementAsPng(
        `gdp-mockup-${mockupSide}`,
        900,
        `gdp-${lockedHash.slice(0, 12)}-approved-mockup.png`
      );
      const preflight = {
        version: 1,
        status: "passed",
        checkedAt: approvedAt,
        expectedSides: printedSides,
        dpi: 300,
        files: Object.fromEntries(Object.entries(productionFiles).map(([side, file]) => [side, {
          widthPx: file.widthPx,
          heightPx: file.heightPx,
          widthIn: file.widthIn,
          heightIn: file.heightIn,
          dpi: file.dpi,
        }])),
      };

      const design = await customerApi.createCustomDesign({
        productId,
        productName: product?.name || garment.label,
        name: personalization.name || ((orderDesignStyle || "Custom") + " Design"),
        designStyle: orderDesignStyle,
        designPath,
        photos: photos.map(p => p.url),
        photoAssets: photos,
        personalization: {
          ...personalization,
          memorialNameVerified: designPath === "memorial" ? memorialNameConfirmed : false,
          memorialNameVerifiedAt: designPath === "memorial" && memorialNameConfirmed ? approvedAt : null,
          previewState: {
            version: 7,
            side: previewSide,
            editableLayers: (editorLayersBySide.front || []).map((layer) => ({ ...layer })),
            editableLayersBySide: {
              front: (editorLayersBySide.front || []).map((layer) => ({ ...layer })),
              back: (editorLayersBySide.back || []).map((layer) => ({ ...layer })),
            },
            stickerLibrary: stickerLibrary.map((item) => ({ ...item })),
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
            productionReady: true,
            templateComposite: Boolean(activeStyleTemplate)
          }
        },
        placement,
        color,
        size,
        previewUrl: customerMockup.upload.file_url,
        occasion: designPath,
        recipientType: "",
        designMood,
        story: "",
        designIntensity,
        garmentTier: garment.tier,
        needByDate: needByDate || undefined,
        priority,
        proofRequired: false,
        revisionAllowance: revisions,
        primaryPhotoIndex: primaryIndex,
        customerConfirmedRights: rightsConfirmed,
        approvalPolicyAcknowledged: approvalAcknowledged,
        additionalGarments: normalizedGroups,
        renderSnapshot,
        productionFiles,
        customerMockupPath: customerMockup.upload.storage_path,
        renderStatus: "locked",
        lockedHash,
        customerApprovedAt: approvedAt,
        preflight,
        status: "in_cart"
      });

      const common = {
        productId,
        name: product?.name || garment.label,
        image: customerMockup.upload.file_url,
        isCustom: true,
        customDesignId: design.id,
        ...(design.guestDesignToken ? { guestDesignToken: design.guestDesignToken } : {}),
        fulfillmentMode: product?.fulfillmentMode || "in_house",
        designStyle: orderDesignStyle,
        designPath,
        designMood,
        placement,
        occasion: designPath,
        needByDate,
        priority,
        proofRequired: false,
        renderStatus: "locked"
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

      try {
        window.localStorage.removeItem(STUDIO_DRAFT_KEY);
      } catch {
        // A completed design should still proceed even if local draft cleanup is unavailable.
      }
      setDraftStatus("idle");
      navigate("/cart");
    } catch (error) {
      setWarn(error?.message || "Could not save your custom design.");
      setSaving(false);
    }
  }

  if (seasonalMode && product && color && size) return <SeasonalStudio
    product={product} garment={garment} color={color} size={size} variant={selectedVariant}
    quantity={qty} unitPrice={Number(selectedVariant?.price ?? product.price ?? 0)} Preview={StudioPreview}
    catalog={catalog} availableColors={availableColors} availableSizes={availableSizes}
    onProductChange={chooseProduct} onColorChange={chooseColor} onSizeChange={setSize}
    colorSwatch={(value) => swatchFor(product, value)} priceVisibility={priceVisibility}
    initialDraft={seasonalDraft || location.state?.seasonalDraft || null} editCartKey={location.state?.editCartKey || ""}
    onDraftChange={setSeasonalDraft}
    onBack={() => {setSeasonalMode(false);setStep(1);window.scrollTo({top:0,behavior:'instant'});}} />;


  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[linear-gradient(180deg,#F4F7FA_0%,#EDF2F6_38%,#F8FAFC_100%)]">
      {pendingDraft && <div className="fixed inset-0 z-[150] grid place-items-center bg-[#07131F]/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="saved-studio-draft-title">
        <div className="w-full max-w-[390px] rounded-[24px] border border-white/10 bg-[#07131F] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,.45)]">
          <div className="font-mono text-[9px] uppercase tracking-[.2em] text-[#D9273E]">Saved custom design</div>
          <h2 id="saved-studio-draft-title" className="mt-2 text-xl font-black tracking-tight">Resume your unfinished design?</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">Your previous Custom Studio work is saved, but it will not reopen automatically. Resume it only when you want to continue.</p>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => restoreStudioDraft(pendingDraft)} className="h-11 rounded-xl bg-[#D9273E] px-4 text-xs font-bold uppercase tracking-wide text-white">Resume previous design</button>
            <button type="button" onClick={startFreshStudio} className="h-11 rounded-xl border border-white/12 bg-white/[.045] px-4 text-xs font-bold uppercase tracking-wide text-white/80">Start fresh</button>
          </div>
          <p className="mt-3 text-center text-[9px] leading-relaxed text-white/35">Starting fresh clears the saved unfinished draft. Completed cart designs are not affected.</p>
        </div>
      </div>}
      <div className="mx-auto w-full min-w-0 max-w-[1540px] px-4 py-6 md:py-10 lg:px-8">
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
              <div className="overflow-x-auto snap-x snap-mandatory md:overflow-visible">
                <div className="flex md:grid md:grid-cols-6 md:divide-x md:divide-[#e4ddd3]">
                  {ORDER_GUIDE_STEPS.map((guide, index) => {
                    const number = index + 1;
                    const active = number === step;
                    const complete = number < step;
                    return <button
                      type="button"
                      key={guide.title}
                      onClick={() => number < step && setStep(number)}
                      className={"w-[82%] shrink-0 snap-start p-4 text-left transition md:w-auto md:shrink " + (active ? "bg-accent/[0.065]" : complete ? "bg-[#F8FAFC]" : "bg-white/50") + (number < step ? " hover:bg-[#f7f2eb]" : "")}
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

          <div className="mt-3">
            <StudioStepNav
              step={step}
              totalSteps={STEPS.length}
              canContinue={canContinue()}
              hint={continueHint()}
              saving={saving}
              finalDisabled={!rightsConfirmed || !approvalAcknowledged}
              onPrevious={() => step === 1 ? navigate(-1) : setStep(step - 1)}
              onContinue={handleContinue}
              onFinal={createAndAdd}
            />
          </div>
        </div>

        <div className="grid w-full min-w-0 max-w-full items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
          <section id="custom-studio-workspace" className="scroll-mt-24 min-w-0 max-w-full overflow-x-clip rounded-[24px] border border-[#e2dcd3] bg-[#FFFFFF] p-4 shadow-[0_18px_50px_rgba(28,24,20,.055)] md:p-8 md:min-h-[560px]">
          {step === 2 && <div>
            <StepTitle eyebrow="Start your design" title="CHOOSE YOUR DESIGN PATH" text="Choose the kind of design you want. You will customize everything in the next workspace." />
            <div className="grid sm:grid-cols-2 gap-4">
              {DESIGN_PATHS.map((path) => {
                const Icon = path.icon;
                const unavailable = path.id === "seasonal" && (placement !== "front" || groupGarments.length > 0);
                return <button
                  key={path.id}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={designPath === path.id}
                  onClick={() => {
                    setDesignPath(path.id);
                    setMemorialNameConfirmed(false);
                    if (path.id === "seasonal") {
                      setSeasonalMode(true);
                      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
                      return;
                    }
                    if (path.id === "upload") {
                      setDesignStylesBySide({ front: "Own artwork", back: "Own artwork" });
                      setPreviewSide("front");
                      setArtworkStates(defaultArtworkStates());
                      setDesignMood("Original");
                      setDesignIntensity(1);
                    } else if (path.id === "bootleg" || path.id === "memorial") {
                      setDesignStylesBySide({ front: "", back: "" });
                      setPreviewSide("front");
                      setDesignMood("Original");
                      setDesignIntensity(3);
                    }
                    setStep(3);
                    window.requestAnimationFrame(() => {
                      document.getElementById("custom-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  className={"rounded-[20px] border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 " + (designPath === path.id ? "border-accent bg-accent/[0.055] shadow-sm" : "border-[#ddd7ce] bg-white hover:border-accent hover:-translate-y-0.5")}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F1F5F8] text-[#17324D]"><Icon size={20}/></span>
                  <div className="mt-4 text-lg font-extrabold">{path.label}</div>
                  <p className="mt-1 text-sm leading-relaxed text-[#6b645c]">{path.description}</p>
                  <div className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent">{designPath === path.id ? "Selected" : "Choose this path"} <ArrowRight size={13} className="inline"/></div>
                </button>;
              })}
            </div>
            {placement !== "front" || groupGarments.length > 0 ? <p className="mt-4 text-sm text-[#706960]">Seasonal designs require front-only printing with no additional garment rows.</p> : null}
          </div>}
          {step === 3 && <div>
            {designPath !== "upload" && <>
            <div data-editor-legacy="artwork-style" className="hidden">
              <button type="button" onClick={chooseNoTemplate} aria-pressed={designStyle === NO_TEMPLATE_STYLE} className={"select-none grid min-h-[112px] grid-cols-[1fr_92px] items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 " + (designStyle === NO_TEMPLATE_STYLE ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.06)]" : "border-[#ddd7ce] bg-white/55 hover:border-[#9aa8b5] hover:bg-white")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-bold">No Template — Upload Only {designStyle === NO_TEMPLATE_STYLE && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] uppercase tracking-wide text-white"><Check size={10}/> Selected</span>}</div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Start with a blank print area and use only your own photos or text.</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.12em] text-[#65717d]"><Unlock size={11}/> Blank editable canvas</div>
                </div>
                <div className="relative grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-[#cfc7bc] bg-[linear-gradient(45deg,#f0ede8_25%,transparent_25%),linear-gradient(-45deg,#f0ede8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0ede8_75%),linear-gradient(-45deg,transparent_75%,#f0ede8_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0px] text-[9px] font-bold uppercase text-[#756f67]">Blank</div>
              </button>
              {matchingStyleOptions.map((style) => <button type="button" key={style.id} onClick={() => chooseStyleTemplate(style)} aria-pressed={designStyle === style.name} className={"select-none grid min-h-[112px] grid-cols-[1fr_92px] items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 " + (designStyle === style.name ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.06)]" : "border-[#ddd7ce] bg-white/55 hover:border-[#9aa8b5] hover:bg-white")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-bold">{style.name.replace(/^GDP\s+/, "")} {designStyle === style.name && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] uppercase tracking-wide text-white"><Check size={10}/> Selected</span>}</div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{style.description}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.12em] text-[#8a8279]"><Lock size={11}/> Locked GDP template</div>
                </div>
                <div className="relative aspect-square overflow-hidden rounded-xl border border-[#e2dcd3] bg-[linear-gradient(45deg,#f0ede8_25%,transparent_25%),linear-gradient(-45deg,#f0ede8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0ede8_75%),linear-gradient(-45deg,transparent_75%,#f0ede8_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0px]">
                  <img src={style.thumbnail || style.assetUrl} alt="" loading="lazy" decoding="async" fetchPriority="low" className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] object-contain" />
                </div>
              </button>)}
            </div>
            {(designPath === "bootleg" || designPath === "memorial") && <div className="hidden"><span className="font-semibold text-[#17324D]">{designPath === "memorial" ? "Memorial template applies to: Front." : "Applying template to: Front."}</span> Back printing stays blank until you explicitly add and edit a back print.</div>}
            </>}
            {designPath !== "upload" && <div data-editor-legacy="color-finish" className="hidden">
              <label className="font-mono text-xs uppercase text-muted-foreground">Color finish</label>
              <p className="mt-1 text-xs leading-relaxed text-[#7d766d]">This treatment changes the exact preview and is baked into the production file.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {MOODS.map(mood => <button key={mood} onClick={() => setDesignMood(mood)} className={"px-3 py-2 border text-sm transition " + (designMood === mood ? "bg-[#17324D] text-white border-[#17324D] shadow-sm" : "border-border bg-white hover:border-[#9aa8b5]")}>{mood}</button>)}
              </div>
              <div className="mt-3 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] px-3 py-2.5 text-xs text-[#52616F]">
                {designMood ? <><span className="font-semibold text-[#17324D]">{designMood} finish:</span> {moodPreviewTreatment(designMood).description}</> : <span>Choose a color finish for the final print.</span>}
              </div>
            </div>}
            {(designPath === "bootleg" || designPath === "memorial") && activeStyleTemplate && <div className="hidden"><span className="inline-flex items-center gap-1.5 font-semibold text-[#17324D]"><Lock size={14}/> Template protected:</span> customers cannot resize, stretch, rotate, delete or erase the selected GDP artwork. Only their photo, text and allowed personalization are editable.</div>}
            {(designPath === "bootleg" || designPath === "memorial") && designStyle === NO_TEMPLATE_STYLE && <div className="hidden"><span className="inline-flex items-center gap-1.5 font-semibold text-[#17324D]"><Unlock size={14}/> Blank canvas:</span> no locked background or template will be printed. Your photos, text and stickers remain fully editable.</div>}
            {designPath === "memorial" && <div data-editor-legacy="memorial-details" className="hidden">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F6EDE8] text-[#8A3B45]"><Heart size={18}/></span>
                <div>
                  <div className="font-bold text-[#27231F]">Memorial details</div>
                  <p className="mt-1 text-xs leading-relaxed text-[#6F6860]">Enter the name exactly as it should print. Dates and the remembrance message are optional. Name verification is required before you can continue.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#4D4842]">
                  Memorial name <span className="text-[#A33B46]">*</span>
                  <input
                    type="text"
                    value={personalization.name}
                    maxLength={60}
                    autoComplete="off"
                    onChange={(event) => {
                      setPersonalization((current) => ({ ...current, name: event.target.value }));
                      setMemorialNameConfirmed(false);
                    }}
                    placeholder="Full name as it should be printed"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#D8D1C7] bg-white px-3 text-sm outline-none focus:border-[#8A3B45] focus:ring-2 focus:ring-[#8A3B45]/10"
                  />
                </label>
                <label className="text-xs font-semibold text-[#4D4842]">
                  Dates <span className="font-normal text-[#817A72]">(optional)</span>
                  <input
                    type="text"
                    value={personalization.dates}
                    maxLength={40}
                    autoComplete="off"
                    onChange={(event) => setPersonalization((current) => ({ ...current, dates: event.target.value }))}
                    placeholder="e.g. 1984 — 2026"
                    className="mt-1.5 h-11 w-full rounded-xl border border-[#D8D1C7] bg-white px-3 text-sm outline-none focus:border-[#8A3B45] focus:ring-2 focus:ring-[#8A3B45]/10"
                  />
                </label>
              </div>
              <label className="mt-4 block text-xs font-semibold text-[#4D4842]">
                Remembrance message <span className="font-normal text-[#817A72]">(optional)</span>
                <textarea
                  value={personalization.message}
                  maxLength={140}
                  rows={3}
                  onChange={(event) => setPersonalization((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Forever loved, always remembered."
                  className="mt-1.5 w-full resize-y rounded-xl border border-[#D8D1C7] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8A3B45] focus:ring-2 focus:ring-[#8A3B45]/10"
                />
                <span className="mt-1 block text-right font-mono text-[9px] font-normal text-[#817A72]">{String(personalization.message || "").length}/140</span>
              </label>
              <label className={"mt-4 flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm " + (memorialNameConfirmed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-[#E1D9CF] bg-white text-[#4F4942]")}>
                <input
                  type="checkbox"
                  checked={memorialNameConfirmed}
                  disabled={!String(personalization.name || "").trim()}
                  onChange={(event) => setMemorialNameConfirmed(event.target.checked)}
                  className="mt-0.5"
                />
                <span><strong>I verified the memorial name is spelled exactly as it should be printed.</strong> Changing the name will require verification again.</span>
              </label>
            </div>}
            {designPath === "upload" && <div className="hidden" aria-hidden="true">Your own artwork controls are available in GDP Touch Studio.</div>}
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
                      onClick={() => chooseColor(optionColor)}
                      className={"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition " + (color === optionColor ? "border-[#17324D] bg-[#17324D] text-white shadow-sm" : "border-[#ddd7ce] bg-white hover:border-[#aaa39a]")}
                    >
                      <span
                        className="h-5 w-5 rounded-full border border-slate-900/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75),0_0_0_1px_rgba(15,23,42,0.18)]"
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

              <div className="mt-7 hidden items-center justify-between gap-5 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 lg:flex">
                <div>
                  <div className="text-sm font-bold text-[#17324D]">Garment selection complete</div>
                  <p className="mt-1 text-xs text-[#64707C]">{canContinue() ? `${product.name} · ${color} · ${size} · Qty ${qty}` : continueHint()}</p>
                </div>
                <button
                  type="button"
                  disabled={!canContinue()}
                  onClick={() => {
                    if (!canContinue()) return;
                    setStep(2);
                    window.requestAnimationFrame(() => {
                      document.getElementById("custom-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#17324D] px-5 py-3 text-xs font-bold uppercase text-white shadow-sm transition hover:bg-[#244866] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue to Choose Design <ArrowRight size={16}/>
                </button>
              </div>
            </>}
          </div>}

          {step === 3 && <div data-editor-legacy="photo-upload" className="hidden">
            <StepTitle eyebrow={designPath === "upload" ? "Your artwork" : designPath === "memorial" ? "Portrait photos" : "Your memories"} title={designPath === "upload" ? "UPLOAD YOUR PRINT-READY ARTWORK" : designPath === "memorial" ? "UPLOAD THE MEMORIAL PORTRAIT" : "UPLOAD YOUR BEST PHOTOS"} text={designPath === "upload" ? "Upload your finished PNG, JPG or WEBP file and use the live preview controls to position it." : "Upload " + minPhotos + "–" + maxPhotos + " photos. Protected photo templates automatically remove supported photo backgrounds while preserving the original so it can be restored."} />
            <label className={"border-2 border-dashed border-border min-h-44 flex flex-col items-center justify-center hover:border-accent " + (uploading ? "cursor-wait opacity-80" : "cursor-pointer")}>
              <Upload size={28}/>
              <div className="font-bold mt-2">{uploading ? "Optimizing & uploading…" : designPath === "upload" ? "Upload artwork" : "Upload photos"}</div>
              {uploading && uploadProgress.total > 0 && <div className="font-mono text-xs mt-1">{uploadProgress.done}/{uploadProgress.total} complete · {Math.round((uploadProgress.done / uploadProgress.total) * 100)}%</div>}
              <div className="text-xs text-muted-foreground mt-1">JPG, PNG or WEBP · max {MAX_MB}MB each</div>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={e => uploadFiles(e.target.files)} />
            </label>
            {warn && <div className="mt-3 bg-destructive/10 text-destructive px-3 py-2 text-sm flex items-center gap-2"><AlertTriangle size={15}/>{warn}</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              {uploadTasks.map((task) => <PhotoProcessingCard key={task.id} task={task} />)}
              {photos.map((photo,index) => <PhotoCard key={photo.id || photo.originalUrl || photo.url} photo={photo} onPrimary={() => setPrimary(index)} onRemove={() => removePhoto(index)} onToggleBackground={() => togglePhotoBackground(index)} onRetry={() => retryPhotoBackground(index)} />)}
            </div>
            <div className="font-mono text-xs text-muted-foreground mt-3">{photos.length}/{maxPhotos} photos</div>

          </div>}

          {step === 4 && <div>
            <StepTitle eyebrow="Approve the result" title="TIMING + FINAL APPROVAL" text="The preview you approve is converted into the exact 300 DPI production file before it enters your cart." />
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Need it by</label><input type="date" value={needByDate} onChange={e => setNeedByDate(e.target.value)} className="w-full border border-border bg-background px-3 py-2 mt-1"/></div>
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Priority</label><div className="flex gap-2 mt-1"><Choice active={priority === "standard"} onClick={() => setPriority("standard")}>Standard</Choice><Choice active={priority === "rush"} onClick={() => setPriority("rush")}>Rush (+{"$" + rushFee})</Choice></div></div>
            </div>
            <div className="mt-6 border border-border p-4"><div className="flex items-start gap-3"><ShieldCheck size={22} className="text-accent shrink-0"/><div><div className="font-bold">Preview-to-print guarantee</div><p className="text-sm text-muted-foreground mt-1">After approval, GDP locks the preview and its matching production PNG. Production prints that locked file—there is no separate designer interpretation.</p></div></div></div>
            <label className="flex items-start gap-3 mt-5 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} className="mt-1"/><span>I confirm I own or have permission to reproduce the photos and artwork I submitted. <Link to="/pages/custom-artwork-policy" target="_blank" className="font-semibold text-accent hover:underline">Upload policy</Link></span></label>
            <label className="flex items-start gap-3 mt-3 text-sm"><input type="checkbox" checked={approvalAcknowledged} onChange={e => setApprovalAcknowledged(e.target.checked)} className="mt-1"/><span><strong>I approve the exact live preview shown.</strong> I understand this result will be locked when added to cart and printed after successful payment. To change it, I must create a new design before checkout. Customer uploads follow the <Link to="/pages/data-retention" target="_blank" className="font-semibold text-accent hover:underline">retention policy</Link>.</span></label>
          </div>}

          {step === 5 && <div>
            <StepTitle eyebrow="Final check" title="REVIEW THE EXACT RESULT" text="Adding to cart generates and locks the production-ready PNG from the live preview. Payment then sends that same file to the production queue." />
            <div className="grid md:grid-cols-2 gap-4">
              <ReviewCard label="Design path" value={DESIGN_PATHS.find((path) => path.id === designPath)?.label || "Not selected"} sub={(designPath === "bootleg" || designPath === "memorial") ? "GDP template locked · customer layers editable" : ""} />
              <ReviewCard label={designPath === "upload" ? "Artwork" : "Ready layout"} value={(orderDesignStyle || "Not selected").replace(/^GDP\s+/, "")} sub={orderDesignStyle ? `${designMood || "Original"} finish` : ""} />
              {designPath === "memorial" && <ReviewCard label="Memorial name" value={personalization.name || "Not entered"} sub={personalization.dates ? `Dates: ${personalization.dates}` : "No dates added"} />}
              <ReviewCard label="Garment" value={product?.name || "Not selected"} sub={product ? `${color || "No color"} · ${size || "No size"} · Qty ${qty}` : ""} />
              <ReviewCard
                label="Print"
                value={placement === "front_back" ? "Front + back" : placement === "back" ? "Back only" : "Front only"}
                sub={placement === "front_back" ? "Two independent artwork placements saved." : "One print side selected."}
              />
              {placement !== "back" && <ReviewCard label="Front artwork" value={printSummaryForSide("front")} sub={"Scale " + Number(artworkStates.front?.scale ?? 92) + "% · rotation " + Number(artworkStates.front?.rotation ?? 0) + "°"} />}
              {placement !== "front" && <ReviewCard label="Back artwork" value={printSummaryForSide("back")} sub={"Scale " + Number(artworkStates.back?.scale ?? 92) + "% · rotation " + Number(artworkStates.back?.rotation ?? 0) + "°"} />}
              <ReviewCard label="Photos" value={photos.length + " uploaded"} sub={photos.some(p => p.quality === "replace_recommended") ? "One or more photos should ideally be replaced." : "Photo quality check complete."} />
              <ReviewCard label="Production result" value="Customer-approved preview" sub="Locked 300 DPI PNG is generated when added to cart." />
              <ReviewCard label="Timing" value={priority === "rush" ? "Rush" : "Standard"} sub={needByDate ? "Need by " + needByDate : "No event date selected"} />
            </div>
            {groupGarments.length > 0 && <div className="mt-4 border border-border p-4"><div className="font-bold">Additional shirts using the same design</div>{groupGarments.map((g,i) => <div key={i} className="text-sm text-muted-foreground mt-1">{g.quantity}× {g.color} · {g.size}</div>)}</div>}
            {showOrderPrice && <div className="mt-6 bg-secondary p-5 flex items-end justify-between gap-4"><div><div className="font-mono text-xs uppercase text-muted-foreground">Estimated custom subtotal</div><div className="text-xs text-muted-foreground mt-1">Before cart discounts, shipping, tax or coupon.</div></div><div className="font-display text-4xl">{"$" + estimatedSubtotal.toFixed(2)}</div></div>}
            <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="w-full mt-5 bg-accent text-accent-foreground py-4 font-bold uppercase tracking-wide disabled:opacity-50">{saving ? "Generating production artwork…" : "Approve, Lock & Add to Cart →"}</button>
          </div>}
        </section>

          <aside className="h-fit min-w-0 max-w-full space-y-4 lg:sticky lg:top-24">
            <div ref={mobileEndRef} className="lg:hidden">
              <StudioStepNav
                step={step}
                totalSteps={STEPS.length}
                canContinue={canContinue()}
                hint={continueHint()}
                saving={saving}
                finalDisabled={!rightsConfirmed || !approvalAcknowledged}
                onPrevious={() => step === 1 ? navigate(-1) : setStep(step - 1)}
                onContinue={handleContinue}
                onFinal={createAndAdd}
                compact
              />
            </div>

            <div data-gdp-design-path={designPath || "none"} className="overflow-hidden rounded-[24px] border border-[#dcd5ca] bg-white shadow-[0_18px_55px_rgba(25,22,18,.085)]">
              <div className="gdp-bootleg-preview-toolbar flex flex-col gap-3 px-4 py-3.5 border-b border-[#ebe5dc] bg-[#FFFFFF] lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-mono text-[10px] sm:text-[9px] uppercase tracking-[0.18em] text-accent">Live garment preview</div>
                  <div className="text-sm font-semibold mt-0.5 text-[#25231f]">{product?.name || "Choose a garment"}{product ? ` · ${previewColor} · ${size || "Choose size"} · ${previewSide === "back" ? "Back" : "Front"}` : ""}</div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {designPath === "bootleg" && <>
                    <div className="inline-flex min-h-10 items-center rounded-xl border border-[#DCE3EA] bg-[#F7F9FB] p-1" aria-label="Fabric side controls">
                      <button type="button" onClick={() => setPreviewSide("front")} className={"h-8 rounded-lg px-3 text-[10px] font-bold uppercase transition " + (previewSide === "front" ? "bg-[#17324D] text-white" : "text-[#607080] hover:bg-white hover:text-[#17324D]")}>Front</button>
                      <button type="button" disabled={!frontBackEnabled} onClick={() => setPreviewSide("back")} className={"h-8 rounded-lg px-3 text-[10px] font-bold uppercase transition disabled:opacity-35 " + (previewSide === "back" ? "bg-[#17324D] text-white" : "text-[#607080] hover:bg-white hover:text-[#17324D]")}>Back</button>
                    </div>
                    <div className="inline-flex min-h-10 items-center rounded-xl border border-[#DCE3EA] bg-[#F7F9FB] p-1" aria-label="Garment view size controls">
                      <button type="button" onClick={() => setPreviewZoom((value) => clampPreview(value - .1))} className="grid h-8 w-8 place-items-center rounded-lg text-[#607080] transition hover:bg-white hover:text-[#17324D]" aria-label="Make garment view smaller"><ZoomOut size={14}/></button>
                      <span className="w-11 text-center font-mono text-[10px] font-bold tabular-nums text-[#52616F]">{Math.round(previewZoom * 100)}%</span>
                      <button type="button" onClick={() => setPreviewZoom((value) => clampPreview(value + .1))} className="grid h-8 w-8 place-items-center rounded-lg text-[#607080] transition hover:bg-white hover:text-[#17324D]" aria-label="Make garment view larger"><ZoomIn size={14}/></button>
                      <button type="button" onClick={() => setPreviewZoom(1)} className="ml-1 h-8 rounded-lg border-l border-[#DCE3EA] px-2 text-[9px] font-bold uppercase tracking-wide text-[#607080] hover:bg-white hover:text-[#17324D]">Fit</button>
                      <button type="button" onClick={() => setPreviewZoom(1.18)} className="h-8 rounded-lg px-2 text-[9px] font-bold uppercase tracking-wide text-[#607080] hover:bg-white hover:text-[#17324D]">Default</button>
                    </div>
                    <button type="button" aria-pressed={showGuides} onClick={() => setShowGuides((value) => !value)} className={"inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold " + (showGuides ? "border-[#17324D] bg-[#17324D] text-white" : "border-[#DCE3EA] bg-white text-[#607080]")}><Maximize2 size={14}/> Print area {showGuides ? "on" : "off"}</button>
                    <button type="button" aria-pressed={showMeasurements} onClick={() => setShowMeasurements((value) => !value)} className={"inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold " + (showMeasurements ? "border-[#A66331] bg-[#A66331] text-white" : "border-[#DCE3EA] bg-white text-[#607080]")}><Ruler size={14}/> Measurements {showMeasurements ? "on" : "off"}</button>
                    {selectedPhotoLayer && <button type="button" onClick={() => deleteEditorLayer(selectedPhotoLayer.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#D9273E]/30 bg-[#D9273E]/[.06] px-3 py-2 text-[11px] font-bold text-[#B91C31] transition hover:bg-[#D9273E]/10" aria-label={`Remove selected photo from ${previewSide} fabric`}><Trash2 size={14}/> Remove photo</button>}
                  </>}
                  {draftReady && product?.id && <span className={"inline-flex rounded-full border px-2 py-1 font-mono text-[7px] uppercase tracking-wide sm:px-2.5 sm:text-[8px] " + (draftStatus === "error" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[#D5DDE4] bg-[#F8FAFC] text-[#61707D]")} role="status">
                    {draftStatus === "saving" ? "Saving…" : draftStatus === "error" ? "Autosave issue" : draftRestored ? "Draft restored · Saved ✓" : "Saved ✓"}
                  </span>}
                  <button type="button" onClick={() => setFullscreenPreview(true)} className="h-9 w-9 grid place-items-center rounded-xl border border-[#ddd6cc] bg-white text-[#5d5851] hover:border-accent hover:text-accent" aria-label="Open full screen preview"><Maximize2 size={15} /></button>
                </div>
              </div>

              <StudioPreview
                garment={garment}
                color={previewColor}
                side={previewSide}
                fillCanvas={designPath === "bootleg"}
                placement={placement}
                photo={previewArtworkPhoto}
                uploading={uploading}
                personalization={personalization}
                editorLayers={editorLayers}
                stickerLibrary={stickerLibrary}
                photoAssets={photos}
                selectedEditorLayerId={selectedEditorLayerId}
                onSelectEditorLayer={setSelectedEditorLayerId}
                onPatchEditorLayer={patchEditorLayer}
                onEditorDragStart={checkpointEditor}
                interactiveEditor={step === 3}
                onArtworkDragStart={checkpointEditor}
                zoom={previewZoom}
                setZoom={setPreviewZoom}
                artworkScale={artworkScale}
                artworkStretchX={artworkStretchX}
                artworkStretchY={artworkStretchY}
                artworkRotation={artworkRotation}
                artworkOffset={artworkOffset}
                setArtworkOffset={setArtworkOffset}
                artworkFitMode={artworkFitMode}
                showGuides={showGuides}
                showMeasurements={showMeasurements}
                size={size}
                previewConfig={config.preview || {}}
                styleTemplate={activePreviewTemplate}
                mood={designMood}
              />

              <div className="p-4 border-t border-[#ebe5dc] bg-[#FFFFFF]">
                {step === 3 && <AdvancedEditorPanel
                  designPath={designPath}
                  designIntensity={designIntensity}
                  onChooseIntensity={setDesignIntensity}
                  previewSide={previewSide}
                  onPreviewSideChange={setPreviewSide}
                  frontBackEnabled={frontBackEnabled}
                  previewZoom={previewZoom}
                  onPreviewZoomChange={setPreviewZoom}
                  showGuides={showGuides}
                  onToggleGuides={() => setShowGuides((value) => !value)}
                  showMeasurements={showMeasurements}
                  onToggleMeasurements={() => setShowMeasurements((value) => !value)}
                  viewGuidance={activePreviewTemplate ? "GDP template is locked on this side. Drag, resize and rotate only customer-added content inside the print guide; lettering stays editable." : designStyle === NO_TEMPLATE_STYLE ? "Blank canvas selected. Add and edit your own photos, lettering and stickers inside the print guide." : previewSide === "back" ? "Back print is independent. Choose a back template or add your own photos and lettering without changing the front." : "Move and resize your uploaded artwork inside the print guide. Aspect ratio stays constrained by default."}
                  sideStatus={activeSideHasPrint ? `${previewSide === "front" ? "Front" : "Back"} artwork is saved independently.${previewSide === "back" && placement === "front_back" ? " Additional print charge applies." : ""}` : `${previewSide === "front" ? "Front" : "Back"} is blank until you add artwork.`}
                  canCopyFrontToBack={previewSide === "back" && !(editorLayersBySide.back || []).length && (editorLayersBySide.front || []).length > 0}
                  onCopyFrontToBack={copyFrontDesignToBack}
                  legacyArtworkActive={Boolean(previewArtworkPhoto && activeSideHasPrint && designPath !== "bootleg" && !editorLayers.some((layer) => layer.type === "photo"))}
                  artworkScale={artworkScale}
                  onArtworkScaleChange={setArtworkScale}
                  artworkRotation={artworkRotation}
                  onArtworkRotationChange={setArtworkRotation}
                  artworkFitMode={artworkFitMode}
                  onArtworkFitModeChange={setArtworkFitMode}
                  artworkConstrainRatio={artworkConstrainRatio}
                  onArtworkConstrainRatioChange={setArtworkConstrainRatio}
                  artworkStretchX={artworkStretchX}
                  onArtworkStretchXChange={setArtworkStretchX}
                  artworkStretchY={artworkStretchY}
                  onArtworkStretchYChange={setArtworkStretchY}
                  artworkSourcePhotoIndex={Number(activeArtworkState.sourcePhotoIndex || 0)}
                  onArtworkSourcePhotoIndexChange={setArtworkSourcePhotoIndex}
                  onArtworkTransformStart={checkpointEditor}
                  allowFreeStretch={designPath === "upload" && editorTools.freeStretch !== false}
                  pathLabel={designPath === "memorial" ? "Memorial Tribute Editor" : designPath === "bootleg" ? "Photo Bootleg Editor" : designPath === "upload" ? "Artwork Editor" : "GDP Personalization Editor"}
                  designOptions={matchingStyleOptions}
                  designStyle={designStyle}
                  blankStyleName={NO_TEMPLATE_STYLE}
                  onChooseStyle={chooseStyleTemplate}
                  onChooseBlank={designPath !== "upload" ? chooseNoTemplate : undefined}
                  moodOptions={designPath !== "upload" ? MOODS : []}
                  designMood={designMood}
                  onChooseMood={setDesignMood}
                  moodDescription={designMood ? moodPreviewTreatment(designMood).description : ""}
                  personalization={personalization}
                  onChangePersonalization={(patch) => setPersonalization((current) => ({ ...current, ...patch }))}
                  memorialNameConfirmed={memorialNameConfirmed}
                  onMemorialNameConfirmedChange={setMemorialNameConfirmed}
                  onUploadFiles={uploadFiles}
                  uploading={uploading}
                  uploadProgress={uploadProgress}
                  uploadWarning={warn}
                  maxPhotos={maxPhotos}
                  uploadLimitMb={MAX_MB}
                  enabledTools={editorTools}
                  stickerLibrary={stickerLibrary}
                  editorLayers={editorLayers}
                  photoAssets={photos}
                  selectedLayerId={selectedEditorLayerId}
                  onSelectLayer={setSelectedEditorLayerId}
                  onAddText={addTextLayer}
                  onAddPhoto={addPhotoLayer}
                  onAddSticker={addStickerLayer}
                  onPatchLayer={patchEditorLayer}
                  onDuplicateLayer={duplicateEditorLayer}
                  onDeleteLayer={deleteEditorLayer}
                  onMoveLayer={moveEditorLayer}
                  onResetLayer={resetEditorLayer}
                  onUndo={undoEditor}
                  onRedo={redoEditor}
                  canUndo={editorHistoryVersion >= 0 && editorHistoryRef.current.length > 0}
                  canRedo={editorHistoryVersion >= 0 && editorRedoRef.current.length > 0}
                  onOpenPhotoEditor={() => setPhotoBrushOpen(true)}
                  onResetPhoto={resetActivePhoto}
                  onDeletePhoto={deleteActivePhoto}
                  onTogglePhotoBackground={togglePhotoBackgroundById}
                  onResetAll={resetAllEditable}
                  hasPhoto={Boolean(selectedPhotoAsset)}
                  templateName={(designPath === "bootleg" || designPath === "memorial") ? activeStyleTemplate?.name || "" : ""}
                  outsideWarning={editorOutsideWarning}
                />}
              </div>
            </div>

            <div className="rounded-[22px] border border-[#ddd6cc] bg-[#17212B] text-white p-5 shadow-[0_14px_40px_rgba(20,18,16,.11)]">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Your order</div>
              <div className="font-display text-3xl mt-2">{orderDesignStyle ? orderDesignStyle.replace(/^GDP\s+/, "") : "Build your order"}</div>
              <SummaryRow label="Front" value={printSummaryForSide("front")} />
              <SummaryRow label="Back" value={printSummaryForSide("back")} />
              <SummaryRow label="Garment" value={product?.name || "Not selected"} />
              <SummaryRow label="Size / Color" value={size && color ? `${size} / ${color}` : "Not selected"} />
              <SummaryRow label="Photos" value={photos.length + "/" + maxPhotos} />
              <SummaryRow label="Total shirts" value={totalUnits} />
              <SummaryRow label="Production file" value="Locked after approval" />
              {showOrderPrice && <div className="border-t border-white/15 mt-5 pt-4 flex justify-between items-end"><span className="text-[10px] uppercase font-mono text-white/45">{priceVisibility === "total" ? "Estimated subtotal" : "Unit price"}</span><span className="font-display text-3xl">{"$" + (priceVisibility === "total" ? estimatedSubtotal : unitPrice).toFixed(2)}</span></div>}
            </div>
          </aside>
      </div>

        {mobileFloatingCtaEnabled && mobileDockVisible && <div className="md:hidden fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl border border-white/10 bg-[#17324D]/95 backdrop-blur-xl text-white p-2 pl-3 shadow-2xl flex items-center justify-between gap-3">
          <div><div className="font-mono text-[8px] uppercase tracking-widest text-white/45">Custom piece</div><div className="font-display text-xl leading-none mt-1">{showOrderPrice ? "$" + (priceVisibility === "total" ? estimatedSubtotal : unitPrice).toFixed(2) : "GDP Studio"}</div></div>
          {step < STEPS.length ? <button onClick={handleContinue} aria-disabled={!canContinue()} className={"rounded-xl bg-white px-4 py-2.5 text-xs font-bold uppercase text-[#17324D] transition " + (!canContinue() ? "opacity-70" : "")}>Continue →</button> : <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="rounded-xl bg-accent text-white px-4 py-2.5 text-xs font-bold uppercase disabled:opacity-40">{saving ? "Saving…" : "Add to cart →"}</button>}
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
              <p className="mt-3 text-[10px] leading-relaxed text-[#817970]">These examples explain visual density. Your selected ready layout and exact live preview determine the final print.</p>
            </div>
          </div>
        </div>}

        <div className="pointer-events-none fixed left-[-10000px] top-0 w-[500px]" aria-hidden="true">
          {(["front", "back"]).map((side) => {
            const state = artworkStates[side] || defaultArtworkState(activeStyleTemplate);
            return <StudioPreview
              key={side}
              containerId={`gdp-mockup-${side}`}
              printAreaId={`gdp-production-${side}`}
              garment={garment}
              color={previewColor}
              side={side}
              placement={placement}
              photo={side === "front" ? frontArtworkPhoto : backArtworkPhoto}
              personalization={personalization}
              editorLayers={editorLayersBySide[side] || []}
              stickerLibrary={stickerLibrary}
              photoAssets={photos}
              interactiveEditor={false}
              zoom={1}
              artworkScale={Number(state.scale ?? 92)}
              artworkStretchX={Number(state.stretchX ?? 100)}
              artworkStretchY={Number(state.stretchY ?? 100)}
              artworkRotation={Number(state.rotation ?? 0)}
              artworkOffset={state.offset || { x: 0, y: 0 }}
              artworkFitMode={state.fitMode || "fit"}
              showGuides={false}
              showMeasurements={false}
              size={size}
              previewConfig={config.preview || {}}
              styleTemplate={styleTemplateForSide(side)}
              mood={designMood}
            />;
          })}
        </div>

        <PhotoBrushEditor
          open={photoBrushOpen}
          photo={selectedPhotoAsset}
          tools={editorTools}
          onClose={() => setPhotoBrushOpen(false)}
          onApply={applyPhotoBrushEdit}
        />

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
              <StudioPreview garment={garment} color={previewColor} side={previewSide} placement={placement} photo={previewArtworkPhoto} uploading={uploading} personalization={personalization} editorLayers={editorLayers} stickerLibrary={stickerLibrary} photoAssets={photos} selectedEditorLayerId={selectedEditorLayerId} onSelectEditorLayer={setSelectedEditorLayerId} onPatchEditorLayer={patchEditorLayer} onEditorDragStart={checkpointEditor} interactiveEditor={step === 3} onArtworkDragStart={checkpointEditor} zoom={previewZoom} setZoom={setPreviewZoom} artworkScale={artworkScale} artworkStretchX={artworkStretchX} artworkStretchY={artworkStretchY} artworkRotation={artworkRotation} artworkOffset={artworkOffset} setArtworkOffset={setArtworkOffset} artworkFitMode={artworkFitMode} showGuides={showGuides} showMeasurements={showMeasurements} size={size} previewConfig={config.preview || {}} styleTemplate={activePreviewTemplate} mood={designMood} fullscreen />
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
  return Math.min(2, Math.max(0.7, Number(Number(value).toFixed(2))));
}

export function StudioPreview({ garment, color, side, placement, photo, uploading = false, personalization, editorLayers = [], stickerLibrary = [], photoAssets = [], selectedEditorLayerId = "", onSelectEditorLayer = null, onPatchEditorLayer = null, onEditorDragStart = null, interactiveEditor = false, onArtworkDragStart = null, zoom, setZoom = null, artworkScale, artworkStretchX = 100, artworkStretchY = 100, artworkRotation, artworkOffset, setArtworkOffset = null, artworkFitMode = "crop", showGuides, showMeasurements, size, previewConfig = {}, styleTemplate, mood = "", fullscreen = false, fillCanvas = false, seasonalOverlay = null, containerId = "", printAreaId = "" }) {
  const dragRef = useRef(null);
  const viewPanRef = useRef(null);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [failedMockupUrl, setFailedMockupUrl] = useState("");
  const blankArtwork =
    (side === "back" && placement === "front") ||
    (side === "front" && placement === "back");
  const hasPreviewText = Boolean(
    String(personalization?.name || "").trim() ||
    String(personalization?.nickname || "").trim() ||
    String(personalization?.dates || "").trim() ||
    String(personalization?.number || "").trim() ||
    String(personalization?.quote || "").trim() ||
    String(personalization?.message || "").trim()
  );
  // Protected-template photos are independent editable layers. The legacy artwork drag
  // remains only for Upload My Own Artwork and older saved designs.
  const hasEditablePhotoLayers = editorLayers.some((layer) => layer?.type === "photo" && layer?.visible !== false);
  const canDrag = Boolean(photo && !hasEditablePhotoLayers && !blankArtwork && setArtworkOffset);
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
  const showMockup = Boolean(mockupUrl && failedMockupUrl !== mockupUrl);
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
    height: "auto",
    aspectRatio: `${profile.widthIn} / ${profile.heightIn}`,
  };
  const maxAreaWidth = Math.min(78, printArea.width * (configuredNumber(profile.maxWidthIn, profile.widthIn) / Math.max(0.1, profile.widthIn)));
  const maxPrintAreaStyle = {
    top: printArea.top + "%",
    width: maxAreaWidth + "%",
    height: "auto",
    aspectRatio: `${profile.maxWidthIn || profile.widthIn} / ${profile.maxHeightIn || profile.heightIn}`,
  };
  const artworkLayerStyle = {
    left: (50 + Number(artworkOffset?.x || 0)) + "%",
    top: (50 + Number(artworkOffset?.y || 0)) + "%",
    transform: `translate(-50%, -50%) scale(${artworkScale / 100}) scaleX(${Number(artworkStretchX || 100) / 100}) scaleY(${Number(artworkStretchY || 100) / 100}) rotate(${artworkRotation}deg)`,
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
    onSelectEditorLayer?.("photo");
    onArtworkDragStart?.();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { x: event.clientX, y: event.clientY, startX: artworkOffset.x, startY: artworkOffset.y, width: rect.width, height: rect.height };
  };
  const onPointerMove = (event) => {
    if (!dragRef.current || !canDrag) return;
    const start = dragRef.current;
    const clamp = (v) => Math.min(42, Math.max(-42, v));
    const snapCenter = (value) => Math.abs(value) <= 2.4 ? 0 : value;
    setArtworkOffset({
      x: snapCenter(clamp(start.startX + ((event.clientX - start.x) / Math.max(1, start.width)) * 100)),
      y: snapCenter(clamp(start.startY + ((event.clientY - start.y) / Math.max(1, start.height)) * 100))
    });
  };
  const stopDrag = () => { dragRef.current = null; };
  const onWheel = (event) => {
    // Normal page scrolling must never resize the garment preview. Keep wheel
    // zoom available as an intentional Ctrl/Cmd gesture only.
    if (!setZoom || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    setZoom(value => clampPreview(value + (event.deltaY < 0 ? .08 : -.08)));
  };

  useEffect(() => {
    setViewPan({ x: 0, y: 0 });
  }, [side]);

  useEffect(() => {
    if (Number(zoom || 1) <= 1) setViewPan({ x: 0, y: 0 });
  }, [zoom]);

  const canPanView = Boolean(interactiveEditor && Number(zoom || 1) > 1);
  const beginViewPan = (event) => {
    const target = event.target;
    const insidePrintArea = typeof Element !== "undefined" && target instanceof Element && target.closest('[data-gdp-print-area="true"]');
    if (!canPanView || insidePrintArea) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    viewPanRef.current = {
      x: event.clientX,
      y: event.clientY,
      startX: Number(viewPan.x || 0),
      startY: Number(viewPan.y || 0),
    };
  };
  const moveViewPan = (event) => {
    if (!canPanView || !viewPanRef.current) return;
    const start = viewPanRef.current;
    const limit = Math.max(40, Math.round((Number(zoom || 1) - 1) * 240));
    const clampPan = (value) => Math.min(limit, Math.max(-limit, value));
    setViewPan({
      x: clampPan(start.startX + event.clientX - start.x),
      y: clampPan(start.startY + event.clientY - start.y),
    });
  };
  const endViewPan = (event) => {
    if (!viewPanRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    viewPanRef.current = null;
  };

  return <div id={containerId} data-gdp-studio-preview={interactiveEditor ? "live" : undefined} onWheel={onWheel} className={"relative overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#fffdf8_0%,#eee7dc_68%,#e4dbcf_100%)] " + (fullscreen ? "h-full" : "h-[370px] sm:h-[430px]")}>
    <div className="absolute inset-x-0 top-3 z-30 text-center pointer-events-none"><span className="rounded-full border border-[#ddd6cc] bg-white/80 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-[#817b71]">{side} view</span></div>

    {showMeasurements && <div className="absolute left-3 top-11 z-30 max-w-[238px] rounded-xl border border-[#d8d2c8] bg-white/90 backdrop-blur px-3 py-2.5 shadow-sm pointer-events-none">
      <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-accent">{side === "back" ? "Back print guide" : "Front print guide"} · {size || "—"}</div>
      <div className="mt-1 text-[10px] font-bold text-[#292621]">Recommended · {measurementPair(profile.widthIn, profile.heightIn)}</div>
      <div className="mt-1 text-[8px] font-semibold text-[#6f6a63]">Maximum safe area · {measurementPair(profile.maxWidthIn, profile.maxHeightIn)}</div>
      <div className="mt-1 text-[8px] leading-relaxed text-[#625c54]">{profile.placementLabel} · ↓ {measurementSingle(profile.collarIn)} from {String(garment?.previewType || garment?.type || "").toLowerCase().includes("hoodie") ? "hood seam" : "collar"}</div>
      {configuredGuide?.sizeScalingEnabled !== false && <div className="mt-1 text-[8px] text-[#7a746c]">Size-aware preset is active for {size || "this size"}.</div>}
      {profile.bottomClearanceIn && <div className="mt-1 text-[8px] font-semibold text-[#8a514b]">Keep ≥ {measurementSingle(profile.bottomClearanceIn)} above pocket.</div>}
    </div>}

    <div
      onPointerDown={beginViewPan}
      onPointerMove={moveViewPan}
      onPointerUp={endViewPan}
      onPointerCancel={endViewPan}
      className={"absolute inset-0 grid place-items-center " + (canPanView ? "cursor-grab active:cursor-grabbing touch-none" : "transition-transform duration-200")}
      style={{ transform: `translate3d(${viewPan.x}px, ${viewPan.y}px, 0) scale(${Number(zoom || 1)})` }}
    >
      <div
        className={"relative " + (fullscreen ? "w-[min(55vh,520px)]" : fillCanvas ? "h-[86%] w-auto max-w-[94%] sm:h-[96%] sm:max-w-[98%] lg:h-[103%] lg:max-w-[104%]" : "h-[82%] w-auto max-w-[90%]")}
        style={{ aspectRatio: `${previewCanvas.width} / ${previewCanvas.height}` }}
      >
        {showMockup ? (
          <img
            src={mockupUrl}
            alt={(garment?.label || "Custom garment") + " " + side + " mockup"}
            className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,.18)]"
            style={mockupLayerStyle}
            draggable="false"
            onError={() => setFailedMockupUrl(mockupUrl)}
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
          id={printAreaId}
          data-gdp-print-area="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          style={printAreaStyle}
          className={"absolute left-1/2 -translate-x-1/2 overflow-hidden select-none touch-none " + (showGuides ? " border border-dashed border-accent/65 bg-white/[0.03]" : "") + (canDrag ? " cursor-grab active:cursor-grabbing" : "")}
        >
          {seasonalOverlay || (blankArtwork ? (
            <div className="absolute inset-0 grid place-items-center text-center px-2 text-[8px] uppercase tracking-wide text-[#8b847a]">No {side} print selected</div>
          ) : !styleTemplate ? (
            photo && !hasEditablePhotoLayers ? (
              artworkFitMode === "crop" ? (
                <div className="absolute h-full w-full pointer-events-none" style={artworkLayerStyle}>
                  <img src={photo.url} alt="Customer print artwork" draggable="false" className="h-full w-full object-cover pointer-events-none" style={{ filter: moodTreatment.photoFilter }} />
                </div>
              ) : (
                <img src={photo.url} alt="Customer print artwork" draggable="false" className="absolute max-h-full max-w-full object-contain pointer-events-none" style={{ ...artworkLayerStyle, filter: moodTreatment.photoFilter }} />
              )
            ) : null
          ) : (
            <>
              {template?.assetUrl && (
                <img
                  key={template.id}
                  src={template.assetUrl}
                  alt={template.name + " locked artwork"}
                  draggable="false"
                  className="absolute inset-0 z-10 h-full w-full object-contain pointer-events-none transition-[filter,opacity] duration-200"
                  style={{ filter: moodTreatment.templateFilter }}
                />
              )}

              {photo && !hasEditablePhotoLayers ? (
                artworkFitMode === "crop" ? (
                  <div className="absolute inset-0 z-20 pointer-events-none" style={artworkLayerStyle}>
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
                    className="absolute z-20 max-h-full max-w-full object-contain pointer-events-none transition-[filter] duration-200"
                    style={{ ...artworkLayerStyle, filter: moodTreatment.photoFilter }}
                  />
                )
              ) : (
                <div className={"absolute z-20 overflow-hidden transition-all duration-200 " + (showGuides ? "ring-1 ring-white/35" : "")} style={photoZoneStyle}>
                  <div className="absolute inset-0 grid place-items-center rounded-[inherit] border border-dashed border-white/45 bg-[#17324D]/[0.08] text-center px-3 pointer-events-none">
                    <div>
                      <Upload size={16} className="mx-auto text-white/85 drop-shadow"/>
                      <div className="mt-1 text-[6px] font-bold uppercase tracking-[0.14em] text-white/90 drop-shadow">Photo goes here</div>
                    </div>
                  </div>
                </div>
              )}

              {hasPreviewText && (
                <div
                  className={"absolute z-30 grid content-center px-2 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,.75)] " + (textZone?.tone === "dark" ? "text-[#26211d]" : "text-white")}
                  style={textZoneStyle}
                >
                  <div className={textZone?.align === "left" ? "text-left" : textZone?.align === "right" ? "text-right" : "text-center"}>
                    {personalization?.name && <div className="font-display text-sm leading-none uppercase tracking-wide">{personalization.name}</div>}
                    {personalization?.nickname && <div className="text-[7px] font-bold uppercase tracking-wider mt-0.5">{personalization.nickname}</div>}
                    {(personalization?.dates || personalization?.number) && <div className="font-mono text-[6px] mt-0.5">{[personalization.dates, personalization.number].filter(Boolean).join(" · ")}</div>}
                    {personalization?.quote && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.quote}</div>}
                    {personalization?.message && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.message}</div>}
                  </div>
                </div>
              )}

            </>
          ))}

          {!seasonalOverlay && !blankArtwork && <EditableOverlayLayers
            layers={editorLayers}
            stickerLibrary={stickerLibrary}
            photoAssets={photoAssets}
            interactive={interactiveEditor}
            selectedLayerId={selectedEditorLayerId}
            onSelectLayer={onSelectEditorLayer}
            onPatchLayer={onPatchEditorLayer}
            onDragStart={onEditorDragStart}
          />}
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
      {!blankArtwork && !seasonalOverlay && <span className="rounded-xl border border-[#d8d2c8] bg-white/80 backdrop-blur px-2.5 py-1.5 text-[9px] uppercase tracking-wide text-[#817b71] inline-flex items-center gap-1">{canPanView ? <><Move size={10}/> Drag canvas to pan</> : photo ? <><Move size={10}/> Drag editable layer</> : <><Sparkles size={10}/> {template?.name?.replace("GDP ","") || "Own artwork"} · {mood || "Original"}</>}</span>}
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

function StudioStepNav({ step, totalSteps, canContinue, hint, saving, finalDisabled, onPrevious, onContinue, onFinal, compact = false }) {
  const isFinal = step >= totalSteps;
  const disabled = isFinal ? saving || finalDisabled : !canContinue;
  return <div data-gdp-step-nav={compact ? "mobile" : "desktop"} className={"gdp-studio-step-nav rounded-2xl border border-[#DCE3EA] bg-white shadow-sm " + (compact ? "px-3 py-3" : "px-3 py-2.5")}>
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={onPrevious} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCE3EA] bg-white px-4 py-2.5 text-xs font-bold uppercase text-[#17324D] transition hover:border-[#9fb0c0]"><ArrowLeft size={16}/>{step === 1 ? "Back" : "Previous"}</button>
      <button
        type="button"
        disabled={isFinal ? disabled : false}
        aria-disabled={!isFinal && !canContinue}
        onClick={isFinal ? onFinal : onContinue}
        className={"inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold uppercase text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 " + (isFinal ? "bg-accent" : "bg-[#17324D]")}
      >
        {isFinal ? (saving ? "Generating…" : "Approve & add") : "Continue"} <ArrowRight size={16}/>
      </button>
    </div>
    {!isFinal && !canContinue && hint && <p className="mt-2 text-right text-[11px] font-medium text-[#8A5A48]" role="status">{hint}</p>}
  </div>;
}

function StepTitle({ eyebrow, title, text }) {
  return <div className="mb-7"><div className="font-mono text-[9px] uppercase tracking-[0.22em] text-accent">{eyebrow}</div><h2 className="font-display text-4xl md:text-5xl leading-none mt-1.5 text-[#1d1b18]">{title}</h2><p className="text-sm text-[#716b63] mt-2.5 max-w-2xl leading-relaxed">{text}</p></div>;
}
function Field({ label, value, onChange, placeholder }) {
  return <div className="mt-4"><label className="font-mono text-[10px] uppercase tracking-wide text-[#756f67]">{label}</label><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-[#dcd5cc] bg-white/70 px-3.5 py-3 mt-1.5 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"/></div>;
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
function PhotoProcessingCard({ task }) {
  const needsAttention = task.stage === "failed" || task.stage === "needs_attention";
  const isReady = task.stage === "ready";
  return <div className={"rounded-2xl border bg-white relative overflow-hidden shadow-sm " + (needsAttention ? "border-amber-300" : "border-[#ddd6cc]")}>
    <div className="relative aspect-square overflow-hidden bg-[#f1eee9]">
      <img src={task.previewUrl} alt={task.name || "Photo being prepared"} className="h-full w-full object-contain opacity-80" />
      <div className="absolute inset-x-2 bottom-2 rounded-xl border border-white/40 bg-[#17324D]/90 px-2.5 py-2 text-white shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-2 text-[8px] font-bold uppercase tracking-wide">
          <span className="truncate">{task.message || "Preparing photo…"}</span>
          <span>{Math.round(Number(task.progress || 0))}%</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${Math.max(4, Math.min(100, Number(task.progress || 0)))}%` }} /></div>
      </div>
    </div>
    <div className="p-3">
      <div className="truncate text-[10px] font-semibold text-[#17324D]">{task.name}</div>
      <div className={"mt-1 text-[9px] font-bold uppercase " + (needsAttention ? "text-amber-800" : isReady ? "text-green-700" : "text-[#65717d]")}>{needsAttention ? "Needs attention" : isReady ? "Ready ✓" : "Processing safely"}</div>
    </div>
  </div>;
}

function PhotoCard({ photo, onPrimary, onRemove, onToggleBackground, onRetry }) {
  const qClass = photo.quality === "excellent" ? "text-green-600" : photo.quality === "usable" ? "text-amber-600" : "text-destructive";
  const qLabel = photo.quality === "excellent" ? "Great quality" : photo.quality === "usable" ? "May look slightly soft" : "Low resolution";
  return <div className="rounded-2xl border border-[#ddd6cc] bg-white relative overflow-hidden shadow-sm">
    <div className="aspect-square overflow-hidden bg-[linear-gradient(45deg,#f0ede8_25%,transparent_25%),linear-gradient(-45deg,#f0ede8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0ede8_75%),linear-gradient(-45deg,transparent_75%,#f0ede8_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0px]"><img src={photo.url} alt={photo.name} className="w-full h-full object-contain"/></div>
    <button onClick={onRemove} className="absolute top-2 right-2 rounded-lg bg-white/90 p-1.5 shadow-sm" aria-label="Remove photo"><X size={13}/></button>
    {photo.backgroundRemoved && <span className="absolute left-2 top-2 rounded-full bg-[#17324D]/90 px-2 py-1 text-[8px] font-bold uppercase text-white">BG removed</span>}
    <div className="p-3">
      <button onClick={onPrimary} className={"text-[9px] uppercase font-mono flex items-center gap-1 " + (photo.isPrimary ? "text-accent" : "text-[#7c766e]")}><Star size={12} className={photo.isPrimary ? "fill-accent" : ""}/>{photo.isPrimary ? "Primary photo" : "Make primary"}</button>
      {photo.cleanedUrl && <button type="button" onClick={onToggleBackground} className="mt-2 text-[9px] font-bold uppercase text-[#17324D] hover:text-accent">{photo.backgroundRemoved ? "Restore original background" : "Use removed background"}</button>}
      {photo.processingStatus === "processing" && <div className="mt-2 text-[9px] font-bold uppercase text-[#17324D]">Removing background…</div>}
      {photo.processingStatus === "removed" && <div className="mt-2 text-[9px] font-bold uppercase text-green-700">Background removed ✓</div>}
      {photo.processingStatus === "failed" && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[9px] leading-relaxed text-amber-900"><div>{photo.processingMessage || "Background removal failed. The rectangular original was not placed on the garment."}</div><button type="button" onClick={onRetry} className="mt-1 font-bold uppercase underline">Retry removal</button><span className="mx-1">·</span><span>Use Refine manually to erase/restore.</span></div>}
      <div className={"mt-1.5 text-[9px] uppercase font-mono " + qClass}>{qLabel}</div>
      <div className="text-[9px] text-[#8a847c]">{photo.width}×{photo.height}</div>
    </div>
  </div>;
}
