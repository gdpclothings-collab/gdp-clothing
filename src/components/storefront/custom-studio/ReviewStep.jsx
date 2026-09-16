import React from "react";
import { AlertTriangle, Check, LoaderCircle } from "lucide-react";

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

  const seasonalSnapshotReady = designPath !== "seasonal" || Boolean(
    seasonalPrepared?.cartItemBase?.image &&
    seasonalPrepared?.cartItemBase?.renderStatus === "approval_ready" &&
    seasonalPrepared?.designPayload?.renderStatus === "approval_ready" &&
    seasonalPrepared?.designPayload?.customerMockupPath &&
    seasonalPrepared?.designPayload?.lockedHash &&
    seasonalPrepared?.designPayload?.preflight?.status === "snapshot_locked" &&
    seasonalPrepared?.designPayload?.preflight?.productionStatus === "pending_customer_approval" &&
    Number(seasonalPrepared?.seasonalSummary?.layerCount || 0) > 0
  );
  const addToCartDisabled = saving || !rightsConfirmed || !approvalAcknowledged || !seasonalSnapshotReady;

  return (
    <div>
      <StepTitle
        eyebrow="Final check"
        title="REVIEW THE EXACT RESULT"
        text={designPath === "seasonal"
          ? "This is your saved Seasonal approval snapshot. Adding it to cart starts the transparent 300 DPI production render. The design is only treated as production-ready after that file is generated, uploaded and verified successfully."
          : "Adding to cart generates and verifies the production-ready PNG from the live preview. Payment then sends that same file to the production queue."}
      />

      {designPath === "seasonal" && <div role="status" aria-live="polite" className={`mb-5 flex items-start gap-3 rounded-xl border p-3 text-sm ${saving ? "border-blue-200 bg-blue-50 text-blue-900" : seasonalSnapshotReady ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
        {saving ? <LoaderCircle size={18} className="mt-0.5 shrink-0 animate-spin" /> : seasonalSnapshotReady ? <Check size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
        <div>
          <div className="font-bold">{saving ? "Generating and verifying production file…" : seasonalSnapshotReady ? "Approval snapshot verified · production pending" : "Seasonal approval snapshot is incomplete"}</div>
          <p className="mt-1 text-xs leading-relaxed opacity-80">
            {saving
              ? "Keep this screen open while GDP builds the exact 300 DPI PNG, uploads it and verifies the production metadata. The cart is not updated until all three steps succeed."
              : seasonalSnapshotReady
                ? "The customer mockup, render hash and exact layered snapshot are preserved. No success state is shown for production until the 300 DPI file actually exists."
                : "Add to cart is blocked so a missing or stale Seasonal snapshot cannot become an order. Return to Seasonal Design Lab and prepare the approval preview again."}
          </p>
        </div>
      </div>}

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
        <ReviewCard
          label="Production result"
          value={designPath === "seasonal" ? (seasonalSnapshotReady ? "Snapshot verified · production pending" : "Not ready") : "Customer-approved preview"}
          sub={designPath === "seasonal" ? (seasonalSnapshotReady ? "The 300 DPI PNG will be generated, uploaded and verified before this design enters the cart." : "Return to Seasonal Design Lab and prepare the exact preview before ordering.") : "A locked 300 DPI PNG is generated and verified when added to cart."}
        />
        <ReviewCard label="Timing" value={priority === "rush" ? "Rush" : "Standard"} sub={needByDate ? "Need by " + needByDate : "No event date selected"} />
      </div>
      {groupGarments.length > 0 && <div className="mt-4 border border-border p-4"><div className="font-bold">Additional shirts using the same design</div>{groupGarments.map((g,i) => <div key={i} className="text-sm text-muted-foreground mt-1">{g.quantity}× {g.color} · {g.size}</div>)}</div>}
      <div className="mt-6 bg-secondary p-5 flex items-end justify-between gap-4"><div><div className="font-mono text-xs uppercase text-muted-foreground">Estimated custom subtotal</div><div className="text-xs text-muted-foreground mt-1">Garment, selected print sides and rush fee included. Cart discounts, shipping, tax and coupons are calculated later.</div></div><div className="font-display text-4xl">{"$" + estimatedSubtotal.toFixed(2)}</div></div>
      <button onClick={createAndAdd} disabled={addToCartDisabled} className="w-full mt-5 bg-accent text-accent-foreground py-4 font-bold uppercase tracking-wide disabled:opacity-50">{saving ? (designPath === "seasonal" ? "Generating + verifying print file…" : "Generating production artwork…") : designPath === "seasonal" ? (seasonalSnapshotReady ? "Generate, Verify & Add to Cart →" : "Approval preview required") : "Approve, Lock & Add to Cart →"}</button>
    </div>
  );
}
