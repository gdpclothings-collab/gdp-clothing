import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Edit3, Maximize2, Move, RotateCcw, Ruler, Search, Shirt, ShoppingBag, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { customerApi } from '@/lib/customerApi';
import { useCart } from '@/lib/CartContext';
import { fitSeasonalArtwork, seasonalSelection } from '@/lib/seasonalArtwork';

function uniqueText(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].join(' · ');
}

const canvasPng = (canvas) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create the seasonal production PNG.')), 'image/png'));
const digestSnapshot = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export function SeasonalOverlay({ artwork, layout, area, rotation = 0, editable = false, showSelection = true, onMove = undefined, onResize = undefined, onRotate = undefined }) {
  const action = useRef(null);
  if (!artwork || !layout || !area) return null;

  const point = (event) => ({ x: event.clientX, y: event.clientY });
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const deg = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const deltaAngle = (next, start) => {
    let value = next - start;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
  };

  const beginResize = (event) => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const wrapper = event.currentTarget.closest('[data-seasonal-artwork]');
    const rect = wrapper?.parentElement?.getBoundingClientRect();
    if (!rect) return;
    action.current = {
      mode: 'resize',
      pointerId: event.pointerId,
      startX: event.clientX,
      width: layout.width,
      rect,
    };
  };

  const beginCanvas = (event) => {
    if (!editable || (event.target instanceof Element && event.target.closest('[data-control]'))) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const current = point(event);
    let gesture = action.current;
    if (!gesture || gesture.mode !== 'gesture') {
      gesture = {
        mode: 'gesture',
        pointers: new Map(),
        rect,
        x: layout.x,
        y: layout.y,
        width: layout.width,
        rotation,
        startPoint: current,
        midpoint: current,
        distance: 0,
        angle: 0,
      };
      action.current = gesture;
    }
    gesture.pointers.set(event.pointerId, current);
    const points = [...gesture.pointers.values()];
    if (points.length >= 2) {
      gesture.x = layout.x;
      gesture.y = layout.y;
      gesture.width = layout.width;
      gesture.rotation = rotation;
      gesture.midpoint = mid(points[0], points[1]);
      gesture.distance = Math.max(1, dist(points[0], points[1]));
      gesture.angle = deg(points[0], points[1]);
    } else {
      gesture.startPoint = current;
      gesture.x = layout.x;
      gesture.y = layout.y;
    }
  };

  const move = (event) => {
    const start = action.current;
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    if (start.mode === 'resize') {
      onResize?.(start.width + (event.clientX - start.startX) / start.rect.width * area.width);
      return;
    }
    if (start.mode !== 'gesture' || !start.pointers?.has(event.pointerId)) return;
    start.pointers.set(event.pointerId, point(event));
    const points = [...start.pointers.values()];
    if (points.length >= 2) {
      const center = mid(points[0], points[1]);
      const scale = dist(points[0], points[1]) / Math.max(1, start.distance || 1);
      onMove?.({ x: start.x + (center.x - start.midpoint.x) / start.rect.width * area.width, y: start.y + (center.y - start.midpoint.y) / start.rect.height * area.height });
      onResize?.(start.width * scale);
      onRotate?.(((((start.rotation + deltaAngle(deg(points[0], points[1]), start.angle)) + 180) % 360 + 360) % 360) - 180);
    } else if (points.length === 1) {
      onMove?.({ x: start.x + (points[0].x - start.startPoint.x) / start.rect.width * area.width, y: start.y + (points[0].y - start.startPoint.y) / start.rect.height * area.height });
    }
  };

  const stop = (event) => {
    const start = action.current;
    if (!start) return;
    if (start.mode === 'gesture' && start.pointers?.has(event.pointerId)) {
      start.pointers.delete(event.pointerId);
      if (start.pointers.size) {
        const remaining = [...start.pointers.values()][0];
        start.startPoint = remaining;
        start.midpoint = remaining;
        start.x = layout.x;
        start.y = layout.y;
        start.width = layout.width;
        start.rotation = rotation;
        return;
      }
    }
    action.current = null;
  };

  return (
    <div
      data-seasonal-artwork="true"
      onPointerDown={beginCanvas}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      className={'absolute touch-none select-none ' + (editable ? 'cursor-move ' : 'pointer-events-none ') + (editable && showSelection ? 'ring-1 ring-white shadow-[0_0_0_1px_rgba(217,39,62,.92),0_0_28px_rgba(217,39,62,.16)]' : '')}
      style={{ left: `${layout.x / area.width * 100}%`, top: `${layout.y / area.height * 100}%`, width: `${layout.width / area.width * 100}%`, height: `${layout.height / area.height * 100}%`, transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}
    >
      <img src={artwork.preview} alt={artwork.title} draggable="false" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
      {editable && showSelection && <button data-control type="button" onPointerDown={beginResize} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} className="absolute -bottom-3 -right-3 z-20 grid h-8 w-8 touch-none place-items-center rounded-full border-2 border-white bg-[#D9273E] text-white shadow-[0_5px_16px_rgba(0,0,0,.22)]" aria-label="Resize artwork"><Maximize2 size={13} /></button>}
    </div>
  );
}

