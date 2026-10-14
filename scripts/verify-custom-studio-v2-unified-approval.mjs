import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createInitialStudioV2State,
  studioV2CanContinue,
  studioV2PrintableSides,
  studioV2Reducer,
} from '../src/lib/customStudioV2State.js';

const page = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
const start = page.indexOf('function CustomizeApprovalPanel(');
const end = page.indexOf('function ReviewStepV2(', start);
assert(start >= 0 && end > start, 'shared Step 3 approval panel must exist');
const markup = page.slice(start, end);
assert.equal((markup.match(/type="checkbox"/g) || []).length, 1, 'Step 3 must have exactly one checkbox');
assert(markup.includes('data-gdp-step3-approval-checkbox="true"'), 'checkbox needs a stable accessible test marker');
assert(markup.includes("type: 'CONFIRM_FINAL_LAYOUT'"), 'checkbox must commit via the canonical reducer');
assert(markup.includes('I have finished my design and approve it for printing.'), 'approval statement must be explicit');
assert(markup.includes('I also confirm that I own or have permission to print any photos or artwork I provided.'), 'customer-supplied assets must retain rights acknowledgement');
assert(!markup.includes('data-gdp-step3-finish-side="true"'), 'separate finish confirmation must not remain visible');
assert(!markup.includes("type: 'SET_APPROVAL'"), 'separate final and rights toggles must not remain visible');
assert(page.includes('const previousStepRef = useRef(state.step);'), 'track actual step transitions');
assert(page.includes('useLayoutEffect(() =>'), 'scroll correction must run after React commits the new step');
assert(page.includes("window.scrollTo({ top: nextTop, left: 0, behavior: 'instant' });"), 'step transitions must position the new content below navigation');
assert(page.includes('ref={studioPanelRef} tabIndex={-1}'), 'new step must get a keyboard-accessible focus target');
assert(page.includes("if (!studioV2CanContinue({ ...state, step: 'customize' })) return;"), 'production finalization must recheck all approval gates');

const paths = ['seasonal', 'bootleg', 'memorial', 'upload'];
function makeState(designPath, twoSided) {
  const state = createInitialStudioV2State();
  state.step = 'customize';
  state.designPath = designPath;
  state.productId = 'synthetic-product-id';
  state.color = 'White';
  state.size = 'S';
  for (const side of (twoSided ? ['front', 'back'] : ['front'])) {
    const editor = state[designPath].sides[side];
    if (designPath === 'seasonal') editor.layers = [{ id: 'synthetic-' + side, artworkId: 'synthetic-art', visible: true }];
    else if (designPath === 'upload') editor.artwork = { path: 'synthetic/' + side + '.png', url: '/test.png' };
    else {
      editor.templateId = 'synthetic-template';
      editor.photo = { path: 'synthetic/' + side + '.png', url: '/test.png' };
    }
  }
  return state;
}

for (const path of paths) for (const twoSided of [false, true]) {
  const base = makeState(path, twoSided);
  assert.equal(studioV2CanContinue(base), false, path + ': unapproved artwork must not progress');
  const printableSides = studioV2PrintableSides(base);
  assert.equal(printableSides.length, twoSided ? 2 : 1, path + ': printable sides must be preserved');
  const approved = studioV2Reducer(base, { type: 'CONFIRM_FINAL_LAYOUT', value: true });
  assert.equal(approved.approval.finalDesignApproved, true, path + ': final approval not set');
  assert.equal(approved.approval.rightsConfirmed, path !== 'seasonal', path + ': rights must match design ownership');
  for (const side of printableSides) assert.equal(approved[path].sides[side].confirmed, true, path + ': designed ' + side + ' side must be confirmed');
  assert.equal(approved[path].sides.back.confirmed, twoSided, path + ': unused side must remain unconfirmed');
  assert.equal(studioV2CanContinue(approved), true, path + ': approved design should reach Final Review');
  const toggledOff = studioV2Reducer(approved, { type: 'CONFIRM_FINAL_LAYOUT', value: false });
  assert.equal(studioV2CanContinue(toggledOff), false, path + ': unchecking must block Final Review');
  assert.equal(toggledOff.approval.rightsConfirmed, false, path + ': rights must be cleared when approval is withdrawn');

  const edited = path === 'seasonal'
    ? studioV2Reducer(approved, {
      type: 'SET_SEASONAL_LAYERS', side: 'front',
      layers: [...approved.seasonal.sides.front.layers, { id: 'new-layer', artworkId: 'new-art', visible: true }],
      activeLayerId: 'new-layer',
    })
    : studioV2Reducer(approved, { type: 'PATCH_EDITOR', path, side: 'front', patch: { revision: 2 } });
  assert.equal(edited.approval.finalDesignApproved, false, path + ': editing must invalidate the prior approval');
  assert.equal(studioV2CanContinue(edited), false, path + ': editing must block further progress');
  assert.equal(studioV2CanContinue(studioV2Reducer(edited, { type: 'CONFIRM_FINAL_LAYOUT', value: true })), true, path + ': one re-confirmation must restore approval');
}

for (const path of paths) {
  const empty = makeState(path, false);
  if (path === 'seasonal') empty.seasonal.sides.front.layers = [];
  else if (path === 'upload') empty.upload.sides.front.artwork = null;
  else empty[path].sides.front.photo = null;
  const after = studioV2Reducer(empty, { type: 'CONFIRM_FINAL_LAYOUT', value: true });
  assert.equal(after.approval.finalDesignApproved, false, path + ': an empty design must not be approved');
  assert.equal(studioV2CanContinue(after), false, path + ': an empty design must remain blocked');
}

console.log('PASS: all four GDP Studio design paths use one approval checkbox; every side, rights, edit invalidation and navigation guard preserved.');
