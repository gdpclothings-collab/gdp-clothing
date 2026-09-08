import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Heart, Pencil } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";
import { calculateCartQuantityDiscount } from "@/lib/cartPricing";
import { customerApi } from "@/lib/customerApi";

export default function Cart() {
  const { items, updateQty, removeItem, saved, moveToCart } = useCart();
  const navigate = useNavigate();

  const quantityPricing = calculateCartQuantityDiscount(items);
  const subtotal = quantityPricing.subtotal;
  const discount = quantityPricing.discount;
  const discountedSubtotal = quantityPricing.afterDiscount;
  const [pricingConfig, setPricingConfig] = useState(null);
  const fallbackShipping = discountedSubtotal >= 150 ? 0 : 12.99;
  const fallbackTaxRate = 0.11;
  const shipping = pricingConfig?.shipping ?? fallbackShipping;
  const tax = pricingConfig?.tax ?? ((discountedSubtotal + shipping) * fallbackTaxRate);
  const total = discountedSubtotal + shipping + tax;
  const taxName = pricingConfig?.taxName || "Saskatchewan GST + PST";
  const freeShippingThreshold = Number(pricingConfig?.freeShippingThreshold ?? 150);

  useEffect(() => {
    if (!items.length) {
      setPricingConfig(null);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const next = await customerApi.getCheckoutConfig({
          amount: discountedSubtotal,
          province: "Saskatchewan",
          shippingMethod: "standard",
          freeShipping: false,
        });
        if (active) setPricingConfig(next);
      } catch (error) {
        if (active) setPricingConfig(null);
        console.debug("Cart pricing configuration fallback:", error?.message || error);
      }
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [items.length, discountedSubtotal]);

  if (items.length === 0) {
    return (
      <div className="max-w-[1500px] mx-auto px-4 py-20 text-center">
        <ShoppingBag size={48} className="mx-auto text-muted-foreground mb-4" />
        <h1 className="font-display text-4xl">YOUR CART IS EMPTY</h1>
        <p className="text-muted-foreground mt-2">Time to design something legendary.</p>
        <Link to="/custom-studio" className="mt-6 inline-flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 font-bold uppercase hover:opacity-90">
          Design Your Own <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
      <h1 className="font-display text-5xl md:text-6xl leading-none mb-8">YOUR CART</h1>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-4">
          {items.map(item => (
            <div key={item.key} className="flex gap-4 border border-border p-4 bg-card">
              <div className="w-24 h-24 bg-secondary shrink-0 overflow-hidden">
                {item.isDtf ? (
                  <img src={item.image} alt={`${item.name} layout preview`} className="h-full w-full bg-white object-contain" />
                ) : (
                  <Image src={item.image} alt={item.name} fittingType="fill" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    {item.isCustom && <span className="font-mono text-[10px] uppercase text-accent">GDP Custom Studio</span>}
                    {item.isDtf && <span className="font-mono text-[10px] uppercase text-accent">DTF Gang Sheet · Film only</span>}
                    <div className="text-xs text-muted-foreground mt-1 font-mono uppercase">
                      {item.color} · {item.size} {item.fulfillmentMode === "pod" ? "· POD" : item.fulfillmentMode === "in_house" ? "· In-House" : ""}
                    </div>
                    {item.isDtf && item.dtfSpec && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        <div>Order type: <span className="text-foreground">{item.dtfSpec.mode === "upload" ? "Print-ready upload" : "Gang sheet builder"}</span></div>
                        <div>Film: <span className="text-foreground">{item.dtfSpec.width}" × {item.dtfSpec.length}" · {Number(item.dtfSpec.area || 0).toFixed(1)} in²</span></div>
                        <div>Artwork: <span className="text-foreground">{item.dtfSpec.layout?.length || 0} file{item.dtfSpec.layout?.length === 1 ? "" : "s"} · {Number(item.dtfSpec.utilization || 0).toFixed(1)}% film usage</span></div>
                        <div className="font-mono text-[10px]">DTF film pricing is exempt from apparel quantity discounts.</div>
                      </div>
                    )}
                    {item.isCustom && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        {item.occasion && <div>Occasion: <span className="text-foreground">{item.occasion}</span></div>}
                        {item.designStyle && <div>Style: <span className="text-foreground">{item.designStyle}</span></div>}
                        {item.designMood && <div>Mood: <span className="text-foreground">{item.designMood}</span></div>}
                        {item.placement && <div>Print: <span className="text-foreground">{item.placement === "front_back" ? "Front + back" : item.placement === "back" ? "Back only" : "Front only"}</span></div>}
                        {item.fabric && <div>Fabric: <span className="text-foreground">{item.fabric}</span></div>}
                        <div>Proof: <span className="text-foreground">{item.proofRequired === false ? "Skipped" : "Required before print"}</span></div>
                        {item.needByDate && <div>Need by: <span className="text-foreground">{item.needByDate}</span></div>}
                      </div>
                    )}
                  </div>
                  <span className="font-mono">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center border border-border">
                    <button onClick={() => updateQty(item.key, item.quantity - 1)} className="px-2 py-1 hover:text-accent" aria-label="Decrease"><Minus size={14} /></button>
                    <span className="px-3 font-mono text-sm">{item.quantity}</span>
                    <button onClick={() => updateQty(item.key, item.quantity + 1)} className="px-2 py-1 hover:text-accent" aria-label="Increase"><Plus size={14} /></button>
                  </div>
                  <button onClick={() => removeItem(item.key)} className="text-muted-foreground hover:text-destructive" aria-label="Remove"><Trash2 size={16} /></button>
                  {item.seasonalDraft && <Link to={`/custom-studio?product=${encodeURIComponent(item.productId)}&color=${encodeURIComponent(item.color || "")}&size=${encodeURIComponent(item.size || "")}`} state={{seasonalDraft:item.seasonalDraft,editCartKey:item.key}} className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"><Pencil size={13}/> Edit design</Link>}
                </div>
              </div>
            </div>
          ))}

          {saved.length > 0 && (
            <div className="border border-border p-4 bg-secondary">
              <h3 className="font-mono text-xs uppercase tracking-wide mb-3 flex items-center gap-2"><Heart size={14} /> Saved for later</h3>
              {saved.map(s => (
                <div key={s.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm">{s.name} · {s.color} {s.size}</span>
                  <button onClick={() => moveToCart(s.key)} className="text-xs font-bold uppercase text-accent">Move to cart</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="bg-card border border-border p-6 h-fit sticky top-24">
          <h2 className="font-display text-3xl mb-4">ORDER SUMMARY</h2>
          <div className="space-y-2 text-sm">
            <Row k="Subtotal" v={`$${subtotal.toFixed(2)}`} />
            {discount > 0 && <Row k="Qty discount" v={`-$${discount.toFixed(2)}`} accent />}
            <Row k="Shipping" v={shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`} />
            <Row k={taxName} v={`${tax.toFixed(2)}`} />
          </div>
          {discount > 0 && (
            <div className="mt-2 text-xs font-mono uppercase text-accent bg-accent/10 px-2 py-1">
              {quantityPricing.eligibleCount >= 3 ? "25% off eligible apparel (3+ items)" : "20% off eligible apparel (2 items)"}
            </div>
          )}
          <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-border">
            <span>Estimated total</span><span className="font-mono">${total.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-mono">{`CAD · Saskatchewan estimate · Free shipping over ${freeShippingThreshold.toFixed(0)} · Final tax updates with delivery province`}</p>
          <button onClick={() => navigate("/checkout")} className="w-full mt-5 bg-primary text-primary-foreground py-4 font-bold uppercase tracking-wide hover:opacity-90">
            Checkout →
          </button>
          <Link to="/shop" className="block text-center text-sm mt-3 text-muted-foreground hover:text-accent">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v, accent = false }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={`font-mono ${accent ? "text-accent" : ""}`}>{v}</span></div>;
}
