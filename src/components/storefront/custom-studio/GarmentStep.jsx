import React from "react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";

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

  return (
    <div>
                <StepTitle eyebrow="Choose your blank" title="CLOTHING, COLOR & SIZE" text="Pick the exact garment first. Colors, sizes, pricing and availability update automatically for that clothing type." />
    
                <div data-garment-grid className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {(catalog.length ? catalog : (product ? [product] : [])).map((option) => {
                    const optionGarment = garmentFromProduct(option);
                    const optionImage = studioCardImage(option);
                    const active = product?.id === option.id;
                    return <button
                      type="button"
                      key={option.id}
                      onClick={() => chooseProduct(option)}
                      className={"group overflow-hidden rounded-2xl border text-left transition-all duration-200 " + (active ? "border-accent bg-accent/[0.055] shadow-[0_10px_30px_rgba(25,22,18,.08)]" : "border-[#ddd7ce] bg-white/70 hover:border-accent hover:-translate-y-0.5")}
                    >
                      <div className="aspect-[2/1] sm:aspect-[16/10] bg-[#f1ede6] overflow-hidden grid place-items-center">
                        {optionImage
                          ? <img src={optionImage} alt="" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
                          : <div className="h-[88%] aspect-[360/430]" aria-hidden="true">
                              <GarmentShape
                                type={optionGarment.previewType || optionGarment.type}
                                color={option?.colors?.[0] || "Black"}
                                side="front"
                              />
                            </div>}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold leading-tight">{option.name}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{option.type || option.category || "Custom garment"}</div>
                          </div>
                          {active && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-white"><Check size={13}/></span>}
                        </div>
                        {showGarmentPrices && <div className="font-mono text-sm mt-3">From {"$" + Number(optionGarment.price).toFixed(2)}</div>}
                      </div>
                    </button>;
                  })}
                </div>
    
                {!product && catalog.length === 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No Custom Studio garments are currently published.</div>}
                {!product && catalog.length > 0 && <div className="mt-5 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 text-sm text-[#52616F]">Choose a garment above to begin. Nothing has been selected for you.</div>}
    
                {product && <>
                  <div data-step1-color className="mt-7">
                    <div className="flex items-center justify-between gap-3">
                      <label className="font-mono text-xs uppercase text-muted-foreground">Color</label>
                      <span className="text-xs font-semibold">{color}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availableColors.map((optionColor) => (
                        <button
                          type="button"
                          key={optionColor}
                          onClick={() => chooseColor(optionColor)}
                          className={"inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition " + (color === optionColor ? "border-[#17324D] bg-[#17324D] text-white shadow-sm" : "border-[#ddd7ce] bg-white hover:border-[#aaa39a]")}
                        >
                          <span
                            className="h-5 w-5 rounded-full border border-slate-900/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75),0_0_0_1px_rgba(15,23,42,0.18)]"
                            style={{ backgroundColor: swatchFor(product, optionColor) }}
                          />
                          {optionColor}
                        </button>
                      ))}
                    </div>
                  </div>
    
                  <div data-step1-size-quantity className="grid md:grid-cols-[1fr_auto] gap-5 mt-6 items-start">
                    <div data-step1-size>
                      <label className="font-mono text-xs uppercase text-muted-foreground">Size</label>
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                        {availableSizes.map((optionSize) => {
                          const optionVariant = variantFor(product, color, optionSize);
                          const enabled = variantAvailable(product, optionVariant);
                          const optionPrice = optionVariant?.price == null ? Number(product.price || 0) : Number(optionVariant.price || 0);
                          return <button
                            type="button"
                            key={optionSize}
                            disabled={!enabled}
                            onClick={() => enabled && setSize(optionSize)}
                            title={!enabled ? "Unavailable" : ""}
                            className={"w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition sm:w-auto sm:min-w-14 " + (size === optionSize ? "border-accent bg-accent/[0.07] text-accent" : enabled ? "border-[#ddd7ce] bg-white hover:border-accent" : "border-[#e5e0d9] bg-[#f4f1ec] text-[#aaa39a] line-through cursor-not-allowed")}
                          >
                            <span>{optionSize}</span>
                            {showGarmentPrices && optionVariant?.price != null && optionPrice !== Number(product.price || 0) && <span className="block text-[8px] font-mono mt-0.5">{"$" + optionPrice.toFixed(2)}</span>}
                          </button>;
                        })}
                      </div>
                      {product.trackInventory === false && <div className="mt-2 text-[10px] text-[#817b73]">Made to order · inventory tracking is currently off for this blank.</div>}
                    </div>
    
                    <div data-step1-quantity>
                      <label className="font-mono text-xs uppercase text-muted-foreground">Quantity</label>
                      <div className="mt-2 flex items-center rounded-xl border border-[#ddd7ce] bg-white overflow-hidden w-fit">
                        <button type="button" onClick={() => setQty(v => Math.max(1,v-1))} className="p-2.5 hover:bg-[#f5f1eb]"><Minus size={15}/></button>
                        <span className="px-5 font-mono min-w-14 text-center">{qty}</span>
                        <button type="button" onClick={() => setQty(v => Math.min(99,v+1))} className="p-2.5 hover:bg-[#f5f1eb]"><Plus size={15}/></button>
                      </div>
                    </div>
                  </div>
    
                  <div data-step1-group className="mt-7 border-t border-border pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold">Same design, different sizes or colors</div>
                        <p className="text-sm text-muted-foreground">Build a family, team or event order without recreating the design.</p>
                      </div>
                      <button type="button" onClick={addGroupGarment} className="text-accent text-sm font-bold inline-flex items-center gap-1 whitespace-nowrap"><Plus size={15}/> Add garment</button>
                    </div>
                    {groupGarments.map((item,index) => (
                      <GroupRow
                        key={index}
                        item={item}
                        product={product}
                        onChange={patch => updateGroup(index,patch)}
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
