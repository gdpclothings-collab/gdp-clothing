import React, { useRef, useState } from 'react';
import { AlertTriangle, Check, ImagePlus, Loader2, Maximize2, RotateCcw } from 'lucide-react';
import { customerApi } from '@/lib/customerApi';
import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';
import '@/components/storefront/custom-studio-v2/selectionBorderFix';
import { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';
import { resolveStudioV2PrintGuide } from '@/lib/customStudioV2PrintGuide';
import {
  analyzeStudioV2ArtworkFile,
  describeArtworkOverflow,
  formatArtworkInches,
  resolveUploadArtworkPlacement,
  studioV2ArtworkQuality,
} from '@/lib/customStudioV2ArtworkMetrics';

const MOVE_BOX_RATIO = 0.72;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function formatDpi(value) {
  const number = Number(value || 0);
  return number > 0 ? `${Math.round(number)} DPI` : 'Not embedded';
}

function topAlignedArtworkTransform(artwork, printGuide) {
  const initial = { scale: 100, rotation: 0, x: 0, y: 0 };
  if (!artwork) return initial;
  const placement = resolveUploadArtworkPlacement(artwork, printGuide, initial);
  const profileHeight = Number(printGuide?.heightIn || 0);
  const movementHeight = profileHeight * MOVE_BOX_RATIO;
  const printableTop = Number(placement?.printableBounds?.minY);
  if (!Number.isFinite(printableTop) || !Number.isFinite(movementHeight) || movementHeight <= 0) return initial;
  const y = clamp((-printableTop / movementHeight) * 100, -42, 42);
  return { ...initial, y: Math.round(y * 10) / 10 };
}

function fitArtworkToPrintAreaTransform(artwork, printGuide, currentTransform = {}) {
  const profileWidth = Number(printGuide?.widthIn || 0);
  const profileHeight = Number(printGuide?.heightIn || 0);
  const movementWidth = profileWidth * MOVE_BOX_RATIO;
  const movementHeight = profileHeight * MOVE_BOX_RATIO;
  const currentScale = clamp(currentTransform?.scale ?? 100, 30, 180);
  const rotation = clamp(currentTransform?.rotation ?? 0, -180, 180);
  const neutral = { scale: currentScale, rotation, x: 0, y: 0 };
  const placement = resolveUploadArtworkPlacement(artwork, printGuide, neutral);
  const printableWidth = Number(placement?.printableBounds?.maxX) - Number(placement?.printableBounds?.minX);
  const printableHeight = Number(placement?.printableBounds?.maxY) - Number(placement?.printableBounds?.minY);

  if (![profileWidth, profileHeight, movementWidth, movementHeight, printableWidth, printableHeight].every((value) => Number.isFinite(value) && value > 0)) {
    return topAlignedArtworkTransform(artwork, printGuide);
  }

  const fitRatio = Math.min(1, profileWidth / printableWidth, profileHeight / printableHeight);
  const fittedScale = Math.floor(clamp(currentScale * fitRatio, 30, 180) * 10) / 10;
  const fitted = resolveUploadArtworkPlacement(artwork, printGuide, { scale: fittedScale, rotation, x: 0, y: 0 });
  const printableCenterX = (Number(fitted?.printableBounds?.minX) + Number(fitted?.printableBounds?.maxX)) / 2;
  const printableTop = Number(fitted?.printableBounds?.minY);
  const x = clamp(((profileWidth / 2 - printableCenterX) / movementWidth) * 100, -42, 42);
  const y = clamp((-printableTop / movementHeight) * 100, -42, 42);

  return {
    scale: fittedScale,
    rotation,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

function RangeControl({ label, value, min, max, suffix = '', onChange }) {
  return <label className="block"><div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600"><span>{label}</span><span>{Math.round(Number(value || 0) * 10) / 10}{suffix}</span></div><input type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer" /></label>;
}

export default function UploadArtworkEditorV2({ product, color, size, side, editor, onPatch, onConfirmedChange }) {
  const fileRef = useRef(null);
  const referenceBoxRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [legacyArtworkDimensions, setLegacyArtworkDimensions] = useState(null);
  const transform = editor.transform || { scale: 100, rotation: 0, x: 0, y: 0 };
  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const printGuide = resolveStudioV2PrintGuide(product, size, side);
  const artworkForPlacement = editor.artwork
    && !(Number(editor.artwork.pixelWidth) > 0 && Number(editor.artwork.pixelHeight) > 0)
    && legacyArtworkDimensions?.url === editor.artwork.url
      ? { ...editor.artwork, pixelWidth: legacyArtworkDimensions.pixelWidth, pixelHeight: legacyArtworkDimensions.pixelHeight }
      : editor.artwork;
  const placement = resolveUploadArtworkPlacement(artworkForPlacement, printGuide, transform);
  const lowConfidenceDpi = placement.sizeSource === 'low-confidence-dpi-fit';
  const outsideRecommendedArea = Boolean(editor.artwork) && placement.outsideRecommendedArea;
  const quality = studioV2ArtworkQuality(placement.effectiveDpi);
  const overflowDescription = describeArtworkOverflow(placement.overflow);
  const patchTransform = (patch) => onPatch({ transform: { ...transform, ...patch } });
  const gesture = useTouchTransformV2({ transform, onChange: (next) => onPatch({ transform: next }), containerRef: referenceBoxRef, enabled: Boolean(editor.artwork), minScale: 30, maxScale: 180, minX: -42, maxX: 42, minY: -42, maxY: 42 });

  const uploadArtwork = async (file) => {
    if (!file || !String(file.type || '').startsWith('image/')) { setError('Please choose a JPG, PNG or WebP artwork file.'); return; }
    setUploading(true); setError('');
    try {
      const [uploaded, metrics] = await Promise.all([
        customerApi.uploadArtwork(file),
        analyzeStudioV2ArtworkFile(file),
      ]);
      const artwork = {
        url: uploaded.file_url,
        path: uploaded.storage_path,
        name: file.name || 'customer-artwork',
        type: file.type || 'image/png',
        ...metrics,
      };
      onPatch({
        artwork,
        transform: topAlignedArtworkTransform(artwork, printGuide),
      });
    } catch (uploadError) {
      setError(uploadError?.message || 'Artwork upload failed. Please retry.');
    } finally { setUploading(false); }
  };

  const hydrateLegacyArtworkDimensions = (event) => {
    if (!editor.artwork || (Number(editor.artwork.pixelWidth) > 0 && Number(editor.artwork.pixelHeight) > 0)) return;
    const pixelWidth = Number(event.currentTarget?.naturalWidth || 0);
    const pixelHeight = Number(event.currentTarget?.naturalHeight || 0);
    if (!pixelWidth || !pixelHeight) return;
    setLegacyArtworkDimensions({ url: editor.artwork.url, pixelWidth, pixelHeight });
  };

  const qualityClass = quality.tone === 'emerald'
    ? 'bg-emerald-100 text-emerald-800'
    : quality.tone === 'amber'
      ? 'bg-amber-100 text-amber-800'
      : quality.tone === 'red'
        ? 'bg-red-100 text-red-800'
        : 'bg-slate-100 text-slate-700';

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 px-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Live garment preview · {side}</p><p className="text-sm font-bold text-slate-700">Drag with one finger. Pinch with two fingers to resize and rotate.</p></div>
        <div className="mx-auto w-full max-w-[680px] rounded-[28px] bg-slate-100 p-3 sm:p-5">
          <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
            {garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}
            <div data-gdp-print-guide="true" aria-label={`Recommended ${side} print area ${printGuide.label}`} className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-lg border-2 border-dashed border-slate-500/50 bg-white/5" style={printGuide.style}>
              <span className="pointer-events-none absolute right-1 top-1 z-50 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-white">{printGuide.label}</span>
              <div ref={referenceBoxRef} className="pointer-events-none absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2" />
              {editor.artwork?.url ? (
                <div
                  {...gesture}
                  data-gdp-upload-artwork-layer="true"
                  className="absolute grid cursor-grab place-items-center rounded-sm ring-2 ring-cyan-400/75 ring-offset-1 ring-offset-transparent"
                  style={{
                    ...gesture.style,
                    left: `${placement.centerXPercent}%`,
                    top: `${placement.centerYPercent}%`,
                    width: `${placement.widthPercent}%`,
                    height: `${placement.heightPercent}%`,
                    transform: `translate(-50%, -50%) scale(${clamp(transform.scale, 30, 180) / 100}) rotate(${clamp(transform.rotation, -180, 180)}deg)`,
                  }}
                >
                  <img src={editor.artwork.url} alt="Uploaded artwork preview" draggable="false" onLoad={hydrateLegacyArtworkDimensions} className={`h-full w-full select-none ${artworkForPlacement?.pixelWidth && artworkForPlacement?.pixelHeight ? 'object-fill' : 'object-contain'}`} />
                </div>
              ) : <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs font-bold text-slate-500">Upload artwork to place it on the {side} print area.</div>}
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] font-bold text-slate-400">The dashed fabric box uses the exact garment print profile. New artwork starts at the top of the printable area while keeping its original proportions. Reliable print DPI keeps true physical size; mobile/screen DPI files use a safe fitted base size.</p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Artwork controls</p><h2 className="mt-1 text-xl font-black text-slate-900">Position artwork</h2></div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadArtwork(event.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">{uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}{editor.artwork ? 'Replace artwork' : 'Upload artwork'}</button>
        {error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
        {outsideRecommendedArea ? <div role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Printable artwork extends outside the recommended print area{overflowDescription ? ` (${overflowDescription})` : ''}. Move or resize it before approval. Transparent padding is ignored.</span></div> : null}
        {editor.artwork ? <>
          <div data-gdp-artwork-metrics="true" className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">Artwork information</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${qualityClass}`}>{quality.label}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <span className="font-semibold text-slate-500">File resolution</span><span className="text-right font-black text-slate-800">{artworkForPlacement?.pixelWidth || '—'} × {artworkForPlacement?.pixelHeight || '—'} px</span>
              <span className="font-semibold text-slate-500">Embedded DPI</span><span className="text-right font-black text-slate-800">{formatDpi(editor.artwork.sourceDpi)}</span>
              <span className="font-semibold text-slate-500">{lowConfidenceDpi ? 'Embedded size' : 'Original size'}</span><span className="text-right font-black text-slate-800">{editor.artwork.sourceWidthIn && editor.artwork.sourceHeightIn ? `${formatArtworkInches(editor.artwork.sourceWidthIn)} × ${formatArtworkInches(editor.artwork.sourceHeightIn)} in` : 'DPI not embedded'}</span>
              <span className="font-semibold text-slate-500">Current print size</span><span className="text-right font-black text-slate-800">{formatArtworkInches(placement.widthIn)} × {formatArtworkInches(placement.heightIn)} in</span>
              <span className="font-semibold text-slate-500">Effective DPI</span><span className="text-right font-black text-slate-800">{placement.effectiveDpi ? `${Math.round(placement.effectiveDpi)} DPI` : '—'}</span>
              <span className="font-semibold text-slate-500">Garment print area</span><span className="text-right font-black text-slate-800">{printGuide.dimensionsLabel}</span>
            </div>
            {lowConfidenceDpi ? <p data-gdp-low-confidence-dpi-note="true" className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold leading-4 text-slate-600">The embedded {Math.round(Number(editor.artwork.sourceDpi || 0))} DPI is treated as mobile/screen metadata. The embedded inch size is informational only. 100% artwork scale means 100% of the safely fitted print size.</p> : null}
            {!editor.artwork.sourceDpi ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold leading-4 text-slate-500">This file does not contain reliable DPI metadata, so the Studio keeps the existing fit-to-area behavior instead of guessing a physical size.</p> : null}
          </div>
          <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
            <RangeControl label={lowConfidenceDpi ? "Artwork scale · fitted size" : "Artwork scale"} value={transform.scale} min={30} max={180} suffix="%" onChange={(value) => patchTransform({ scale: value })} />
            {lowConfidenceDpi ? <p className="px-1 text-[10px] font-semibold leading-4 text-slate-500">At 100%, this file prints at {formatArtworkInches(placement.baseWidthIn)} × {formatArtworkInches(placement.baseHeightIn)} in before any manual scaling.</p> : null}
            <RangeControl label="Move left / right" value={transform.x} min={-42} max={42} suffix="%" onChange={(value) => patchTransform({ x: value })} />
            <RangeControl label="Move up / down" value={transform.y} min={-42} max={42} suffix="%" onChange={(value) => patchTransform({ y: value })} />
            <RangeControl label="Rotation" value={transform.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchTransform({ rotation: value })} />
            <button data-gdp-fit-artwork="true" type="button" onClick={() => onPatch({ transform: fitArtworkToPrintAreaTransform(artworkForPlacement, printGuide, transform) })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-800"><Maximize2 size={14} /> Fit to print area</button>
            <p className="px-1 text-[10px] font-semibold leading-4 text-slate-500">Fit only shrinks oversized printable artwork when needed, keeps the aspect ratio and rotation, ignores transparent padding, and returns it to a safe top-aligned position.</p>
            <button type="button" onClick={() => onPatch({ transform: topAlignedArtworkTransform(artworkForPlacement, printGuide) })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset to original size & top position</button>
          </div>
          <button type="button" onClick={() => onConfirmedChange(!editor.confirmed)} aria-pressed={editor.confirmed} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">I’m done positioning my {side} artwork</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm the current size, rotation and placement before review.</span></span></button></> : null}
      </section>
    </div>
  );
}
