import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  STUDIO_HISTORY_STATE_KEY,
  studioHistoryActionStep,
  studioHistoryDestination,
  studioHistorySafeStep,
  studioHistoryStep,
  STUDIO_GARMENT_VIEW_STATE_KEY,
  studioHistoryActionGarmentView,
  studioHistoryGarmentView,
  studioHistoryShouldPush,
} from '../src/lib/studioV2StepHistory.js';
import { createInitialStudioV2State, studioV2Reducer } from '../src/lib/customStudioV2State.js';

test('every Studio path creates the correct history step', () => {
  assert.equal(studioHistoryActionStep({ type: 'SET_STEP', step: 'design' }), 'design');
  assert.equal(studioHistoryActionStep({ type: 'SET_DESIGN_PATH', designPath: 'seasonal' }), 'customize');
  assert.equal(studioHistoryActionStep({ type: 'SET_DESIGN_PATH', designPath: 'bootleg' }), 'customize');
  assert.equal(studioHistoryActionStep({ type: 'SET_DESIGN_PATH', designPath: 'memorial' }), 'customize');
  assert.equal(studioHistoryActionStep({ type: 'SET_DESIGN_PATH', designPath: 'upload' }), 'customize');
  assert.equal(studioHistoryActionStep({ type: 'SET_STEP', step: 'review' }), 'review');
  assert.equal(studioHistoryActionStep({ type: 'RESET' }), 'garment');
  assert.equal(studioHistoryActionStep({ type: 'PATCH_EDITOR' }), null);
  assert.equal(studioHistoryActionStep({ type: 'SET_SIZE', size: 'XL' }), null);
  assert.equal(studioHistoryActionStep({ type: 'SET_SIDE', side: 'back' }), null);
  assert.equal(studioHistoryActionStep({ type: 'SET_STEP', step: 'invalid' }), null);
});

test('routes keep query and hash, and never leave the current Studio alias', () => {
  for (const pathname of ['/custom-studio', '/design', '/custom-studio-v2']) {
    const base = { pathname, search: '?source=facebook&campaign=fall', hash: '#workspace' };
    const dest = studioHistoryDestination(base, 'customize');
    assert.equal(dest.pathname, pathname);
    assert.equal(dest.hash, '#workspace');
    const params = new URLSearchParams(dest.search);
    assert.equal(params.get('studioStep'), 'customize');
    assert.equal(params.get('source'), 'facebook');
    assert.equal(params.get('campaign'), 'fall');
  }
});

test('Back/Forward markers restore wizard stages, not home or user-edited URLs', () => {
  assert.equal(studioHistoryStep(null, 'garment'), 'garment');
  assert.equal(studioHistoryStep({ [STUDIO_HISTORY_STATE_KEY]: 'design' }, 'garment'), 'design');
  assert.equal(studioHistoryStep({ [STUDIO_HISTORY_STATE_KEY]: 'customize' }, 'garment'), 'customize');
  assert.equal(studioHistoryStep({ [STUDIO_HISTORY_STATE_KEY]: 'review' }, 'garment'), 'review');
  assert.equal(studioHistoryStep({ [STUDIO_HISTORY_STATE_KEY]: 'unknown' }, 'garment'), 'garment');
  assert.equal(studioHistoryStep(null, 'customize'), 'customize');
});

test('uninitialized editors cannot be entered by stale browser history', () => {
  assert.equal(studioHistorySafeStep('review', createInitialStudioV2State()), 'garment');
  assert.equal(studioHistorySafeStep('design', { productId: 'shirt-1' }), 'design');
  assert.equal(studioHistorySafeStep('review', { productId: 'shirt-1' }), 'design');
  assert.equal(studioHistorySafeStep('review', { productId: 'shirt-1', designPath: 'seasonal' }), 'review');
  assert.equal(studioHistorySafeStep('customize', { productId: 'shirt-1', designPath: 'upload' }), 'customize');
});

test('browser step changes never erase previously selected garment or artwork', () => {
  const initial = createInitialStudioV2State();
  const ready = { ...initial, productId: 'shirt-1', color: 'black', size: 'XL', designPath: 'seasonal' };
  const withArt = { ...ready, seasonal: { ...ready.seasonal, sides: { ...ready.seasonal.sides, front: { layers: [{ id: 'kept-art' }], confirmed: true } } } };
  const atReview = studioV2Reducer(withArt, { type: 'SET_STEP', step: 'review' });
  const afterBack = studioV2Reducer(atReview, { type: 'SET_STEP', step: 'customize' });
  const afterForward = studioV2Reducer(afterBack, { type: 'SET_STEP', step: 'review' });
  assert.equal(afterForward.productId, 'shirt-1');
  assert.equal(afterForward.color, 'black');
  assert.equal(afterForward.size, 'XL');
  assert.deepEqual(afterForward.seasonal.sides.front.layers, [{ id: 'kept-art' }]);
});

