import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Lock, RotateCcw, Search, Trash2, Unlock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { fitSeasonalArtwork } from '@/lib/seasonalArtwork';
import { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';
import { resolveStudioV2PrintGuide } from '@/lib/customStudioV2PrintGuide';

const MAX_LAYERS = 10;
const newLayerId = () => (crypto?.randomUUID ? crypto.randomUUID() : `seasonal_v2_${Date.now()}_${Math.random().toString(36).slice(2)}`);
const seasonalCatalogCache = new Map();
const seasonalArtworkPreviewCache = new Map();

function seasonalCatalogKey(productId, size, side) {
  return [String(productId || ''), String(size || ''), String(side || 'front')].join('::');
}

function preloadArtworkPreview(src) {
  const key = String(src || '').trim();
  if (!key || typeof Image === 'undefined') return Promise.resolve();
  if (seasonalArtworkPreviewCache.has(key)) return seasonalArtworkPreviewCache.get(key);

  const task = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = async () => {
      try {
        if (typeof image.decode === 'function') await image.decode();
      } catch {
        // The browser already loaded the image. A decode hint failure is safe to ignore.
      }
      resolve();
    };
    image.onerror = () => reject(new Error('Artwork preview could not load.'));
    image.src = key;
  });

  seasonalArtworkPreviewCache.set(key, task);
  task.catch(() => seasonalArtworkPreviewCache.delete(key));
  return task;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ArtworkLayer({ entry, area, active, onSelect, onTransform }) {
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  if (!entry?.artwork || !entry?.layout || !area) return null;

  const restart = () => {
    const points = [...pointers.current.values()];
    const currentWidth = Number(entry.layout.width || 1);
    const currentHeight = Number(entry.layout.height || 1);
    const center = { x: Number(entry.layout.x || 0) + currentWidth / 2, y: Number(entry.layout.y || 0) + currentHeight / 2 };
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.current = {
        mode: 'pinch',
        distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
        angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
        pointerCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        center,
        width: currentWidth,
        height: currentHeight,
        rotation: Number(entry.layer.rotation || 0),
      };
    } else if (points.length === 1) {
      gesture.current = { mode: 'drag', point: points[0], center, width: currentWidth, height: currentHeight };
    } else {
      gesture.current = null;
    }
  };

  const begin = (event) => {
    onSelect(entry.layer.id);
    if (entry.layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    restart();
  };

  const move = (event) => {
    if (entry.layer.locked || !pointers.current.has(event.pointerId)) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const state = gesture.current;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!state || !rect?.width || !rect?.height) return;
    const points = [...pointers.current.values()];

    if (state.mode === 'drag' && points.length === 1) {
      const point = points[0];
      const cx = state.center.x + ((point.x - state.point.x) / rect.width) * area.width;
      const cy = state.center.y + ((point.y - state.point.y) / rect.height) * area.height;
      onTransform(entry.layer.id, {
        position: {
          x: clamp(cx - state.width / 2, 0, Math.max(0, area.width - state.width)),
          y: clamp(cy - state.height / 2, 0, Math.max(0, area.height - state.height)),
        },
      });
      return;
    }

    if (state.mode === 'pinch' && points.length >= 2) {
      const [a, b] = points;
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      const pointerCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const maxWidth = Math.max(0.5, Number(entry.layout.maxWidth || area.width));
      const width = clamp(state.width * (distance / state.distance), 0.5, maxWidth);
      const height = state.height * (width / Math.max(0.01, state.width));
      const cx = state.center.x + ((pointerCenter.x - state.pointerCenter.x) / rect.width) * area.width;
      const cy = state.center.y + ((pointerCenter.y - state.pointerCenter.y) / rect.height) * area.height;
      let rotation = state.rotation + (angle - state.angle);
      while (rotation > 180) rotation -= 360;
      while (rotation < -180) rotation += 360;
      onTransform(entry.layer.id, {
        requested: width,
        rotation,
        position: {
          x: clamp(cx - width / 2, 0, Math.max(0, area.width - width)),
          y: clamp(cy - height / 2, 0, Math.max(0, area.height - height)),
        },
      });
    }
  };

  const end = (event) => {
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
    pointers.current.delete(event.pointerId);
    restart();
  };

  const rotation = Number(entry.layer.rotation || 0);
  const visualTransform = Math.abs(rotation) > 0.001 ? `rotate(${rotation}deg)` : 'none';

  return (
    <button
      type="button"
      data-seasonal-v2-layer
      aria-label={`${entry.artwork.title}${active ? ', selected' : ''}`}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`absolute touch-none select-none border-0 bg-transparent p-0 ${entry.layer.locked ? 'cursor-default' : 'cursor-move'}`}
      style={{
        left: `${(entry.layout.x / area.width) * 100}%`,
        top: `${(entry.layout.y / area.height) * 100}%`,
        width: `${(entry.layout.width / area.width) * 100}%`,
        height: `${(entry.layout.height / area.height) * 100}%`,
        isolation: 'isolate',
        zIndex: entry.order + 1,
      }}
    >
      <span
        data-seasonal-v2-layer-visual
        aria-hidden="true"
        className={`absolute inset-0 block ${active ? 'ring-2 ring-[#D9273E] ring-offset-2' : ''}`}
        style={{
          transform: visualTransform,
          transformOrigin: 'center',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: visualTransform === 'none' ? 'auto' : 'transform',
        }}
      >
        <img
          src={entry.artwork.preview}
          alt=""
          draggable="false"
          className="pointer-events-none block h-full w-full select-none object-fill"
        />
      </span>
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

