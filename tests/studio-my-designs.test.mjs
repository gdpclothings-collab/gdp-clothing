import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialStudioV2State, createStudioV2ReuseState, studioV2Reducer, studioV2CanContinue } from '../src/lib/customStudioV2State.js';

const example = () => {
  const state = createInitialStudioV2State();
  state.productId = 'original-product';
  state.color = 'Black';
  state.size = 'M';
  state.designPath = 'upload';
  state.side = 'front';
  state.upload.sides.front.artwork = { path: 'owner/art.png', url: 'https://example.test/temporary', pixelWidth: 3600, pixelHeight: 4200 };
  state.upload.sides.front.transform = { scale: 140, widthScale: 200, heightScale: 70, rotation: 15, x: 5, y: -6 };
  state.upload.sides.front.confirmed = true;
  state.approval = { finalDesignApproved: true, rightsConfirmed: true };
  return state;
};

test('same-garment reorder keeps editable artwork but resets every approval', () => {
  const source = example();
  const copy = createStudioV2ReuseState(source, false);
  assert.equal(copy.productId, 'original-product');
  assert.deepEqual(copy.upload.sides.front.transform, source.upload.sides.front.transform);
  assert.equal(copy.upload.sides.front.artwork.path, 'owner/art.png');
  assert.equal(copy.step, 'customize');
  assert.equal(copy.approval.finalDesignApproved, false);
  assert.equal(copy.approval.rightsConfirmed, false);
  assert.equal(copy.upload.sides.front.confirmed, false);
  assert.equal(studioV2CanContinue(copy), false);
  assert.equal(source.approval.finalDesignApproved, true, 'never mutate the archived order');
});

test('different-garment reuse preserves art but requires valid new colour and size', () => {
  const draft = createStudioV2ReuseState(example(), true);
  assert.equal(draft.step, 'garment');
  assert.equal(draft.reusePending, true);
  assert.equal(draft.productId, '');
  assert.equal(studioV2CanContinue(draft), false);
  const selected = studioV2Reducer(draft, { type: 'SELECT_PRODUCT_FOR_REUSE', productId: 'other-product', color: 'White' });
  assert.equal(selected.productId, 'other-product');
  assert.equal(selected.color, 'White');
  assert.equal(selected.size, '');
  assert.deepEqual(selected.upload.sides.front.transform, example().upload.sides.front.transform);
  assert.equal(selected.upload.sides.front.confirmed, false);
  assert.equal(studioV2CanContinue(selected), false);
  const sized = studioV2Reducer(selected, { type: 'SET_SIZE', size: 'L' });
  assert.equal(studioV2CanContinue(sized), true, 'garment step can proceed once configured');
  assert.equal(sized.approval.finalDesignApproved, false);
});

test('malformed snapshots cannot bypass normal garment selection', () => {
  const state = createStudioV2ReuseState({ designPath: 'unknown', productId: 'fake' }, false);
  assert.equal(state.step, 'garment');
  assert.equal(state.productId, '');
});

test('My Designs preserves owner scope, immutable order proofs and authenticated writes', () => {
  const api = readFileSync('src/lib/customerApi.js', 'utf8');
  const page = readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  const account = readFileSync('src/pages/AccountRefined.jsx', 'utf8');
  assert.match(api, /from\("custom_designs"\)[\s\S]*?\.eq\("user_id", user\.id\)/);
  assert.match(api, /\.eq\("status", "in_cart"\)/);
  assert.match(api, /if \(!user\) return false/);
  assert.match(page, /await customerApi\.saveStudioDraftForDesign\(design\.id, state\)/);
  assert.match(page, /createStudioV2ReuseState\(refreshed, initialReuseModeRef\.current\)/);
  assert.match(account, /customerApi\.getSavedStudioDraft\(design\.id\)/);
  assert.match(account, /studioReuseMode: changeGarment \? "new-garment" : "same-garment"/);
  assert.match(account, /data-gdp-my-designs="true"/);
});