function ReviewDetail({ label, value, swatch = null }) {
  return <div className="rounded-2xl border border-[#E3E8ED] bg-[#F7F9FB] p-3.5"><div className="text-[10px] font-bold uppercase tracking-[.12em] text-[#71808D]">{label}</div><div className="mt-1.5 flex min-w-0 items-center gap-2 text-sm font-semibold text-[#17324D]">{swatch && <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,.35)]" style={{ backgroundColor: swatch }} />}<span className="min-w-0 break-words">{value}</span></div></div>;
}

function LoadingStudio({ Preview, garment, color, size, previewConfig }) {
  return (
    <section role="status" aria-label="Loading seasonal designs" className="grid animate-pulse items-start gap-4 xl:grid-cols-[minmax(300px,.78fr)_minmax(520px,1.3fr)_minmax(285px,.72fr)] xl:gap-5">
      <div className="rounded-3xl border border-[#DCE3EA] bg-white/85 p-5"><div className="h-3 w-24 rounded bg-slate-200" /><div className="mt-3 h-7 w-44 rounded bg-slate-200" /><div className="mt-5 grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 rounded-2xl bg-slate-100" />)}</div></div>
      <div className="rounded-3xl border border-[#CDD7E0] bg-white p-3 shadow-[0_24px_60px_rgba(23,50,77,.08)] xl:sticky xl:top-4"><div className="mb-3 h-10 rounded-xl bg-slate-100" /><div className="gdp-seasonal-preview-frame overflow-hidden rounded-2xl border border-[#D5DEE6] bg-[#DCE4E9]"><Preview garment={garment} color={color} side="front" placement="front" size={size} previewConfig={previewConfig || {}} zoom={1} artworkScale={100} artworkRotation={0} artworkOffset={{ x: 0, y: 0 }} showGuides={false} showMeasurements={false} /></div><p className="px-2 pb-1 pt-3 text-center text-xs font-medium text-[#61717F]">Restoring your garment while the artwork library loads…</p></div>
      <div className="space-y-4 rounded-3xl border border-[#DCE3EA] bg-white/85 p-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 rounded-2xl bg-slate-100" />)}</div>
    </section>
  );
}

