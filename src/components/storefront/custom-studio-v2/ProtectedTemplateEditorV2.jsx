import React, { useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { customerApi } from '@/lib/customerApi';
import { normalizeStyleTemplates } from '@/lib/customStudioStyleTemplates';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function RangeControl({ label, value, min, max, step = 1, suffix = '', onChange }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
        <span>{label}</span>
        <span>{Math.round(Number(value || 0) * 10) / 10}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full cursor-pointer"
      />
    </label>
  );
}

function ProtectedPreview({ product, template, editor, path }) {
  const zone = template?.photoZone || { x: 15, y: 12, width: 70, height: 68, radius: 12, shape: 'rounded' };
  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16, align: 'center' };
  const transform = editor.transform || {};
  const scale = clamp(transform.scale || 100, 55, 180) / 100;
  const x = clamp(transform.x || 0, -42, 42);
  const y = clamp(transform.y || 0, -42, 42);
  const rotation = clamp(transform.rotation || 0, -180, 180);
  const radius = zone.shape === 'circle' || zone.shape === 'oval' ? '50%' : `${Number(zone.radius || 0)}%`;

  return (
    <div className="mx-auto w-full max-w-[620px] rounded-[28px] bg-slate-100 p-3 sm:p-5">
      <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
        {product?.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className="absolute inset-0 h-full w-full object-contain" />
        ) : null}

        <div className="absolute left-1/2 top-[23%] aspect-[4/5] w-[43%] -translate-x-1/2 overflow-hidden rounded-lg border border-dashed border-slate-400/70 bg-white/10">
          {editor.photo?.url ? (
            <div
              className="absolute overflow-hidden"
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.width}%`,
                height: `${zone.height}%`,
                borderRadius: radius,
              }}
            >
              <img
                src={editor.photo.url}
                alt="Customer upload preview"
                draggable="false"
                className="h-full w-full select-none object-cover"
                style={{
                  transform: `translate(${x}%, ${y}%) scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: 'center',
                }}
              />
            </div>
          ) : null}

          {template?.assetUrl ? (
            <img src={template.assetUrl} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute inset-0 z-20 h-full w-full select-none object-fill" />
          ) : null}

          {(editor.text?.headline || editor.text?.subline || editor.text?.message) ? (
            <div
              className="pointer-events-none absolute z-30 flex flex-col justify-center px-1 text-center text-white drop-shadow-[0_2px_3px_rgba(0,0,0,.9)]"
              style={{ left: `${textZone.x}%`, top: `${textZone.y}%`, width: `${textZone.width}%`, height: `${textZone.height}%` }}
            >
              {editor.text.headline ? <div className="truncate text-[clamp(8px,1.4vw,15px)] font-black uppercase leading-tight">{editor.text.headline}</div> : null}
              {editor.text.subline ? <div className="truncate text-[clamp(6px,1vw,11px)] font-bold leading-tight">{editor.text.subline}</div> : null}
              {editor.text.message ? <div className="mt-0.5 line-clamp-2 text-[clamp(5px,.8vw,9px)] font-semibold leading-tight">{editor.text.message}</div> : null}
            </div>
          ) : null}
        </div>

        {!template && <div className="absolute inset-x-4 bottom-4 rounded-xl bg-slate-950/80 p-3 text-center text-xs font-bold text-white">Choose a {path === 'memorial' ? 'memorial' : 'bootleg'} template to begin.</div>}
      </div>
    </div>
  );
}

