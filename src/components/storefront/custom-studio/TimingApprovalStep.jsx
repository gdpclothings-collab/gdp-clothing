import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, LoaderCircle, ShieldCheck } from "lucide-react";

function readSeasonalPreviewState() {
  if (typeof document === "undefined") return "loading";
  const preview = document.querySelector("[data-seasonal-approved-preview]");
  const image = preview?.querySelector("img");
  if (!(image instanceof HTMLImageElement)) return "loading";
  if (!image.complete) return "loading";
  return image.naturalWidth > 0 && image.naturalHeight > 0 ? "ready" : "error";
}

export default function TimingApprovalStep({ model }) {
  const {
    StepTitle,
    designPath,
    needByDate,
    setNeedByDate,
    Choice,
    priority,
    setPriority,
    rushFee,
    rightsConfirmed,
    setRightsConfirmed,
    approvalAcknowledged,
    setApprovalAcknowledged
  } = model;
  const seasonal = designPath === "seasonal";
  const [seasonalPreviewState, setSeasonalPreviewState] = useState(() => seasonal ? readSeasonalPreviewState() : "ready");

  useEffect(() => {
    if (!seasonal || typeof document === "undefined") {
      setSeasonalPreviewState("ready");
      return undefined;
    }

    let currentImage = null;
    let removeImageListeners = () => {};

    const inspect = () => {
      const preview = document.querySelector("[data-seasonal-approved-preview]");
      const image = preview?.querySelector("img");
      if (image !== currentImage) {
        removeImageListeners();
        currentImage = image instanceof HTMLImageElement ? image : null;
        if (currentImage) {
          const update = () => setSeasonalPreviewState(readSeasonalPreviewState());
          currentImage.addEventListener("load", update);
          currentImage.addEventListener("error", update);
          removeImageListeners = () => {
            currentImage?.removeEventListener("load", update);
            currentImage?.removeEventListener("error", update);
          };
        } else {
          removeImageListeners = () => {};
        }
      }
      setSeasonalPreviewState(readSeasonalPreviewState());
    };

    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true });
    inspect();

    return () => {
      observer.disconnect();
      removeImageListeners();
    };
  }, [seasonal]);

  useEffect(() => {
    if (seasonal && seasonalPreviewState !== "ready" && approvalAcknowledged) {
      setApprovalAcknowledged(false);
    }
  }, [seasonal, seasonalPreviewState, approvalAcknowledged, setApprovalAcknowledged]);

  const seasonalReady = !seasonal || seasonalPreviewState === "ready";
  const stateStyles = seasonalPreviewState === "ready"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : seasonalPreviewState === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div>
      <StepTitle eyebrow="Approve the result" title="TIMING + FINAL APPROVAL" text={seasonal ? "Your exact 300 DPI seasonal composite is prepared below. Confirm timing, artwork rights and this exact preview before it can enter your cart." : "The preview you approve is converted into the exact 300 DPI production file before it enters your cart."} />

      {seasonal && <div role="status" aria-live="polite" className={`mb-5 flex items-start gap-3 rounded-xl border p-3 text-sm ${stateStyles}`}>
        {seasonalPreviewState === "ready" ? <Check size={18} className="mt-0.5 shrink-0" /> : seasonalPreviewState === "error" ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <LoaderCircle size={18} className="mt-0.5 shrink-0 animate-spin" />}
        <div>
          <div className="font-bold">{seasonalPreviewState === "ready" ? "Exact seasonal preview verified" : seasonalPreviewState === "error" ? "Final preview could not load" : "Rendering your final design…"}</div>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{seasonalPreviewState === "ready" ? "The prepared customer mockup is loaded and ready for your final visual check." : seasonalPreviewState === "error" ? "Do not approve a blank result. Return to Seasonal Design Lab, confirm every layer, and prepare the preview again." : "Approval stays locked until the prepared seasonal mockup finishes loading."}</p>
        </div>
      </div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="font-mono text-xs uppercase text-muted-foreground">Need it by</label><input type="date" value={needByDate} onChange={e => setNeedByDate(e.target.value)} className="w-full border border-border bg-background px-3 py-2 mt-1"/></div>
        <div><label className="font-mono text-xs uppercase text-muted-foreground">Priority</label><div className="flex gap-2 mt-1"><Choice active={priority === "standard"} onClick={() => setPriority("standard")}>Standard</Choice><Choice active={priority === "rush"} onClick={() => setPriority("rush")}>Rush (+{"$" + rushFee})</Choice></div></div>
      </div>
      <div className="mt-6 border border-border p-4"><div className="flex items-start gap-3"><ShieldCheck size={22} className="text-accent shrink-0"/><div><div className="font-bold">Preview-to-print guarantee</div><p className="text-sm text-muted-foreground mt-1">After approval, GDP locks the preview and its matching production PNG. Production prints that locked file—there is no separate designer interpretation.</p></div></div></div>
      <label className="flex items-start gap-3 mt-5 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} className="mt-1"/><span>I confirm I own or have permission to reproduce the photos and artwork I submitted. <Link to="/pages/custom-artwork-policy" target="_blank" className="font-semibold text-accent hover:underline">Upload policy</Link></span></label>
      <label className={`flex items-start gap-3 mt-3 text-sm ${seasonalReady ? "" : "opacity-60"}`}><input type="checkbox" checked={approvalAcknowledged} disabled={!seasonalReady} onChange={e => setApprovalAcknowledged(e.target.checked)} className="mt-1"/><span><strong>I approve the exact live preview shown.</strong> I understand this result will be locked when added to cart and printed after successful payment. To change it, I must create a new design before checkout. Customer uploads follow the <Link to="/pages/data-retention" target="_blank" className="font-semibold text-accent hover:underline">retention policy</Link>.</span></label>
    </div>
  );
}