export default function SeasonalStudio({ product, garment, color, size, variant, quantity, unitPrice, Preview, onBack, catalog: garmentCatalog = [], availableColors = [], availableSizes = [], onProductChange, onColorChange, onSizeChange, colorSwatch, priceVisibility = 'hidden', initialDraft = null, editCartKey = '' }) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(24);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [requested, setRequested] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [showGarmentOptions, setShowGarmentOptions] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1.18);
  const [reviewMode, setReviewMode] = useState(false);
  const [approved, setApproved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const approvedPreviewRef = useRef(null);
  const previewSectionRef = useRef(null);
  const controlsSectionRef = useRef(null);
  const reviewErrorRef = useRef(null);
  const saveLock = useRef(false);
  const saveRequestId = useRef('');
  const navigate = useNavigate();
  const { addItem, replaceItem } = useCart();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    let active = true;
    setCatalog(null);
    setError('');
    Promise.resolve(supabase.rpc('list_seasonal_artworks', { p_product: product.id, p_size: size })).then(({ data, error: failure }) => {
      if (!active) return;
      if (failure) setError('Seasonal designs could not load. Try again or use another design option.');
      else setCatalog(data);
    }).catch(() => { if (active) setError('Could not connect to the design library.'); });
    return () => { active = false; };
  }, [product.id, size]);

  const allArtworks = catalog?.artworks || [];
  const artworks = allArtworks.filter((artwork) => !artwork.requires_name);
  const area = catalog?.area;
  const layout = fitSeasonalArtwork(selected, area, requested, position.x, position.y);
  const categories = [...new Set(artworks.map((artwork) => artwork.category))].filter(Boolean).sort();
  const visibleCategories = categories.filter((value) => value.toLowerCase().includes(categoryQuery.trim().toLowerCase()));
  const visible = artworks.filter((artwork) => (!category || category === artwork.category) && [artwork.title, artwork.category, ...(artwork.tags || [])].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const visibleArtworks = visible.slice(0, visibleLimit);
  const studioStage = !selected ? 1 : reviewMode ? 3 : 2;
  const fabricDescription = uniqueText([product?.metafields?.fabric_blend, product?.metafields?.fabric_weight, product?.fabric, product?.material, garment?.fabric]);
  const colorValue = colorSwatch?.(color) || color;
  const designSubtotal = Number(unitPrice || 0) * Number(quantity || 1);

  useEffect(() => { setVisibleLimit(24); }, [category, query]);
  useEffect(() => { setApproved(false); setReviewMode(false); }, [product.id, color, size]);
  useEffect(() => { saveRequestId.current = ''; }, [product.id, color, size, selected?.id, requested, position.x, position.y, rotation]);

  useEffect(() => {
    if (!catalog || !selected) return;
    const current = artworks.find((item) => item.id === selected.id);
    if (!current) {
      setSelected(null);
      setApproved(false);
    } else if (current !== selected) setSelected(current);
  }, [catalog]);

  useEffect(() => {
    if (!catalog || !initialDraft?.artworkId || selected) return;
    const artwork = artworks.find((item) => item.id === initialDraft.artworkId);
    if (!artwork) return;
    setSelected(artwork);
    setRequested(Number(initialDraft.width || 0));
    setPosition(initialDraft.position || { x: 0, y: 0 });
    setRotation(Number(initialDraft.rotation || 0));
    setCategory(initialDraft.category || '');
  }, [catalog, initialDraft?.artworkId]);

  const choose = (artwork) => {
    const initial = fitSeasonalArtwork(artwork, area, 0);
    setSelected(artwork);
    setRequested(0);
    setPosition({ x: initial ? (area.width - initial.width) / 2 : 0, y: 0 });
    setRotation(0);
    setApproved(false);
    setReviewMode(false);
    setError('');
    window.setTimeout(() => previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const updatePosition = (next) => {
    if (!layout || !area) return;
    setPosition({ x: Math.max(0, Math.min(next.x, area.width - layout.width)), y: Math.max(0, Math.min(next.y, area.height - layout.height)) });
    setApproved(false);
    setReviewMode(false);
  };

  const resetArtwork = () => {
    const initial = fitSeasonalArtwork(selected, area, 0);
    setRequested(0);
    setPosition({ x: initial ? (area.width - initial.width) / 2 : 0, y: 0 });
    setRotation(0);
    setApproved(false);
    setReviewMode(false);
  };

  const save = async () => {
    if (!selected || !layout || !approved || saving || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    try {
      const configuration = seasonalSelection(selected, layout, {}, area, rotation);
      const requestId = saveRequestId.current || crypto.randomUUID();
      saveRequestId.current = requestId;
      setCapturing(true);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await document.fonts?.ready;
      const { default: html2canvas } = await import('html2canvas');
      const printElement = document.getElementById('gdp-seasonal-production');
      if (!printElement || !approvedPreviewRef.current) throw new Error('The approved seasonal preview is not ready. Please try again.');
      const printRect = printElement.getBoundingClientRect();
      const previewRect = approvedPreviewRef.current.getBoundingClientRect();
      const printCanvas = await html2canvas(printElement, { backgroundColor: null, scale: Math.max(1, Number(area.width) * 300 / printRect.width), useCORS: true, logging: false, imageTimeout: 15000 });
      const mockupCanvas = await html2canvas(approvedPreviewRef.current, { backgroundColor: '#f3eee6', scale: Math.max(1, 900 / previewRect.width), useCORS: true, logging: false, imageTimeout: 15000, width: previewRect.width, height: previewRect.height, scrollX: 0, scrollY: 0 });
      const approvedAt = new Date().toISOString();
      const renderSnapshot = { version: 3, designPath: 'seasonal', artworkId: selected.id, configuration, garment: { id: product.id, variantId: variant?.id || null, color, size } };
      const lockedHash = await digestSnapshot(renderSnapshot);
      const [productionUpload, mockupUpload] = await Promise.all([
        customerApi.uploadArtwork(new File([await canvasPng(printCanvas)], `gdp-${lockedHash.slice(0, 12)}-front-300dpi.png`, { type: 'image/png' })),
        customerApi.uploadArtwork(new File([await canvasPng(mockupCanvas)], `gdp-${lockedHash.slice(0, 12)}-approved-mockup.png`, { type: 'image/png' })),
      ]);
      setCapturing(false);
      const design = await customerApi.createCustomDesign({
        productId: product.id,
        productName: product.name,
        name: selected.title,
        designStyle: `Seasonal: ${selected.title}`,
        occasion: selected.category,
        designMood: 'Original artwork',
        designIntensity: 1,
        color,
        size,
        placement: 'front',
        photoAssets: [],
        personalization: {},
        seasonalArtworkId: selected.id,
        seasonalConfiguration: { ...configuration, client_request_id: requestId },
        designPath: 'seasonal',
        renderSnapshot,
        productionFiles: { front: { path: productionUpload.storage_path, widthPx: printCanvas.width, heightPx: printCanvas.height, widthIn: Number(area.width), heightIn: Number(area.height), dpi: 300, mimeType: 'image/png' } },
        customerMockupPath: mockupUpload.storage_path,
        renderStatus: 'locked',
        lockedHash,
        customerApprovedAt: approvedAt,
        preflight: { version: 1, status: 'passed', checkedAt: approvedAt, expectedSides: ['front'], dpi: 300 },
        customerConfirmedRights: true,
        approvalPolicyAcknowledged: approved,
        proofRequired: false,
        status: 'in_cart',
        priority: 'standard',
      });
      const seasonalSummary = {
        artwork: selected.title,
        collection: selected.category,
        printSide: 'Front',
        dimensions: `${layout.width.toFixed(2)} × ${layout.height.toFixed(2)} in`,
        width: Number(layout.width),
        height: Number(layout.height),
        rotation: Math.round(rotation),
        position: { x: Number(layout.x), y: Number(layout.y) },
        garment: garment.label || product.name,
        color,
        size,
      };
      const cartItem = {
        productId: product.id,
        name: product.name,
        image: mockupUpload.file_url,
        isCustom: true,
        customDesignId: design.id,
        ...(design.guestDesignToken ? { guestDesignToken: design.guestDesignToken } : {}),
        variantId: variant?.id || null,
        variant: variant?.name || garment.label,
        color,
        size,
        quantity,
        price: unitPrice,
        placement: 'front',
        fulfillmentMode: product.fulfillmentMode || 'in_house',
        designStyle: `Seasonal: ${selected.title}`,
        occasion: selected.category,
        proofRequired: false,
        renderStatus: 'locked',
        ...(fabricDescription ? { fabric: fabricDescription } : {}),
        seasonalSummary,
        seasonalDraft: {
          artworkId: selected.id,
          artworkTitle: selected.title,
          width: layout.width,
          height: layout.height,
          position: { x: layout.x, y: layout.y },
          rotation,
          category: selected.category,
          printSide: 'front',
        },
      };
      if (editCartKey) replaceItem(editCartKey, cartItem);
      else addItem(cartItem);
      navigate('/cart');
    } catch (failure) {
      setError(failure.message || 'Could not save this design. Please try again.');
      window.setTimeout(() => reviewErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } finally {
      setCapturing(false);
      setSaving(false);
      saveLock.current = false;
    }
  };

  const previewConfig = area ? {
    ...product.customization?.preview,
    printGuide: {
      ...product.customization?.preview?.printGuide,
      front: {
        ...product.customization?.preview?.printGuide?.front,
        widthIn: Number(area.width),
        heightIn: Number(area.height),
        maxWidthIn: Number(area.width),
        maxHeightIn: Number(area.height),
        sizeScalingEnabled: false,
      },
    },
  } : product.customization?.preview;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#F4F7FA_0%,#EDF2F6_45%,#F8FAFC_100%)] px-3 py-3 sm:px-4 sm:py-6 lg:px-8 lg:py-9">
      <div className="mx-auto min-w-0 max-w-[1580px]">
        <header className="relative mb-3 overflow-hidden rounded-2xl border border-[#DCE3EA] bg-[linear-gradient(135deg,#FFFFFF_0%,#F4EDE3_100%)] px-4 py-3 shadow-[0_20px_60px_rgba(32,28,22,.07)] sm:mb-6 sm:rounded-[28px] sm:px-5 sm:py-6 md:px-8 md:py-8">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><button type="button" onClick={onBack} className="mb-1 text-xs font-semibold text-[#667788] hover:text-[#17324D] sm:mb-3">← Design options</button><p className="hidden font-mono text-[10px] uppercase tracking-[.26em] text-[#A66331] sm:block">GDP Custom Studio</p><h1 className="mt-1 font-display text-3xl leading-none text-[#17324D] sm:mt-2 sm:text-4xl md:text-5xl">SEASONAL DESIGN LAB</h1><p className="mt-3 hidden max-w-2xl text-sm leading-relaxed text-[#66717C] sm:block">Choose a seasonal artwork, position it on your garment, and approve the exact print-ready preview.</p></div>
            <div className="hidden items-center gap-2 self-start rounded-full border border-[#DCE3EA] bg-white/80 px-4 py-2 text-xs font-semibold text-[#52616F] shadow-sm sm:flex"><Check size={15} className="text-emerald-600" /> Your approved preview is the print result</div>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#DCE3EA] bg-white/75 p-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#7B8793] shadow-sm">{['Browse artwork', 'Customize', 'Review'].map((label, index) => <div key={label} className={`rounded-xl px-2 py-2.5 transition sm:px-3 ${studioStage === index + 1 ? 'bg-[#17324D] text-white shadow-sm' : studioStage > index + 1 ? 'text-emerald-700' : 'text-[#7B8793]'}`}>{studioStage > index + 1 ? <Check size={12} className="mr-1 inline" /> : null}{index + 1} · {label}</div>)}</div>

        {error && !reviewMode && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
        {!catalog && !error && <LoadingStudio Preview={Preview} garment={garment} color={color} size={size} previewConfig={product.customization?.preview} />}

        {catalog && artworks.length === 0 && <div className="rounded-2xl border border-[#DCE3EA] bg-white p-6"><h2 className="font-semibold">Artwork-only seasonal designs are being prepared</h2><p className="mt-2">Seasonal designs that do not require added names or messages will appear here once approved for printing.</p><button onClick={onBack} className="mt-4 underline">Choose another design option</button></div>}

        {reviewMode && selected && layout && (
          <section aria-label="Review seasonal design" className="mx-auto max-w-[1320px] rounded-3xl border border-[#CDD7E0] bg-white p-4 shadow-[0_24px_70px_rgba(23,50,77,.12)] sm:p-6 lg:p-7">
            <div className="mb-5 flex items-start justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[.18em] text-[#A66331]">Final review</p><h2 className="mt-1 font-display text-3xl text-[#17324D] sm:text-4xl">CHECK EVERY DETAIL</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#66717C]">This exact garment preview becomes the locked customer mockup. Artwork dimensions, rotation and placement are saved with the production file.</p></div><button type="button" onClick={() => setReviewMode(false)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#DCE3EA] px-3 text-sm font-bold text-[#52616F] hover:bg-[#F7F9FB]"><Edit3 size={15} /> Edit</button></div>
            {error && <div ref={reviewErrorRef} role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}<span className="mt-1 block text-xs font-normal">Your design is preserved. Use Retry add to cart below.</span></div>}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,.7fr)] xl:gap-8">
              <div><div ref={approvedPreviewRef} className="gdp-seasonal-preview-frame relative aspect-[4/5] overflow-hidden rounded-2xl border border-[#D5DEE6] bg-[#F3EEE6] shadow-inner"><div className="absolute inset-0 h-full w-full [&>*]:h-full [&>*]:w-full"><Preview garment={garment} color={color} side="front" placement="front" size={size} previewConfig={previewConfig || {}} zoom={1} artworkScale={100} artworkRotation={0} artworkOffset={{ x: 0, y: 0 }} showGuides={false} showMeasurements={false} printAreaId="gdp-seasonal-production" seasonalOverlay={<SeasonalOverlay artwork={selected} layout={layout} area={area} rotation={rotation} />} /></div></div><div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><Check size={14} /> Exact approved customer mockup · Front print</div></div>
              <div className="flex flex-col gap-4">
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-2"><ReviewDetail label="Garment" value={garment.label || product.name} />{fabricDescription && <ReviewDetail label="Fabric" value={fabricDescription} />}<ReviewDetail label="Colour" value={color} swatch={colorValue} /><ReviewDetail label="Size" value={size} /><ReviewDetail label="Print side" value="Front" /><ReviewDetail label="Artwork" value={selected.title} /><ReviewDetail label="Print dimensions" value={`${layout.width.toFixed(2)} × ${layout.height.toFixed(2)} in`} /><ReviewDetail label="Rotation" value={`${Math.round(rotation)}°`} /><ReviewDetail label="Position" value={`${layout.x.toFixed(2)} in from left · ${layout.y.toFixed(2)} in from top`} /></div>
                <div className="rounded-2xl border border-[#DCE3EA] bg-[#17324D] p-4 text-white"><div className="flex items-center justify-between gap-4 text-sm"><span className="text-white/75">Quantity</span><strong>{quantity}</strong></div><div className="mt-2 flex items-center justify-between gap-4 text-sm"><span className="text-white/75">Price each</span><strong>${Number(unitPrice || 0).toFixed(2)} CAD</strong></div><div className="mt-3 flex items-end justify-between gap-4 border-t border-white/20 pt-3"><span className="font-bold">Design total</span><strong className="font-mono text-xl">${designSubtotal.toFixed(2)} CAD</strong></div><p className="mt-2 text-[11px] leading-relaxed text-white/75">Shipping and taxes are calculated at checkout.</p></div>
                <button type="button" onClick={() => setReviewMode(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCE3EA] px-4 text-sm font-bold text-[#52616F] hover:bg-[#F7F9FB]"><Edit3 size={15} /> Edit design</button>
                <button disabled={saving} onClick={save} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#17324D] px-6 py-3.5 font-bold text-white shadow-lg transition hover:bg-[#234766] disabled:opacity-40"><ShoppingBag size={17} />{saving ? (editCartKey ? 'Updating cart…' : 'Adding to cart…') : (error ? 'Retry add to cart' : editCartKey ? 'Update cart' : 'Add design to cart')}</button>
              </div>
            </div>
          </section>
        )}

        {artworks.length > 0 && !reviewMode && (
          <div className="grid min-w-0 w-full items-start gap-4 xl:grid-cols-[minmax(300px,.78fr)_minmax(560px,1.42fr)_minmax(300px,.68fr)] xl:gap-5">
            <section aria-label="Choose seasonal artwork" className="order-1 min-w-0 w-full rounded-3xl border border-[#DCE3EA] bg-white/90 p-4 shadow-[0_14px_40px_rgba(23,50,77,.07)] lg:p-5 xl:sticky xl:top-4 xl:flex xl:max-h-[calc(100dvh-2rem)] xl:flex-col xl:overflow-hidden">
              <div className="xl:shrink-0"><div className="mb-4"><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#A66331]">Artwork library</p><h2 className="mt-1 text-xl font-bold text-[#17324D]">{selected ? 'Switch your artwork' : 'Find your design'}</h2>{selected && <p className="mt-1 text-xs leading-relaxed text-[#6F7D89]">Choose another design without leaving the editor. Your garment choices stay in place.</p>}</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><div className="text-[10px] font-bold uppercase tracking-wide text-[#697784] sm:hidden">Season or holiday<button type="button" onClick={() => setCategorySheetOpen(true)} className="mt-1 flex min-h-11 w-full items-center justify-between rounded-xl border border-[#DCE3EA] bg-white px-3 py-2.5 text-left text-sm font-normal normal-case text-[#273B4E]"><span>{category || 'All collections'}</span><ChevronDown size={16} /></button></div><label className="hidden text-[10px] font-bold uppercase tracking-wide text-[#697784] sm:block">Season or holiday<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#DCE3EA] bg-white p-2.5 text-sm font-normal normal-case"><option value="">All collections</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-[10px] font-bold uppercase tracking-wide text-[#697784]">Search designs<div className="relative mt-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A96A1]" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search artwork" className="block w-full rounded-xl border border-[#DCE3EA] bg-white py-2.5 pl-9 pr-3 text-sm font-normal normal-case" /></div></label></div><p role="status" className="my-3 text-xs text-[#667684]">Showing {visibleArtworks.length} of {visible.length} matching designs</p></div>
              {!visible.length && <p className="rounded-xl bg-[#F7F9FB] p-4 text-sm text-[#52616F]">No designs match. Try another collection or search.</p>}
              <div className="flex max-w-full snap-x gap-3 overflow-x-auto overscroll-x-contain pb-2 pr-1 xl:min-h-0 xl:flex-1 xl:grid-cols-2 xl:grid xl:content-start xl:overflow-y-auto xl:overflow-x-hidden xl:pr-2">{visibleArtworks.map((artwork) => <button type="button" key={artwork.id} aria-pressed={selected?.id === artwork.id} onClick={() => choose(artwork)} className={`group w-36 shrink-0 snap-start rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md xl:w-auto ${selected?.id === artwork.id ? 'border-[#17324D] bg-[#EEF3F7] ring-2 ring-[#17324D]/15' : 'border-[#E1E6EB] bg-white'}`}><div className="relative overflow-hidden rounded-xl bg-[linear-gradient(45deg,#f0ede8_25%,transparent_25%),linear-gradient(-45deg,#f0ede8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0ede8_75%),linear-gradient(-45deg,transparent_75%,#f0ede8_75%)] bg-[length:14px_14px]"><img src={artwork.preview} alt={artwork.title} loading="lazy" decoding="async" className="h-28 w-full object-contain transition group-hover:scale-105" />{selected?.id === artwork.id && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#17324D] text-white"><Check size={13} /></span>}</div><span className="mt-2 block text-xs font-bold text-[#273B4E]">{artwork.title}</span><span className="text-[9px] uppercase tracking-wide text-[#71808D]">{artwork.category}</span></button>)}</div>
              {visibleLimit < visible.length && <button type="button" onClick={() => setVisibleLimit((value) => value + 24)} className="mt-3 hidden min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#DCE3EA] bg-white px-4 text-xs font-bold text-[#17324D] hover:bg-[#F7F9FB] xl:flex">Load 24 more</button>}
            </section>

            <section ref={previewSectionRef} aria-label="Garment preview" className="order-2 min-w-0 w-full scroll-mt-20 xl:sticky xl:top-4">
              <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[#DCE3EA] bg-white p-3 shadow-sm xl:hidden"><button type="button" onClick={onBack} className="inline-flex min-h-11 items-center rounded-xl border border-[#DCE3EA] px-4 text-xs font-bold uppercase text-[#17324D]">Previous</button><button type="button" disabled={!selected} onClick={() => controlsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex min-h-11 items-center rounded-xl bg-[#17324D] px-5 text-xs font-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-40">Continue</button></div>
              {!selected && <p className="-mt-1 mb-3 text-right text-[11px] font-medium text-[#8A5A48] xl:hidden">Choose an artwork to continue.</p>}
              <div className="overflow-hidden rounded-3xl border border-[#CDD7E0] bg-white p-3 shadow-[0_24px_60px_rgba(23,50,77,.12)]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#A66331]">Live garment preview</p><p className="mt-0.5 text-sm font-bold text-[#17324D]">{garment.label} · {color} · {size}</p></div><div className="flex flex-wrap items-center justify-end gap-1.5"><div className="inline-flex min-h-10 items-center rounded-xl border border-[#DCE3EA] bg-[#F7F9FB] p-1" aria-label="Garment view size controls"><button type="button" onClick={() => setPreviewZoom((value) => Math.max(.75, Number((value - .1).toFixed(2))))} className="grid h-8 w-8 place-items-center rounded-lg text-[#607080] transition hover:bg-white hover:text-[#17324D]" aria-label="Make garment view smaller"><ZoomOut size={14} /></button><span className="w-11 text-center font-mono text-[9px] font-bold tabular-nums text-[#52616F]">{Math.round(previewZoom * 100)}%</span><button type="button" onClick={() => setPreviewZoom((value) => Math.min(1.8, Number((value + .1).toFixed(2))))} className="grid h-8 w-8 place-items-center rounded-lg text-[#607080] transition hover:bg-white hover:text-[#17324D]" aria-label="Make garment view larger"><ZoomIn size={14} /></button><button type="button" onClick={() => setPreviewZoom(1)} className="ml-1 h-8 rounded-lg border-l border-[#DCE3EA] px-2 text-[8px] font-bold uppercase tracking-wide text-[#607080] hover:bg-white hover:text-[#17324D]">Fit</button><button type="button" onClick={() => setPreviewZoom(1.18)} className="h-8 rounded-lg px-2 text-[8px] font-bold uppercase tracking-wide text-[#607080] hover:bg-white hover:text-[#17324D]">Default</button></div><button type="button" aria-pressed={showGuides} onClick={() => setShowGuides((value) => !value)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${showGuides ? 'border-[#17324D] bg-[#17324D] text-white' : 'border-[#DCE3EA] bg-white text-[#607080]'}`}><Maximize2 size={14} /> Print area {showGuides ? 'on' : 'off'}</button><button type="button" aria-pressed={showMeasurements} onClick={() => setShowMeasurements((value) => !value)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold ${showMeasurements ? 'border-[#A66331] bg-[#A66331] text-white' : 'border-[#DCE3EA] bg-white text-[#607080]'}`}><Ruler size={14} /> Measurements {showMeasurements ? 'on' : 'off'}</button></div></div>
                <div className="gdp-seasonal-preview-frame overflow-hidden rounded-2xl border border-[#D5DEE6] bg-[#DCE4E9]"><Preview garment={garment} color={color} side="front" placement="front" size={size} previewConfig={previewConfig || {}} zoom={capturing ? 1 : previewZoom} artworkScale={100} artworkRotation={0} artworkOffset={{ x: 0, y: 0 }} showGuides={capturing ? false : showGuides} showMeasurements={capturing ? false : showMeasurements} printAreaId="gdp-seasonal-production" seasonalOverlay={<SeasonalOverlay artwork={selected} layout={layout} area={area} rotation={rotation} editable={!capturing} showSelection={!capturing} onMove={updatePosition} onResize={(value) => { setRequested(value); setApproved(false); setReviewMode(false); }} onRotate={(value) => { setRotation(value); setApproved(false); setReviewMode(false); }} />} /></div>
                <p className="px-2 pb-1 pt-3 text-center text-xs text-[#61717F]"><Move size={12} className="mr-1 inline" /> Drag artwork to move · use the red corner to resize · pinch and twist on touch. Garment zoom only changes your editing view, not print size.</p>
              </div>
            </section>

            <section ref={controlsSectionRef} aria-label="Garment and artwork controls" className="order-3 min-w-0 w-full scroll-mt-20 space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
              <div className="rounded-3xl border border-[#DCE3EA] bg-white/90 p-4 shadow-[0_14px_40px_rgba(23,50,77,.07)]"><button type="button" onClick={() => setShowGarmentOptions((value) => !value)} className="flex w-full items-center justify-between text-left"><span><span className="font-mono text-[9px] uppercase tracking-[.18em] text-[#A66331]">Your blank</span><span className="mt-1 block text-sm font-bold text-[#17324D]">Change garment, fabric, color or size</span>{fabricDescription && <span className="mt-1 block text-[10px] text-[#667684]">{fabricDescription}</span>}</span><ChevronDown size={18} className={`transition ${showGarmentOptions ? 'rotate-180' : ''}`} /></button>{showGarmentOptions && <div className="mt-4 space-y-4 border-t border-[#E5E9ED] pt-4"><label className="block text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Garment & fabric<select value={product.id} onChange={(event) => onProductChange?.(garmentCatalog.find((item) => String(item.id) === event.target.value))} className="mt-1 block w-full rounded-xl border border-[#DCE3EA] bg-white p-2.5 text-sm normal-case">{garmentCatalog.map((item) => { const fabric = uniqueText([item?.metafields?.fabric_blend, item?.metafields?.fabric_weight, item?.fabric, item?.material]); return <option key={item.id} value={item.id}>{item.name}{fabric ? ` — ${fabric}` : ''}</option>; })}</select></label><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Color · {color}</p><div className="mt-2 flex flex-wrap gap-2">{availableColors.map((value) => { const active = color === value; return <button key={value} type="button" onClick={() => onColorChange?.(value)} title={value} aria-label={`Choose ${value}`} aria-pressed={active} className={`relative grid h-10 w-10 place-items-center rounded-full border-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,.75),0_0_0_1px_rgba(15,23,42,.65)] transition ${active ? 'border-[#17324D] ring-2 ring-[#17324D]/25 ring-offset-2' : 'border-transparent hover:ring-2 hover:ring-[#17324D]/25 hover:ring-offset-1'}`} style={{ backgroundColor: colorSwatch?.(value) || value }}>{active && <Check size={15} className="rounded-full bg-white/90 p-0.5 text-[#17324D] shadow" />}</button>; })}</div><p className="mt-2 text-[10px] text-[#667684]">Only colors currently available for this garment are shown.</p></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Size · {size}</p><div className="mt-2 flex flex-wrap gap-2">{availableSizes.map((value) => <button key={value} type="button" onClick={() => onSizeChange?.(value)} aria-pressed={size === value} className={`min-w-11 rounded-xl border px-3 py-2.5 text-xs font-bold ${size === value ? 'border-[#17324D] bg-[#17324D] text-white' : 'border-[#DCE3EA] bg-white text-[#52616F] hover:border-[#17324D]/50'}`}>{value}</button>)}</div></div><p className="rounded-xl bg-[#F3F6F8] p-2.5 text-[10px] leading-relaxed text-[#5D6D7A]">Your artwork remains selected when the new blank supports it and is safely fitted inside the new print area.</p></div>}</div>

              {selected && layout ? <div className="space-y-4 rounded-3xl border border-[#DCE3EA] bg-white/90 p-4 shadow-[0_14px_40px_rgba(23,50,77,.07)]"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#A66331]">Selected artwork</p><h2 className="mt-1 font-bold text-[#17324D]">{selected.title}</h2><p className="mt-1 text-[10px] uppercase tracking-wide text-[#71808D]">{selected.category}</p></div><button type="button" onClick={() => { setSelected(null); setApproved(false); setReviewMode(false); }} className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50" aria-label="Delete artwork"><Trash2 size={15} /></button></div><label className="block text-xs font-semibold text-[#52616F]">Size · {layout.width.toFixed(2)} × {layout.height.toFixed(2)} in<input aria-label="Artwork width" type="range" min={Math.min(0.5, layout.maxWidth)} max={layout.maxWidth} step="0.01" value={layout.width} onChange={(event) => { setRequested(Number(event.target.value)); setApproved(false); }} className="mt-2 w-full accent-[#A66331]" /></label><label className="block text-xs font-semibold text-[#52616F]">Rotation · {Math.round(rotation)}°<input aria-label="Artwork rotation" type="range" min="-180" max="180" step="1" value={rotation} onChange={(event) => { setRotation(Number(event.target.value)); setApproved(false); }} className="mt-2 w-full accent-[#A66331]" /></label><div className="grid grid-cols-2 gap-2"><button type="button" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DCE3EA] px-3 py-2.5 text-xs font-bold text-[#52616F]" onClick={() => updatePosition({ x: (area.width - layout.width) / 2, y: (area.height - layout.height) / 2 })}><Move size={14} /> Center</button><button type="button" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DCE3EA] px-3 py-2.5 text-xs font-bold text-[#52616F]" onClick={resetArtwork}><RotateCcw size={14} /> Reset</button></div><div className="rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] p-3 text-[10px] leading-relaxed text-[#61717F]">Seasonal Design Lab uses the selected artwork only. No added name, message or customer text is applied.</div>{priceVisibility !== 'hidden' && <p className="rounded-xl bg-[#F3F6F8] p-3 text-xs text-[#52616F]">Front print · ${Number(unitPrice).toFixed(2)} CAD each{priceVisibility === 'total' && ` · $${designSubtotal.toFixed(2)} CAD total`} before shipping and tax.</p>}<label className="flex items-start gap-2 text-sm leading-relaxed text-[#46596A]"><input type="checkbox" checked={approved} onChange={(event) => { setApproved(event.target.checked); setReviewMode(false); if (event.target.checked) { setShowGuides(false); setShowMeasurements(false); } }} className="mt-1" /><span>I approve the exact garment preview, artwork size, rotation and placement. I understand this result will be locked and printed after successful payment.</span></label><button disabled={!approved} onClick={() => { setShowGuides(false); setShowMeasurements(false); setReviewMode(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full rounded-xl bg-[#17324D] px-6 py-3.5 font-bold text-white shadow-lg transition hover:bg-[#234766] disabled:opacity-40">Review design</button></div> : <div className="rounded-3xl border border-dashed border-[#C9D3DC] bg-white/65 p-6 text-center"><Shirt className="mx-auto text-[#9AA7B2]" /><p className="mt-3 text-sm font-bold text-[#17324D]">Choose an artwork to begin</p><p className="mt-1 text-xs text-[#61717F]">Your artwork controls will appear here.</p></div>}
            </section>
          </div>
        )}

        {categorySheetOpen && <div className="fixed inset-0 z-[110] flex items-end bg-black/50 sm:hidden" role="dialog" aria-modal="true" aria-label="Choose season or holiday"><button type="button" className="absolute inset-0" onClick={() => setCategorySheetOpen(false)} aria-label="Close season selector" /><div className="relative z-10 max-h-[78dvh] w-full overflow-hidden rounded-t-[28px] border border-[#DCE3EA] bg-[#F8FAFC] shadow-2xl"><div className="flex items-center justify-between border-b border-[#DCE3EA] px-4 py-4"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#A66331]">Artwork collections</p><h3 className="mt-1 text-lg font-bold text-[#17324D]">Season or holiday</h3></div><button type="button" onClick={() => setCategorySheetOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#DCE3EA] bg-white text-[#52616F]" aria-label="Close"><X size={17} /></button></div><div className="p-4"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A96A1]" /><input autoFocus type="search" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Search collections" className="w-full rounded-xl border border-[#DCE3EA] bg-white py-3 pl-10 pr-3 text-sm" /></div><div className="mt-3 max-h-[52dvh] space-y-2 overflow-y-auto pb-[max(12px,env(safe-area-inset-bottom))]"><button type="button" onClick={() => { setCategory(''); setCategorySheetOpen(false); setCategoryQuery(''); }} className={'flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold ' + (!category ? 'border-[#17324D] bg-[#EEF3F7] text-[#17324D]' : 'border-[#DCE3EA] bg-white text-[#52616F]')}><span>All collections</span>{!category && <Check size={16} />}</button>{visibleCategories.map((value) => <button key={value} type="button" onClick={() => { setCategory(value); setCategorySheetOpen(false); setCategoryQuery(''); }} className={'flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold ' + (category === value ? 'border-[#17324D] bg-[#EEF3F7] text-[#17324D]' : 'border-[#DCE3EA] bg-white text-[#52616F]')}><span>{value}</span>{category === value && <Check size={16} />}</button>)}{!visibleCategories.length && <p className="py-6 text-center text-sm text-[#61717F]">No matching collections.</p>}</div></div></div></div>}
      </div>
    </main>
  );
}
