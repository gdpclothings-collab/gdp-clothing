import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { isProductColorAvailable } from "@/lib/productVariants";

const EMPTY_CATALOG_GRACE_MS = 1400;

const uniqueColors = (values = []) =>
  [...new Map(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .map((value) => [value.toLowerCase(), value])
  ).values()];

export default function GarmentStep({ model }) {
  const {
    StepTitle,
    catalog,
    product,
    garmentFromProduct,
    studioCardImage,
    chooseProduct,
    GarmentShape,
    showGarmentPrices,
    availableColors,
    color,
    chooseColor,
    swatchFor,
    availableSizes,
    variantFor,
    variantAvailable,
    setSize,
    size,
    qty,
    setQty,
    addGroupGarment,
    groupGarments,
    GroupRow,
    updateGroup,
    removeGroup,
    selectedAvailable,
    canContinue,
    continueHint,
    setStep
  } = model;

  const [emptyCatalogSettled, setEmptyCatalogSettled] = useState(false);

  useEffect(() => {
    if (product || catalog.length > 0) {
      setEmptyCatalogSettled(false);
      return undefined;
    }

    setEmptyCatalogSettled(false);
    const timer = window.setTimeout(() => setEmptyCatalogSettled(true), EMPTY_CATALOG_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [product, catalog.length]);

  const showCatalogLoading = !product && catalog.length === 0 && !emptyCatalogSettled;
  const displayColors = uniqueColors([...(product?.colors || []), ...availableColors]);

  return (
    <div>
      <StepTitle eyebrow="Choose your blank" title="CLOTHING, COLOR & SIZE" text="Pick the exact garment first. Colors, sizes, pricing and availability update automatically for that clothing type." />

      {showCatalogLoading ? (
        <div role="status" aria-label="Loading Custom Studio garments" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-[#ddd7ce] bg-white/70" aria-hidden="true">
              <div className="aspect-[2/1] animate-pulse bg-[#eee9e1] sm:aspect-[16/10]" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-[#e9e4dc]" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-[#f0ece6]" />
              </div>
            </div>
          ))}
          <span className="sr-only">Loading garments…</span>
        </div>
      ) : (
        <div data-garment-grid className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(catalog.length ? catalog : (product ? [product] : [])).map((option) => {
            const optionGarment = garmentFromProduct(option);
            const optionImage = studioCardImage(option);
            const active = product?.id === option.id;
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => chooseProduct(option)}
                className={"group overflow-hidden rounded-2xl border text-left transition-all duration-200 " + (active ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.08)]" : "border-[#ddd7ce] bg-white/70 hover:border-accent hover:-translate-y-0.5")}
              >
                <div className="aspect-[2/1] grid place-items-center overflow-hidden bg-[#f1ede6] sm:aspect-[16/10]">
                  {optionImage ? (
                    <img src={optionImage} alt="" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="h-[88%] aspect-[360/430]" aria-hidden="true">
                      <GarmentShape
                        type={optionGarment.previewType || optionGarment.type}
                        color={option?.colors?.[0] || "Black"}
                        side="front"
                      />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold leading-tight">{option.name}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{option.type || option.category || "Custom garment"}</div>
                    </div>
                    {active && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-white"><Check size={13}/></span>}
                  </div>
                  {showGarmentPrices && <div className="mt-3 font-mono text-sm">From {"$" + Number(optionGarment.price).toFixed(2)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!product && catalog.length === 0 && emptyCatalogSettled && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No Custom Studio garments are currently published.</div>
      )}
      {!product && catalog.length > 0 && (
        <div className="mt-5 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 text-sm text-[#52616F]">Choose a garment above to begin. Nothing has been selected for you.</div>
      )}

      {product && <>
        <div data-step1-color className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <label className="font-mono text-xs uppercase text-muted-foreground">Color</label>
            <span className="text-xs font-semibold">{color}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {displayColors.map((optionColor) => {
              const enabled = isProductColorAvailable(product, optionColor);
              return (
                <button
                  type="button"
                  key={optionColor}
                  disabled={!enabled}
                  onClick={() => enabled && chooseColor(optionColor)}
                  title={!enabled ? `${optionColor} — Unavailable` : optionColor}
                  aria-label={!enabled ? `${optionColor}, unavailable` : optionColor}
                  className={"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition " + (color === optionColor && enabled ? "border-[#17324D] bg-[#17324D] text-white shadow-sm" : enabled ? "border-[#ddd7ce] bg-white hover:border-[#aaa39a]" : "cursor-not-allowed border-[#e5e0d9] bg-[#f4f1ec] text-[#8e8982] opacity-75")}
                >
                  <span className="relative h-5 w-5 shrink-0 rounded-full border border-slate-900/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75),0_0_0_1px_rgba(15,23,42,0.18)]" style={{ backgroundColor: swatchFor(product, optionColor) }}>
                    {!enabled && <span aria-hidden="true" className="absolute left-1/2 top-[-2px] h-6 w-px -translate-x-1/2 rotate-45 bg-slate-600" />}
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block">{optionColor}</span>
                    {!enabled && <span className="mt-0.5 block font-mono text-[8px] font-bold uppercase tracking-[0.1em]">Unavailable</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div data-step1-size-quantity className="mt-6 grid items-start gap-5 md:grid-cols-[1fr_auto]">
          <div data-step1-size>
            <label className="font-mono text-xs uppercase text-muted-foreground">Size</label>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {availableSizes.map((optionSize) => {
                const optionVariant = variantFor(product, color, optionSize);
                const enabled = variantAvailable(product, optionVariant);
                const optionPrice = optionVariant?.price == null ? Number(product.price || 0) : Number(optionVariant.price || 0);
                return (
                  <button
                    type="button"
                    key={optionSize}
                    disabled={!enabled}
                    onClick={() => enabled && setSize(optionSize)}
                    title={!enabled ? "Unavailable" : ""}
                    className={"w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:w-auto sm:min-w-14 " + (size === optionSize ? "border-accent bg-accent/[0.07] text-accent" : enabled ? "border-[#ddd7ce] bg-white hover:border-accent" : "border-[#e5e0d9] bg-[#f4f1ec] text-[#aaa39a] line-through cursor-not-allowed")}
                  >
                    <span>{optionSize}</span>
                    {showGarmentPrices && optionVariant?.price != null && optionPrice !== Number(product.price || 0) && <span className="mt-0.5 block font-mono text-[8px]">{"$" + optionPrice.toFixed(2)}</span>}
                  </button>
                );
              })}
            </div>
            {product.trackInventory === false && <div className="mt-2 text-[10px] text-[#817b73]">Made to order · inventory tracking is currently off for this blank.</div>}
          </div>

          <div data-step1-quantity>
            <label className="font-mono text-xs uppercase text-muted-foreground">Quantity</label>
            <div className="mt-2 flex w-fit items-center overflow-hidden rounded-xl border border-[#ddd7ce] bg-white">
              <button type="button" onClick={() => setQty(v => Math.max(1, v - 1))} className="p-2.5 hover:bg-[#f5f1eb]"><Minus size={15}/></button>
              <span className="min-w-14 px-5 text-center font-mono">{qty}</span>
              <button type="button" onClick={() => setQty(v => Math.min(99, v + 1))} className="p-2.5 hover:bg-[#f5f1eb]"><Plus size={15}/></button>
            </div>
          </div>
        </div>

        <div data-step1-group className="mt-7 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-bold">Same design, different sizes or colors</div>
              <p className="text-sm text-muted-foreground">Build a family, team or event order without recreating the design.</p>
            </div>
            <button type="button" onClick={addGroupGarment} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-bold text-accent"><Plus size={15}/> Add garment</button>
          </div>
          {groupGarments.map((item, index) => (
            <GroupRow
              key={index}
              item={item}
              product={product}
              onChange={patch => updateGroup(index, patch)}
              onRemove={() => removeGroup(index)}
            />
          ))}
        </div>

        {!selectedAvailable && product?.variants?.length > 0 && (
          <div data-step1-validation-message className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Choose an available size before continuing.</div>
        )}

        <div data-step1-complete className="mt-7 hidden items-center justify-between gap-5 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 lg:flex">
          <div>
            <div className="text-sm font-bold text-[#17324D]">Garment selection complete</div>
            <p className="mt-1 text-xs text-[#64707C]">{canContinue() ? `${product.name} · ${color} · ${size} · Qty ${qty}` : continueHint()}</p>
          </div>
          <button
            type="button"
            disabled={!canContinue()}
            onClick={() => {
              if (!canContinue()) return;
              setStep(2);
              window.requestAnimationFrame(() => {
                document.getElementById("custom-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#17324D] px-5 py-3 text-xs font-bold uppercase text-white shadow-sm transition hover:bg-[#244866] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to Choose Design <ArrowRight size={16}/>
          </button>
        </div>
      </>}
    </div>
  );
}
