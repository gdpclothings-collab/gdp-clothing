import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, CreditCard, Check, AlertTriangle, Truck, Store } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { base44 } from "@/api/base44Client";
import { isIframe } from "@/lib/utils";

export default function Checkout() {
  const { items, subtotal, clearCart, itemCount } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "", phone: "", firstName: "", lastName: "",
    address: "", city: "", province: "Saskatchewan", postalCode: "", country: "Canada",
    shippingMethod: "standard", notes: "", discountCode: ""
  });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  const qtyDiscount = (total, count) => {
    if (count >= 3) return total * 0.75;
    if (count >= 2) return total * 0.80;
    return total;
  };
  const discounted = qtyDiscount(subtotal, itemCount);
  const discountAmt = subtotal - discounted;
  const couponAmt = appliedDiscount ? (appliedDiscount.type === "fixed" ? appliedDiscount.value : discounted * (appliedDiscount.value / 100)) : 0;
  const afterCoupon = Math.max(0, discounted - couponAmt);
  const shipping = form.shippingMethod === "pickup" ? 0 : (afterCoupon >= 150 ? 0 : 12.99);
  const tax = (afterCoupon + shipping) * 0.11;
  const total = afterCoupon + shipping + tax;

  if (items.length === 0) {
    return <div className="max-w-[1500px] mx-auto px-4 py-20 text-center"><h1 className="font-display text-4xl">Cart is empty</h1><Link to="/shop" className="text-accent mt-4 inline-block">Browse products</Link></div>;
  }

  const applyCoupon = async () => {
    if (!form.discountCode) return;
    setError("");
    try {
      const { data } = await base44.functions.invoke('checkout', { action: 'validateCoupon', code: form.discountCode });
      if (data?.active) setAppliedDiscount(data); else setError("Invalid or expired code.");
    } catch { setError("Could not validate code."); }
  };

  const placeOrder = async () => {
    setError("");
    if (!form.email || !form.firstName || !form.address || !form.city || !form.postalCode) {
      setError("Please fill in all required fields.");
      return;
    }
    if (isIframe) {
      setError("Checkout works only from the published app. Open the app in a new tab to complete payment.");
      return;
    }
    setPlacing(true);
    try {
      const { data } = await base44.functions.invoke('checkout', {
        action: 'createOrder', cart: items, customer: form, discountCode: form.discountCode,
        origin: window.location.origin
      });
      if (data?.error) {
        setError(data.message || "Order could not be placed. Please try again.");
      } else if (data?.checkoutUrl) {
        clearCart();
        window.location.href = data.checkoutUrl;
      } else {
        clearCart();
        navigate(`/order/${data.orderNumber}?status=pending_payment&configured=0`);
      }
    } catch (e) {
      setError("Network error placing order. Please try again.");
    }
    setPlacing(false);
  };

  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
      <h1 className="font-display text-5xl md:text-6xl leading-none mb-8">CHECKOUT</h1>
      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-8">
          <Section n="01" title="Contact">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Email" value={form.email} onChange={v => set("email", v)} type="email" />
              <Input label="Phone" value={form.phone} onChange={v => set("phone", v)} />
            </div>
          </Section>

          <Section n="02" title="Shipping Address">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="First name" value={form.firstName} onChange={v => set("firstName", v)} />
              <Input label="Last name" value={form.lastName} onChange={v => set("lastName", v)} />
              <div className="sm:col-span-2"><Input label="Address" value={form.address} onChange={v => set("address", v)} /></div>
              <Input label="City" value={form.city} onChange={v => set("city", v)} />
              <Input label="Province/State" value={form.province} onChange={v => set("province", v)} />
              <Input label="Postal/Zip" value={form.postalCode} onChange={v => set("postalCode", v)} />
              <Input label="Country" value={form.country} onChange={v => set("country", v)} />
            </div>
          </Section>

          <Section n="03" title="Shipping Method">
            <div className="grid sm:grid-cols-2 gap-3">
              <Option selected={form.shippingMethod === "standard"} onClick={() => set("shippingMethod", "standard")}
                icon={Truck} title="Standard Shipping" desc={afterCoupon >= 150 ? "FREE (over $150)" : "$12.99 · 3-7 business days"} />
              <Option selected={form.shippingMethod === "pickup"} onClick={() => set("shippingMethod", "pickup")}
                icon={Store} title="Local Pickup" desc="Free · Saskatoon studio" />
            </div>
          </Section>

          <Section n="04" title="Discount Code">
            <div className="flex gap-2">
              <input value={form.discountCode} onChange={(e) => set("discountCode", e.target.value)}
                placeholder="Enter code" className="flex-1 bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
              <button onClick={applyCoupon} className="bg-primary text-primary-foreground px-4 font-bold uppercase text-sm hover:opacity-90">Apply</button>
            </div>
            {appliedDiscount && <p className="mt-2 text-sm text-accent flex items-center gap-1"><Check size={14} /> Code applied: {form.discountCode}</p>}
          </Section>

          <Section n="05" title="Order Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3}
              placeholder="Anything we should know?" className="w-full bg-background border border-border px-3 py-2 outline-none focus:border-accent" />
          </Section>

          <Section n="06" title="Payment">
            <div className="border border-border p-4 bg-secondary flex items-center gap-3">
              <CreditCard size={22} />
              <div>
                <div className="font-bold text-sm">Stripe Secure Checkout</div>
                <div className="text-xs text-muted-foreground">Card, Apple Pay & Google Pay. Your card details are never stored by GDP.</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Lock size={12} /> Encrypted payment processed at order placement.</p>
          </Section>
        </div>

        <aside className="bg-card border border-border p-6 h-fit sticky top-24">
          <h2 className="font-display text-3xl mb-4">YOUR ORDER</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
            {items.map(i => (
              <div key={i.key} className="flex justify-between text-sm">
                <span className="pr-2">{i.quantity}× {i.name} <span className="text-muted-foreground">({i.color} {i.size})</span>{i.isCustom && <span className="block text-[10px] font-mono uppercase text-accent">{i.occasion || "Custom"} · {i.proofRequired === false ? "Proof skipped" : "Proof before print"}</span>}</span>
                <span className="font-mono shrink-0">${(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-sm border-t border-border pt-4">
            <Row k="Subtotal" v={`$${subtotal.toFixed(2)}`} />
            {discountAmt > 0 && <Row k="Qty discount" v={`-$${discountAmt.toFixed(2)}`} accent />}
            {couponAmt > 0 && <Row k="Coupon" v={`-$${couponAmt.toFixed(2)}`} accent />}
            <Row k="Shipping" v={shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`} />
            <Row k="Tax" v={`$${tax.toFixed(2)}`} />
          </div>
          <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-border">
            <span>Total CAD</span><span className="font-mono">${total.toFixed(2)}</span>
          </div>

          {error && <div className="mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2"><AlertTriangle size={16} />{error}</div>}

          <button onClick={placeOrder} disabled={placing}
            className="w-full mt-5 bg-accent text-accent-foreground py-4 font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50">
            {placing ? "Placing Order…" : `Place Order · $${total.toFixed(2)}`}
          </button>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">By placing your order you agree to GDP Clothing's terms. Custom items require proof approval before printing.</p>
        </aside>
      </div>
    </div>
  );
}

function Section({ n, title, children }) {
  return <div><div className="flex items-center gap-2 mb-3"><span className="font-mono text-xs text-accent">{n}</span><h2 className="font-display text-2xl">{title}</h2></div>{children}</div>;
}
function Input({ label, value, onChange, type = "text" }) {
  return <div><label className="font-mono text-xs uppercase text-muted-foreground">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background border border-border px-3 py-2 mt-1 outline-none focus:border-accent" /></div>;
}
function Option({ selected, onClick, icon: Icon, title, desc }) {
  return <button onClick={onClick}
    className={`border p-4 text-left flex items-center gap-3 transition-colors ${selected ? "border-accent bg-accent/5" : "border-border hover:border-accent"}`}>
    <Icon size={20} /><div><div className="font-bold text-sm">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
  </button>;
}
function Row({ k, v, accent }) { return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={`font-mono ${accent ? "text-accent" : ""}`}>{v}</span></div>; }