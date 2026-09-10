import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Heart, MapPin, Minus, Pencil, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { Image } from "@/components/ui/image";
import { calculateCartQuantityDiscount } from "@/lib/cartPricing";

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const seasonalArtworkName = (item) => item.seasonalSummary?.artwork || String(item.designStyle || "").replace(/^Seasonal:\s*/i, "") || "Custom artwork";
const seasonalPersonalization = (item) => {
  const summary = item.seasonalSummary?.personalization;
  if (summary) return summary;
  const text = item.seasonalDraft?.text || {};
  return [text.name, text.message].filter(Boolean).join(" · ") || "None";
};

export default function Cart() {
  const { items, updateQty, removeItem, saveForLater, saved, moveToCart } = useCart();
  const navigate = useNavigate();
  const pricing = calculateCartQuantityDiscount(items);
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

  if (!items.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary"><ShoppingBag size={28} className="text-muted-foreground" /></div>
        <h1 className="mt-6 font-display text-4xl sm:text-5xl">YOUR CART IS EMPTY</h1>
        <p className="mt-3 text-base text-muted-foreground">Start a custom design or browse ready-to-wear pieces.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/custom-studio" className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-6 font-bold uppercase text-primary-foreground">Design your own <ArrowRight size={17} /></Link>
          <Link to="/shop" className="inline-flex min-h-12 items-center justify-center border border-border bg-card px-6 font-bold uppercase">Shop products</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] bg-[#f6f5f1] text-foreground">
      <div className="mx-auto max-w-[1460px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-black/10 pb-5">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">GDP Clothing</div>
            <h1 className="mt-2 font-display text-5xl leading-none sm:text-6xl">YOUR CART</h1>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{itemCount} item{itemCount === 1 ? "" : "s"}</p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px] xl:gap-8">
          <section aria-label="Cart items" className="space-y-4">
            {items.map((item) => {
              const isSeasonal = Boolean(item.isCustom && !item.isDtf && item.seasonalDraft);
              const dimensions = item.seasonalSummary?.dimensions || (item.seasonalDraft?.width ? `${Number(item.seasonalDraft.width).toFixed(2)} in wide` : "Saved with design");
              const rotation = item.seasonalSummary?.rotation ?? item.seasonalDraft?.rotation;
              return (
                <article key={item.key} className="border border-black/10 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,.035)] sm:p-5">
                  <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
                    <div className={`${item.isCustom && !item.isDtf ? "aspect-[4/5] bg-[#f3eee6]" : "aspect-square bg-secondary sm:aspect-[4/5]"} overflow-hidden border border-black/10`}>
                      {item.isDtf
                        ? <img src={item.image} alt={`${item.name} film layout`} className="h-full w-full bg-white object-contain" />
                        : item.isCustom
                          ? <Image src={item.image} alt={`${item.name} approved custom preview`} fittingType="contain" className="h-full w-full object-contain" />
                          : <Image src={item.image} alt={item.name} fittingType="fill" className="h-full w-full object-cover" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent">{item.isDtf ? "DTF transfer film" : item.isCustom ? "GDP Custom Studio" : "GDP Clothing"}</div>
                          <h2 className="mt-1 text-lg font-bold leading-tight">{item.name}</h2>
                          {!item.isDtf && <p className="mt-1 text-sm text-muted-foreground">{[item.variant, item.color, item.size].filter(Boolean).join(" · ")}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-lg font-black">{money(item.price * item.quantity)}</div>
                          {item.quantity > 1 && <div className="mt-0.5 text-xs text-muted-foreground">{money(item.price)} each</div>}
                        </div>
                      </div>

                      {item.isDtf && item.dtfSpec ? (
                        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-y border-black/10 py-4 text-sm sm:grid-cols-3">
                          <Spec label="Film size" value={`${item.dtfSpec.width}\" × ${item.dtfSpec.length}\"`} />
                          <Spec label="Artwork" value={`${item.dtfSpec.layout?.length || 0} file${item.dtfSpec.layout?.length === 1 ? "" : "s"}`} />
                          <Spec label="Film used" value={`${Number(item.dtfSpec.utilization || 0).toFixed(1)}%`} />
                          <Spec label="Order type" value={item.dtfSpec.mode === "upload" ? "Print-ready" : "Gang sheet builder"} />
                          <Spec label="Review" value={item.dtfSpec.artworkReviewRequested ? "Professional review" : "Customer approved"} />
                          <Spec label="Fulfillment" value="Pickup or shipping" />
                        </dl>
                      ) : isSeasonal ? (
                        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-y border-black/10 py-4 text-sm lg:grid-cols-3">
                          <Spec label="Print side" value={item.seasonalSummary?.printSide || "Front"} />
                          <Spec label="Artwork" value={seasonalArtworkName(item)} />
                          <Spec label="Print size" value={dimensions} />
                          <Spec label="Rotation" value={`${Math.round(Number(rotation || 0))}°`} />
                          <Spec label="Personalization" value={seasonalPersonalization(item)} />
                          <Spec label="Approval" value="Production preview locked" />
                          {item.fabric && <Spec label="Fabric" value={item.fabric} />}
                        </dl>
                      ) : item.isCustom ? (
                        <p className="mt-3 text-sm text-muted-foreground">{[item.designStyle, item.placement === "front_back" ? "Front + back" : item.placement === "back" ? "Back only" : item.placement ? "Front only" : ""].filter(Boolean).join(" · ")}</p>
                      ) : null}

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <div className="inline-flex min-h-11 items-center border border-black/15 bg-white" aria-label={`Quantity for ${item.name}`}>
                          <button type="button" onClick={() => updateQty(item.key, item.quantity - 1)} disabled={item.quantity <= 1} className="grid h-11 w-11 place-items-center hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Decrease ${item.name} quantity`}><Minus size={16} /></button>
                          <span className="min-w-10 border-x border-black/10 text-center font-mono text-sm font-bold" aria-live="polite">{item.quantity}</span>
                          <button type="button" onClick={() => updateQty(item.key, item.quantity + 1)} className="grid h-11 w-11 place-items-center hover:bg-black/5" aria-label={`Increase ${item.name} quantity`}><Plus size={16} /></button>
                        </div>

                        {item.seasonalDraft && (
                          <Link to={`/custom-studio?product=${encodeURIComponent(item.productId)}&color=${encodeURIComponent(item.color || "")}&size=${encodeURIComponent(item.size || "")}`} state={{ seasonalDraft: item.seasonalDraft, editCartKey: item.key }} className="inline-flex min-h-11 items-center gap-2 border border-black/15 px-4 text-sm font-bold hover:bg-black/5"><Pencil size={15} /> Edit design</Link>
                        )}
                        {item.isDtf && <Link to="/dtf-gang-sheet?mode=build" className="inline-flex min-h-11 items-center gap-2 border border-black/15 px-4 text-sm font-bold"><Pencil size={15} /> Build another</Link>}
                        {!item.isCustom && !item.isDtf && <button type="button" onClick={() => saveForLater(item.key)} className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-muted-foreground"><Heart size={15} /> Save for later</button>}
                        <button type="button" onClick={() => removeItem(item.key)} className="ml-auto inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-muted-foreground hover:text-destructive" aria-label={`Remove ${item.name} from cart`}><Trash2 size={15} /> Remove</button>
                      </div>
                      {isSeasonal && <p className="mt-3 text-xs leading-5 text-muted-foreground">Edit design returns to this exact saved garment, colour, size, artwork and placement. Updating the cart replaces this item instead of creating a duplicate.</p>}
                      {item.isDtf && <p className="mt-3 text-xs leading-5 text-muted-foreground">Quantity creates identical copies of this film. You can keep refining the open workspace after adding it to your cart.</p>}
                    </div>
                  </div>
                </article>
              );
            })}

            {!!saved.length && (
              <section className="border border-black/10 bg-white p-5">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em]"><Heart size={16} /> Saved for later</h2>
                <div className="mt-3 divide-y divide-black/10">
                  {saved.map((item) => <div key={item.key} className="flex items-center justify-between gap-4 py-3"><span className="text-sm">{item.name} · {item.color} {item.size}</span><button type="button" onClick={() => moveToCart(item.key)} className="shrink-0 text-sm font-bold text-accent">Move to cart</button></div>)}
                </div>
              </section>
            )}
          </section>

          <aside className="border border-black/10 bg-white shadow-[0_12px_40px_rgba(0,0,0,.05)] lg:sticky lg:top-24">
            <div className="border-b border-black/10 p-5 sm:p-6">
              <h2 className="font-display text-3xl">ORDER SUMMARY</h2>
              <div className="mt-5 space-y-3 text-sm">
                <Row label="Subtotal" value={money(pricing.subtotal)} />
                {pricing.discount > 0 && <Row label="Quantity discount" value={`−${money(pricing.discount)}`} accent />}
                <Row label="Shipping" value="Calculated at checkout" muted />
                <Row label="Taxes" value="Calculated at checkout" muted />
              </div>
              {pricing.discount > 0 && <div className="mt-4 bg-accent/10 px-3 py-2 text-xs font-bold text-accent">{pricing.eligibleCount >= 3 ? "25% apparel quantity discount applied" : "20% apparel quantity discount applied"}</div>}
              <div className="mt-5 flex items-end justify-between gap-4 border-t border-black/10 pt-5">
                <div><div className="font-bold">Current subtotal</div><div className="mt-1 text-xs text-muted-foreground">Final total shown after fulfillment and address.</div></div>
                <span className="font-mono text-2xl font-black">{money(pricing.afterDiscount)}</span>
              </div>
              <button type="button" onClick={() => navigate("/checkout")} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 bg-black px-5 text-sm font-black uppercase tracking-[0.08em] text-white hover:bg-accent">Secure checkout <ArrowRight size={17} /></button>
              <Link to="/shop" className="mt-3 block py-2 text-center text-sm font-semibold text-muted-foreground">Continue shopping</Link>
            </div>
            <div className="space-y-4 bg-[#faf9f6] p-5 sm:p-6">
              <Info icon={Truck} title="Shipping" text="Delivery cost is calculated after your address is entered." />
              <Info icon={MapPin} title="Saskatoon pickup" text="Choose free local pickup during checkout." />
              <Info icon={ShieldCheck} title="Secure payment" text="Payment is processed securely through Stripe." />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Spec({ label, value }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words font-mono text-xs font-bold">{value}</dd></div>;
}

function Row({ label, value, accent = false, muted = false }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className={`text-right font-mono font-semibold ${accent ? "text-accent" : ""} ${muted ? "text-xs text-muted-foreground" : ""}`}>{value}</span></div>;
}

function Info({ icon: Icon, title, text }) {
  return <div className="flex gap-3"><Icon size={18} className="mt-0.5 shrink-0" /><div><div className="text-sm font-bold">{title}</div><div className="mt-0.5 text-xs leading-5 text-muted-foreground">{text}</div></div></div>;
}
