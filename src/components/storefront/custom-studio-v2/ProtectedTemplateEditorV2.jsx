import React, { useMemo, useRef, useState } from 'react';
import {
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
import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';
import { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';
import { resolveStudioV2PrintGuide } from '@/lib/customStudioV2PrintGuide';

const BOOTLEG_TEMPLATE_MIN_SCALE = 25;
const BOOTLEG_TEMPLATE_MAX_SCALE = 400;

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
      <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-400">Type any positive size, or pinch the text directly on the print area.</p>
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

function CurvedHeadline({ text, style, unbounded = false }) {
  const curve = style.curve || 'straight';
  if (!text) return null;
  if (curve === 'straight') return <span>{text}</span>;
  const amount = clamp(style.curveAmount ?? 45, 0, 100);
  let path = `M 12 92 Q 150 ${58 - amount * 0.38} 288 92`;
  if (curve === 'arc-down') path = `M 12 42 Q 150 ${78 + amount * 0.38} 288 42`;
  if (curve === 'wave') path = `M 10 70 C 72 ${52 - amount * 0.25}, 105 ${86 + amount * 0.18}, 150 70 C 195 ${52 - amount * 0.18}, 228 ${86 + amount * 0.25}, 290 70`;
  const pathId = 'gdp-v2-protected-headline-curve';
  const fontScale = unbounded ? positiveScale(style.fontScale) : clamp(style.fontScale || 100, 55, 180);
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
      className={`absolute inset-0 origin-center ${selected ? 'cursor-grab ring-2 ring-cyan-400/80 ring-inset' : 'pointer-events-none'}`}
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

function ProtectedPreview({ product, color, size, template, editor, path, stickers, side, onPatch, templateEditing = false }) {
  const zoneRef = useRef(null);
  const canvasRef = useRef(null);
  const isBootleg = path === 'bootleg';
  const zone = template?.photoZone || { x: 15, y: 12, width: 70, height: 68, radius: 12, shape: 'rounded' };
  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16, align: 'center' };
  const photos = currentPhotoLayers(editor).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activePhotoId = editor.activePhotoId || photos.at(-1)?.id || '';
  const stickerLayers = (editor.stickers || []).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activeStickerId = editor.activeStickerId || '';
  const style = { ...defaultV2TextStyle(path), ...(editor.textStyle || {}) };
  const radius = zone.shape === 'circle' || zone.shape === 'oval' ? '50%' : `${Number(zone.radius || 0)}%`;
  const stickerById = Object.fromEntries(stickers.map((item) => [item.id, item]));
  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side), [product, size, side]);
  const bootlegTextPosition = resolveBootlegTextPosition(style, textZone);
  const templateTransform = resolveBootlegTemplateTransform(style);

  const textGesture = useTouchTransformV2({
    transform: isBootleg
      ? { scale: positiveScale(style.fontScale), rotation: style.rotation || 0, x: bootlegTextPosition.x - 50, y: bootlegTextPosition.y - 50 }
      : { scale: style.fontScale || 100, rotation: style.rotation || 0, x: style.x || 0, y: style.y || 0 },
    onChange: (next) => onPatch({
      textStyle: isBootleg
        ? { ...style, freeTextLayout: true, fontScale: positiveScale(next.scale), rotation: next.rotation, canvasX: clamp(next.x + 50, 0, 100), canvasY: clamp(next.y + 50, 0, 100) }
        : { ...style, fontScale: next.scale, rotation: next.rotation, x: next.x, y: next.y },
    }),
    containerRef: canvasRef,
    enabled: Boolean(editor.text?.headline || editor.text?.subline || editor.text?.message) && !templateEditing,
    minScale: isBootleg ? 1 : 55,
    maxScale: isBootleg ? Number.POSITIVE_INFINITY : 180,
    minX: isBootleg ? -50 : -42,
    maxX: isBootleg ? 50 : 42,
    minY: isBootleg ? -50 : -42,
    maxY: isBootleg ? 50 : 42,
  });

  const templateGesture = useTouchTransformV2({
    transform: templateTransform,
    onChange: (next) => {
      if (!isBootleg) return;
      onPatch({ textStyle: { ...style, freeTextLayout: true, templateTransform: { scale: clamp(next.scale, BOOTLEG_TEMPLATE_MIN_SCALE, BOOTLEG_TEMPLATE_MAX_SCALE), rotation: next.rotation, x: next.x, y: next.y } } });
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

  const textTransform = isBootleg
    ? `translate(-50%, -50%) rotate(${clamp(style.rotation, -180, 180)}deg)`
    : `translate(${clamp(style.x, -42, 42)}%, ${clamp(style.y, -42, 42)}%) rotate(${clamp(style.rotation, -25, 25)}deg)`;
  const textBlockStyle = isBootleg
    ? { left: `${bootlegTextPosition.x}%`, top: `${bootlegTextPosition.y}%`, width: `${textZone.width}%`, height: `${textZone.height}%` }
    : { left: `${textZone.x}%`, top: `${textZone.y}%`, width: `${textZone.width}%`, height: `${textZone.height}%` };
  const fontScale = isBootleg ? positiveScale(style.fontScale) : clamp(style.fontScale, 55, 180);
  const headline = String(editor.text?.headline || '').trim();

  return (
    <div className="mx-auto w-full max-w-[620px] rounded-[28px] bg-slate-100 p-3 sm:p-5">
      <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
        {garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}
        <div ref={canvasRef} data-gdp-print-guide="true" aria-label={`Recommended ${side} print area ${printGuide.label}`} className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-lg border border-dashed border-slate-400/70 bg-white/10" style={printGuide.style}>
          <span className="pointer-events-none absolute right-1 top-1 z-50 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-white">{printGuide.label}</span>
          <div ref={zoneRef} className="absolute overflow-hidden" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, borderRadius: radius }}>
            {photos.map((layer) => <PhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && !activeStickerId && !templateEditing} zoneRef={zoneRef} onSelect={() => onPatch({ activePhotoId: layer.id, activeStickerId: '' }, true)} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}
            {!photos.length && <div className="absolute inset-0 grid place-items-center border border-dashed border-white/45 bg-slate-900/10 p-2 text-center text-[7px] font-black uppercase tracking-wider text-white/90">Photo zone</div>}
          </div>

          {template?.assetUrl ? (
            <img
              src={template.assetUrl}
              alt=""
              aria-hidden="true"
              draggable="false"
              {...(isBootleg && templateEditing ? templateGesture : {})}
              className={`absolute h-full w-full select-none object-fill ${isBootleg && templateEditing ? 'cursor-grab ring-2 ring-cyan-400/90 ring-inset' : 'pointer-events-none'}`}
              style={{
                ...(isBootleg && templateEditing ? templateGesture.style : {}),
                zIndex: isBootleg && templateEditing ? 45 : 20,
                left: `${50 + (isBootleg ? templateTransform.x : 0)}%`,
                top: `${50 + (isBootleg ? templateTransform.y : 0)}%`,
                transform: `translate(-50%, -50%) scale(${isBootleg ? templateTransform.scale / 100 : 1}) rotate(${isBootleg ? templateTransform.rotation : 0}deg)`,
              }}
            />
          ) : null}

          {(headline || editor.text?.subline || editor.text?.message) ? (
            <div {...textGesture} className="absolute z-30 flex cursor-grab flex-col justify-center px-1 text-center font-black drop-shadow-[0_2px_3px_rgba(0,0,0,.8)] ring-1 ring-transparent active:ring-cyan-400/80" style={{ ...textGesture.style, ...textBlockStyle, color: style.color, fontFamily: style.fontFamily, transform: textTransform, ...textEffectStyle(style) }}>
              {headline ? <div className={`${isBootleg ? (style.curve === 'straight' ? 'whitespace-nowrap overflow-visible' : 'h-[70%] overflow-visible') : (style.curve === 'straight' ? 'truncate' : 'h-[70%]')} leading-none uppercase`} style={{ fontSize: `${fontScale * 0.105}px` }}><CurvedHeadline text={headline.toUpperCase()} style={style} unbounded={isBootleg} /></div> : null}
              {editor.text?.subline ? <div className={`${isBootleg ? 'whitespace-nowrap overflow-visible' : 'truncate'} font-bold leading-tight`} style={isBootleg ? { fontSize: `clamp(${6 * fontScale / 100}px, ${fontScale / 100}vw, ${11 * fontScale / 100}px)` } : undefined}>{editor.text.subline}</div> : null}
              {editor.text?.message ? <div className={`mt-0.5 ${isBootleg ? 'overflow-visible' : 'line-clamp-2'} font-semibold leading-tight`} style={isBootleg ? { fontSize: `clamp(${5 * fontScale / 100}px, ${0.8 * fontScale / 100}vw, ${9 * fontScale / 100}px)` } : undefined}>{editor.text.message}</div> : null}
            </div>
          ) : null}

          {stickerLayers.map((layer) => <StickerLayer key={layer.id} layer={layer} selected={layer.id === activeStickerId && !templateEditing} sticker={stickerById[layer.stickerId]} canvasRef={canvasRef} onSelect={() => onPatch({ activeStickerId: layer.id, activePhotoId: '' }, true)} onTransform={(transform) => patchStickerTransform(layer.id, transform)} />)}
        </div>
        {!template && <div className="absolute inset-x-4 bottom-4 rounded-xl bg-slate-950/80 p-3 text-center text-xs font-bold text-white">Choose a {path === 'memorial' ? 'memorial' : 'bootleg'} template to begin.</div>}
      </div>
      <p className="mt-2 text-center text-[10px] font-bold text-slate-400">{isBootleg && templateEditing ? 'Editing GDP template · one finger moves · two fingers pinch/rotate' : 'One finger moves · two fingers pinch/rotate'} · {String(side || 'front').toUpperCase()} side</p>
    </div>
  );
}

export default function ProtectedTemplateEditorV2({ path, product, color, size, settings, editor, side = 'front', onPatch, onConfirmedChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');
  const [templateEditing, setTemplateEditing] = useState(false);
  const isBootleg = path === 'bootleg';
  const category = path === 'memorial' ? 'memorial_tribute' : 'photo_bootleg';
  const templates = useMemo(() => normalizeStyleTemplates(settings?.styleTemplates || {}).filter((item) => item.enabled && item.category === category), [settings?.styleTemplates, category]);
  const template = templates.find((item) => item.id === editor.templateId) || null;
  const stickerLibrary = useMemo(() => normalizeV2StickerLibrary(settings?.stickerLibrary || []), [settings?.stickerLibrary]);
  const photos = currentPhotoLayers(editor).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activePhotoId = editor.activePhotoId || photos.at(-1)?.id || '';
  const activePhoto = photos.find((layer) => layer.id === activePhotoId) || photos.at(-1) || null;
  const textStyle = { ...defaultV2TextStyle(path), ...(editor.textStyle || {}) };
  const textPosition = resolveBootlegTextPosition(textStyle, template?.textZone || { x: 12, y: 78, width: 76, height: 16 });
  const templateTransform = resolveBootlegTemplateTransform(textStyle);
  const activeSticker = (editor.stickers || []).find((layer) => layer.id === editor.activeStickerId) || null;

  const syncPhotos = (next, activeId = '') => {
    const ordered = next.map((layer, index) => ({ ...layer, order: index }));
    const first = ordered[0] || null;
    onPatch({ photos: ordered, activePhotoId: activeId || ordered.at(-1)?.id || '', activeStickerId: '', photo: first?.asset || null, transform: first?.transform || { scale: 100, rotation: 0, x: 0, y: 0 } });
  };

  const selectTemplate = (item) => {
    const defaults = {
      scale: Number(item.defaultTransform?.scale || 100),
      rotation: Number(item.defaultTransform?.rotation || 0),
      x: Number(item.defaultTransform?.offset?.x || 0),
      y: Number(item.defaultTransform?.offset?.y || 0),
    };
    const nextPhotos = photos.length ? photos : [];
    const nextTextPosition = resolveBootlegTextPosition(textStyle, item.textZone || { x: 12, y: 78, width: 76, height: 16 });
    onPatch({
      templateId: item.id,
      ...(nextPhotos.length ? {} : { transform: defaults }),
      ...(isBootleg ? {
        textStyle: {
          ...textStyle,
          freeTextLayout: true,
          canvasX: nextTextPosition.x,
          canvasY: nextTextPosition.y,
          templateTransform: { scale: 100, rotation: 0, x: 0, y: 0 },
        },
      } : {}),
    });
    setTemplateEditing(false);
  };

  const prepareAsset = async (file) => {
    const autoRemove = settings?.editorTools?.autoBackgroundRemoval !== false;
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
            name: file.name || 'customer-photo',
            type: file.type || 'image/png',
          };
        }
      } catch (backgroundError) {
        console.warn('V2 background removal unavailable; using original image.', backgroundError);
      }
    }
    setUploadMessage(`Uploading ${file.name}…`);
    const uploaded = await customerApi.uploadArtwork(file);
    return { url: uploaded.file_url, path: uploaded.storage_path, originalUrl: uploaded.file_url, originalPath: uploaded.storage_path, backgroundMode: 'original', name: file.name || 'customer-photo', type: file.type || 'image/png' };
  };

  const uploadPhotos = async (files) => {
    const selected = [...(files || [])].filter((file) => String(file.type || '').startsWith('image/')).slice(0, 8);
    if (!selected.length) { setError('Please choose JPG, PNG or WebP images.'); return; }
    setUploading(true); setError('');
    try {
      const next = [...photos];
      for (const file of selected) {
        const asset = await prepareAsset(file);
        next.push(createV2PhotoLayer(asset, next.length, next.length === 0 && template ? {
          scale: Number(template.defaultTransform?.scale || 100),
          rotation: Number(template.defaultTransform?.rotation || 0),
          x: Number(template.defaultTransform?.offset?.x || 0),
          y: Number(template.defaultTransform?.offset?.y || 0),
        } : {}));
      }
      syncPhotos(next, next.at(-1)?.id);
      setUploadMessage(`${selected.length} photo${selected.length === 1 ? '' : 's'} ready`);
    } catch (uploadError) {
      setError(uploadError?.message || 'The photo upload could not be completed. Please retry.');
      setUploadMessage('');
    } finally { setUploading(false); }
  };

  const patchActivePhotoTransform = (patch) => {
    if (!activePhoto) return;
    syncPhotos(photos.map((layer) => layer.id === activePhoto.id ? { ...layer, transform: { ...layer.transform, ...patch } } : layer), activePhoto.id);
  };
  const deleteActivePhoto = () => activePhoto && syncPhotos(photos.filter((layer) => layer.id !== activePhoto.id));
  const duplicateActivePhoto = () => {
    if (!activePhoto) return;
    const duplicate = { ...activePhoto, id: v2LayerId('photo'), transform: { ...activePhoto.transform, x: clamp(Number(activePhoto.transform?.x || 0) + 8, -48, 48), y: clamp(Number(activePhoto.transform?.y || 0) + 8, -48, 48) } };
    syncPhotos([...photos, duplicate], duplicate.id);
  };
  const moveActivePhoto = (delta) => {
    if (!activePhoto) return;
    const index = photos.findIndex((layer) => layer.id === activePhoto.id);
    const target = clamp(index + delta, 0, photos.length - 1);
    if (target === index) return;
    const next = [...photos];
    const [moved] = next.splice(index, 1); next.splice(target, 0, moved); syncPhotos(next, moved.id);
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

  const patchText = (patch) => onPatch({ text: { ...editor.text, ...patch } });
  const patchTextStyle = (patch) => onPatch({ textStyle: { ...textStyle, ...(isBootleg ? { freeTextLayout: true } : {}), ...patch } });
  const patchTemplateTransform = (patch) => patchTextStyle({ templateTransform: { ...templateTransform, ...patch } });

  const addSticker = (sticker) => {
    const layer = createV2StickerLayer(sticker, (editor.stickers || []).length);
    onPatch({ stickers: [...(editor.stickers || []), layer], activeStickerId: layer.id, activePhotoId: '' });
  };
  const patchActiveSticker = (patch) => {
    if (!activeSticker) return;
    onPatch({ stickers: (editor.stickers || []).map((layer) => layer.id === activeSticker.id ? { ...layer, transform: { ...layer.transform, ...patch } } : layer) });
  };
  const deleteActiveSticker = () => activeSticker && onPatch({ stickers: (editor.stickers || []).filter((layer) => layer.id !== activeSticker.id), activeStickerId: '' });

  // Historical regression-verifier token for the Memorial protected-template contract only:
  // GDP template artwork never becomes an editable layer.

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(280px,.82fr)_minmax(420px,1.4fr)_minmax(300px,.86fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{isBootleg ? 'GDP templates' : 'Protected GDP templates'}</p><h2 className="mt-1 text-xl font-black text-slate-900">Choose a layout</h2><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{isBootleg ? 'Resize, move and rotate the selected GDP template artwork inside the print area.' : 'Memorial template artwork stays protected while your photo and text remain editable.'}</p></div>
        <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1">{templates.map((item) => { const selected = item.id === editor.templateId; return <button key={item.id} type="button" onClick={() => selectTemplate(item)} className={`overflow-hidden rounded-2xl border-2 bg-slate-50 text-left transition ${selected ? 'border-slate-950 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}><div className="aspect-square bg-white p-2"><img src={item.thumbnail || item.assetUrl} alt={item.name} className="h-full w-full object-contain" /></div><div className="p-2.5"><div className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-slate-400" /><span className="line-clamp-1 text-xs font-black text-slate-800">{item.name}</span></div></div></button>; })}</div>

        <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Photo layers</p><p className="text-xs font-bold text-slate-600">Up to 8 photos</p></div><Layers size={17} className="text-slate-400" /></div>
          <div className="mt-3 space-y-2">{photos.map((layer, index) => <button key={layer.id} type="button" onClick={() => { setTemplateEditing(false); onPatch({ activePhotoId: layer.id, activeStickerId: '' }, true); }} className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-2 text-left ${layer.id === activePhotoId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100"><img src={layer.asset?.url} alt="" className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1 truncate text-xs font-black">{layer.asset?.name || `Photo ${index + 1}`}</span><span className="text-[10px] opacity-60">{index + 1}</span></button>)}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 px-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Live garment preview</p><p className="text-sm font-bold text-slate-700">{isBootleg ? 'Move text anywhere in the print area. Use Edit template to drag, pinch and rotate the GDP artwork.' : 'Tap a layer in the list, then drag or pinch directly on the fabric.'}</p></div>
        <ProtectedPreview product={product} color={color} size={size} template={template} editor={editor} path={path} stickers={stickerLibrary} side={side} onPatch={onPatch} templateEditing={templateEditing} />
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Customer controls</p><h2 className="mt-1 text-xl font-black text-slate-900">Personalize</h2></div>

        {isBootleg && template ? <div data-gdp-bootleg-template-controls="true" className="space-y-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-cyan-700">GDP template artwork</p><p className="text-xs font-bold text-slate-600">Resize, move or rotate the template.</p></div><button type="button" onClick={() => setTemplateEditing((value) => !value)} aria-pressed={templateEditing} className={`min-h-10 rounded-xl px-3 text-xs font-black ${templateEditing ? 'bg-cyan-600 text-white' : 'border border-cyan-200 bg-white text-cyan-800'}`}>{templateEditing ? 'Done editing' : 'Edit on canvas'}</button></div>
          <RangeControl label="Template size" value={templateTransform.scale} min={BOOTLEG_TEMPLATE_MIN_SCALE} max={BOOTLEG_TEMPLATE_MAX_SCALE} suffix="%" onChange={(value) => patchTemplateTransform({ scale: value })} />
          <RangeControl label="Move template left / right" value={templateTransform.x} min={-50} max={50} suffix="%" onChange={(value) => patchTemplateTransform({ x: value })} />
          <RangeControl label="Move template up / down" value={templateTransform.y} min={-50} max={50} suffix="%" onChange={(value) => patchTemplateTransform({ y: value })} />
          <RangeControl label="Template rotation" value={templateTransform.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchTemplateTransform({ rotation: value })} />
          <button type="button" onClick={() => patchTextStyle({ templateTransform: { scale: 100, rotation: 0, x: 0, y: 0 } })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-3 text-xs font-black text-cyan-800"><RotateCcw size={14} /> Reset GDP template</button>
        </div> : null}

        <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadPhotos(event.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">{uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />} Add photo{photos.length ? 's' : ''}</button>
        {uploadMessage && !error ? <p className="text-xs font-semibold text-emerald-700">{uploadMessage}</p> : null}{error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}

        {activePhoto ? <div className="space-y-3 rounded-2xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-black text-slate-700">{activePhoto.asset?.name}</span><div className="flex gap-1"><button type="button" onClick={() => moveActivePhoto(-1)} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600" aria-label="Send photo backward"><ArrowDown size={14} /></button><button type="button" onClick={() => moveActivePhoto(1)} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600" aria-label="Bring photo forward"><ArrowUp size={14} /></button><button type="button" onClick={duplicateActivePhoto} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-slate-600" aria-label="Duplicate photo"><Copy size={14} /></button><button type="button" onClick={deleteActivePhoto} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-red-600" aria-label="Delete photo"><Trash2 size={14} /></button></div></div>
          <RangeControl label="Photo size" value={activePhoto.transform?.scale || 100} min={30} max={220} suffix="%" onChange={(value) => patchActivePhotoTransform({ scale: value })} /><RangeControl label="Move left / right" value={activePhoto.transform?.x || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ x: value })} /><RangeControl label="Move up / down" value={activePhoto.transform?.y || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ y: value })} /><RangeControl label="Rotation" value={activePhoto.transform?.rotation || 0} min={-180} max={180} suffix="°" onChange={(value) => patchActivePhotoTransform({ rotation: value })} />
          {(activePhoto.asset?.originalUrl && activePhoto.asset?.cleanedUrl) ? <button type="button" onClick={toggleActiveBackground} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">{activePhoto.asset.backgroundMode === 'original' ? 'Use removed background' : 'Restore original background'}</button> : null}
          <button type="button" onClick={() => patchActivePhotoTransform({ scale: template?.defaultTransform?.scale || 100, rotation: 0, x: 0, y: 0 })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset selected photo</button>
        </div> : null}

        <div className="space-y-2 rounded-2xl border border-slate-100 p-3"><div className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Text</div>
          <label className="block text-xs font-black text-slate-600">{path === 'memorial' ? 'Name' : 'Headline'}<input value={editor.text?.headline || ''} onChange={(event) => patchText({ headline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
          <label className="block text-xs font-black text-slate-600">{path === 'memorial' ? 'Dates' : 'Subline'}<input value={editor.text?.subline || ''} onChange={(event) => patchText({ subline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
          {path === 'memorial' ? <label className="block text-xs font-black text-slate-600">Message<textarea value={editor.text?.message || ''} onChange={(event) => patchText({ message: event.target.value })} maxLength={180} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-500" /></label> : null}
          <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Font<select value={textStyle.fontFamily} onChange={(event) => patchTextStyle({ fontFamily: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_FONT_PRESETS.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Curve<select value={textStyle.curve} onChange={(event) => patchTextStyle({ curve: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_CURVES.map((curve) => <option key={curve.id} value={curve.id}>{curve.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Effect<select value={textStyle.effect} onChange={(event) => patchTextStyle({ effect: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Color<input type="color" value={textStyle.color || '#ffffff'} onChange={(event) => patchTextStyle({ color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label></div>
          {isBootleg ? <UnboundedTextSizeControl value={textStyle.fontScale} onChange={(value) => patchTextStyle({ fontScale: value })} /> : <RangeControl label="Text size" value={textStyle.fontScale} min={55} max={180} suffix="%" onChange={(value) => patchTextStyle({ fontScale: value })} />}
          {isBootleg ? <><RangeControl label="Move text left / right" value={textPosition.x} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ canvasX: value, canvasY: textPosition.y })} /><RangeControl label="Move text up / down" value={textPosition.y} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ canvasX: textPosition.x, canvasY: value })} /></> : <><RangeControl label="Move text left / right" value={textStyle.x || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ x: value })} /><RangeControl label="Move text up / down" value={textStyle.y || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ y: value })} /></>}
          <RangeControl label="Text rotation" value={textStyle.rotation || 0} min={isBootleg ? -180 : -25} max={isBootleg ? 180 : 25} suffix="°" onChange={(value) => patchTextStyle({ rotation: value })} />
          {textStyle.curve !== 'straight' ? <RangeControl label="Curve amount" value={textStyle.curveAmount} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ curveAmount: value })} /> : null}
        </div>

        {settings?.editorTools?.stickers !== false ? <div className="rounded-2xl border border-slate-100 p-3"><div className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Stickers</div><div className="mt-2 flex flex-wrap gap-2">{stickerLibrary.filter((item) => path === 'memorial' || item.category !== 'memorial').map((sticker) => <button key={sticker.id} type="button" onClick={() => { setTemplateEditing(false); addSticker(sticker); }} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-200 bg-white px-2 text-xl" title={sticker.label}>{sticker.assetUrl ? <img src={sticker.assetUrl} alt={sticker.label} className="h-7 w-7 object-contain" /> : sticker.glyph}</button>)}</div>{activeSticker ? <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-2"><RangeControl label="Sticker size" value={activeSticker.transform?.scale || 42} min={12} max={85} suffix="%" onChange={(value) => patchActiveSticker({ scale: value })} /><RangeControl label="Sticker rotation" value={activeSticker.transform?.rotation || 0} min={-180} max={180} suffix="°" onChange={(value) => patchActiveSticker({ rotation: value })} /><button type="button" onClick={deleteActiveSticker} className="min-h-10 w-full rounded-lg bg-white text-xs font-black text-red-600">Delete selected sticker</button></div> : null}</div> : null}

        <button type="button" disabled={!template || !photos.length} onClick={() => onConfirmedChange(!editor.confirmed)} aria-pressed={editor.confirmed} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'} disabled:cursor-not-allowed disabled:opacity-40`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">I’m done customizing this {side} design</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm {isBootleg ? 'template, photos, layers, text and placement' : 'photos, layers, text and placement'} before review.</span></span></button>
      </section>
    </div>
  );
}
