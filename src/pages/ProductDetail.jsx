import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShoppingBag, Heart, Star, Truck, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeProduct, normalizeReview } from "@/lib/supabaseMappers";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

export default function ProductDetail() {
  const { id } = useParams();
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

    Promise.all([
      supabase.from("products").select("*, product_variants(*)").eq("id", id).maybeSingle(),
      supabase.from("reviews").select("*").eq("product_id", id).eq("status", "approved").order("created_at", { ascending: false }),
    ]).then(([productResult, reviewResult]) => {
      if (!active) return;

      const p = productResult.error ? null : normalizeProduct(productResult.data);
      setProduct(p);
      const firstVariant = p?.variants?.[0];
      setColor(firstVariant?.color || p?.colors?.[0] || "");
      setSize(firstVariant?.size || p?.sizes?.[0] || "M");

      if (!reviewResult.error) {
        setReviews((reviewResult.data || []).map(normalizeReview));
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className="max-w-[1500px] mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  if (!product) return <div className="max-w-[1500px] mx-auto px-4 py-20 text-center">Product not found. <Link to="/shop" className="text-accent">Back to shop</Link></div>;

  const variants = product.variants || [];
  const variantColors = [...new Set(variants.map((variant) => variant.color).filter(Boolean))];
  const variantSizes = [...new Set(variants.map((variant) => variant.size).filter(Boolean))];
  const colors = variantColors.length
    ? variantColors
    : product.colors?.length
      ? product.colors
      : ["Black"];
  const sizes = variantSizes.length
    ? variantSizes
    : product.sizes?.length
      ? product.sizes
      : SIZES;
  const selectedVariant =
    variants.find(
      (variant) =>
        (!variant.color || variant.color === color) &&
        (!variant.size || variant.size === size)
    ) || (variants.length === 1 ? variants[0] : null);
  const displayPrice =
    selectedVariant?.price == null ? Number(product.price || 0) : Number(selectedVariant.price);
  const inStock =
    !product.trackInventory ||
    !variants.length ||
    Boolean(selectedVariant && Number(selectedVariant.stock || 0) > 0);
  const maxQty =
    product.trackInventory && selectedVariant
      ? Math.max(0, Number(selectedVariant.stock || 0))
      : 99;
  const wished = wishlist.includes(product.id);
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  const selectColor = (nextColor) => {
    setColor(nextColor);
    if (!variants.length) return;
    const exact = variants.find(
      (variant) =>
        (!variant.color || variant.color === nextColor) &&
        (!variant.size || variant.size === size)
    );
    if (exact) return;
    const fallback = variants.find(
      (variant) => !variant.color || variant.color === nextColor
    );
    if (fallback?.size) setSize(fallback.size);
  };

  const selectSize = (nextSize) => {
    setSize(nextSize);
    if (!variants.length) return;
    const exact = variants.find(
      (variant) =>
        (!variant.size || variant.size === nextSize) &&
        (!variant.color || variant.color === color)
    );
    if (exact) return;
    const fallback = variants.find(
      (variant) => !variant.size || variant.size === nextSize
    );
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
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-secondary aspect-square overflow-hidden">
          <Image src={product.images?.[0]} alt={product.name} fittingType="fill" className="w-full h-full object-cover" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{product.type}</span>
            {product.bestSeller && <span className="bg-accent text-accent-foreground font-mono text-[10px] px-2 py-0.5 uppercase">Best Seller</span>}
          </div>
          <h1 className="font-display text-4xl md:text-5xl leading-none mt-2">{product.name}</h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="font-mono text-2xl">${displayPrice.toFixed(2)}</span>
            {product.compareAtPrice > displayPrice && (
              <span className="text-muted-foreground line-through">${product.compareAtPrice?.toFixed(2)}</span>
            )}
            {avgRating && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star size={14} className="fill-foreground" /> {avgRating} ({reviews.length})
              </span>
            )}
          </div>

          <p className="mt-4 text-muted-foreground">{product.description}</p>

          {product.material && <p className="mt-3 text-sm font-mono uppercase tracking-wide text-muted-foreground">{product.material}</p>}

          <div className="mt-6">
            <div className="font-mono text-xs uppercase tracking-wide mb-2">Color — {color}</div>
            <div className="flex gap-2">
              {colors.map(c => (
                <button key={c} onClick={() => selectColor(c)}
                  className={`px-4 py-2 text-xs uppercase border transition-colors ${color === c ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="font-mono text-xs uppercase tracking-wide mb-2">Size</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map(s => (
                <button key={s} onClick={() => selectSize(s)}
                  className={`min-w-12 px-3 py-2 text-xs font-bold uppercase border transition-colors ${size === s ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center border border-border">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-3 hover:text-accent" aria-label="Decrease"><Minus size={16} /></button>
              <span className="px-4 font-mono">{qty}</span>
              <button onClick={() => setQty(q => Math.min(maxQty || 99, q + 1))} className="px-3 py-3 hover:text-accent disabled:opacity-40" aria-label="Increase" disabled={maxQty > 0 && qty >= maxQty}><Plus size={16} /></button>
            </div>
            {product.customDesignable ? (
              <button onClick={() => navigate("/custom-studio?product=" + product.id)} className="flex-1 bg-accent text-accent-foreground py-3 font-bold uppercase tracking-wide hover:opacity-90 inline-flex items-center justify-center gap-2">
                <Sparkles size={18} /> Customize This Product
              </button>
            ) : (
              <button
                onClick={addToCart}
                disabled={!inStock}
                className="flex-1 bg-primary text-primary-foreground py-3 font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <ShoppingBag size={18} /> {inStock ? "Add to Cart" : "Sold Out"}
              </button>
            )}
            <button onClick={() => toggleWishlist(product.id)} className="p-3 border border-border hover:border-accent" aria-label="Wishlist">
              <Heart size={18} className={wished ? "fill-destructive text-destructive" : ""} />
            </button>
          </div>

          {variants.length > 0 && product.trackInventory && (
            <div className="mt-3 text-xs font-mono uppercase tracking-wide text-muted-foreground">
              Selected variant stock: {selectedVariant ? selectedVariant.stock : 0}
            </div>
          )}

          {product.customDesignable && (
            <div className="mt-3 border border-accent/30 bg-accent/5 px-4 py-3 text-sm">
              <div className="font-bold">GDP Custom Studio</div>
              <div className="text-muted-foreground mt-1">Choose an occasion and style, upload photos, tell us the story, then approve a design proof before printing.</div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="border border-border p-3"><Truck size={18} className="mx-auto mb-1" />Ships Canada & US</div>
            <div className="border border-border p-3"><RotateCcw size={18} className="mx-auto mb-1" />Proof before print</div>
            <div className="border border-border p-3"><ShieldCheck size={18} className="mx-auto mb-1" />Secure checkout</div>
          </div>
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display text-4xl mb-6">CUSTOMER REVIEWS</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {reviews.map(r => (
              <div key={r.id} className="border border-border p-5 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">{[1,2,3,4,5].map(i => <Star key={i} size={14} className={i <= r.rating ? "fill-foreground" : "text-muted-foreground"} />)}</div>
                  {r.verified && <span className="font-mono text-[10px] uppercase text-accent">Verified Buyer</span>}
                </div>
                <h3 className="font-semibold">{r.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{r.body}</p>
                <p className="text-xs mt-2 font-mono">— {r.customerName}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}