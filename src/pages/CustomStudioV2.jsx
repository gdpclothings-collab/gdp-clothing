import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Heart, ImageUp, Loader2, RotateCcw, ShieldCheck, Sparkles, Star } from 'lucide-react';
import SeasonalEditorV2 from '@/components/storefront/custom-studio-v2/SeasonalEditorV2';
import ProtectedTemplateEditorV2 from '@/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2';
import UploadArtworkEditorV2 from '@/components/storefront/custom-studio-v2/UploadArtworkEditorV2';
import GarmentInfoPanel, { garmentColorSwatch } from '@/components/storefront/custom-studio-v2/GarmentInfoPanel';
import { customerApi } from '@/lib/customerApi';
import { useCart } from '@/lib/CartContext';
import { normalizeStyleTemplates } from '@/lib/customStudioStyleTemplates';
import {
  buildSeasonalStudioV2Snapshot,
  digestStudioV2Snapshot,
  renderSeasonalStudioV2Png,
  renderUploadStudioV2Png,
  resolveStudioV2PrintProfile,
} from '@/lib/customStudioV2Production';
import { renderProtectedStudioV2PngAdvanced } from '@/lib/customStudioV2ProtectedProduction';
import { refreshStudioV2DraftAssets } from '@/lib/customStudioV2Assets';
import { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';
import { renderStudioV2CustomerMockup } from '@/lib/customStudioV2Mockup';
import {
  createInitialStudioV2State,
  productColors,
  productSizes,
  STUDIO_V2_DESIGN_PATHS,
  STUDIO_V2_STEPS,
  studioV2CanContinue,
  studioV2PrintableSides,
  studioV2SideHasContent,
  studioV2Reducer,
} from '@/lib/customStudioV2State';

const pathIcons = { seasonal: Sparkles, bootleg: Star, memorial: Heart, upload: ImageUp };
const normalize = (value) => String(value || '').trim().toLowerCase();

function variantFor(product, color, size) {
  return (product?.variants || []).find((variant) =>
    variant?.active !== false && normalize(variant.color) === normalize(color) && normalize(variant.size) === normalize(size)
  ) || null;
}

function StudioStepRail({ currentStep, onStep }) {
  const currentIndex = STUDIO_V2_STEPS.findIndex((step) => step.id === currentStep);
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24 lg:self-start">
      <div className="mb-3 px-2 pt-2 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Custom Studio</div>
      <div className="grid grid-cols-5 gap-1 lg:grid-cols-1">
        {STUDIO_V2_STEPS.map((step, index) => {
          const active = step.id === currentStep;
          const complete = index < currentIndex;
          return (
            <button key={step.id} type="button" onClick={() => complete && onStep(step.id)} disabled={!complete && !active} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-1.5 text-left text-xs font-black transition lg:justify-start lg:px-3 ${active ? 'bg-slate-900 text-white' : complete ? 'bg-slate-50 text-slate-700 hover:bg-slate-100' : 'bg-white text-slate-300'}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] ${active ? 'bg-white text-slate-900' : complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{complete ? <Check size={14} /> : index + 1}</span>
              <span className="hidden lg:block">{step.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function GarmentVariantControls({ product, state, dispatch, onContinue, canContinue }) {
  const colors = productColors(product);
  const sizes = productSizes(product, state.color);
  return (
    <div className="mt-3 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-inner sm:p-4" data-gdp-selected-garment-options="true">
      <div>
        <div className="mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500">Color</div>
        <div className="flex flex-wrap gap-2">{colors.map((color) => {
          const selected = state.color === color;
          return <button key={color} type="button" onClick={() => dispatch({ type: 'SET_COLOR', color })} aria-label={`Select ${color}`} aria-pressed={selected} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 text-sm font-bold ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="h-5 w-5 shrink-0 rounded-full border border-slate-300 shadow-inner" style={{ backgroundColor: garmentColorSwatch(product, color) }} aria-hidden="true" /><span>{color}</span></button>;
        })}</div>
      </div>
      <div>
        <div className="mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500">Size</div>
        <div className="flex flex-wrap gap-2">{sizes.map((size) => <button key={size} type="button" onClick={() => dispatch({ type: 'SET_SIZE', size })} className={`min-h-11 min-w-12 rounded-xl border-2 px-3 text-sm font-bold ${state.size === size ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{size}</button>)}</div>
      </div>
      <GarmentInfoPanel product={product} sizes={sizes} />
      <div>
        <div className="mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500">Quantity</div>
        <div className="inline-flex min-h-11 items-center rounded-xl border-2 border-slate-200 bg-white"><button type="button" onClick={() => dispatch({ type: 'SET_QUANTITY', quantity: Math.max(1, Number(state.quantity || 1) - 1) })} disabled={Number(state.quantity || 1) <= 1} className="grid h-11 w-11 place-items-center text-lg font-black disabled:opacity-30">−</button><input type="number" min="1" max="99" value={state.quantity} onChange={(event) => dispatch({ type: 'SET_QUANTITY', quantity: Math.min(99, Math.max(1, Number(event.target.value || 1))) })} className="h-11 w-14 border-x border-slate-200 text-center text-base font-black outline-none sm:text-sm" /><button type="button" onClick={() => dispatch({ type: 'SET_QUANTITY', quantity: Math.min(99, Number(state.quantity || 1) + 1) })} disabled={Number(state.quantity || 1) >= 99} className="grid h-11 w-11 place-items-center text-lg font-black disabled:opacity-30">+</button></div>
      </div>
      <button data-gdp-garment-continue="true" type="button" onClick={onContinue} disabled={!canContinue} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">Continue <ArrowRight size={17} /></button>
    </div>
  );
}

function GarmentStepV2({ catalog, state, dispatch, onContinue, canContinue }) {
  return (
    <div className="space-y-5">
      <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 1</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Choose your garment</h1><p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Select a garment to reveal its DTF printing details, available colours, sizes, size guide and order information directly below it.</p></div>
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((item) => {
          const selected = String(item.id) === String(state.productId);
          return <div key={item.id} className="min-w-0">
            <button type="button" onClick={() => dispatch({ type: 'SELECT_PRODUCT', productId: item.id, color: productColors(item)[0] || '' })} className={`w-full overflow-hidden rounded-3xl border-2 bg-white text-left transition ${selected ? 'border-slate-900 shadow-lg' : 'border-slate-200 hover:border-slate-400'}`} aria-pressed={selected}>
              <div className="aspect-[5/4] bg-slate-50 p-3"><img src={item.images?.[0] || '/images/gdp-logo.webp'} alt={item.name} className="h-full w-full object-contain" /></div>
              <div className="p-4"><p className="text-sm font-black text-slate-900">{item.name}</p><p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{item.description || item.type || 'Custom garment'}</p></div>
            </button>
            {selected && <GarmentVariantControls product={item} state={state} dispatch={dispatch} onContinue={onContinue} canContinue={canContinue} />}
          </div>;
        })}
      </div>
    </div>
  );
}

function DesignStepV2({ dispatch }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 2</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Choose a design path</h1><p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Choose the design experience that fits what you want to create. Each path keeps its own artwork and settings.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2">{STUDIO_V2_DESIGN_PATHS.map((path) => { const Icon = pathIcons[path.id]; return <button key={path.id} type="button" onClick={() => dispatch({ type: 'SET_DESIGN_PATH', designPath: path.id })} className="rounded-3xl border-2 border-slate-200 bg-white p-5 text-left transition hover:border-slate-900 hover:shadow-lg"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white"><Icon size={20} /></span><div><h2 className="text-lg font-black text-slate-900">{path.label}</h2><p className="mt-1 text-sm font-medium leading-6 text-slate-500">{path.description}</p></div></div></button>; })}</div>
  </div>;
}

function PrintSideControl({ state, onChange }) {
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
    <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Print side</p><p className="text-xs font-bold text-slate-600">Front and Back keep independent artwork and positions.</p></div>
    <div className="flex rounded-xl bg-slate-100 p-1">{['front', 'back'].map((value) => { const designed = studioV2SideHasContent(state, value); return <button key={value} type="button" onClick={() => onChange(value)} className={`min-h-11 rounded-lg px-4 text-xs font-black uppercase ${state.side === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{value}{designed ? ' ✓' : ''}</button>; })}</div>
  </div>;
}

function ApprovalStepV2({ state, dispatch }) {
  const rightsRequired = state.designPath !== 'seasonal';
  return <div>
    <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 4</p>
    <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Timing & approval</h1>
    <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Production does not start here. Confirm your timing, artwork rights when required, and the final layout you want printed.</p>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <label className="rounded-3xl border border-slate-200 bg-white p-5"><span className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Needed by</span><input type="date" value={state.approval.needByDate} onChange={(event) => dispatch({ type: 'SET_APPROVAL', patch: { needByDate: event.target.value } })} className="mt-3 min-h-12 w-full rounded-xl border border-slate-200 px-3 text-base font-bold outline-none focus:border-slate-500 sm:text-sm" /><span className="mt-2 block text-xs font-medium text-slate-400">Optional. Final availability is still confirmed at order processing.</span></label>
      <div className="space-y-3">
        {rightsRequired && <button type="button" onClick={() => dispatch({ type: 'SET_APPROVAL', patch: { rightsConfirmed: !state.approval.rightsConfirmed } })} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left ${state.approval.rightsConfirmed ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${state.approval.rightsConfirmed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{state.approval.rightsConfirmed ? <Check size={18} /> : null}</span><span><span className="block text-sm font-black text-slate-900">I have permission to use this artwork/photo</span><span className="mt-1 block text-xs font-medium text-slate-500">I own it or have authorization to print it.</span></span></button>}
        <button type="button" onClick={() => dispatch({ type: 'SET_APPROVAL', patch: { finalDesignApproved: !state.approval.finalDesignApproved } })} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left ${state.approval.finalDesignApproved ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${state.approval.finalDesignApproved ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{state.approval.finalDesignApproved ? <Check size={18} /> : null}</span><span><span className="block text-sm font-black text-slate-900">I approve the final print layout</span><span className="mt-1 block text-xs font-medium text-slate-500">Your approved layout will be used to prepare the production artwork.</span></span></button>
      </div>
    </div>
  </div>;
}

function ReviewStepV2({ product, state, settings, finalizing, finalizeError, onEdit, onFinalize }) {
  const pathInfo = STUDIO_V2_DESIGN_PATHS.find((item) => item.id === state.designPath);
  const sides = studioV2PrintableSides(state);
  const bothSides = sides.length > 1;
  const variant = variantFor(product, state.color, state.size);
  const unitPrice = Number(variant?.price ?? product?.price ?? 0) + (bothSides ? Number(settings?.frontBackFee || 0) : 0);
  return <div>
    <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 5</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Final review</h1><p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Review your choices before the approved 300-DPI production files and customer mockup are generated.</p>
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_.7fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Garment</div><div className="mt-1 text-sm font-black text-slate-900">{product?.name}</div></div>
        <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Color / size</div><div className="mt-1 text-sm font-black text-slate-900">{state.color} · {state.size}</div></div>
        <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Design path</div><div className="mt-1 text-sm font-black text-slate-900">{pathInfo?.label || state.designPath}</div></div>
        <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Print sides</div><div className="mt-1 text-sm font-black capitalize text-slate-900">{sides.join(' + ')}</div></div>
        <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Needed by</div><div className="mt-1 text-sm font-black text-slate-900">{state.approval.needByDate || 'No date requested'}</div></div>
        <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Unit price</div><div className="mt-1 text-sm font-black text-slate-900">${unitPrice.toFixed(2)}</div></div>
      </div><button type="button" onClick={onEdit} disabled={finalizing} className="mt-5 min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-800 disabled:opacity-50">Edit design</button></div>
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5"><div className="grid h-11 w-11 place-items-center rounded-full bg-slate-900 text-white"><ShieldCheck size={21} /></div><h2 className="mt-4 text-lg font-black text-slate-950">Approved layout ready to build</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">Your approved design is ready. Production PNGs stay separate from the garment mockup shown in your cart.</p>
        {finalizeError && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold leading-5 text-red-700">{finalizeError}</div>}
        <button type="button" onClick={onFinalize} disabled={finalizing} className="mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60">{finalizing ? <><Loader2 size={18} className="animate-spin" /> Generating & verifying print files…</> : <>Generate, Verify & Add to Cart <ArrowRight size={18} /></>}</button>
        <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-500">The cart changes only after rendering, upload, verification and secure design saving all succeed.</p>
      </div>
    </div>
  </div>;
}

function EditorHeading({ title, description }) {
  return <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 3</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 text-sm font-medium text-slate-500">{description}</p></div>;
}

export default function CustomStudioV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem, replaceItem } = useCart();
  const editCartKey = String(location.state?.editCartKey || '');
  const [state, setState] = useState(() => {
    const draftState = location.state?.studioV2Draft?.state;
    if (!draftState || location.state?.studioV2Draft?.version !== 1) return createInitialStudioV2State();
    return {
      ...draftState,
      step: 'customize',
      approval: { ...(draftState.approval || {}), finalDesignApproved: false },
    };
  });
  const [catalog, setCatalog] = useState([]);
  const [settings, setSettings] = useState({ styleTemplates: {}, frontBackFee: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  const dispatch = (action) => setState((current) => studioV2Reducer(current, action));

  useEffect(() => {
    const draft = location.state?.studioV2Draft;
    if (!draft?.state || draft.version !== 1) return undefined;
    let active = true;
    refreshStudioV2DraftAssets(draft.state)
      .then((refreshed) => {
        if (!active || !refreshed) return;
        setState({ ...refreshed, step: 'customize', approval: { ...(refreshed.approval || {}), finalDesignApproved: false } });
      })
      .catch(() => { /* Stable paths remain available; final rendering will surface an actionable error if refresh fails. */ });
    return () => { active = false; };
  }, [location.state]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([customerApi.getStudioCatalog(), customerApi.getCustomStudioSettings().catch(() => ({}))])
      .then(([items, studioSettings]) => { if (active) { setCatalog(items || []); setSettings(studioSettings || {}); } })
      .catch(() => { if (active) setError('Custom Studio data could not load.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const product = useMemo(() => catalog.find((item) => String(item.id) === String(state.productId)) || null, [catalog, state.productId]);
  const canContinue = studioV2CanContinue(state);
  const currentEditor = state.designPath ? state[state.designPath]?.sides?.[state.side] : null;

  const next = () => {
    if (!canContinue) return;
    if (state.step === 'garment') dispatch({ type: 'SET_STEP', step: 'design' });
    else if (state.step === 'customize') dispatch({ type: 'SET_STEP', step: 'approval' });
    else if (state.step === 'approval') dispatch({ type: 'SET_STEP', step: 'review' });
  };
  const back = () => {
    if (state.step === 'design') dispatch({ type: 'SET_STEP', step: 'garment' });
    else if (state.step === 'customize') dispatch({ type: 'SET_STEP', step: 'design' });
    else if (state.step === 'approval') dispatch({ type: 'SET_STEP', step: 'customize' });
    else if (state.step === 'review') dispatch({ type: 'SET_STEP', step: 'approval' });
  };

  const finalizeToCart = async () => {
    if (!product || finalizing || !state.approval.finalDesignApproved) return;
    setFinalizing(true);
    setFinalizeError('');
    try {
      const sides = studioV2PrintableSides(state);
      if (!sides.length) throw new Error('There is no confirmed printable side.');
      const templates = normalizeStyleTemplates(settings?.styleTemplates || {});
      const productionFiles = {};
      const sideSnapshots = {};
      const uploads = {};
      const renderedSides = {};
      const sourceAssets = [];

      for (const side of sides) {
        const editor = state[state.designPath].sides[side];
        let snapshot;
        let rendered;
        if (state.designPath === 'seasonal') {
          snapshot = await buildSeasonalStudioV2Snapshot({ productId: product.id, size: state.size, color: state.color, layers: editor.layers });
          rendered = await renderSeasonalStudioV2Png(snapshot, 300);
        } else if (state.designPath === 'bootleg' || state.designPath === 'memorial') {
          const template = templates.find((item) => item.id === editor.templateId);
          if (!template) throw new Error(`The locked ${side} template is unavailable.`);
          const protectedPhotos = (editor.photos?.length ? editor.photos : (editor.photo?.path ? [{ id: 'primary-photo', asset: editor.photo, transform: editor.transform || {}, order: 0 }] : []));
          snapshot = {
            version: 3,
            designPath: state.designPath,
            side,
            templateId: template.id,
            photos: protectedPhotos.map((layer) => ({ id: layer.id, path: layer.asset?.path || '', transform: layer.transform || {}, order: Number(layer.order || 0), backgroundMode: layer.asset?.backgroundMode || 'original' })),
            stickers: (editor.stickers || []).map((layer) => ({ id: layer.id, stickerId: layer.stickerId, glyph: layer.glyph || '', assetUrl: layer.assetUrl || '', transform: layer.transform || {}, order: Number(layer.order || 0) })),
            text: editor.text || {},
            textStyle: editor.textStyle || {},
            printArea: resolveStudioV2PrintProfile(product, state.size, side),
          };
          rendered = await renderProtectedStudioV2PngAdvanced({ product, size: state.size, side, editor, template, profile: resolveStudioV2PrintProfile, dpi: 300 });
          protectedPhotos.forEach((layer) => {
            const asset = layer.asset || {};
            if (asset.path && !sourceAssets.some((item) => item.path === asset.path)) sourceAssets.push({ path: asset.path, name: asset.name || `${side}-photo`, width: asset.width || null, height: asset.height || null, isPrimary: sourceAssets.length === 0 });
          });
        } else {
          snapshot = { version: 2, designPath: 'upload', side, artworkPath: editor.artwork?.path || '', transform: editor.transform, printArea: resolveStudioV2PrintProfile(product, state.size, side) };
          rendered = await renderUploadStudioV2Png({ product, size: state.size, side, editor, dpi: 300 });
          if (editor.artwork?.path && !sourceAssets.some((asset) => asset.path === editor.artwork.path)) sourceAssets.push({ path: editor.artwork.path, name: editor.artwork.name || `${side}-artwork`, width: editor.artwork.width || null, height: editor.artwork.height || null, isPrimary: sourceAssets.length === 0 });
        }

        sideSnapshots[side] = snapshot;
        renderedSides[side] = rendered;
        const sideHash = await digestStudioV2Snapshot(snapshot);
        const file = new File([rendered.blob], `gdp-${state.designPath}-${side}-${sideHash.slice(0, 12)}.png`, { type: 'image/png', lastModified: Date.now() });
        const upload = await customerApi.uploadArtwork(file);
        uploads[side] = upload;
        productionFiles[side] = { path: upload.storage_path, widthPx: rendered.widthPx, heightPx: rendered.heightPx, widthIn: rendered.widthIn, heightIn: rendered.heightIn, dpi: rendered.dpi, mimeType: rendered.mimeType };
      }

      const persistedArtworkAssets = state.designPath === 'seasonal' && sourceAssets.length === 0
        ? sides.map((side, index) => {
          const upload = uploads[side];
          const production = productionFiles[side];
          if (!upload?.storage_path) return null;
          return {
            path: upload.storage_path,
            name: `seasonal-${side}-production.png`,
            width: production?.widthPx || null,
            height: production?.heightPx || null,
            isPrimary: index === 0,
          };
        }).filter(Boolean)
        : sourceAssets;

      const renderSnapshot = { version: 7, studio: 'v2', designPath: state.designPath, garment: { productId: product.id, color: state.color, size: state.size }, sides: sideSnapshots };
      const lockedHash = await digestStudioV2Snapshot(renderSnapshot);
      const approvedAt = new Date().toISOString();
      const firstSide = sides[0];
      const firstUpload = uploads[firstSide];
      const firstRendered = renderedSides[firstSide];
      const variant = variantFor(product, state.color, state.size);
      const bothSides = sides.length > 1;
      const basePrice = Number(variant?.price ?? product.price ?? 0);
      const price = basePrice + (bothSides ? Number(settings?.frontBackFee || 0) : 0);
      const templateNames = sides.map((side) => {
        const editor = state[state.designPath].sides[side];
        return templates.find((item) => item.id === editor?.templateId)?.name;
      }).filter(Boolean);
      const designPathLabel = STUDIO_V2_DESIGN_PATHS.find((item) => item.id === state.designPath)?.label || 'Custom Design';

      const customerMockup = await renderStudioV2CustomerMockup({
        garmentUrl: studioV2GarmentPreview(product, state.color, firstSide),
        productionBlob: firstRendered?.blob,
      });
      const mockupFile = new File(
        [customerMockup.blob],
        `gdp-customer-mockup-${firstSide}-${lockedHash.slice(0, 12)}.png`,
        { type: customerMockup.mimeType || 'image/png', lastModified: Date.now() }
      );
      const customerMockupUpload = await customerApi.uploadArtwork(mockupFile);

      const design = await customerApi.createCustomDesign({
        productId: product.id,
        productName: product.name,
        name: `${product.name} — ${designPathLabel}`,
        designStyle: templateNames.join(' / ') || designPathLabel,
        designPath: state.designPath,
        photos: persistedArtworkAssets.map((asset) => asset.path),
        photoAssets: persistedArtworkAssets,
        personalization: Object.fromEntries(sides.map((side) => [side, state[state.designPath].sides[side]?.text || {}])),
        placement: bothSides ? 'front_back' : firstSide,
        color: state.color,
        size: state.size,
        garmentTier: product.customization?.garmentTier || 'classic',
        needByDate: state.approval.needByDate || null,
        proofRequired: false,
        revisionAllowance: 0,
        customerConfirmedRights: state.designPath === 'seasonal' ? true : state.approval.rightsConfirmed,
        approvalPolicyAcknowledged: state.approval.finalDesignApproved,
        designIntensity: 3,
        renderSnapshot,
        productionFiles,
        customerMockupPath: customerMockupUpload.storage_path,
        renderStatus: 'locked',
        lockedHash,
        customerApprovedAt: approvedAt,
        preflight: { version: 4, status: 'passed', productionStatus: 'ready', expectedSides: sides, checkedAt: approvedAt },
        status: 'in_cart',
      });

      const quantity = Math.max(1, Number(state.quantity || 1));
      const cartItem = {
        productId: product.id,
        variantId: variant?.id || null,
        name: product.name,
        image: customerMockupUpload.file_url,
        price,
        quantity,
        color: state.color,
        size: state.size,
        isCustom: true,
        customDesignId: design.id,
        ...(design.guestDesignToken ? { guestDesignToken: design.guestDesignToken } : {}),
        fulfillmentMode: product.fulfillmentMode || 'in_house',
        designStyle: templateNames.join(' / ') || designPathLabel,
        designPath: state.designPath,
        renderStatus: 'locked',
        lockedHash,
        productionFiles,
        customerApprovedAt: approvedAt,
        needByDate: state.approval.needByDate || null,
        studioV2Draft: {
          version: 1,
          state: {
            ...state,
            step: 'customize',
            approval: { ...state.approval, finalDesignApproved: false },
          },
        },
      };
      if (editCartKey) replaceItem(editCartKey, cartItem);
      else addItem(cartItem);
      navigate('/cart');
    } catch (err) {
      setFinalizeError(err?.message || 'The print files could not be prepared. Your cart was not changed.');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center bg-slate-50"><div className="text-sm font-black text-slate-500">Loading Custom Studio…</div></div>;

  return <main className="min-h-[70vh] bg-slate-50 text-slate-950"><div className="mx-auto max-w-[1800px] px-3 py-4 sm:px-5 lg:px-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="flex items-center gap-2"><span className="rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-white">GDP Custom Studio</span><span className="text-xs font-bold text-slate-400">Create · Preview · Approve</span></div><button type="button" disabled={finalizing} onClick={() => dispatch({ type: 'RESET' })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 disabled:opacity-50"><RotateCcw size={15} /> Start over</button></div>
    {error && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]"><StudioStepRail currentStep={state.step} onStep={(step) => !finalizing && dispatch({ type: 'SET_STEP', step })} /><section className="min-w-0 rounded-3xl border border-slate-200 bg-white/55 p-3 shadow-sm sm:p-5">
      {state.step === 'garment' && <GarmentStepV2 catalog={catalog} state={state} dispatch={dispatch} onContinue={next} canContinue={canContinue} />}
      {state.step === 'design' && <DesignStepV2 dispatch={dispatch} />}
      {state.step === 'customize' && product && <PrintSideControl state={state} onChange={(side) => dispatch({ type: 'SET_SIDE', side })} />}
      {state.step === 'customize' && state.designPath === 'seasonal' && product && <div><EditorHeading title="Seasonal Design Lab" description="Build each print side independently. Your Front and Back artwork, placement and sizing stay exactly as you set them." /><SeasonalEditorV2 product={product} color={state.color} side={state.side} size={state.size} layers={currentEditor?.layers || []} activeLayerId={currentEditor?.activeLayerId || ''} confirmed={Boolean(currentEditor?.confirmed)} onLayersChange={(layers, activeLayerId) => dispatch({ type: 'SET_SEASONAL_LAYERS', side: state.side, layers, activeLayerId })} onActiveLayerChange={(id) => dispatch({ type: 'SET_SEASONAL_ACTIVE', side: state.side, id })} onConfirmedChange={(value) => dispatch({ type: 'CONFIRM_SEASONAL', side: state.side, value })} /></div>}
      {state.step === 'customize' && (state.designPath === 'bootleg' || state.designPath === 'memorial') && product && <div><EditorHeading title={state.designPath === 'memorial' ? 'Memorial Tribute Studio' : 'Photo Bootleg Studio'} description="Your photo, text and editable details stay separate from the protected template artwork." /><ProtectedTemplateEditorV2 path={state.designPath} product={product} color={state.color} size={state.size} settings={settings} editor={currentEditor} side={state.side} onPatch={(patch) => dispatch({ type: 'PATCH_EDITOR', path: state.designPath, side: state.side, patch })} onConfirmedChange={(value) => dispatch({ type: 'CONFIRM_EDITOR', path: state.designPath, side: state.side, value })} /></div>}
      {state.step === 'customize' && state.designPath === 'upload' && product && <div><EditorHeading title="Upload My Own Artwork" description="Each print side keeps its own uploaded artwork, position, size and rotation." /><UploadArtworkEditorV2 product={product} color={state.color} size={state.size} side={state.side} editor={currentEditor} onPatch={(patch) => dispatch({ type: 'PATCH_EDITOR', path: 'upload', side: state.side, patch })} onConfirmedChange={(value) => dispatch({ type: 'CONFIRM_EDITOR', path: 'upload', side: state.side, value })} /></div>}
      {state.step === 'approval' && <ApprovalStepV2 state={state} dispatch={dispatch} />}
      {state.step === 'review' && <ReviewStepV2 product={product} state={state} settings={settings} finalizing={finalizing} finalizeError={finalizeError} onEdit={() => dispatch({ type: 'SET_STEP', step: 'customize' })} onFinalize={finalizeToCart} />}
    </section></div>
    {state.step !== 'review' && state.step !== 'garment' && <div className="gdp-custom-studio-v2-actions relative z-20 mx-auto mt-4 flex max-w-2xl items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_36px_rgba(15,23,42,.12)]">{state.step !== 'garment' && <button type="button" onClick={back} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700"><ArrowLeft size={17} /> Back</button>}<button type="button" onClick={next} disabled={!canContinue || state.step === 'design'} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">{state.step === 'customize' ? 'Continue to approval' : state.step === 'approval' ? 'Final review' : 'Continue'} <ArrowRight size={17} /></button></div>}
  </div></main>;
}