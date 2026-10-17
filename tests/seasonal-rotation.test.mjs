import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SEASONAL_WINDOWS, normalizeSeasonalRotation, resolveSeasonalFeature,
  orderSeasonalArtworks,
} from '../src/lib/seasonalRotation.js';

const artwork = (category, id) => ({ id, title: id, category, preview: 'data:image/webp;base64,aaaa', requires_name: false });
const art = [
  artwork('Fall / Autumn', 'fall-1'),
  artwork('Halloween', 'halloween-1'),
  artwork('Halloween', 'halloween-2'),
  artwork('Christmas', 'christmas-1'),
  artwork('Christmas', 'christmas-2'),
  artwork('New Year', 'new-year-1'),
  artwork('Easter', 'easter-1'),
  artwork('Thanksgiving', 'thanks-1'),
];

test('November 1 switches to Christmas; Halloween remains featured October 31', () => {
  assert.equal(resolveSeasonalFeature(undefined, art, { year: 2026, month: 10, day: 31 })?.category, 'Halloween');
  assert.equal(resolveSeasonalFeature(undefined, art, { year: 2026, month: 11, day: 1 })?.category, 'Christmas');
});

test('cross-year New Year campaign and Christmas do not collide', () => {
  assert.equal(resolveSeasonalFeature(undefined, art, { year: 2026, month: 12, day: 25 })?.category, 'Christmas');
  assert.equal(resolveSeasonalFeature(undefined, art, { year: 2026, month: 12, day: 27 })?.category, 'New Year');
  assert.equal(resolveSeasonalFeature(undefined, art, { year: 2027, month: 1, day: 1 })?.category, 'New Year');
});

test('moving holidays are calculated for the year, not frozen to one date', () => {
  assert.equal(resolveSeasonalFeature(undefined, art, { year: 2026, month: 3, day: 5 })?.category, 'Easter');
  assert.equal(resolveSeasonalFeature(undefined, art, { year: 2027, month: 3, day: 27 })?.category, 'Easter');
});

test('manual override and preferred artwork ID take precedence', () => {
  const manual = normalizeSeasonalRotation({ manual: true, manualCategory: 'Christmas', manualArtworkId: 'christmas-2' });
  assert.equal(resolveSeasonalFeature(manual, art, { year: 2026, month: 10, day: 16 })?.artwork.id, 'christmas-2');
  assert.equal(orderSeasonalArtworks(art, resolveSeasonalFeature(manual, art))[0].id, 'christmas-2');
});

test('unavailable preferred design falls back within the category, never to unrelated artwork', () => {
  const settings = normalizeSeasonalRotation({ windows: [
    { id: 'x', category: 'Christmas', start: '11-01', end: '12-26', featuredArtworkId: 'unpublished', priority: 99 },
  ] });
  assert.equal(resolveSeasonalFeature(settings, art, { year: 2026, month: 11, day: 1 })?.artwork.id, 'christmas-1');
  assert.equal(resolveSeasonalFeature(settings, [artwork('Halloween', 'x')], { year: 2026, month: 11, day: 1 }), null);
});

test('switch off prevents promotion and does not change the source collection order', () => {
  const settings = normalizeSeasonalRotation({ enabled: false });
  assert.equal(resolveSeasonalFeature(settings, art, { year: 2026, month: 11, day: 15 }), null);
  assert.deepEqual(orderSeasonalArtworks(art, null), art);
});

test('new artwork is discovered automatically and duplicate IDs are discarded', () => {
  const settings = normalizeSeasonalRotation({ windows: [
    { id: 'a', category: 'Christmas', start: '11-01', end: '12-26', priority: 10 },
    { id: 'a', category: 'Halloween', start: '09-30', end: '10-31', priority: 100 },
  ] });
  assert.equal(settings.windows.length, 1);
  const newArt = [artwork('Christmas', 'newly-uploaded')];
  assert.equal(resolveSeasonalFeature(settings, newArt, { year: 2026, month: 11, day: 20 })?.artwork.id, 'newly-uploaded');
});

test('default rotation includes both seasonal and Canadian holiday schedules', () => {
  assert.ok(DEFAULT_SEASONAL_WINDOWS.some(window => window.category === 'Christmas'));
  assert.ok(DEFAULT_SEASONAL_WINDOWS.some(window => window.category === 'Canada Day'));
  assert.equal(resolveSeasonalFeature(undefined, art, { year: 2026, month: 9, day: 20 })?.category, 'Thanksgiving');
});
