import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  saveStudioV2WorkingDraft,
  loadStudioV2WorkingDraft,
  clearStudioV2WorkingDraft,
  STUDIO_V2_WORKING_DRAFT_TTL_MS,
} from '../src/lib/studioV2WorkingDraft.js';
import { createInitialStudioV2State } from '../src/lib/customStudioV2State.js';

function memoryStorage() {
  const values = new Map();
  return {
    values,
    setItem(key, value) { values.set(key, String(value)); },
    getItem(key) { return values.get(key) ?? null; },
    removeItem(key) { values.delete(key); },
  };
}

function photo(id, order) {
  return {
    id,
    order,
    visible: true,
    asset: {
      path: 'guest-uploads/' + id + '.png',
      originalPath: 'guest-uploads/' + id + '-original.png',
      name: id + '.png',
      url: 'https://example.test/image?token=temporary',
      originalUrl: 'https://example.test/original?token=temporary',
    },
    transform: { scale: 123 + order, x: order * 7, y: -(order * 9 + 1), rotation: order * 5, bleedCrop: true },
  };
}

function populated() {
  const state = createInitialStudioV2State();
  state.productId = 'shirt-1';
  state.color = 'black';
  state.size = 'M';
  state.quantity = 2;
  state.designPath = 'bootleg';
  state.step = 'customize';
  state.side = 'back';
  const front = state.bootleg.sides.front;
  front.templateId = 'chrome-galaxy';
  front.photos = [photo('one', 0), photo('two', 1), photo('three', 2), photo('four', 3)];
  front.activePhotoId = 'four';
  front.text.headline = 'Original customer text';
  front.textStyle.curve = 'arc';
  front.textStyle.curveAmount = -70;
  front.confirmed = true;
  state.approval.rightsConfirmed = true;
  state.approval.finalDesignApproved = true;
  return state;
}

test('refresh draft preserves four uploaded layers, positions, text and signed storage paths', () => {
  const storage = memoryStorage();
  const state = populated();
  assert.equal(saveStudioV2WorkingDraft(state, null, storage, 1000), true);
  const restored = loadStudioV2WorkingDraft(null, storage, 2000);
  assert.ok(restored);
  assert.deepEqual(restored.bootleg.sides.front.photos.map((layer) => layer.id), ['one', 'two', 'three', 'four']);
  assert.deepEqual(restored.bootleg.sides.front.photos.map((layer) => layer.transform), state.bootleg.sides.front.photos.map((layer) => layer.transform));
  assert.equal(restored.bootleg.sides.front.activePhotoId, 'four');
  assert.equal(restored.bootleg.sides.front.text.headline, 'Original customer text');
  assert.equal(restored.bootleg.sides.front.textStyle.curveAmount, -70);
  assert.equal(restored.side, 'back');
  assert.equal(restored.quantity, 2);
  assert.equal(restored.bootleg.sides.front.photos[1].asset.path, 'guest-uploads/two.png');
  assert.equal(restored.bootleg.sides.front.photos[0].asset.url, undefined);
  assert.equal(restored.bootleg.sides.front.photos[0].asset.originalUrl, undefined);
  assert.equal(state.bootleg.sides.front.photos[0].asset.url.includes('token='), true);
});

test('persisted working copy excludes credentials, inline blobs, signed URLs and approvals', () => {
  const storage = memoryStorage();
  const state = populated();
  state.bootleg.sides.front.photos[0].asset.inlinePreview = 'data:image/png;base64,AAAB';
  state.bootleg.sides.front.photos[0].asset.previewBlob = 'blob:example';
  state.bootleg.sides.front.photos[0].asset.accessToken = 'dont-store';
  assert.equal(saveStudioV2WorkingDraft(state, null, storage), true);
  const savedText = [...storage.values.values()][0];
  for (const secret of ['?token=', 'data:image', 'blob:', 'dont-store']) {
    assert.equal(savedText.includes(secret), false, secret);
  }
  const restored = loadStudioV2WorkingDraft(null, storage);
  assert.equal(restored.approval.rightsConfirmed, false);
  assert.equal(restored.approval.finalDesignApproved, false);
  assert.equal(restored.bootleg.sides.front.confirmed, false);
  assert.equal(restored.memorial.sides.front.confirmed, false);
});

test('drafts are account-scoped and expire after two hours', () => {
  const storage = memoryStorage();
  const alice = { id: 'alice' };
  const bob = { id: 'bob' };
  assert.equal(saveStudioV2WorkingDraft(populated(), alice, storage, 1000), true);
  assert.equal(loadStudioV2WorkingDraft(bob, storage, 1001), null);
  assert.ok(loadStudioV2WorkingDraft(alice, storage, 1000 + STUDIO_V2_WORKING_DRAFT_TTL_MS));
  assert.equal(loadStudioV2WorkingDraft(alice, storage, 1001 + STUDIO_V2_WORKING_DRAFT_TTL_MS), null);
});

test('explicit discard clears draft and invalid or unavailable storage fails closed', () => {
  const storage = memoryStorage();
  saveStudioV2WorkingDraft(populated(), null, storage, 1000);
  clearStudioV2WorkingDraft(null, storage);
  assert.equal(loadStudioV2WorkingDraft(null, storage, 1001), null);
  storage.setItem('gdp.custom-studio.working-draft.v1__guest', '{bad-json');
  assert.equal(loadStudioV2WorkingDraft(null, storage), null);
  const blocked = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('disabled'); }, removeItem() { throw new Error('disabled'); } };
  assert.equal(saveStudioV2WorkingDraft(populated(), null, blocked), false);
  assert.equal(loadStudioV2WorkingDraft(null, blocked), null);
});

test('Studio wiring keeps cart edits first, flushes on pagehide, clears on reset and cart success', () => {
  const page = readFileSync(new URL('../src/pages/CustomStudioV2.jsx', import.meta.url), 'utf8');
  assert.match(page, /initialStudioDraftRef\.current\?\.version === 1/);
  assert.match(page, /loadStudioV2WorkingDraft\(user\)/);
  assert.match(page, /refreshStudioV2DraftAssets\(saved\)/);
  assert.match(page, /createStudioV2ReuseState\(refreshed, false\)/);
  assert.match(page, /window\.addEventListener\('pagehide', flush\)/);
  assert.match(page, /action\.type === 'RESET'[\s\S]*clearStudioV2WorkingDraft\(user\)/);
  assert.match(page, /draftFinalizedRef\.current = true;\s*clearStudioV2WorkingDraft\(user\)/);
  assert.match(page, /if \(!draftRecoveryReady\) return/);
  assert.match(page, /if \(loading\) return/);
});
