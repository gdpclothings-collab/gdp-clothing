import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, CreditCard, Check, AlertTriangle, Truck, Store } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { removeStoredKey, scopedStorageKey } from "@/lib/customerStorageScope";
import { customerApi } from "@/lib/customerApi";
import { isIframe } from "@/lib/utils";
import { loadStripe } from "@stripe/stripe-js";
import { calculateCartQuantityDiscount } from "@/lib/cartPricing";

const PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Northwest Territories",
  "Nova Scotia",
  "Nunavut",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Yukon",
];

const FALLBACK_TAX_RATES = {
  Alberta: 0.05,
  "British Columbia": 0.05,
  Manitoba: 0.05,
  "New Brunswick": 0.15,
  "Newfoundland and Labrador": 0.15,
  "Northwest Territories": 0.05,
  "Nova Scotia": 0.14,
  Nunavut: 0.05,
  Ontario: 0.13,
  "Prince Edward Island": 0.15,
  Quebec: 0.05,
  Saskatchewan: 0.11,
  Yukon: 0.05,
};

const CANADIAN_POSTAL_CODE_RE = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;

function normalizeCanadianPostalCode(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!CANADIAN_POSTAL_CODE_RE.test(compact)) return "";
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

export default function Checkout() {
  const { items, clearCart } = useCart();
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const checkoutStorageKey = scopedStorageKey("gdp_checkout_session_v2", user);
  const [form, setForm] = useState({
    email: "", phone: "", firstName: "", lastName: "",
    address: "", address2: "", city: "", province: "Saskatchewan", postalCode: "", country: "Canada",
    shippingMethod: "standard", notes: "", discountCode: "",
    termsAccepted: false, marketingConsent: false
  });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [checkoutConfig, setCheckoutConfig] = useState(null);
  const [checkoutActions, setCheckoutActions] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);
  const [paymentCanConfirm, setPaymentCanConfirm] = useState(false);
  const [checkoutSessionToken, setCheckoutSessionToken] = useState("");
  const [loadedCheckoutStorageKey, setLoadedCheckoutStorageKey] = useState("");
  const paymentHostRef = useRef(null);
  const autoPreparingRef = useRef(false);

  const quantityPricing = calculateCartQuantityDiscount(items);
  const subtotal = quantityPricing.subtotal;
  const discounted = quantityPricing.afterDiscount;
  const discountAmt = quantityPricing.discount;
  const couponAmt = appliedDiscount ? (appliedDiscount.type === "fixed" ? appliedDiscount.value : discounted * (appliedDiscount.value / 100)) : 0;
  const afterCoupon = Math.max(0, discounted - couponAmt);
  const fallbackShipping =
    form.shippingMethod === "pickup" || appliedDiscount?.type === "free_shipping"
      ? 0
      : (afterCoupon >= 150 ? 0 : 12.99);
  const shipping = checkoutConfig?.shipping ?? fallbackShipping;
  const taxRate = checkoutConfig?.taxRate ?? (FALLBACK_TAX_RATES[form.province] ?? 0.05);
  const taxShipping = checkoutConfig?.taxShipping ?? true;
  const tax = (afterCoupon + (taxShipping ? shipping : 0)) * taxRate;
  const total = afterCoupon + shipping + tax;

  useEffect(() => {
    if (isLoadingAuth) {
      setLoadedCheckoutStorageKey("");
      return;
    }

    let token = "";
    try {
      token = window.localStorage.getItem(checkoutStorageKey) || "";
      if (!token) {
        token = crypto.randomUUID();
        window.localStorage.setItem(checkoutStorageKey, token);
      }
    } catch {
      token = crypto.randomUUID();
    }
    setCheckoutSessionToken(token);
    setLoadedCheckoutStorageKey(checkoutStorageKey);
    removeStoredKey("gdp_checkout_session");
  }, [checkoutStorageKey, isLoadingAuth]);

  useEffect(() => {
    if (!items.length || checkoutActions) return undefined;

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const data = await customerApi.getCheckoutConfig({
          amount: afterCoupon,
          province: form.province,
          shippingMethod: form.shippingMethod,
          freeShipping: appliedDiscount?.type === "free_shipping",
        });
        if (active) setCheckoutConfig(data);
      } catch (configError) {
        if (active) setCheckoutConfig(null);
        console.debug("Checkout pricing configuration fallback:", configError?.message || configError);
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    items.length,
    afterCoupon,
    form.province,
    form.shippingMethod,
    appliedDiscount?.type,
    checkoutActions,
  ]);

  useEffect(() => {
    if (!items.length || checkoutActions || loadedCheckoutStorageKey !== checkoutStorageKey) return undefined;

    const timer = window.setTimeout(async () => {
      try {
        const result = await customerApi.trackCheckout(
          items,
          form,
          {
            subtotal,
            discount: discountAmt + couponAmt,
            shipping,
            tax,
            total,
          },
          checkoutSessionToken
        );

        if (result?.sessionToken && result.sessionToken !== checkoutSessionToken) {
          setCheckoutSessionToken(result.sessionToken);
          try {
            window.localStorage.setItem(checkoutStorageKey, result.sessionToken);
          } catch {
            // Checkout tracking still works for the current page without local storage.
          }
        }
      } catch (trackingError) {
        console.debug("Checkout session tracking skipped:", trackingError?.message || trackingError);
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    items,
    form,
    subtotal,
    discountAmt,
    couponAmt,
    shipping,
    tax,
    total,
    checkoutSessionToken,
    checkoutActions,
    checkoutStorageKey,
    loadedCheckoutStorageKey,
  ]);

  const applyCoupon = async () => {
    if (!form.discountCode) return;
    setError("");
    try {
      const data = await customerApi.validateCoupon(form.discountCode, discounted);
      if (data?.active) setAppliedDiscount(data); else setError("Invalid or expired code.");
    } catch { setError("Could not validate code."); }
  };

  const placeOrder = async () => {
    setError("");

    if (!checkoutActions) {
      if (!form.email || !form.firstName || !form.lastName || !form.address || !form.city || !form.postalCode) {
        setError("Please complete the required contact and delivery fields.");
        return;
      }
      if (!form.termsAccepted) {
        setError("Accept the Terms & Conditions and acknowledge the Privacy Policy to place your order.");
        return;
      }
      const normalizedPostalCode = normalizeCanadianPostalCode(form.postalCode);
      if (!normalizedPostalCode) {
        setError("Enter a valid Canadian postal code in the format A1A 1A1.");
        return;
      }
      const checkoutForm = {
        ...form,
        country: "Canada",
        postalCode: normalizedPostalCode,
      };
      if (form.postalCode !== normalizedPostalCode) {
        setForm((current) => ({ ...current, postalCode: normalizedPostalCode }));
      }
      if (isIframe) {
        setError("Checkout works only from the published app. Open the app in a new tab to complete payment.");
        return;
      }

      setPlacing(true);
      try {
        let orderSessionToken = checkoutSessionToken || crypto.randomUUID();
        const trackedCheckout = await customerApi.trackCheckout(
          items,
          checkoutForm,
          {
            subtotal,
            discount: discountAmt + couponAmt,
            shipping,
            tax,
            total,
          },
          orderSessionToken
        );
        if (trackedCheckout?.sessionToken) {
          orderSessionToken = trackedCheckout.sessionToken;
          setCheckoutSessionToken(orderSessionToken);
          try {
            window.localStorage.setItem(checkoutStorageKey, orderSessionToken);
          } catch {
            // Checkout can continue for this page without local storage.
          }
        }

        const data = await customerApi.createOrder(
          items,
          checkoutForm,
          checkoutForm.discountCode,
          window.location.origin,
          orderSessionToken
        );

        if (data?.paid && data?.orderNumber) {
          try {
            window.localStorage.removeItem(checkoutStorageKey);
          } catch {
            // Local storage is optional.
          }
          clearCart();
          const paidToken = data.confirmationToken
            ? `&token=${encodeURIComponent(data.confirmationToken)}`
            : "";
          navigate(`/order/${data.orderNumber}?status=success${paidToken}`);
          return;
        }

        if (data?.error) {
          setError(data.message || "Order could not be prepared. Please try again.");
          return;
        }

        if (data?.pricing) {
          setCheckoutConfig((previous) => ({
            ...(previous || {}),
            shipping: Number(data.pricing.shipping || 0),
            taxRate: Number(data.pricing.taxRate || 0),
            taxName: data.pricing.taxName || previous?.taxName || "Tax",
          }));
        }

        if (!data?.configured || !data?.clientSecret || !data?.publishableKey) {
          setError(
            data?.missing
              ? `Stripe payment setup is missing ${data.missing}.`
              : "Stripe embedded payment is not fully configured yet."
          );
          return;
        }

        const stripe = await loadStripe(data.publishableKey);
        if (!stripe) throw new Error("Stripe.js could not load.");

        const checkout = stripe.initCheckoutElementsSdk({
          clientSecret: data.clientSecret,
        });

        const loaded = await checkout.loadActions();
        if (loaded.type !== "success") {
          throw new Error(loaded.error?.message || "Stripe payment form could not initialize.");
        }

        const paymentElement = checkout.createPaymentElement();
        paymentElement.mount(paymentHostRef.current);

        checkout.on("change", (session) => {
          setPaymentCanConfirm(Boolean(session?.canConfirm));
        });

        const session = loaded.actions.getSession();
        setPaymentCanConfirm(Boolean(session?.canConfirm));
        setCheckoutActions(loaded.actions);
        setPaymentSession({
          orderNumber: data.orderNumber,
          confirmationToken: data.confirmationToken,
        });

        window.setTimeout(() => {
          paymentHostRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      } catch (e) {
        console.error("Stripe embedded checkout initialization failed:", e);
        setError(e?.message || "Could not load secure payment fields. Please try again.");
      } finally {
        setPlacing(false);
      }
      return;
    }

    if (!paymentCanConfirm) {
      setError("Please complete your payment information before placing the order.");
      paymentHostRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setPlacing(true);
    try {
      const result = await checkoutActions.confirm();

      if (result?.type === "error") {
        setError(result.error?.message || "Payment could not be completed.");
        return;
      }

      try {
        window.localStorage.removeItem(checkoutStorageKey);
      } catch {
        // Local storage is optional.
      }
      clearCart();
      if (paymentSession?.orderNumber) {
        const token = paymentSession.confirmationToken
          ? `&token=${encodeURIComponent(paymentSession.confirmationToken)}`
          : "";
        navigate(`/order/${paymentSession.orderNumber}?status=success${token}`);
      }
    } catch (e) {
      console.error("Stripe payment confirmation failed:", e);
      setError(e?.message || "Payment could not be completed. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const set = (k, v) => {
    if (checkoutActions) {
      setError("Payment is already prepared. Refresh checkout if you need to change order details.");
      return;
    }
    setForm({ ...form, [k]: v });
  };

  const checkoutDetailsComplete = Boolean(
    form.email &&
    form.firstName &&
    form.lastName &&
    form.address &&
    form.city &&
    normalizeCanadianPostalCode(form.postalCode) &&
    form.termsAccepted
  );

  useEffect(() => {
    if (!checkoutDetailsComplete || checkoutActions || placing || autoPreparingRef.current || isIframe) return;
    autoPreparingRef.current = true;
    void placeOrder();
  }, [checkoutDetailsComplete]); // Stripe is prepared once, as soon as checkout details are complete.

  if (items.length === 0) {
    return <div className="max-w-[1500px] mx-auto px-4 py-20 text-center"><h1 className="font-display text-4xl">Cart is empty</h1><Link to="/shop" className="text-accent mt-4 inline-block">Browse products</Link></div>;
  }

  return (
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
      <h1 className="font-display text-5xl md:text-6xl leading-none mb-8">CHECKOUT</h1>
      <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">{user ? `Checking out as ${user.email}` : "Guest checkout is ready"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {user ? "Your order will also appear in your account." : "No account required. Enter your contact and delivery information below."}
          </p>
        </div>
        {!user && <Link to="/login?returnTo=/checkout" className="shrink-0 text-sm font-semibold text-accent hover:underline">Already have an account? Sign in</Link>}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8">
        <div className="space-y-8">
          <Section n="01" title="Contact">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Email" value={form.email} onChange={v => set("email", v)} type="email" />
              <Input label="Phone" value={form.phone} onChange={v => set("phone", v)} />
            </div>
            <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <input
                type="checkbox"
                checked={Boolean(form.marketingConsent)}
                onChange={(e) => set("marketingConsent", e.target.checked)}
                className="mt-1"
              />
              <span>
                Email me GDP Clothing news, drops and special offers. This is optional and can be withdrawn at any time.{" "}
                <Link to="/pages/marketing-consent" target="_blank" className="underline hover:text-foreground">Marketing consent details</Link>
              </span>
            </label>
          </Section>

          <Section n="02" title="Shipping Address">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="First name" value={form.firstName} onChange={v => set("firstName", v)} />
              <Input label="Last name" value={form.lastName} onChange={v => set("lastName", v)} />
              <div className="sm:col-span-2"><Input label="Address" value={form.address} onChange={v => set("address", v)} /></div>
              <div className="sm:col-span-2"><Input label="Apartment, suite, etc. (optional)" value={form.address2} onChange={v => set("address2", v)} /></div>
              <Input label="City" value={form.city} onChange={v => set("city", v)} />
              <SelectInput label="Province/Territory" value={form.province} onChange={v => set("province", v)} options={PROVINCES} />
              <Input label="Postal Code" value={form.postalCode} onChange={v => set("postalCode", v)} />
              <Input label="Country" value={form.country} readOnly />
            </div>
          </Section>

          <Section n="03" title="Shipping Method">
            <div className="grid sm:grid-cols-2 gap-3">
              <Option selected={form.shippingMethod === "standard"} onClick={() => set("shippingMethod", "standard")}
                icon={Truck} title="Standard Shipping" desc={shipping === 0 ? "FREE · 3-7 business days" : `$${shipping.toFixed(2)} · 3-7 business days`} />
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
            {paymentSession?.paymentMode === "test" && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
                <div className="flex items-center gap-2 text-sm font-bold"><AlertTriangle size={16} /> Payment Test Mode</div>
                <p className="mt-1 text-xs leading-5">This checkout uses Stripe test payments. No real money will be charged.</p>
              </div>
            )}
            <div className="rounded-xl border border-border p-4 bg-secondary/50 flex items-center gap-3 mb-4">
              <CreditCard size={22} />
              <div>
                <div className="font-bold text-sm">Stripe Secure Payment</div>
                <div className="text-xs text-muted-foreground">
                  Card details stay encrypted with Stripe and are never stored by GDP Clothing.
                </div>
              </div>
            </div>

            <label className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-sm leading-5">
              <input
                type="checkbox"
                checked={Boolean(form.termsAccepted)}
                onChange={(e) => set("termsAccepted", e.target.checked)}
                className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]"
              />
              <span>
                I agree to the <Link to="/pages/terms" target="_blank" className="font-semibold text-accent hover:underline">Terms & Conditions</Link> and acknowledge the <Link to="/pages/privacy" target="_blank" className="font-semibold text-accent hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            {!checkoutActions && (
              <div className="min-h-[150px] rounded-xl border border-border bg-secondary/25 p-5 text-sm text-muted-foreground flex items-center justify-center text-center">
                <div className="max-w-md">
                  <Lock size={20} className="mx-auto mb-2 text-foreground" />
                  <p className="font-semibold text-foreground">
                    {placing ? "Loading secure payment…" : "Secure payment fields will open automatically"}
                  </p>
                  <p className="mt-1">Complete the required details above and accept the terms. You will stay on this page.</p>
                </div>
              </div>
            )}

            <div
              ref={paymentHostRef}
              className={`bg-background ${checkoutActions ? "rounded-xl border border-border p-4 min-h-[180px]" : "h-0 overflow-hidden"}`}
            />

            {checkoutActions && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lock size={12} /> Payment information is securely handled by Stripe on this checkout page.
              </p>
            )}
          </Section>
        </div>

        <aside className="bg-card border border-border rounded-2xl p-6 h-fit sticky top-24 shadow-sm">
          <h2 className="font-display text-3xl mb-4">YOUR ORDER</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
            {items.map(i => (
              <div key={i.key} className="flex justify-between gap-2 text-sm">
                {i.isDtf && i.image && (
                  <img src={i.image} alt={`${i.name} layout preview`} className="h-14 w-12 shrink-0 border border-border bg-white object-contain" />
                )}
                <span className="min-w-0 flex-1 pr-2">
                  {i.quantity}× {i.name} <span className="text-muted-foreground">({i.color} {i.size})</span>
                  {i.isCustom && <span className="block text-[10px] font-mono uppercase text-accent">{i.occasion || "Custom"} · {i.proofRequired === false ? "Proof skipped" : "Proof before print"}</span>}
                  {i.isDtf && i.dtfSpec && (
                    <span className="block text-[10px] font-mono uppercase text-accent">
                      DTF film · {i.dtfSpec.width}" × {i.dtfSpec.length}" · {i.dtfSpec.layout?.length || 0} artwork item{i.dtfSpec.layout?.length === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
                <span className="font-mono shrink-0">${(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-sm border-t border-border pt-4">
            <Row k="Subtotal" v={`$${subtotal.toFixed(2)}`} />
            {discountAmt > 0 && <Row k="Qty discount" v={`-$${discountAmt.toFixed(2)}`} accent />}
            {couponAmt > 0 && <Row k="Coupon" v={`-$${couponAmt.toFixed(2)}`} accent />}
            <Row k="Shipping" v={shipping === 0 ? "FREE" : `$${shipping.toFixed(2)}`} />
            <Row k={checkoutConfig?.taxName || "Tax"} v={`${tax.toFixed(2)}`} />
          </div>
          <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-border">
            <span>Total CAD</span><span className="font-mono">${total.toFixed(2)}</span>
          </div>

          {error && <div className="mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2"><AlertTriangle size={16} />{error}</div>}

          <button
            onClick={placeOrder}
            disabled={placing || !checkoutDetailsComplete || (Boolean(checkoutActions) && !paymentCanConfirm)}
            className="w-full mt-5 rounded-lg bg-accent text-accent-foreground py-4 font-bold uppercase tracking-wide hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {placing
              ? (checkoutActions ? "Processing order…" : "Preparing secure payment…")
              : `Place order · $${total.toFixed(2)}`}
          </button>
          {!checkoutDetailsComplete && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Complete the required fields and accept the terms to place your order.</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Secure payment fields are provided by Stripe. GDP Clothing does not intentionally store full card numbers or card security codes.{" "}
            <Link to="/pages/payment-security" className="underline hover:text-foreground">Payment security</Link>
            {" · "}
            <Link to="/pages/returns-refunds" className="underline hover:text-foreground">Returns</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}

function Section({ n, title, children }) {
  return <div><div className="flex items-center gap-2 mb-3"><span className="font-mono text-xs text-accent">{n}</span><h2 className="font-display text-2xl">{title}</h2></div>{children}</div>;
}
function Input({ label, value, onChange = undefined, type = "text", readOnly = false }) {
  const id = `checkout-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <div><label htmlFor={id} className="font-mono text-xs uppercase text-muted-foreground">{label}</label>
    <input id={id} type={type} value={value} readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full bg-background border border-border px-3 py-2 mt-1 outline-none focus:border-accent read-only:opacity-70" /></div>;
}
function SelectInput({ label, value, onChange, options }) {
  const id = `checkout-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <div><label htmlFor={id} className="font-mono text-xs uppercase text-muted-foreground">{label}</label>
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background border border-border px-3 py-2 mt-1 outline-none focus:border-accent">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select></div>;
}
function Option({ selected, onClick, icon: Icon, title, desc }) {
  return <button onClick={onClick}
    className={`border p-4 text-left flex items-center gap-3 transition-colors ${selected ? "border-accent bg-accent/5" : "border-border hover:border-accent"}`}>
    <Icon size={20} /><div><div className="font-bold text-sm">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
  </button>;
}
function Row({ k, v, accent = false }) { return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={`font-mono ${accent ? "text-accent" : ""}`}>{v}</span></div>; }
