import fs from 'node:fs';
import { sortApparelSizes } from '../src/lib/productVariants.js';

const touch = fs.readFileSync('src/components/storefront/custom-studio-v2/useTouchTransformV2.js', 'utf8');
const protectedEditor = fs.readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const state = fs.readFileSync('src/lib/customStudioV2State.js', 'utf8');
const mobileCss = fs.readFileSync('src/components/storefront/custom-studio-v2/customStudioV2MobileRepair.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

assert(
  JSON.stringify(sortApparelSizes(['L', 'XL', 'S', '2XL', 'M', '3XL'])) === JSON.stringify(['S', 'M', 'L', 'XL', '2XL', '3XL']),
  'garment sizes use canonical apparel order'
);
assert(
  JSON.stringify(sortApparelSizes(['Large', 'X-Large', 'Small', '2X-Large', 'Medium', '3X-Large'])) === JSON.stringify(['Small', 'Medium', 'Large', 'X-Large', '2X-Large', '3X-Large']),
  'long-form garment sizes use the same canonical order'
);
assert(state.includes('return sortApparelSizes(values);'), 'Custom Studio V2 uses shared canonical size sorting');

assert(touch.includes('onContextMenu: suppressNativeGesture'), 'selected canvas layers suppress the native context menu');
assert(touch.includes('onDragStart: suppressNativeGesture'), 'selected canvas layers suppress native image dragging');
assert(touch.includes("WebkitTouchCallout: enabled ? 'none' : 'default'"), 'selected canvas layers suppress the iOS long-press callout');
assert(mobileCss.includes('[data-gdp-bootleg-preview-canvas] img'), 'iOS callout containment is scoped to the Bootleg preview');
assert(mobileCss.includes('[data-gdp-garment-mode="focused"] [data-gdp-selected-garment-summary="true"]'), 'phone focused garment mode removes duplicate summary content');

assert(protectedEditor.includes('const uploadInFlightRef = useRef(false);'), 'photo uploader has an in-flight duplicate-request guard');
assert(protectedEditor.includes('if (!incoming.length || uploadInFlightRef.current) return;'), 'cancelled photo picker is silent and duplicate upload starts are ignored');
assert(protectedEditor.includes('Existing photos were kept.'), 'partial photo upload failures explicitly preserve successful/existing photos');
assert(protectedEditor.includes('const failed = [];'), 'photo uploads track failures per file instead of rolling back the batch');

assert(protectedEditor.includes('const syncStickers = (next, activeId = \'\') =>'), 'sticker changes use one deterministic layer synchronizer');
assert(protectedEditor.includes('const activeId = latestEditor.activeStickerId || activeSticker?.id || \'\';'), 'sticker edit/delete operations resolve the latest active layer id');
assert(protectedEditor.includes('data-gdp-delete-selected-sticker="true"'), 'placed sticker deletion has an explicit regression-verifier target');
assert(protectedEditor.includes('data-gdp-sticker-layer-list="true"'), 'sticker library is separated from placed sticker instances');
assert(protectedEditor.includes('data-gdp-sticker-layer-id={layer.id}'), 'rendered sticker instances expose their unique layer id');

if (process.exitCode) process.exit(process.exitCode);
console.log('Custom Studio mobile editor safety verification passed.');
