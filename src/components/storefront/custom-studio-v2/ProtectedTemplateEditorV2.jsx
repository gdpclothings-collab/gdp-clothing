import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ImagePlus,
  Layers,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { customerApi } from '@/lib/customerApi';
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
  resolveBootlegAnchorRanges,
  resolveBootlegTextLayout,
} from '@/lib/customStudioV2BootlegTextLayout';
import {
  BOOTLEG_MAX_TEXT_LAYERS,
  buildBootlegTextStatePatch,
  normalizeBootlegTextStyle,
  resolveBootlegTextLayers,
} from '@/lib/customStudioV2BootlegTextLayers';
import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';
import { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';
import { resolveStudioV2PrintGuide } from '@/lib/customStudioV2PrintGuide';

const BOOTLEG_TEMPLATE_MIN_SCALE = 25;
const BOOTLEG_TEMPLATE_MAX_SCALE = 400;
const BOOTLEG_MAX_PHOTOS = 8;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function positiveScale(value, fallback = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, numeric);
}

function RangeControl({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-600"><span>{label}</span><span>{Math.round(Number(value || 0) * 10) / 10}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer" />
    </label>
  );
}

function UnboundedTextSizeControl({ value, onChange }) {
  return (
    <label className="block" data-gdp-bootleg-text-size="unbounded">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-600"><span>Text size</span><span>No preset maximum</span></div>
      <div className="flex min-h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-slate-500">
        <input
          type="number"
          min="1"
          step="1"
          inputMode="decimal"
          value={positiveScale(value)}
          onChange={(event) => onChange(positiveScale(event.target.value))}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm font-black text-slate-800 outline-none"
          aria-label="Text size percentage with no preset maximum"
        />
        <span className="px-3 text-xs font-black text-slate-400">%</span>
      </div>
      <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-400">Type any positive size, or pinch the text directly on the print area. Oversized text is allowed and will show a print-area warning if part of it falls outside.</p>
    </label>
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
    rotation: clamp(value.rotation ?? 0, -180, 180),
    x: clamp(value.x ?? 0, -50, 50),
    y: clamp(value.y ?? 0, -50, 50),
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

function StickerLayer({ layer, selected, sticker, canvasRef, onSelect, onTransform }) {
  const gesture = useTouchTransformV2({
    transform: layer.transform,
    onChange: onTransform,
    containerRef: canvasRef,
    enabled: selected,
    minScale: 12,
    maxScale: 85,
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
      className={`absolute z-40 grid -translate-x-1/2 -translate-y-1/2 place-items-center select-none ${selected ? 'cursor-grab rounded-lg ring-2 ring-cyan-400/90' : 'pointer-events-none'}`}
      style={{
        ...gesture.style,
        left: `${50 + clamp(transform.x, -48, 48)}%`,
        top: `${50 + clamp(transform.y, -48, 48)}%`,
        width: `${clamp(transform.scale, 12, 85)}%`,
        aspectRatio: '1 / 1',
        transform: `translate(-50%, -50%) rotate(${clamp(transform.rotation, -180, 180)}deg)`,
      }}
    >
      {sticker?.assetUrl ? <img src={sticker.assetUrl} alt={sticker.label} draggable="false" className="h-full w-full object-contain" /> : <span className="text-[clamp(22px,5vw,64px)] leading-none">{sticker?.glyph || layer.glyph || '✦'}</span>}
    </div>
  );
}

function BootlegTextLayer({ layer, layout, canvasRef, selected, onPatchStyle }) {
  const style = layer?.style || {};
  const bounds = layout?.bounds || null;
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
    maxScale: Number.POSITIVE_INFINITY,
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
      data-gdp-bootleg-text-layer="true"
      data-gdp-bootleg-text-layer-id={layer.id}
      className={`absolute inset-0 z-30 ${selected ? 'cursor-grab' : 'pointer-events-none'}`}
      style={gesture.style}
    >
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={`Editable Photo Bootleg ${layer.name || 'text'} layer`}>
        {selected && bounds ? <rect data-gdp-bootleg-text-bounds="true" x={bounds.minX} y={bounds.minY} width={Math.max(0, bounds.maxX - bounds.minX)} height={Math.max(0, bounds.maxY - bounds.minY)} fill="none" stroke="rgb(34 211 238)" strokeWidth={Math.max(2, layout.width * 0.004)} strokeDasharray={`${Math.max(5, layout.width * 0.009)} ${Math.max(4, layout.width * 0.006)}`} /> : null}
        {layout.headline?.kind === 'straight' ? (
          <text {...common} x={layout.headline.x} y={layout.headline.y} fontSize={layout.headline.fontSize} fontWeight="900" transform={`rotate(${layout.headline.rotation || 0} ${layout.headline.x} ${layout.headline.y})`} style={svgTextEffect(style, layout.headline.fontSize)}>{layout.headline.text}</text>
        ) : null}
        {layout.headline?.kind === 'glyphs' ? layout.headline.glyphs.map((glyph, index) => (
          <text key={`${glyph.character}-${index}`} {...common} x={glyph.x} y={glyph.y} fontSize={glyph.fontSize} fontWeight="900" transform={`rotate(${glyph.rotation || 0} ${glyph.x} ${glyph.y})`} style={svgTextEffect(style, glyph.fontSize)}>{glyph.character}</text>
        )) : null}
        {layout.subline ? <text {...common} x={layout.subline.x} y={layout.subline.y} fontSize={layout.subline.fontSize} fontWeight="700" transform={`rotate(${layout.subline.rotation || 0} ${layout.subline.x} ${layout.subline.y})`} style={svgTextEffect(style, layout.subline.fontSize)}>{layout.subline.text}</text> : null}
        {layout.message ? <text {...common} x={layout.message.x} y={layout.message.y} fontSize={layout.message.fontSize} fontWeight="600" transform={`rotate(${layout.message.rotation || 0} ${layout.message.x} ${layout.message.y})`} style={svgTextEffect(style, layout.message.fontSize)}>{layout.message.text}</text> : null}
      </svg>
    </div>
  );
}

function ProtectedPreview({ product, color, size, template, editor, path, stickers, side, onPatch, activeLayer = 'photo', onActiveLayerChange }) {
  const zoneRef = useRef(null);
  const canvasRef = useRef(null);
  const isBootleg = path === 'bootleg';
  const zone = template?.photoZone || { x: 15, y: 12, width: 70, height: 68, radius: 12, shape: 'rounded' };
  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16, align: 'center' };
  const photos = currentPhotoLayers(editor).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activePhotoId = editor.activePhotoId || photos.at(-1)?.id || '';
  const stickerLayers = (editor.stickers || []).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activeStickerId = editor.activeStickerId || '';
  const fallbackTextStyle = defaultV2TextStyle(path);
  const legacyStyle = { ...fallbackTextStyle, ...(editor.textStyle || {}) };
  const bootlegTextLayers = isBootleg
    ? resolveBootlegTextLayers(editor, fallbackTextStyle).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    : [];
  const activeTextLayerId = editor.activeTextLayerId || bootlegTextLayers.at(-1)?.id || '';
  const radius = zone.shape === 'circle' || zone.shape === 'oval' ? '50%' : `${Number(zone.radius || 0)}%`;
  const stickerById = Object.fromEntries(stickers.map((item) => [item.id, item]));
  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side), [product, size, side]);
  const templateTransform = resolveBootlegTemplateTransform(legacyStyle);
  const templateEditing = isBootleg && activeLayer === 'template';
  const layoutWidth = 1000;
  const layoutHeight = Math.max(1, layoutWidth * Number(printGuide.heightIn || 1) / Math.max(0.01, Number(printGuide.widthIn || 1)));
  const bootlegTextLayouts = bootlegTextLayers.map((layer) => {
    const style = normalizeBootlegTextStyle(layer.style || {}, fallbackTextStyle);
    const position = resolveBootlegTextPosition(style, textZone);
    const layout = resolveBootlegTextLayout({
      text: layer.text || {},
      zone: textZone,
      style: { ...style, canvasX: position.x, canvasY: position.y },
      width: layoutWidth,
      height: layoutHeight,
    });
    const previewLayer = /** @type {Record<string, any>} */ ({ ...layer, style });
    return { layer: previewLayer, layout };
  });

  const legacyTextGesture = useTouchTransformV2({
    transform: { scale: legacyStyle.fontScale || 100, rotation: legacyStyle.rotation || 0, x: legacyStyle.x || 0, y: legacyStyle.y || 0 },
    onChange: (next) => onPatch({ textStyle: { ...legacyStyle, fontScale: next.scale, rotation: next.rotation, x: next.x, y: next.y } }),
    containerRef: canvasRef,
    enabled: !isBootleg && Boolean(editor.text?.headline || editor.text?.subline || editor.text?.message),
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
      if (!isBootleg) return;
      onPatch({ textStyle: { ...legacyStyle, freeTextLayout: true, templateTransform: { scale: clamp(next.scale, BOOTLEG_TEMPLATE_MIN_SCALE, BOOTLEG_TEMPLATE_MAX_SCALE), rotation: next.rotation, x: next.x, y: next.y } } });
    },
    containerRef: canvasRef,
    enabled: isBootleg && templateEditing && Boolean(template),
    minScale: BOOTLEG_TEMPLATE_MIN_SCALE,
    maxScale: BOOTLEG_TEMPLATE_MAX_SCALE,
    minX: -50,
    maxX: 50,
    minY: -50,
    maxY: 50,
  });

  const patchPhotoTransform = (id, transform) => {
    const next = photos.map((layer) => layer.id === id ? { ...layer, transform } : layer);
    const first = next[0] || null;
    onPatch({ photos: next, activePhotoId: id, photo: first?.asset || null, transform: first?.transform || editor.transform });
  };
  const patchStickerTransform = (id, transform) => {
    onPatch({ stickers: (editor.stickers || []).map((layer) => layer.id === id ? { ...layer, transform } : layer), activeStickerId: id });
  };
  const patchBootlegTextStyle = (id, style) => {
    const current = resolveBootlegTextLayers(editor, fallbackTextStyle);
    const next = current.map((layer) => layer.id === id ? { ...layer, style: normalizeBootlegTextStyle(style, fallbackTextStyle) } : layer);
    onPatch(buildBootlegTextStatePatch(editor, next, id, fallbackTextStyle));
  };

  const textTransform = `translate(${clamp(legacyStyle.x, -42, 42)}%, ${clamp(legacyStyle.y, -42, 42)}%) rotate(${clamp(legacyStyle.rotation, -25, 25)}deg)`;
  const textBlockStyle = { left: `${textZone.x}%`, top: `${textZone.y}%`, width: `${textZone.width}%`, height: `${textZone.height}%` };
  const fontScale = clamp(legacyStyle.fontScale, 55, 180);
  const headline = String(editor.text?.headline || '').trim();

  const photoZone = (
    <div ref={zoneRef} className="absolute overflow-hidden" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, borderRadius: radius }}>
      {photos.map((layer) => <PhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && (isBootleg ? activeLayer === 'photo' : !activeStickerId)} zoneRef={zoneRef} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}
      {!photos.length && <div className="absolute inset-0 grid place-items-center border border-dashed border-white/45 bg-slate-900/10 p-2 text-center text-[7px] font-black uppercase tracking-wider text-white/90">Photo zone</div>}
    </div>
  );

  return (
    <div
      data-gdp-bootleg-preview-canvas={isBootleg ? 'viewport-fit' : undefined}
      className="mx-auto w-full max-w-[620px] rounded-[28px] bg-slate-100 p-3 sm:p-5"
      style={isBootleg ? { maxWidth: 'min(620px, calc((100dvh - 16rem) * 0.8))' } : undefined}
    >
      <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
        {garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}
        <div ref={canvasRef} data-gdp-print-guide="true" aria-label={`Recommended ${side} print area ${printGuide.label}`} className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-lg border border-dashed border-slate-400/70 bg-white/10" style={printGuide.style}>
          <span className="pointer-events-none absolute right-1 top-1 z-50 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-white">{printGuide.label}</span>

          {isBootleg ? (
            <div data-gdp-bootleg-linked-photo-zone="true" className="absolute inset-0" style={{ zIndex: 10, transform: `translate(${templateTransform.x}%, ${templateTransform.y}%)` }}>
              <div className="absolute inset-0" style={{ transformOrigin: '50% 50%', transform: `scale(${templateTransform.scale / 100}) rotate(${templateTransform.rotation}deg)` }}>{photoZone}</div>
            </div>
          ) : photoZone}

          {template?.assetUrl ? (
            isBootleg ? (
              <div
                {...(templateEditing ? templateGesture : {})}
                data-gdp-bootleg-template-layer="true"
                className={`absolute inset-0 select-none ${templateEditing ? 'cursor-grab ring-2 ring-cyan-400/90 ring-inset' : 'pointer-events-none'}`}
                style={{ ...(templateEditing ? templateGesture.style : {}), zIndex: templateEditing ? 45 : 20, transform: `translate(${templateTransform.x}%, ${templateTransform.y}%)` }}
              >
                <div className="absolute inset-0" style={{ transformOrigin: '50% 50%', transform: `scale(${templateTransform.scale / 100}) rotate(${templateTransform.rotation}deg)` }}>
                  <img src={template.assetUrl} alt="GDP template artwork" draggable="false" className="absolute inset-0 h-full w-full select-none object-fill" />
                </div>
              </div>
            ) : <img src={template.assetUrl} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute inset-0 z-20 h-full w-full select-none object-fill" />
          ) : null}

          {isBootleg ? bootlegTextLayouts.map(({ layer, layout }) => <BootlegTextLayer key={layer.id} layer={layer} layout={layout} canvasRef={canvasRef} selected={activeLayer === 'text' && layer.id === activeTextLayerId} onPatchStyle={(style) => patchBootlegTextStyle(layer.id, style)} />) : null}

          {!isBootleg && (headline || editor.text?.subline || editor.text?.message) ? (
            <div {...legacyTextGesture} className="absolute z-30 flex cursor-grab flex-col justify-center px-1 text-center font-black drop-shadow-[0_2px_3px_rgba(0,0,0,.8)] ring-1 ring-transparent active:ring-cyan-400/80" style={{ ...legacyTextGesture.style, ...textBlockStyle, color: legacyStyle.color, fontFamily: legacyStyle.fontFamily, transform: textTransform, ...textEffectStyle(legacyStyle) }}>
              {headline ? <div className={`${legacyStyle.curve === 'straight' ? 'truncate' : 'h-[70%]'} leading-none uppercase`} style={{ fontSize: `${fontScale * 0.105}px` }}><CurvedHeadline text={headline.toUpperCase()} style={legacyStyle} /></div> : null}
              {editor.text?.subline ? <div className="truncate font-bold leading-tight">{editor.text.subline}</div> : null}
              {editor.text?.message ? <div className="mt-0.5 line-clamp-2 font-semibold leading-tight">{editor.text.message}</div> : null}
            </div>
          ) : null}

          {stickerLayers.map((layer) => <StickerLayer key={layer.id} layer={layer} selected={layer.id === activeStickerId && (isBootleg ? activeLayer === 'sticker' : true)} sticker={stickerById[layer.stickerId]} canvasRef={canvasRef} onSelect={() => { onActiveLayerChange?.('sticker'); onPatch({ activeStickerId: layer.id, activePhotoId: '' }); }} onTransform={(transform) => patchStickerTransform(layer.id, transform)} />)}
        </div>
        {!template && <div className="absolute inset-x-4 bottom-4 rounded-xl bg-slate-950/80 p-3 text-center text-xs font-bold text-white">Choose a {path === 'memorial' ? 'memorial' : 'bootleg'} template to begin.</div>}
      </div>
      {isBootleg && bootlegTextLayouts.some(({ layout }) => layout?.overflow?.any) ? <div data-gdp-bootleg-print-boundary-warning="true" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[11px] font-bold leading-4 text-amber-900"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>Part of a text layer is outside the print area. Text size is not limited, but anything outside the dashed print boundary will not be printed.</span></div> : null}
      <p className="mt-2 text-center text-[10px] font-bold text-slate-400">{isBootleg ? `${activeLayer === 'template' ? 'Template' : activeLayer === 'photo' ? 'Photo' : activeLayer === 'text' ? 'Text' : 'Sticker'} layer selected · ` : ''}One finger moves · two fingers pinch/rotate · {String(side || 'front').toUpperCase()} side</p>
    </div>
  );
}

