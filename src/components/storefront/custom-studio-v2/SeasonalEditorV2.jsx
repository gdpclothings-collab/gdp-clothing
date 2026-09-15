import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Lock, RotateCcw, Search, Trash2, Unlock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { fitSeasonalArtwork } from '@/lib/seasonalArtwork';

const MAX_LAYERS = 10;
const newLayerId = () => (crypto?.randomUUID ? crypto.randomUUID() : `seasonal_v2_${Date.now()}_${Math.random().toString(36).slice(2)}`);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ArtworkLayer({ entry, area, active, onSelect, onMove }) {
  const pointer = useRef(null);
  if (!entry?.artwork || !entry?.layout || !area) return null;

  const begin = (event) => {
    if (entry.layer.locked) {
      onSelect(entry.layer.id);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSelect(entry.layer.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    pointer.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: Number(entry.layer.position?.x || 0),
      y: Number(entry.layer.position?.y || 0),
      rect,
    };
  };

  const move = (event) => {
    const start = pointer.current;
    if (!start || start.pointerId !== event.pointerId || entry.layer.locked) return;
    event.preventDefault();
    const nextX = start.x + ((event.clientX - start.startX) / Math.max(1, start.rect.width)) * area.width;
    const nextY = start.y + ((event.clientY - start.startY) / Math.max(1, start.rect.height)) * area.height;
    onMove(entry.layer.id, {
      x: clamp(nextX, 0, Math.max(0, area.width - entry.layout.width)),
      y: clamp(nextY, 0, Math.max(0, area.height - entry.layout.height)),
    });
  };

  const end = (event) => {
    if (pointer.current?.pointerId === event.pointerId) pointer.current = null;
  };

  return (
    <button
      type="button"
      data-seasonal-v2-layer
      aria-label={`${entry.artwork.title}${active ? ', selected' : ''}`}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`absolute touch-none select-none border-0 bg-transparent p-0 ${entry.layer.locked ? 'cursor-default' : 'cursor-move'} ${active ? 'ring-2 ring-[#D9273E] ring-offset-2' : ''}`}
      style={{
        left: `${(entry.layout.x / area.width) * 100}%`,
        top: `${(entry.layout.y / area.height) * 100}%`,
        width: `${(entry.layout.width / area.width) * 100}%`,
        height: `${(entry.layout.height / area.height) * 100}%`,
        transform: `rotate(${Number(entry.layer.rotation || 0)}deg)`,
        transformOrigin: 'center',
        zIndex: entry.order + 1,
      }}
    >
      <img src={entry.artwork.preview} alt="" draggable="false" className="pointer-events-none h-full w-full object-fill" />
    </button>
  );
}

