import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Heart, Minus, Plus, RotateCcw, Ruler, ShieldCheck, ShoppingBag, Sparkles, Star, Truck, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeProduct, normalizeReview } from "@/lib/supabaseMappers";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";
import { findProductVariant, isProductColorAvailable, isProductOutOfStock, isProductVariantAvailable, sortApparelSizes } from "@/lib/productVariants";
import { resolveColorSwatch } from "@/lib/colorSwatches";
import { PRODUCT_SELLING_MODES, onlineStoreEnabled, resolveProductSellingMode } from "@/lib/productSelling";
import { normalizeApparelPricing } from "@/lib/apparelPricing";

const uniqueValues = (values = []) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
const sameOption = (left, right) => String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
const formatCad = (value) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(value || 0));

function productOptions(product) {
  const variants = (product?.variants || []).filter((variant) => variant?.active !== false);
  const productColors = uniqueValues(product?.colors || []);
  const productSizes = uniqueValues(product?.sizes || []);
  const variantColors = uniqueValues(variants.map((variant) => variant.color));
  const variantSizes = uniqueValues(variants.map((variant) => variant.size));
  return {
    colors: uniqueValues([...productColors, ...variantColors]),
    sizes: sortApparelSizes(productSizes.length ? productSizes : variantSizes),
  };
}

function splitProductTitle(name, fallbackSubtitle) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) return { title: "GDP Clothing", subtitle: fallbackSubtitle || "" };
  if (fallbackSubtitle) return { title: normalizedName, subtitle: fallbackSubtitle };
  const parts = normalizedName.split(/\s+[—–]\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1
    ? { title: parts[0], subtitle: parts.slice(1).join(" — ") }
    : { title: normalizedName, subtitle: "" };
}

function parseSizeGuideRows(value) {
  const lines = String(value || "")
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = lines
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((row) => row.filter(Boolean).length >= 2);
  if (parsed.length < 2) return { headers: [], rows: [] };
  const columnCount = Math.max(...parsed.map((row) => row.length));
  const normalizeRow = (row) => Array.from({ length: columnCount }, (_, index) => row[index] || "");
  return {
    headers: normalizeRow(parsed[0]),
    rows: parsed.slice(1).map(normalizeRow),
  };
}

function Stars({ rating = 0, size = 13 }) {
  const rounded = Math.round(Number(rating || 0));
  return (
    <span className="inline-flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={size} className={value <= rounded ? "fill-black text-black" : "text-black/18"} />
      ))}
    </span>
  );
}

function DetailRow({ title, children, open = false }) {
  return (
    <details className="group py-4" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[9px] font-black uppercase tracking-[0.14em]">
        {title}
        <Plus size={14} className="transition group-open:rotate-45" />
      </summary>
      <div className="pt-3 text-xs leading-5 text-black/52">{children}</div>
    </details>
  );
}

