import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Upload, X, Star, Users, Heart, PawPrint, Trophy, Gift, Sparkles, ShieldCheck, AlertTriangle, Shirt, Plus, Minus, Eye, Maximize2, Move, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { customerApi } from "@/lib/customerApi";
import { useCart } from "@/lib/CartContext";

const OCCASIONS = [
  { id: "love", label: "Love & Relationships", icon: Heart, options: ["Anniversary","Boyfriend","Girlfriend","Husband","Wife","Valentine's","Couple"] },
  { id: "family", label: "Family", icon: Users, options: ["Mom","Dad","Grandma","Grandpa","Mother's Day","Father's Day","Family Reunion"] },
  { id: "pets", label: "Pets", icon: PawPrint, options: ["Dog","Cat","Multiple Pets","Pet Memorial","Pet Mom / Dad"] },
  { id: "sports", label: "Sports & School", icon: Trophy, options: ["Senior Night","Graduation","Football","Basketball","Volleyball","Baseball","Hockey","Dance / Cheer"] },
  { id: "events", label: "Life Events", icon: Gift, options: ["Birthday","Wedding","Bachelorette","Retirement","Vacation","Reunion"] },
  { id: "memorial", label: "Memorial", icon: Heart, options: ["In Loving Memory","Celebration of Life","Memorial Event"] },
  { id: "other", label: "Just Because", icon: Sparkles, options: ["Best Friend","Inside Joke","Funny Shirt","For Myself","Designer's Choice"] }
];

const STYLES = [
  ["GDP Classic 90s","Layered portraits, chrome type, clouds and full retro energy."],
  ["GDP Y2K","Metallic type, stars, glow effects and early-2000s attitude."],
  ["GDP Vintage Wash","Muted colors, distressed graphics and old-photo texture."],
  ["GDP Sports Hype","Player portraits, number, team colors and season highlights."],
  ["GDP Memorial","Respectful composition with names, dates and meaningful text."],
  ["GDP Love Story","Couple-focused composition for anniversaries and gifts."],
  ["GDP Pet Legend","Bold pet portraits, names and playful personality."],
  ["GDP Minimal","Cleaner layout, fewer photos and quieter typography."],
  ["GDP Designer's Choice","Tell us the story and let a GDP designer choose the direction."]
];

const FALLBACK_GARMENT = {
  type: "T-Shirt",
  label: "Classic Tee",
  tier: "classic",
  price: 34.99,
  desc: "Traditional everyday fit."
};

const DEFAULT_COLOR_SWATCHES = {
  "Black": "#171717",
  "Vintage Black": "#292929",
  "White": "#f7f6f1",
  "Sport Grey": "#b7b8b3",
  "Charcoal": "#4b4c4e",
  "Dark Heather": "#414347",
  "Navy": "#17243b",
  "Red": "#b52332",
  "Royal": "#2857a6",
  "Sand": "#d5c1a0",
  "Forest": "#294a39",
  "Pink": "#eeb1c8",
  "Full Color": "#dadada"
};

