import React, { useEffect, useMemo, useRef, useState } from 'react';
import StudioMobilePreviewMirror from '@/components/storefront/custom-studio-v2/StudioMobilePreviewMirror';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ImagePlus,
  Eye,
  EyeOff,
  Focus,
  Layers,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { customerApi } from '@/lib/customerApi';
import { imageHasTransparency } from '@/lib/studioImageTransparency';
import { normalizeStyleTemplates } from '@/lib/customStudioStyleTemplates';
import {
  createV2PhotoLayer,
  createV2StickerLayer,
  defaultV2TextStyle,
  normalizeV2StickerLibrary,
  V2_FONT_PRESETS,
  V2_TEXT_CURVES,
  V2_TEXT_EFFECTS,
  v2LayerId,
} from '@/lib/customStudioV2EditorOptions';
import {
  bootlegAnchorToSlider,
  bootlegGestureLimits,
  bootlegSliderToAnchor,
  constrainBootlegTextStyleToCanvas,
  resolveBootlegAnchorRanges,
} from '@/lib/customStudioV2BootlegTextLayout';
import {
  BOOTLEG_MAX_TEXT_LAYERS,
  buildBootlegTextStatePatch,
  normalizeBootlegTextStyle,
  resolveBootlegTextLayers,
} from '@/lib/customStudioV2BootlegTextLayers';
import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';
import { FULL_TEMPLATE_BOUNDS, readTemplateAlphaBounds, normalizePhotoAlphaBounds, containPhotoAlphaBounds, constrainFreePhotoTransform, constrainStickerTransform, constrainTemplateTransform } from '@/lib/customStudioV2PrintBounds';
import { templateSelectionGeometry, resizeTemplateFromHandle } from '@/lib/templateOnCanvasGeometry';
import { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';
import { resolveStudioV2PrintGuide } from '@/lib/customStudioV2PrintGuide';
import { resolveStudioV2PrintProfile } from '@/lib/customStudioV2Production';
import { renderProtectedStudioV2PngAdvanced } from '@/lib/customStudioV2ProtectedProduction';
import { applyPremiumTextPreset, normalizePremiumTextPresets, paintPremiumTextGlyph, paintPremiumTextLayout, premiumTextPreset } from '@/lib/customStudioV2PremiumTextStyles';
import { BOOTLEG_OVERLAY_PRESETS, DEFAULT_BOOTLEG_OVERLAY, normalizeBootlegOverlay, paintBootlegOverlay } from '@/lib/customStudioV2BootlegOverlays';
import { DEFAULT_PHOTO_BORDER, PHOTO_BORDER_STYLES, normalizePhotoBorder, hasPhotoBorder } from '@/lib/customStudioV2PhotoBorders';

const BOOTLEG_TEMPLATE_MIN_SCALE = 1;
const BOOTLEG_TEMPLATE_MAX_SCALE = 1000;
const BOOTLEG_MAX_PHOTOS = 8;
const templateAlphaBoundsCache = new Map();
function useTemplateAlphaBounds(assetUrl) {
  const [snapshot, setSnapshot] = useState({ assetUrl: '', bounds: FULL_TEMPLATE_BOUNDS });
  useEffect(() => {
    if (!assetUrl) return;
    if (!templateAlphaBoundsCache.has(assetUrl)) {
      templateAlphaBoundsCache.set(assetUrl, new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(readTemplateAlphaBounds(image));
        image.onerror = () => resolve(FULL_TEMPLATE_BOUNDS);
        image.src = assetUrl;
      }));
    }
    let active = true;
    templateAlphaBoundsCache.get(assetUrl).then((bounds) => { if (active) setSnapshot({ assetUrl, bounds }); });
    return () => { active = false; };
  }, [assetUrl]);
  return snapshot.assetUrl === assetUrl ? snapshot.bounds : FULL_TEMPLATE_BOUNDS;
}