export default function ProtectedTemplateEditorV2({ path, product, settings, editor, onPatch, onConfirmedChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');

  const category = path === 'memorial' ? 'memorial_tribute' : 'photo_bootleg';
  const templates = useMemo(
    () => normalizeStyleTemplates(settings?.styleTemplates || {}).filter((item) => item.enabled && item.category === category),
    [settings?.styleTemplates, category]
  );
  const template = templates.find((item) => item.id === editor.templateId) || null;

  const selectTemplate = (item) => {
    onPatch({
      templateId: item.id,
      transform: {
        scale: Number(item.defaultTransform?.scale || 100),
        rotation: Number(item.defaultTransform?.rotation || 0),
        x: Number(item.defaultTransform?.offset?.x || 0),
        y: Number(item.defaultTransform?.offset?.y || 0),
      },
    });
  };

  const uploadPhoto = async (file) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      setError('Please choose a JPG, PNG or WebP image.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadMessage('Preparing photo…');
    try {
      let uploaded = null;
      const autoRemove = settings?.editorTools?.autoBackgroundRemoval !== false;
      if (autoRemove) {
        try {
          setUploadMessage('Removing background…');
          const processed = await customerApi.removePhotoBackground(file);
          if (processed?.ok && processed?.cleanedUrl && processed?.cleanedPath) {
            uploaded = { file_url: processed.cleanedUrl, storage_path: processed.cleanedPath };
          }
        } catch (backgroundError) {
          console.warn('V2 background removal unavailable; using original image.', backgroundError);
        }
      }
      if (!uploaded) {
        setUploadMessage('Uploading photo…');
        uploaded = await customerApi.uploadArtwork(file);
      }

      onPatch({
        photo: {
          url: uploaded.file_url,
          path: uploaded.storage_path,
          name: file.name || 'customer-photo',
          type: file.type || 'image/png',
        },
      });
      setUploadMessage('Photo ready');
    } catch (uploadError) {
      setError(uploadError?.message || 'The photo could not be uploaded. Please retry.');
      setUploadMessage('');
    } finally {
      setUploading(false);
    }
  };

  const patchTransform = (patch) => onPatch({ transform: { ...editor.transform, ...patch } });
  const patchText = (patch) => onPatch({ text: { ...editor.text, ...patch } });
  const resetTransform = () => {
    if (!template) return;
    patchTransform({
      scale: Number(template.defaultTransform?.scale || 100),
      rotation: Number(template.defaultTransform?.rotation || 0),
      x: Number(template.defaultTransform?.offset?.x || 0),
      y: Number(template.defaultTransform?.offset?.y || 0),
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(280px,.8fr)_minmax(420px,1.45fr)_minmax(280px,.8fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Locked GDP templates</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">Choose a layout</h2>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Template artwork stays protected. Your photo and text remain editable.</p>
        </div>

        <div className="grid max-h-[560px] grid-cols-2 gap-3 overflow-y-auto pr-1">
          {templates.map((item) => {
            const selected = item.id === editor.templateId;
            return (
              <button key={item.id} type="button" onClick={() => selectTemplate(item)} className={`overflow-hidden rounded-2xl border-2 bg-slate-50 text-left transition ${selected ? 'border-slate-950 shadow-md' : 'border-slate-200 hover:border-slate-400'}`}>
                <div className="aspect-square bg-white p-2"><img src={item.thumbnail || item.assetUrl} alt={item.name} className="h-full w-full object-contain" /></div>
                <div className="p-2.5"><div className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-slate-400" /><span className="line-clamp-1 text-xs font-black text-slate-800">{item.name}</span></div></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Live garment preview</p><p className="text-sm font-bold text-slate-700">Customer layers stay separate from the locked GDP artwork.</p></div>
        </div>
        <ProtectedPreview product={product} template={template} editor={editor} path={path} />
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Customer controls</p><h2 className="mt-1 text-xl font-black text-slate-900">Personalize</h2></div>

        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadPhoto(event.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">
          {uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}
          {editor.photo ? 'Replace photo' : 'Upload photo'}
        </button>
        {uploadMessage && !error ? <p className="text-xs font-semibold text-emerald-700">{uploadMessage}</p> : null}
        {error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}

        {editor.photo ? (
          <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
            <RangeControl label="Photo size" value={editor.transform.scale} min={55} max={180} suffix="%" onChange={(value) => patchTransform({ scale: value })} />
            <RangeControl label="Move left / right" value={editor.transform.x} min={-42} max={42} suffix="%" onChange={(value) => patchTransform({ x: value })} />
            <RangeControl label="Move up / down" value={editor.transform.y} min={-42} max={42} suffix="%" onChange={(value) => patchTransform({ y: value })} />
            <RangeControl label="Rotation" value={editor.transform.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchTransform({ rotation: value })} />
            <button type="button" onClick={resetTransform} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset photo position</button>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="block text-xs font-black text-slate-600">{path === 'memorial' ? 'Name' : 'Headline'}
            <input value={editor.text?.headline || ''} onChange={(event) => patchText({ headline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" placeholder={path === 'memorial' ? 'In Loving Memory of…' : 'Main wording'} />
          </label>
          <label className="block text-xs font-black text-slate-600">{path === 'memorial' ? 'Dates' : 'Subline'}
            <input value={editor.text?.subline || ''} onChange={(event) => patchText({ subline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" placeholder={path === 'memorial' ? '1980 — 2026' : 'Supporting wording'} />
          </label>
          {path === 'memorial' ? (
            <label className="block text-xs font-black text-slate-600">Message
              <textarea value={editor.text?.message || ''} onChange={(event) => patchText({ message: event.target.value })} maxLength={180} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-500" placeholder="Forever loved, forever remembered." />
            </label>
          ) : null}
        </div>

        <button
          type="button"
          disabled={!template || !editor.photo?.path}
          onClick={() => onConfirmedChange(!editor.confirmed)}
          aria-pressed={editor.confirmed}
          className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span>
          <span><span className="block text-sm font-black">I’m done customizing this design</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm the current photo, text and placement before review.</span></span>
        </button>
      </section>
    </div>
  );
}
