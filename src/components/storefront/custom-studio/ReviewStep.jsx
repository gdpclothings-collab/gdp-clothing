import React from "react";

export default function ReviewStep({ model }) {
  const {
    StepTitle,
    ReviewCard,
    DESIGN_PATHS,
    designPath,
    seasonalPrepared,
    seasonalDraft,
    orderDesignStyle,
    designMood,
    personalization,
    product,
    color,
    size,
    qty,
    placement,
    printSummaryForSide,
    artworkStates,
    photos,
    priority,
    needByDate,
    groupGarments,
    estimatedSubtotal,
    createAndAdd,
    saving,
    rightsConfirmed,
    approvalAcknowledged
  } = model;

  return (
    <div>
                <StepTitle eyebrow="Final check" title="REVIEW THE EXACT RESULT" text={designPath === "seasonal" ? "This is the prepared seasonal production composite you approved. Adding it to cart locks that exact 300 DPI file to the order." : "Adding to cart generates and locks the production-ready PNG from the live preview. Payment then sends that same file to the production queue."} />
                <div className="grid md:grid-cols-2 gap-4">
                  <ReviewCard label="Design path" value={DESIGN_PATHS.find((path) => path.id === designPath)?.label || "Not selected"} sub={(designPath === "bootleg" || designPath === "memorial") ? "GDP template locked · customer layers editable" : ""} />
                  <ReviewCard label={designPath === "seasonal" ? "Seasonal artwork" : designPath === "upload" ? "Artwork" : "Ready layout"} value={designPath === "seasonal" ? (seasonalPrepared?.seasonalSummary?.artwork || seasonalDraft?.artworkTitle || "Layered seasonal design") : (orderDesignStyle || "Not selected").replace(/^GDP\s+/, "")} sub={designPath === "seasonal" ? `${seasonalPrepared?.seasonalSummary?.layerCount || seasonalDraft?.layers?.length || 0} print layer(s)` : orderDesignStyle ? `${designMood || "Original"} finish` : ""} />
                  {designPath === "memorial" && <ReviewCard label="Memorial name" value={personalization.name || "Not entered"} sub={personalization.dates ? `Dates: ${personalization.dates}` : "No dates added"} />}
                  <ReviewCard label="Garment" value={product?.name || "Not selected"} sub={product ? `${color || "No color"} · ${size || "No size"} · Qty ${qty}` : ""} />
                  <ReviewCard
                    label="Print"
                    value={placement === "front_back" ? "Front + back" : placement === "back" ? "Back only" : "Front only"}
                    sub={placement === "front_back" ? "Two independent artwork placements saved." : "One print side selected."}
                  />
                  {designPath !== "seasonal" && placement !== "back" && <ReviewCard label="Front artwork" value={printSummaryForSide("front")} sub={"Scale " + Number(artworkStates.front?.scale ?? 92) + "% · rotation " + Number(artworkStates.front?.rotation ?? 0) + "°"} />}
                  {designPath !== "seasonal" && placement !== "front" && <ReviewCard label="Back artwork" value={printSummaryForSide("back")} sub={"Scale " + Number(artworkStates.back?.scale ?? 92) + "% · rotation " + Number(artworkStates.back?.rotation ?? 0) + "°"} />}
                  {designPath !== "seasonal" && <ReviewCard label="Photos" value={photos.length + " uploaded"} sub={photos.some(p => p.quality === "replace_recommended") ? `Print-quality warning · smallest upload ${Math.min(...photos.map((p) => Math.max(Number(p.width || 0), Number(p.height || 0)))) || 0}px on its longest edge. Replace low-resolution photos when possible.` : "Photo quality check complete."} />}
                  <ReviewCard label="Production result" value="Customer-approved preview" sub={designPath === "seasonal" ? "Prepared 300 DPI layered composite · locked to this approval when added to cart." : "Locked 300 DPI PNG is generated when added to cart."} />
                  <ReviewCard label="Timing" value={priority === "rush" ? "Rush" : "Standard"} sub={needByDate ? "Need by " + needByDate : "No event date selected"} />
                </div>
                {groupGarments.length > 0 && <div className="mt-4 border border-border p-4"><div className="font-bold">Additional shirts using the same design</div>{groupGarments.map((g,i) => <div key={i} className="text-sm text-muted-foreground mt-1">{g.quantity}× {g.color} · {g.size}</div>)}</div>}
                <div className="mt-6 bg-secondary p-5 flex items-end justify-between gap-4"><div><div className="font-mono text-xs uppercase text-muted-foreground">Estimated custom subtotal</div><div className="text-xs text-muted-foreground mt-1">Garment, selected print sides and rush fee included. Cart discounts, shipping, tax and coupons are calculated later.</div></div><div className="font-display text-4xl">{"$" + estimatedSubtotal.toFixed(2)}</div></div>
                <button onClick={createAndAdd} disabled={saving || !rightsConfirmed || !approvalAcknowledged} className="w-full mt-5 bg-accent text-accent-foreground py-4 font-bold uppercase tracking-wide disabled:opacity-50">{saving ? "Generating production artwork…" : "Approve, Lock & Add to Cart →"}</button>
    </div>
  );
}
