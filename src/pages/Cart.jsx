import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Heart } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";

export default function Cart() {
  const { items, updateQty, removeItem, subtotal, saved, moveToCart, itemCount } = useCart();
  const navigate = useNavigate();

  const qtyDiscount = (total, count) => {
    if (count >= 3) return total * 0.75;
    if (count >= 2) return total * 0.80;
    return total;
  };

  const discount = subtotal - qtyDiscount(subtotal, itemCount);
  const shipping = subtotal >= 150 ? 0 : 12.99;
  const tax = (qtyDiscount(subtotal, itemCount) + shipping) * 0.11;
  const total = qtyDiscount(subtotal, itemCount) + shipping + tax;

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
                <Image src={item.image} alt={item.name} fittingType="fill" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    {item.isCustom && <span className="font-mono text-[10px] uppercase text-accent">GDP Custom Studio</span>}
                    <div className="text-xs text-muted-foreground mt-1 font-mono uppercase">
                      {item.color} · {item.size} {item.fulfillmentMode === "pod" ? "· POD" : item.fulfillmentMode === "in_house" ? "· In-House" : ""}
                    </div>
                    {item.isCustom && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        {item.occasion && <div>Occasion: <span className="text-foreground">{item.occasion}</span></div>}
                        {item.designStyle && <div>Style: <span className="text-foreground">{item.designStyle}</span></div>}
                        <div>Proof: <span className="text-foreground">{item.proofRequired === false ? "Skipped" : "Required before print"}</span></div>
                        {item.needByDate && <div>Need by: <span className="text-foreground">{item.needByDate}</span></div>}
                        <div className="font-mono text-[10px]">Design ID: {item.customDesignId}</div>
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
            <Row k="Tax (11%)" v={`$${tax.toFixed(2)}`} />
          </div>
          {discount > 0 && (
            <div className="mt-2 text-xs font-mono uppercase text-accent bg-accent/10 px-2 py-1">
              {itemCount >= 3 ? "25% off (3+ items)" : "20% off (2 items)"}
            </div>
          )}
          <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-border">
            <span>Total</span><span className="font-mono">${total.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-mono">CAD · Free shipping over $150</p>
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