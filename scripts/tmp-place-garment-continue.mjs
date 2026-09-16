import fs from 'node:fs';

const pagePath = 'src/pages/CustomStudioV2.jsx';
const verifyPath = 'scripts/verify-custom-studio-v2.mjs';

let page = fs.readFileSync(pagePath, 'utf8');
let verify = fs.readFileSync(verifyPath, 'utf8');

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  return source.replace(before, after);
}

page = replaceOnce(
  page,
  "function GarmentVariantControls({ product, state, dispatch }) {",
  "function GarmentVariantControls({ product, state, dispatch, onContinue, canContinue }) {",
  'variant controls signature'
);

page = replaceOnce(
  page,
  `      <div>\n        <div className=\"mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500\">Quantity</div>\n        <div className=\"inline-flex min-h-11 items-center rounded-xl border-2 border-slate-200 bg-white\"><button type=\"button\" onClick={() => dispatch({ type: 'SET_QUANTITY', quantity: Math.max(1, Number(state.quantity || 1) - 1) })} disabled={Number(state.quantity || 1) <= 1} className=\"grid h-11 w-11 place-items-center text-lg font-black disabled:opacity-30\">−</button><input type=\"number\" min=\"1\" max=\"99\" value={state.quantity} onChange={(event) => dispatch({ type: 'SET_QUANTITY', quantity: Math.min(99, Math.max(1, Number(event.target.value || 1))) })} className=\"h-11 w-14 border-x border-slate-200 text-center text-base font-black outline-none sm:text-sm\" /><button type=\"button\" onClick={() => dispatch({ type: 'SET_QUANTITY', quantity: Math.min(99, Number(state.quantity || 1) + 1) })} disabled={Number(state.quantity || 1) >= 99} className=\"grid h-11 w-11 place-items-center text-lg font-black disabled:opacity-30\">+</button></div>\n      </div>`,
  `      <div>\n        <div className=\"mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500\">Quantity</div>\n        <div className=\"inline-flex min-h-11 items-center rounded-xl border-2 border-slate-200 bg-white\"><button type=\"button\" onClick={() => dispatch({ type: 'SET_QUANTITY', quantity: Math.max(1, Number(state.quantity || 1) - 1) })} disabled={Number(state.quantity || 1) <= 1} className=\"grid h-11 w-11 place-items-center text-lg font-black disabled:opacity-30\">−</button><input type=\"number\" min=\"1\" max=\"99\" value={state.quantity} onChange={(event) => dispatch({ type: 'SET_QUANTITY', quantity: Math.min(99, Math.max(1, Number(event.target.value || 1))) })} className=\"h-11 w-14 border-x border-slate-200 text-center text-base font-black outline-none sm:text-sm\" /><button type=\"button\" onClick={() => dispatch({ type: 'SET_QUANTITY', quantity: Math.min(99, Number(state.quantity || 1) + 1) })} disabled={Number(state.quantity || 1) >= 99} className=\"grid h-11 w-11 place-items-center text-lg font-black disabled:opacity-30\">+</button></div>\n      </div>\n      <button data-gdp-garment-continue=\"true\" type=\"button\" onClick={onContinue} disabled={!canContinue} className=\"inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35\">Continue <ArrowRight size={17} /></button>`,
  'inline garment Continue'
);

page = replaceOnce(
  page,
  "function GarmentStepV2({ catalog, state, dispatch }) {",
  "function GarmentStepV2({ catalog, state, dispatch, onContinue, canContinue }) {",
  'garment step signature'
);

page = replaceOnce(
  page,
  "{selected && <GarmentVariantControls product={item} state={state} dispatch={dispatch} />}",
  "{selected && <GarmentVariantControls product={item} state={state} dispatch={dispatch} onContinue={onContinue} canContinue={canContinue} />}",
  'selected garment controls wiring'
);

page = replaceOnce(
  page,
  "{state.step === 'garment' && <GarmentStepV2 catalog={catalog} state={state} dispatch={dispatch} />}",
  "{state.step === 'garment' && <GarmentStepV2 catalog={catalog} state={state} dispatch={dispatch} onContinue={next} canContinue={canContinue} />}",
  'garment step Continue wiring'
);

page = replaceOnce(
  page,
  "{state.step !== 'review' && <div className=\"gdp-custom-studio-v2-actions",
  "{state.step !== 'review' && state.step !== 'garment' && <div className=\"gdp-custom-studio-v2-actions",
  'remove detached garment footer'
);

verify = replaceOnce(
  verify,
  "assert(page.includes('aria-pressed={selected}'), 'garment selection state must be exposed accessibly');",
  "assert(page.includes('aria-pressed={selected}'), 'garment selection state must be exposed accessibly');\nassert(page.includes('data-gdp-garment-continue=\"true\"'), 'Step 1 Continue must live under the selected garment options');\nassert(page.includes('onContinue={next} canContinue={canContinue}'), 'inline garment Continue must reuse the canonical next/canContinue flow');\nassert(page.includes(\"state.step !== 'review' && state.step !== 'garment'\"), 'detached bottom action bar must be hidden on the garment step');",
  'garment Continue regression assertions'
);

fs.writeFileSync(pagePath, page);
fs.writeFileSync(verifyPath, verify);
console.log('Patched Step 1 Continue placement under selected garment options.');