test('the production V2 page uses router navigation and keyed Back/Forward synchronization', () => {
  const source = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  assert.match(source, /navigate\(studioHistoryDestination\(route, target, view\)/);
  assert.match(source, /studioHistoryStep\(location.state, initialStudioStepRef.current\)/);
  assert.match(source, /studioHistorySafeStep\(historyStep, stateRef.current\)/);
  assert.match(source, /\[location.key, location.state\]/);
  assert.doesNotMatch(source, /window\.history\.pushState/);
  assert.doesNotMatch(source, /window\.onpopstate\s*=/);
});

test('cart-edit draft refresh runs only on initial entry, not on browser history steps', () => {
  const source = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  assert.match(source, /const initialStudioDraftRef = useRef\(location\.state\?\.studioV2Draft\)/);
  assert.match(source, /const draft = initialStudioDraftRef\.current/);
  assert.doesNotMatch(source, /const draft = location\.state\?\.studioV2Draft;/);
  assert.match(source, /refreshStudioV2DraftAssets\(draft\.state\)/);
});

test('choosing a garment is a browser-history transition even within Step 1', () => {
  assert.equal(studioHistoryActionStep({ type: 'SELECT_PRODUCT', productId: 'shirt-1' }), 'garment');
  assert.equal(studioHistoryActionStep({ type: 'BROWSE_GARMENTS' }), 'garment');
  assert.equal(studioHistoryActionStep({ type: 'FOCUS_GARMENT' }), 'garment');
  assert.equal(studioHistoryActionGarmentView({ type: 'SELECT_PRODUCT' }, 'browse', ''), 'focused');
  assert.equal(studioHistoryActionGarmentView({ type: 'BROWSE_GARMENTS' }, 'focused', 'shirt-1'), 'browse');
  assert.equal(studioHistoryActionGarmentView({ type: 'FOCUS_GARMENT' }, 'browse', 'shirt-1'), 'focused');
  assert.equal(studioHistoryShouldPush('garment', 'garment', 'browse', 'focused'), true);
  assert.equal(studioHistoryShouldPush('garment', 'garment', 'focused', 'browse'), true);
  assert.equal(studioHistoryShouldPush('garment', 'garment', 'focused', 'focused'), false);
  assert.equal(studioHistoryShouldPush('garment', 'design', 'focused', 'focused'), true);
});

test('browser Back restores the gallery while keeping the selected garment intact', () => {
  const selectedProductId = 'shirt-1';
  const selectedState = studioV2Reducer(createInitialStudioV2State(), { type: 'SELECT_PRODUCT', productId: selectedProductId, color: 'White' });
  const focusEntry = { [STUDIO_GARMENT_VIEW_STATE_KEY]: 'focused' };
  const browseEntry = {};
  assert.equal(studioHistoryGarmentView(focusEntry, 'browse', selectedState.productId), 'focused');
  assert.equal(studioHistoryGarmentView(browseEntry, 'browse', selectedState.productId), 'browse');
  assert.equal(selectedState.productId, selectedProductId);
  assert.equal(selectedState.color, 'White');
  assert.equal(studioHistoryGarmentView(focusEntry, 'browse', ''), 'browse', 'reload without a selected item must not focus an empty configurator');
});

test('focused and browse views preserve studio alias and unrelated query params', () => {
  const base = { pathname: '/design', search: '?source=fb', hash: '#workspace' };
  const focusUrl = studioHistoryDestination(base, 'garment', 'focused');
  assert.equal(new URLSearchParams(focusUrl.search).get('garmentView'), 'focused');
  assert.equal(new URLSearchParams(focusUrl.search).get('source'), 'fb');
  assert.equal(focusUrl.pathname, '/design');
  const chooseDesignUrl = studioHistoryDestination(focusUrl, 'design', 'focused');
  assert.equal(new URLSearchParams(chooseDesignUrl.search).has('garmentView'), false);
  assert.equal(chooseDesignUrl.pathname, '/design');
});

test('Step 1 gallery, focus and Keep/Change buttons are bound to router state', () => {
  const source = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  assert.match(source, /garmentView === 'browse'/);
  assert.match(source, /dispatch\(\{ type: 'BROWSE_GARMENTS' \}\)/);
  assert.match(source, /dispatch\(\{ type: 'FOCUS_GARMENT' \}\)/);
  assert.match(source, /studioHistoryGarmentView\(/);
  assert.match(source, /studioHistoryShouldPush\(/);
  assert.match(source, /\[state\.step, garmentView\]/);
});
