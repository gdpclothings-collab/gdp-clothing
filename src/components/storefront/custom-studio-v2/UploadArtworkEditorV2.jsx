import React, { useEffect, useRef, useState } from 'react';
import StudioMobilePreviewMirror, { StudioMobileGarmentMirror } from '@/components/storefront/custom-studio-v2/StudioMobilePreviewMirror';
import StudioDesktopViewZoom from '@/components/storefront/custom-studio-v2/StudioDesktopViewZoom';
import StudioArtworkComparison from '@/components/storefront/custom-studio-v2/StudioArtworkComparison';
import useStudioMobileFloatingPreview from '@/components/storefront/custom-studio-v2/useStudioMobileFloatingPreview';
import { AlertTriangle, Check, ImagePlus, Loader2, Maximize2, RotateCcw } from 'lucide-react';
import { customerApi } from '@/lib/customerApi';
import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';
import '@/components/storefront/custom-studio-v2/selectionBorderFix';
import { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';
import { resolveStudioV2PrintGuide } from '@/lib/customStudioV2PrintGuide';
import {
  analyzeStudioV2ArtworkFile,
  constrainUploadArtworkTransform,
  describeArtworkOverflow,
  formatArtworkInches,
  resolveUploadArtworkPlacement,
} from '@/lib/customStudioV2ArtworkMetrics';
import { assessStudioImagePrintQuality, createBasicStudioEnhancement } from '@/lib/studioSmartImageQuality';

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
  const currentScale = clamp(currentTransform?.scale ?? 100, 1, 1000);
  const rotation = clamp(currentTransform?.rotation ?? 0, -180, 180);
  const neutral = { ...currentTransform, scale: currentScale, rotation, x: 0, y: 0 };
  const placement = resolveUploadArtworkPlacement(artwork, printGuide, neutral);
  const printableWidth = Number(placement?.printableBounds?.maxX) - Number(placement?.printableBounds?.minX);
  const printableHeight = Number(placement?.printableBounds?.maxY) - Number(placement?.printableBounds?.minY);

  if (![profileWidth, profileHeight, movementWidth, movementHeight, printableWidth, printableHeight].every((value) => Number.isFinite(value) && value > 0)) {
    return topAlignedArtworkTransform(artwork, printGuide);
  }

  const fitRatio = Math.min(1, profileWidth / printableWidth, profileHeight / printableHeight);
  const fittedScale = Math.floor(clamp(currentScale * fitRatio, 1, 1000) * 10) / 10;
  const fitted = resolveUploadArtworkPlacement(artwork, printGuide, { scale: fittedScale, rotation, x: 0, y: 0 });
  const printableCenterX = (Number(fitted?.printableBounds?.minX) + Number(fitted?.printableBounds?.maxX)) / 2;
  const printableTop = Number(fitted?.printableBounds?.minY);
  const x = clamp(((profileWidth / 2 - printableCenterX) / movementWidth) * 100, -42, 42);
  const y = clamp((-printableTop / movementHeight) * 100, -42, 42);

  return {
    ...currentTransform,
    scale: fittedScale,
    rotation,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

function RangeControl({ label, value, min, max, suffix = '', onChange, onReset }) {
  return <label className="block"><div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-600"><span>{label}</span><span className="flex items-center gap-2">{Math.round(Number(value || 0) * 10) / 10}{suffix}{onReset ? <button type="button" onClick={(event) => { event.preventDefault(); onReset(); }} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700" aria-label={`Reset ${label}`}>Reset</button> : null}</span></div><input type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer" /></label>;
}

export default function UploadArtworkEditorV2({ product, color, size, side, editor, onPatch, onConfirmedChange }) {
  const fileRef = useRef(null);
  const referenceBoxRef = useRef(null);
  const enhancementPanelRef = useRef(null);
  const { garmentRef, inspectorRef, visible: floatingPreviewVisible, minimized: mobilePreviewMinimized, setMinimized: setMobilePreviewMinimized } = useStudioMobileFloatingPreview();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [enhancementPreview, setEnhancementPreview] = useState(null);
  const [enhanceError, setEnhanceError] = useState('');
  const [enhancementPanelVisible, setEnhancementPanelVisible] = useState(false);
  const [previewRestoredInsideEnhancement, setPreviewRestoredInsideEnhancement] = useState(false);
  const sourceFileRef = useRef(null);
  useEffect(() => () => { if (enhancementPreview?.url) URL.revokeObjectURL(enhancementPreview.url); }, [enhancementPreview]);
  const [legacyArtworkDimensions, setLegacyArtworkDimensions] = useState(null);
  const hasArtwork = Boolean(editor.artwork);
  // Collapse only the Upload editor's mobile floating mirror while its
  // enhancement tools are onscreen. An explicit Restore still works.
  useEffect(() => {
    const node = enhancementPanelRef.current;
    if (!hasArtwork || !node || typeof IntersectionObserver !== 'function') {
      setEnhancementPanelVisible(false);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setEnhancementPanelVisible(entry.isIntersecting);
      if (!entry.isIntersecting) setPreviewRestoredInsideEnhancement(false);
    }, { rootMargin: '-96px 0px -15% 0px', threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasArtwork]);
  const rawTransform = editor.transform || { scale: 100, rotation: 0, x: 0, y: 0 };
  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const printGuide = resolveStudioV2PrintGuide(product, size, side, color);
  const artworkForPlacement = editor.artwork
    && !(Number(editor.artwork.pixelWidth) > 0 && Number(editor.artwork.pixelHeight) > 0)
    && legacyArtworkDimensions?.url === editor.artwork.url
      ? { ...editor.artwork, pixelWidth: legacyArtworkDimensions.pixelWidth, pixelHeight: legacyArtworkDimensions.pixelHeight }
      : editor.artwork;
  const transform = constrainUploadArtworkTransform(artworkForPlacement, printGuide, rawTransform);
  const placement = resolveUploadArtworkPlacement(artworkForPlacement, printGuide, transform);
  const lowConfidenceDpi = placement.sizeSource === 'low-confidence-dpi-fit';
  const outsideRecommendedArea = Boolean(editor.artwork) && placement.outsideRecommendedArea;
  const quality = assessStudioImagePrintQuality({
    pixelWidth: artworkForPlacement?.pixelWidth,
    pixelHeight: artworkForPlacement?.pixelHeight,
    originalPixelWidth: artworkForPlacement?.originalPixelWidth,
    originalPixelHeight: artworkForPlacement?.originalPixelHeight,
    printWidthIn: placement.widthIn,
    printHeightIn: placement.heightIn,
  });
  const overflowDescription = describeArtworkOverflow(placement.overflow);
  const bleedCrop = transform.bleedCrop === true;
  const patchTransform = (patch) => onPatch({ transform: constrainUploadArtworkTransform(artworkForPlacement, printGuide, { ...transform, ...patch }) });
  const gesture = useTouchTransformV2({ transform, onChange: (next) => onPatch({ transform: constrainUploadArtworkTransform(artworkForPlacement, printGuide, next) }), containerRef: referenceBoxRef, enabled: Boolean(editor.artwork), minScale: 1, maxScale: 1000, minX: bleedCrop ? -150 : -42, maxX: bleedCrop ? 150 : 42, minY: bleedCrop ? -150 : -42, maxY: bleedCrop ? 150 : 42 });

  const uploadArtwork = async (file) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Please choose a JPG, PNG or WebP artwork file.'); return; }
    setEnhancementPreview(null); setEnhanceError('');
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
      sourceFileRef.current = { file, path: artwork.path };
      onPatch({
        artwork,
        // Preserve safe initial fit, then unlock cropping for subsequent edits.
        transform: { ...constrainUploadArtworkTransform(artwork, printGuide, topAlignedArtworkTransform(artwork, printGuide)), bleedCrop: true },
      });
    } catch (uploadError) {
      setError(uploadError?.message || 'Artwork upload failed. Please retry.');
    } finally { setUploading(false); }
  };

  const tryFreeEnhancement = async () => {
    const source = sourceFileRef.current;
    if (!source || source.path !== editor.artwork?.path || editor.artwork?.basicEnhanced) {
      setEnhanceError('Upload the original artwork again to try free enhancement.');
      return;
    }
    setEnhancing(true); setEnhanceError('');
    try {
      const preview = await createBasicStudioEnhancement(source.file);
      setEnhancementPreview({ ...preview, sourcePath: source.path, url: URL.createObjectURL(preview.file) });
    } catch (enhanceFailure) {
      setEnhanceError(enhanceFailure?.message || 'Enhancement is unavailable. Your original is unchanged.');
    } finally {
      setEnhancing(false);
    }
  };

  const applyFreeEnhancement = async () => {
    if (!enhancementPreview || enhancementPreview.sourcePath !== editor.artwork?.path) return;
    setEnhancing(true); setEnhanceError('');
    try {
      const [uploaded, metrics] = await Promise.all([
        customerApi.uploadArtwork(enhancementPreview.file),
        analyzeStudioV2ArtworkFile(enhancementPreview.file),
      ]);
      const original = editor.artwork;
      const hasTrustedSize = Number(original.sourceDpi) >= 150 &&
        Number(original.sourceWidthIn) > 0 && Number(original.sourceHeightIn) > 0;
      const improvedArtwork = {
        ...original,
        ...metrics,
        url: uploaded.file_url,
        path: uploaded.storage_path,
        name: enhancementPreview.file.name,
        type: enhancementPreview.file.type,
        sourceDpi: hasTrustedSize ? Math.min(metrics.pixelWidth / original.sourceWidthIn, metrics.pixelHeight / original.sourceHeightIn) : original.sourceDpi,
        sourceDpiX: hasTrustedSize ? metrics.pixelWidth / original.sourceWidthIn : original.sourceDpiX,
        sourceDpiY: hasTrustedSize ? metrics.pixelHeight / original.sourceHeightIn : original.sourceDpiY,
        sourceWidthIn: original.sourceWidthIn,
        sourceHeightIn: original.sourceHeightIn,
        physicalSizeSource: original.physicalSizeSource,
        originalPixelWidth: Number(original.originalPixelWidth) || Number(original.pixelWidth) || 0,
        originalPixelHeight: Number(original.originalPixelHeight) || Number(original.pixelHeight) || 0,
        originalArtwork: original,
        basicEnhanced: true,
      };
      onPatch({ artwork: improvedArtwork, transform });
      setEnhancementPreview(null);
    } catch (enhanceFailure) {
      setEnhanceError(enhanceFailure?.message || 'Could not save the improvement. Original artwork remains available.');
    } finally {
      setEnhancing(false);
    }
  };

  const restoreOriginalArtwork = () => {
    if (!editor.artwork?.originalArtwork) return;
    onPatch({ artwork: editor.artwork.originalArtwork, transform });
    setEnhancementPreview(null); setEnhanceError('');
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
      <section ref={garmentRef} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 px-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Live garment preview · {side}</p><p className="text-sm font-bold text-slate-700">Drag with one finger. Pinch with two fingers to resize and rotate.</p></div>
        <div className="mx-auto w-full max-w-[680px] rounded-[28px] bg-slate-100 p-3 sm:p-5">
          <StudioDesktopViewZoom side={side}>
          <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
            {garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}
            <div data-gdp-print-guide="true" data-gdp-upload-overflow-preview={outsideRecommendedArea ? 'outside' : 'inside'} aria-label={`Recommended ${side} print area ${printGuide.label}`} className={`absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-lg border-2 border-dashed ${outsideRecommendedArea ? 'border-amber-500 bg-amber-50/10' : 'border-slate-500/50 bg-white/5'}`} style={{ ...printGuide.style, overflow: 'hidden' }}>
              <span className="pointer-events-none absolute right-1 top-1 z-50 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-white">{printGuide.label}</span>
              <div ref={referenceBoxRef} className="pointer-events-none absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2" />
              {editor.artwork?.url ? (
                <div
                  {...gesture}
                  data-gdp-upload-artwork-layer="true"
                  className={`absolute grid cursor-grab place-items-center rounded-sm ring-2 ring-offset-1 ring-offset-transparent ${outsideRecommendedArea ? 'ring-amber-500/90' : 'ring-cyan-400/75'}`}
                  style={{
                    ...gesture.style,
                    left: `${placement.centerXPercent}%`,
                    top: `${placement.centerYPercent}%`,
                    width: `${placement.widthPercent}%`,
                    height: `${placement.heightPercent}%`,
                    transform: `translate(-50%, -50%) rotate(${clamp(transform.rotation, -180, 180)}deg) scale(${transform.scale * transform.widthScale / 10000}, ${transform.scale * transform.heightScale / 10000})`,
                  }}
                >
                  <img src={editor.artwork.url} alt="Uploaded artwork preview" draggable="false" onLoad={hydrateLegacyArtworkDimensions} className={`h-full w-full select-none ${artworkForPlacement?.pixelWidth && artworkForPlacement?.pixelHeight ? 'object-fill' : 'object-contain'}`} />
                </div>
              ) : <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs font-bold text-slate-500">Upload artwork to place it on the {side} print area.</div>}
            </div>
          </div>
          </StudioDesktopViewZoom>
        </div>
        {editor.artwork ? <button type="button" onClick={() => inspectorRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })} className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 sm:hidden">Edit selected artwork controls</button> : null}
        <p className="mt-2 text-center text-[10px] font-bold text-slate-400">The dashed fabric box uses the garment print profile. With Bleed & Crop enabled, you can move and enlarge artwork beyond its boundaries; the excess is cut off in preview and print. Reliable embedded DPI preserves physical size; mobile/screen files use a fitted base size.</p>
      </section>

      <section ref={inspectorRef} className="scroll-mt-24 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        {floatingPreviewVisible ? <StudioMobilePreviewMirror side={side} minimized={mobilePreviewMinimized || (enhancementPanelVisible && !previewRestoredInsideEnhancement)} onMinimize={() => { setMobilePreviewMinimized(true); setPreviewRestoredInsideEnhancement(false); }} onRestore={() => { setMobilePreviewMinimized(false); setPreviewRestoredInsideEnhancement(true); }}>
          <StudioMobileGarmentMirror garmentPreview={garmentPreview} productName={product.name} side={side} printGuide={printGuide}>
            {editor.artwork?.url ? (
              <div data-gdp-upload-mirror-artwork="true" className="absolute grid place-items-center" style={{
                left: `${placement.centerXPercent}%`,
                top: `${placement.centerYPercent}%`,
                width: `${placement.widthPercent}%`,
                height: `${placement.heightPercent}%`,
                transform: `translate(-50%, -50%) rotate(${clamp(transform.rotation, -180, 180)}deg) scale(${transform.scale * transform.widthScale / 10000}, ${transform.scale * transform.heightScale / 10000})`,
              }}>
                <img src={editor.artwork.url} alt="" draggable="false" className={`h-full w-full ${artworkForPlacement?.pixelWidth && artworkForPlacement?.pixelHeight ? 'object-fill' : 'object-contain'}`} />
              </div>
            ) : null}
          </StudioMobileGarmentMirror>
        </StudioMobilePreviewMirror> : null}
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Artwork controls</p><h2 className="mt-1 text-xl font-black text-slate-900">Position artwork</h2></div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; uploadArtwork(file); }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">{uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}{editor.artwork ? 'Replace artwork' : 'Upload artwork'}</button>
        {error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
        {outsideRecommendedArea ? <div role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{bleedCrop ? 'Bleed & Crop is on. Artwork outside the print area will be cut off in preview and in the 300-DPI print.' : `Printable artwork at ${formatArtworkInches(placement.widthIn)} × ${formatArtworkInches(placement.heightIn)} in extends outside the ${side} print area (${printGuide.dimensionsLabel})${overflowDescription ? `: ${overflowDescription}` : ''}. Move or resize it before approval. Transparent padding is ignored.`}</span></div> : null}
        {editor.artwork ? <>
          <div data-gdp-smart-quality="upload-artwork" role="status" className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-3">
            <div className="flex items-center justify-between gap-2"><p className="text-sm font-black text-slate-900">Smart print quality check · Free</p><span className={['rounded-full px-2 py-1 text-[10px] font-black', qualityClass].join(' ')}>{quality.label}</span></div>
            <p className="text-xs font-semibold leading-5 text-slate-700">{quality.message}</p>
            {editor.artwork.basicEnhanced ? <p className="text-[11px] font-bold text-amber-800">Basic enhancement can smooth and sharpen pixels, but cannot create the missing details in the original photo. The quality recommendation still uses your original image.</p> : null}
          </div>
          <div data-gdp-artwork-metrics="true" className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">Artwork information</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${qualityClass}`}>{quality.label}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <span className="font-semibold text-slate-500">File resolution</span><span className="text-right font-black text-slate-800">{artworkForPlacement?.pixelWidth || '—'} × {artworkForPlacement?.pixelHeight || '—'} px</span>
              <span className="font-semibold text-slate-500">{editor.artwork.basicEnhanced ? "Original print sizing" : "Embedded DPI"}</span><span className="text-right font-black text-slate-800">{editor.artwork.basicEnhanced ? "Preserved" : formatDpi(editor.artwork.sourceDpi)}</span>
              <span className="font-semibold text-slate-500">{lowConfidenceDpi ? 'Embedded size' : 'Original size'}</span><span className="text-right font-black text-slate-800">{editor.artwork.sourceWidthIn && editor.artwork.sourceHeightIn ? `${formatArtworkInches(editor.artwork.sourceWidthIn)} × ${formatArtworkInches(editor.artwork.sourceHeightIn)} in` : 'DPI not embedded'}</span>
              <span className="font-semibold text-slate-500">Current print size</span><span className="text-right font-black text-slate-800">{formatArtworkInches(placement.widthIn)} × {formatArtworkInches(placement.heightIn)} in</span>
              <span className="font-semibold text-slate-500">{editor.artwork.basicEnhanced ? "Output pixel density" : "Effective DPI"}</span><span className="text-right font-black text-slate-800">{placement.effectiveDpi ? `${Math.round(placement.effectiveDpi)} DPI` : '—'}</span>
              <span className="font-semibold text-slate-500">Garment print area</span><span className="text-right font-black text-slate-800">{printGuide.dimensionsLabel}</span>
            </div>
            {lowConfidenceDpi ? <p data-gdp-low-confidence-dpi-note="true" className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold leading-4 text-slate-600">The embedded {Math.round(Number(editor.artwork.sourceDpi || 0))} DPI is treated as mobile/screen metadata. The embedded inch size is informational only. 100% artwork scale means 100% of the safely fitted print size.</p> : null}
            {!editor.artwork.sourceDpi ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] font-semibold leading-4 text-slate-500">This file does not contain reliable DPI metadata, so the Studio keeps the existing fit-to-area behavior instead of guessing a physical size.</p> : null}
          </div>
          <div ref={enhancementPanelRef} data-gdp-free-artwork-enhancement="true" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-black text-slate-900">Free basic image enhancement</p>
            <p className="text-xs font-semibold leading-5 text-slate-600">Optional local sharpening and up to 2× smoother resizing. Preview first; your original remains available. This is not AI restoration and cannot repair severe blur, changed lettering or missing details.</p>
            {editor.artwork.basicEnhanced ? (
              <button type="button" disabled={uploading || enhancing} onClick={restoreOriginalArtwork} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-800">Restore original artwork</button>
            ) : <>
              <button type="button" onClick={tryFreeEnhancement} disabled={uploading || enhancing || !sourceFileRef.current || sourceFileRef.current.path !== editor.artwork.path} className="min-h-11 w-full rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-40">{enhancing ? 'Processing image…' : 'Try free improvement'}</button>
              {(!sourceFileRef.current || sourceFileRef.current.path !== editor.artwork.path) ? <p className="text-[11px] font-semibold text-slate-500">For an older saved upload, replace it with the original file to enable a fresh enhancement preview.</p> : null}
            </>}
            {enhanceError ? <p role="alert" className="text-xs font-semibold text-red-700">{enhanceError}</p> : null}
            {enhancementPreview && enhancementPreview.sourcePath === editor.artwork.path ? <>
              <StudioArtworkComparison originalUrl={editor.artwork.url} enhancedUrl={enhancementPreview.url} />
              <button type="button" onClick={applyFreeEnhancement} disabled={enhancing || uploading} className="min-h-11 w-full rounded-xl bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-40">{enhancing ? 'Saving…' : 'Apply improvement'}</button>
              <button type="button" onClick={() => setEnhancementPreview(null)} disabled={enhancing} className="min-h-10 w-full rounded-xl border border-slate-200 text-xs font-bold text-slate-700">Keep original · Cancel</button>
            </> : null}
          </div>
          <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
            <label data-gdp-upload-bleed-crop="true" className="flex items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs font-bold text-cyan-950"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={bleedCrop} onChange={(event) => patchTransform({ bleedCrop: event.target.checked })} /><span>Bleed &amp; Crop <span className="mt-1 block font-medium">Drag or enlarge beyond the dotted boundary. Only artwork inside the box prints; switch off to restore safe-fit positioning.</span></span></label>
             <RangeControl label={lowConfidenceDpi ? "Artwork scale · fitted size" : "Artwork scale"} value={transform.scale} min={1} max={1000} suffix="%" onChange={(value) => patchTransform({ scale: value })} onReset={() => patchTransform({ scale: 100 })} />
            <div data-gdp-upload-free-reshape="width-height" className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-black text-slate-800">Free reshape</p>
              <RangeControl label="Artwork width" value={transform.widthScale ?? 100} min={1} max={1000} suffix="%" onChange={(value) => patchTransform({ widthScale: value })} onReset={() => patchTransform({ widthScale: 100 })} />
              <RangeControl label="Artwork height" value={transform.heightScale ?? 100} min={1} max={1000} suffix="%" onChange={(value) => patchTransform({ heightScale: value })} onReset={() => patchTransform({ heightScale: 100 })} />
              <button type="button" onClick={() => patchTransform({ widthScale: 100, heightScale: 100 })} className="min-h-10 w-full rounded-xl border border-slate-200 text-xs font-bold text-slate-600">Reset original proportions</button>
              <p className="text-[10px] font-medium text-slate-500">Width and height can stretch independently. Print size and effective DPI update automatically; the print canvas clips anything outside its boundary.</p>
            </div>
            {lowConfidenceDpi ? <p className="px-1 text-[10px] font-semibold leading-4 text-slate-500">At 100%, this file prints at {formatArtworkInches(placement.baseWidthIn)} × {formatArtworkInches(placement.baseHeightIn)} in before any manual scaling.</p> : null}
            <RangeControl label="Move left / right" value={transform.x} min={bleedCrop ? -150 : -42} max={bleedCrop ? 150 : 42} suffix="%" onChange={(value) => patchTransform({ x: value })} onReset={() => patchTransform({ x: 0 })} />
            <RangeControl label="Move up / down" value={transform.y} min={bleedCrop ? -150 : -42} max={bleedCrop ? 150 : 42} suffix="%" onChange={(value) => patchTransform({ y: value })} onReset={() => patchTransform({ y: 0 })} />
            <RangeControl label="Rotation" value={transform.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchTransform({ rotation: value })} onReset={() => patchTransform({ rotation: 0 })} />
            <button data-gdp-fit-artwork="true" type="button" onClick={() => onPatch({ transform: constrainUploadArtworkTransform(artworkForPlacement, printGuide, fitArtworkToPrintAreaTransform(artworkForPlacement, printGuide, transform)) })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-800"><Maximize2 size={14} /> Fit to print area</button>
            <p className="px-1 text-[10px] font-semibold leading-4 text-slate-500">Fit only shrinks oversized printable artwork when needed, keeps the aspect ratio and rotation, ignores transparent padding, and returns it to a safe top-aligned position.</p>
            <button type="button" onClick={() => onPatch({ transform: { ...constrainUploadArtworkTransform(artworkForPlacement, printGuide, topAlignedArtworkTransform(artworkForPlacement, printGuide)), bleedCrop } })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset to original size & top position</button>
          </div>
          <button type="button" onClick={() => onConfirmedChange(!editor.confirmed)} aria-pressed={editor.confirmed} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">I’m done positioning my {side} artwork</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm the current size, rotation and placement before review.</span></span></button></> : null}
      </section>
    </div>
  );
}
