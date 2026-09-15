import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Heart, ImageUp, RotateCcw, Sparkles, Star } from 'lucide-react';
import SeasonalEditorV2 from '@/components/storefront/custom-studio-v2/SeasonalEditorV2';
import ProtectedTemplateEditorV2 from '@/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2';
import UploadArtworkEditorV2 from '@/components/storefront/custom-studio-v2/UploadArtworkEditorV2';
import { customerApi } from '@/lib/customerApi';
import { normalizeStyleTemplates } from '@/lib/customStudioStyleTemplates';
import {
  createInitialStudioV2State,
  productColors,
  productSizes,
  STUDIO_V2_DESIGN_PATHS,
  STUDIO_V2_STEPS,
  studioV2CanContinue,
  studioV2Reducer,
} from '@/lib/customStudioV2State';

const pathIcons = { seasonal: Sparkles, bootleg: Star, memorial: Heart, upload: ImageUp };

function StudioStepRail({ currentStep, onStep }) {
  const currentIndex = STUDIO_V2_STEPS.findIndex((step) => step.id === currentStep);
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24 lg:self-start">
      <div className="mb-3 px-2 pt-2 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Custom Studio V2</div>
      <div className="grid grid-cols-4 gap-1 lg:grid-cols-1">
        {STUDIO_V2_STEPS.map((step, index) => {
          const active = step.id === currentStep;
          const complete = index < currentIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => complete && onStep(step.id)}
              disabled={!complete && !active}
              className={`flex min-h-12 items-center gap-2 rounded-2xl px-2.5 text-left text-xs font-black transition lg:px-3 ${active ? 'bg-slate-900 text-white' : complete ? 'bg-slate-50 text-slate-700 hover:bg-slate-100' : 'bg-white text-slate-300'}`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] ${active ? 'bg-white text-slate-900' : complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{complete ? <Check size={14} /> : index + 1}</span>
              <span className="hidden lg:block">{step.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function GarmentStepV2({ catalog, state, dispatch }) {
  const product = catalog.find((item) => String(item.id) === String(state.productId)) || null;
  const colors = productColors(product);
  const sizes = productSizes(product, state.color);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 1</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Choose your garment</h1>
        <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">One clean selection state. Garment, color and size must be valid before continuing.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((item) => {
          const selected = String(item.id) === String(state.productId);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => dispatch({ type: 'SELECT_PRODUCT', productId: item.id, color: productColors(item)[0] || '' })}
              className={`overflow-hidden rounded-3xl border-2 bg-white text-left transition ${selected ? 'border-slate-900 shadow-lg' : 'border-slate-200 hover:border-slate-400'}`}
            >
              <div className="aspect-[5/4] bg-slate-50 p-3"><img src={item.images?.[0] || '/images/gdp-logo.webp'} alt={item.name} className="h-full w-full object-contain" /></div>
              <div className="p-4"><p className="text-sm font-black text-slate-900">{item.name}</p><p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500">{item.description || item.type || 'Custom garment'}</p></div>
            </button>
          );
        })}
      </div>

      {product && (
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500">Color</div>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => <button key={color} type="button" onClick={() => dispatch({ type: 'SET_COLOR', color })} className={`min-h-11 rounded-xl border-2 px-4 text-sm font-bold ${state.color === color ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{color}</button>)}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500">Size</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => <button key={size} type="button" onClick={() => dispatch({ type: 'SET_SIZE', size })} className={`min-h-11 min-w-12 rounded-xl border-2 px-3 text-sm font-bold ${state.size === size ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{size}</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DesignStepV2({ dispatch }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 2</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Choose a design path</h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Every editor is isolated behind the same workflow shell, so a fix in one path cannot rewrite another path’s state.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {STUDIO_V2_DESIGN_PATHS.map((path) => {
          const Icon = pathIcons[path.id];
          return (
            <button key={path.id} type="button" onClick={() => dispatch({ type: 'SET_DESIGN_PATH', designPath: path.id })} className="rounded-3xl border-2 border-slate-200 bg-white p-5 text-left transition hover:border-slate-900 hover:shadow-lg">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white"><Icon size={20} /></span>
                <div><h2 className="text-lg font-black text-slate-900">{path.label}</h2><p className="mt-1 text-sm font-medium leading-6 text-slate-500">{path.description}</p></div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PrintSideControl({ side, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Print side</p><p className="text-xs font-bold text-slate-600">Front and back are explicit editor state, never inferred from the preview.</p></div>
      <div className="flex rounded-xl bg-slate-100 p-1">
        {['front', 'back'].map((value) => <button key={value} type="button" onClick={() => onChange(value)} className={`min-h-11 rounded-lg px-5 text-xs font-black uppercase ${side === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{value}</button>)}
      </div>
    </div>
  );
}

function ReviewStepV2({ product, state, settings, onEdit }) {
  const pathInfo = STUDIO_V2_DESIGN_PATHS.find((item) => item.id === state.designPath);
  const templates = normalizeStyleTemplates(settings?.styleTemplates || {});
  const editor = state[state.designPath];
  const template = (state.designPath === 'bootleg' || state.designPath === 'memorial')
    ? templates.find((item) => item.id === editor?.templateId)
    : null;

  let detailLabel = 'Artwork';
  let detailValue = 'Ready';
  if (state.designPath === 'seasonal') {
    detailLabel = 'Artwork layers';
    detailValue = `${state.seasonal.layers.length}`;
  } else if (state.designPath === 'bootleg' || state.designPath === 'memorial') {
    detailLabel = 'Locked template';
    detailValue = template?.name || 'Selected template';
  } else if (state.designPath === 'upload') {
    detailLabel = 'Uploaded artwork';
    detailValue = state.upload.artwork?.name || 'Customer artwork';
  }

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 4</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Review locked design state</h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">Review is intentionally lightweight. It reads the confirmed V2 state directly and does not launch production rendering or rebuild the editor DOM.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Garment</div><div className="mt-1 text-sm font-black text-slate-900">{product?.name}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Color / size</div><div className="mt-1 text-sm font-black text-slate-900">{state.color} · {state.size}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Design path</div><div className="mt-1 text-sm font-black text-slate-900">{pathInfo?.label || state.designPath}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Print side</div><div className="mt-1 text-sm font-black capitalize text-slate-900">{state.side}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{detailLabel}</div><div className="mt-1 text-sm font-black text-slate-900">{detailValue}</div></div>
          </div>
          <button type="button" onClick={onEdit} className="mt-5 min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-black text-slate-800">Edit design</button>
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-600 text-white"><Check size={21} strokeWidth={3} /></div>
          <h2 className="mt-4 text-lg font-black text-emerald-950">Design state is review-ready</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-emerald-900/75">The customer-confirmed layout is already available here. The next V2 phase will generate the deterministic production PNG only after final approval.</p>
          <div className="mt-4 rounded-2xl bg-white/70 p-3 text-xs font-bold text-emerald-900">Cart finalization remains intentionally disabled until the new renderer and cart regression suite are connected. This prevents an incomplete V2 design from reaching checkout.</div>
        </div>
      </div>
    </div>
  );
}

