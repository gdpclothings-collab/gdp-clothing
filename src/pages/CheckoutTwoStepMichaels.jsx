import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Check, CreditCard, Lock, Store, Truck } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { customerApi } from "@/lib/customerApi";
import { paymentApi } from "@/lib/paymentApi";
import { calculateCartQuantityDiscount } from "@/lib/cartPricing";
import { scopedStorageKey } from "@/lib/customerStorageScope";
import { isIframe } from "@/lib/utils";

const PROVINCES = ["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Northwest Territories","Nova Scotia","Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon"];
const FALLBACK_TAX_RATES = { Alberta:.05,"British Columbia":.05,Manitoba:.05,"New Brunswick":.15,"Newfoundland and Labrador":.15,"Northwest Territories":.05,"Nova Scotia":.14,Nunavut:.05,Ontario:.13,"Prince Edward Island":.15,Quebec:.05,Saskatchewan:.11,Yukon:.05 };
const POSTAL = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;
const FORM_KEY = "gdp_checkout_form_v3";

function normalizePostal(value) {
  const v = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return POSTAL.test(v) ? `${v.slice(0,3)} ${v.slice(3)}` : "";
}

function initialForm() {
  const fallback = { email:"",phone:"",firstName:"",lastName:"",address:"",address2:"",city:"",province:"Saskatchewan",postalCode:"",country:"Canada",shippingMethod:"standard",notes:"",discountCode:"",termsAccepted:false,marketingConsent:false };
  try {
    return { ...fallback, ...JSON.parse(sessionStorage.getItem(FORM_KEY) || "{}"), termsAccepted:false };
  } catch {
    return fallback;
  }
}

function cents(value) {
  return Math.max(50, Math.round(Number(value || 0) * 100));
}