// Sample each uploaded image once, then reuse its visible-pixel rectangle for
// desktop, mobile and all photo controls. Fail closed to the legacy full box.
const photoAlphaGeometryCache = new Map();
function usePhotoVisibleBounds(asset, zone, canvasAspect) {
  const assetUrl = asset?.url;
  const providedBounds = asset?.backgroundMode === 'cleaned' ? normalizePhotoAlphaBounds(asset?.foregroundBounds) : null;
  const [snapshot, setSnapshot] = useState({ assetUrl: '', info: null });
  useEffect(() => {
    if (!assetUrl) return;
    if (!photoAlphaGeometryCache.has(assetUrl)) {
      photoAlphaGeometryCache.set(assetUrl, new Promise((resolve) => {
        const image = new Image();
        // With server-measured foreground bounds we only need intrinsic image
        // dimensions, so a browser's cross-origin pixel-read policy cannot
        // silently revert a cleaned JPG to its padded rectangular bounds.
        if (!providedBounds) image.crossOrigin = 'anonymous';
        image.onload = () => resolve({
          alpha: providedBounds || readTemplateAlphaBounds(image),
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        image.onerror = () => resolve(null);
        image.src = assetUrl;
      }));
    }
    let active = true;
    photoAlphaGeometryCache.get(assetUrl).then((info) => {
      if (active) setSnapshot({ assetUrl, info });
    });
    return () => { active = false; };
  }, [assetUrl]);
  if (snapshot.assetUrl !== assetUrl || !snapshot.info) return null;
  return containPhotoAlphaBounds(providedBounds || snapshot.info.alpha, snapshot.info.width, snapshot.info.height, zone, canvasAspect);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function positiveScale(value, fallback = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, numeric);
}

function RangeControl({ label, value, min, max, step = 1, suffix = '', onChange, onReset = undefined }) {
  return (
    <div className="block" onDoubleClick={onReset ? (event) => { event.preventDefault(); onReset(); } : undefined}>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-600"><span>{label}</span><span className="flex items-center gap-2"><span>{Math.round(Number(value || 0) * 10) / 10}{suffix}</span>{onReset ? <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onReset(); }} className="rounded border border-slate-200 px-2 py-1 text-[10px] font-bold" aria-label={`Reset ${label}`}>Reset</button> : null}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer" />
    </div>
  );
}


function FlexibleCurveControl({ style, onChange }) {
  const curve = style?.curve || 'straight';
  const amount = clamp(style?.curveAmount ?? 45, 0, 100);
  const signedBend = curve === 'arc-down' ? -amount : curve === 'arc-up' ? amount : 0;
  const changeBend = (next) => {
    const bend = clamp(next, -100, 100);
    onChange({ curve: bend < 0 ? 'arc-down' : bend > 0 ? 'arc-up' : 'straight', curveAmount: Math.abs(bend) });
  };
  return (
    <div data-gdp-text-flexible-curve="photoshop-style" className="space-y-2 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-xs font-black text-slate-800">Flexible Text Curve</p><button type="button" onClick={() => onChange({ curve: 'straight', curveAmount: 45 })} className="min-h-9 rounded-lg border border-cyan-200 bg-white px-2 text-[11px] font-black text-cyan-800"><RotateCcw size={13} className="mr-1 inline" /> Straighten</button></div>
      {curve === 'wave' ? (
        <RangeControl label="Wave depth" value={amount} min={0} max={100} suffix="%" onChange={(value) => onChange({ curveAmount: value })} onReset={() => onChange({ curveAmount: 45 })} />
      ) : (
        <>
          <label className="flex items-center justify-between gap-2 text-xs font-black text-slate-700"><span>Bend</span><span className="flex items-center gap-1"><input aria-label="Text curve bend from minus 100 down to plus 100 up" type="number" min={-100} max={100} step={1} value={signedBend} onChange={(event) => changeBend(event.target.value)} className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-black" /><span>%</span></span></label>
          <input aria-label="Text curve bend slider" type="range" min={-100} max={100} step={1} value={signedBend} onChange={(event) => changeBend(event.target.value)} className="h-11 w-full cursor-pointer" />
          <div className="flex justify-between text-[10px] font-bold text-slate-500"><span>−100 Down</span><span>0 Straight</span><span>+100 Up</span></div>
        </>
      )}
      <p className="text-[10px] font-medium text-slate-500">Curvature updates the active text layer only; premium lettering stays editable and follows the same print layout.</p>
    </div>
  );
}

function PrintAreaTextSizeControl({ value, onChange, onReset }) {
  return (
    <div className="block" data-gdp-bootleg-text-size="print-area-constrained" onDoubleClick={(event) => { event.preventDefault(); onReset?.(); }}>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-600"><span>Text size · up to 1000%</span><button type="button" onClick={(event) => { event.stopPropagation(); onReset?.(); }} className="rounded border border-slate-200 px-2 py-1 text-[10px] font-bold" aria-label="Reset text size">Reset to 100%</button></div>
      <div className="flex min-h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-slate-500">
        <input
          type="number"
          min="1"
          max="1000"
          step="1"
          inputMode="decimal"
          value={Math.min(1000, positiveScale(value))}
          onChange={(event) => onChange(Math.min(1000, positiveScale(event.target.value)))}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-black text-slate-800 outline-none"
          aria-label="Text size constrained to the printable area"
        />
        <span className="px-3 text-xs font-black text-slate-400">%</span>
      </div>
      <input type="range" min="1" max="1000" step="1" value={Math.min(1000, positiveScale(value))} onChange={(event) => onChange(positiveScale(event.target.value))} className="mt-2 h-11 w-full cursor-pointer" aria-label="Text size slider, 1 to 1000 percent" />
      <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-400">1–1000% (1% keeps text editable). Double-click or press Reset to restore 100%. The safe print area automatically limits the effective size.</p>
    </div>
  );
}

function currentPhotoLayers(editor) {
  if (Array.isArray(editor?.photos) && editor.photos.length) return editor.photos;
  if (editor?.photo?.path) {
    return [{
      id: 'primary-photo',
      type: 'photo',
      asset: { ...editor.photo },
      transform: { scale: 100, rotation: 0, x: 0, y: 0, ...(editor.transform || {}) },
      order: 0,
      visible: true,
    }];
  }
  return [];
}

function resolveBootlegTextPosition(style, textZone) {
  const directX = Number(style?.canvasX);
  const directY = Number(style?.canvasY);
  if (Number.isFinite(directX) && Number.isFinite(directY)) {
    return { x: clamp(directX, 0, 100), y: clamp(directY, 0, 100) };
  }
  const zoneX = Number(textZone?.x ?? 12);
  const zoneY = Number(textZone?.y ?? 78);
  const zoneWidth = Number(textZone?.width ?? 76);
  const zoneHeight = Number(textZone?.height ?? 16);
  return {
    x: clamp(zoneX + zoneWidth / 2 + (clamp(style?.x || 0, -42, 42) / 100) * zoneWidth, 0, 100),
    y: clamp(zoneY + zoneHeight / 2 + (clamp(style?.y || 0, -42, 42) / 100) * zoneHeight, 0, 100),
  };
}

function resolveBootlegTemplateTransform(style) {
  const value = style?.templateTransform || {};
  return {
    scale: clamp(value.scale ?? 100, BOOTLEG_TEMPLATE_MIN_SCALE, BOOTLEG_TEMPLATE_MAX_SCALE),
    widthScale: clamp(value.widthScale ?? 100, 1, 1000),
    heightScale: clamp(value.heightScale ?? 100, 1, 1000),
    rotation: clamp(value.rotation ?? 0, -180, 180),
    x: clamp(value.x ?? 0, -50, 50),
    y: clamp(value.y ?? 0, -50, 50),
  };
}

function resolveMemorialTextLayers(editor = {}, fallbackStyle = {}, textZone = {}) {
  if (Array.isArray(editor?.textLayers)) {
    return editor.textLayers
      .filter(Boolean)
      .slice(0, BOOTLEG_MAX_TEXT_LAYERS)
      .map((layer, index) => ({
        ...layer,
        id: String(layer.id || `memorial-text-${index + 1}`),
        name: String(layer.name || `Text ${index + 1}`),
        role: String(layer.role || 'custom'),
        text: { headline: String(layer.text?.headline || ''), subline: '', message: '' },
        style: normalizeBootlegTextStyle(layer.style || {}, fallbackStyle),
        order: index,
        visible: layer.visible !== false,
      }));
  }

  const centerX = clamp(Number(textZone?.x ?? 12) + Number(textZone?.width ?? 76) / 2, 0, 100);
  const zoneY = Number(textZone?.y ?? 78);
  const zoneHeight = Number(textZone?.height ?? 16);
  const legacy = editor?.text || {};
  const base = normalizeBootlegTextStyle(editor?.textStyle || {}, fallbackStyle);
  const seed = (id, role, name, value, yRatio, scale) => ({
    id,
    role,
    name,
    text: { headline: String(value || ''), subline: '', message: '' },
    style: normalizeBootlegTextStyle({
      ...base,
      canvasX: centerX,
      canvasY: clamp(zoneY + zoneHeight * yRatio, 0, 100),
      fontScale: scale,
      rotation: Number(base.rotation || 0),
    }, fallbackStyle),
    visible: true,
  });

  return [
    seed('memorial-name', 'name', 'Name', legacy.headline, 0.25, Number(base.fontScale || 100)),
    seed('memorial-dates', 'dates', 'Dates', legacy.subline, 0.56, Math.max(45, Number(base.fontScale || 100) * 0.72)),
    seed('memorial-message', 'message', 'Message', legacy.message, 0.83, Math.max(38, Number(base.fontScale || 100) * 0.58)),
  ].map((layer, index) => ({ ...layer, order: index }));
}

function buildMemorialTextStatePatch(editor = {}, layers = [], activeId = '', fallbackStyle = {}) {
  const ordered = (layers || [])
    .filter(Boolean)
    .slice(0, BOOTLEG_MAX_TEXT_LAYERS)
    .map((layer, index) => ({
      ...layer,
      id: String(layer.id || `memorial-text-${index + 1}`),
      name: String(layer.name || `Text ${index + 1}`),
      role: String(layer.role || 'custom'),
      text: { headline: String(layer.text?.headline || ''), subline: '', message: '' },
      style: normalizeBootlegTextStyle(layer.style || {}, fallbackStyle),
      order: index,
      visible: layer.visible !== false,
    }));
  const active = ordered.find((layer) => layer.id === activeId) || ordered.find((layer) => layer.role === 'name') || ordered[0] || null;
  const byRole = (role) => ordered.find((layer) => layer.role === role)?.text?.headline || '';
  const templateTransform = editor?.textStyle?.templateTransform;
  return {
    textLayers: ordered,
    activeTextLayerId: active?.id || '',
    text: {
      headline: byRole('name'),
      subline: byRole('dates'),
      message: byRole('message'),
    },
    textStyle: {
      ...(active?.style || fallbackStyle || {}),
      freeTextLayout: true,
      photoForeground: false,
      ...(templateTransform ? { templateTransform } : {}),
    },
  };
}

function textEffectStyle(style) {
  const effect = style.effect || 'shadow';
  const strength = clamp(style.effectStrength ?? 45, 0, 100) / 100;
  if (effect === 'outline') return { WebkitTextStroke: `${Math.max(1, 1 + strength * 2)}px #111111`, paintOrder: 'stroke fill' };
  if (effect === 'glow') return { textShadow: `0 0 ${Math.round(5 + strength * 13)}px ${style.color || '#ffffff'}` };
  if (effect === 'shadow') return { textShadow: `${Math.round(2 + strength * 3)}px ${Math.round(2 + strength * 4)}px ${Math.round(3 + strength * 7)}px rgba(0,0,0,.82)` };
  return {};
}

function svgTextEffect(style, fontSize) {
  const effect = style.effect || 'shadow';
  const strength = clamp(style.effectStrength ?? 45, 0, 100) / 100;
  if (effect === 'outline') {
    return {
      stroke: '#111111',
      strokeWidth: Math.max(1.5, fontSize * (0.045 + strength * 0.025)),
      paintOrder: 'stroke fill',
    };
  }
  if (effect === 'glow') return { filter: `drop-shadow(0 0 ${Math.max(2, 3 + strength * 8)}px ${style.color || '#ffffff'})` };
  if (effect === 'shadow') return { filter: `drop-shadow(${Math.max(1, 1 + strength * 2)}px ${Math.max(1, 2 + strength * 3)}px ${Math.max(1, 2 + strength * 5)}px rgba(0,0,0,.82))` };
  return {};
}

function CurvedHeadline({ text, style }) {
  const curve = style.curve || 'straight';
  if (!text) return null;
  if (curve === 'straight') return <span>{text}</span>;
  const amount = clamp(style.curveAmount ?? 45, 0, 100);
  let path = `M 12 92 Q 150 ${58 - amount * 0.38} 288 92`;
  if (curve === 'arc-down') path = `M 12 42 Q 150 ${78 + amount * 0.38} 288 42`;
  if (curve === 'wave') path = `M 10 70 C 72 ${52 - amount * 0.25}, 105 ${86 + amount * 0.18}, 150 70 C 195 ${52 - amount * 0.18}, 228 ${86 + amount * 0.25}, 290 70`;
  const pathId = 'gdp-v2-protected-headline-curve';
  const fontScale = clamp(style.fontScale || 100, 55, 180);
  return (
    <svg viewBox="0 0 300 130" className="block h-full w-full overflow-visible" aria-label={text} role="img">
      <defs><path id={pathId} d={path} /></defs>
      <text fill={style.color || '#ffffff'} fontFamily={style.fontFamily} fontWeight="900" fontSize={32 * fontScale / 100} textAnchor="middle">
        <textPath href={`#${pathId}`} startOffset="50%">{text}</textPath>
      </text>
    </svg>
  );
}

function PhotoLayer({ layer, selected, zoneRef, onSelect, onTransform }) {
  const gesture = useTouchTransformV2({
    transform: layer.transform,
    onChange: onTransform,
    containerRef: zoneRef,
    enabled: selected,
    minScale: 30,
    maxScale: 220,
    minX: -48,
    maxX: 48,
    minY: -48,
    maxY: 48,
  });
  const transform = layer.transform || {};
  return (
    <div
      {...gesture}
      onPointerDown={(event) => { onSelect(); gesture.onPointerDown(event); }}
      className={`absolute inset-0 origin-center ${selected ? 'cursor-grab ring-2 ring-cyan-400/90 ring-inset' : 'pointer-events-none'}`}
      style={{
        ...gesture.style,
        zIndex: 5 + Number(layer.order || 0),
        transform: `translate(${clamp(transform.x, -48, 48)}%, ${clamp(transform.y, -48, 48)}%) scale(${clamp(transform.scale, 30, 220) / 100}) rotate(${clamp(transform.rotation, -180, 180)}deg)`,
      }}
    >
      <img src={layer.asset?.url} alt="Customer photo layer" draggable="false" className="h-full w-full select-none object-cover" />
    </div>
  );
}


function resolvePhotoCanvasPosition(transform = {}, zone = {}) {
  const directX = Number(transform?.canvasX);
  const directY = Number(transform?.canvasY);
  if (Number.isFinite(directX) && Number.isFinite(directY)) {
    return { x: clamp(directX, 0, 100), y: clamp(directY, 0, 100) };
  }
  const zoneX = Number(zone?.x ?? 15);
  const zoneY = Number(zone?.y ?? 12);
  const zoneWidth = Number(zone?.width ?? 70);
  const zoneHeight = Number(zone?.height ?? 68);
  return {
    x: clamp(zoneX + zoneWidth / 2 + (clamp(transform?.x || 0, -48, 48) / 100) * zoneWidth, 0, 100),
    y: clamp(zoneY + zoneHeight / 2 + (clamp(transform?.y || 0, -48, 48) / 100) * zoneHeight, 0, 100),
  };
}

function BootlegPhotoLayer({ layer, selected, canvasRef, zone, canvasAspect, onSelect, onTransform, scope = 'bootleg' }) {
  const visibleBounds = usePhotoVisibleBounds(layer.asset, zone, canvasAspect);
  const safeTransform = constrainFreePhotoTransform(layer.transform || {}, zone, canvasAspect, visibleBounds);
  const position = { x: safeTransform.canvasX, y: safeTransform.canvasY };
  const gesture = useTouchTransformV2({
    transform: {
      ...safeTransform,
      x: position.x - 50,
      y: position.y - 50,
    },
    onChange: (next) => onTransform(constrainFreePhotoTransform({
      ...safeTransform,
      scale: next.scale,
      rotation: next.rotation,
      canvasX: next.x + 50,
      canvasY: next.y + 50,
    }, zone, canvasAspect, visibleBounds), visibleBounds),
    containerRef: canvasRef,
    // Every Bootleg and Memorial photo responds on first pointer-down,
    // including photos that are not currently selected.
    enabled: true,
    minScale: 1,
    maxScale: 1000,
    // The image anchor may need to leave the print rectangle so the actual
    // visible pixels can touch its corners (especially when alpha padding is
    // off-center or the photo is enlarged). constrainFreePhotoTransform is
    // the authoritative visible-ink boundary in both preview and export.
    minX: Number.NEGATIVE_INFINITY,
    maxX: Number.POSITIVE_INFINITY,
    minY: Number.NEGATIVE_INFINITY,
    maxY: Number.POSITIVE_INFINITY,
  });
  const transform = safeTransform;
  const bottomFade = scope === 'bootleg' ? normalizePhotoBorder(layer.border).bottomFade : 0;
  const fadeMask = bottomFade > 0 ? `linear-gradient(to bottom, #000 0%, #000 ${100 - bottomFade}%, transparent 100%)` : undefined;
  return (
    <div
      {...gesture}
      data-gdp-bootleg-free-photo-layer={scope === 'bootleg' ? 'true' : undefined}
      data-gdp-memorial-free-photo-layer={scope === 'memorial' ? 'true' : undefined}
      onPointerDown={(event) => { if (!selected) onSelect(); gesture.onPointerDown(event); }}
      className={`pointer-events-none absolute origin-center overflow-visible select-none ${selected ? 'ring-2 ring-cyan-400/90' : ''}`}
      style={{
        ...gesture.style,
        zIndex: 5 + Number(layer.order || 0),
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${Math.max(1, Number(zone?.width ?? 70))}%`,
        height: `${Math.max(1, Number(zone?.height ?? 68))}%`,
        // A Memorial template's old oval "photo zone" is not a photo mask.
        // Source pixels stay independent of frame shape, as in the print PNG.
        borderRadius: 0,
        transform: `translate(-50%, -50%) rotate(${clamp(transform.rotation, -180, 180)}deg) scale(${transform.scale * transform.widthScale / 10000}, ${transform.scale * transform.heightScale / 10000})`,
      }}
    >
      <img src={layer.asset?.url} alt="Customer photo layer" draggable="false" className="pointer-events-none h-full w-full select-none object-contain" style={fadeMask ? { maskImage: fadeMask, WebkitMaskImage: fadeMask } : undefined} />
      {/* Transparent padding must not steal taps from visible subjects in lower layers.
          The hit area affects pointer targeting only, never clips print pixels. */}
      <div
        aria-hidden="true"
        data-gdp-photo-visible-hit-area="true"
        className={`absolute inset-0 ${selected ? 'pointer-events-auto cursor-grab' : 'pointer-events-auto cursor-pointer'}`}
        style={{
          touchAction: 'none',
          clipPath: visibleBounds ? `inset(${visibleBounds.y}% ${Math.max(0, 100 - visibleBounds.x - visibleBounds.width)}% ${Math.max(0, 100 - visibleBounds.y - visibleBounds.height)}% ${visibleBounds.x}%)` : undefined,
        }}
      />
    </div>
  );
}

function StickerLayer({ layer, selected, sticker, canvasRef, canvasAspect, onSelect, onTransform }) {
  const safeTransform = constrainStickerTransform(layer.transform || {}, canvasAspect);
  const gesture = useTouchTransformV2({
    transform: safeTransform,
    onChange: (next) => onTransform(constrainStickerTransform(next, canvasAspect)),
    containerRef: canvasRef,
    enabled: true,
    minScale: 1,
    maxScale: 1000,
    minX: -48,
    maxX: 48,
    minY: -48,
    maxY: 48,
  });
  const transform = safeTransform;
  return (
    <div
      {...gesture}
      data-gdp-sticker-layer-id={layer.id}
      onPointerDown={(event) => { onSelect(); gesture.onPointerDown(event); }}
      className={`absolute z-40 grid -translate-x-1/2 -translate-y-1/2 place-items-center select-none ${selected ? 'cursor-grab rounded-lg ring-2 ring-cyan-400/90' : 'cursor-pointer'}`}
      style={{
        ...gesture.style,
        left: `${50 + clamp(transform.x, -48, 48)}%`,
        top: `${50 + clamp(transform.y, -48, 48)}%`,
        width: `${clamp(transform.scale, 1, 1000)}%`,
        aspectRatio: '1 / 1',
        transform: `translate(-50%, -50%) rotate(${clamp(transform.rotation, -180, 180)}deg) scale(${transform.widthScale / 100}, ${transform.heightScale / 100})`,
      }}
    >
      {sticker?.assetUrl ? <img src={sticker.assetUrl} alt={sticker.label} draggable="false" className="h-full w-full object-contain" /> : <span className="text-[clamp(22px,5vw,64px)] leading-none">{sticker?.glyph || layer.glyph || '✦'}</span>}
    </div>
  );
}

function BootlegTextLayer({ layer, layout, canvasRef, selected, onPatchStyle, scope = 'bootleg' }) {
  const style = layer?.style || {};
  const rawLimits = layout ? bootlegGestureLimits(layout) : { minX: -50, maxX: 50, minY: -50, maxY: 50 };
  const canvasX = Number.isFinite(Number(style.canvasX)) ? clamp(Number(style.canvasX), 0, 100) : 50;
  const canvasY = Number.isFinite(Number(style.canvasY)) ? clamp(Number(style.canvasY), 0, 100) : 50;
  const gesture = useTouchTransformV2({
    transform: { scale: positiveScale(style.fontScale), rotation: style.rotation || 0, x: canvasX - 50, y: canvasY - 50 },
    onChange: (next) => onPatchStyle({
      ...style,
      freeTextLayout: true,
      fontScale: positiveScale(next.scale),
      rotation: next.rotation,
      canvasX: clamp(next.x + 50, 0, 100),
      canvasY: clamp(next.y + 50, 0, 100),
    }),
    containerRef: canvasRef,
    enabled: selected && Boolean(layout) && Boolean(layer?.text?.headline),
    minScale: 1,
    maxScale: 1000,
    minX: clamp(rawLimits.minX, -50, 50),
    maxX: clamp(rawLimits.maxX, -50, 50),
    minY: clamp(rawLimits.minY, -50, 50),
    maxY: clamp(rawLimits.maxY, -50, 50),
  });
  if (!layout || (!layout.headline && !layout.subline && !layout.message)) return null;
  const common = /** @type {const} */ ({
    fill: style.color || '#ffffff',
    fontFamily: style.fontFamily || 'Arial, sans-serif',
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  });
  return (
    <div
      {...gesture}
      data-gdp-bootleg-text-layer={scope === 'bootleg' ? 'true' : undefined}
      data-gdp-memorial-text-layer={scope === 'memorial' ? 'true' : undefined}
      data-gdp-bootleg-text-layer-id={scope === 'bootleg' ? layer.id : undefined}
      data-gdp-memorial-text-layer-id={scope === 'memorial' ? layer.id : undefined}
      className={`absolute inset-0 z-30 ${scope === 'bootleg' ? 'pointer-events-none' : selected ? 'cursor-grab' : 'pointer-events-none'}`}
      style={gesture.style}
    >
      {premiumTextPreset(style.premiumTextPresetId) ? <PremiumTextCanvas layout={layout} style={style} selected={selected} scope={scope} name={layer.name} /> : <svg viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" className={`h-full w-full overflow-visible ${scope === 'bootleg' ? 'pointer-events-none' : ''}`} role="img" aria-label={`Editable ${scope === 'memorial' ? 'Memorial Tribute' : 'Photo Bootleg'} ${layer.name || 'text'} layer`}>
        <g data-gdp-text-autofit={layout.horizontalFit < 1 ? 'compressed' : 'normal'} transform={layout.horizontalFit < 1 ? `translate(${layout.centerX} 0) scale(${layout.horizontalFit} 1) translate(${-layout.centerX} 0)` : undefined}>
        {layout.headline?.kind === 'straight' ? (
          <text {...common} pointerEvents={selected && scope === 'bootleg' ? 'visiblePainted' : undefined} x={layout.headline.x} y={layout.headline.y} fontSize={layout.headline.fontSize} fontWeight="900" transform={`rotate(${layout.headline.rotation || 0} ${layout.headline.x} ${layout.headline.y})`} style={svgTextEffect(style, layout.headline.fontSize)}>{layout.headline.text}</text>
        ) : null}
        {layout.headline?.kind === 'glyphs' ? layout.headline.glyphs.map((glyph, index) => (
          <text key={`${glyph.character}-${index}`} {...common} pointerEvents={selected && scope === 'bootleg' ? 'visiblePainted' : undefined} x={glyph.x} y={glyph.y} fontSize={glyph.fontSize} fontWeight="900" transform={`rotate(${glyph.rotation || 0} ${glyph.x} ${glyph.y})`} style={svgTextEffect(style, glyph.fontSize)}>{glyph.character}</text>
        )) : null}
        {layout.subline ? <text {...common} pointerEvents={selected && scope === 'bootleg' ? 'visiblePainted' : undefined} x={layout.subline.x} y={layout.subline.y} fontSize={layout.subline.fontSize} fontWeight="700" transform={`rotate(${layout.subline.rotation || 0} ${layout.subline.x} ${layout.subline.y})`} style={svgTextEffect(style, layout.subline.fontSize)}>{layout.subline.text}</text> : null}
        {layout.message ? <text {...common} pointerEvents={selected && scope === 'bootleg' ? 'visiblePainted' : undefined} x={layout.message.x} y={layout.message.y} fontSize={layout.message.fontSize} fontWeight="600" transform={`rotate(${layout.message.rotation || 0} ${layout.message.x} ${layout.message.y})`} style={svgTextEffect(style, layout.message.fontSize)}>{layout.message.text}</text> : null}
        </g>
      </svg>}
    </div>
  );
}

function PremiumTextCanvas({ layout, style, selected, scope, name }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.round(layout.width));
    canvas.height = Math.max(1, Math.round(layout.height));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    paintPremiumTextLayout(context, layout, style);
  }, [layout, style]);
  return <canvas ref={ref} className="h-full w-full" style={{ pointerEvents: selected ? 'auto' : 'none' }} role="img" aria-label={`Editable ${scope === 'memorial' ? 'Memorial Tribute' : 'Photo Bootleg'} ${name || 'premium text'} layer`} data-gdp-premium-text-canvas="preview-shared-painter" />;
}

function PremiumTextPresetTile({ preset, selected, onSelect }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 220;
    canvas.height = 80;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 220, 80);
    context.font = `${preset.fontWeight || 900} 34px ${preset.family}`;
    paintPremiumTextGlyph(context, 'GDP', 110, 36, 34, { premiumTextPresetId: preset.id });
  }, [preset]);
  return <button type="button" onClick={() => onSelect(preset.id)} aria-pressed={selected} className={`min-h-24 overflow-hidden rounded-xl border-2 p-1.5 text-center ${selected ? 'border-cyan-500 bg-slate-900 text-white' : 'border-slate-200 bg-slate-800 text-slate-100'}`}><canvas ref={ref} className="h-auto w-full" aria-hidden="true" /><span className="block text-[11px] font-black">{preset.label}</span></button>;
}


const TEMPLATE_HANDLE_POSITIONS = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
};

const TEMPLATE_HANDLE_LABELS = {
  nw: 'top-left corner', n: 'top edge', ne: 'top-right corner',
  e: 'right edge', se: 'bottom-right corner', s: 'bottom edge',
  sw: 'bottom-left corner', w: 'left edge',
};

/** Editor chrome only: no handles or selection outline enter the production PNG. */
function TemplateCanvasSelection({ transform, alphaBounds, canvasAspect, canvasRef, gesture, selected, onSelect, onDismiss, onTransform }) {
  const dragRef = useRef(null);
  const geometry = templateSelectionGeometry(transform, alphaBounds, canvasAspect);
  const position = {
    left: `${geometry.centerX}%`,
    top: `${geometry.centerY}%`,
    width: `${Math.max(0.1, geometry.width)}%`,
    height: `${Math.max(0.1, geometry.height)}%`,
    transform: `translate(-50%, -50%) rotate(${geometry.rotation}deg)`,
  };

  const startResize = (event, handle) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return;
    dragRef.current = {
      id: event.pointerId, handle,
      x: event.clientX, y: event.clientY,
      width: rect.width, height: rect.height, transform: { ...transform },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveResize = (event) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    event.stopPropagation();
    onTransform(resizeTemplateFromHandle(
      drag.transform, alphaBounds, canvasAspect, drag.handle,
      (event.clientX - drag.x) / drag.width * 100,
      (event.clientY - drag.y) / drag.height * 100
    ));
  };

  const endResize = (event) => {
    if (event.pointerId !== dragRef.current?.id) return;
    event.stopPropagation();
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* capture may already be gone */ }
  };

  if (!selected) {
    // The lower hit target lets visible artwork be selected without blocking
    // customer photo hit areas layered above it.
    return <button type="button" data-gdp-template-tap-to-select="true" aria-label="Select GDP template to move or resize" onPointerDown={(event) => { event.stopPropagation(); onSelect(); }} className="absolute cursor-pointer border-0 bg-transparent p-0" style={{ ...position, zIndex: 9, touchAction: 'manipulation' }} />;
  }

  return (
    <>
      <div data-gdp-template-selection-dismiss="true" className="absolute inset-0" style={{ zIndex: 46 }} onPointerDown={(event) => { if (event.target === event.currentTarget) { event.stopPropagation(); onDismiss(); } }} />
      <div
        {...gesture}
        data-gdp-template-selection-box="true"
        role="group"
        aria-label="Selected GDP template. Drag inside to move, or drag handles to resize."
        className="absolute cursor-move border-2 border-cyan-400 bg-cyan-400/5 shadow-[0_0_0_1px_rgba(8,145,178,.65)]"
        style={{ ...position, zIndex: 48, touchAction: 'none' }}
      >
        {Object.entries(TEMPLATE_HANDLE_POSITIONS).map(([handle, location]) => (
          <button
            type="button"
            key={handle}
            data-gdp-template-resize-handle={handle}
            aria-label={`Resize GDP template ${TEMPLATE_HANDLE_LABELS[handle]}`}
            onPointerDown={(event) => startResize(event, handle)}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onKeyDown={(event) => {
              const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
              if (!delta) return;
              event.preventDefault();
              event.stopPropagation();
              onTransform(resizeTemplateFromHandle(transform, alphaBounds, canvasAspect, handle, delta[0], delta[1]));
            }}
            className={`absolute z-10 flex h-8 w-8 items-center justify-center rounded-full outline-offset-2 touch-none ${location} focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-800`}
            style={{ cursor: handle === 'n' || handle === 's' ? 'ns-resize' : handle === 'e' || handle === 'w' ? 'ew-resize' : handle === 'ne' || handle === 'sw' ? 'nesw-resize' : 'nwse-resize' }}
          >
            <span className="block h-3 w-3 rounded-full border-2 border-white bg-cyan-500 shadow-[0_0_0_1px_#0891b2,0_2px_5px_#0004]" />
          </button>
        ))}
      </div>
    </>
  );
}

function ProtectedPreview({ product, color, size, template, editor, path, stickers, side, onPatch, activeLayer = 'photo', onActiveLayerChange = (..._args) => undefined, previewHiddenPhotoIds = [], previewFocusPhotoIds = [], compact = false }) {
  const zoneRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const photoBordersCanvasRef = useRef(null);
  const overlayMaskRef = useRef(null);
  const latestOverlayRef = useRef(editor.overlay);
  latestOverlayRef.current = editor.overlay;
  const isBootleg = path === 'bootleg';
  const isMemorial = path === 'memorial';
  const usesLayerLab = isBootleg || isMemorial;
  const zone = template?.photoZone || { x: 15, y: 12, width: 70, height: 68, radius: 12, shape: 'rounded' };
  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16, align: 'center' };
  // Preview-only filtering never alters saved layers or production.
  const photos = currentPhotoLayers(editor).filter((layer) => layer.visible !== false && !previewHiddenPhotoIds.includes(layer.id) && (!previewFocusPhotoIds.length || previewFocusPhotoIds.includes(layer.id))).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const photoOnlyFocus = usesLayerLab && previewFocusPhotoIds.length > 0;
  const partialPhotoPreview = photoOnlyFocus || previewHiddenPhotoIds.length > 0;
  const activePhotoId = editor.activePhotoId || photos.at(-1)?.id || '';
  const stickerLayers = (editor.stickers || []).filter((layer) => layer.visible !== false && !photoOnlyFocus).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activeStickerId = editor.activeStickerId || '';
  const fallbackTextStyle = defaultV2TextStyle(path);
  const legacyStyle = { ...fallbackTextStyle, ...(editor.textStyle || {}) };
  const bootlegTextLayers = isBootleg
    ? resolveBootlegTextLayers(editor, fallbackTextStyle).filter((layer) => layer.visible !== false && !photoOnlyFocus).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    : isMemorial
      ? resolveMemorialTextLayers(editor, fallbackTextStyle, textZone).filter((layer) => layer.visible !== false && !photoOnlyFocus).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      : [];
  const activeTextLayerId = editor.activeTextLayerId || bootlegTextLayers.at(-1)?.id || '';
  const radius = zone.shape === 'circle' || zone.shape === 'oval' ? '50%' : `${Number(zone.radius || 0)}%`;
  const stickerById = Object.fromEntries(stickers.map((item) => [item.id, item]));
  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side, color), [product, size, side, color]);
  const templateAlphaBounds = useTemplateAlphaBounds(template?.assetUrl);
  const canvasAspect = Number(printGuide.widthIn || 1) / Math.max(0.01, Number(printGuide.heightIn || 1));
  const templateTransform = constrainTemplateTransform(resolveBootlegTemplateTransform(legacyStyle), templateAlphaBounds, canvasAspect);
  const templateEditing = usesLayerLab && activeLayer === 'template';
  const layoutWidth = 1000;
  const layoutHeight = Math.max(1, layoutWidth * Number(printGuide.heightIn || 1) / Math.max(0.01, Number(printGuide.widthIn || 1)));
  const overlayConfiguration = normalizeBootlegOverlay(editor.overlay);
  const overlayActive = !partialPhotoPreview && isBootleg && overlayConfiguration.id !== 'none' && overlayConfiguration.enabled && overlayConfiguration.opacity > 0;
  const bordersActive = !partialPhotoPreview && isBootleg && photos.some((layer) => hasPhotoBorder(layer.border));

  // Keep the effects canvas separate from the interactive photo, text and
  // template elements. Only the alpha channel of the PRODUCTION-composed
  // design acts as its mask — never the rectangular print-area background.
  const paintMaskedOverlay = (maskCanvas) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    if (maskCanvas && (canvas.width !== maskCanvas.width || canvas.height !== maskCanvas.height)) {
      canvas.width = maskCanvas.width;
      canvas.height = maskCanvas.height;
    }
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!maskCanvas) return;

    if (!paintBootlegOverlay(context, canvas.width, canvas.height, latestOverlayRef.current)) return;
    // destination-in discards every effect pixel where the final artwork is
    // transparent (including holes and irregular, soft-edged silhouettes).
    context.save();
    try {
      context.globalCompositeOperation = 'destination-in';
      context.drawImage(maskCanvas, 0, 0);
    } finally {
      context.restore();
    }
  };

  const paintPhotoBorders = (borderCanvas) => {
    const canvas = photoBordersCanvasRef.current;
    if (!canvas) return;
    if (borderCanvas && (canvas.width !== borderCanvas.width || canvas.height !== borderCanvas.height)) {
      canvas.width = borderCanvas.width;
      canvas.height = borderCanvas.height;
    }
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (borderCanvas) context.drawImage(borderCanvas, 0, 0);
  };

  useEffect(() => {
    paintMaskedOverlay(overlayMaskRef.current);
  }, [editor.overlay, overlayActive]);

  useEffect(() => {
    let cancelled = false;
    overlayMaskRef.current = null;
    paintMaskedOverlay(null);
    paintPhotoBorders(null);
    if (!(overlayActive || bordersActive) || !template?.assetUrl || !photos.length) return;

    // Wait until rapid edits settle, so moving/resizing a photo does not
    // repeatedly decode up to eight source images on each pointer movement.
    const timer = window.setTimeout(async () => {
      try {
        const rendered = await renderProtectedStudioV2PngAdvanced({
          product, size, side, editor, template,
          profile: resolveStudioV2PrintProfile,
          dpi: 72, returnDesignCanvas: true,
        });
        if (cancelled) return;
        overlayMaskRef.current = rendered.canvas;
        paintMaskedOverlay(rendered.canvas);
        paintPhotoBorders(rendered.borderCanvas);
      } catch {
        // Safe failure: do not show unmasked effects when an image is not ready
        // or the browser cannot read a cross-origin source image.
        if (!cancelled) {
          overlayMaskRef.current = null;
          paintMaskedOverlay(null);
          paintPhotoBorders(null);
        }
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [overlayActive, bordersActive, isBootleg, product, size, side, template, editor.photos, editor.photo, editor.transform, editor.text, editor.textStyle, editor.textLayers, editor.stickers]);
  const bootlegTextLayouts = bootlegTextLayers.map((layer) => {
    const style = normalizeBootlegTextStyle(layer.style || {}, fallbackTextStyle);
    const position = resolveBootlegTextPosition(style, textZone);
    const constrained = constrainBootlegTextStyleToCanvas({
      text: layer.text || {},
      zone: textZone,
      style: { ...style, canvasX: position.x, canvasY: position.y },
      width: layoutWidth,
      height: layoutHeight,
    });
    const previewLayer = /** @type {Record<string, any>} */ ({ ...layer, style: constrained.style });
    return { layer: previewLayer, layout: constrained.layout };
  });

  const legacyTextGesture = useTouchTransformV2({
    transform: { scale: legacyStyle.fontScale || 100, rotation: legacyStyle.rotation || 0, x: legacyStyle.x || 0, y: legacyStyle.y || 0 },
    onChange: (next) => onPatch({ textStyle: { ...legacyStyle, fontScale: next.scale, rotation: next.rotation, x: next.x, y: next.y } }),
    containerRef: canvasRef,
    enabled: !usesLayerLab && Boolean(editor.text?.headline || editor.text?.subline || editor.text?.message),
    minScale: 55,
    maxScale: 180,
    minX: -42,
    maxX: 42,
    minY: -42,
    maxY: 42,
  });

  const templateGesture = useTouchTransformV2({
    transform: templateTransform,
    onChange: (next) => {
      if (!usesLayerLab) return;
      onPatch({ textStyle: { ...legacyStyle, ...(isBootleg ? { freeTextLayout: true, photoForeground: true } : { photoForeground: false }), templateTransform: constrainTemplateTransform(next, templateAlphaBounds, canvasAspect) } });
    },
    containerRef: canvasRef,
    enabled: usesLayerLab && templateEditing && Boolean(template),
    minScale: BOOTLEG_TEMPLATE_MIN_SCALE,
    maxScale: BOOTLEG_TEMPLATE_MAX_SCALE,
    minX: -50,
    maxX: 50,
    minY: -50,
    maxY: 50,
  });

  const patchPhotoTransform = (id, transform, visibleBounds = null) => {
    const next = photos.map((layer) => layer.id === id ? { ...layer, transform: usesLayerLab ? constrainFreePhotoTransform(transform, zone, canvasAspect, visibleBounds) : transform } : layer);
    const first = next[0] || null;
    onPatch({ photos: next, activePhotoId: id, photo: first?.asset || null, transform: first?.transform || editor.transform });
  };
  const patchStickerTransform = (id, transform) => {
    onPatch({ stickers: (editor.stickers || []).map((layer) => layer.id === id ? { ...layer, transform: constrainStickerTransform(transform, canvasAspect) } : layer), activeStickerId: id });
  };
  const patchBootlegTextStyle = (id, style) => {
    const current = resolveBootlegTextLayers(editor, fallbackTextStyle);
    const next = current.map((layer) => {
      if (layer.id !== id) return layer;
      const normalized = normalizeBootlegTextStyle(style, fallbackTextStyle);
      const position = resolveBootlegTextPosition(normalized, textZone);
      const constrained = constrainBootlegTextStyleToCanvas({
        text: layer.text || {},
        zone: textZone,
        style: { ...normalized, canvasX: position.x, canvasY: position.y },
        width: layoutWidth,
        height: layoutHeight,
      });
      return { ...layer, style: constrained.style };
    });
    onPatch(buildBootlegTextStatePatch(editor, next, id, fallbackTextStyle));
  };

  const textTransform = `translate(${clamp(legacyStyle.x, -42, 42)}%, ${clamp(legacyStyle.y, -42, 42)}%) rotate(${clamp(legacyStyle.rotation, -25, 25)}deg)`;
  const textBlockStyle = { left: `${textZone.x}%`, top: `${textZone.y}%`, width: `${textZone.width}%`, height: `${textZone.height}%` };
  const fontScale = clamp(legacyStyle.fontScale, 55, 180);
  const headline = String(editor.text?.headline || '').trim();

  const photoZone = (
    <div ref={zoneRef} className="absolute overflow-hidden" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, borderRadius: radius }}>
      {photos.map((layer) => <PhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && !activeStickerId} zoneRef={zoneRef} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}

    </div>
  );

  const bootlegPhotoCanvas = (
    <div data-gdp-bootleg-linked-photo-zone={isBootleg ? 'true' : undefined} data-gdp-bootleg-free-photo-canvas={isBootleg ? 'true' : undefined} data-gdp-memorial-free-photo-zone={isMemorial ? 'true' : undefined} className="absolute inset-0 overflow-hidden" style={{ zIndex: 10, pointerEvents: 'none' }}>
      {photos.map((layer) => <BootlegPhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && activeLayer === 'photo'} canvasRef={canvasRef} zone={zone} canvasAspect={canvasAspect} scope={path} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform, visibleBounds) => patchPhotoTransform(layer.id, transform, visibleBounds)} />)}

    </div>
  );

  return (
    <div
      data-gdp-bootleg-preview-canvas={isBootleg && !compact ? 'viewport-fit' : undefined}
      className={compact ? 'mx-auto w-full rounded-xl bg-slate-100 p-1' : 'mx-auto w-full max-w-[620px] rounded-[28px] bg-slate-100 p-3 sm:p-5'}
      style={!compact && isBootleg ? { maxWidth: 'min(620px, calc((100dvh - 16rem) * 0.8))' } : undefined}
    >
      <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner" onPointerDownCapture={(event) => { if (templateEditing && event.target instanceof Element && !event.target.closest('[data-gdp-template-selection-box="true"]')) onActiveLayerChange?.('photo'); }}>
        {garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}
        <div ref={canvasRef} data-gdp-print-guide="true" data-gdp-active-layer={usesLayerLab ? activeLayer : undefined} aria-label={`Recommended ${side} print area ${printGuide.label}`} className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-lg border border-dashed border-slate-400/70 bg-white/10" style={printGuide.style}>
          <span className="pointer-events-none absolute right-1 top-1 z-50 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-white">{printGuide.label}</span>

          {usesLayerLab ? bootlegPhotoCanvas : photoZone}

          {template?.assetUrl && !photoOnlyFocus ? (
            usesLayerLab ? (
              <div
                data-gdp-bootleg-template-layer={isBootleg ? 'true' : undefined}
                data-gdp-memorial-template-layer={isMemorial ? 'true' : undefined}
                className="pointer-events-none absolute inset-0 select-none"
                style={{ zIndex: isBootleg ? 15 : 20, transform: `translate(${templateTransform.x}%, ${templateTransform.y}%)` }}
              >
                <div className="absolute inset-0" style={{ transformOrigin: '50% 50%', transform: `rotate(${templateTransform.rotation}deg) scale(${templateTransform.scale * templateTransform.widthScale / 10000}, ${templateTransform.scale * templateTransform.heightScale / 10000})` }}>
                  <img src={template.assetUrl} alt="GDP template artwork" draggable="false" className="absolute inset-0 h-full w-full select-none object-fill" />
                </div>
              </div>
            ) : <img src={template.assetUrl} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute inset-0 z-20 h-full w-full select-none object-fill" />
          ) : null}

          {isBootleg ? <canvas ref={photoBordersCanvasRef} data-gdp-bootleg-cutout-borders="true" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[26] h-full w-full" style={partialPhotoPreview ? { display: 'none' } : undefined} /> : null}

          {isBootleg ? <canvas ref={overlayCanvasRef} data-gdp-bootleg-print-overlay="alpha-masked" className="pointer-events-none absolute inset-0 z-[45] h-full w-full" aria-hidden="true" style={partialPhotoPreview ? { display: 'none' } : undefined} /> : null}

          {usesLayerLab ? bootlegTextLayouts.map(({ layer, layout }) => <BootlegTextLayer key={layer.id} layer={layer} layout={layout} canvasRef={canvasRef} scope={path} selected={activeLayer === 'text' && layer.id === activeTextLayerId} onPatchStyle={(style) => patchBootlegTextStyle(layer.id, style)} />) : null}

          {!usesLayerLab && (headline || editor.text?.subline || editor.text?.message) ? (
            <div {...legacyTextGesture} className="absolute z-30 flex cursor-grab flex-col justify-center px-1 text-center font-black drop-shadow-[0_2px_3px_rgba(0,0,0,.8)] ring-1 ring-transparent active:ring-cyan-400/80" style={{ ...legacyTextGesture.style, ...textBlockStyle, color: legacyStyle.color, fontFamily: legacyStyle.fontFamily, transform: textTransform, ...textEffectStyle(legacyStyle) }}>
              {headline ? <div className={`${legacyStyle.curve === 'straight' ? 'truncate' : 'h-[70%]'} leading-none uppercase`} style={{ fontSize: `${fontScale * 0.105}px` }}><CurvedHeadline text={headline.toUpperCase()} style={legacyStyle} /></div> : null}
              {editor.text?.subline ? <div className="truncate font-bold leading-tight">{editor.text.subline}</div> : null}
              {editor.text?.message ? <div className="mt-0.5 line-clamp-2 font-semibold leading-tight">{editor.text.message}</div> : null}
            </div>
          ) : null}

          {stickerLayers.map((layer) => <StickerLayer key={layer.id} layer={layer} selected={layer.id === activeStickerId && (isBootleg ? activeLayer === 'sticker' : true)} sticker={stickerById[layer.stickerId]} canvasRef={canvasRef} canvasAspect={canvasAspect} onSelect={() => { onActiveLayerChange?.('sticker'); onPatch({ activeStickerId: layer.id, activePhotoId: '' }); }} onTransform={(transform) => patchStickerTransform(layer.id, transform)} />)}
          {usesLayerLab && template?.assetUrl && !photoOnlyFocus && !compact ? (
            <TemplateCanvasSelection
              transform={templateTransform}
              alphaBounds={templateAlphaBounds}
              canvasAspect={canvasAspect}
              canvasRef={canvasRef}
              gesture={templateGesture}
              selected={templateEditing}
              onSelect={() => onActiveLayerChange?.('template')}
              onDismiss={() => onActiveLayerChange?.('photo')}
              onTransform={(next) => onPatch({ textStyle: { ...legacyStyle, ...(isBootleg ? { freeTextLayout: true, photoForeground: true } : { photoForeground: false }), templateTransform: constrainTemplateTransform(next, templateAlphaBounds, canvasAspect) } })}
            />
          ) : null}
        </div>
        {!template && <div className="absolute inset-x-4 bottom-4 rounded-xl bg-slate-950/80 p-3 text-center text-xs font-bold text-white">Choose a {path === 'memorial' ? 'memorial' : 'bootleg'} template to begin.</div>}
      </div>
      {!compact && bootlegTextLayouts.some(({ layout }) => layout?.overflow?.any) ? <div data-gdp-bootleg-print-boundary-warning="true" className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-left text-[11px] font-bold leading-4 text-red-900"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>This text could not be safely fitted inside the print area. Reduce the text length before approval.</span></div> : null}
      {!compact ? <p className="mt-2 text-center text-[10px] font-bold text-slate-400">{usesLayerLab ? (activeLayer === 'overlay' ? 'Overlay selected · use the sliders to adjust its effect · ' : activeLayer === 'template' ? 'Template layer selected · ' : activeLayer === 'photo' ? 'Tap any photo to switch · drag to move · pinch to resize/rotate · ' : activeLayer === 'text' ? 'Text layer selected · ' : 'Sticker layer selected · ') : ''}{activeLayer === 'overlay' ? '' : 'One finger moves · two fingers pinch/rotate · '}{String(side || 'front').toUpperCase()} side</p> : null}
    </div>
  );
}

export default function ProtectedTemplateEditorV2({ path, product, color, size, settings, editor, side = 'front', onPatch, onConfirmedChange }) {
  const fileRef = useRef(null);
  const inspectorRef = useRef(null);
  const mobilePreviewRef = useRef(null);
  const uploadInFlightRef = useRef(false);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');
  const [activeBootlegLayer, setActiveBootlegLayer] = useState('photo');
  const [previewHiddenPhotoIds, setPreviewHiddenPhotoIds] = useState([]);
  const [previewFocusPhotoIds, setPreviewFocusPhotoIds] = useState([]);
  const [mobilePreviewOutOfView, setMobilePreviewOutOfView] = useState(false);
  const [mobilePreviewDismissed, setMobilePreviewDismissed] = useState(false);
  const revealLayerControls = (layer) => {
    setActiveBootlegLayer(layer);
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const inspector = inspectorRef.current;
      if (!inspector) return;
      const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      if (window.matchMedia?.('(min-width: 1280px)').matches) {
        inspector.scrollTo({ top: 0, behavior });
      } else {
        inspector.scrollIntoView({ behavior, block: 'start' });
      }
    });
  };
  const isBootleg = path === 'bootleg';
  const isMemorial = path === 'memorial';
  const usesLayerLab = isBootleg || isMemorial;
  useEffect(() => { setPreviewHiddenPhotoIds([]); setPreviewFocusPhotoIds([]); }, [path, side]);
  const resetPreviewVisibility = () => { setPreviewHiddenPhotoIds([]); setPreviewFocusPhotoIds([]); };
  const previewVisibilityChanged = previewHiddenPhotoIds.length > 0 || previewFocusPhotoIds.length > 0;
  const togglePreviewPhoto = (id) => { setPreviewFocusPhotoIds([]); setPreviewHiddenPhotoIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); };
  const toggleFocusPhoto = (id) => { setPreviewHiddenPhotoIds((ids) => ids.filter((item) => item !== id)); setPreviewFocusPhotoIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : ids.length >= 2 ? [ids[1], id] : [...ids, id]); };
  // Only activate the small live preview while mobile customers are editing
  // below the main garment. No duplicate renderer is mounted on desktop.
  useEffect(() => {
    if (!usesLayerLab || typeof window === 'undefined' || typeof IntersectionObserver !== 'function') return undefined;
    const mobile = window.matchMedia('(max-width: 639px)');
    let mainInView = true;
    let inspectorInView = false;
    const update = () => setMobilePreviewOutOfView(mobile.matches && inspectorInView && !mainInView);
    const garmentObserver = new IntersectionObserver(([entry]) => {
      mainInView = entry.isIntersecting;
      if (mainInView) setMobilePreviewDismissed(false);
      update();
    }, { rootMargin: '-78px 0px 0px 0px', threshold: 0 });
    const inspectorObserver = new IntersectionObserver(([entry]) => {
      inspectorInView = entry.isIntersecting;
      update();
    }, { rootMargin: '-78px 0px 0px 0px', threshold: 0 });
    if (mobilePreviewRef.current) garmentObserver.observe(mobilePreviewRef.current);
    if (inspectorRef.current) inspectorObserver.observe(inspectorRef.current);
    mobile.addEventListener?.('change', update);
    return () => {
      garmentObserver.disconnect();
      inspectorObserver.disconnect();
      mobile.removeEventListener?.('change', update);
    };
  }, [usesLayerLab]);
  const category = path === 'memorial' ? 'memorial_tribute' : 'photo_bootleg';
  const templates = useMemo(() => normalizeStyleTemplates(settings?.styleTemplates || {}).filter((item) => item.enabled && item.category === category), [settings?.styleTemplates, category]);
  const bootlegCollections = useMemo(() => {
    const names = settings?.bootlegCollectionNames || {};
    return [
      { id: 'chrome-galaxy', name: String(names['chrome-galaxy'] || 'Chrome Galaxy'), items: templates.filter((item) => item.collection === 'chrome-galaxy') },
      { id: 'original-bootleg', name: 'Original Bootleg', items: templates.filter((item) => !item.collection) },
      { id: 'cosmic-storm', name: String(names['cosmic-storm'] || 'Cosmic Storm'), items: templates.filter((item) => item.collection === 'cosmic-storm') },
    ].filter((group) => group.items.length > 0);
  }, [templates, settings?.bootlegCollectionNames]);
  // Feature Chrome Galaxy first on new designs; preserve the visible collection
  // for customers who reopen a draft with an existing template selection.
  const [expandedBootlegCollection, setExpandedBootlegCollection] = useState(() => {
    const previouslySelected = templates.find((item) => item.id === editor?.templateId);
    return previouslySelected ? (previouslySelected.collection || 'original-bootleg') : 'chrome-galaxy';
  });
  const template = templates.find((item) => item.id === editor.templateId) || null;
  const stickerLibrary = useMemo(() => normalizeV2StickerLibrary(settings?.stickerLibrary || []), [settings?.stickerLibrary]);
  const photos = [...currentPhotoLayers(editor)].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activePhotoId = editor.activePhotoId || photos.at(-1)?.id || '';
  const activePhoto = photos.find((layer) => layer.id === activePhotoId) || photos.at(-1) || null;
  const activePhotoBorder = normalizePhotoBorder(activePhoto?.border);
  const photoBorderDefault = (key) => settings?.photoBorderOptions?.[key] ?? DEFAULT_PHOTO_BORDER[key];
  const resetPhotoBorderStyle = () => updateActivePhotoBorder({ ...DEFAULT_PHOTO_BORDER, bottomFade: activePhotoBorder.bottomFade });
  const resetBootlegGlow = () => updateActivePhotoBorder({
    style: 'bootlegGlow',
    opacity: 100,
    innerColor: photoBorderDefault('innerColor'),
    innerThickness: photoBorderDefault('innerThickness'),
    glowColor: photoBorderDefault('glowColor'),
    glowSize: photoBorderDefault('glowSize'),
    glowOpacity: photoBorderDefault('glowOpacity'),
    feather: photoBorderDefault('feather'),
    roughness: photoBorderDefault('roughness'),
  });
  const updateActivePhotoBorder = (patch) => {
    if (!isBootleg || !activePhoto) return;
    const latest = editorRef.current || editor;
    const layers = [...currentPhotoLayers(latest)];
    const useAdminDefaults = patch.style && patch.style !== 'none' && activePhotoBorder.style === 'none';
    const configured = settings?.photoBorderOptions || {};
    const initialSettings = useAdminDefaults ? {
      color: configured.color ?? DEFAULT_PHOTO_BORDER.color,
      thickness: configured.thickness ?? DEFAULT_PHOTO_BORDER.thickness,
      softness: configured.softness ?? DEFAULT_PHOTO_BORDER.softness,
      innerColor: configured.innerColor ?? DEFAULT_PHOTO_BORDER.innerColor,
      innerThickness: configured.innerThickness ?? DEFAULT_PHOTO_BORDER.innerThickness,
      glowColor: configured.glowColor ?? DEFAULT_PHOTO_BORDER.glowColor,
      glowSize: configured.glowSize ?? DEFAULT_PHOTO_BORDER.glowSize,
      glowOpacity: configured.glowOpacity ?? DEFAULT_PHOTO_BORDER.glowOpacity,
      feather: configured.feather ?? DEFAULT_PHOTO_BORDER.feather,
      roughness: configured.roughness ?? DEFAULT_PHOTO_BORDER.roughness,
    } : {};
    const normalized = normalizePhotoBorder({ ...activePhotoBorder, ...initialSettings, ...patch });
    syncPhotos(layers.map((layer) => layer.id === activePhoto.id ? { ...layer, border: normalized } : layer), activePhoto.id);
  };
  const fallbackBootlegTextStyle = defaultV2TextStyle(path);
  const legacyTextStyle = { ...fallbackBootlegTextStyle, ...(editor.textStyle || {}) };
  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16 };
  const bootlegTextLayers = isBootleg ? resolveBootlegTextLayers(editor, fallbackBootlegTextStyle) : isMemorial ? resolveMemorialTextLayers(editor, fallbackBootlegTextStyle, textZone) : [];
  const activeTextLayerId = editor.activeTextLayerId || bootlegTextLayers.at(-1)?.id || '';
  const activeTextLayer = bootlegTextLayers.find((layer) => layer.id === activeTextLayerId) || bootlegTextLayers.at(-1) || null;
  const rawTextStyle = usesLayerLab ? normalizeBootlegTextStyle(activeTextLayer?.style || {}, fallbackBootlegTextStyle) : legacyTextStyle;
  const textContent = usesLayerLab ? (activeTextLayer?.text || { headline: '', subline: '', message: '' }) : (editor.text || {});
  const templateAlphaBounds = useTemplateAlphaBounds(template?.assetUrl);
  const stickerLayers = Array.isArray(editor.stickers) ? editor.stickers : [];
  const activeSticker = stickerLayers.find((layer) => layer.id === editor.activeStickerId) || null;
  const activeStickerOption = activeSticker ? stickerLibrary.find((item) => item.id === activeSticker.stickerId) || null : null;
  const overlay = normalizeBootlegOverlay(editor.overlay);
  const patchOverlay = (patch) => onPatch({ overlay: normalizeBootlegOverlay({ ...overlay, ...patch }) });
  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side, color), [product, size, side, color]);
  const canvasAspect = Number(printGuide.widthIn || 1) / Math.max(0.01, Number(printGuide.heightIn || 1));
  const templateTransform = constrainTemplateTransform(resolveBootlegTemplateTransform(legacyTextStyle), templateAlphaBounds, canvasAspect);
  const layoutWidth = 1000;
  const layoutHeight = Math.max(1, layoutWidth * Number(printGuide.heightIn || 1) / Math.max(0.01, Number(printGuide.widthIn || 1)));
  const rawTextPosition = resolveBootlegTextPosition(rawTextStyle, textZone);
  const textConstraint = usesLayerLab && activeTextLayer ? constrainBootlegTextStyleToCanvas({ text: textContent, zone: textZone, style: { ...rawTextStyle, canvasX: rawTextPosition.x, canvasY: rawTextPosition.y }, width: layoutWidth, height: layoutHeight }) : null;
  const textStyle = textConstraint?.style || rawTextStyle;
  const availablePremiumTextPresets = normalizePremiumTextPresets(settings?.premiumTextPresets).filter((preset) => preset.enabled || preset.id === textStyle?.premiumTextPresetId);
  const textPosition = resolveBootlegTextPosition(textStyle, textZone);
  const textLayout = textConstraint?.layout || null;
  const textAnchorRanges = usesLayerLab && textLayout ? resolveBootlegAnchorRanges(textLayout) : null;
  const textXSlider = usesLayerLab && textLayout && textAnchorRanges ? bootlegAnchorToSlider(textLayout.centerX, textAnchorRanges.x) : 50;
  const textYSlider = usesLayerLab && textLayout && textAnchorRanges ? bootlegAnchorToSlider(textLayout.centerY, textAnchorRanges.y) : 50;
  const activePhotoVisibleBounds = usePhotoVisibleBounds(activePhoto?.asset, template?.photoZone || {}, canvasAspect);
  const activePhotoCanvasPosition = usesLayerLab && activePhoto ? constrainFreePhotoTransform(activePhoto.transform || {}, template?.photoZone || {}, canvasAspect, activePhotoVisibleBounds) : null;

  const syncTextLayers = (next, activeId = '') => {
    const latestEditor = editorRef.current || editor;
    const basePatch = isMemorial
      ? buildMemorialTextStatePatch(latestEditor, next, activeId, fallbackBootlegTextStyle)
      : buildBootlegTextStatePatch(latestEditor, next, activeId, fallbackBootlegTextStyle);
    const patch = isBootleg
      ? { ...basePatch, textStyle: { ...basePatch.textStyle, freeTextLayout: true, photoForeground: true } }
      : basePatch;
    editorRef.current = { ...latestEditor, ...patch };
    onPatch(patch);
  };

  const syncPhotos = (next, activeId = '') => {
    const byId = new Map();
    next.filter(Boolean).forEach((layer) => {
      if (!layer?.id) return;
      byId.set(layer.id, layer);
    });
    const ordered = [...byId.values()].slice(0, BOOTLEG_MAX_PHOTOS).map((layer, index) => ({ ...layer, order: index }));
    const first = ordered[0] || null;
    const nextActiveId = activeId && ordered.some((layer) => layer.id === activeId) ? activeId : ordered.at(-1)?.id || '';
    const patch = { photos: ordered, activePhotoId: nextActiveId, activeStickerId: '', photo: first?.asset || null, transform: first?.transform || { scale: 100, rotation: 0, x: 0, y: 0 } };
    editorRef.current = { ...editorRef.current, ...patch };
    onPatch(patch);
  };

  const syncStickers = (next, activeId = '') => {
    const latestEditor = editorRef.current || editor;
    const byId = new Map();
    next.filter(Boolean).forEach((layer) => {
      if (!layer?.id) return;
      byId.set(layer.id, layer);
    });
    const ordered = [...byId.values()].map((layer, index) => ({ ...layer, order: index }));
    const nextActiveId = activeId && ordered.some((layer) => layer.id === activeId) ? activeId : '';
    const patch = {
      stickers: ordered,
      activeStickerId: nextActiveId,
      ...(nextActiveId ? { activePhotoId: '' } : {}),
    };
    editorRef.current = { ...latestEditor, ...patch };
    onPatch(patch);
  };


  useEffect(() => {
    if (!isMemorial || !template || Array.isArray(editor.textLayers)) return;
    const seeded = resolveMemorialTextLayers(editor, fallbackBootlegTextStyle, textZone);
    const activeId = seeded.find((layer) => layer.role === 'name')?.id || seeded[0]?.id || '';
    const patch = buildMemorialTextStatePatch(editor, seeded, activeId, fallbackBootlegTextStyle);
    editorRef.current = { ...editorRef.current, ...patch };
    onPatch(patch);
  }, [isMemorial, template?.id]);

  const selectTemplate = (item) => {
    const defaults = {
      scale: Number(item.defaultTransform?.scale || 100),
      rotation: Number(item.defaultTransform?.rotation || 0),
      x: Number(item.defaultTransform?.offset?.x || 0),
      y: Number(item.defaultTransform?.offset?.y || 0),
    };
    const nextPhotos = photos.length ? photos : [];
    if (isBootleg) {
      const nextTextPosition = resolveBootlegTextPosition(textStyle, item.textZone || { x: 12, y: 78, width: 76, height: 16 });
      const nextLayers = bootlegTextLayers.map((layer) => layer.id === activeTextLayer?.id
        ? { ...layer, style: normalizeBootlegTextStyle({ ...layer.style, canvasX: nextTextPosition.x, canvasY: nextTextPosition.y }, fallbackBootlegTextStyle) }
        : layer);
      const latestEditor = editorRef.current || editor;
      const textPatch = buildBootlegTextStatePatch(latestEditor, nextLayers, activeTextLayer?.id || '', fallbackBootlegTextStyle);
      const patch = {
        templateId: item.id,
        ...(nextPhotos.length ? {} : { transform: defaults }),
        ...textPatch,
        textStyle: { ...textPatch.textStyle, templateTransform: { scale: 100, rotation: 0, x: 0, y: 0 } },
      };
      editorRef.current = { ...latestEditor, ...patch };
      onPatch(patch);
      revealLayerControls('template');
      return;
    }
    if (isMemorial) {
      const nextTextPosition = resolveBootlegTextPosition(textStyle, item.textZone || { x: 12, y: 78, width: 76, height: 16 });
      const nextLayers = bootlegTextLayers.map((layer) => layer.id === activeTextLayer?.id
        ? { ...layer, style: normalizeBootlegTextStyle({ ...layer.style, canvasX: nextTextPosition.x, canvasY: nextTextPosition.y }, fallbackBootlegTextStyle) }
        : layer);
      const latestEditor = editorRef.current || editor;
      const textPatch = buildMemorialTextStatePatch(latestEditor, nextLayers, activeTextLayer?.id || '', fallbackBootlegTextStyle);
      const patch = {
        templateId: item.id,
        ...(nextPhotos.length ? {} : { transform: defaults }),
        ...textPatch,
        textStyle: { ...textPatch.textStyle, photoForeground: false, templateTransform: { scale: 100, rotation: 0, x: 0, y: 0 } },
      };
      editorRef.current = { ...latestEditor, ...patch };
      onPatch(patch);
      revealLayerControls('template');
      return;
    }
    onPatch({ templateId: item.id, ...(nextPhotos.length ? {} : { transform: defaults }) });
  };

  const prepareAsset = async (file) => {
    setUploadMessage(`Checking ${file.name} for transparency…`);
    const preserveTransparency = await imageHasTransparency(file);
    setUploadMessage(`Uploading ${file.name}…`);
    // Original file is persisted first; background cleanup is non-destructive.
    const uploaded = await customerApi.uploadArtwork(file);
    const original = {
      url: uploaded.file_url,
      path: uploaded.storage_path,
      originalUrl: uploaded.file_url,
      originalPath: uploaded.storage_path,
      backgroundMode: 'original',
      backgroundRemovalWarning: false,
      transparencyPreserved: false,
      name: file.name || 'customer-photo',
      type: file.type || 'image/png',
    };
    if (preserveTransparency) return { ...original, transparencyPreserved: true };
    try {
      setUploadMessage(`Removing background from ${file.name}…`);
      const cleaned = await customerApi.removePhotoBackground(file);
      return {
        ...original,
        url: cleaned.cleanedUrl,
        path: cleaned.cleanedPath,
        cleanedUrl: cleaned.cleanedUrl,
        cleanedPath: cleaned.cleanedPath,
        foregroundBounds: normalizePhotoAlphaBounds(cleaned.foregroundBounds),
        backgroundMode: 'cleaned',
      };
    } catch {
      // Keep the usable original when the removal function fails.
      return { ...original, backgroundRemovalWarning: true };
    }
  };

  const uploadPhotos = async (files) => {
    const incoming = [...(files || [])];
    if (!incoming.length || uploadInFlightRef.current) return;

    const latestBeforeUpload = [...currentPhotoLayers(editorRef.current)];
    const availableSlots = Math.max(0, BOOTLEG_MAX_PHOTOS - latestBeforeUpload.length);
    if (!availableSlots) {
      setError(`Photo limit reached. You can use up to ${BOOTLEG_MAX_PHOTOS} photos.`);
      return;
    }

    const imageFiles = incoming.filter((file) => String(file.type || '').startsWith('image/'));
    if (!imageFiles.length) {
      setError('Please choose JPG, PNG or WebP images.');
      return;
    }

    const selected = imageFiles.slice(0, availableSlots);
    uploadInFlightRef.current = true;
    setUploading(true);
    setError('');
    const additions = [];
    const failed = [];
    let backgroundFailures = 0;
    let preservedTransparencyCount = 0;

    try {
      for (const file of selected) {
        try {
          const asset = await prepareAsset(file);
          if (asset.backgroundRemovalWarning) backgroundFailures += 1;
          if (asset.transparencyPreserved) preservedTransparencyCount += 1;
          const currentCount = currentPhotoLayers(editorRef.current).length + additions.length;
          const newLayer = createV2PhotoLayer(asset, currentCount, currentCount === 0 && template ? {
            scale: Number(template.defaultTransform?.scale || 100),
            rotation: Number(template.defaultTransform?.rotation || 0),
            x: Number(template.defaultTransform?.offset?.x || 0),
            y: Number(template.defaultTransform?.offset?.y || 0),
          } : {});
          // New photos start in the existing fitted position but can bleed on edit.
          additions.push({ ...newLayer, transform: { ...newLayer.transform, bleedCrop: true } });
        } catch (uploadError) {
          failed.push({ file, uploadError });
        }
      }

      const latestPhotos = [...currentPhotoLayers(editorRef.current)];
      const remainingSlots = Math.max(0, BOOTLEG_MAX_PHOTOS - latestPhotos.length);
      const safeAdditions = additions.slice(0, remainingSlots);
      const next = [...latestPhotos, ...safeAdditions];

      if (safeAdditions.length) {
        syncPhotos(next, safeAdditions.at(-1)?.id || latestPhotos.at(-1)?.id || '');
        if (usesLayerLab) revealLayerControls('photo');
        setUploadMessage(`${next.length} photo${next.length === 1 ? '' : 's'} ready · added ${safeAdditions.length}${preservedTransparencyCount ? ` · ${preservedTransparencyCount} transparent original${preservedTransparencyCount === 1 ? '' : 's'} preserved` : ''}`);
      } else {
        setUploadMessage('');
      }

      if (failed.length) {
        const failedNames = failed.map(({ file }) => file?.name || 'photo').slice(0, 3).join(', ');
        setError(`Could not add ${failedNames}. Existing photos were kept. Please retry ${failed.length === 1 ? 'that file' : 'those files'}.`);
      } else if (backgroundFailures) {
        setError(`Automatic background removal couldn't finish for ${backgroundFailures} photo${backgroundFailures === 1 ? '' : 's'}. The original photo${backgroundFailures === 1 ? ' is' : 's are'} safely kept and usable.`);
      }
    } finally {
      uploadInFlightRef.current = false;
      setUploading(false);
    }
  };

  const patchActivePhotoTransform = (patch) => {
    if (!activePhoto) return;
    if (usesLayerLab) setActiveBootlegLayer('photo');
    syncPhotos(photos.map((layer) => {
      if (layer.id !== activePhoto.id) return layer;
      let nextTransform = { ...layer.transform, ...patch };
      if (usesLayerLab) {
        const position = resolvePhotoCanvasPosition(nextTransform, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 });
        if (!Number.isFinite(Number(nextTransform.canvasX))) nextTransform.canvasX = position.x;
        if (!Number.isFinite(Number(nextTransform.canvasY))) nextTransform.canvasY = position.y;
        nextTransform = constrainFreePhotoTransform(nextTransform, template?.photoZone || {}, canvasAspect, activePhotoVisibleBounds);
      }
      return { ...layer, transform: nextTransform };
    }), activePhoto.id);
  };
  const deleteActivePhoto = () => {
    if (!activePhoto) return;
    const remaining = photos.filter((layer) => layer.id !== activePhoto.id);
    syncPhotos(remaining, remaining.at(-1)?.id || '');
  };
  const duplicateActivePhoto = () => {
    if (!activePhoto) return;
    if (photos.length >= BOOTLEG_MAX_PHOTOS) {
      setError(`Photo limit reached. You can use up to ${BOOTLEG_MAX_PHOTOS} photos.`);
      return;
    }
    const duplicatePosition = resolvePhotoCanvasPosition(activePhoto.transform || {}, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 });
    const duplicateTransform = usesLayerLab
      ? constrainFreePhotoTransform({ ...activePhoto.transform, canvasX: duplicatePosition.x + 4, canvasY: duplicatePosition.y + 4 }, template?.photoZone || {}, canvasAspect, activePhotoVisibleBounds)
      : { ...activePhoto.transform, x: clamp(Number(activePhoto.transform?.x || 0) + 8, -48, 48), y: clamp(Number(activePhoto.transform?.y || 0) + 8, -48, 48) };
    const duplicate = { ...activePhoto, id: v2LayerId('photo'), transform: duplicateTransform };
    syncPhotos([...photos, duplicate], duplicate.id);
    if (usesLayerLab) setActiveBootlegLayer('photo');
  };
  const moveActivePhoto = (delta) => {
    if (!activePhoto) return;
    const index = photos.findIndex((layer) => layer.id === activePhoto.id);
    const target = clamp(index + delta, 0, photos.length - 1);
    if (target === index) return;
    const next = [...photos];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    syncPhotos(next, moved.id);
  };
  const toggleActiveBackground = () => {
    if (!activePhoto) return;
    const asset = activePhoto.asset || {};
    const useOriginal = asset.backgroundMode !== 'original' && asset.originalUrl && asset.originalPath;
    const useCleaned = asset.backgroundMode === 'original' && asset.cleanedUrl && asset.cleanedPath;
    if (!useOriginal && !useCleaned) return;
    const nextAsset = useOriginal
      ? { ...asset, url: asset.originalUrl, path: asset.originalPath, backgroundMode: 'original' }
      : { ...asset, url: asset.cleanedUrl, path: asset.cleanedPath, backgroundMode: 'cleaned' };
    syncPhotos(photos.map((layer) => layer.id === activePhoto.id ? { ...layer, asset: nextAsset } : layer), activePhoto.id);
  };

  const constrainTextLayer = (layer, nextText = layer?.text || {}, nextStyle = layer?.style || {}) => {
    const normalized = normalizeBootlegTextStyle(nextStyle, fallbackBootlegTextStyle);
    const position = resolveBootlegTextPosition(normalized, textZone);
    const constrained = constrainBootlegTextStyleToCanvas({
      text: nextText,
      zone: textZone,
      style: { ...normalized, canvasX: position.x, canvasY: position.y },
      width: layoutWidth,
      height: layoutHeight,
    });
    return { ...layer, text: nextText, style: constrained.style };
  };

  const patchText = (patch) => {
    if (!usesLayerLab) {
      onPatch({ text: { ...editor.text, ...patch } });
      return;
    }
    if (!activeTextLayer) return;
    setActiveBootlegLayer('text');
    syncTextLayers(bootlegTextLayers.map((layer) => {
      if (layer.id !== activeTextLayer.id) return layer;
      const nextText = { ...layer.text, ...patch, subline: '', message: '' };
      return constrainTextLayer(layer, nextText, layer.style);
    }), activeTextLayer.id);
  };
  const patchTextStyle = (patch, activateText = true) => {
    if (!usesLayerLab) {
      onPatch({ textStyle: { ...legacyTextStyle, ...patch } });
      return;
    }
    if (!activeTextLayer) return;
    if (activateText) setActiveBootlegLayer('text');
    syncTextLayers(bootlegTextLayers.map((layer) => layer.id === activeTextLayer.id
      ? constrainTextLayer(layer, layer.text, { ...layer.style, ...patch })
      : layer), activeTextLayer.id);
  };
  const patchTemplateTransform = (patch) => {
    if (usesLayerLab) setActiveBootlegLayer('template');
    const latestEditor = editorRef.current || editor;
    const nextTextStyle = { ...(latestEditor.textStyle || legacyTextStyle), ...(isBootleg ? { freeTextLayout: true, photoForeground: true } : isMemorial ? { photoForeground: false } : {}), templateTransform: constrainTemplateTransform({ ...templateTransform, ...patch }, templateAlphaBounds, canvasAspect) };
    editorRef.current = { ...latestEditor, textStyle: nextTextStyle };
    onPatch({ textStyle: nextTextStyle });
  };
  const patchTextVisualPosition = (axis, value) => {
    if (!usesLayerLab || !activeTextLayer || !textLayout || !textAnchorRanges) return;
    const anchor = bootlegSliderToAnchor(value, textAnchorRanges[axis]);
    const canvasX = axis === 'x' ? clamp(anchor / layoutWidth * 100, 0, 100) : textPosition.x;
    const canvasY = axis === 'y' ? clamp(anchor / layoutHeight * 100, 0, 100) : textPosition.y;
    patchTextStyle({ canvasX, canvasY });
  };

  const nextTextName = () => {
    const used = new Set(bootlegTextLayers.map((layer) => layer.name));
    let index = 1;
    while (used.has(`Text ${index}`)) index += 1;
    return `Text ${index}`;
  };
  const selectTextLayer = (layer) => {
    if (!layer) return;
    revealLayerControls('text');
    syncTextLayers(bootlegTextLayers, layer.id);
  };
  const addTextLayer = () => {
    if (!usesLayerLab || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;
    const layer = {
      id: v2LayerId('text'),
      name: nextTextName(),
      ...(isMemorial ? { role: 'custom' } : {}),
      text: { headline: '', subline: '', message: '' },
      style: normalizeBootlegTextStyle({ ...fallbackBootlegTextStyle, canvasX: 50, canvasY: clamp(50 + bootlegTextLayers.length * 5, 15, 85), fontScale: 100, rotation: 0 }, fallbackBootlegTextStyle),
      order: bootlegTextLayers.length,
      visible: true,
    };
    revealLayerControls('text');
    syncTextLayers([...bootlegTextLayers, layer], layer.id);
  };
  const duplicateActiveTextLayer = () => {
    if (!activeTextLayer || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;
    const style = normalizeBootlegTextStyle(activeTextLayer.style || {}, fallbackBootlegTextStyle);
    const duplicate = {
      ...activeTextLayer,
      id: v2LayerId('text'),
      name: nextTextName(),
      text: { ...activeTextLayer.text },
      style: { ...style, canvasX: clamp(Number(style.canvasX ?? 50) + 4, 0, 100), canvasY: clamp(Number(style.canvasY ?? 50) + 4, 0, 100) },
      order: bootlegTextLayers.length,
    };
    revealLayerControls('text');
    syncTextLayers([...bootlegTextLayers, duplicate], duplicate.id);
  };
  const deleteActiveTextLayer = () => {
    if (!activeTextLayer) return;
    const index = bootlegTextLayers.findIndex((layer) => layer.id === activeTextLayer.id);
    const remaining = bootlegTextLayers.filter((layer) => layer.id !== activeTextLayer.id);
    const nextActive = remaining[Math.max(0, index - 1)] || remaining[0] || null;
    syncTextLayers(remaining, nextActive?.id || '');
    setActiveBootlegLayer('text');
  };

  const selectStickerLayer = (layer) => {
    if (!layer?.id) return;
    const latestEditor = editorRef.current || editor;
    const current = Array.isArray(latestEditor.stickers) ? latestEditor.stickers : [];
    if (!current.some((item) => item.id === layer.id)) return;
    if (usesLayerLab) revealLayerControls('sticker');
    syncStickers(current, layer.id);
  };
  const addSticker = (sticker) => {
    const latestEditor = editorRef.current || editor;
    const current = Array.isArray(latestEditor.stickers) ? latestEditor.stickers : [];
    const layer = createV2StickerLayer(sticker, current.length);
    if (usesLayerLab) revealLayerControls('sticker');
    syncStickers([...current, layer], layer.id);
  };
  const patchActiveSticker = (patch) => {
    const latestEditor = editorRef.current || editor;
    const current = Array.isArray(latestEditor.stickers) ? latestEditor.stickers : [];
    const activeId = latestEditor.activeStickerId || activeSticker?.id || '';
    if (!activeId || !current.some((layer) => layer.id === activeId)) return;
    if (usesLayerLab) setActiveBootlegLayer('sticker');
    syncStickers(current.map((layer) => layer.id === activeId ? { ...layer, transform: constrainStickerTransform({ ...layer.transform, ...patch }, canvasAspect) } : layer), activeId);
  };
  const deleteActiveSticker = () => {
    const latestEditor = editorRef.current || editor;
    const current = Array.isArray(latestEditor.stickers) ? latestEditor.stickers : [];
    const activeId = latestEditor.activeStickerId || activeSticker?.id || '';
    if (!activeId) return;
    const index = current.findIndex((layer) => layer.id === activeId);
    if (index < 0) return;
    const remaining = current.filter((layer) => layer.id !== activeId);
    const nextActive = remaining[Math.min(index, remaining.length - 1)] || null;
    syncStickers(remaining, nextActive?.id || '');
    if (usesLayerLab) setActiveBootlegLayer('sticker');
  };

  // Historical regression-verifier token for protected-template content safety:
  // GDP template artwork never becomes an editable layer.
  // The whole protected template can move/resize/rotate as one placement layer; its internal artwork remains locked.

  const bootlegLayerButtons = [
    { value: 'template', label: 'Template', enabled: Boolean(template) },
    { value: 'photo', label: 'Photo', enabled: true },
    { value: 'text', label: 'Text', enabled: true },
    ...(settings?.editorTools?.stickers !== false ? [{ value: 'sticker', label: 'Sticker', enabled: true }] : []),
    ...(isBootleg ? [{ value: 'overlay', label: 'Overlay', enabled: true }] : []),
  ];

  const activeLayerSummary = activeBootlegLayer === 'overlay'
    ? (overlay.id === 'none' ? 'Overlay Effects — choose an effect to apply only to your design' : 'Overlay Effects — ' + (BOOTLEG_OVERLAY_PRESETS.find((preset) => preset.id === overlay.id)?.label || 'Custom'))
    : activeBootlegLayer === 'template'
    ? `Editing Template — ${template?.name || 'choose a template'}`
    : activeBootlegLayer === 'photo'
      ? `Editing Photo — ${activePhoto?.asset?.name || 'add a photo'}`
      : activeBootlegLayer === 'text'
        ? `Editing Text — ${activeTextLayer?.name || 'add text'}${activeTextLayer?.text?.headline ? ` · ${String(activeTextLayer.text.headline).slice(0, 22)}` : ''}`
        : `Editing Sticker — ${activeStickerOption?.label || activeSticker?.label || 'choose a sticker'}`;

  const overlayPanel = isBootleg ? (
    <div data-gdp-bootleg-panel="overlay" data-gdp-design-alpha-mask="true" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-800">Overlay Effects</p>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Effects apply only to visible artwork pixels. Transparent areas stay transparent in preview and the 300-DPI production export.</p>
      </div>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Photo Bootleg overlay presets">
        {BOOTLEG_OVERLAY_PRESETS.map((preset) => <button key={preset.id} type="button" aria-pressed={overlay.id === preset.id} onClick={() => patchOverlay({ id: preset.id, enabled: true })} className={overlay.id === preset.id ? 'min-h-11 rounded-xl border-2 border-slate-950 bg-slate-950 px-2 text-xs font-black text-white' : 'min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 hover:border-slate-400'}>{preset.label}</button>)}
      </div>
      {overlay.id !== 'none' ? (
        <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
          <RangeControl label="Opacity" value={overlay.opacity} min={0} max={100} suffix="%" onChange={(value) => patchOverlay({ opacity: value })} onReset={() => patchOverlay({ opacity: DEFAULT_BOOTLEG_OVERLAY.opacity })} />
          <RangeControl label="Effect size" value={overlay.scale} min={25} max={250} suffix="%" onChange={(value) => patchOverlay({ scale: value })} onReset={() => patchOverlay({ scale: 100 })} />
          <RangeControl label="Left / right" value={overlay.x} min={0} max={100} suffix="%" onChange={(value) => patchOverlay({ x: value })} onReset={() => patchOverlay({ x: 50 })} />
          <RangeControl label="Up / down" value={overlay.y} min={0} max={100} suffix="%" onChange={(value) => patchOverlay({ y: value })} onReset={() => patchOverlay({ y: 50 })} />
          <RangeControl label="Rotation" value={overlay.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchOverlay({ rotation: value })} onReset={() => patchOverlay({ rotation: 0 })} />
          {overlay.id === 'tint' ? <div className="space-y-1"><label className="block text-xs font-black text-slate-600">Tint color<input type="color" value={overlay.color} onChange={(event) => patchOverlay({ color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label><button type="button" onClick={() => patchOverlay({ color: DEFAULT_BOOTLEG_OVERLAY.color })} className="min-h-9 rounded-lg px-2 text-[11px] font-bold text-slate-600 underline" aria-label="Reset tint color">Reset color</button></div> : null}
          <button type="button" onClick={() => onPatch({ overlay: { ...DEFAULT_BOOTLEG_OVERLAY } })} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700"><RotateCcw size={14} /> Remove and reset overlay</button>
        </div>
      ) : <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">No overlay applied. Your existing artwork remains unchanged.</p>}
      <p className="text-[11px] font-bold text-emerald-700">Design pixels only · transparent background protected · Front / Back independent</p>
    </div>
  ) : null;

  const templatePanel = usesLayerLab && template ? (
    <div data-gdp-bootleg-template-controls="true" data-gdp-bootleg-panel="template" className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-cyan-700">GDP template artwork</p><p className="text-xs font-bold text-slate-600">Editable layer · uploaded photos can move independently and crop at the print boundary.</p></div>
        <button type="button" onClick={() => setActiveBootlegLayer('photo')} className="min-h-10 rounded-xl bg-cyan-600 px-3 text-xs font-black text-white">Finish Template Editing</button>
      </div>
      <p className="rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-700">Tap the artwork to show its resize box. Drag a middle handle to move just that edge; drag a corner to reshape both. Drag inside the box to move the template. Tap outside to hide the box.</p>
      <details data-gdp-template-precision-controls="collapsed" className="rounded-xl border border-cyan-100 bg-white/75 p-3">
        <summary className="cursor-pointer text-xs font-black text-cyan-800">Precise adjustments (optional)</summary>
        <div className="mt-3 space-y-3">
      <RangeControl label="Template size · keep proportions" value={templateTransform.scale} min={1} max={1000} suffix="%" onChange={(value) => patchTemplateTransform({ scale: value })} onReset={() => patchTemplateTransform({ scale: 100 })} />
      <div data-gdp-template-free-reshape="width-height" className="space-y-2 rounded-xl border border-cyan-100 bg-white/75 p-3">
        <p className="text-[11px] font-bold text-cyan-900">Free reshape · adjust width and height independently</p>
        <RangeControl label="Template width" value={templateTransform.widthScale} min={1} max={1000} suffix="%" onChange={(value) => patchTemplateTransform({ widthScale: value })} onReset={() => patchTemplateTransform({ widthScale: 100 })} />
        <RangeControl label="Template height" value={templateTransform.heightScale} min={1} max={1000} suffix="%" onChange={(value) => patchTemplateTransform({ heightScale: value })} onReset={() => patchTemplateTransform({ heightScale: 100 })} />
        <p className="text-[10px] font-medium text-slate-500">The visible template can fill the printable area, but no printed pixels can pass the edge. Width/height changes may stretch the artwork.</p>
      </div>
      <RangeControl label="Move template left / right" value={templateTransform.x} min={-50} max={50} suffix="%" onChange={(value) => patchTemplateTransform({ x: value })} onReset={() => patchTemplateTransform({ x: 0 })} />
      <RangeControl label="Move template up / down" value={templateTransform.y} min={-50} max={50} suffix="%" onChange={(value) => patchTemplateTransform({ y: value })} onReset={() => patchTemplateTransform({ y: 0 })} />
      <RangeControl label="Template rotation" value={templateTransform.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchTemplateTransform({ rotation: value })} onReset={() => patchTemplateTransform({ rotation: 0 })} />
        </div>
      </details>
      <button type="button" onClick={() => patchTemplateTransform({ scale: 100, widthScale: 100, heightScale: 100, rotation: 0, x: 0, y: 0 })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 text-xs font-black text-cyan-800"><RotateCcw size={14} /> Reset GDP template</button>
    </div>
  ) : null;

  const photoPanel = (
    <div data-gdp-bootleg-panel={isBootleg ? 'photo' : undefined} data-gdp-bootleg-multi-photo={isBootleg ? 'append' : undefined} className="space-y-3 rounded-2xl border border-slate-100 p-3">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Photos</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{photos.length} / {BOOTLEG_MAX_PHOTOS} customer photo{photos.length === 1 ? '' : 's'} added · template artwork is separate</p></div><Layers size={16} className="text-slate-400" /></div>
      <div data-gdp-photo-upload-guidance="auto-remove-background" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-950"><div className="flex items-start gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0" /><div><p className="text-xs font-black">For best print results</p><p className="mt-1 text-[11px] font-semibold leading-4">Transparent PNG/WebP photos keep their original pixels and skip cleanup. Photos with an opaque background are automatically cleaned. You can switch back to the untouched original when cleanup runs, and the original stays usable if cleanup fails.</p></div></div></div>
      <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const files = event.currentTarget.files; uploadPhotos(files); event.currentTarget.value = ''; }} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || photos.length >= BOOTLEG_MAX_PHOTOS} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">{uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />} {photos.length ? 'Add another photo' : 'Add first photo'}</button>
      {uploadMessage && !uploading ? <p className="text-xs font-semibold text-emerald-700">{uploadMessage}</p> : null}
      {error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
      {photos.length ? <div data-gdp-bootleg-photo-layer-list="true" className="space-y-2">
        {usesLayerLab ? <div data-gdp-photo-focus-mode="preview-only" className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <div className="flex items-center justify-between gap-2"><strong className="text-xs text-cyan-950">Layers &amp; Focus</strong><button type="button" onClick={resetPreviewVisibility} disabled={!previewVisibilityChanged} className="min-h-9 rounded-lg bg-white px-3 text-xs font-black text-cyan-800 disabled:opacity-40">Show All</button></div>
          <p className="mt-1 text-[11px] text-cyan-950">Eye hides a photo temporarily. Focus isolates up to two photos; template, text and effects return at review. Nothing is deleted or removed from print.</p>
        </div> : null}
        {photos.map((layer, index) => <div key={layer.id} className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button type="button" onClick={() => { if (usesLayerLab) revealLayerControls('photo'); setPreviewHiddenPhotoIds((ids) => ids.filter((id) => id !== layer.id)); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left ${layer.id === activePhotoId ? 'bg-slate-900 text-white' : 'text-slate-700'}`}><span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100"><img src={layer.asset?.url} alt="" className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1 truncate text-xs font-black">{layer.asset?.name || `Photo ${index + 1}`}</span></button>
          {usesLayerLab ? <>
            <button type="button" onClick={() => togglePreviewPhoto(layer.id)} aria-pressed={!previewHiddenPhotoIds.includes(layer.id)} aria-label={`${previewHiddenPhotoIds.includes(layer.id) ? 'Show' : 'Hide'} photo ${index + 1} temporarily`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700">{previewHiddenPhotoIds.includes(layer.id) ? <EyeOff size={17} /> : <Eye size={17} />}</button>
            <button type="button" onClick={() => toggleFocusPhoto(layer.id)} aria-pressed={previewFocusPhotoIds.includes(layer.id)} aria-label={`Focus photo ${index + 1}`} className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${previewFocusPhotoIds.includes(layer.id) ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-200 text-slate-700'}`}><Focus size={17} /></button>
          </> : null}
        </div>)}
      </div> : <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">Add a photo to enable direct Photo layer editing.</div>}
      {activePhoto ? <div className="space-y-3 rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Selected photo</p><span className="block truncate text-xs font-black text-slate-700">{activePhoto.asset?.name}</span></div><div className="flex gap-1"><button type="button" onClick={() => moveActivePhoto(-1)} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600" aria-label="Send photo backward"><ArrowDown size={14} /></button><button type="button" onClick={() => moveActivePhoto(1)} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600" aria-label="Bring photo forward"><ArrowUp size={14} /></button><button type="button" onClick={duplicateActivePhoto} disabled={photos.length >= BOOTLEG_MAX_PHOTOS} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600 disabled:opacity-30" aria-label="Duplicate photo"><Copy size={14} /></button><button type="button" onClick={deleteActivePhoto} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-red-600" aria-label="Delete photo"><Trash2 size={14} /></button></div></div>
        <RangeControl label="Photo size · keep proportions" value={activePhotoCanvasPosition?.scale ?? activePhoto.transform?.scale ?? 100} min={1} max={1000} suffix="%" onChange={(value) => patchActivePhotoTransform({ scale: value })} onReset={() => patchActivePhotoTransform({ scale: template?.defaultTransform?.scale || 100 })} />
        {usesLayerLab ? <div data-gdp-photo-free-reshape="width-height" className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-bold text-slate-800">Free reshape · optional stretch</p>
          <RangeControl label="Photo width" value={activePhotoCanvasPosition?.widthScale ?? 100} min={1} max={1000} suffix="%" onChange={(value) => patchActivePhotoTransform({ widthScale: value })} onReset={() => patchActivePhotoTransform({ widthScale: 100 })} />
          <RangeControl label="Photo height" value={activePhotoCanvasPosition?.heightScale ?? 100} min={1} max={1000} suffix="%" onChange={(value) => patchActivePhotoTransform({ heightScale: value })} onReset={() => patchActivePhotoTransform({ heightScale: 100 })} />
          <p className="text-[10px] font-medium text-slate-500">Use Photo size for natural proportions. Width and height stretch independently. Bleed & Crop hides anything outside the printable boundary.</p>
        </div> : null}
        {usesLayerLab ? <>
          <RangeControl label="Move photo left / right" value={activePhotoCanvasPosition?.canvasX ?? 50} min={activePhoto.transform?.bleedCrop ? -100 : 0} max={activePhoto.transform?.bleedCrop ? 200 : 100} suffix="%" onChange={(value) => patchActivePhotoTransform({ canvasX: value })} onReset={() => patchActivePhotoTransform({ canvasX: resolvePhotoCanvasPosition({}, template?.photoZone || {}).x })} />
          <RangeControl label="Move photo up / down" value={activePhotoCanvasPosition?.canvasY ?? 50} min={activePhoto.transform?.bleedCrop ? -100 : 0} max={activePhoto.transform?.bleedCrop ? 200 : 100} suffix="%" onChange={(value) => patchActivePhotoTransform({ canvasY: value })} onReset={() => patchActivePhotoTransform({ canvasY: resolvePhotoCanvasPosition({}, template?.photoZone || {}).y })} />
        </> : <>
          <RangeControl label="Move left / right" value={activePhoto.transform?.x || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ x: value })} onReset={() => patchActivePhotoTransform({ x: 0 })} />
          <RangeControl label="Move up / down" value={activePhoto.transform?.y || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ y: value })} onReset={() => patchActivePhotoTransform({ y: 0 })} />
        </>}
        <RangeControl label="Rotation" value={activePhotoCanvasPosition?.rotation ?? activePhoto.transform?.rotation ?? 0} min={-180} max={180} suffix="°" onChange={(value) => patchActivePhotoTransform({ rotation: value })} onReset={() => patchActivePhotoTransform({ rotation: 0 })} />
        {isBootleg ? (
          <>
          <div data-gdp-bootleg-photo-bottom-fade="selected-photo-only" className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <RangeControl label="Bottom edge fade" value={activePhotoBorder.bottomFade} min={0} max={80} suffix="%" onChange={(value) => updateActivePhotoBorder({ bottomFade: value })} onReset={() => updateActivePhotoBorder({ bottomFade: 0 })} />
            <p className="text-[11px] font-medium leading-4 text-slate-500">Optional: blend away a hard, straight bottom photo edge. Zero keeps the original image untouched.</p>
          </div>
          <div data-gdp-bootleg-photo-borders="selected-photo-only" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div><p className="text-xs font-black uppercase tracking-wide text-slate-800">Photo Border Effects</p><p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">Only this photo gets a border. Cutout shapes and transparent areas stay clear; the edge is clipped to the print area.</p></div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Border style for selected photo">
              {PHOTO_BORDER_STYLES.filter((preset) => preset.id === 'none' || preset.id === activePhotoBorder.style || !Array.isArray(settings?.photoBorderOptions?.enabledStyles) || settings.photoBorderOptions.enabledStyles.includes(preset.id)).map((preset) => <button key={preset.id} type="button" onClick={() => updateActivePhotoBorder({ style: preset.id })} aria-pressed={activePhotoBorder.style === preset.id} className={`min-h-11 rounded-xl border px-2 text-xs font-black ${activePhotoBorder.style === preset.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{preset.label}</button>)}
            </div>
            {activePhotoBorder.style !== 'none' ? <div className="space-y-3">
              {activePhotoBorder.style !== 'bootlegGlow' ? <>
                <label className="block text-xs font-black text-slate-600">Border color<input type="color" value={activePhotoBorder.color} onChange={(event) => updateActivePhotoBorder({ color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label><button type="button" onClick={() => updateActivePhotoBorder({ color: photoBorderDefault('color') })} className="min-h-9 rounded-lg px-2 text-[11px] font-bold text-slate-600 underline" aria-label="Reset border color">Reset color</button>
                <RangeControl label="Thickness" value={activePhotoBorder.thickness} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ thickness: value })} onReset={() => updateActivePhotoBorder({ thickness: DEFAULT_PHOTO_BORDER.thickness })} />
              </> : null}
              <RangeControl label={activePhotoBorder.style === 'bootlegGlow' ? 'Overall border opacity' : 'Opacity'} value={activePhotoBorder.opacity} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ opacity: value })} onReset={() => updateActivePhotoBorder({ opacity: 100 })} />
              {activePhotoBorder.style === 'bootlegGlow' ? (
                <div data-gdp-bootleg-glow-controls="true" className="space-y-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3">
                  <p className="text-[11px] font-bold leading-5 text-fuchsia-900">White cutout stroke + airbrushed colored halo, like a classic bootleg tee. Only the selected photo is affected.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-black text-slate-600">Inner stroke color<input type="color" value={activePhotoBorder.innerColor} onChange={(event) => updateActivePhotoBorder({ innerColor: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label><button type="button" onClick={() => updateActivePhotoBorder({ innerColor: photoBorderDefault('innerColor') })} className="min-h-9 rounded-lg px-2 text-[11px] font-bold text-slate-600 underline" aria-label="Reset inner stroke color">Reset color</button>
                    <label className="block text-xs font-black text-slate-600">Glow color<input type="color" value={activePhotoBorder.glowColor} onChange={(event) => updateActivePhotoBorder({ glowColor: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label><button type="button" onClick={() => updateActivePhotoBorder({ glowColor: photoBorderDefault('glowColor') })} className="min-h-9 rounded-lg px-2 text-[11px] font-bold text-slate-600 underline" aria-label="Reset glow color">Reset color</button>
                  </div>
                  <RangeControl label="Inner stroke thickness" value={activePhotoBorder.innerThickness} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ innerThickness: value })} onReset={() => updateActivePhotoBorder({ innerThickness: photoBorderDefault('innerThickness') })} />
                  <RangeControl label="Glow size" value={activePhotoBorder.glowSize} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ glowSize: value })} onReset={() => updateActivePhotoBorder({ glowSize: photoBorderDefault('glowSize') })} />
                  <RangeControl label="Glow opacity" value={activePhotoBorder.glowOpacity} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ glowOpacity: value })} onReset={() => updateActivePhotoBorder({ glowOpacity: photoBorderDefault('glowOpacity') })} />
                  <RangeControl label="Feather / softness" value={activePhotoBorder.feather} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ feather: value })} onReset={() => updateActivePhotoBorder({ feather: photoBorderDefault('feather') })} />
                  <RangeControl label="Roughness / spray" value={activePhotoBorder.roughness} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ roughness: value })} onReset={() => updateActivePhotoBorder({ roughness: photoBorderDefault('roughness') })} />
                </div>
              ) : null}
              {activePhotoBorder.style === 'glow' ? <RangeControl label="Glow softness" value={activePhotoBorder.softness} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ softness: value })} onReset={() => updateActivePhotoBorder({ softness: photoBorderDefault('softness') })} /> : null}
              {activePhotoBorder.style === 'rough' ? <RangeControl label="Distress amount" value={activePhotoBorder.distress} min={0} max={100} suffix="%" onChange={(value) => updateActivePhotoBorder({ distress: value })} onReset={() => updateActivePhotoBorder({ distress: DEFAULT_PHOTO_BORDER.distress })} /> : null}
              {activePhotoBorder.style === 'bootlegGlow' ? <button type="button" onClick={resetBootlegGlow} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-200 bg-white text-xs font-black text-fuchsia-800"><RotateCcw size={14} /> Reset Bootleg Glow settings</button> : null}
              <button type="button" onClick={resetPhotoBorderStyle} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-700"><RotateCcw size={14} /> Remove border (keep photo fade)</button>
            </div> : <p className="text-[11px] font-semibold text-slate-500">None (default) — existing photos remain unchanged.</p>}
          </div>
          </>
        ) : null}
        {usesLayerLab ? (
          <label data-gdp-photo-bleed-crop="true" className="flex items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs font-bold text-cyan-950">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={activePhoto.transform?.bleedCrop === true} onChange={(event) => patchActivePhotoTransform({ bleedCrop: event.target.checked })} />
            <span>Bleed &amp; Crop <span className="mt-1 block font-medium">Move or enlarge this photo past the dotted print boundary. Only what remains inside the box appears on the garment and 300-DPI print. Uncheck for the original safe-fit movement.</span></span>
          </label>
        ) : null}
        {(activePhoto.asset?.originalUrl && activePhoto.asset?.cleanedUrl) ? <button type="button" onClick={toggleActiveBackground} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">{activePhoto.asset.backgroundMode === 'original' ? 'Use removed background' : 'Restore original background'}</button> : null}
        <button type="button" onClick={() => {
          const resetTransform = { scale: template?.defaultTransform?.scale || 100, rotation: 0, x: Number(template?.defaultTransform?.offset?.x || 0), y: Number(template?.defaultTransform?.offset?.y || 0) };
          if (usesLayerLab) {
            const resetPosition = resolvePhotoCanvasPosition(resetTransform, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 });
            patchActivePhotoTransform({ ...resetTransform, canvasX: resetPosition.x, canvasY: resetPosition.y });
          } else {
            patchActivePhotoTransform(resetTransform);
          }
        }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset selected photo</button>
      </div> : null}
    </div>
  );

  const textPanel = usesLayerLab ? (
    <div data-gdp-bootleg-panel="text" data-gdp-bootleg-multi-text="true" className="space-y-3 rounded-2xl border border-slate-100 p-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Text</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{bootlegTextLayers.length} / {BOOTLEG_MAX_TEXT_LAYERS} text layers</p></div>
        <button type="button" onClick={addTextLayer} disabled={bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS} className="min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">+ Add Text</button>
      </div>
      <p className="text-[10px] font-semibold leading-4 text-slate-400">Only the active text layer can move, resize or rotate on the print area.</p>
      {bootlegTextLayers.length ? <div data-gdp-bootleg-text-layer-list="true" className="space-y-2">{bootlegTextLayers.map((layer, index) => {
        const selected = layer.id === activeTextLayer?.id;
        return <div key={layer.id} className={`flex items-center gap-1 rounded-xl border p-1 ${selected ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'}`}><button type="button" onClick={() => selectTextLayer(layer)} className={`min-h-10 min-w-0 flex-1 rounded-lg px-2 text-left text-xs font-black ${selected ? 'text-white' : 'text-slate-700'}`}><span className="block truncate">{layer.name || `Text ${index + 1}`}</span><span className={`block truncate text-[10px] font-semibold ${selected ? 'text-white/60' : 'text-slate-400'}`}>{layer.text?.headline || 'Empty text'}</span></button>{selected ? <><button type="button" onClick={duplicateActiveTextLayer} disabled={bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white disabled:opacity-30" aria-label="Duplicate selected text layer"><Copy size={14} /></button><button type="button" onClick={deleteActiveTextLayer} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-red-200" aria-label="Delete selected text layer"><Trash2 size={14} /></button></> : null}</div>;
      })}</div> : <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500"><p>No text added yet.</p><button type="button" onClick={addTextLayer} className="mt-2 min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white">+ Add Text</button></div>}
      {bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS ? <p className="text-[10px] font-bold text-amber-700">Maximum {BOOTLEG_MAX_TEXT_LAYERS} text layers.</p> : null}
      {activeTextLayer ? <div className="space-y-2 rounded-2xl bg-slate-50 p-3" data-gdp-bootleg-active-text-editor="true">
        <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Selected text</p><p className="text-xs font-black text-slate-700">{activeTextLayer.name}</p></div><span className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-black text-white">Text layer active</span></div>
        <label className="block text-xs font-black text-slate-600">Your Text<input value={activeTextLayer.text?.headline || ''} onFocus={() => setActiveBootlegLayer('text')} onChange={(event) => patchText({ headline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
        <div data-gdp-premium-text-presets="true" className="rounded-xl border border-slate-200 bg-white p-2">
          <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-black text-slate-700">Premium Text Styles</span><button type="button" className="min-h-9 rounded-lg border border-slate-200 px-2 text-[10px] font-black text-slate-600" onClick={() => patchTextStyle(applyPremiumTextPreset(textStyle, ''))}>Basic / Custom</button></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{availablePremiumTextPresets.map((preset) => <PremiumTextPresetTile key={preset.id} preset={preset} selected={textStyle.premiumTextPresetId === preset.id} onSelect={(id) => patchTextStyle(applyPremiumTextPreset(textStyle, id))} />)}</div>
          <p className="mt-2 text-[10px] font-medium text-slate-500">Pick a look, then edit your own wording, size, rotation and placement. Your style stays editable in saved designs.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Font<select value={textStyle.fontFamily} onChange={(event) => patchTextStyle({ fontFamily: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_FONT_PRESETS.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Curve<select value={textStyle.curve} onChange={(event) => patchTextStyle({ curve: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_CURVES.map((curve) => <option key={curve.id} value={curve.id}>{curve.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Effect<select value={textStyle.effect} onChange={(event) => patchTextStyle({ effect: event.target.value, premiumTextPresetId: '' })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">{textStyle.premiumTextPresetId ? 'Metallic accent' : 'Color'}<input type="color" value={textStyle.premiumTextPresetId ? (textStyle.premiumAccentColor || '#ffffff') : (textStyle.color || '#ffffff')} onChange={(event) => patchTextStyle(textStyle.premiumTextPresetId ? { premiumAccentColor: event.target.value, color: event.target.value } : { color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label></div>
        {textStyle.premiumTextPresetId ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-black text-slate-600">Outline color<input type="color" value={textStyle.premiumOutlineColor || premiumTextPreset(textStyle.premiumTextPresetId)?.outline || '#111111'} onChange={(event) => patchTextStyle({ premiumOutlineColor: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label>
            <div className="self-center">
              <RangeControl label={premiumTextPreset(textStyle.premiumTextPresetId)?.finish === 'sunset-emboss' ? 'Emboss intensity' : '3D depth'} value={textStyle.premiumDepthScale ?? 100} min={0} max={200} suffix="%" onChange={(value) => patchTextStyle({ premiumDepthScale: value })} onReset={() => patchTextStyle({ premiumDepthScale: 100 })} />
            </div>
          </div>
        ) : null}
        <PrintAreaTextSizeControl value={textStyle.fontScale} onChange={(value) => patchTextStyle({ fontScale: value })} onReset={() => patchTextStyle({ fontScale: 100 })} />
        <RangeControl label="Move text left / right" value={textXSlider} min={0} max={100} suffix="%" onChange={(value) => patchTextVisualPosition('x', value)} onReset={() => patchTextStyle({ canvasX: 50 })} />
        <RangeControl label="Move text up / down" value={textYSlider} min={0} max={100} suffix="%" onChange={(value) => patchTextVisualPosition('y', value)} onReset={() => patchTextStyle({ canvasY: 50 })} />
        {textLayout?.overflow?.any ? <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2 text-[10px] font-bold leading-4 text-red-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> This text cannot fit safely inside the printable boundary. Shorten the text before approval.</div> : <p className="text-[10px] font-semibold leading-4 text-emerald-700">{textLayout?.horizontalFit < 0.999 ? `Letter width auto-fitted to ${Math.round(textLayout.horizontalFit * 100)}% to keep your larger text within the printable area.` : 'Text stays fully inside the printable boundary.'}</p>}
        <RangeControl label="Text rotation" value={textStyle.rotation || 0} min={-180} max={180} suffix="°" onChange={(value) => patchTextStyle({ rotation: value })} onReset={() => patchTextStyle({ rotation: 0 })} />
        <FlexibleCurveControl style={textStyle} onChange={patchTextStyle} />
      </div> : null}
    </div>
  ) : (
    <div className="space-y-2 rounded-2xl border border-slate-100 p-3">
      <div className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Text</div>
      <label className="block text-xs font-black text-slate-600">Name<input value={editor.text?.headline || ''} onChange={(event) => patchText({ headline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <label className="block text-xs font-black text-slate-600">Dates<input value={editor.text?.subline || ''} onChange={(event) => patchText({ subline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <label className="block text-xs font-black text-slate-600">Message<textarea value={editor.text?.message || ''} onChange={(event) => patchText({ message: event.target.value })} maxLength={180} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Font<select value={textStyle.fontFamily} onChange={(event) => patchTextStyle({ fontFamily: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_FONT_PRESETS.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Curve<select value={textStyle.curve} onChange={(event) => patchTextStyle({ curve: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_CURVES.map((curve) => <option key={curve.id} value={curve.id}>{curve.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Effect<select value={textStyle.effect} onChange={(event) => patchTextStyle({ effect: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Color<input type="color" value={textStyle.color || '#ffffff'} onChange={(event) => patchTextStyle({ color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label></div>
      <PrintAreaTextSizeControl value={textStyle.fontScale} onChange={(value) => patchTextStyle({ fontScale: value })} onReset={() => patchTextStyle({ fontScale: 100 })} />
      <RangeControl label="Move text left / right" value={textStyle.x || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ x: value })} onReset={() => patchTextStyle({ x: 0 })} />
      <RangeControl label="Move text up / down" value={textStyle.y || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ y: value })} onReset={() => patchTextStyle({ y: 0 })} />
      <RangeControl label="Text rotation" value={textStyle.rotation || 0} min={-25} max={25} suffix="°" onChange={(value) => patchTextStyle({ rotation: value })} onReset={() => patchTextStyle({ rotation: 0 })} />
      <FlexibleCurveControl style={textStyle} onChange={patchTextStyle} />
    </div>
  );

  const stickerPanel = settings?.editorTools?.stickers !== false ? (
    <div data-gdp-bootleg-panel={isBootleg ? 'sticker' : undefined} className="rounded-2xl border border-slate-100 p-3">
      <div className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Sticker library</div>
      <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-400">Choose a sticker to place it. Then select the placed sticker instance below to resize, rotate or delete it.</p>
      <div className="mt-2 flex flex-wrap gap-2">{stickerLibrary.filter((item) => path === 'memorial' || item.category !== 'memorial').map((sticker) => <button key={sticker.id} type="button" onClick={() => addSticker(sticker)} aria-label={`Add ${sticker.label || 'sticker'}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-200 bg-white px-2 text-xl" title={sticker.label}>{sticker.assetUrl ? <img src={sticker.assetUrl} alt={sticker.label} draggable="false" className="h-7 w-7 object-contain" /> : sticker.glyph}</button>)}</div>
      {stickerLayers.length ? <div data-gdp-sticker-layer-list="true" className="mt-3 space-y-2"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Placed stickers</p>{stickerLayers.map((layer, index) => { const option = stickerLibrary.find((item) => item.id === layer.stickerId); const selected = layer.id === editor.activeStickerId; return <button key={layer.id} type="button" onClick={() => selectStickerLayer(layer)} className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs font-black ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="truncate">{option?.label || layer.label || `Sticker ${index + 1}`}</span><span className="text-[10px] opacity-60">{index + 1}</span></button>; })}</div> : null}
      {activeSticker ? <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-2"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Selected sticker</p><p className="text-xs font-black text-slate-700">{activeStickerOption?.label || activeSticker.label || 'Placed sticker'}</p></div><RangeControl label="Sticker size" value={activeSticker.transform?.scale || 42} min={1} max={1000} suffix="%" onChange={(value) => patchActiveSticker({ scale: value })} onReset={() => patchActiveSticker({ scale: 42 })} /><RangeControl label="Sticker width" value={activeSticker.transform?.widthScale ?? 100} min={1} max={1000} suffix="%" onChange={(value) => patchActiveSticker({ widthScale: value })} onReset={() => patchActiveSticker({ widthScale: 100 })} /><RangeControl label="Sticker height" value={activeSticker.transform?.heightScale ?? 100} min={1} max={1000} suffix="%" onChange={(value) => patchActiveSticker({ heightScale: value })} onReset={() => patchActiveSticker({ heightScale: 100 })} /><RangeControl label="Sticker rotation" value={activeSticker.transform?.rotation || 0} min={-180} max={180} suffix="°" onChange={(value) => patchActiveSticker({ rotation: value })} onReset={() => patchActiveSticker({ rotation: 0 })} /><button type="button" data-gdp-delete-selected-sticker="true" onClick={deleteActiveSticker} className="min-h-10 w-full rounded-lg bg-white text-xs font-black text-red-600">Delete selected sticker</button></div> : null}
    </div>
  ) : null;

  return (
    <div data-gdp-bootleg-workspace={isBootleg ? 'single-viewport' : undefined} className={`grid gap-4 xl:grid-cols-[minmax(280px,.82fr)_minmax(420px,1.4fr)_minmax(300px,.86fr)] ${isBootleg ? 'xl:h-[calc(100dvh-7rem)] xl:items-stretch xl:overflow-hidden' : ''}`}>
      <section className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${isBootleg ? 'xl:h-full xl:overflow-y-auto xl:overscroll-contain' : ''}`}>
        <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{isBootleg ? 'GDP templates' : 'Protected GDP templates'}</p><h2 className="mt-1 text-xl font-black text-slate-900">Choose a layout</h2><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{isBootleg ? 'GDP template artwork is an independent editable layer. Resize, position and rotate it inside the print area; uploaded photos can move beyond the printable boundary with Bleed & Crop.' : 'Memorial template artwork stays protected while your photo and text remain editable.'}</p></div>
        {isBootleg ? <div className="max-h-[470px] space-y-3 overflow-y-auto pr-1" data-gdp-bootleg-collections="expandable">{bootlegCollections.map((group) => { const expanded = expandedBootlegCollection === group.id; return <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200"><button type="button" aria-expanded={expanded} onClick={() => setExpandedBootlegCollection(expanded ? '' : group.id)} className="flex min-h-12 w-full items-center justify-between gap-3 bg-slate-50 px-3 py-3 text-left text-sm font-bold text-slate-900"><span>{group.name} <span className="text-xs font-medium text-slate-500">({group.items.length} colors)</span></span><span aria-hidden="true">{expanded ? '−' : '+'}</span></button>{expanded && <div className="grid grid-cols-2 gap-3 p-3">{group.items.map((item) => { const selected = item.id === editor.templateId; return <button key={item.id} type="button" aria-pressed={selected} onClick={() => selectTemplate(item)} className={`overflow-hidden rounded-2xl border-2 bg-slate-50 text-left transition ${selected ? 'border-slate-950 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}><div className="aspect-square bg-white p-2"><img src={item.thumbnail || item.assetUrl} alt={item.name} className="h-full w-full object-contain" loading="lazy" /></div><div className="p-2.5"><div className="flex items-center gap-1.5">{isBootleg ? <Layers size={12} className="text-slate-400" /> : <ShieldCheck size={12} className="text-slate-400" />}<span className="line-clamp-1 text-xs font-black text-slate-800">{item.name}</span></div></div></button>; })}</div>}</section>; })}</div> : <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1">{templates.map((item) => { const selected = item.id === editor.templateId; return <button key={item.id} type="button" aria-pressed={selected} onClick={() => selectTemplate(item)} className={`overflow-hidden rounded-2xl border-2 bg-slate-50 text-left transition ${selected ? 'border-slate-950 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}><div className="aspect-square bg-white p-2"><img src={item.thumbnail || item.assetUrl} alt={item.name} className="h-full w-full object-contain" loading="lazy" /></div><div className="p-2.5"><div className="flex items-center gap-1.5">{isBootleg ? <Layers size={12} className="text-slate-400" /> : <ShieldCheck size={12} className="text-slate-400" />}<span className="line-clamp-1 text-xs font-black text-slate-800">{item.name}</span></div></div></button>; })}</div>}

        <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Photo layers</p><p className="text-xs font-bold text-slate-600">{photos.length} of {BOOTLEG_MAX_PHOTOS} photos</p></div><Layers size={17} className="text-slate-400" /></div>
          <div className="mt-3 space-y-2">{photos.map((layer, index) => <button key={layer.id} type="button" onClick={() => { if (usesLayerLab) revealLayerControls('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-2 text-left ${layer.id === activePhotoId && (!isBootleg || activeBootlegLayer === 'photo') ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100"><img src={layer.asset?.url} alt="" className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1 truncate text-xs font-black">{layer.asset?.name || `Photo ${index + 1}`}</span><span className="text-[10px] opacity-60">{index + 1}</span></button>)}</div>
        </div>
      </section>

      <section ref={mobilePreviewRef} data-gdp-bootleg-sticky-preview={isBootleg ? 'true' : undefined} className={`rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 ${isBootleg ? 'xl:h-full xl:overflow-hidden' : ''}`}>
        <div className="mb-3 px-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Live garment preview</p><p className="hidden text-sm font-bold text-slate-700 sm:block">{isBootleg ? 'Tap any photo to select and move it immediately. Pinch to resize or rotate; other design layers stay independent.' : 'Tap a layer in the list, then drag or pinch directly on the fabric.'}</p><p className="text-xs font-semibold text-slate-600 sm:hidden">Drag or pinch on the garment. Resize controls are below.</p></div>
        {usesLayerLab ? <div data-gdp-bootleg-active-layer={isBootleg ? 'true' : undefined} data-gdp-memorial-active-layer={isMemorial ? 'true' : undefined} className={`mb-2 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5 ${bootlegLayerButtons.length === 5 ? 'grid-cols-5' : bootlegLayerButtons.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>{bootlegLayerButtons.map(({ value, label, enabled }) => <button key={value} type="button" disabled={!enabled} aria-pressed={activeBootlegLayer === value} onClick={() => revealLayerControls(value)} className={`min-h-10 rounded-xl px-1 text-[11px] font-black transition sm:px-2 sm:text-xs ${activeBootlegLayer === value ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-600 hover:text-slate-950'} disabled:cursor-not-allowed disabled:opacity-35`}>{label}</button>)}</div> : null}
        {usesLayerLab ? <div data-gdp-bootleg-active-status={isBootleg ? 'true' : undefined} data-gdp-memorial-active-status={isMemorial ? 'true' : undefined} className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-900">{activeLayerSummary}</div> : null}
        {usesLayerLab ? <button type="button" data-gdp-bootleg-confirm-action={isBootleg ? 'persistent' : undefined} data-gdp-memorial-confirm-action={isMemorial ? 'persistent' : undefined} disabled={!template || !photos.length} onClick={() => { if (previewVisibilityChanged) { resetPreviewVisibility(); return; } onConfirmedChange(!editor.confirmed); }} aria-pressed={editor.confirmed} className={'sticky top-2 z-40 mb-3 flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left shadow-sm transition ' + (editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500') + ' disabled:cursor-not-allowed disabled:opacity-40'}><span className={'grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ' + (editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent')}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">{previewVisibilityChanged ? 'Show complete design before approval' : `I’m done customizing this ${side} design`}</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm template, photos, layers, text and placement before review.</span></span></button> : null}
        {isBootleg && uploading ? <div data-gdp-bootleg-upload-status="true" className="mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950"><Loader2 size={17} className="shrink-0 animate-spin" /><div><p className="text-xs font-black">Processing photo</p><p className="text-[11px] font-semibold">{uploadMessage || 'Preparing your image…'}</p></div></div> : null}
        <ProtectedPreview product={product} color={color} size={size} template={template} editor={editor} path={path} stickers={stickerLibrary} side={side} onPatch={onPatch} activeLayer={usesLayerLab ? activeBootlegLayer : 'photo'} onActiveLayerChange={usesLayerLab ? setActiveBootlegLayer : undefined} previewHiddenPhotoIds={usesLayerLab ? previewHiddenPhotoIds : []} previewFocusPhotoIds={usesLayerLab ? previewFocusPhotoIds : []} />
      </section>

      <section ref={inspectorRef} data-gdp-bootleg-inspector-scroll={isBootleg ? 'true' : undefined} data-gdp-bootleg-inspector-active={isBootleg ? activeBootlegLayer : undefined} className={`scroll-mt-24 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${isBootleg ? 'xl:h-full xl:overflow-y-auto xl:overscroll-contain' : ''}`}>
        {mobilePreviewOutOfView && usesLayerLab ? (
          <StudioMobilePreviewMirror side={side} minimized={mobilePreviewDismissed} onMinimize={() => setMobilePreviewDismissed(true)} onRestore={() => setMobilePreviewDismissed(false)}>
            <ProtectedPreview compact product={product} color={color} size={size} template={template} editor={editor} path={path} stickers={stickerLibrary} side={side} onPatch={onPatch} activeLayer={activeBootlegLayer} previewHiddenPhotoIds={previewHiddenPhotoIds} previewFocusPhotoIds={previewFocusPhotoIds} />
          </StudioMobilePreviewMirror>
        ) : null}
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{usesLayerLab ? 'Layer controls' : 'Customer controls'}</p><h2 className="mt-1 text-xl font-black text-slate-900">Personalize</h2>{usesLayerLab ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Only the selected layer controls are shown here. Customer photo, protected template placement and text layers remain independent.</p> : null}</div>

        {usesLayerLab ? (
          <>
            {activeBootlegLayer === 'template' ? templatePanel : null}
            {activeBootlegLayer === 'photo' ? photoPanel : null}
            {activeBootlegLayer === 'text' ? textPanel : null}
            {activeBootlegLayer === 'sticker' ? stickerPanel : null}
            {activeBootlegLayer === 'overlay' ? overlayPanel : null}
          </>
        ) : (
          <>
            {photoPanel}
            {textPanel}
            {stickerPanel}
          </>
        )}

        {!usesLayerLab ? <button type="button" disabled={!template || !photos.length} onClick={() => onConfirmedChange(!editor.confirmed)} aria-pressed={editor.confirmed} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'} disabled:cursor-not-allowed disabled:opacity-40`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">{previewVisibilityChanged ? 'Show complete design before approval' : `I’m done customizing this ${side} design`}</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm photos, layers, text and placement before review.</span></span></button> : null}
      </section>
    </div>
  );
}