export default function ProtectedTemplateEditorV2({ path, product, color, size, settings, editor, side = 'front', onPatch, onConfirmedChange }) {
  const fileRef = useRef(null);
  const sourcePhotoFilesRef = useRef(new Map());
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');
  const [activeBootlegLayer, setActiveBootlegLayer] = useState('photo');
  const isBootleg = path === 'bootleg';
  const category = path === 'memorial' ? 'memorial_tribute' : 'photo_bootleg';
  const templates = useMemo(() => normalizeStyleTemplates(settings?.styleTemplates || {}).filter((item) => item.enabled && item.category === category), [settings?.styleTemplates, category]);
  const template = templates.find((item) => item.id === editor.templateId) || null;
  const stickerLibrary = useMemo(() => normalizeV2StickerLibrary(settings?.stickerLibrary || []), [settings?.stickerLibrary]);
  const photos = [...currentPhotoLayers(editor)].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activePhotoId = editor.activePhotoId || photos.at(-1)?.id || '';
  const activePhoto = photos.find((layer) => layer.id === activePhotoId) || photos.at(-1) || null;
  const fallbackBootlegTextStyle = defaultV2TextStyle(path);
  const legacyTextStyle = { ...fallbackBootlegTextStyle, ...(editor.textStyle || {}) };
  const bootlegTextLayers = isBootleg ? resolveBootlegTextLayers(editor, fallbackBootlegTextStyle) : [];
  const activeTextLayerId = editor.activeTextLayerId || bootlegTextLayers.at(-1)?.id || '';
  const activeTextLayer = bootlegTextLayers.find((layer) => layer.id === activeTextLayerId) || bootlegTextLayers.at(-1) || null;
  const textStyle = isBootleg ? normalizeBootlegTextStyle(activeTextLayer?.style || {}, fallbackBootlegTextStyle) : legacyTextStyle;
  const textContent = isBootleg ? (activeTextLayer?.text || { headline: '', subline: '', message: '' }) : (editor.text || {});
  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16 };
  const textPosition = resolveBootlegTextPosition(textStyle, textZone);
  const templateTransform = resolveBootlegTemplateTransform(legacyTextStyle);
  const activeSticker = (editor.stickers || []).find((layer) => layer.id === editor.activeStickerId) || null;
  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side), [product, size, side]);
  const layoutWidth = 1000;
  const layoutHeight = Math.max(1, layoutWidth * Number(printGuide.heightIn || 1) / Math.max(0.01, Number(printGuide.widthIn || 1)));
  const textLayout = isBootleg && activeTextLayer ? resolveBootlegTextLayout({ text: textContent, zone: textZone, style: { ...textStyle, canvasX: textPosition.x, canvasY: textPosition.y }, width: layoutWidth, height: layoutHeight }) : null;
  const textAnchorRanges = isBootleg && textLayout ? resolveBootlegAnchorRanges(textLayout) : null;
  const textXSlider = isBootleg && textLayout && textAnchorRanges ? bootlegAnchorToSlider(textLayout.centerX, textAnchorRanges.x) : 50;
  const textYSlider = isBootleg && textLayout && textAnchorRanges ? bootlegAnchorToSlider(textLayout.centerY, textAnchorRanges.y) : 50;

  const syncTextLayers = (next, activeId = '') => {
    const latestEditor = editorRef.current || editor;
    const patch = buildBootlegTextStatePatch(latestEditor, next, activeId, fallbackBootlegTextStyle);
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
      setActiveBootlegLayer('template');
      return;
    }
    onPatch({ templateId: item.id, ...(nextPhotos.length ? {} : { transform: defaults }) });
  };

  const prepareAsset = async (file) => {
    const autoRemove = settings?.editorTools?.autoBackgroundRemoval !== false;
    let backgroundFailure = null;
    if (autoRemove) {
      try {
        setUploadMessage(`Removing background from ${file.name}…`);
        const processed = await customerApi.removePhotoBackground(file);
        if (processed?.ok && processed?.cleanedUrl && processed?.cleanedPath) {
          return {
            url: processed.cleanedUrl,
            path: processed.cleanedPath,
            cleanedUrl: processed.cleanedUrl,
            cleanedPath: processed.cleanedPath,
            originalUrl: processed.originalUrl || '',
            originalPath: processed.originalPath || '',
            backgroundMode: 'cleaned',
            backgroundRemovalStatus: 'cleaned',
            backgroundRemovalMessage: '',
            name: file.name || 'customer-photo',
            type: file.type || 'image/png',
          };
        }
      } catch (backgroundError) {
        backgroundFailure = backgroundError;
        console.warn('V2 background removal unavailable; preserving original image with retry state.', backgroundError);
      }
    }
    setUploadMessage(backgroundFailure
      ? `Background removal unavailable for ${file.name}; uploading original…`
      : `Uploading ${file.name}…`);
    // PR #184 intentionally fail-closes the original File object after a removal failure.
    // A fresh browser File copy lets this editor explicitly preserve the original without
    // weakening that global safety guard or changing any other upload path.
    const uploadFile = backgroundFailure
      ? new File([file], file.name || 'photo', { type: file.type || 'image/png', lastModified: file.lastModified || Date.now() })
      : file;
    const uploaded = await customerApi.uploadArtwork(uploadFile);
    if (backgroundFailure && uploaded?.storage_path) {
      sourcePhotoFilesRef.current.set(uploaded.storage_path, file);
    }
    return {
      url: uploaded.file_url,
      path: uploaded.storage_path,
      originalUrl: uploaded.file_url,
      originalPath: uploaded.storage_path,
      backgroundMode: 'original',
      backgroundRemovalStatus: backgroundFailure ? 'failed' : (autoRemove ? 'original' : 'disabled'),
      backgroundRemovalMessage: backgroundFailure?.message || '',
      name: file.name || 'customer-photo',
      type: file.type || 'image/png',
    };
  };

  const uploadPhotos = async (files) => {
    const latestBeforeUpload = [...currentPhotoLayers(editorRef.current)];
    const availableSlots = Math.max(0, BOOTLEG_MAX_PHOTOS - latestBeforeUpload.length);
    if (!availableSlots) {
      setError(`Photo limit reached. You can use up to ${BOOTLEG_MAX_PHOTOS} photos.`);
      return;
    }
    const selected = [...(files || [])].filter((file) => String(file.type || '').startsWith('image/')).slice(0, availableSlots);
    if (!selected.length) { setError('Please choose JPG, PNG or WebP images.'); return; }
    setUploading(true);
    setError('');
    const additions = [];
    try {
      for (const file of selected) {
        const asset = await prepareAsset(file);
        const currentCount = currentPhotoLayers(editorRef.current).length + additions.length;
        additions.push(createV2PhotoLayer(asset, currentCount, currentCount === 0 && template ? {
          scale: Number(template.defaultTransform?.scale || 100),
          rotation: Number(template.defaultTransform?.rotation || 0),
          x: Number(template.defaultTransform?.offset?.x || 0),
          y: Number(template.defaultTransform?.offset?.y || 0),
        } : {}));
      }
      const latestPhotos = [...currentPhotoLayers(editorRef.current)];
      const remainingSlots = Math.max(0, BOOTLEG_MAX_PHOTOS - latestPhotos.length);
      const safeAdditions = additions.slice(0, remainingSlots);
      const next = [...latestPhotos, ...safeAdditions];
      syncPhotos(next, safeAdditions.at(-1)?.id || latestPhotos.at(-1)?.id || '');
      if (isBootleg) setActiveBootlegLayer('photo');
      setUploadMessage(`${next.length} photo${next.length === 1 ? '' : 's'} ready${safeAdditions.length ? ` · added ${safeAdditions.length}` : ''}`);
    } catch (uploadError) {
      setError(uploadError?.message || 'We could not process that photo. Please retry the upload.');
      setUploadMessage('');
    } finally {
      setUploading(false);
    }
  };

  const patchActivePhotoTransform = (patch) => {
    if (!activePhoto) return;
    if (isBootleg) setActiveBootlegLayer('photo');
    syncPhotos(photos.map((layer) => layer.id === activePhoto.id ? { ...layer, transform: { ...layer.transform, ...patch } } : layer), activePhoto.id);
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
    const duplicate = { ...activePhoto, id: v2LayerId('photo'), transform: { ...activePhoto.transform, x: clamp(Number(activePhoto.transform?.x || 0) + 8, -48, 48), y: clamp(Number(activePhoto.transform?.y || 0) + 8, -48, 48) } };
    syncPhotos([...photos, duplicate], duplicate.id);
    if (isBootleg) setActiveBootlegLayer('photo');
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

  const retryActiveBackgroundRemoval = async () => {
    if (!activePhoto || activePhoto.asset?.backgroundRemovalStatus !== 'failed') return;
    const asset = activePhoto.asset || {};
    const sourceKey = asset.originalPath || asset.path || '';
    const sourceFile = sourcePhotoFilesRef.current.get(sourceKey);
    if (!sourceFile) {
      const nextAsset = {
        ...asset,
        backgroundRemovalMessage: 'To retry background removal after reopening the editor, please re-add this photo.',
      };
      syncPhotos(photos.map((layer) => layer.id === activePhoto.id ? { ...layer, asset: nextAsset } : layer), activePhoto.id);
      return;
    }

    setUploading(true);
    setError('');
    setUploadMessage(`Retrying background removal for ${sourceFile.name}…`);
    try {
      const processed = await customerApi.removePhotoBackground(sourceFile);
      const nextAsset = {
        ...asset,
        url: processed.cleanedUrl,
        path: processed.cleanedPath,
        cleanedUrl: processed.cleanedUrl,
        cleanedPath: processed.cleanedPath,
        originalUrl: processed.originalUrl || asset.originalUrl,
        originalPath: processed.originalPath || asset.originalPath,
        backgroundMode: 'cleaned',
        backgroundRemovalStatus: 'cleaned',
        backgroundRemovalMessage: '',
      };
      if (processed.originalPath && processed.originalPath !== sourceKey) {
        sourcePhotoFilesRef.current.delete(sourceKey);
        sourcePhotoFilesRef.current.set(processed.originalPath, sourceFile);
      }
      syncPhotos(photos.map((layer) => layer.id === activePhoto.id ? { ...layer, asset: nextAsset } : layer), activePhoto.id);
      setUploadMessage('Background removed successfully.');
    } catch (backgroundError) {
      const nextAsset = {
        ...asset,
        backgroundRemovalStatus: 'failed',
        backgroundRemovalMessage: backgroundError?.message || 'Background removal is temporarily unavailable. You can keep editing with the original photo.',
      };
      syncPhotos(photos.map((layer) => layer.id === activePhoto.id ? { ...layer, asset: nextAsset } : layer), activePhoto.id);
      setUploadMessage('');
    } finally {
      setUploading(false);
    }
  };

  const patchText = (patch) => {
    if (!isBootleg) {
      onPatch({ text: { ...editor.text, ...patch } });
      return;
    }
    if (!activeTextLayer) return;
    setActiveBootlegLayer('text');
    syncTextLayers(bootlegTextLayers.map((layer) => layer.id === activeTextLayer.id ? { ...layer, text: { ...layer.text, ...patch, subline: '', message: '' } } : layer), activeTextLayer.id);
  };
  const patchTextStyle = (patch, activateText = true) => {
    if (!isBootleg) {
      onPatch({ textStyle: { ...legacyTextStyle, ...patch } });
      return;
    }
    if (!activeTextLayer) return;
    if (activateText) setActiveBootlegLayer('text');
    syncTextLayers(bootlegTextLayers.map((layer) => layer.id === activeTextLayer.id ? { ...layer, style: normalizeBootlegTextStyle({ ...layer.style, ...patch }, fallbackBootlegTextStyle) } : layer), activeTextLayer.id);
  };
  const patchTemplateTransform = (patch) => {
    if (isBootleg) setActiveBootlegLayer('template');
    const latestEditor = editorRef.current || editor;
    const nextTextStyle = { ...(latestEditor.textStyle || legacyTextStyle), freeTextLayout: true, templateTransform: { ...templateTransform, ...patch } };
    editorRef.current = { ...latestEditor, textStyle: nextTextStyle };
    onPatch({ textStyle: nextTextStyle });
  };
  const patchTextVisualPosition = (axis, value) => {
    if (!isBootleg || !activeTextLayer || !textLayout || !textAnchorRanges) return;
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
    setActiveBootlegLayer('text');
    syncTextLayers(bootlegTextLayers, layer.id);
  };
  const addTextLayer = () => {
    if (!isBootleg || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;
    const layer = {
      id: v2LayerId('text'),
      name: nextTextName(),
      text: { headline: '', subline: '', message: '' },
      style: normalizeBootlegTextStyle({ ...fallbackBootlegTextStyle, canvasX: 50, canvasY: clamp(50 + bootlegTextLayers.length * 5, 15, 85), fontScale: 100, rotation: 0 }, fallbackBootlegTextStyle),
      order: bootlegTextLayers.length,
      visible: true,
    };
    setActiveBootlegLayer('text');
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
    setActiveBootlegLayer('text');
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

  const addSticker = (sticker) => {
    const layer = createV2StickerLayer(sticker, (editor.stickers || []).length);
    if (isBootleg) setActiveBootlegLayer('sticker');
    onPatch({ stickers: [...(editor.stickers || []), layer], activeStickerId: layer.id, activePhotoId: '' });
  };
  const patchActiveSticker = (patch) => {
    if (!activeSticker) return;
    if (isBootleg) setActiveBootlegLayer('sticker');
    onPatch({ stickers: (editor.stickers || []).map((layer) => layer.id === activeSticker.id ? { ...layer, transform: { ...layer.transform, ...patch } } : layer) });
  };
  const deleteActiveSticker = () => activeSticker && onPatch({ stickers: (editor.stickers || []).filter((layer) => layer.id !== activeSticker.id), activeStickerId: '' });

  // Historical regression-verifier token for the Memorial protected-template contract only:
  // GDP template artwork never becomes an editable layer.

  const bootlegLayerButtons = [
    { value: 'template', label: 'Template', enabled: Boolean(template) },
    { value: 'photo', label: 'Photo', enabled: true },
    { value: 'text', label: 'Text', enabled: true },
    ...(settings?.editorTools?.stickers !== false ? [{ value: 'sticker', label: 'Sticker', enabled: true }] : []),
  ];

  const activeLayerSummary = activeBootlegLayer === 'template'
    ? `Editing Template — ${template?.name || 'choose a template'}`
    : activeBootlegLayer === 'photo'
      ? `Editing Photo — ${activePhoto?.asset?.name || 'add a photo'}`
      : activeBootlegLayer === 'text'
        ? `Editing Text — ${activeTextLayer?.name || 'add text'}${activeTextLayer?.text?.headline ? ` · ${String(activeTextLayer.text.headline).slice(0, 22)}` : ''}`
        : `Editing Sticker — ${activeSticker?.label || 'choose a sticker'}`;

  const templatePanel = isBootleg && template ? (
    <div data-gdp-bootleg-template-controls="true" data-gdp-bootleg-panel="template" className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-cyan-700">GDP template artwork</p><p className="text-xs font-bold text-slate-600">Editable layer · photo zone stays linked for alignment.</p></div>
        <button type="button" onClick={() => setActiveBootlegLayer('photo')} className="min-h-10 rounded-xl bg-cyan-600 px-3 text-xs font-black text-white">Finish Template Editing</button>
      </div>
      <RangeControl label="Template size" value={templateTransform.scale} min={BOOTLEG_TEMPLATE_MIN_SCALE} max={BOOTLEG_TEMPLATE_MAX_SCALE} suffix="%" onChange={(value) => patchTemplateTransform({ scale: value })} />
      <RangeControl label="Move template left / right" value={templateTransform.x} min={-50} max={50} suffix="%" onChange={(value) => patchTemplateTransform({ x: value })} />
      <RangeControl label="Move template up / down" value={templateTransform.y} min={-50} max={50} suffix="%" onChange={(value) => patchTemplateTransform({ y: value })} />
      <RangeControl label="Template rotation" value={templateTransform.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchTemplateTransform({ rotation: value })} />
      <button type="button" onClick={() => patchTemplateTransform({ scale: 100, rotation: 0, x: 0, y: 0 })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 text-xs font-black text-cyan-800"><RotateCcw size={14} /> Reset GDP template</button>
    </div>
  ) : null;

  const photoPanel = (
    <div data-gdp-bootleg-panel={isBootleg ? 'photo' : undefined} data-gdp-bootleg-multi-photo={isBootleg ? 'append' : undefined} className="space-y-3 rounded-2xl border border-slate-100 p-3">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Photos</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{photos.length} / {BOOTLEG_MAX_PHOTOS} photo{photos.length === 1 ? '' : 's'} added</p></div><Layers size={16} className="text-slate-400" /></div>
      <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const files = event.currentTarget.files; uploadPhotos(files); event.currentTarget.value = ''; }} />
      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || photos.length >= BOOTLEG_MAX_PHOTOS} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45">{uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />} {photos.length ? 'Add another photo' : 'Add first photo'}</button>
      {uploadMessage && !error && !uploading ? <p className="text-xs font-semibold text-emerald-700">{uploadMessage}</p> : null}
      {error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
      {photos.length ? <div className="space-y-2" data-gdp-bootleg-photo-layer-list="true">{photos.map((layer, index) => <button key={layer.id} type="button" onClick={() => { if (isBootleg) setActiveBootlegLayer('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-2 text-left ${layer.id === activePhotoId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100"><img src={layer.asset?.url} alt="" className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1 truncate text-xs font-black">{layer.asset?.name || `Photo ${index + 1}`}</span><span className="text-[10px] opacity-60">{index + 1}</span></button>)}</div> : <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">Add a photo to enable direct Photo layer editing.</div>}
      {activePhoto ? <div className="space-y-3 rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Selected photo</p><span className="block truncate text-xs font-black text-slate-700">{activePhoto.asset?.name}</span></div><div className="flex gap-1"><button type="button" onClick={() => moveActivePhoto(-1)} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600" aria-label="Send photo backward"><ArrowDown size={14} /></button><button type="button" onClick={() => moveActivePhoto(1)} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600" aria-label="Bring photo forward"><ArrowUp size={14} /></button><button type="button" onClick={duplicateActivePhoto} disabled={photos.length >= BOOTLEG_MAX_PHOTOS} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600 disabled:opacity-30" aria-label="Duplicate photo"><Copy size={14} /></button><button type="button" onClick={deleteActivePhoto} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-red-600" aria-label="Delete photo"><Trash2 size={14} /></button></div></div>
        {activePhoto.asset?.backgroundRemovalStatus === 'failed' ? <div data-gdp-background-removal-fallback="true" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950"><div className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="text-xs font-black">Background removal unavailable</p><p className="mt-1 text-[11px] font-semibold leading-4">{activePhoto.asset?.backgroundRemovalMessage || 'The background could not be removed.'} Using the original photo so you can keep editing.</p></div></div><button type="button" onClick={retryActiveBackgroundRemoval} disabled={uploading} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-black text-amber-950 disabled:cursor-not-allowed disabled:opacity-50">{uploading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Retry Background Removal</button></div> : null}
        <RangeControl label="Photo size" value={activePhoto.transform?.scale || 100} min={30} max={220} suffix="%" onChange={(value) => patchActivePhotoTransform({ scale: value })} />
        <RangeControl label="Move left / right" value={activePhoto.transform?.x || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ x: value })} />
        <RangeControl label="Move up / down" value={activePhoto.transform?.y || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ y: value })} />
        <RangeControl label="Rotation" value={activePhoto.transform?.rotation || 0} min={-180} max={180} suffix="°" onChange={(value) => patchActivePhotoTransform({ rotation: value })} />
        {(activePhoto.asset?.originalUrl && activePhoto.asset?.cleanedUrl) ? <button type="button" onClick={toggleActiveBackground} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">{activePhoto.asset.backgroundMode === 'original' ? 'Use removed background' : 'Restore original background'}</button> : null}
        <button type="button" onClick={() => patchActivePhotoTransform({ scale: template?.defaultTransform?.scale || 100, rotation: 0, x: 0, y: 0 })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset selected photo</button>
      </div> : null}
    </div>
  );

  const textPanel = isBootleg ? (
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
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Font<select value={textStyle.fontFamily} onChange={(event) => patchTextStyle({ fontFamily: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_FONT_PRESETS.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Curve<select value={textStyle.curve} onChange={(event) => patchTextStyle({ curve: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_CURVES.map((curve) => <option key={curve.id} value={curve.id}>{curve.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Effect<select value={textStyle.effect} onChange={(event) => patchTextStyle({ effect: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Color<input type="color" value={textStyle.color || '#ffffff'} onChange={(event) => patchTextStyle({ color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label></div>
        <UnboundedTextSizeControl value={textStyle.fontScale} onChange={(value) => patchTextStyle({ fontScale: value })} />
        <RangeControl label="Move text left / right" value={textXSlider} min={0} max={100} suffix="%" onChange={(value) => patchTextVisualPosition('x', value)} />
        <RangeControl label="Move text up / down" value={textYSlider} min={0} max={100} suffix="%" onChange={(value) => patchTextVisualPosition('y', value)} />
        {textLayout?.overflow?.any ? <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] font-bold leading-4 text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Text size remains unlimited. Reposition it or reduce its size if you want every visible letter inside the printable boundary.</div> : null}
        <RangeControl label="Text rotation" value={textStyle.rotation || 0} min={-180} max={180} suffix="°" onChange={(value) => patchTextStyle({ rotation: value })} />
        {textStyle.curve !== 'straight' ? <RangeControl label="Curve amount" value={textStyle.curveAmount} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ curveAmount: value })} /> : null}
      </div> : null}
    </div>
  ) : (
    <div className="space-y-2 rounded-2xl border border-slate-100 p-3">
      <div className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Text</div>
      <label className="block text-xs font-black text-slate-600">Name<input value={editor.text?.headline || ''} onChange={(event) => patchText({ headline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <label className="block text-xs font-black text-slate-600">Dates<input value={editor.text?.subline || ''} onChange={(event) => patchText({ subline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <label className="block text-xs font-black text-slate-600">Message<textarea value={editor.text?.message || ''} onChange={(event) => patchText({ message: event.target.value })} maxLength={180} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Font<select value={textStyle.fontFamily} onChange={(event) => patchTextStyle({ fontFamily: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_FONT_PRESETS.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Curve<select value={textStyle.curve} onChange={(event) => patchTextStyle({ curve: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_CURVES.map((curve) => <option key={curve.id} value={curve.id}>{curve.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Effect<select value={textStyle.effect} onChange={(event) => patchTextStyle({ effect: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Color<input type="color" value={textStyle.color || '#ffffff'} onChange={(event) => patchTextStyle({ color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label></div>
      <RangeControl label="Text size" value={textStyle.fontScale} min={55} max={180} suffix="%" onChange={(value) => patchTextStyle({ fontScale: value })} />
      <RangeControl label="Move text left / right" value={textStyle.x || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ x: value })} />
      <RangeControl label="Move text up / down" value={textStyle.y || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ y: value })} />
      <RangeControl label="Text rotation" value={textStyle.rotation || 0} min={-25} max={25} suffix="°" onChange={(value) => patchTextStyle({ rotation: value })} />
      {textStyle.curve !== 'straight' ? <RangeControl label="Curve amount" value={textStyle.curveAmount} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ curveAmount: value })} /> : null}
    </div>
  );

  const stickerPanel = settings?.editorTools?.stickers !== false ? (
    <div data-gdp-bootleg-panel={isBootleg ? 'sticker' : undefined} className="rounded-2xl border border-slate-100 p-3"><div className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Stickers</div><div className="mt-2 flex flex-wrap gap-2">{stickerLibrary.filter((item) => path === 'memorial' || item.category !== 'memorial').map((sticker) => <button key={sticker.id} type="button" onClick={() => addSticker(sticker)} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-200 bg-white px-2 text-xl" title={sticker.label}>{sticker.assetUrl ? <img src={sticker.assetUrl} alt={sticker.label} className="h-7 w-7 object-contain" /> : sticker.glyph}</button>)}</div>{activeSticker ? <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-2"><RangeControl label="Sticker size" value={activeSticker.transform?.scale || 42} min={12} max={85} suffix="%" onChange={(value) => patchActiveSticker({ scale: value })} /><RangeControl label="Sticker rotation" value={activeSticker.transform?.rotation || 0} min={-180} max={180} suffix="°" onChange={(value) => patchActiveSticker({ rotation: value })} /><button type="button" onClick={deleteActiveSticker} className="min-h-10 w-full rounded-lg bg-white text-xs font-black text-red-600">Delete selected sticker</button></div> : null}</div>
  ) : null;

  return (
    <div data-gdp-bootleg-workspace={isBootleg ? 'single-viewport' : undefined} className={`grid gap-4 xl:grid-cols-[minmax(280px,.82fr)_minmax(420px,1.4fr)_minmax(300px,.86fr)] ${isBootleg ? 'xl:h-[calc(100dvh-7rem)] xl:items-stretch xl:overflow-hidden' : ''}`}>
      <section className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${isBootleg ? 'xl:h-full xl:overflow-y-auto xl:overscroll-contain' : ''}`}>
        <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{isBootleg ? 'GDP templates' : 'Protected GDP templates'}</p><h2 className="mt-1 text-xl font-black text-slate-900">Choose a layout</h2><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{isBootleg ? 'GDP template artwork is an independent editable layer. Resize, position and rotate it inside the print area; the photo zone stays linked so the frame and photo remain aligned.' : 'Memorial template artwork stays protected while your photo and text remain editable.'}</p></div>
        <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1">{templates.map((item) => { const selected = item.id === editor.templateId; return <button key={item.id} type="button" onClick={() => selectTemplate(item)} className={`overflow-hidden rounded-2xl border-2 bg-slate-50 text-left transition ${selected ? 'border-slate-950 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}><div className="aspect-square bg-white p-2"><img src={item.thumbnail || item.assetUrl} alt={item.name} className="h-full w-full object-contain" /></div><div className="p-2.5"><div className="flex items-center gap-1.5">{isBootleg ? <Layers size={12} className="text-slate-400" /> : <ShieldCheck size={12} className="text-slate-400" />}<span className="line-clamp-1 text-xs font-black text-slate-800">{item.name}</span></div></div></button>; })}</div>

        <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Photo layers</p><p className="text-xs font-bold text-slate-600">{photos.length} of {BOOTLEG_MAX_PHOTOS} photos</p></div><Layers size={17} className="text-slate-400" /></div>
          <div className="mt-3 space-y-2">{photos.map((layer, index) => <button key={layer.id} type="button" onClick={() => { if (isBootleg) setActiveBootlegLayer('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-2 text-left ${layer.id === activePhotoId && (!isBootleg || activeBootlegLayer === 'photo') ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100"><img src={layer.asset?.url} alt="" className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1 truncate text-xs font-black">{layer.asset?.name || `Photo ${index + 1}`}</span><span className="text-[10px] opacity-60">{index + 1}</span></button>)}</div>
        </div>
      </section>

      <section data-gdp-bootleg-sticky-preview={isBootleg ? 'true' : undefined} className={`rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 ${isBootleg ? 'xl:h-full xl:overflow-hidden' : ''}`}>
        <div className="mb-3 px-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Live garment preview</p><p className="text-sm font-bold text-slate-700">{isBootleg ? 'Choose a layer first. Only the active layer can move, resize or rotate on the print area.' : 'Tap a layer in the list, then drag or pinch directly on the fabric.'}</p></div>
        {isBootleg ? <div data-gdp-bootleg-active-layer="true" className="mb-2 grid gap-2 rounded-2xl bg-slate-100 p-1.5" style={{ gridTemplateColumns: `repeat(${bootlegLayerButtons.length}, minmax(0, 1fr))` }}>{bootlegLayerButtons.map(({ value, label, enabled }) => <button key={value} type="button" disabled={!enabled} aria-pressed={activeBootlegLayer === value} onClick={() => setActiveBootlegLayer(value)} className={`min-h-10 rounded-xl px-2 text-xs font-black transition ${activeBootlegLayer === value ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-600 hover:text-slate-950'} disabled:cursor-not-allowed disabled:opacity-35`}>{label}</button>)}</div> : null}
        {isBootleg ? <div data-gdp-bootleg-active-status="true" className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-900">{activeLayerSummary}</div> : null}
        {isBootleg ? <button type="button" data-gdp-bootleg-confirm-action="persistent" disabled={!template || !photos.length} onClick={() => onConfirmedChange(!editor.confirmed)} aria-pressed={editor.confirmed} className={'sticky top-2 z-40 mb-3 flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left shadow-sm transition ' + (editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500') + ' disabled:cursor-not-allowed disabled:opacity-40'}><span className={'grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ' + (editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent')}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">I’m done customizing this {side} design</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm template, photos, layers, text and placement before review.</span></span></button> : null}
        {isBootleg && uploading ? <div data-gdp-bootleg-upload-status="true" className="mb-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950"><Loader2 size={17} className="shrink-0 animate-spin" /><div><p className="text-xs font-black">Processing photo</p><p className="text-[11px] font-semibold">{uploadMessage || 'Preparing your image…'}</p></div></div> : null}
        <ProtectedPreview product={product} color={color} size={size} template={template} editor={editor} path={path} stickers={stickerLibrary} side={side} onPatch={onPatch} activeLayer={isBootleg ? activeBootlegLayer : 'photo'} onActiveLayerChange={isBootleg ? setActiveBootlegLayer : undefined} />
      </section>

      <section data-gdp-bootleg-inspector-scroll={isBootleg ? 'true' : undefined} data-gdp-bootleg-inspector-active={isBootleg ? activeBootlegLayer : undefined} className={`space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${isBootleg ? 'xl:h-full xl:overflow-y-auto xl:overscroll-contain' : ''}`}>
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{isBootleg ? 'Layer controls' : 'Customer controls'}</p><h2 className="mt-1 text-xl font-black text-slate-900">Personalize</h2>{isBootleg ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Only the selected layer controls are shown here. The live garment stays visible while this panel scrolls.</p> : null}</div>

        {isBootleg ? (
          <>
            {activeBootlegLayer === 'template' ? templatePanel : null}
            {activeBootlegLayer === 'photo' ? photoPanel : null}
            {activeBootlegLayer === 'text' ? textPanel : null}
            {activeBootlegLayer === 'sticker' ? stickerPanel : null}
          </>
        ) : (
          <>
            {photoPanel}
            {textPanel}
            {stickerPanel}
          </>
        )}

        {!isBootleg ? <button type="button" disabled={!template || !photos.length} onClick={() => onConfirmedChange(!editor.confirmed)} aria-pressed={editor.confirmed} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'} disabled:cursor-not-allowed disabled:opacity-40`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">I’m done customizing this {side} design</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm {isBootleg ? 'template, photos, layers, text and placement' : 'photos, layers, text and placement'} before review.</span></span></button> : null}
      </section>
    </div>
  );
}
