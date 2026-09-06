import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Minus, Plus, RotateCcw, ShieldCheck, ShoppingBag, Sparkles, Star, Truck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeProduct, normalizeReview } from "@/lib/supabaseMappers";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

export default function ProductDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { addItem, toggleWishlist, wishlist } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const load = async () => {
      let productQuery = supabase.from("products").select("*, product_variants(*)");
      productQuery = slug
        ? productQuery.eq("slug", slug)
        : productQuery.eq("id", id);

      const productResult = await productQuery.maybeSingle();
      if (!active) return;

      const nextProduct = productResult.error ? null : normalizeProduct(productResult.data);
      setProduct(nextProduct);

      const firstVariant = nextProduct?.variants?.[0];
      setColor(firstVariant?.color || nextProduct?.colors?.[0] || "");
      setSize(firstVariant?.size || nextProduct?.sizes?.[0] || "M");

      if (nextProduct?.id) {
        const reviewResult = await supabase
          .from("reviews")
          .select("*")
          .eq("product_id", nextProduct.id)
          .eq("status", "approved")
          .order("created_at", { ascending: false });

        if (active && !reviewResult.error) {
          setReviews((reviewResult.data || []).map(normalizeReview));
        }
      } else {
        setReviews([]);
      }
    };

    load().finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id, slug]);

  if (loading) {
    return (
      <div className="bg-[#f7f6f1] text-black">
        <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-5 lg:px-8">
          <div className="mb-6 h-3 w-24 animate-pulse bg-black/10" />
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
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
        <Link to="/shop" className="mt-6 inline-flex min-h-12 items-center bg-black px-6 text-[10px] font-black uppercase tracking-[0.14em] text-white">
          Back to shop
        </Link>
      </div>
    );
  }

  const variants = product.variants || [];
  const variantColors = [...new Set(variants.map((variant) => variant.color).filter(Boolean))];
  const variantSizes = [...new Set(variants.map((variant) => variant.size).filter(Boolean))];
  const colors = variantColors.length ? variantColors : product.colors?.length ? product.colors : ["Black"];
  const sizes = variantSizes.length ? variantSizes : product.sizes?.length ? product.sizes : SIZES;
  const selectedVariant =
    variants.find((variant) => (!variant.color || variant.color === color) && (!variant.size || variant.size === size)) ||
    (variants.length === 1 ? variants[0] : null);
  const displayPrice = selectedVariant?.price == null ? Number(product.price || 0) : Number(selectedVariant.price);
  const inStock = !product.trackInventory || !variants.length || Boolean(selectedVariant && Number(selectedVariant.stock || 0) > 0);
  const maxQty = product.trackInventory && selectedVariant ? Math.max(0, Number(selectedVariant.stock || 0)) : 99;
  const wished = wishlist.includes(product.id);
  const avgRating = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;
  const galleryImages = (product.images || []).filter(Boolean);
  const visibleImages = galleryImages.length ? galleryImages.slice(0, 4) : [null];

  const selectColor = (nextColor) => {
    setColor(nextColor);
    if (!variants.length) return;
    const exact = variants.find((variant) => (!variant.color || variant.color === nextColor) && (!variant.size || variant.size === size));
    if (exact) return;
    const fallback = variants.find((variant) => !variant.color || variant.color === nextColor);
    if (fallback?.size) setSize(fallback.size);
  };

  const selectSize = (nextSize) => {
    setSize(nextSize);
    if (!variants.length) return;
    const exact = variants.find((variant) => (!variant.size || variant.size === nextSize) && (!variant.color || variant.color === color));
    if (exact) return;
    const fallback = variants.find((variant) => !variant.size || variant.size === nextSize);
    if (fallback?.color) setColor(fallback.color);
  };

  const addToCart = () => {
    if (!inStock) return;
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      name: product.name,
      image: product.images?.[0],
      variant: selectedVariant?.name || product.type,
      size,
      color,
      quantity: Math.min(qty, maxQty || qty),
      price: displayPrice,
      fulfillmentMode: product.fulfillmentMode,
      isCustom: false,
    });
    navigate("/cart");
  };

  return (
    <div className="bg-[#f7f6f1] text-black">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-5 lg:px-8 lg:py-8">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.17em] text-black/45 transition hover:text-black">
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <section className="mx-auto grid max-w-[1500px] gap-8 px-4 pb-14 sm:px-5 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:pb-20">
        <div className={"grid gap-2 " + (visibleImages.length > 1 ? "sm:grid-cols-2" : "grid-cols-1")}>
          {visibleImages.map((image, index) => (
            <div key={image || index} className={"relative overflow-hidden bg-[#e9e7e1] " + (visibleImages.length === 1 ? "aspect-[4/5]" : "aspect-[4/5] sm:aspect-[3/4]")}>
              <Image src={image} alt={index === 0 ? product.name : ""} fittingType="fill" className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.02]" />
              <div className="absolute left-3 top-3 bg-black px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white">
                GDP / {String(index + 1).padStart(2, "0")}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-[126px] lg:self-start">
          <div className="border-t border-black pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-black/42">{product.type || "GDP Clothing"}</span>
              {product.bestSeller && <span className="bg-black px-2 py-1 font-mono text-[8px] uppercase tracking-[0.13em] text-white">Best seller</span>}
              {product.newArrival && <span className="bg-white px-2 py-1 font-mono text-[8px] uppercase tracking-[0.13em] text-black">New drop</span>}
            </div>

            <h1 className="mt-4 font-display text-6xl leading-[0.86] tracking-wide sm:text-7xl">{product.name}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/15 pb-5">
              <span className="font-mono text-xl">${displayPrice.toFixed(2)} CAD</span>
              {product.compareAtPrice > displayPrice && (
                <span className="font-mono text-sm text-black/35 line-through">${Number(product.compareAtPrice).toFixed(2)}</span>
              )}
              {avgRating && (
                <span className="flex items-center gap-1.5 text-xs text-black/50">
                  <Star size={13} className="fill-black text-black" /> {avgRating} / {reviews.length} review{reviews.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {product.metafields?.short_description && (
              <p className="mt-5 text-sm font-semibold leading-6 text-black/72">{product.metafields.short_description}</p>
            )}
            {product.description && (
              <p className={`${product.metafields?.short_description ? "mt-3" : "mt-5"} text-sm leading-6 text-black/60`}>{product.description}</p>
            )}
            {(product.metafields?.garment_brand || product.metafields?.garment_model || product.metafields?.fit || product.metafields?.fabric_weight) && (
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-black/10 py-3">
                {product.metafields?.garment_brand && <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Brand / {product.metafields.garment_brand}</div>}
                {product.metafields?.garment_model && <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Model / {product.metafields.garment_model}</div>}
                {product.metafields?.fit && <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Fit / {product.metafields.fit}</div>}
                {product.metafields?.fabric_weight && <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-black/45">Weight / {product.metafields.fabric_weight}</div>}
              </div>
            )}
            {product.material && <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-black/42">Material / {product.material}</p>}

            <div className="mt-7 border-t border-black/15 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[9px] font-black uppercase tracking-[0.15em]">Colour</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">{color}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.map((item) => (
                  <button key={item} onClick={() => selectColor(item)} className={"min-h-10 border px-4 text-[9px] font-black uppercase tracking-[0.12em] transition " + (color === item ? "border-black bg-black text-white" : "border-black/20 bg-transparent text-black hover:border-black")}>
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[9px] font-black uppercase tracking-[0.15em]">Size</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">{size}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {sizes.map((item) => (
                  <button key={item} onClick={() => selectSize(item)} className={"min-h-11 border px-2 text-[9px] font-black uppercase tracking-[0.1em] transition " + (size === item ? "border-black bg-black text-white" : "border-black/20 bg-transparent text-black hover:border-black")}>
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {variants.length > 0 && product.trackInventory && (
              <div className="mt-3 font-mono text-[8px] uppercase tracking-[0.13em] text-black/38">
                Selected variant stock / {selectedVariant ? selectedVariant.stock : 0}
              </div>
            )}

            <div className="mt-7 flex gap-2">
              <div className="flex shrink-0 items-center border border-black/20">
                <button onClick={() => setQty((current) => Math.max(1, current - 1))} className="flex h-12 w-11 items-center justify-center transition hover:bg-black hover:text-white" aria-label="Decrease quantity"><Minus size={14} /></button>
                <span className="min-w-8 text-center font-mono text-xs">{qty}</span>
                <button onClick={() => setQty((current) => Math.min(maxQty || 99, current + 1))} className="flex h-12 w-11 items-center justify-center transition hover:bg-black hover:text-white disabled:opacity-30" aria-label="Increase quantity" disabled={maxQty > 0 && qty >= maxQty}><Plus size={14} /></button>
              </div>
              <button onClick={() => toggleWishlist(product.id)} className="flex h-12 w-12 shrink-0 items-center justify-center border border-black/20 transition hover:border-black" aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}>
                <Heart size={17} className={wished ? "fill-[#e11d2e] text-[#e11d2e]" : ""} />
              </button>
            </div>

            <div className="mt-2">
              {product.customDesignable ? (
                <button onClick={() => navigate("/custom-studio?product=" + product.id)} className="flex min-h-14 w-full items-center justify-center gap-3 bg-[#e11d2e] px-5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-black">
                  <Sparkles size={17} /> Customize this product
                </button>
              ) : (
                <button onClick={addToCart} disabled={!inStock} className="flex min-h-14 w-full items-center justify-center gap-3 bg-black px-5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#e11d2e] disabled:cursor-not-allowed disabled:bg-black/30">
                  <ShoppingBag size={17} /> {inStock ? "Add to bag" : "Sold out"}
                </button>
              )}
            </div>

            {product.customDesignable && (
              <div className="mt-4 border border-[#e11d2e]/25 bg-[#e11d2e]/5 p-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]"><Sparkles size={14} className="text-[#e11d2e]" /> GDP Custom Studio</div>
                <p className="mt-2 text-xs leading-5 text-black/52">Upload your photos, choose the direction and approve a design proof before production.</p>
              </div>
            )}

            <div className="mt-6 grid grid-cols-3 border-y border-black/15 py-4">
              {[
                { icon: Truck, title: "Canada + US", text: "Shipping" },
                { icon: RotateCcw, title: "Proof first", text: "Before print" },
                { icon: ShieldCheck, title: "Secure", text: "Checkout" },
              ].map((item, index) => (
                <div key={item.title} className={"px-2 text-center " + (index > 0 ? "border-l border-black/15" : "")}>
                  <item.icon size={16} className="mx-auto" strokeWidth={1.6} />
                  <div className="mt-2 text-[8px] font-black uppercase tracking-[0.1em]">{item.title}</div>
                  <div className="mt-0.5 text-[8px] text-black/40">{item.text}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 divide-y divide-black/15 border-y border-black/15">
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[9px] font-black uppercase tracking-[0.14em]">Product details <Plus size={14} className="transition group-open:rotate-45" /></summary>
                <div className="pt-3 text-xs leading-5 text-black/52">{product.description || "GDP Clothing apparel made for everyday wear."}{product.material ? " Material: " + product.material + "." : ""}</div>
              </details>
              <details className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[9px] font-black uppercase tracking-[0.14em]">Production + shipping <Plus size={14} className="transition group-open:rotate-45" /></summary>
                <div className="pt-3 text-xs leading-5 text-black/52">Production timing can vary by product and custom-work requirements. Shipping options and final delivery costs are shown during checkout.</div>
              </details>
              {product.customDesignable && (
                <details className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[9px] font-black uppercase tracking-[0.14em]">Custom-order process <Plus size={14} className="transition group-open:rotate-45" /></summary>
                  <div className="pt-3 text-xs leading-5 text-black/52">Submit the story and photos in Custom Studio, choose your garment details, then review the design proof before printing begins.</div>
                </details>
              )}
            </div>
          </div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="border-t border-black/10 bg-[#efeee8]">
          <div className="mx-auto max-w-[1500px] px-4 py-12 sm:px-5 lg:px-8 lg:py-16">
            <div className="mb-7 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-black/40">Verified feedback</div>
                <h2 className="mt-2 font-display text-6xl leading-none tracking-wide sm:text-7xl">CUSTOMER REVIEWS</h2>
              </div>
              {avgRating && <div className="font-mono text-sm">{avgRating} / 5 · {reviews.length} review{reviews.length === 1 ? "" : "s"}</div>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.id} className="border-t border-black pt-5 md:min-h-[190px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex">{[1,2,3,4,5].map((value) => <Star key={value} size={13} className={value <= review.rating ? "fill-black text-black" : "text-black/15"} />)}</div>
                    {review.verified && <span className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#e11d2e]">Verified buyer</span>}
                  </div>
                  <h3 className="mt-5 text-sm font-bold">{review.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-black/52">{review.body}</p>
                  <p className="mt-4 font-mono text-[8px] uppercase tracking-[0.14em] text-black/38">{review.customerName}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
