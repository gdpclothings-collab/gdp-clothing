import '../tests/studio-layer-focus-flexible-curve.test.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  PREMIUM_TEXT_STYLES,
  applyPremiumTextPreset,
  normalizePremiumTextPresets,
  paintPremiumTextGlyph,
  paintPremiumTextLayout,
  premiumTextEffectPadding,
  premiumTextPreset,
} from '../src/lib/customStudioV2PremiumTextStyles.js';
import { buildBootlegTextStatePatch, resolveBootlegTextLayers } from '../src/lib/customStudioV2BootlegTextLayers.js';
import { constrainBootlegTextStyleToCanvas } from '../src/lib/customStudioV2BootlegTextLayout.js';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (path) => readFileSync(resolve(directory, path), 'utf8');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks += 1; }

check(PREMIUM_TEXT_STYLES.length === 10, 'Exactly ten premium styles');
check(new Set(PREMIUM_TEXT_STYLES.map(({ id }) => id)).size === 10, 'Unique, stable ids');
check(normalizePremiumTextPresets().every(({ enabled }) => enabled), 'All styles available by default');
const stormReference = premiumTextPreset('gold-chrome');
check(stormReference.label === 'Sunset Gold Chrome' && stormReference.family === 'Georgia, serif' && stormReference.fontWeight === 400, 'STORM reference keeps its Georgia regular typography');
check(stormReference.finish === 'sunset-emboss' && stormReference.outline === '#000000' && stormReference.extrusion === 0, 'STORM reference uses the PSD black keyline without fabricated 3D extrusion');
check(stormReference.positions.length === stormReference.stops.length && stormReference.positions.every((position, index) => index === 0 || position > stormReference.positions[index - 1]), 'STORM metallic gradient stops are ordered');
check(stormReference.stops.length === 11 && stormReference.positions[0] === 1 - 4074 / 4096 && stormReference.positions.at(-1) === 1, 'STORM matches all 11 grayscale stop locations in source PSD');
check(stormReference.stops[0] === '#f7e867' && stormReference.stops[1] === '#ffffff' && stormReference.stops.at(-1) === '#c25c65', 'STORM reproduces Sunset Skintones adjustment over source grayscale stops');
const reordered = normalizePremiumTextPresets([{ id: 'gold-chrome', enabled: false, order: 100 }, { id: 'neon-glow', order: -1 }]);
check(reordered[0].id === 'neon-glow' && reordered.at(-1).id === 'gold-chrome' && reordered.at(-1).enabled === false, 'Admin disable and ordering honored');

for (const preset of PREMIUM_TEXT_STYLES) {
  check(Boolean(premiumTextPreset(preset.id)) && preset.stops.length >= 3, `${preset.label}: gradient recipe`);
  const original = { fontScale: 340, canvasX: 71, canvasY: 25, rotation: 18, freeTextLayout: true, effect: 'shadow' };
  const applied = applyPremiumTextPreset(original, preset.id);
  check(applied.canvasX === 71 && applied.canvasY === 25 && applied.fontScale === 340 && applied.rotation === 18, `${preset.label}: switching does not move/resize`);
  check(applied.premiumTextPresetId === preset.id && applied.fontFamily === preset.family && applied.curve === 'straight', `${preset.label}: editable recipe applied`);
  const serialized = JSON.parse(JSON.stringify(buildBootlegTextStatePatch({}, [{ id: 'text-one', name: 'Text 1', text: { headline: 'STORM' }, style: applied }], 'text-one')));
  const reopened = resolveBootlegTextLayers(serialized, {})[0];
  check(reopened.text.headline === 'STORM' && reopened.style.premiumTextPresetId === preset.id && reopened.style.canvasX === 71, `${preset.label}: saved draft roundtrip`);

  const zone = { x: 12, y: 78, width: 76, height: 16 };
  const text = { headline: 'STORM' };
  const scaleToPrint = 3.6;
  const preview = constrainBootlegTextStyleToCanvas({ text, zone, style: applied, width: 1000, height: 1200 });
  const production = constrainBootlegTextStyleToCanvas({ text, zone, style: applied, width: 1000 * scaleToPrint, height: 1200 * scaleToPrint });
  check(!preview.layout.overflow.any && !production.layout.overflow.any, `${preset.label}: print boundary safe`);
  check(Math.abs(preview.layout.horizontalFit - production.layout.horizontalFit) < 0.002, `${preset.label}: preview and 300 DPI auto-fit parity`);
  check(Math.abs(preview.layout.centerX / 1000 - production.layout.centerX / (1000 * scaleToPrint)) < 0.002, `${preset.label}: resolution-independent placement`);
}

