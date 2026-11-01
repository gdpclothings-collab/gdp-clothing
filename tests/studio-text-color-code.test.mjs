import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STUDIO_TEXT_COLOR_PRESETS,
  parseStudioHexColorCode,
  studioHexColorForInput,
} from '../src/lib/customStudioV2ColorCode.js';

const editor = readFileSync(new URL('../src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', import.meta.url), 'utf8');
const production = readFileSync(new URL('../src/lib/customStudioV2ProtectedProduction.js', import.meta.url), 'utf8');

test('HEX parsing accepts exact six-digit colors and expands optional shorthand safely', () => {
  assert.equal(parseStudioHexColorCode('#1a2b3c'), '#1A2B3C');
  assert.equal(parseStudioHexColorCode('ff00cc'), '#FF00CC');
  assert.equal(parseStudioHexColorCode(' #abc '), '#AABBCC');
  assert.equal(parseStudioHexColorCode('F0a'), '#FF00AA');
  assert.equal(studioHexColorForInput('bad'), '#BBAADD');
  assert.equal(studioHexColorForInput('nope', '#123456'), '#123456');
  assert.equal(studioHexColorForInput('nope', 'invalid'), '#FFFFFF');
  for (const invalid of [null, undefined, '', '#', '#12', '#1234', '#12345', '#1234567', 'rgb(1,2,3)', 'url(x)', '#GGHHII']) {
    assert.equal(parseStudioHexColorCode(invalid), null, String(invalid));
  }
});

test('eight print-friendly swatches have unique, valid and accessible labels', () => {
  assert.equal(STUDIO_TEXT_COLOR_PRESETS.length, 8);
  assert.equal(new Set(STUDIO_TEXT_COLOR_PRESETS.map((p) => p.value)).size, 8);
  for (const item of STUDIO_TEXT_COLOR_PRESETS) {
    assert.ok(item.name);
    assert.equal(parseStudioHexColorCode(item.value), item.value);
  }
});

test('Text Effects offer an editable HEX code, visual picker and swatches with safe draft updates', () => {
  assert.match(editor, /function StudioHexColorControl\(\{ label, value, onChange, showSwatches = true \}\)/);
  assert.match(editor, /data-gdp-text-color-code=\{label\}/);
  assert.match(editor, /aria-label=\{\x60\$\{label\} HEX color code\x60\}/);
  assert.match(editor, /type="color" value=\{currentHex\}/);
  assert.match(editor, /aria-pressed=\{currentHex === preset\.value\}/);
  assert.match(editor, /\^#\?\[0-9A-F\]\{6\}\$/);
  assert.match(editor, /if \(valid\) onChange\(valid\)/);
  assert.match(editor, /onBlur=\{commitCode\}/);
  assert.match(editor, /textPanelTab === 'effects'/);
  assert.match(editor, /label=\{textStyle\.premiumTextPresetId \? 'Metallic accent' : 'Text color'\}/);
  assert.match(editor, /label="Outline color"/);
  assert.match(editor, /premiumAccentColor: value, color: value/);
  assert.match(editor, /premiumOutlineColor: value/);
  assert.match(editor, /<StudioHexColorControl label="Text color" value=\{textStyle\.color \|\| '#FFFFFF'\}/, 'legacy editor also supports HEX');
});

test('modern text tabs keep premium styles and curve adjustments available but collapsed', () => {
  assert.match(editor, /data-gdp-modern-text-editor="compact"/);
  assert.match(editor, /data-gdp-modern-text-controls="three-tabs"/);
  assert.match(editor, /role="tabpanel" aria-label="Text styling"/);
  assert.match(editor, /role="tabpanel" aria-label="Text position"/);
  assert.match(editor, /role="tabpanel" aria-label="Text effects"/);
  assert.match(editor, /data-gdp-text-curve-precision="collapsed"/);
  assert.match(editor, /data-gdp-premium-style-picker="collapsed"/);
  assert.equal((editor.match(/<FlexibleCurveControl style=\{textStyle\} onChange=\{patchTextStyle\}/g) || []).length, 2);
  assert.match(editor, /data-gdp-premium-text-presets="true"/);
  assert.match(editor, /data-gdp-text-edge-align="safe-print-boundary"/);
  assert.match(editor, /data-gdp-bootleg-text-size="print-area-constrained"/);
  assert.match(editor, /patchTextStyle\(\{ textEdgeCrop: true, canvasX, canvasY \}\)/);
  assert.match(production, /photoLayers\(editor\)/, 'production renderer remains independent of UI refactoring');
});

test('Copy/Delete text actions target the clicked row and preserve the other layers', () => {
  assert.match(editor, /data-gdp-text-layer-row=\{layer\.id\}/);
  assert.match(editor, /onClick=\{\(\) => duplicateActiveTextLayer\(layer\.id\)\}/);
  assert.match(editor, /onClick=\{\(\) => deleteActiveTextLayer\(layer\.id\)\}/);
  assert.match(editor, /const source = bootlegTextLayers\.find\(\(layer\) => layer\.id === textId\)/);
  assert.match(editor, /remaining = bootlegTextLayers\.filter\(\(layer\) => layer\.id !== textId\)/);
  assert.match(editor, /next\.splice\(next\.findIndex\(\(layer\) => layer\.id === textId\) \+ 1, 0, duplicate\)/);
});
