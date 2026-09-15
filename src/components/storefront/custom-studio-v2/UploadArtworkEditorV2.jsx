import React, { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { customerApi } from '@/lib/customerApi';
import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';
import { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function RangeControl({ label, value, min, max, suffix = '', onChange }) {
  return <label className="block"><div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600"><span>{label}</span><span>{Math.round(Number(value || 0) * 10) / 10}{suffix}</span></div><input type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer" /></label>;
}

export default function UploadArtworkEditorV2({ product, color, side, editor, onPatch, onConfirmedChange }) {
  const fileRef = useRef(null);
  const referenceBoxRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const transform = editor.transform || { scale: 100, rotation: 0, x: 0, y: 0 };
  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const patchTransform = (patch) => onPatch({ transform: { ...transform, ...patch } });
  const gesture = useTouchTransformV2({ transform, onChange: (next) => onPatch({ transform: next }), containerRef: referenceBoxRef, enabled: Boolean(editor.artwork), minScale: 30, maxScale: 180, minX: -42, maxX: 42, minY: -42, maxY: 42 });

  const uploadArtwork = async (file) => {
    if (!file || !String(file.type || '').startsWith('image/')) { setError('Please choose a JPG, PNG or WebP artwork file.'); return; }
    setUploading(true); setError('');
    try {
      const uploaded = await customerApi.uploadArtwork(file);
      onPatch({ artwork: { url: uploaded.file_url, path: uploaded.storage_path, name: file.name || 'customer-artwork', type: file.type || 'image/png' }, transform: { scale: 100, rotation: 0, x: 0, y: 0 } });
    } catch (uploadError) {
      setError(uploadError?.message || 'Artwork upload failed. Please retry.');
    } finally { setUploading(false); }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 px-1"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Live garment preview · {side}</p><p className="text-sm font-bold text-slate-700">Drag with one finger. Pinch with two fingers to resize and rotate.</p></div>
        <div className="mx-auto w-full max-w-[680px] rounded-[28px] bg-slate-100 p-3 sm:p-5">
          <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
            {garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}
            <div className="absolute left-1/2 top-[23%] aspect-[4/5] w-[43%] -translate-x-1/2 overflow-hidden rounded-lg border-2 border-dashed border-slate-500/50 bg-white/5">
              <div ref={referenceBoxRef} className="pointer-events-none absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2" />
              {editor.artwork?.url ? (
                <div
                  {...gesture}
                  className="absolute grid cursor-grab place-items-center rounded-sm ring-2 ring-cyan-400/75 ring-offset-1 ring-offset-transparent"
                  style={{
                    ...gesture.style,
                    left: `${50 + clamp(transform.x, -42, 42) * 0.72}%`,
                    top: `${50 + clamp(transform.y, -42, 42) * 0.72}%`,
                    width: '72%',
                    height: '72%',
                    transform: `translate(-50%, -50%) scale(${clamp(transform.scale, 30, 180) / 100}) rotate(${clamp(transform.rotation, -180, 180)}deg)`,
                  }}
                >
                  <img src={editor.artwork.url} alt="Uploaded artwork preview" draggable="false" className="h-full w-full select-none object-contain" />
                </div>
              ) : <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs font-bold text-slate-500">Upload artwork to place it on the {side} print area.</div>}
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] font-bold text-slate-400">The dashed fabric box and 72% artwork box use the same normalized geometry as the production renderer.</p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Artwork controls</p><h2 className="mt-1 text-xl font-black text-slate-900">Position artwork</h2></div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadArtwork(event.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">{uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}{editor.artwork ? 'Replace artwork' : 'Upload artwork'}</button>
        {error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
        {editor.artwork ? <><div className="space-y-3 rounded-2xl bg-slate-50 p-3"><RangeControl label="Artwork size" value={transform.scale} min={30} max={180} suffix="%" onChange={(value) => patchTransform({ scale: value })} /><RangeControl label="Move left / right" value={transform.x} min={-42} max={42} suffix="%" onChange={(value) => patchTransform({ x: value })} /><RangeControl label="Move up / down" value={transform.y} min={-42} max={42} suffix="%" onChange={(value) => patchTransform({ y: value })} /><RangeControl label="Rotation" value={transform.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchTransform({ rotation: value })} /><button type="button" onClick={() => onPatch({ transform: { scale: 100, rotation: 0, x: 0, y: 0 } })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset position</button></div>
          <button type="button" onClick={() => onConfirmedChange(!editor.confirmed)} aria-pressed={editor.confirmed} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">I’m done positioning my {side} artwork</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm the current size, rotation and placement before review.</span></span></button></> : null}
      </section>
    </div>
  );
}