function uniqueValues(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function productColors(product) {
  if (!product) return [];
  const variantColors = uniqueValues((product.variants || []).map((variant) => variant.color));
  return variantColors.length ? variantColors : uniqueValues(product.colors || []);
}

function productSizes(product, color = "") {
  if (!product) return [];
  const variants = product.variants || [];
  const matching = color
    ? variants.filter((variant) => String(variant.color || "").toLowerCase() === String(color).toLowerCase())
    : variants;
  const variantSizes = uniqueValues(matching.map((variant) => variant.size));
  return variantSizes.length ? variantSizes : uniqueValues(product.sizes || []);
}

function variantFor(product, color, size) {
  if (!product?.variants?.length) return null;
  return product.variants.find((variant) =>
    String(variant.color || "").toLowerCase() === String(color || "").toLowerCase() &&
    String(variant.size || "").toLowerCase() === String(size || "").toLowerCase()
  ) || null;
}

function variantAvailable(product, variant) {
  if (!product?.variants?.length) return true;
  if (!variant) return false;
  if (product.trackInventory === false) return true;
  return Number(variant.stock || 0) > 0;
}

function garmentFromProduct(product) {
  if (!product) return FALLBACK_GARMENT;
  return {
    id: product.id,
    type: product.type || "T-Shirt",
    label: product.name || "Custom garment",
    tier: product.customization?.garmentTier || "classic",
    price: Number(product.price || 0),
    desc: product.description || "Choose your blank, color and size.",
    image: product.images?.[0] || ""
  };
}

function swatchFor(product, color) {
  return product?.customization?.preview?.colorSwatches?.[color] ||
    DEFAULT_COLOR_SWATCHES[color] ||
    "#8b8b8b";
}
const MOODS = ["Funny","Emotional","Cool","Romantic","Loud","Vintage","Elegant","Designer's choice"];
const STEPS = ["Garment","Occasion","Style","Photos","Personalize","Timing","Review"];
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
  const [occasionGroup, setOccasionGroup] = useState("love");
  const [occasion, setOccasion] = useState("Anniversary");
  const [recipientType, setRecipientType] = useState("");
  const [designStyle, setDesignStyle] = useState("GDP Classic 90s");
  const [designMood, setDesignMood] = useState("Cool");
  const [designIntensity, setDesignIntensity] = useState(4);
  const [garment, setGarment] = useState(FALLBACK_GARMENT);
  const [color, setColor] = useState("Black");
  const [size, setSize] = useState("M");
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
  const [artworkScale, setArtworkScale] = useState(92);
  const [artworkRotation, setArtworkRotation] = useState(0);
  const [artworkOffset, setArtworkOffset] = useState({ x: 0, y: 0 });
  const [showGuides, setShowGuides] = useState(true);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const productId = params.get("product");
        const studioCatalog = await customerApi.getStudioCatalog();
        let p = studioCatalog[0] || await customerApi.getDefaultCustomProduct();
        if (productId) {
          const requestedBlank = studioCatalog.find((item) => item.id === productId);
          if (requestedBlank) {
            p = requestedBlank;
          } else if (studioCatalog.length) {
            const legacyProduct = await customerApi.getProduct(productId);
            p = studioCatalog.find((item) => item.type === legacyProduct?.type) || studioCatalog[0];
          } else {
            p = await customerApi.getProduct(productId);
          }
        }

        if (!active) return;
        setCatalog(studioCatalog);
        if (!p) return;

        const colors = productColors(p);
        const initialColor = colors[0] || "Black";
        const sizes = productSizes(p, initialColor);
        setProduct(p);
        setGarment(garmentFromProduct(p));
        setColor(initialColor);
        setSize(sizes[0] || "M");
        setProofRequired(p?.customization?.proofRequired !== false);
        if (p?.customization?.allowedStyles?.length) setDesignStyle(p.customization.allowedStyles[0]);
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
    const nextColor = colors[0] || "Black";
    const sizes = productSizes(nextProduct, nextColor);
    setProduct(nextProduct);
    setGarment(garmentFromProduct(nextProduct));
    setColor(nextColor);
    setSize(sizes[0] || "M");
    setGroupGarments([]);
    setProofRequired(nextProduct?.customization?.proofRequired !== false);
    if (nextProduct?.customization?.allowedStyles?.length) {
      setDesignStyle(nextProduct.customization.allowedStyles[0]);
    }
    setPreviewSide("front");
    setArtworkScale(92);
    setArtworkRotation(0);
    setArtworkOffset({ x: 0, y: 0 });
    setPreviewZoom(1);
  };

  const config = product?.customization || {};
  const styleOptions = config.allowedStyles?.length ? STYLES.filter(style => config.allowedStyles.includes(style[0])) : STYLES;
  const maxPhotos = Number(config.maxPhotos || 10);
  const minPhotos = Number(config.minPhotos || 1);
  const revisions = Number(config.includedRevisions || 2);
  const rushFee = Number(config.rushDesignFee || 10) + Number(config.rushProductionFee || 15);
  const frontBackFee = Number(config.frontBackFee || 10);
  const availableColors = productColors(product);
  const availableSizes = productSizes(product, color);
  const selectedVariant = variantFor(product, color, size);
  const selectedAvailable = variantAvailable(product, selectedVariant);

  useEffect(() => {
    if (availableSizes.length && !availableSizes.includes(size)) {
      setSize(availableSizes[0]);
    }
  }, [color, product?.id]);

  const extrasPerUnit = (placement === "front_back" ? frontBackFee : 0) + (priority === "rush" ? rushFee : 0);
  const priceFor = (itemColor, itemSize) => {
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

  const resetPreviewPlacement = () => {
    setArtworkScale(92);
    setArtworkRotation(0);
    setArtworkOffset({ x: 0, y: 0 });
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
  const removePhoto = index => setPhotos(prev => {
    const next = prev.filter((_, i) => i !== index);
    if (next.length && !next.some(p => p.isPrimary)) next[0] = { ...next[0], isPrimary: true };
    return next;
  });

  const addGroupGarment = () => setGroupGarments(prev => [...prev, { size, color, quantity: 1 }]);
  const updateGroup = (index, patch) => setGroupGarments(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  const removeGroup = index => setGroupGarments(prev => prev.filter((_, i) => i !== index));

  const canContinue = () => {
    if (step === 1) return Boolean(product) && selectedAvailable;
    if (step === 4) return photos.length >= minPhotos;
    if (step === 6) return rightsConfirmed && approvalAcknowledged;
    return true;
  };

  async function createAndAdd() {
    if (!rightsConfirmed || !approvalAcknowledged || photos.length < minPhotos) return;
    if (!product?.id) {
      setWarn("Choose a garment before adding your custom design to cart.");
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
            version: 2,
            side: previewSide,
            artworkScale,
            artworkRotation,
            artworkOffset,
            viewZoom: previewZoom,
            sourcePhotoIndex: Math.max(0, photos.findIndex(p => p.isPrimary)),
            garmentId: productId,
            variantId: selectedVariant?.id || null,
            conceptOnly: true
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

  const activeOccasion = OCCASIONS.find(group => group.id === occasionGroup) || OCCASIONS[0];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf8f2_0%,#f7f3ec_38%,#fbfaf7_100%)]">
      <div className="max-w-[1540px] mx-auto px-4 lg:px-8 py-6 md:py-10">
        <div className="relative overflow-hidden rounded-[28px] border border-[#e4ded4] bg-[linear-gradient(135deg,#fffdfa_0%,#f3ece2_100%)] px-5 py-7 md:px-9 md:py-9 mb-7 shadow-[0_20px_60px_rgba(32,28,22,.07)]">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/[0.06] blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <span className="font-mono text-[10px] md:text-xs uppercase tracking-[0.28em] text-accent">GDP Custom Studio</span>
              <h1 className="font-display text-5xl md:text-7xl leading-[.92] mt-2 text-[#171717]">MAKE IT PERSONAL</h1>
              <p className="text-[#69645d] max-w-2xl mt-3 leading-relaxed">Turn your favorite people, pets and memories into wearable art. Build the concept here, then a real GDP designer reviews it before production.</p>
            </div>
            <div className="inline-flex items-center gap-2 self-start lg:self-auto rounded-full border border-[#ded7cd] bg-white/75 px-3.5 py-2 text-[11px] font-semibold text-[#4f4b46] shadow-sm">
              <ShieldCheck size={15} className="text-accent" /> Designer review included
            </div>
          </div>
        </div>

        <div className="mb-7">
          <div className="md:hidden mb-3">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wide text-[#736d65]"><span>Step {step} of {STEPS.length}</span><span>{STEPS[step - 1]}</span></div>
            <div className="h-1.5 rounded-full bg-[#e8e1d7] mt-2 overflow-hidden"><div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${(step / STEPS.length) * 100}%` }} /></div>
          </div>
          <div className="hidden md:flex items-center gap-0 rounded-2xl border border-[#e3ddd4] bg-white/70 p-2 shadow-sm overflow-x-auto">
            {STEPS.map((label, index) => {
              const number = index + 1;
              const complete = step > number;
              const active = step === number;
              return <React.Fragment key={label}>
                <button onClick={() => number < step && setStep(number)} className={"group flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap transition " + (active ? "bg-[#171717] text-white shadow-sm" : complete ? "text-accent" : "text-[#8b857d]")}>
                  <span className={"grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold " + (active ? "border-white/30" : complete ? "border-accent/30 bg-accent/[0.06]" : "border-[#d8d2c9]")}>{complete ? <Check size={12} /> : number}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
                </button>
                {number < STEPS.length && <div className={"h-px min-w-5 flex-1 " + (complete ? "bg-accent/35" : "bg-[#ddd7cf]")} />}
              </React.Fragment>;
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)] gap-6 items-start">
          <section className="bg-[#fffdfa] border border-[#e2dcd3] rounded-[24px] p-5 md:p-8 min-h-[560px] shadow-[0_18px_50px_rgba(28,24,20,.055)]">
          {step === 2 && <div>
            <StepTitle eyebrow="Start with the reason" title="WHAT ARE YOU MAKING?" text="Choosing the occasion helps our designer understand the emotion and visual direction." />
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {OCCASIONS.map(group => {
                const Icon = group.icon;
                return <button key={group.id} onClick={() => { setOccasionGroup(group.id); setOccasion(group.options[0]); }} className={"rounded-2xl border p-4 text-left transition-all duration-200 " + (occasionGroup === group.id ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.06)]" : "border-[#ddd7ce] bg-white/55 hover:border-accent hover:-translate-y-0.5")}>
                  <Icon size={20} className="mb-3" /><div className="font-bold">{group.label}</div>
                </button>;
              })}
            </div>
            <div className="mt-6"><label className="font-mono text-xs uppercase text-muted-foreground">Occasion / recipient</label><div className="flex flex-wrap gap-2 mt-2">
              {activeOccasion.options.map(option => <button key={option} onClick={() => setOccasion(option)} className={"px-3 py-2 border text-sm " + (occasion === option ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{option}</button>)}
            </div></div>
            <Field label="Who is this for? (optional)" value={recipientType} onChange={setRecipientType} placeholder="Dad, Sarah, Coach Mike, Milo the dog…" />
          </div>}

          {step === 3 && <div>
            <StepTitle eyebrow="Choose the visual direction" title="PICK A GDP STYLE" text="You choose the vibe. Our designer handles the actual composition." />
            <div className="grid md:grid-cols-2 gap-3">
              {styleOptions.map(style => <button key={style[0]} onClick={() => setDesignStyle(style[0])} className={"rounded-2xl border p-4 text-left transition-all duration-200 " + (designStyle === style[0] ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.06)]" : "border-[#ddd7ce] bg-white/55 hover:border-accent hover:-translate-y-0.5")}>
                <div className="font-bold">{style[0]}</div><p className="text-sm text-muted-foreground mt-1">{style[1]}</p>
              </button>)}
            </div>
            <div className="grid md:grid-cols-2 gap-5 mt-6">
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Mood</label><div className="flex flex-wrap gap-2 mt-2">
                {MOODS.map(mood => <button key={mood} onClick={() => setDesignMood(mood)} className={"px-3 py-2 border text-sm " + (designMood === mood ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{mood}</button>)}
              </div></div>
              <div><label className="font-mono text-xs uppercase text-muted-foreground">Design intensity — {designIntensity}/5</label><input type="range" min="1" max="5" value={designIntensity} onChange={e => setDesignIntensity(Number(e.target.value))} className="w-full mt-4" /><div className="flex justify-between text-[10px] uppercase font-mono text-muted-foreground"><span>Clean</span><span>Balanced</span><span>Maximum Chaos</span></div></div>
            </div>
          </div>}

          {step === 1 && <div>
            <StepTitle eyebrow="Choose your blank" title="CLOTHING, COLOR & SIZE" text="Pick the exact garment first. Colors, sizes, pricing and availability update automatically for that clothing type." />

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {(catalog.length ? catalog : (product ? [product] : [])).map((option) => {
                const optionGarment = garmentFromProduct(option);
                const active = product?.id === option.id;
                return <button
                  type="button"
                  key={option.id}
                  onClick={() => chooseProduct(option)}
                  className={"group overflow-hidden rounded-2xl border text-left transition-all duration-200 " + (active ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.08)]" : "border-[#ddd7ce] bg-white/70 hover:border-accent hover:-translate-y-0.5")}
                >
                  <div className="aspect-[16/10] bg-[#f1ede6] overflow-hidden grid place-items-center">
                    {option.images?.[0]
                      ? <img src={option.images[0]} alt="" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
                      : <Shirt size={48} className="text-[#aaa39a]" />}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold leading-tight">{option.name}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{option.type || option.category || "Custom garment"}</div>
                      </div>
                      {active && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-white"><Check size={13}/></span>}
                    </div>
                    <div className="font-mono text-sm mt-3">From {"$" + Number(optionGarment.price).toFixed(2)}</div>
                  </div>
                </button>;
              })}
            </div>

            {!product && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No Custom Studio garments are currently published.</div>}

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
                      className={"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition " + (color === optionColor ? "border-[#171717] bg-[#171717] text-white shadow-sm" : "border-[#ddd7ce] bg-white hover:border-[#aaa39a]")}
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
                  <div className="mt-2 flex flex-wrap gap-2">
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
                        className={"min-w-14 rounded-xl border px-3 py-2.5 text-sm font-semibold transition " + (size === optionSize ? "border-accent bg-accent/[0.07] text-accent" : enabled ? "border-[#ddd7ce] bg-white hover:border-accent" : "border-[#e5e0d9] bg-[#f4f1ec] text-[#aaa39a] line-through cursor-not-allowed")}
                      >
                        <span>{optionSize}</span>
                        {optionVariant?.price != null && optionPrice !== Number(product.price || 0) && <span className="block text-[8px] font-mono mt-0.5">{"$" + optionPrice.toFixed(2)}</span>}
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
                  <Choice active={placement === "front_back"} onClick={() => setPlacement("front_back")}>Front + back (+{"$" + frontBackFee})</Choice>
                </div>
                <p className="mt-2 text-[10px] text-[#817b73]">Front is the default. Back is optional; additional print locations can be added later from the backend architecture.</p>
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
            <label className="flex items-start gap-3 mt-5 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} className="mt-1"/><span>I confirm I own or have permission to use the photos and artwork I submitted.</span></label>
            <label className="flex items-start gap-3 mt-3 text-sm"><input type="checkbox" checked={approvalAcknowledged} onChange={e => setApprovalAcknowledged(e.target.checked)} className="mt-1"/><span>I understand production begins after artwork approval and approved artwork cannot be changed after production starts.</span></label>
          </div>}

          {step === 7 && <div>
            <StepTitle eyebrow="Final check" title="REVIEW YOUR CUSTOM ORDER" text="Nothing is printed yet. This saves your design and adds the selected garments to your cart." />
            <div className="grid md:grid-cols-2 gap-4">
              <ReviewCard label="Occasion" value={occasion} sub={recipientType} />
              <ReviewCard label="Style" value={designStyle} sub={designMood + " · Intensity " + designIntensity + "/5"} />
              <ReviewCard label="Garment" value={product?.name || garment.label} sub={color + " · " + size + " · Qty " + qty} />
              <ReviewCard label="Photos" value={photos.length + " uploaded"} sub={photos.some(p => p.quality === "replace_recommended") ? "One or more photos should ideally be replaced." : "Photo quality check complete."} />
              <ReviewCard label="Proof" value={proofRequired ? "Required before print" : "Proof skipped"} sub={proofRequired ? revisions + " included revision(s)" : ""} />
              <ReviewCard label="Timing" value={priority === "rush" ? "Rush" : "Standard"} sub={needByDate ? "Need by " + needByDate : "No event date selected"} />
            </div>
            {groupGarments.length > 0 && <div className="mt-4 border border-border p-4"><div className="font-bold">Additional shirts using the same design</div>{groupGarments.map((g,i) => <div key={i} className="text-sm text-muted-foreground mt-1">{g.quantity}× {g.color} · {g.size}</div>)}</div>}
            <div className="mt-6 bg-secondary p-5 flex items-end justify-between gap-4"><div><div className="font-mono text-xs uppercase text-muted-foreground">Estimated custom subtotal</div><div className="text-xs text-muted-foreground mt-1">Before cart discounts, shipping, tax or coupon.</div></div><div className="font-display text-4xl">{"$" + estimatedSubtotal.toFixed(2)}</div></div>
            <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="w-full mt-5 bg-accent text-accent-foreground py-4 font-bold uppercase tracking-wide disabled:opacity-50">{saving ? "Saving custom design…" : "Add Custom Order to Cart →"}</button>
          </div>}
        </section>

          <aside className="h-fit lg:sticky lg:top-24 space-y-4">
            <div className="overflow-hidden rounded-[24px] border border-[#dcd5ca] bg-white shadow-[0_18px_55px_rgba(25,22,18,.085)]">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[#ebe5dc] bg-[#fffdfa]">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent">Live garment preview</div>
                  <div className="text-sm font-semibold mt-0.5 text-[#25231f]">{product?.name || garment.label}</div>
                </div>
                <button type="button" onClick={() => setFullscreenPreview(true)} className="h-9 w-9 grid place-items-center rounded-xl border border-[#ddd6cc] bg-white text-[#5d5851] hover:border-accent hover:text-accent" aria-label="Open full screen preview"><Maximize2 size={15} /></button>
              </div>

              <StudioPreview
                garment={garment}
                color={color}
                side={previewSide}
                placement={placement}
                photo={primaryPhoto}
                personalization={personalization}
                zoom={previewZoom}
                setZoom={setPreviewZoom}
                artworkScale={artworkScale}
                artworkRotation={artworkRotation}
                artworkOffset={artworkOffset}
                setArtworkOffset={setArtworkOffset}
                showGuides={showGuides}
                previewConfig={config.preview || {}}
              />

              <div className="p-4 border-t border-[#ebe5dc] bg-[#fffdfa]">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl border border-[#ddd6cc] bg-[#f5f0e9] p-1">
                    <button type="button" onClick={() => setPreviewSide("front")} className={"rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase " + (previewSide === "front" ? "bg-[#171717] text-white" : "text-[#756f67]")}>Front</button>
                    <button type="button" onClick={() => setPreviewSide("back")} className={"rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase " + (previewSide === "back" ? "bg-[#171717] text-white" : "text-[#756f67]")}>Back</button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPreviewZoom(v => clampPreview(v - .1))} className="h-8 w-8 grid place-items-center rounded-lg border border-[#ddd6cc]" aria-label="Zoom out"><ZoomOut size={14} /></button>
                    <span className="w-10 text-center font-mono text-[10px] text-[#746e66]">{Math.round(previewZoom * 100)}%</span>
                    <button type="button" onClick={() => setPreviewZoom(v => clampPreview(v + .1))} className="h-8 w-8 grid place-items-center rounded-lg border border-[#ddd6cc]" aria-label="Zoom in"><ZoomIn size={14} /></button>
                  </div>
                </div>

                {primaryPhoto && previewSide === "front" && <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-[#756f67]"><span>Artwork size</span><span>{artworkScale}%</span></div>
                    <input type="range" min="55" max="145" value={artworkScale} onChange={e => setArtworkScale(Number(e.target.value))} className="w-full accent-[#d9273e]" />
                  </div>
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase text-[#756f67]"><span>Rotation</span><span>{artworkRotation}°</span></div>
                    <input type="range" min="-12" max="12" value={artworkRotation} onChange={e => setArtworkRotation(Number(e.target.value))} className="w-full accent-[#d9273e]" />
                  </div>
                </div>}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setShowGuides(v => !v)} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#706a62] hover:text-accent"><Eye size={13} /> {showGuides ? "Hide print guide" : "Show print guide"}</button>
                  <button type="button" onClick={resetPreviewPlacement} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#706a62] hover:text-accent"><RotateCcw size={13} /> Reset</button>
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-[#8a837a]">Digital concept preview. Final composition and placement are reviewed by a GDP designer before production.</p>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#ddd6cc] bg-[#1a1917] text-white p-5 shadow-[0_14px_40px_rgba(20,18,16,.11)]">
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Your order</div>
              <div className="font-display text-3xl mt-2">{occasion}</div>
              <SummaryRow label="Style" value={designStyle.replace("GDP ","")} />
              <SummaryRow label="Garment" value={product?.name || garment.label} />
              <SummaryRow label="Size / Color" value={size + " / " + color} />
              <SummaryRow label="Photos" value={photos.length + "/" + maxPhotos} />
              <SummaryRow label="Total shirts" value={totalUnits} />
              <SummaryRow label="Proof" value={proofRequired ? "Before print" : "Skipped"} />
              <div className="border-t border-white/15 mt-5 pt-4 flex justify-between items-end"><span className="text-[10px] uppercase font-mono text-white/45">Unit price</span><span className="font-display text-3xl">{"$" + unitPrice.toFixed(2)}</span></div>
            </div>
          </aside>
      </div>

        <div className="mt-6 flex justify-between gap-3 pb-24 md:pb-0">
          <button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="inline-flex items-center gap-2 rounded-xl border border-[#d9d2c8] bg-white px-5 py-3 font-bold uppercase text-xs text-[#332f2a] shadow-sm hover:border-[#aaa198]"><ArrowLeft size={16}/>{step === 1 ? "Back" : "Previous"}</button>
          {step < STEPS.length && <button disabled={!canContinue()} onClick={() => canContinue() && setStep(step + 1)} className="inline-flex items-center gap-2 rounded-xl bg-[#171717] text-white px-6 py-3 font-bold uppercase text-xs shadow-lg disabled:opacity-40">Continue <ArrowRight size={16}/></button>}
        </div>

        <div className="md:hidden fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-white/10 bg-[#171717]/95 backdrop-blur-xl text-white p-2.5 pl-4 shadow-2xl flex items-center justify-between gap-3">
          <div><div className="font-mono text-[8px] uppercase tracking-widest text-white/45">Custom piece</div><div className="font-display text-2xl leading-none mt-1">{"$" + unitPrice.toFixed(2)}</div></div>
          {step < STEPS.length ? <button disabled={!canContinue()} onClick={() => canContinue() && setStep(step + 1)} className="rounded-xl bg-white text-[#171717] px-4 py-3 text-xs font-bold uppercase disabled:opacity-40">Continue →</button> : <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="rounded-xl bg-accent text-white px-4 py-3 text-xs font-bold uppercase disabled:opacity-40">{saving ? "Saving…" : "Add to cart →"}</button>}
        </div>

        {fullscreenPreview && <div className="fixed inset-0 z-[90] bg-[#111]/95 backdrop-blur-sm p-3 md:p-7">
          <div className="h-full max-w-5xl mx-auto rounded-[28px] overflow-hidden bg-[#f4efe7] border border-white/10 flex flex-col">
            <div className="h-16 shrink-0 flex items-center justify-between gap-4 px-4 md:px-6 bg-[#171717] text-white">
              <div><div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">GDP Custom Studio</div><div className="font-semibold">Full-screen garment preview</div></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreviewZoom(v => clampPreview(v - .1))} className="h-9 w-9 grid place-items-center rounded-xl border border-white/15"><ZoomOut size={15}/></button>
                <span className="w-12 text-center font-mono text-[10px]">{Math.round(previewZoom * 100)}%</span>
                <button type="button" onClick={() => setPreviewZoom(v => clampPreview(v + .1))} className="h-9 w-9 grid place-items-center rounded-xl border border-white/15"><ZoomIn size={15}/></button>
                <button type="button" onClick={() => setFullscreenPreview(false)} className="h-9 w-9 grid place-items-center rounded-xl bg-white text-[#171717]" aria-label="Close full screen preview"><X size={16}/></button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <StudioPreview garment={garment} color={color} side={previewSide} placement={placement} photo={primaryPhoto} personalization={personalization} zoom={previewZoom} setZoom={setPreviewZoom} artworkScale={artworkScale} artworkRotation={artworkRotation} artworkOffset={artworkOffset} setArtworkOffset={setArtworkOffset} showGuides={showGuides} previewConfig={config.preview || {}} fullscreen />
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}

function clampPreview(value) {
  return Math.min(1.8, Math.max(0.7, Number(Number(value).toFixed(2))));
}

function StudioPreview({ garment, color, side, placement, photo, personalization, zoom, setZoom, artworkScale, artworkRotation, artworkOffset, setArtworkOffset, showGuides, previewConfig = {}, fullscreen = false }) {
  const dragRef = useRef(null);
  const blankBack = side === "back" && placement === "front";
  const canDrag = Boolean(photo && !blankBack && setArtworkOffset);
  const previewSettings = /** @type {any} */ (previewConfig || {});
  const colorPreview = previewSettings?.colorMockups?.[color] || {};
  const mockupUrl = side === "back"
    ? (colorPreview.backUrl || previewSettings.backMockupUrl)
    : (colorPreview.frontUrl || previewSettings.frontMockupUrl);
  const defaultArea = garment?.type === "Hoodie" ? { top: 32, width: 34, height: 36 } : { top: 29, width: 36, height: 38 };
  const configuredArea = previewSettings?.printArea?.[side] || {};
  const printAreaStyle = {
    top: (Number(configuredArea.top) || defaultArea.top) + "%",
    width: (Number(configuredArea.width) || defaultArea.width) + "%",
    height: (Number(configuredArea.height) || defaultArea.height) + "%"
  };

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

  return <div onWheel={onWheel} className={"relative overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#fffdf8_0%,#eee7dc_68%,#e4dbcf_100%)] " + (fullscreen ? "h-full" : "h-[390px] sm:h-[430px]")}>
    <div className="absolute inset-x-0 top-3 text-center pointer-events-none"><span className="rounded-full border border-[#ddd6cc] bg-white/75 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.16em] text-[#817b71]">{side} view</span></div>
    <div className="absolute inset-0 grid place-items-center transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
      <div className={"relative " + (fullscreen ? "w-[min(55vh,520px)]" : "w-[275px] sm:w-[305px]")}>
        {mockupUrl ? <img src={mockupUrl} alt={(garment?.label || "Custom garment") + " " + side + " mockup"} className="w-full h-auto object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,.18)]" /> : <GarmentShape type={garment?.type || "T-Shirt"} color={color} side={side} />}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          style={printAreaStyle}
          className={"absolute left-1/2 -translate-x-1/2 overflow-hidden select-none touch-none " + (showGuides ? " border border-dashed border-accent/65 bg-white/[0.03]" : "") + (canDrag ? " cursor-grab active:cursor-grabbing" : "")}
        >
          {blankBack ? <div className="absolute inset-0 grid place-items-center text-center px-2 text-[8px] uppercase tracking-wide text-[#8b847a]">No back print selected</div> : photo ? <img src={photo.url} alt="Primary artwork preview" draggable="false" className="absolute left-1/2 top-1/2 h-[88%] w-[88%] object-cover rounded-sm shadow-[0_5px_15px_rgba(0,0,0,.18)] pointer-events-none" style={{ transform: `translate(calc(-50% + ${artworkOffset.x}%), calc(-50% + ${artworkOffset.y}%)) scale(${artworkScale / 100}) rotate(${artworkRotation}deg)` }} /> : <div className="absolute inset-0 grid place-items-center text-center px-2"><div><Sparkles size={20} className="mx-auto text-[#8c857b]" /><div className="mt-2 text-[8px] uppercase tracking-[0.12em] font-semibold text-[#817b71]">Your design appears here</div></div></div>}
          {!blankBack && (personalization?.name || personalization?.dates || personalization?.quote) && <div className="absolute inset-x-1 bottom-1.5 text-center text-white pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,.85)]">
            {personalization?.name && <div className="font-display text-sm leading-none uppercase tracking-wide">{personalization.name}</div>}
            {personalization?.dates && <div className="font-mono text-[6px] mt-0.5">{personalization.dates}</div>}
            {personalization?.quote && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.quote}</div>}
          </div>}
        </div>
      </div>
    </div>
    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 pointer-events-none">
      <span className="rounded-xl border border-[#d8d2c8] bg-white/80 backdrop-blur px-2.5 py-1.5 text-[8px] uppercase tracking-wide text-[#817b71]">{color} · {garment?.label || "Custom garment"}</span>
      {photo && !blankBack && <span className="rounded-xl border border-[#d8d2c8] bg-white/80 backdrop-blur px-2.5 py-1.5 text-[8px] uppercase tracking-wide text-[#817b71] inline-flex items-center gap-1"><Move size={10}/> Drag to position</span>}
    </div>
  </div>;
}

function GarmentShape({ type, color, side }) {
  const palette = garmentPalette(color);
  const isHoodie = type === "Hoodie";
  const isCrew = type === "Crewneck";
  return <svg viewBox="0 0 360 430" role="img" aria-label={color + " " + type + " " + side + " mockup"} className="w-full h-auto drop-shadow-[0_18px_22px_rgba(0,0,0,.18)]">
    {isHoodie ? <>
      <path d="M125 86 C133 45 153 25 180 25 C207 25 228 45 236 86 L215 105 C208 82 197 67 180 67 C163 67 152 82 145 105 Z" fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      <path d="M119 82 L76 108 L29 176 L68 198 L93 166 L93 390 L267 390 L267 166 L292 198 L331 176 L284 108 L241 82 C226 102 207 112 180 112 C153 112 134 102 119 82 Z" fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      {side === "front" && <path d="M137 291 Q180 270 223 291 L215 342 H145 Z" fill="none" stroke={palette.seam} strokeWidth="2" opacity=".55" />}
    </> : <>
      <path d="M123 70 L78 88 L27 154 L70 184 L96 151 L96 392 L264 392 L264 151 L290 184 L333 154 L282 88 L237 70 C224 91 204 101 180 101 C156 101 136 91 123 70 Z" fill={palette.base} stroke={palette.stroke} strokeWidth="2" />
      <path d="M149 69 C154 85 164 92 180 92 C196 92 206 85 211 69" fill="none" stroke={palette.seam} strokeWidth={isCrew ? "5" : "3"} opacity=".6" />
      {isCrew && <path d="M97 365 L263 365" stroke={palette.seam} strokeWidth="5" opacity=".42" />}
    </>}
    <path d="M115 92 C138 105 156 112 180 112 C204 112 222 105 245 92" fill="none" stroke={palette.highlight} strokeWidth="14" opacity=".22" />
  </svg>;
}

function garmentPalette(color) {
  const key = String(color || "Black").toLowerCase();
  if (key.includes("white")) return { base: "#f4f1eb", stroke: "#c8c2b8", seam: "#aaa49a", highlight: "#ffffff" };
  if (key.includes("sport grey") || key.includes("sport gray") || key === "grey" || key === "gray") return { base: "#b8b9b5", stroke: "#858682", seam: "#777874", highlight: "#ddddda" };
  if (key.includes("sand")) return { base: "#c8b79b", stroke: "#958166", seam: "#8f7a5f", highlight: "#f0e1c8" };
  if (key.includes("navy")) return { base: "#202b3b", stroke: "#0b1220", seam: "#667085", highlight: "#64748b" };
  if (key.includes("royal")) return { base: "#2857a6", stroke: "#17376f", seam: "#6f91cd", highlight: "#7aa0df" };
  if (key.includes("red")) return { base: "#ad2735", stroke: "#68151e", seam: "#ce6873", highlight: "#df7d87" };
  if (key.includes("pink")) return { base: "#e9afc3", stroke: "#b6788d", seam: "#d38fa6", highlight: "#f8d6e1" };
  if (key.includes("forest")) return { base: "#29463b", stroke: "#10231c", seam: "#72877f", highlight: "#6f9385" };
  if (key.includes("charcoal") || key.includes("heather")) return { base: "#414141", stroke: "#222", seam: "#707070", highlight: "#7b7b7b" };
  if (key.includes("vintage")) return { base: "#272422", stroke: "#101010", seam: "#595553", highlight: "#68615e" };
  return { base: "#171717", stroke: "#050505", seam: "#4b4b4b", highlight: "#555555" };
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
  return <div className="flex justify-between gap-3 mt-3 text-sm"><span className="opacity-55">{label}</span><span className="text-right">{value}</span></div>;
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