check(premiumTextEffectPadding({ premiumTextPresetId: 'retro-3d', premiumDepthScale: 200 }, 40) > premiumTextEffectPadding({ premiumTextPresetId: 'retro-3d', premiumDepthScale: 0 }, 40), 'Bounds include editable extrusion');
check(applyPremiumTextPreset({ canvasX: 20, fontScale: 180, premiumTextPresetId: 'gold-chrome' }, '').premiumTextPresetId === '', 'Basic/custom exits premium mode safely');

const calls = [];
const gradient = { addColorStop: (...args) => calls.push(['color-stop', ...args]) };
const context = new Proxy({
  createLinearGradient: () => { calls.push(['gradient']); return gradient; },
  fillText: (...args) => calls.push(['fill', ...args]),
  strokeText: (...args) => calls.push(['stroke', ...args]),
  save: () => calls.push(['save']),
  restore: () => calls.push(['restore']),
  translate: (...args) => calls.push(['translate', ...args]),
  rotate: (...args) => calls.push(['rotate', ...args]),
  scale: (...args) => calls.push(['scale', ...args]),
}, { get(target, key) { return target[key]; }, set(target, key, value) { target[key] = value; return true; } });
const style = applyPremiumTextPreset({ fontScale: 100 }, 'silver-chrome');
paintPremiumTextLayout(context, { centerX: 500, horizontalFit: 0.8, headline: { kind: 'straight', text: 'GDP', x: 500, y: 400, fontSize: 80, rotation: 0 } }, style);
check(calls.some(([method]) => method === 'gradient') && calls.some(([method]) => method === 'stroke') && calls.some(([method]) => method === 'fill') && calls.some(([method]) => method === 'scale'), 'One shared Canvas painter implements gradient/outline/depth and layout auto-fit');

const stormDrawCalls = [];
const stormContext = new Proxy({
  createLinearGradient: (_x0, top, _x1, bottom) => { stormDrawCalls.push(['bounds', top, bottom]); return { addColorStop: (position, color) => stormDrawCalls.push(['stop', position, color]) }; },
  measureText: () => ({ actualBoundingBoxAscent: 40, actualBoundingBoxDescent: -5 }),
  fillText: () => stormDrawCalls.push(['fill']),
  strokeText: () => stormDrawCalls.push(['stroke', stormContext.strokeStyle, stormContext.lineWidth, stormContext.shadowColor]),
  save: () => {}, restore: () => {},
}, { get(target, key) { return target[key]; }, set(target, key, value) { target[key] = value; return true; } });
check(paintPremiumTextGlyph(stormContext, 'STORM', 0, 0, 100, applyPremiumTextPreset({}, 'gold-chrome')), 'STORM paints editable glyphs');
const stormStrokes = stormDrawCalls.filter(([method]) => method === 'stroke');
check(stormStrokes[0][1] === '#ffffff' && stormStrokes[1][1] === '#000000' && stormStrokes[0][2] > stormStrokes[1][2], 'STORM retains PSD white-then-black outside stroke layering');
check(stormStrokes[0][3] === 'transparent' && stormStrokes[1][3] === 'transparent', 'STORM strokes cannot inherit shadows from another artwork layer');
check(stormDrawCalls.filter(([method]) => method === 'stop').length === 11, 'STORM full gradient is passed to production Canvas');
check(stormDrawCalls.some(([method, position, color]) => method === 'stop' && position === 1 - 3762 / 4096 && color === '#ffffff'), 'STORM white metallic shine is retained at original PSD stop');
check(stormDrawCalls.some(([method, top, bottom]) => method === 'bounds' && top === -40 && bottom === -5), 'STORM gradient spans real glyph bounds, including negative descent');

const protectedPreview = source('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx');
const productionRenderer = source('src/lib/customStudioV2ProtectedProduction.js');
const admin = source('src/components/admin/CustomStudioAdminModule.jsx');
check(protectedPreview.includes('paintPremiumTextLayout(context, layout, style)') && productionRenderer.includes('paintPremiumTextLayout(context, layout, safeStyle)'), 'Preview and production call the same painter');
check(protectedPreview.includes('data-gdp-premium-text-presets') && admin.includes('data-gdp-admin-premium-text'), 'Customer gallery and admin settings both wired');
check(protectedPreview.includes("? 'Emboss intensity' : '3D depth'"), 'PSD style exposes emboss intensity without relabeling the other nine depth controls');
check(productionRenderer.includes('renderProtectedStudioV2PngAdvanced') && source('src/pages/CustomStudioV2.jsx').includes('dpi: 300'), 'Production still exports at 300 DPI');

console.log(`PASS: premium lettering ${checks} checks, 10 editable presets, saved-design and shared paint geometry.`);