export default function ProductDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, toggleWishlist, wishlist } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [apparelPricing, setApparelPricing] = useState(() => normalizeApparelPricing({}));
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, title: "", body: "" });

  useEffect(() => {
    let active = true;
    setLoading(true);

    const load = async () => {
      let productQuery = supabase.from("products").select("*, product_variants(*)").eq("status", "active");
      productQuery = slug ? productQuery.eq("slug", slug) : productQuery.eq("id", id);
      const productResult = await productQuery.maybeSingle();
      if (!active) return;

      const normalized = productResult.error ? null : normalizeProduct(productResult.data);
      const nextProduct = normalized && onlineStoreEnabled(normalized) ? normalized : null;
      setProduct(nextProduct);
      setActiveImageIndex(0);
      setColor("");
      setSize("");
      setQty(1);
      setSizeGuideOpen(false);
      setReviewFormOpen(false);
      setReviewMessage("");
      setReviewDraft({ rating: 5, title: "", body: "" });

      if (!nextProduct?.id) {
        setReviews([]);
        return;
      }

      const reviewResult = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", nextProduct.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (active && !reviewResult.error) setReviews((reviewResult.data || []).map(normalizeReview));
    };

    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, slug]);

  useEffect(() => {
    let active = true;
    supabase
      .from("store_settings")
      .select("apparel_pricing")
      .eq("id", 1)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (active && data?.apparel_pricing) setApparelPricing(normalizeApparelPricing(data.apparel_pricing));
        },
        () => {},
      );
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (product?.slug === "dtf-gang-sheet") {
      navigate("/products/dtf-gang-sheet", { replace: true });
      return;
    }
    if (!product) return;
    const options = productOptions(product);
    if (options.colors.length === 1 && isProductColorAvailable(product, options.colors[0])) setColor(options.colors[0]);
    if (options.sizes.length === 1) setSize(options.sizes[0]);
  }, [product, navigate]);

  useEffect(() => {
    if (!sizeGuideOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSizeGuideOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sizeGuideOpen]);

  if (loading) {
    return (
      <div className="bg-[#f7f6f1] text-black">
        <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-5 lg:px-8">
          <div className="mb-6 h-3 w-24 animate-pulse bg-black/10" />
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="aspect-[4/5] animate-pulse bg-black/10" />
            <div className="space-y-5">
              <div className="h-3 w-32 animate-pulse bg-black/10" />
              <div className="h-16 w-4/5 animate-pulse bg-black/10" />
              <div className="h-7 w-32 animate-pulse bg-black/10" />
              <div className="h-24 w-full animate-pulse bg-black/10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-[#f7f6f1] px-4 py-24 text-center text-black">
        <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-black/40">GDP / catalog</div>
        <h1 className="mt-3 font-display text-6xl tracking-wide">PRODUCT NOT FOUND</h1>
        <Link to="/shop" className="mt-6 inline-flex min-h-12 items-center bg-black px-6 text-[10px] font-black uppercase tracking-[0.14em] text-white">Back to shop</Link>
      </div>
    );
  }

  const variants = (product.variants || []).filter((variant) => variant?.active !== false);
  const { colors, sizes } = productOptions(product);
  const requiresColor = colors.length > 0;
  const requiresSize = sizes.length > 0;
  const selectedVariant = variants.length ? findProductVariant(product, color, size) : null;
  const selectionComplete = (!requiresColor || Boolean(color)) && (!requiresSize || Boolean(size));
  const validCombination = variants.length > 0 && Boolean(selectedVariant);
  const displayPrice = selectedVariant?.price == null ? Number(product.price || 0) : Number(selectedVariant.price);
  const compareAtPrice = Number(product.compareAtPrice || 0);
  const hasSale = compareAtPrice > displayPrice && displayPrice >= 0;
  const savingsAmount = hasSale ? compareAtPrice - displayPrice : 0;
  const savingsPercent = hasSale && compareAtPrice > 0 ? Math.round((savingsAmount / compareAtPrice) * 100) : 0;
  const inStock = isProductVariantAvailable(product, selectedVariant);
  const outOfStock = isProductOutOfStock(product);
  const sellingMode = resolveProductSellingMode(product);
  const isReadyToWear = sellingMode === PRODUCT_SELLING_MODES.READY_TO_WEAR;
  const isCustom = sellingMode === PRODUCT_SELLING_MODES.CUSTOM;
  const readyToWearPricing = apparelPricing.readyToWear || {};
  const readyToWearOfferEnabled = Boolean(isReadyToWear && apparelPricing.enabled && readyToWearPricing.enabled);
  const readyToWearTiers = readyToWearOfferEnabled ? (readyToWearPricing.tiers || []).map((tier) => ({ ...tier })) : [];
  const readyToWearCanStackWithSale = !hasSale || readyToWearPricing.allowSaleStacking !== false;
  const activeReadyToWearTier = readyToWearTiers.find((tier) => qty >= Number(tier?.min || 0) && qty <= Number(tier?.max || 0));
  const readyToWearPercent = readyToWearOfferEnabled && readyToWearCanStackWithSale
    ? Number(activeReadyToWearTier?.percent || 0)
    : 0;
  const quantityRegularTotal = displayPrice * qty;
  const quantityDiscountedTotal = quantityRegularTotal * (1 - readyToWearPercent / 100);
  const quantitySavings = Math.max(0, quantityRegularTotal - quantityDiscountedTotal);
  const canAddToCart = isReadyToWear && selectionComplete && validCombination && inStock;
  const inventoryLimited = product.trackInventory !== false && product.sellWhenOutOfStock !== true;
  const maxQty = inventoryLimited && selectedVariant ? Math.max(0, Number(selectedVariant.stock || 0)) : 99;
  const wished = wishlist.includes(product.id);
  const avgRating = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;
  const galleryImages = (product.images || []).filter(Boolean);
  const gallery = galleryImages.length ? galleryImages : [null];
  const activeImage = gallery[Math.min(activeImageIndex, gallery.length - 1)] || null;
  const titleParts = splitProductTitle(product.name, product.metafields?.subtitle);
  const sizeGuideNote = String(product.metafields?.size_guide_note || "").trim();
  const sizeGuide = parseSizeGuideRows(product.metafields?.size_guide_rows);
  const hasSizeMeasurements = sizeGuide.headers.length > 0 && sizeGuide.rows.length > 0;

  const sizeAvailable = (nextSize, selectedColor = color) => {
    if (!variants.length) return true;
    return variants.some((variant) => {
      const colorMatches = !requiresColor || !selectedColor || sameOption(variant.color, selectedColor);
      const sizeMatches = sameOption(variant.size, nextSize);
      const inventoryAvailable = !inventoryLimited || Number(variant.stock || 0) > 0;
      return colorMatches && sizeMatches && inventoryAvailable;
    });
  };

  const selectColor = (nextColor) => {
    if (!isProductColorAvailable(product, nextColor)) return;
    setColor(nextColor);
    if (size && !sizeAvailable(size, nextColor)) setSize("");
    setQty(1);
  };

  const selectSize = (nextSize) => {
    if (!sizeAvailable(nextSize)) return;
    setSize(nextSize);
    setQty(1);
  };

  const addToCart = () => {
    if (!canAddToCart || !selectedVariant) return;
    const quantity = Math.min(qty, maxQty || qty);
    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      name: product.name,
      image: product.images?.[0],
      variant: selectedVariant.name || product.type,
      size: size || selectedVariant.size || "",
      color: color || selectedVariant.color || "",
      quantity,
      maxQuantity: inventoryLimited ? maxQty : null,
      price: displayPrice,
      compareAtPrice: compareAtPrice || null,
      fulfillmentMode: product.fulfillmentMode,
      sellingMode,
      isCustom: false,
    });
    navigate("/cart");
  };

  const openReviewForm = () => {
    if (!user) {
      const returnTo = `${window.location.pathname}${window.location.search}#reviews`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    setReviewMessage("");
    setReviewFormOpen(true);
    window.requestAnimationFrame(() => document.getElementById("review-form")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!user || !product.id || reviewSubmitting) return;
    const body = reviewDraft.body.trim();
    if (!body) {
      setReviewMessage("Please add a short review before submitting.");
      return;
    }

    setReviewSubmitting(true);
    setReviewMessage("");
    const { error } = await supabase.from("reviews").insert({
      product_id: product.id,
      user_id: user.id,
      product_name: product.name,
      customer_name: user.display_name || user.email?.split("@")[0] || "GDP customer",
      customer_email: user.email || null,
      rating: Number(reviewDraft.rating),
      title: reviewDraft.title.trim() || null,
      body,
      status: "pending",
      verified: false,
    });
    setReviewSubmitting(false);

    if (error) {
      setReviewMessage("We could not submit the review right now. Please try again.");
      return;
    }
    setReviewDraft({ rating: 5, title: "", body: "" });
    setReviewFormOpen(false);
    setReviewMessage("Thanks — your review was submitted and is awaiting approval.");
  };

  const ctaLabel = outOfStock
    ? "Out of stock"
    : !selectionComplete
      ? `Choose ${requiresColor && requiresSize ? "colour + size" : requiresColor ? "colour" : "size"}`
      : !validCombination
        ? "Unavailable combination"
        : !inStock
          ? "Out of stock"
          : `Add to bag · ${formatCad(qty > 1 ? quantityDiscountedTotal : displayPrice)}`;

  return (
    <div className="bg-[#f7f6f1] text-black">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-5 lg:px-8 lg:py-8">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.17em] text-black/45 transition hover:text-black">
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <section className="mx-auto grid max-w-[1500px] gap-8 px-4 pb-14 sm:px-5 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:px-8 lg:pb-20 xl:gap-14">
        <div className="min-w-0">
          <div className="relative overflow-hidden bg-[#e9e7e1]">
            <div className="aspect-[4/5] sm:aspect-[5/6] lg:aspect-[4/5]">
              <Image src={activeImage} alt={product.name} fittingType="fill" className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.015]" />
            </div>
            <div className="absolute left-3 top-3 bg-black px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white">GDP / {String(activeImageIndex + 1).padStart(2, "0")}</div>
            <div className="absolute bottom-3 right-3 bg-[#f7f6f1]/95 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.13em] text-black">{activeImageIndex + 1} / {gallery.length}</div>
            {outOfStock && <div className="absolute right-3 top-3 bg-[#e11d2e] px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.15em] text-white">Out of stock</div>}
          </div>

          {gallery.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1" aria-label="Product gallery thumbnails">
              {gallery.map((image, index) => (
                <button key={`${image || "image"}-${index}`} type="button" onClick={() => setActiveImageIndex(index)} aria-label={`Show product image ${index + 1}`} aria-pressed={activeImageIndex === index} className={`relative aspect-[4/5] w-[82px] shrink-0 overflow-hidden border transition sm:w-[96px] ${activeImageIndex === index ? "border-black" : "border-black/10 hover:border-black/50"}`}>
                  <Image src={image} alt="" fittingType="fill" className="h-full w-full object-cover" />
                  <span className={`absolute inset-x-0 bottom-0 h-1 ${activeImageIndex === index ? "bg-black" : "bg-transparent"}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-[126px] lg:self-start">
          <div className="border-t border-black pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-black/42">{product.type || "GDP Clothing"}</span>
              {isReadyToWear && <span className="bg-white px-2 py-1 font-mono text-[8px] uppercase tracking-[0.13em]">Ready to wear</span>}
              {product.bestSeller && <span className="bg-black px-2 py-1 font-mono text-[8px] uppercase tracking-[0.13em] text-white">Best seller</span>}
              {product.newArrival && <span className="bg-white px-2 py-1 font-mono text-[8px] uppercase tracking-[0.13em]">New drop</span>}
              {hasSale && <span className="bg-[#e11d2e] px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.13em] text-white">Sale · {savingsPercent}% off</span>}
              {product.metafields?.final_sale && <span className="border border-[#e11d2e] px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.13em] text-[#e11d2e]">Final sale</span>}
              {outOfStock && <span className="bg-[#e11d2e] px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.13em] text-white">Out of stock</span>}
            </div>

            <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.8rem,5.4vw,5.15rem)] leading-[0.9] tracking-wide">
              <span className="block">{titleParts.title}</span>
              {titleParts.subtitle && <span className="mt-3 block font-mono text-[10px] font-black uppercase leading-normal tracking-[0.15em] text-black/48 sm:text-xs">{" — "}{titleParts.subtitle}</span>}
            </h1>

            <div className="mt-5 border-b border-black/15 pb-5">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <span className={`font-mono text-2xl ${hasSale ? "font-black text-[#e11d2e]" : ""}`}>{formatCad(displayPrice)}</span>
                {hasSale && <span className="pb-0.5 font-mono text-sm text-black/38 line-through">{formatCad(compareAtPrice)}</span>}
              </div>
              {hasSale && (
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em]">
                  <span className="bg-[#e11d2e]/10 px-2 py-1 font-black text-[#b51222]">Save {savingsPercent}%</span>
                  <span className="text-black/48">You save {formatCad(savingsAmount)}</span>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-black/52">
                <a href="#reviews" className="inline-flex items-center gap-1.5 transition hover:text-black"><Stars rating={Number(avgRating || 0)} /><span>{avgRating ? `${avgRating} (${reviews.length})` : "No reviews yet"}</span></a>
                <span className="text-black/20">·</span>
                <button type="button" onClick={openReviewForm} className="font-semibold underline decoration-black/25 underline-offset-4 transition hover:decoration-black">Write a review</button>
              </div>
            </div>

            {readyToWearOfferEnabled && readyToWearTiers.length > 0 && (
              <div className="mt-5 border border-black/15 bg-white/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-[9px] font-black uppercase tracking-[0.14em]">Buy more & save</div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Automatic in cart</div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {readyToWearTiers.map((tier) => {
                    const active = qty >= tier.min && qty <= tier.max && readyToWearCanStackWithSale;
                    const quantityLabel = tier.max >= 999 || tier.max > tier.min ? `Buy ${tier.min}+` : `Buy ${tier.min}`;
                    return <div key={`${tier.min}-${tier.max}-${tier.percent}`} className={`border px-3 py-2.5 ${active ? "border-black bg-black text-white" : "border-black/10 bg-[#f7f6f1]"}`}><div className="font-mono text-[8px] font-black uppercase tracking-[0.12em]">{quantityLabel}</div><div className="mt-1 text-sm font-black">Save {tier.percent}%</div></div>;
                  })}
                </div>
                {readyToWearPercent > 0 && (
                  <div className="mt-3 border-t border-black/10 pt-3 text-xs font-semibold">
                    {qty} × {formatCad(displayPrice)} = {formatCad(quantityDiscountedTotal)} <span className="text-[#b51222]">· You save {formatCad(quantitySavings)}</span>
                  </div>
                )}
                {!readyToWearCanStackWithSale && <div className="mt-3 text-xs text-black/50">Buy More & Save does not stack with this product's current sale price.</div>}
              </div>
            )}

            {product.metafields?.short_description && <p className="mt-5 text-sm font-semibold leading-6 text-black/72">{product.metafields.short_description}</p>}
            {product.description && <p className={`${product.metafields?.short_description ? "mt-3" : "mt-5"} text-sm leading-6 text-black/60`}>{product.description}</p>}

            {(product.metafields?.garment_brand || product.metafields?.garment_model || product.metafields?.fit || product.metafields?.fabric_weight) && (
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-black/10 py-3">
                {product.metafields?.garment_brand && <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Brand / {product.metafields.garment_brand}</div>}
                {product.metafields?.garment_model && <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Model / {product.metafields.garment_model}</div>}
                {product.metafields?.fit && <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Fit / {product.metafields.fit}</div>}
                {product.metafields?.fabric_weight && <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Weight / {product.metafields.fabric_weight}</div>}
              </div>
            )}
            {product.material && <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-black/42">Material / {product.material}</p>}

            {requiresColor && (
              <div className="mt-7 border-t border-black/15 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3"><span className="font-mono text-[9px] font-black uppercase tracking-[0.15em]">Colour</span><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">{color || "Choose"}</span></div>
                <div className="flex flex-wrap gap-2">
                  {colors.map((item) => {
                    const enabled = isProductColorAvailable(product, item);
                    const swatch = resolveColorSwatch(product?.customization?.preview?.colorSwatches, item);
                    return (
                      <button key={item} type="button" disabled={!enabled} onClick={() => enabled && selectColor(item)} title={!enabled ? `${item} — Unavailable` : item} aria-label={!enabled ? `${item}, unavailable` : item} aria-pressed={color === item && enabled} className={`inline-flex min-h-11 items-center gap-2 border px-3 text-[9px] font-black uppercase tracking-[0.12em] transition ${color === item && enabled ? "border-black bg-black text-white" : enabled ? "border-black/20 bg-transparent text-black hover:border-black" : "cursor-not-allowed border-black/10 bg-black/[0.03] text-black/40 opacity-75"}`}>
                        <span className="relative h-4 w-4 shrink-0 rounded-full border border-black/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]" style={{ backgroundColor: swatch }}>{!enabled && <span aria-hidden="true" className="absolute left-1/2 top-[-2px] h-5 w-px -translate-x-1/2 rotate-45 bg-black/55" />}</span>
                        <span className="text-left leading-tight"><span className="block">{item}</span>{!enabled && <span className="mt-0.5 block font-mono text-[7px] font-bold tracking-[0.09em]">Unavailable</span>}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {requiresSize && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[9px] font-black uppercase tracking-[0.15em]">Size</span>
                    <button type="button" onClick={() => setSizeGuideOpen(true)} aria-haspopup="dialog" className="inline-flex min-h-8 items-center gap-1.5 font-mono text-[8px] font-black uppercase tracking-[0.12em] text-black/50 underline decoration-black/20 underline-offset-4 transition hover:text-black hover:decoration-black">
                      <Ruler size={12} /> Size guide
                    </button>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">{size || "Choose"}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {sizes.map((item) => {
                    const enabled = sizeAvailable(item);
                    return (
                      <button key={item} type="button" disabled={!enabled} onClick={() => selectSize(item)} aria-pressed={size === item} className={`relative min-h-11 border px-2 text-[9px] font-black uppercase tracking-[0.1em] transition ${size === item && enabled ? "border-black bg-black text-white" : enabled ? "border-black/20 bg-transparent text-black hover:border-black" : "cursor-not-allowed border-black/10 text-black/28"}`}>
                        {item}{!enabled && <span aria-hidden="true" className="absolute left-1/2 top-1/2 h-px w-7 -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-black/25" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isReadyToWear && variants.length > 0 && product.trackInventory && (
              <div className="mt-3 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.13em] text-black/45">
                {selectionComplete && validCombination && inStock && <Check size={12} />}
                <span>{!selectionComplete ? `Choose ${requiresColor && requiresSize ? "colour and size" : requiresColor ? "colour" : "size"} to see availability` : !validCombination ? "This selection is unavailable" : inStock ? "In stock for selected variant" : "Selected variant is out of stock"}</span>
              </div>
            )}

            {isReadyToWear && (
              <div className="mt-7 flex gap-2">
                <div className="flex shrink-0 items-center border border-black/20" aria-label="Quantity selector">
                  <button onClick={() => setQty((current) => Math.max(1, current - 1))} className="flex h-12 w-11 items-center justify-center transition hover:bg-black hover:text-white" aria-label="Decrease quantity"><Minus size={14} /></button>
                  <span className="min-w-8 text-center font-mono text-xs">{qty}</span>
                  <button onClick={() => setQty((current) => Math.min(maxQty || 99, current + 1))} className="flex h-12 w-11 items-center justify-center transition hover:bg-black hover:text-white disabled:opacity-30" aria-label="Increase quantity" disabled={maxQty > 0 && qty >= maxQty}><Plus size={14} /></button>
                </div>
                <button onClick={() => toggleWishlist(product.id)} className="flex h-12 w-12 shrink-0 items-center justify-center border border-black/20 transition hover:border-black" aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}><Heart size={17} className={wished ? "fill-[#e11d2e] text-[#e11d2e]" : ""} /></button>
              </div>
            )}

            <div className={isReadyToWear ? "mt-2" : "mt-7"}>
              {isCustom ? (
                <button onClick={() => { if (outOfStock) return; const query = new URLSearchParams({ product: product.id }); if (color) query.set("color", color); if (size) query.set("size", size); navigate(`/custom-studio?${query.toString()}`); }} disabled={outOfStock} className="flex min-h-14 w-full items-center justify-center gap-3 bg-[#e11d2e] px-5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-black/30"><Sparkles size={17} /> {outOfStock ? "Out of stock" : "Customize this product"}</button>
              ) : isReadyToWear ? (
                <button onClick={addToCart} disabled={!canAddToCart} className="flex min-h-14 w-full items-center justify-center gap-3 bg-black px-5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#e11d2e] disabled:cursor-not-allowed disabled:bg-black/30"><ShoppingBag size={17} /> {ctaLabel}</button>
              ) : (
                <button type="button" disabled className="flex min-h-14 w-full cursor-not-allowed items-center justify-center bg-black/30 px-5 text-[10px] font-black uppercase tracking-[0.14em] text-white">Available through its service builder</button>
              )}
            </div>

            {hasSale && <div className="mt-3 border border-[#e11d2e]/20 bg-[#e11d2e]/5 px-4 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[#a4111f]">Sale price shown above uses the existing product price. Final taxes, shipping, and eligible promotions are confirmed at checkout.</div>}
            {product.metafields?.free_shipping === true && <div className="mt-3 flex items-center gap-2 border border-black/10 bg-white/50 px-4 py-3 text-xs font-semibold"><Truck size={15} /> Free shipping on this item</div>}

            {isCustom && <div className="mt-4 border border-[#e11d2e]/25 bg-[#e11d2e]/5 p-4"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]"><Sparkles size={14} className="text-[#e11d2e]" /> GDP Custom Studio</div><p className="mt-2 text-xs leading-5 text-black/52">Upload your photos, choose the direction and approve a design proof before production.</p></div>}

            <div className="mt-6 grid grid-cols-3 border-y border-black/15 py-4">
              {[
                { icon: Truck, title: "Canada + US", text: "Shipping" },
                { icon: RotateCcw, title: isReadyToWear ? "Inventory" : "Proof first", text: isReadyToWear ? "Checked live" : "Before print" },
                { icon: ShieldCheck, title: "Secure", text: "Checkout" },
              ].map((item, index) => (
                <div key={item.title} className={`px-2 text-center ${index > 0 ? "border-l border-black/15" : ""}`}><item.icon size={16} className="mx-auto" strokeWidth={1.6} /><div className="mt-2 text-[8px] font-black uppercase tracking-[0.1em]">{item.title}</div><div className="mt-0.5 text-[8px] text-black/40">{item.text}</div></div>
              ))}
            </div>

            <div className="mt-5 divide-y divide-black/15 border-y border-black/15">
              <DetailRow title="Product details" open>{product.description || "GDP Clothing apparel made for everyday wear."}{product.material ? ` Material: ${product.material}.` : ""}</DetailRow>
              <DetailRow title="Fit + size">{product.metafields?.fit ? `Fit: ${product.metafields.fit}. ` : ""}{product.metafields?.audience ? `${product.metafields.audience}. ` : ""}{sizeGuideNote || "Size availability updates from the active product variants and the colour you select."}{requiresSize ? ` Available sizes: ${sizes.join(", ")}.` : ""}</DetailRow>
              {(product.material || product.metafields?.care_instructions) && <DetailRow title="Material + care">{product.material ? `Material: ${product.material}. ` : ""}{product.metafields?.care_instructions || "Follow the garment label for care instructions."}</DetailRow>}
              <DetailRow title="Production + shipping">Production timing can vary by product and custom-work requirements. Shipping options and final delivery costs are shown during checkout.</DetailRow>
              {isCustom && <DetailRow title="Custom-order process">Submit the story and photos in Custom Studio, choose your garment details, then review the design proof before printing begins.</DetailRow>}
            </div>
          </div>
        </div>
      </section>

      {sizeGuideOpen && requiresSize && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setSizeGuideOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="gdp-size-guide-title" className="max-h-[88vh] w-full overflow-y-auto bg-[#f7f6f1] text-black shadow-2xl sm:max-w-3xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/15 bg-[#f7f6f1]/95 px-5 py-4 backdrop-blur sm:px-7">
              <div>
                <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-black/40">GDP / fit reference</div>
                <h2 id="gdp-size-guide-title" className="mt-1 font-display text-5xl leading-none tracking-wide sm:text-6xl">SIZE GUIDE</h2>
              </div>
              <button type="button" autoFocus onClick={() => setSizeGuideOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center border border-black/15 transition hover:bg-black hover:text-white" aria-label="Close size guide"><X size={18} /></button>
            </div>

            <div className="px-5 py-6 sm:px-7 sm:py-7">
              <p className="text-sm font-semibold leading-6">{product.name}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.metafields?.fit && <span className="border border-black/15 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em]">Fit / {product.metafields.fit}</span>}
                {product.metafields?.audience && <span className="border border-black/15 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em]">{product.metafields.audience}</span>}
                {product.metafields?.sleeve_type && <span className="border border-black/15 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em]">{product.metafields.sleeve_type}</span>}
              </div>

              <div className="mt-6 border-t border-black/15 pt-5">
                <div className="font-mono text-[9px] font-black uppercase tracking-[0.14em]">Available sizes</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sizes.map((item) => <span key={item} className={`min-w-11 border px-3 py-2 text-center font-mono text-[9px] font-black uppercase ${size === item ? "border-black bg-black text-white" : "border-black/15"}`}>{item}</span>)}
                </div>
              </div>

              {hasSizeMeasurements ? (
                <div className="mt-6">
                  <div className="mb-3 font-mono text-[9px] font-black uppercase tracking-[0.14em]">Garment measurements</div>
                  <div className="overflow-x-auto border border-black/15 bg-white/45">
                    <table className="w-full min-w-[440px] border-collapse text-left">
                      <thead className="bg-black text-white">
                        <tr>{sizeGuide.headers.map((header, index) => <th key={`${header}-${index}`} className="px-4 py-3 font-mono text-[8px] font-black uppercase tracking-[0.12em]">{header || `Column ${index + 1}`}</th>)}</tr>
                      </thead>
                      <tbody>
                        {sizeGuide.rows.map((row, rowIndex) => (
                          <tr key={`size-row-${rowIndex}`} className="border-t border-black/10">
                            {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className={`px-4 py-3 text-xs ${cellIndex === 0 ? "font-black" : "text-black/60"}`}>{cell || "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-black/42">Garment measurements are approximate. Minor production and fabric variation can occur.</p>
                </div>
              ) : (
                <div className="mt-6 border border-dashed border-black/20 bg-white/40 px-4 py-4">
                  <div className="font-mono text-[8px] font-black uppercase tracking-[0.13em] text-black/45">Measurement chart</div>
                  <p className="mt-2 text-xs leading-5 text-black/55">Measurements have not been published for this product yet. Use the available sizes and fit information above, compare with a similar garment you already own, or contact GDP Clothing for fit help.</p>
                </div>
              )}

              {sizeGuideNote && <div className="mt-5 border-l-2 border-black pl-4 text-xs leading-5 text-black/60">{sizeGuideNote}</div>}
            </div>
          </section>
        </div>
      )}

      <section id="reviews" className="scroll-mt-28 border-t border-black/10 bg-[#efeee8]">
        <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-5 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-black/40">Customer feedback</div>
              <h2 className="mt-2 font-display text-6xl leading-none tracking-wide sm:text-7xl">REVIEWS</h2>
              <div className="mt-5 flex items-center gap-2"><Stars rating={Number(avgRating || 0)} size={18} /><span className="font-mono text-xs">{avgRating ? `${avgRating} / 5` : "Not rated yet"}</span></div>
              <p className="mt-2 text-xs text-black/48">{reviews.length ? `Based on ${reviews.length} approved review${reviews.length === 1 ? "" : "s"}.` : "Be the first customer to review this product."}</p>
              <button type="button" onClick={openReviewForm} className="mt-5 inline-flex min-h-11 items-center justify-center border border-black px-5 text-[9px] font-black uppercase tracking-[0.13em] transition hover:bg-black hover:text-white">Write a review</button>
              {!user && <p className="mt-2 text-[10px] leading-4 text-black/42">Sign-in is required to submit a review.</p>}
              {reviewMessage && <div className="mt-4 border border-black/10 bg-white/60 px-4 py-3 text-xs leading-5 text-black/65" role="status">{reviewMessage}</div>}
            </div>

            <div>
              {reviewFormOpen && user && (
                <form id="review-form" onSubmit={submitReview} className="mb-8 border border-black/15 bg-[#f7f6f1] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[8px] uppercase tracking-[0.18em] text-black/42">Add review</div><h3 className="mt-1 text-sm font-black uppercase tracking-[0.05em]">Share your experience</h3></div><button type="button" onClick={() => setReviewFormOpen(false)} className="font-mono text-[9px] uppercase tracking-[0.12em] text-black/45 hover:text-black">Close</button></div>
                  <div className="mt-5"><div className="font-mono text-[8px] font-black uppercase tracking-[0.14em]">Rating</div><div className="mt-2 flex gap-1" role="radiogroup" aria-label="Review rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={reviewDraft.rating === value} onClick={() => setReviewDraft((current) => ({ ...current, rating: value }))} className="p-1" aria-label={`${value} star${value === 1 ? "" : "s"}`}><Star size={22} className={value <= reviewDraft.rating ? "fill-black text-black" : "text-black/20"} /></button>)}</div></div>
                  <label className="mt-5 block"><span className="font-mono text-[8px] font-black uppercase tracking-[0.14em]">Title <span className="font-normal text-black/35">Optional</span></span><input value={reviewDraft.title} onChange={(event) => setReviewDraft((current) => ({ ...current, title: event.target.value.slice(0, 120) }))} maxLength={120} className="mt-2 h-11 w-full border border-black/20 bg-transparent px-3 text-sm outline-none transition focus:border-black" placeholder="What stood out?" /></label>
                  <label className="mt-4 block"><span className="font-mono text-[8px] font-black uppercase tracking-[0.14em]">Review</span><textarea value={reviewDraft.body} onChange={(event) => setReviewDraft((current) => ({ ...current, body: event.target.value.slice(0, 1500) }))} maxLength={1500} rows={5} required className="mt-2 w-full resize-y border border-black/20 bg-transparent px-3 py-3 text-sm outline-none transition focus:border-black" placeholder="Tell other customers about the fit, quality, print or overall experience." /></label>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-md text-[10px] leading-4 text-black/42">Reviews are submitted as pending and appear publicly after approval. Verified-buyer status is only shown when confirmed by the system.</p><button type="submit" disabled={reviewSubmitting} className="min-h-11 bg-black px-5 text-[9px] font-black uppercase tracking-[0.13em] text-white transition hover:bg-[#e11d2e] disabled:cursor-not-allowed disabled:opacity-50">{reviewSubmitting ? "Submitting…" : "Submit review"}</button></div>
                </form>
              )}

              {reviews.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2">
                  {reviews.map((review) => (
                    <article key={review.id} className="border-t border-black pt-5 md:min-h-[190px]">
                      <div className="flex items-center justify-between gap-3"><Stars rating={review.rating} />{review.verified && <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#e11d2e]">Verified buyer</span>}</div>
                      <h3 className="mt-5 text-sm font-bold">{review.title || "Customer review"}</h3>
                      <p className="mt-2 text-sm leading-6 text-black/52">{review.body}</p>
                      <p className="mt-4 font-mono text-[8px] uppercase tracking-[0.14em] text-black/38">{review.customerName || "GDP customer"}{review.created_at ? ` · ${new Date(review.created_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}` : ""}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center border border-dashed border-black/15 px-6 text-center"><div><Stars /><p className="mt-3 text-sm font-semibold">No approved reviews yet.</p><p className="mt-1 text-xs text-black/45">Customer reviews will appear here after approval.</p></div></div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}