import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, DollarSign, Loader2, RotateCcw, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { adminApparelPricingApi } from "@/lib/adminApparelPricingApi";
import { DEFAULT_APPAREL_PRICING, normalizeApparelPricing } from "@/lib/apparelPricing";

const PRODUCT_LABELS = {
  tshirt: "T-Shirt",
  crewneck: "Crewneck",
  hoodie: "Hoodie",
};
const PLACEMENT_LABELS = {
  front: "Front only",
  front_back: "Front + Back",
};
const QUANTITIES = [1, 2, 5, 10];

function MoneyInput({ value, onChange, label }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#6c7078]">{label}</span>
      <div className="flex h-11 items-center rounded-lg border border-[#d8dade] bg-white px-3 focus-within:border-[#111214]">
        <span className="mr-1.5 text-sm font-semibold text-[#555961]">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(Number(event.target.value || 0))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          aria-label={label}
        />
      </div>
    </label>
  );
}

function OptionalMoneyInput({ value, onChange, label, placeholder = "Not set" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#6c7078]">{label}</span>
      <div className="flex h-11 items-center rounded-lg border border-[#d8dade] bg-white px-3 focus-within:border-[#111214]">
        <span className="mr-1.5 text-sm font-semibold text-[#555961]">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-[#a3a6ac]"
          aria-label={label}
        />
      </div>
    </label>
  );
}

export default function AdminPricing() {
  const [pricing, setPricing] = useState(() => normalizeApparelPricing(DEFAULT_APPAREL_PRICING));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminApparelPricingApi.load()
      .then((data) => active && setPricing(data))
      .catch((err) => active && setError(err?.message || "Could not load pricing settings."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const preview = useMemo(() => normalizeApparelPricing(pricing), [pricing]);

  const setBundle = (productKey, placement, quantity, value) => {
    setMessage(""); setError("");
    setPricing((current) => ({
      ...current,
      products: {
        ...current.products,
        [productKey]: {
          ...current.products[productKey],
          [placement]: {
            ...current.products[productKey][placement],
            [quantity]: Number(value || 0),
          },
        },
      },
    }));
  };

  const setTier = (index, field, value) => {
    setMessage(""); setError("");
    setPricing((current) => ({
      ...current,
      tiers: current.tiers.map((tier, i) => i === index ? { ...tier, [field]: Number(value || 0) } : tier),
    }));
  };

  const setSourcingCost = (garmentKey, field, value) => {
    setMessage(""); setError("");
    setPricing((current) => ({
      ...current,
      sourcing: {
        ...current.sourcing,
        garments: {
          ...current.sourcing.garments,
          [garmentKey]: {
            ...current.sourcing.garments[garmentKey],
            [field]: value,
          },
        },
      },
    }));
  };

  const save = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const saved = await adminApparelPricingApi.save(pricing);
      setPricing(saved);
      setMessage("Pricing and garment sourcing settings saved successfully.");
    } catch (err) {
      setError(err?.message || "Could not save pricing settings.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setPricing(normalizeApparelPricing(DEFAULT_APPAREL_PRICING));
    setMessage("Recommended GDP pricing and sourcing defaults restored in the editor. Select Save changes to apply them.");
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 border-b border-white/10 bg-[#111214] text-white shadow-sm">
        <div className="flex h-full items-center gap-3 px-3 md:px-5">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#d7193f] text-xs font-black text-white">GDP</div>
            <div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="mt-1 text-xs text-white/70">Commerce Admin</div></div>
          </Link>
          <div className="mx-auto hidden items-center gap-2 text-sm text-white/75 md:flex"><DollarSign size={16}/> Apparel Pricing</div>
          <Link to="/admin" className="ml-auto flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold hover:bg-white/15"><ArrowLeft size={15}/> Admin</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-7 md:px-7 lg:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#a70f2d]">Pricing & volume discounts</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Custom DTF Apparel Pricing</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c6068]">Edit bundle prices, quantity discounts and garment sourcing references without changing code. GDP customer pricing stays separate from emergency local-retail costs.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={reset} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#cfd2d7] bg-white px-4 text-sm font-semibold hover:bg-[#f8f8f9]"><RotateCcw size={16}/> Recommended defaults</button>
            <button type="button" onClick={save} disabled={saving || loading} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#111214] px-5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save changes</button>
          </div>
        </div>

        {loading && <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#dedfe3] bg-white p-4 text-sm"><Loader2 size={16} className="animate-spin"/> Loading current pricing…</div>}
        {message && <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>{message}</div>}
        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

        <section className="space-y-5">
          {Object.keys(PRODUCT_LABELS).map((productKey) => (
            <article key={productKey} className="overflow-hidden rounded-2xl border border-[#dedfe3] bg-white shadow-sm">
              <div className="border-b border-[#e5e6e8] bg-[#fafafa] px-5 py-4"><h2 className="text-lg font-bold">{PRODUCT_LABELS[productKey]}</h2><p className="mt-1 text-xs text-[#6c7078]">CAD pricing including garment + standard DTF print. Size and rush surcharges remain separate.</p></div>
              <div className="grid gap-0 lg:grid-cols-2">
                {Object.keys(PLACEMENT_LABELS).map((placement, placementIndex) => (
                  <div key={placement} className={`p-5 ${placementIndex ? "border-t border-[#e5e6e8] lg:border-l lg:border-t-0" : ""}`}>
                    <h3 className="mb-4 text-sm font-bold">{PLACEMENT_LABELS[placement]}</h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {QUANTITIES.map((qty) => <MoneyInput key={qty} label={`${qty} pc${qty > 1 ? "s" : ""}`} value={pricing.products[productKey][placement][qty]} onChange={(value) => setBundle(productKey, placement, qty, value)}/>) }
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#656972] sm:grid-cols-4">
                      {QUANTITIES.map((qty) => <div key={qty}><span className="font-semibold">${(Number(preview.products[productKey][placement][qty]) / qty).toFixed(2)}</span> / pc</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-[#dedfe3] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e5e6e8] pb-5">
            <div>
              <h2 className="text-lg font-bold">Garment sourcing & fallback costs</h2>
              <p className="mt-1 max-w-4xl text-sm leading-6 text-[#666b73]">T-Shirt Ideal remains the primary wholesale source. Michaels is an emergency local fallback only. These sourcing costs are kept separate from GDP customer prices, so a Michaels sale or retail price never becomes the website base price automatically.</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Wholesale base pricing protected</span>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {Object.entries(pricing.sourcing?.garments || {}).map(([garmentKey, garment]) => (
              <article key={garmentKey} className="rounded-xl border border-[#e1e3e6] bg-[#fafafa] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{garment.label}</h3>
                    <p className="mt-1 text-xs text-[#6c7078]">Primary: {pricing.sourcing.primarySupplierName} · Emergency: {pricing.sourcing.fallbackSupplierName}{garment.fallbackBrand ? ` (${garment.fallbackBrand})` : ""}</p>
                  </div>
                  <span className="rounded-md border border-[#d7d9dd] bg-white px-2 py-1 font-mono text-[11px] font-semibold">Michaels #{garment.fallbackItemNumber}</span>
                </div>

                {garment.requiresSubstitutionApproval && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Brand substitution approval required before using this Michaels fallback because it is not the same brand as the primary blank.</div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <OptionalMoneyInput label="Wholesale cost" value={garment.wholesaleCost} onChange={(value) => setSourcingCost(garmentKey, "wholesaleCost", value)} />
                  <MoneyInput label="Michaels regular" value={garment.fallbackRegularCost} onChange={(value) => setSourcingCost(garmentKey, "fallbackRegularCost", value)} />
                  <MoneyInput label="Michaels current" value={garment.fallbackCurrentCost} onChange={(value) => setSourcingCost(garmentKey, "fallbackCurrentCost", value)} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6c7078]">Michaels supported sizes</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{garment.supportedSizes.map((item) => <span key={item} className="rounded-md border border-[#dadce0] bg-white px-2 py-1 text-xs font-semibold">{item}</span>)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6c7078]">Michaels observed colours</div>
                    <div className="mt-2 text-xs leading-5 text-[#555961]">{garment.supportedColors.join(" · ")}</div>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#e0e2e5] pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6c7078]">Reference details</div>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-[#555961]">{garment.details.map((detail) => <li key={detail}>• {detail}</li>)}</ul>
                  <div className="mt-2 text-[10px] text-[#8a8e95]">Observed {garment.observedAt}. Update the cost fields when local pricing changes.</div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#dedfe3] bg-white p-5 shadow-sm">
          <div className="mb-5"><h2 className="text-lg font-bold">Automatic quantity discounts</h2><p className="mt-1 text-sm text-[#666b73]">Used when an exact 2, 5 or 10-piece bundle price does not apply.</p></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pricing.tiers.map((tier, index) => (
              <div key={`${tier.min}-${tier.max}-${index}`} className="rounded-xl border border-[#e1e3e6] bg-[#fafafa] p-4">
                <div className="grid grid-cols-3 gap-2">
                  <MoneylessInput label="Min qty" value={tier.min} onChange={(value) => setTier(index, "min", value)}/>
                  <MoneylessInput label="Max qty" value={tier.max} onChange={(value) => setTier(index, "max", value)}/>
                  <MoneylessInput label="% off" value={tier.percent} onChange={(value) => setTier(index, "percent", value)}/>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#666b73]">Custom quote starts at</span><div className="flex h-11 items-center rounded-lg border border-[#d8dade] px-3"><input type="number" min="1" value={pricing.customQuoteMinQty} onChange={(e) => setPricing((current) => ({ ...current, customQuoteMinQty: Math.max(1, Number(e.target.value || 1)) }))} className="w-full bg-transparent text-sm font-semibold outline-none"/><span className="text-xs text-[#6c7078]">pcs</span></div></label>
            <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[#d8dade] px-4"><div><div className="text-sm font-semibold">Allow coupon codes after volume pricing</div><div className="mt-0.5 text-xs text-[#6c7078]">Keep enabled for current checkout behavior.</div></div><input type="checkbox" checked={pricing.allowCouponStacking !== false} onChange={(e) => setPricing((current) => ({ ...current, allowCouponStacking: e.target.checked }))} className="h-5 w-5"/></label>
          </div>
        </section>
      </main>
    </div>
  );
}

function MoneylessInput({ label, value, onChange }) {
  return <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-[#6c7078]">{label}</span><input type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value || 0))} className="h-10 w-full rounded-lg border border-[#d8dade] bg-white px-2 text-sm font-semibold outline-none focus:border-[#111214]"/></label>;
}