export default function SeasonalEditorV2({ product, color, side = 'front', size, layers, activeLayerId, confirmed, onLayersChange, onActiveLayerChange, onConfirmedChange }) {
  const requestKey = useMemo(() => seasonalCatalogKey(product?.id, size, side), [product?.id, size, side]);
  const initialCachedCatalog = seasonalCatalogCache.get(requestKey) || null;
  const [catalogRecord, setCatalogRecord] = useState(() => ({ key: requestKey, data: initialCachedCatalog }));
  const [libraryLoading, setLibraryLoading] = useState(!initialCachedCatalog);
  const [retryVersion, setRetryVersion] = useState(0);
  const [pendingArtworkId, setPendingArtworkId] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const layersRef = useRef(layers || []);
  const requestKeyRef = useRef(requestKey);
  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side), [product, size, side]);
  const catalog = catalogRecord.key === requestKey ? catalogRecord.data : (seasonalCatalogCache.get(requestKey) || null);
  const libraryBusy = libraryLoading || (!catalog && !error);

  useEffect(() => {
    layersRef.current = layers || [];
  }, [layers]);

  useEffect(() => {
    requestKeyRef.current = requestKey;
  }, [requestKey]);

  useEffect(() => {
    let active = true;
    const cached = seasonalCatalogCache.get(requestKey) || null;
    setError('');
    setPendingArtworkId('');

    if (cached) {
      setCatalogRecord({ key: requestKey, data: cached });
      setLibraryLoading(false);
      return () => { active = false; };
    }

    setLibraryLoading(true);
    Promise.resolve(supabase.rpc('list_seasonal_artworks', { p_product: product.id, p_size: size, p_side: side }))
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) {
          setError('Seasonal designs could not load. Your garment workspace is still available.');
          return;
        }
        const nextCatalog = data || { artworks: [], area: null };
        seasonalCatalogCache.set(requestKey, nextCatalog);
        setCatalogRecord({ key: requestKey, data: nextCatalog });
      })
      .catch(() => {
        if (active) setError('Could not connect to the seasonal design library. Your garment workspace is still available.');
      })
      .finally(() => {
        if (active) setLibraryLoading(false);
      });
    return () => { active = false; };
  }, [product.id, size, side, requestKey, retryVersion]);

  const artworks = useMemo(() => (catalog?.artworks || []).filter((artwork) => !artwork.requires_name), [catalog]);
  const area = catalog?.area || null;

  useEffect(() => {
    artworks.slice(0, 12).forEach((artwork) => {
      preloadArtworkPreview(artwork.preview).catch(() => {});
    });
  }, [artworks]);

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

  const addArtwork = async (artwork) => {
    if (!catalog || !area || layersRef.current.length >= MAX_LAYERS || pendingArtworkId) return;
    const artworkId = String(artwork?.id || '');
    const selectionKey = requestKey;
    setPendingArtworkId(artworkId);
    setError('');

    try {
      await preloadArtworkPreview(artwork.preview);
      if (requestKeyRef.current !== selectionKey) return;
      const currentLayers = layersRef.current;
      if (currentLayers.length >= MAX_LAYERS) return;
      const initial = fitSeasonalArtwork(artwork, area, 0);
      if (!initial) throw new Error('Artwork does not fit the active print area.');
      const id = newLayerId();
      const next = [
        ...currentLayers,
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
    } catch {
      setError('That artwork could not load. Your current design was kept. Try again.');
    } finally {
      setPendingArtworkId((current) => current === artworkId ? '' : current);
    }
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

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,.75fr)_minmax(420px,1.4fr)_minmax(280px,.75fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Seasonal Library</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Choose artwork</h2>
          </div>
          <div className="flex items-center gap-2">
            {libraryBusy && <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500"><span className="h-2.5 w-2.5 animate-spin rounded-full border border-slate-300 border-t-slate-600" aria-hidden="true" />Loading</span>}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{layers.length}/{MAX_LAYERS}</span>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search designs" disabled={!catalog} className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400" />
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => setCategory('')} disabled={!catalog} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-bold disabled:opacity-40 ${!category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>All</button>
          {categories.map((value) => (
            <button key={value} type="button" onClick={() => setCategory(value)} disabled={!catalog} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-bold disabled:opacity-40 ${category === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{value}</button>
          ))}
        </div>

        {error && <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"><span>{error}</span>{!catalog && <button type="button" onClick={() => setRetryVersion((value) => value + 1)} className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-black text-red-700">Retry</button>}</div>}

        <div className="grid min-h-[220px] max-h-[min(520px,calc(100vh-420px))] grid-cols-2 content-start gap-3 overflow-y-auto overscroll-contain pb-3 pr-1">
          {libraryBusy && !catalog && <div className="col-span-2 grid min-h-[180px] place-items-center rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500"><span><span className="mx-auto mb-3 block h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" aria-hidden="true" />Loading seasonal designs…</span></div>}
          {filtered.map((artwork) => (
            <button key={artwork.id} type="button" onClick={() => addArtwork(artwork)} disabled={layers.length >= MAX_LAYERS || Boolean(pendingArtworkId) || libraryBusy || !catalog} aria-busy={String(pendingArtworkId) === String(artwork.id)} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-slate-400 disabled:opacity-40">
              <div className="relative aspect-square bg-white p-2"><img src={artwork.preview} alt={artwork.title} loading="lazy" decoding="async" className="h-full w-full object-contain" />{String(pendingArtworkId) === String(artwork.id) && <div className="absolute inset-0 grid place-items-center bg-white/80 text-[10px] font-black uppercase tracking-[.12em] text-slate-700">Preparing…</div>}</div>
              <div className="p-2.5"><div className="line-clamp-2 text-xs font-black text-slate-800">{artwork.title}</div></div>
            </button>
          ))}
          {!libraryBusy && !filtered.length && !error && <div className="col-span-2 rounded-2xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">No seasonal designs match this filter.</div>}
        </div>
      </section>

      <section data-gdp-seasonal-canvas-stable="true" className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Fabric workspace</p>
            <p className="text-sm font-bold text-slate-700">Drag to move · pinch or use the controls to resize and rotate</p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase text-slate-600 sm:inline">{side}</span>
        </div>

        <div className="mx-auto w-full rounded-[28px] bg-slate-100 p-3 sm:p-5" style={{ maxWidth: 'min(620px, max(300px, calc((100vh - 320px) * 0.8)))' }}>
          <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
            {garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className="absolute inset-0 h-full w-full object-contain opacity-95" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}
            <div data-gdp-print-guide="true" aria-label={`Recommended ${side} print area ${printGuide.label}`} className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-lg border-2 border-dashed border-white/80 bg-black/5 shadow-[0_0_0_1px_rgba(15,23,42,.15)]" style={printGuide.style}>
              <span className="pointer-events-none absolute right-1 top-1 z-50 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-white">{printGuide.label}</span>
              {area ? resolved.filter((entry) => entry.layer.visible !== false).map((entry) => (
                <ArtworkLayer key={entry.layer.id} entry={entry} area={area} active={entry.layer.id === activeLayerId} onSelect={onActiveLayerChange} onTransform={(id, patch) => patchLayer(id, patch)} />
              )) : null}
              {libraryBusy && !catalog ? <div className="absolute inset-0 grid place-items-center bg-white/20 p-4 text-center text-[10px] font-black uppercase tracking-[.08em] text-slate-500">Refreshing artwork library…</div> : !layers.length ? <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs font-bold text-slate-500">Add artwork from the library</div> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Layers</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">Arrange design</h2>
        </div>

        {libraryBusy && !catalog && layers.length ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Loading the controls for this print side. Your saved layers are being kept.</div>
        ) : activeEntry ? (
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
          disabled={!layers.length || !catalog || Boolean(pendingArtworkId)}
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