function EditorHeading({ title, description }) {
  return <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 3</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 text-sm font-medium text-slate-500">{description}</p></div>;
}

export default function CustomStudioV2() {
  const [state, setState] = useState(() => createInitialStudioV2State());
  const [catalog, setCatalog] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const dispatch = (action) => setState((current) => studioV2Reducer(current, action));

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      customerApi.getStudioCatalog(),
      customerApi.getCustomStudioSettings().catch(() => ({})),
    ])
      .then(([items, studioSettings]) => {
        if (!active) return;
        setCatalog(items || []);
        setSettings(studioSettings || {});
      })
      .catch(() => { if (active) setError('Custom Studio data could not load.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const product = useMemo(() => catalog.find((item) => String(item.id) === String(state.productId)) || null, [catalog, state.productId]);
  const canContinue = studioV2CanContinue(state);

  const next = () => {
    if (!canContinue) return;
    if (state.step === 'garment') dispatch({ type: 'SET_STEP', step: 'design' });
    else if (state.step === 'customize') dispatch({ type: 'SET_STEP', step: 'review' });
  };

  const back = () => {
    if (state.step === 'design') dispatch({ type: 'SET_STEP', step: 'garment' });
    else if (state.step === 'customize') dispatch({ type: 'SET_STEP', step: 'design' });
    else if (state.step === 'review') dispatch({ type: 'SET_STEP', step: 'customize' });
  };

  if (loading) return <div className="grid min-h-[70vh] place-items-center bg-slate-50"><div className="text-sm font-black text-slate-500">Loading Custom Studio V2…</div></div>;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1800px] px-3 py-4 sm:px-5 lg:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2"><span className="rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-white">V2 isolated rebuild</span><span className="text-xs font-bold text-slate-400">Legacy Studio remains available</span></div>
          <button type="button" onClick={() => dispatch({ type: 'RESET' })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700"><RotateCcw size={15} /> Start over</button>
        </div>

        {error && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
          <StudioStepRail currentStep={state.step} onStep={(step) => dispatch({ type: 'SET_STEP', step })} />
          <section className="min-w-0 rounded-3xl border border-slate-200 bg-white/55 p-3 shadow-sm sm:p-5">
            {state.step === 'garment' && <GarmentStepV2 catalog={catalog} state={state} dispatch={dispatch} />}
            {state.step === 'design' && <DesignStepV2 dispatch={dispatch} />}

            {state.step === 'customize' && state.designPath === 'seasonal' && product && (
              <div>
                <EditorHeading title="Seasonal Design Lab V2" description="A clean layer editor with one source of truth. No legacy approval spinner or DOM reconstruction." />
                <SeasonalEditorV2
                  product={product}
                  size={state.size}
                  layers={state.seasonal.layers}
                  activeLayerId={state.seasonal.activeLayerId}
                  confirmed={state.seasonal.confirmed}
                  onLayersChange={(layers, activeLayerId) => dispatch({ type: 'SET_SEASONAL_LAYERS', layers, activeLayerId })}
                  onActiveLayerChange={(id) => dispatch({ type: 'SET_SEASONAL_ACTIVE', id })}
                  onConfirmedChange={(value) => dispatch({ type: 'CONFIRM_SEASONAL', value })}
                />
              </div>
            )}

            {state.step === 'customize' && (state.designPath === 'bootleg' || state.designPath === 'memorial') && product && (
              <div>
                <EditorHeading title={state.designPath === 'memorial' ? 'Memorial Tribute Studio V2' : 'Photo Bootleg Studio V2'} description="Locked GDP artwork is separated from customer photo and text state so template protection cannot collide with editing controls." />
                <PrintSideControl side={state.side} onChange={(side) => dispatch({ type: 'SET_SIDE', side })} />
                <ProtectedTemplateEditorV2
                  path={state.designPath}
                  product={product}
                  settings={settings}
                  editor={state[state.designPath]}
                  onPatch={(patch) => dispatch({ type: 'PATCH_EDITOR', path: state.designPath, patch })}
                  onConfirmedChange={(value) => dispatch({ type: 'CONFIRM_EDITOR', path: state.designPath, value })}
                />
              </div>
            )}

            {state.step === 'customize' && state.designPath === 'upload' && product && (
              <div>
                <EditorHeading title="Upload My Own Artwork V2" description="A dedicated artwork editor with explicit print-side, placement, size and rotation state." />
                <UploadArtworkEditorV2
                  product={product}
                  side={state.side}
                  editor={state.upload}
                  onPatch={(patch) => dispatch({ type: 'PATCH_EDITOR', path: 'upload', patch })}
                  onConfirmedChange={(value) => dispatch({ type: 'CONFIRM_EDITOR', path: 'upload', value })}
                  onSideChange={(side) => dispatch({ type: 'SET_SIDE', side })}
                />
              </div>
            )}

            {state.step === 'review' && <ReviewStepV2 product={product} state={state} settings={settings} onEdit={() => dispatch({ type: 'SET_STEP', step: 'customize' })} />}
          </section>
        </div>

        {state.step !== 'review' && (
          <div className="sticky bottom-3 z-30 mx-auto mt-4 flex max-w-2xl items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_18px_50px_rgba(15,23,42,.16)] backdrop-blur">
            {state.step !== 'garment' && <button type="button" onClick={back} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700"><ArrowLeft size={17} /> Back</button>}
            <button type="button" onClick={next} disabled={!canContinue || state.step === 'design'} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35">{state.step === 'customize' ? 'Review design' : 'Continue'} <ArrowRight size={17} /></button>
          </div>
        )}
      </div>
    </main>
  );
}
