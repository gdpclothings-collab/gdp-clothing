import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";

const SEASONAL_PREVIEW_TIMEOUT_MS = 15000;

function readSeasonalPreviewState() {
  if (typeof document === "undefined") return "loading";
  const preview = document.querySelector("[data-seasonal-approved-preview]");
  if (!(preview instanceof HTMLElement)) return "loading";

  const guardedState = preview.dataset.seasonalPreviewState;
  if (guardedState === "ready") return "ready";
  if (guardedState === "error" || guardedState === "missing") return "error";

  const image = preview.querySelector("img");
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
  const [previewRetryKey, setPreviewRetryKey] = useState(0);

  useEffect(() => {
    if (!seasonal || typeof document === "undefined" || typeof window === "undefined") {
      setSeasonalPreviewState("ready");
      return undefined;
    }

    let currentImage = null;
    let timeoutId = 0;
    let removeImageListeners = () => {};
    let settled = false;

    const clearPreviewTimeout = () => {
      if (!timeoutId) return;
      window.clearTimeout(timeoutId);
      timeoutId = 0;
    };

    const ensurePreviewTimeout = () => {
      if (timeoutId || settled) return;
      timeoutId = window.setTimeout(() => {
        timeoutId = 0;
        if (readSeasonalPreviewState() === "ready") {
          settled = true;
          setSeasonalPreviewState("ready");
          return;
        }
        settled = true;
        setSeasonalPreviewState("error");
      }, SEASONAL_PREVIEW_TIMEOUT_MS);
    };

    const applyState = () => {
      const next = readSeasonalPreviewState();
      if (next === "ready" || next === "error") {
        settled = true;
        clearPreviewTimeout();
      } else {
        settled = false;
        ensurePreviewTimeout();
      }
      setSeasonalPreviewState(next);
    };

    const inspect = () => {
      const preview = document.querySelector("[data-seasonal-approved-preview]");
      const image = preview?.querySelector("img");
      const nextImage = image instanceof HTMLImageElement ? image : null;

      if (nextImage !== currentImage) {
        removeImageListeners();
        currentImage = nextImage;
        if (currentImage) {
          const update = () => applyState();
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

      applyState();
    };

    const observer = new MutationObserver(inspect);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "data-seasonal-preview-state"],
    });
    inspect();

    return () => {
      observer.disconnect();
      removeImageListeners();
      clearPreviewTimeout();
    };
  }, [seasonal, previewRetryKey]);

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
      : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div>
      <StepTitle eyebrow="Approve the result" title="TIMING + FINAL APPROVAL" text={seasonal ? "Your exact Seasonal layout is already locked. Confirm timing, artwork rights and the approval preview below. The 300 DPI print file is generated only after you approve and add the design to cart." : "The preview you approve is converted into the exact 300 DPI production file before it enters your cart."} />

      {seasonal && <div role="status" aria-live="polite" className={`mb-5 flex items-start gap-3 rounded-xl border p-3 text-sm ${stateStyles}`}>
        {seasonalPreviewState === "ready" ? <Check size={18} className="mt-0.5 shrink-0" /> : seasonalPreviewState === "error" ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <LoaderCircle size={18} className="mt-0.5 shrink-0 animate-spin" />}
        <div className="min-w-0 flex-1">
          <div className="font-bold">{seasonalPreviewState === "ready" ? "Design ready for final review" : seasonalPreviewState === "error" ? "Approval preview could not load" : "Loading approval preview…"}</div>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{seasonalPreviewState === "ready" ? "This lightweight mockup represents the locked layer positions, sizes, rotations and order. No 300 DPI production rendering is happening on this screen." : seasonalPreviewState === "error" ? "Approval stays locked so a blank or stale image can never be approved. Retry the preview check, or return to Seasonal Design Lab if the image is still unavailable." : "The locked design snapshot is already saved. This step is only loading its customer preview, not rebuilding the production artwork."}</p>
          {seasonalPreviewState === "error" && (
            <button
              type="button"
              onClick={() => {
                setSeasonalPreviewState("loading");
                setPreviewRetryKey((value) => value + 1);
              }}
              className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-current/20 bg-white/70 px-3 text-xs font-bold"
            >
              <RotateCcw size={14} /> Retry preview check
            </button>
          )}
        </div>
      </div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="font-mono text-xs uppercase text-muted-foreground">Need it by</label><input type="date" value={needByDate} onChange={e => setNeedByDate(e.target.value)} className="w-full border border-border bg-background px-3 py-2 mt-1"/></div>
        <div><label className="font-mono text-xs uppercase text-muted-foreground">Priority</label><div className="flex gap-2 mt-1"><Choice active={priority === "standard"} onClick={() => setPriority("standard")}>Standard</Choice><Choice active={priority === "rush"} onClick={() => setPriority("rush")}>Rush (+{"$" + rushFee})</Choice></div></div>
      </div>
      <div className="mt-6 border border-border p-4"><div className="flex items-start gap-3"><ShieldCheck size={22} className="text-accent shrink-0"/><div><div className="font-bold">Preview-to-print guarantee</div><p className="text-sm text-muted-foreground mt-1">GDP locks the Seasonal layer snapshot you approve. When you add it to cart, the 300 DPI production PNG is generated from that locked snapshot, so production cannot reinterpret or reposition the design.</p></div></div></div>
      <label className="flex items-start gap-3 mt-5 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} className="mt-1"/><span>I confirm I own or have permission to reproduce the photos and artwork I submitted. <Link to="/pages/custom-artwork-policy" target="_blank" className="font-semibold text-accent hover:underline">Upload policy</Link></span></label>
      <label className={`flex items-start gap-3 mt-3 text-sm ${seasonalReady ? "" : "opacity-60"}`}><input type="checkbox" checked={approvalAcknowledged} disabled={!seasonalReady} onChange={e => setApprovalAcknowledged(e.target.checked)} className="mt-1"/><span><strong>I approve the exact live preview shown.</strong> I understand this locked layout will be used to generate the production file when I add it to cart. To change it, I must return to the editor before checkout. Customer uploads follow the <Link to="/pages/data-retention" target="_blank" className="font-semibold text-accent hover:underline">retention policy</Link>.</span></label>
    </div>
  );
}