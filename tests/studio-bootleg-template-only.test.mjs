import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createInitialStudioV2State,
  studioV2PrintableSides,
  studioV2SideHasContent,
  studioV2CanContinue,
  studioV2MissingArtworkMessage,
} from '../src/lib/customStudioV2State.js';
import { allowsTemplateOnlyBootleg } from '../supabase/functions/checkout/template-only-bootleg-rules.mjs';

const blank = () => createInitialStudioV2State();
const sealedSide = (side, templateId = 'gdp-protected-template') => ({
  version: 3, designPath: 'bootleg', side, templateId, photos: [],
  printArea: { widthIn: 10, heightIn: 12, dpi: 300 },
});
function validPackage(sides = ['front', 'back']) {
  return {
    designPath: 'bootleg', isLockedRender: true, expectedSides: sides,
    renderSnapshot: {
      version: 7, studio: 'v2', designPath: 'bootleg',
      sides: Object.fromEntries(sides.map((side) => [side, sealedSide(side)])),
    },
    productionFiles: Object.fromEntries(sides.map((side) => [side, {
      path: `guest/12345678-1234-4234-8234-123456789abc/${side}.png`,
      dpi: 300, width_px: 3000, height_px: 3600,
    }])),
  };
}

test('a selected Photo Bootleg template alone prints on Front', () => {
  const state = blank();
  state.designPath = 'bootleg';
  state.bootleg.sides.front.templateId = 'protected-front';
  assert.deepEqual(studioV2PrintableSides(state), ['front']);
  assert.equal(studioV2SideHasContent(state, 'back'), false);
  assert.equal(studioV2MissingArtworkMessage(state), '');
});

test('Photo Bootleg template-only Front + Back is approvable without photos', () => {
  const state = blank();
  state.designPath = 'bootleg';
  for (const side of ['front', 'back']) {
    state.bootleg.sides[side].templateId = `gdp-${side}`;
    state.bootleg.sides[side].confirmed = true;
  }
  state.approval.finalDesignApproved = true;
  state.approval.rightsConfirmed = true;
  assert.deepEqual(studioV2PrintableSides(state), ['front', 'back']);
  assert.equal(studioV2CanContinue({ ...state, step: 'customize' }), true);
  state.bootleg.sides.back.confirmed = false;
  assert.equal(studioV2CanContinue({ ...state, step: 'customize' }), false);
});

test('empty designs, Memorial without photo and Upload without artwork stay blocked', () => {
  const state = blank();
  state.designPath = 'bootleg';
  assert.deepEqual(studioV2PrintableSides(state), []);
  assert.match(studioV2MissingArtworkMessage(state), /template/i);
  state.designPath = 'memorial';
  state.memorial.sides.front.templateId = 'memorial-template';
  assert.deepEqual(studioV2PrintableSides(state), []);
  state.designPath = 'upload';
  assert.deepEqual(studioV2PrintableSides(state), []);
});

test('backend permits locked template-only Front, Back, and both sides', () => {
  for (const sides of [['front'], ['back'], ['front', 'back']]) {
    assert.equal(allowsTemplateOnlyBootleg(validPackage(sides)), true);
  }
});

test('backend rejects incomplete, unapproved, wrong-purpose or template-less layouts', () => {
  const checks = [
    (p) => { p.designPath = 'memorial'; },
    (p) => { p.isLockedRender = false; },
    (p) => { p.renderSnapshot.studio = 'v1'; },
    (p) => { p.renderSnapshot.designPath = 'upload'; },
    (p) => { p.renderSnapshot.version = 6; },
    (p) => { p.renderSnapshot.sides.back.templateId = ''; },
    (p) => { p.renderSnapshot.sides.front.designPath = 'memorial'; },
    (p) => { p.renderSnapshot.sides.back.side = 'front'; },
    (p) => { p.renderSnapshot.sides.front.photos.push({ path: 'photo.png' }); },
    (p) => { delete p.renderSnapshot.sides.back; },
    (p) => { delete p.productionFiles.back; },
    (p) => { p.productionFiles.front.dpi = 72; },
    (p) => { p.productionFiles.front.width_px = 599; },
    (p) => { p.expectedSides.push('front'); },
  ];
  for (const tweak of checks) {
    const p = validPackage(); tweak(p);
    assert.equal(allowsTemplateOnlyBootleg(p), false);
  }
});

test('renderer and editor allow template-only Bootleg but keep Memorial photo-required and 300 DPI', () => {
  const renderer = fs.readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
  const studio = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
  const editor = fs.readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
  const edge = fs.readFileSync('supabase/functions/checkout/index.ts', 'utf8');
  assert.match(renderer, /designPath !== 'bootleg' && !photos\.length/);
  assert.match(renderer, /drawTemplateArtwork\(output\.context/);
  assert.match(studio, /designPath: state\.designPath, profile: resolveStudioV2PrintProfile, dpi: 300/);
  assert.match(editor, /disabled=\{!template \|\| \(isMemorial && !photos\.length\)\}/);
  assert.match(editor, /designPath: path/);
  assert.match(edge, /allowsTemplateOnlyBootleg\(\{/);
  assert.ok(edge.indexOf('allowsTemplateOnlyBootleg({') > edge.indexOf('const isLockedRender ='));
  assert.match(edge, /verifyGuestDesignArtifactProofs\(service/);
});