export default function CheckoutTwoStepMichaels() {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isPayment = location.pathname === "/checkout/payment";
  const tokenKey = scopedStorageKey("gdp_checkout_session_v2", user);

  const [form, setForm] = useState(initialForm);
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [paymentClient, setPaymentClient] = useState(null);
  const [canConfirm, setCanConfirm] = useState(false);
  const [paymentMode, setPaymentMode] = useState("live");
  const [paymentReady, setPaymentReady] = useState(false);
  const paymentHost = useRef(null);
  const paymentElement = useRef(null);
  const tracking = useRef(null);
  const trackedToken = useRef("");

  useEffect(() => {
    if (user?.email) setForm((v) => v.email ? v : { ...v, email:user.email });
  }, [user?.email]);

  useEffect(() => {
    try { sessionStorage.setItem(FORM_KEY, JSON.stringify(form)); } catch {}
  }, [form]);

  // Safe preloading only: this fetches the publishable Stripe configuration and
  // loads Stripe.js. It does not create an order, reserve inventory, create a
  // Checkout Session, or create a PaymentIntent.
  useEffect(() => {
    if (isIframe) return;
    paymentApi.getBootstrap()
      .then((bootstrap) => bootstrap?.publishableKey ? loadStripe(bootstrap.publishableKey) : null)
      .catch(() => {});
  }, []);

  const pricing = calculateCartQuantityDiscount(items);
  const subtotal = pricing.subtotal;
  const quantityDiscount = pricing.discount;
  const discounted = pricing.afterDiscount;
  const coupon = appliedDiscount ? Math.max(0, Number(appliedDiscount.amount || 0)) : 0;
  const afterCoupon = Math.max(0, discounted - coupon);
  const checkoutPostalCode = normalizePostal(form.postalCode);
  const checkoutShippingItems = items.map((item) => ({ productId:item.productId, amount:Math.max(0, Number(item.price || 0)) * Math.max(1, Number(item.quantity || 1)), quantity:Math.max(1, Number(item.quantity || 1)) }));
  const checkoutDiscountItems = Object.entries(pricing.discountedByProduct || {}).map(([productId, amount]) => ({ productId, amount:Math.max(0, Number(amount || 0)) }));
  const checkoutShippingKey = checkoutShippingItems.map((item) => `${item.productId}:${Number(item.amount || 0).toFixed(2)}:${Number(item.quantity || 1)}`).sort().join(",");
  const checkoutConfigKey = `${afterCoupon.toFixed(2)}|${form.province}|${checkoutPostalCode}|${form.shippingMethod}|${appliedDiscount?.type === "free_shipping" ? 1 : 0}|${checkoutShippingKey}`;
  const activeConfig = config?.requestKey === checkoutConfigKey ? config : null;
  const fallbackShipping = form.shippingMethod === "pickup" || appliedDiscount?.type === "free_shipping" ? 0 : (afterCoupon >= 150 ? 0 : 12.99);
  const shipping = activeConfig?.shipping ?? fallbackShipping;
  const taxRate = activeConfig?.taxRate ?? (FALLBACK_TAX_RATES[form.province] ?? .05);
  const tax = activeConfig
    ? (afterCoupon + ((activeConfig?.taxShipping ?? true) ? shipping : 0)) * taxRate
    : form.province === "Saskatchewan"
      ? (afterCoupon + shipping) * 0.05 + afterCoupon * 0.06
      : (afterCoupon + shipping) * taxRate;
  const total = afterCoupon + shipping + tax;

  useEffect(() => {
    if (!items.length || placing) return;
    const requestKey = checkoutConfigKey;
    const timer = setTimeout(async () => {
      try {
        const nextConfig = await customerApi.getCheckoutConfig({
          amount:afterCoupon,
          province:form.province,
          postalCode:checkoutPostalCode,
          shippingMethod:form.shippingMethod,
          freeShipping:appliedDiscount?.type === "free_shipping",
          shippingItems:checkoutShippingItems,
        });
        setConfig({ ...nextConfig, requestKey });
      } catch {
        setConfig((v) => v?.requestKey === requestKey ? null : v);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [items.length, checkoutConfigKey, placing]);

  const set = (key, value) => {
    setError("");
    setForm((v) => ({ ...v, [key]:value }));
  };
  const detailsComplete = Boolean(form.email && form.firstName && form.lastName && form.address && form.city && normalizePostal(form.postalCode));

  const ensureToken = (fresh = false) => {
    let token = "";
    try { token = fresh ? "" : localStorage.getItem(tokenKey) || ""; } catch {}
    if (!token) token = crypto.randomUUID();
    try { localStorage.setItem(tokenKey, token); } catch {}
    return token;
  };

  const applyCoupon = async () => {
    if (!form.discountCode) return;
    setError("");
    try {
      const d = await customerApi.validateCoupon(form.discountCode, discounted, checkoutDiscountItems);
      if (d?.active) {
        setAppliedDiscount(d);
        return;
      }
      if (d?.reason === "not_applicable") return setError("This discount code does not apply to the items in your cart.");
      if (d?.reason === "minimum_purchase") return setError(`This code requires at least $${Number(d.minPurchase || 0).toFixed(2)} in eligible products.`);
      setError("Invalid or expired code.");
    } catch {
      setError("Could not validate code.");
    }
  };

  const beginCheckoutTracking = () => {
    if (!items.length || !detailsComplete || isIframe) return Promise.resolve();
    const token = ensureToken();
    if (tracking.current && trackedToken.current === token) return tracking.current;
    const checkoutForm = { ...form, postalCode:normalizePostal(form.postalCode), country:"Canada", termsAccepted:false };
    trackedToken.current = token;
    const promise = customerApi.trackCheckout(
      items,
      checkoutForm,
      { subtotal, discount:quantityDiscount + coupon, shipping, tax, total },
      token,
    ).catch((e) => {
      if (trackedToken.current === token) {
        tracking.current = null;
        trackedToken.current = "";
      }
      throw e;
    });
    tracking.current = promise;
    return promise;
  };

  const continueToPayment = () => {
    setError("");
    if (!detailsComplete) return setError("Please complete the required contact and delivery fields.");
    const postalCode = normalizePostal(form.postalCode);
    if (!postalCode) return setError("Enter a valid Canadian postal code in the format A1A 1A1.");

    const next = { ...form, postalCode, country:"Canada", termsAccepted:false };
    setForm(next);
    try { sessionStorage.setItem(FORM_KEY, JSON.stringify(next)); } catch {}
    tracking.current = null;
    trackedToken.current = "";
    ensureToken(true);
    navigate("/checkout/payment");
  };

  const editInformation = () => {
    tracking.current = null;
    trackedToken.current = "";
    ensureToken(true);
    setCanConfirm(false);
    setPaymentClient(null);
    setPaymentReady(false);
    setError("");
    setForm((v) => ({ ...v, termsAccepted:false }));
    navigate("/checkout");
  };

  // Track the completed checkout details after Step 2 is visible, but delay the
  // analytics/recovery request slightly so it cannot compete with Stripe UI
  // bootstrap on the critical render path.
  useEffect(() => {
    if (!isPayment || !items.length || !detailsComplete || isIframe) return;
    const timer = setTimeout(() => beginCheckoutTracking().catch(() => {}), 900);
    return () => clearTimeout(timer);
  }, [isPayment, items.length, detailsComplete]);

  // Michaels-style payment bootstrap: Payment Element is rendered before any
  // GDP order, inventory reservation, Checkout Session, or PaymentIntent exists.
  useEffect(() => {
    if (!isPayment || !items.length || !detailsComplete) return;
    if (isIframe) {
      setError("Checkout works only from the published app. Open the app in a new tab to complete payment.");
      return;
    }

    let cancelled = false;
    let element = null;
    setPaymentReady(false);
    setCanConfirm(false);
    setError("");

    (async () => {
      try {
        const bootstrap = await paymentApi.getBootstrap();
        if (cancelled) return;
        if (!bootstrap?.configured || !bootstrap?.publishableKey) throw new Error("Secure payment is temporarily unavailable. No charge was attempted.");

        const stripe = await loadStripe(bootstrap.publishableKey);
        if (!stripe || cancelled) throw new Error("Stripe.js could not load.");

        const elements = stripe.elements({
          mode:"payment",
          currency:"cad",
          amount:cents(total),
          appearance:{ theme:"stripe" },
        });

        element = elements.create("payment", {
          layout:{ type:"accordion", defaultCollapsed:false, radios:true, spacedAccordionItems:true },
          paymentMethodOrder:["card","link","klarna","affirm"],
          defaultValues:{
            billingDetails:{
              name:[form.firstName, form.lastName].filter(Boolean).join(" "),
              email:form.email || undefined,
              phone:form.phone || undefined,
              address:{
                line1:form.address || undefined,
                line2:form.address2 || undefined,
                city:form.city || undefined,
                state:form.province || undefined,
                postal_code:normalizePostal(form.postalCode) || undefined,
                country:"CA",
              },
            },
          },
        });
        paymentElement.current = element;
        element.on("change", (event) => setCanConfirm(Boolean(event?.complete)));
        element.on("ready", () => setPaymentReady(true));
        element.mount(paymentHost.current);
        setPaymentMode(bootstrap.paymentMode === "test" ? "test" : "live");
        setPaymentClient({ stripe, elements });
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Could not load secure payment. Please try again.");
          setPaymentReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try { element?.destroy(); } catch {}
      paymentElement.current = null;
    };
  }, [isPayment, items.length, detailsComplete]);

  // Keep the deferred Payment Element display amount aligned with the current
  // checkout total. The server still recalculates and owns the final amount.
  useEffect(() => {
    if (!paymentClient?.elements) return;
    try { paymentClient.elements.update({ amount:cents(total) }); } catch {}
  }, [paymentClient, total]);

  const applyAuthoritativePricing = (data) => {
    if (!data?.pricing) return;
    setConfig((v) => ({
      ...(v?.requestKey === checkoutConfigKey ? v : {}),
      requestKey:checkoutConfigKey,
      shipping:Number(data.pricing.shipping || 0),
      taxRate:Number(data.pricing.taxRate || 0),
      taxName:data.pricing.taxName || (v?.requestKey === checkoutConfigKey ? v?.taxName : null) || "Tax",
    }));
    if (form.discountCode) {
      if (data.pricing.couponCode) setAppliedDiscount((current) => current ? { ...current, amount:Number(data.pricing.couponAmount || 0) } : current);
      else setAppliedDiscount(null);
    }
  };

  const pay = async () => {
    setError("");
    if (!form.termsAccepted) return setError("Accept the Terms & Conditions and acknowledge the Privacy Policy to place your order.");
    if (!paymentClient?.stripe || !paymentClient?.elements || !canConfirm) return setError("Please complete your payment information before placing the order.");

    setPlacing(true);
    try {
      const submitted = await paymentClient.elements.submit();
      if (submitted?.error) throw new Error(submitted.error.message || "Please check your payment information.");

      const token = ensureToken();
      const checkoutForm = { ...form, postalCode:normalizePostal(form.postalCode), country:"Canada", termsAccepted:false };
      if (tracking.current && trackedToken.current === token) await tracking.current;
      else await customerApi.trackCheckout(items, checkoutForm, { subtotal, discount:quantityDiscount + coupon, shipping, tax, total }, token);

      const orderData = await customerApi.createOrder(items, checkoutForm, checkoutForm.discountCode, window.location.origin, token);
      if (orderData?.paid && orderData?.orderNumber) {
        clearCart();
        const t = orderData.confirmationToken ? `?token=${encodeURIComponent(orderData.confirmationToken)}` : "";
        navigate(`/order/${orderData.orderNumber}${t}`, { replace:true });
        return;
      }
      if (orderData?.error) throw new Error(orderData.message || "Order could not be prepared. Please try again.");
      if (!orderData?.orderNumber || !orderData?.confirmationToken) throw new Error("The order was not prepared correctly. No charge was attempted.");
      applyAuthoritativePricing(orderData);

      let bridge;
      const returnedClientSecret = String(orderData.clientSecret || "");
      if (returnedClientSecret.startsWith("pi_") && String(orderData.paymentIntentId || "").startsWith("pi_")) {
        bridge = {
          configured:true,
          clientSecret:returnedClientSecret,
          paymentIntentId:orderData.paymentIntentId,
          amount:Math.round(Number(orderData.pricing?.total ?? total) * 100),
          orderNumber:orderData.orderNumber,
          confirmationToken:orderData.confirmationToken,
        };
      } else {
        bridge = await paymentApi.createPaymentIntent({
          orderNumber:orderData.orderNumber,
          confirmationToken:orderData.confirmationToken,
          checkoutSessionToken:token,
        });
      }

      if (bridge?.paid) {
        const t = bridge.confirmationToken ? `?token=${encodeURIComponent(bridge.confirmationToken)}` : "";
        navigate(`/order/${bridge.orderNumber}${t}`, { replace:true });
        return;
      }
      if (!bridge?.configured || !bridge?.clientSecret) throw new Error("The secure payment could not be prepared. No charge was attempted.");

      const authoritativeAmount = Math.max(50, Number(bridge.amount || 0));
      if (authoritativeAmount !== cents(total)) {
        paymentClient.elements.update({ amount:authoritativeAmount });
        const resubmitted = await paymentClient.elements.submit();
        if (resubmitted?.error) throw new Error(resubmitted.error.message || "Please review your payment information after the order total update.");
      }

      await customerApi.acceptCheckoutPolicies(orderData.orderNumber, orderData.confirmationToken, token);

      const returnUrl = `${window.location.origin}/order/${encodeURIComponent(orderData.orderNumber)}?status=success&token=${encodeURIComponent(orderData.confirmationToken)}`;
      const result = await paymentClient.stripe.confirmPayment({
        elements:paymentClient.elements,
        clientSecret:bridge.clientSecret,
        confirmParams:{ return_url:returnUrl },
        redirect:"if_required",
      });
      if (result?.error) throw new Error(result.error.message || "Payment could not be completed.");

      navigate(`/order/${orderData.orderNumber}?status=success&token=${encodeURIComponent(orderData.confirmationToken)}`, { replace:true });
    } catch (e) {
      setError(e?.message || "Payment could not be completed. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (!items.length) {
    return <div className="max-w-[1500px] mx-auto px-4 py-20 text-center"><h1 className="font-display text-4xl">Cart is empty</h1><Link to="/shop" className="text-accent mt-4 inline-block">Browse products</Link></div>;
  }

  return (
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl md:text-6xl leading-none">CHECKOUT</h1>
          <p className="mt-2 text-sm text-muted-foreground">{isPayment ? "Step 2 of 2 · Payment & review" : "Step 1 of 2 · Information & delivery"}</p>
        </div>
        {isPayment && <button type="button" onClick={editInformation} className="text-sm font-semibold text-accent hover:underline">← Edit information & delivery</button>}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-2">
        <div className={`h-1.5 rounded-full ${!isPayment ? "bg-accent" : "bg-accent/50"}`} />
        <div className={`h-1.5 rounded-full ${isPayment ? "bg-accent" : "bg-muted"}`} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8">
        <main className="space-y-8">
          {!isPayment ? <>
            <Section n="01" title="Contact">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Email" value={form.email} onChange={(v)=>set("email",v)} type="email" />
                <Input label="Phone" value={form.phone} onChange={(v)=>set("phone",v)} />
              </div>
              <label className="mt-3 flex gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={!!form.marketingConsent} onChange={(e)=>set("marketingConsent",e.target.checked)} /> Email me GDP Clothing news, drops and special offers.</label>
            </Section>
            <Section n="02" title="Shipping Address">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="First name" value={form.firstName} onChange={(v)=>set("firstName",v)} />
                <Input label="Last name" value={form.lastName} onChange={(v)=>set("lastName",v)} />
                <div className="sm:col-span-2"><Input label="Address" value={form.address} onChange={(v)=>set("address",v)} /></div>
                <div className="sm:col-span-2"><Input label="Apartment, suite, etc. (optional)" value={form.address2} onChange={(v)=>set("address2",v)} /></div>
                <Input label="City" value={form.city} onChange={(v)=>set("city",v)} />
                <Select label="Province/Territory" value={form.province} onChange={(v)=>set("province",v)} options={PROVINCES} />
                <Input label="Postal Code" value={form.postalCode} onChange={(v)=>set("postalCode",v)} />
                <Input label="Country" value="Canada" readOnly />
              </div>
            </Section>
            <Section n="03" title="Shipping Method">
              <div className="grid sm:grid-cols-2 gap-3">
                <Option selected={form.shippingMethod==="standard"} onClick={()=>set("shippingMethod","standard")} icon={Truck} title="Standard Shipping" desc={shipping===0?"FREE · 3-7 business days":`$${shipping.toFixed(2)} · 3-7 business days`} />
                <Option selected={form.shippingMethod==="pickup"} onClick={()=>set("shippingMethod","pickup")} icon={Store} title="Local Pickup" desc="Free · Saskatoon studio" />
              </div>
            </Section>
            <Section n="04" title="Discount Code">
              <div className="flex gap-2"><input value={form.discountCode} onChange={(e)=>set("discountCode",e.target.value)} placeholder="Enter code" className="flex-1 bg-background border border-border px-3 py-2" /><button type="button" onClick={applyCoupon} className="bg-primary text-primary-foreground px-4 font-bold uppercase text-sm">Apply</button></div>
              {appliedDiscount && <p className="mt-2 text-sm text-accent flex gap-1"><Check size={14} /> Code applied</p>}
            </Section>
            <Section n="05" title="Order Notes"><textarea value={form.notes} onChange={(e)=>set("notes",e.target.value)} rows={3} placeholder="Anything we should know?" className="w-full bg-background border border-border px-3 py-2" /></Section>
          </> : <>
            <Section n="01" title="Review">
              <div className="rounded-xl border border-border p-4 text-sm">
                <div className="flex justify-between gap-4"><div><p className="font-bold">Contact</p><p className="text-muted-foreground">{form.email}{form.phone ? ` · ${form.phone}` : ""}</p></div><button onClick={editInformation} className="text-accent font-semibold">Edit</button></div>
                <div className="mt-4 border-t border-border pt-4"><p className="font-bold">Delivery</p><p className="text-muted-foreground">{form.firstName} {form.lastName} · {form.address}{form.address2?`, ${form.address2}`:""}, {form.city}, {form.province} {normalizePostal(form.postalCode)}</p><p className="mt-1 text-muted-foreground">{form.shippingMethod === "pickup" ? "Local Pickup" : (activeConfig?.shippingName || "Standard Shipping")}</p></div>
              </div>
            </Section>
            <Section n="02" title="Payment">
              {paymentMode === "test" && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><AlertTriangle size={16} className="inline mr-2" />Payment Test Mode — no real money will be charged.</div>}
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><CreditCard size={19} /> Secure payment</div>
              {!paymentReady && <div className="min-h-40 rounded-xl border border-border flex items-center justify-center text-sm text-muted-foreground"><Lock size={18} className="mr-2" /> Loading secure payment…</div>}
              <div ref={paymentHost} className={paymentClient ? "rounded-xl border border-border bg-background p-4 min-h-[180px]" : "h-0 overflow-hidden"} />
            </Section>
          </>}
        </main>

        <aside className="bg-card border border-border rounded-2xl p-6 h-fit shadow-sm lg:sticky" style={{top:"calc(var(--gdp-store-header-height, 70px) + 1rem)"}}>
          <h2 className="font-display text-3xl mb-4">YOUR ORDER</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto mb-4">{items.map((i)=><div key={i.key} className="flex justify-between gap-2 text-sm"><span className="min-w-0 flex-1">{i.quantity}× {i.name} <span className="text-muted-foreground">({i.color} {i.size})</span></span><span className="font-mono">${(i.price*i.quantity).toFixed(2)}</span></div>)}</div>
          <div className="space-y-1.5 text-sm border-t border-border pt-4"><Row k="Subtotal" v={`$${subtotal.toFixed(2)}`} />{quantityDiscount>0 && <Row k="Qty discount" v={`-$${quantityDiscount.toFixed(2)}`} accent />}{coupon>0 && <Row k="Coupon" v={`-$${coupon.toFixed(2)}`} accent />}<Row k="Shipping" v={shipping===0?"FREE":`$${shipping.toFixed(2)}`} /><Row k={activeConfig?.taxName||"Tax"} v={`$${tax.toFixed(2)}`} /></div>
          <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-border"><span>Total CAD</span><span className="font-mono">${total.toFixed(2)}</span></div>
          {error && <div className="mt-3 flex gap-2 text-sm text-destructive bg-destructive/10 p-3"><AlertTriangle size={16} /><span>{error}</span></div>}
          {!isPayment ? <button onClick={continueToPayment} disabled={!detailsComplete} className="w-full mt-5 rounded-lg py-4 font-bold uppercase bg-accent text-accent-foreground disabled:opacity-50">Continue to payment →</button> : <>
            <button onClick={pay} disabled={placing || !paymentClient || !canConfirm || !form.termsAccepted} className="w-full mt-5 rounded-lg py-4 font-bold uppercase bg-accent text-accent-foreground disabled:opacity-50">{placing ? "Processing order…" : `Pay · $${total.toFixed(2)}`}</button>
            <label className="mt-3 flex items-start gap-3 rounded-xl border border-border p-3 text-xs text-left"><input type="checkbox" checked={!!form.termsAccepted} onChange={(e)=>set("termsAccepted",e.target.checked)} disabled={placing} className="mt-0.5" /><span>I agree to the <Link to="/pages/terms" target="_blank" className="text-accent font-semibold">Terms & Conditions</Link> and acknowledge the <Link to="/pages/privacy" target="_blank" className="text-accent font-semibold">Privacy Policy</Link>.</span></label>
            <button onClick={editInformation} disabled={placing} className="w-full mt-2 py-2 text-sm font-semibold text-accent hover:underline">← Edit information & delivery</button>
          </>}
          <p className="text-[11px] text-muted-foreground mt-3 text-center"><Lock size={11} className="inline mr-1" />Secure payment fields are provided by Stripe.</p>
        </aside>
      </div>
    </div>
  );
}

function Section({n,title,children}) {
  return <section><div className="flex items-center gap-2 mb-3"><span className="font-mono text-xs text-accent">{n}</span><h2 className="font-display text-2xl">{title}</h2></div>{children}</section>;
}
function Input({label,value,onChange=undefined,type="text",readOnly=false}) {
  const id=`checkout-${label.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;
  return <div><label htmlFor={id} className="font-mono text-xs uppercase text-muted-foreground">{label}</label><input id={id} type={type} value={value} readOnly={readOnly} onChange={(e)=>onChange?.(e.target.value)} className="w-full bg-background border border-border px-3 py-2 mt-1 outline-none focus:border-accent read-only:opacity-70" /></div>;
}
function Select({label,value,onChange,options}) {
  const id=`checkout-${label.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;
  return <div><label htmlFor={id} className="font-mono text-xs uppercase text-muted-foreground">{label}</label><select id={id} value={value} onChange={(e)=>onChange(e.target.value)} className="w-full bg-background border border-border px-3 py-2 mt-1">{options.map((o)=><option key={o}>{o}</option>)}</select></div>;
}
function Option({selected,onClick,icon:Icon,title,desc}) {
  return <button type="button" onClick={onClick} className={`border p-4 text-left flex items-center gap-3 ${selected?"border-accent bg-accent/5":"border-border hover:border-accent"}`}><Icon size={20} /><div><div className="font-bold text-sm">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div></button>;
}
function Row({k,v,accent=false}) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={`font-mono ${accent?"text-accent":""}`}>{v}</span></div>;
}