function ToolbarButton({ label, onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

export default function SeasonalEditorV2({ product, size, layers, activeLayerId, confirmed, onLayersChange, onActiveLayerChange, onConfirmedChange }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    let active = true;
    setCatalog(null);
    setError('');
    Promise.resolve(supabase.rpc('list_seasonal_artworks', { p_product: product.id, p_size: size }))
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) setError('Seasonal designs could not load.');
        else setCatalog(data || { artworks: [], area: null });
      })
      .catch(() => {
        if (active) setError('Could not connect to the seasonal design library.');
      });
    return () => { active = false; };
  }, [product.id, size]);

  const artworks = (catalog?.artworks || []).filter((artwork) => !artwork.requires_name);
  const area = catalog?.area || null;
  const artworkById = useMemo(() => new Map(artworks.map((artwork) => [String(artwork.id), artwork])), [artworks]);
  const resolved = useMemo(() => (layers || []).map((layer, order) => {
    const artwork = artworkById.get(String(layer.artworkId));
    const layout = artwork && area
      ? fitSeasonalArtwork(artwork, area, Number(layer.requested || 0), Number(layer.position?.x || 0), Number(layer.position?.y || 0))
      : null;
    return { layer, artwork, layout, order };
  }), [layers, artworkById, area]);

  const activeEntry = resolved.find((entry) => entry.layer.id === activeLayerId) || resolved[resolved.length - 1] || null;
  const categories = [...new Set(artworks.map((artwork) => artwork.category).filter(Boolean))].sort();
  const filtered = artworks.filter((artwork) => {
    const matchesCategory = !category || artwork.category === category;
    const haystack = [artwork.title, artwork.category, ...(artwork.tags || [])].join(' ').toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  });

  const commit = (nextLayers, nextActive = activeLayerId) => {
    onLayersChange(nextLayers, nextActive);
    onConfirmedChange(false);
  };

  const addArtwork = (artwork) => {
    if (!area || layers.length >= MAX_LAYERS) return;
    const initial = fitSeasonalArtwork(artwork, area, 0);
    if (!initial) return;
    const id = newLayerId();
    const next = [
      ...layers,
      {
        id,
        artworkId: artwork.id,
        artworkTitle: artwork.title,
        category: artwork.category || '',
        requested: 0,
        position: {
          x: Math.max(0, (area.width - initial.width) / 2),
          y: Math.max(0, (area.height - initial.height) / 2),
        },
        rotation: 0,
        visible: true,
        locked: false,
      },
    ];
    commit(next, id);
  };

  const patchLayer = (id, patch) => {
    commit(layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer), id);
  };

  const removeLayer = (id) => {
    const next = layers.filter((layer) => layer.id !== id);
    commit(next, next[next.length - 1]?.id || '');
  };

  const duplicateLayer = (id) => {
    if (layers.length >= MAX_LAYERS) return;
    const source = layers.find((layer) => layer.id === id);
    if (!source) return;
    const copyId = newLayerId();
    const copy = {
      ...source,
      id: copyId,
      position: {
        x: Number(source.position?.x || 0) + 0.2,
        y: Number(source.position?.y || 0) + 0.2,
      },
      locked: false,
    };
    commit([...layers, copy], copyId);
  };

  const resetLayer = (id) => {
    const entry = resolved.find((item) => item.layer.id === id);
    if (!entry?.artwork || !area) return;
    const initial = fitSeasonalArtwork(entry.artwork, area, 0);
    patchLayer(id, {
      requested: 0,
      rotation: 0,
      position: {
        x: Math.max(0, (area.width - initial.width) / 2),
        y: Math.max(0, (area.height - initial.height) / 2),
      },
    });
  };

  if (!catalog && !error) {
    return <div className="grid min-h-[420px] place-items-center rounded-3xl border border-slate-200 bg-white"><div className="text-sm font-semibold text-slate-500">Loading seasonal artwork…</div></div>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(280px,.75fr)_minmax(420px,1.4fr)_minmax(280px,.75fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Seasonal Library</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Choose artwork</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{layers.length}/{MAX_LAYERS}</span>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search designs" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-slate-400" />
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setCategory('')} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-bold ${!category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>All</button>
          {categories.map((value) => (
            <button key={value} type="button" onClick={() => setCategory(value)} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-bold ${category === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{value}</button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}

        <div className="grid max-h-[520px] grid-cols-2 gap-3 overflow-y-auto pr-1">
          {filtered.map((artwork) => (
            <button key={artwork.id} type="button" onClick={() => addArtwork(artwork)} disabled={layers.length >= MAX_LAYERS} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-slate-400 disabled:opacity-40">
              <div className="aspect-square bg-white p-2"><img src={artwork.preview} alt={artwork.title} className="h-full w-full object-contain" /></div>
              <div className="p-2.5"><div className="line-clamp-2 text-xs font-black text-slate-800">{artwork.title}</div></div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Fabric workspace</p>
            <p className="text-sm font-bold text-slate-700">Drag artwork directly in the print area</p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 sm:inline">Front</span>
        </div>

        <div className="mx-auto w-full max-w-[620px] rounded-[28px] bg-slate-100 p-3 sm:p-5">
          <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
            {product?.images?.[0] ? <img src={product.images[0]} alt={product.name} className="absolute inset-0 h-full w-full object-contain opacity-95" /> : null}
            <div className="absolute left-1/2 top-[24%] aspect-[4/5] w-[42%] -translate-x-1/2 overflow-hidden rounded-lg border-2 border-dashed border-white/80 bg-black/5 shadow-[0_0_0_1px_rgba(15,23,42,.15)]">
              {area ? resolved.filter((entry) => entry.layer.visible !== false).map((entry) => (
                <ArtworkLayer key={entry.layer.id} entry={entry} area={area} active={entry.layer.id === activeLayerId} onSelect={onActiveLayerChange} onMove={(id, position) => patchLayer(id, { position })} />
              )) : null}
              {!layers.length && <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs font-bold text-slate-500">Add artwork from the library</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Layers</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">Arrange design</h2>
        </div>

        {activeEntry ? (
          <>
            <div className="rounded-2xl bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <img src={activeEntry.artwork.preview} alt="" className="h-14 w-14 rounded-xl bg-white object-contain p-1" />
                <div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{activeEntry.artwork.title}</p><p className="text-xs text-slate-500">Selected layer</p></div>
              </div>
            </div>

            <label className="block">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600"><span>Size</span><span>{Math.round((activeEntry.layout?.width || 0) * 10) / 10} in</span></div>
              <input type="range" min="0.5" max={Math.max(0.5, Number(activeEntry.layout?.maxWidth || area?.width || 12))} step="0.1" value={Number(activeEntry.layer.requested || activeEntry.layout?.width || 1)} onChange={(event) => patchLayer(activeEntry.layer.id, { requested: Number(event.target.value) })} className="w-full" />
            </label>

            <label className="block">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600"><span>Rotation</span><span>{Math.round(Number(activeEntry.layer.rotation || 0))}°</span></div>
              <input type="range" min="-180" max="180" step="1" value={Number(activeEntry.layer.rotation || 0)} onChange={(event) => patchLayer(activeEntry.layer.id, { rotation: Number(event.target.value) })} className="w-full" />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <ToolbarButton label={activeEntry.layer.locked ? 'Unlock' : 'Lock'} onClick={() => patchLayer(activeEntry.layer.id, { locked: !activeEntry.layer.locked })}>{activeEntry.layer.locked ? <Unlock size={15} /> : <Lock size={15} />}</ToolbarButton>
              <ToolbarButton label="Duplicate" onClick={() => duplicateLayer(activeEntry.layer.id)} disabled={layers.length >= MAX_LAYERS}><Copy size={15} /></ToolbarButton>
              <ToolbarButton label={activeEntry.layer.visible === false ? 'Show' : 'Hide'} onClick={() => patchLayer(activeEntry.layer.id, { visible: activeEntry.layer.visible === false })}>{activeEntry.layer.visible === false ? <Eye size={15} /> : <EyeOff size={15} />}</ToolbarButton>
              <ToolbarButton label="Reset" onClick={() => resetLayer(activeEntry.layer.id)}><RotateCcw size={15} /></ToolbarButton>
            </div>
            <ToolbarButton label="Delete layer" onClick={() => removeLayer(activeEntry.layer.id)}><Trash2 size={15} /></ToolbarButton>
          </>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Select or add artwork to edit it.</div>
        )}

        <button
          type="button"
          disabled={!layers.length}
          onClick={() => onConfirmedChange(!confirmed)}
          aria-pressed={confirmed}
          className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white text-transparent'}`}><Check size={18} strokeWidth={3} /></span>
          <span><span className="block text-sm font-black">I’m done arranging the seasonal artwork</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm this layout before continuing to review.</span></span>
        </button>
      </section>
    </div>
  );
}
