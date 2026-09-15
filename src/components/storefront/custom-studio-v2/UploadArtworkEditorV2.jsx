import React, { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import { customerApi } from '@/lib/customerApi';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function RangeControl({ label, value, min, max, suffix = '', onChange }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600"><span>{label}</span><span>{Math.round(Number(value || 0) * 10) / 10}{suffix}</span></div>
      <input type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full cursor-pointer" />
    </label>
  );
}

export default function UploadArtworkEditorV2({ product, side, editor, onPatch, onConfirmedChange, onSideChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const transform = editor.transform || { scale: 100, rotation: 0, x: 0, y: 0 };

  const uploadArtwork = async (file) => {
    if (!file || !String(file.type || '').startsWith('image/')) {
      setError('Please choose a JPG, PNG or WebP artwork file.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const uploaded = await customerApi.uploadArtwork(file);
      onPatch({
        artwork: {
          url: uploaded.file_url,
          path: uploaded.storage_path,
          name: file.name || 'customer-artwork',
          type: file.type || 'image/png',
        },
        transform: { scale: 100, rotation: 0, x: 0, y: 0 },
      });
    } catch (uploadError) {
      setError(uploadError?.message || 'Artwork upload failed. Please retry.');
    } finally {
      setUploading(false);
    }
  };

  const patchTransform = (patch) => onPatch({ transform: { ...transform, ...patch } });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,.75fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Live garment preview</p><p className="text-sm font-bold text-slate-700">Artwork placement is stored independently for V2.</p></div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {['front', 'back'].map((value) => <button key={value} type="button" onClick={() => onSideChange(value)} className={`min-h-10 rounded-lg px-4 text-xs font-black uppercase ${side === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{value}</button>)}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[680px] rounded-[28px] bg-slate-100 p-3 sm:p-5">
          <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
            {product?.images?.[0] ? <img src={product.images[0]} alt={product.name} className="absolute inset-0 h-full w-full object-contain" /> : null}
            <div className="absolute left-1/2 top-[23%] aspect-[4/5] w-[43%] -translate-x-1/2 overflow-hidden rounded-lg border-2 border-dashed border-slate-500/50 bg-white/5">
              {editor.artwork?.url ? (
                <img
                  src={editor.artwork.url}
                  alt="Uploaded artwork preview"
                  draggable="false"
                  className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                  style={{
                    transform: `translate(calc(-50% + ${clamp(transform.x, -42, 42)}%), calc(-50% + ${clamp(transform.y, -42, 42)}%)) scale(${clamp(transform.scale, 30, 180) / 100}) rotate(${clamp(transform.rotation, -180, 180)}deg)`,
                    transformOrigin: 'center',
                  }}
                />
              ) : <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs font-bold text-slate-500">Upload artwork to place it on the {side} print area.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Artwork controls</p><h2 className="mt-1 text-xl font-black text-slate-900">Position artwork</h2></div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadArtwork(event.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-50">
          {uploading ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}
          {editor.artwork ? 'Replace artwork' : 'Upload artwork'}
        </button>
        {error ? <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
        {editor.artwork ? (
          <>
            <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
              <RangeControl label="Artwork size" value={transform.scale} min={30} max={180} suffix="%" onChange={(value) => patchTransform({ scale: value })} />
              <RangeControl label="Move left / right" value={transform.x} min={-42} max={42} suffix="%" onChange={(value) => patchTransform({ x: value })} />
              <RangeControl label="Move up / down" value={transform.y} min={-42} max={42} suffix="%" onChange={(value) => patchTransform({ y: value })} />
              <RangeControl label="Rotation" value={transform.rotation} min={-180} max={180} suffix="°" onChange={(value) => patchTransform({ rotation: value })} />
              <button type="button" onClick={() => onPatch({ transform: { scale: 100, rotation: 0, x: 0, y: 0 } })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset position</button>
            </div>

            <button
              type="button"
              onClick={() => onConfirmedChange(!editor.confirmed)}
              aria-pressed={editor.confirmed}
              className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span>
              <span><span className="block text-sm font-black">I’m done positioning my artwork</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm the current size, rotation and print side before review.</span></span>
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}
