import fs from 'node:fs';

const componentPath = 'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx';
const verifierPath = 'scripts/verify-photo-bootleg-desktop.mjs';

let component = fs.readFileSync(componentPath, 'utf8');
let verifier = fs.readFileSync(verifierPath, 'utf8');

function replaceOnce(label, before, after) {
  const first = component.indexOf(before);
  if (first < 0) throw new Error(`Missing expected ${label} source contract.`);
  if (component.indexOf(before, first + before.length) >= 0) throw new Error(`Expected exactly one ${label} source contract.`);
  component = component.slice(0, first) + after + component.slice(first + before.length);
}

replaceOnce(
  'Photo Bootleg text label',
  ">{path === 'memorial' ? 'Name' : 'Headline'}<input",
  ">{path === 'memorial' ? 'Name' : 'Your Text'}<input",
);

replaceOnce(
  'active text fallback',
  "editor.text?.headline || 'headline'",
  "editor.text?.headline || 'your text'",
);

const sublineBefore = `      <label className="block text-xs font-black text-slate-600">{path === 'memorial' ? 'Dates' : 'Subline'}<input value={editor.text?.subline || ''} onFocus={() => isBootleg && setActiveBootlegLayer('text')} onChange={(event) => patchText({ subline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>`;
const sublineAfter = `      {path === 'memorial' ? <label className="block text-xs font-black text-slate-600">Dates<input value={editor.text?.subline || ''} onChange={(event) => patchText({ subline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label> : null}`;
replaceOnce('Photo Bootleg subline control', sublineBefore, sublineAfter);

const activeStatus = `        {isBootleg ? <div data-gdp-bootleg-active-status="true" className="mb-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-900">{activeLayerSummary}</div> : null}`;
const persistentConfirm = `
        {isBootleg ? <button type="button" data-gdp-bootleg-confirm-action="persistent" disabled={!template || !photos.length} onClick={() => onConfirmedChange(!editor.confirmed)} aria-pressed={editor.confirmed} className={'sticky top-2 z-40 mb-3 flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 px-4 text-left shadow-sm transition ' + (editor.confirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500') + ' disabled:cursor-not-allowed disabled:opacity-40'}><span className={'grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ' + (editor.confirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent')}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">I’m done customizing this {side} design</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm template, photos, layers, text and placement before review.</span></span></button> : null}`;
replaceOnce('active layer status insertion point', activeStatus, activeStatus + persistentConfirm);

const inspectorMarker = '        <button type="button" disabled={!template || !photos.length} onClick={() => onConfirmedChange(!editor.confirmed)}';
const inspectorStart = component.indexOf(inspectorMarker);
if (inspectorStart < 0) throw new Error('Missing existing confirmation action in Layer Controls.');
if (component.indexOf(inspectorMarker, inspectorStart + inspectorMarker.length) >= 0) throw new Error('Expected one existing Layer Controls confirmation action.');
const inspectorEnd = component.indexOf('</button>', inspectorStart);
if (inspectorEnd < 0) throw new Error('Could not resolve existing confirmation action end.');
const inspectorBlock = component.slice(inspectorStart, inspectorEnd + '</button>'.length);
component = component.slice(0, inspectorStart)
  + '        {!isBootleg ? '
  + inspectorBlock.trimStart()
  + ' : null}'
  + component.slice(inspectorEnd + '</button>'.length);

if ((component.match(/data-gdp-bootleg-confirm-action="persistent"/g) || []).length !== 1) {
  throw new Error('Persistent Photo Bootleg confirmation action must render exactly once.');
}
if (component.includes("'Dates' : 'Subline'")) throw new Error('Photo Bootleg Subline control was not removed.');

const verifierAnchor = `assert(protectedV2.includes("photos.length ? 'Add another photo' : 'Add first photo'"), 'photo add action clearly distinguishes first and additional photos');`;
if (!verifier.includes(verifierAnchor)) throw new Error('Missing Photo Bootleg verifier insertion anchor.');
const newAssertions = `
assert(protectedV2.includes("path === 'memorial' ? 'Name' : 'Your Text'"), 'Photo Bootleg renames Headline to Your Text while Memorial keeps Name');
assert(!protectedV2.includes("'Dates' : 'Subline'"), 'Photo Bootleg no longer exposes a Subline input');
assert(protectedV2.includes('data-gdp-bootleg-confirm-action="persistent"'), 'Photo Bootleg completion action is persistent in the live garment preview column');
assert(protectedV2.indexOf('data-gdp-bootleg-confirm-action="persistent"') < protectedV2.indexOf('data-gdp-bootleg-inspector-scroll'), 'Photo Bootleg completion action is outside the scrollable Layer Controls inspector');
assert(protectedV2.includes('{!isBootleg ? <button type="button" disabled={!template || !photos.length}'), 'Memorial retains its existing confirmation action in Customer Controls');`;
if (!verifier.includes('Photo Bootleg completion action is persistent in the live garment preview column')) {
  verifier = verifier.replace(verifierAnchor, verifierAnchor + newAssertions);
}

fs.writeFileSync(componentPath, component);
fs.writeFileSync(verifierPath, verifier);
console.log('Applied guarded Photo Bootleg persistent confirmation/Text UI refinement.');
