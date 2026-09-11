import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitSeasonalArtwork, normalizeSeasonalTextStyle, seasonalSelection } from '../src/lib/seasonalArtwork.js';
let checks = 0;
const check = (test, message = 'Seasonal verification failed') => { assert.ok(test, message); checks++; };
const art = { id: 'fixture', source_sha256: 'version1', aspect_ratio: 2, max_width_in: 8, max_height_in: 4, customizable: true };
for (const area of [{ width: 4, height: 5 }, { width: 10, height: 11 }, { width: 6, height: 7 }]) {
  for (const width of [0, .1, 2, 100, -1]) {
    const box = fitSeasonalArtwork(art, area, width, 999, -50);
    check(box.width <= art.max_width_in && box.height <= art.max_height_in);
    check(box.x >= 0 && box.y >= 0 && box.x + box.width <= area.width + .0001 && box.y + box.height <= area.height + .0001);
    check(Math.abs(box.width / box.height - art.aspect_ratio) < .0001);
  }
}
check(fitSeasonalArtwork(null, { width: 10, height: 10 }, 5) === null);
check(fitSeasonalArtwork({ ...art, aspect_ratio: NaN }, { width: 10, height: 10 }, 5) === null);
const layout = fitSeasonalArtwork(art, { width: 10, height: 10 }, 5);
const configured = seasonalSelection(art, layout, {
  name: 'Sam',
  message: 'Hello',
  color: '#ffffff',
  nameStyle: { fontFamily: 'Georgia', scale: 115, weight: 900, italic: true, align: 'center', curve: 18, color: '#d9273e', outlineWidth: 2, outlineColor: '#ffffff', shadow: true },
  messageStyle: { fontFamily: 'Trebuchet MS', scale: 90, weight: 600, letterSpacing: 1.5, color: '#111111' },
}, { width: 10, height: 10 });
check(configured.name === 'Sam' && configured.source_sha256 === 'version1' && configured.width === 5);
check(configured.version === 2, 'Seasonal configuration should use the text-style snapshot version.');
check(configured.text_styles?.name?.fontFamily === 'Georgia' && configured.text_styles?.name?.curve === 18, 'Name typography must persist in the production configuration.');
check(configured.text_styles?.message?.fontFamily === 'Trebuchet MS' && configured.text_styles?.message?.letterSpacing === 1.5, 'Message typography must persist in the production configuration.');
check(seasonalSelection({ ...art, customizable: false }, layout, { name: 'Sam', message: 'Hello' }, { width: 10, height: 10 }).name === '');
check(seasonalSelection(art, layout, { name: 'a'.repeat(100), message: 'b'.repeat(100), color: 'red' }, { width: 10, height: 10 }).name.length === 32);
check(seasonalSelection(art, layout, { name: '', message: 'b'.repeat(100), color: 'red' }, { width: 10, height: 10 }).text_color === '#111111');
const normalized = normalizeSeasonalTextStyle({ fontFamily: 'Comic Sans MS', scale: 999, weight: 123, curve: -999, color: 'not-a-color' });
check(normalized.fontFamily === 'Arial' && normalized.scale === 150 && normalized.weight === 700 && normalized.curve === -40 && normalized.color === '#111111', 'Seasonal text style must clamp and sanitize customer-controlled values.');

// Protect the customer-visible Cart -> Edit design -> restore -> replace flow.
const studioSource = readFileSync(new URL('../src/components/storefront/SeasonalStudio.jsx', import.meta.url), 'utf8');
const personalizationSource = readFileSync(new URL('../src/components/storefront/SeasonalPersonalizationEditor.jsx', import.meta.url), 'utf8');
const cartSource = readFileSync(new URL('../src/pages/Cart.jsx', import.meta.url), 'utf8');
const sourceCheck = (source, fragment, message) => check(source.includes(fragment), message);

sourceCheck(studioSource, "initialDraft?.artworkId", 'Seasonal Studio must consume the saved artwork id.');
sourceCheck(studioSource, "setRequested(Number(initialDraft.width || 0))", 'Seasonal Studio must restore saved artwork sizing.');
sourceCheck(studioSource, "setPosition(initialDraft.position || { x: 0, y: 0 })", 'Seasonal Studio must restore saved artwork position.');
sourceCheck(studioSource, "setRotation(Number(initialDraft.rotation || 0))", 'Seasonal Studio must restore saved artwork rotation.');
sourceCheck(studioSource, "normalizeSeasonalTextState(initialDraft.text ||", 'Seasonal Studio must restore and normalize saved personalization.');
sourceCheck(studioSource, "if (editCartKey) replaceItem(editCartKey, cartItem)", 'Editing a saved design must replace the same cart item.');
sourceCheck(studioSource, "approvedPreviewRef", 'Seasonal Studio must keep a dedicated approved mockup capture frame.');
sourceCheck(studioSource, "seasonalSummary", 'Seasonal cart items must retain structured production details.');
sourceCheck(studioSource, "textStyles: configuration.text_styles", 'Seasonal cart/design data must retain exact typography settings.');
sourceCheck(cartSource, "state={{ seasonalDraft: item.seasonalDraft, editCartKey: item.key }}", 'Cart Edit design must pass the exact saved seasonal draft and cart key.');
sourceCheck(cartSource, 'fittingType="contain"', 'Custom cart previews must remain uncropped.');

// Protect the refined personalization UX without changing production payload limits.
sourceCheck(studioSource, '<SeasonalPersonalizationEditor', 'Personalization editor must live in the Seasonal Studio garment workflow.');
sourceCheck(personalizationSource, 'Personalize your design', 'Personalization controls must keep the guided editing card.');
sourceCheck(personalizationSource, 'maxLength={32}', 'Name input must preserve the 32-character production limit.');
sourceCheck(personalizationSource, 'maxLength={60}', 'Message input must preserve the 60-character production limit.');
sourceCheck(personalizationSource, '<textarea id="seasonal-personalization-message"', 'Personalization message should remain a multi-line editing control.');
sourceCheck(personalizationSource, 'Clear personalization', 'Customers must be able to clear optional personalization in one action.');
sourceCheck(personalizationSource, 'Suggested:', 'Personalization text colours must surface a recommended contrast choice.');
sourceCheck(personalizationSource, 'hasLowContrast', 'Personalization controls must warn when the chosen text colour may have weak garment contrast.');
sourceCheck(personalizationSource, 'Applied to garment preview', 'Personalization controls must confirm live preview application.');
sourceCheck(personalizationSource, 'SEASONAL_TEXT_FONTS', 'Customers must have a curated font selector.');
sourceCheck(personalizationSource, 'Curve ·', 'Customers must be able to curve seasonal name/message text.');
sourceCheck(personalizationSource, 'Outline ·', 'Customers must be able to add a print-safe text outline.');
sourceCheck(personalizationSource, 'Shadow', 'Customers must be able to toggle a text shadow.');
check(!personalizationSource.includes('<select value={text.color}'), 'Text colour should use visual choices instead of the old native select.');

console.log(`${checks} seasonal sizing, snapshot, edit-design, and personalization regression checks passed`);
