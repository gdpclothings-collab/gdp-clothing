// Customer-facing promotion selection only. Production artwork and saved designs are never mutated.
export const SEASONAL_TIMEZONE = 'America/Regina';

export const DEFAULT_SEASONAL_WINDOWS = Object.freeze([
  { id: 'valentines', category: 'Valentine’s Day', start: '01-14', end: '02-14', priority: 75 },
  { id: 'st-patricks', category: 'St. Patrick’s Day', start: '02-17', end: '03-17', priority: 65 },
  { id: 'easter', category: 'Easter', mode: 'easter', start: '03-01', end: '04-01', priority: 75 },
  { id: 'spring', category: 'Spring', start: '02-20', end: '04-30', priority: 15 },
  { id: 'mothers', category: 'Mother’s Day', mode: 'mothers', start: '04-01', end: '05-10', priority: 80 },
  { id: 'victoria', category: 'Victoria Day', mode: 'victoria', start: '04-18', end: '05-24', priority: 50 },
  { id: 'fathers', category: 'Father’s Day', mode: 'fathers', start: '05-20', end: '06-21', priority: 80 },
  { id: 'canada', category: 'Canada Day', start: '06-01', end: '07-01', priority: 90 },
  { id: 'summer', category: 'Summer', start: '05-21', end: '08-31', priority: 10 },
  { id: 'july-fourth', category: 'July 4th', start: '06-04', end: '07-04', priority: 40 },
  { id: 'fall', category: 'Fall / Autumn', start: '08-22', end: '11-01', priority: 15 },
  { id: 'thanksgiving', category: 'Thanksgiving', mode: 'thanksgiving', start: '09-01', end: '10-12', priority: 85 },
  { id: 'halloween', category: 'Halloween', start: '09-30', end: '10-31', priority: 95 },
  { id: 'christmas', category: 'Christmas', start: '11-01', end: '12-26', priority: 100 },
  { id: 'winter', category: 'Winter', start: '11-21', end: '02-28', priority: 10 },
  { id: 'new-year', category: 'New Year', start: '12-27', end: '01-02', priority: 95 },
]);

export const SEASONAL_DATE_MODES = Object.freeze([
  { value: 'fixed', label: 'Recurring month/day' },
  { value: 'easter', label: 'Easter — date changes yearly' },
  { value: 'mothers', label: 'Mother’s Day — second Sunday in May' },
  { value: 'fathers', label: 'Father’s Day — third Sunday in June' },
  { value: 'thanksgiving', label: 'Canadian Thanksgiving — second Monday in October' },
  { value: 'victoria', label: 'Victoria Day — Monday before May 25' },
]);

const datePart = value => /^\d{2}-\d{2}$/.test(String(value)) && (() => {
  const [month, day] = value.split('-').map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(2024, month, 0)).getUTCDate();
})();

const normalizeCategory = value => String(value || '').normalize('NFKC').replace(/[’‘]/g, "'").trim().toLocaleLowerCase('en-CA');

export function normalizeSeasonalRotation(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const source = Array.isArray(raw.windows) ? raw.windows : DEFAULT_SEASONAL_WINDOWS;
  const ids = new Set();
  const windows = source.slice(0, 100).map((item, index) => {
    if (!item || typeof item !== 'object') return null;
    const category = String(item.category || '').trim().slice(0, 100);
    const id = String(item.id || `season-${index}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!id || !category || ids.has(id)) return null;
    ids.add(id);
    return {
      id, category,
      mode: SEASONAL_DATE_MODES.some(option => option.value === item.mode) ? item.mode : 'fixed',
      start: datePart(item.start) ? item.start : '11-01',
      end: datePart(item.end) ? item.end : '12-26',
      enabled: item.enabled !== false,
      priority: Math.min(1000, Math.max(0, Number(item.priority) || 0)),
      featuredArtworkId: String(item.featuredArtworkId || ''),
    };
  }).filter(Boolean);
  return {
    enabled: raw.enabled !== false,
    manual: raw.manual === true,
    manualCategory: String(raw.manualCategory || '').trim().slice(0, 100),
    manualArtworkId: String(raw.manualArtworkId || ''),
    windows,
  };
}

// Returns a local-business calendar date regardless of visitor timezone.
export function seasonalToday(now = new Date(), timezone = SEASONAL_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return { year: value.year, month: value.month, day: value.day };
}

const toDay = date => Date.UTC(date.year, date.month - 1, date.day) / 86400000;
const easterDate = year => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k + 70) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31);
  return { year, month, day: ((h + l - 7 * m + 114) % 31) + 1 };
};
const nthWeekday = (year, month, weekday, nth) => {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return { year, month, day: 1 + ((weekday - first + 7) % 7) + 7 * (nth - 1) };
};
const movingDate = (mode, year) => {
  if (mode === 'easter') return easterDate(year);
  if (mode === 'mothers') return nthWeekday(year, 5, 0, 2);
  if (mode === 'fathers') return nthWeekday(year, 6, 0, 3);
  if (mode === 'thanksgiving') return nthWeekday(year, 10, 1, 2);
  if (mode === 'victoria') {
    const day = 24, weekday = new Date(Date.UTC(year, 4, day)).getUTCDay();
    return { year, month: 5, day: day - ((weekday + 6) % 7) };
  }
  return null;
};
const monthEarlier = date => {
  const month = date.month === 1 ? 12 : date.month - 1;
  const year = date.month === 1 ? date.year - 1 : date.year;
  return { year, month, day: Math.min(date.day, new Date(Date.UTC(year, month, 0)).getUTCDate()) };
};
const fixedDate = (date, year) => {
  const [month, day] = date.split('-').map(Number);
  return { year, month, day: Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate()) };
};
function activeWindow(window, today) {
  for (let year = today.year - 1; year <= today.year + 1; year += 1) {
    let start, end;
    if (window.mode !== 'fixed') {
      end = movingDate(window.mode, year);
      start = end && monthEarlier(end);
    } else {
      start = fixedDate(window.start, year);
      end = fixedDate(window.end, year);
      if (toDay(end) < toDay(start)) end = fixedDate(window.end, year + 1);
    }
    if (start && end && toDay(today) >= toDay(start) && toDay(today) <= toDay(end)) return true;
  }
  return false;
}

export function resolveSeasonalFeature(input, artworks, date = seasonalToday()) {
  const settings = normalizeSeasonalRotation(input);
  if (!settings.enabled || !Array.isArray(artworks) || artworks.length === 0) return null;
  const ready = artworks.filter(artwork => artwork && artwork.id && artwork.preview && !artwork.requires_name);
  const fromCategory = (category, id) => {
    const options = ready.filter(artwork => normalizeCategory(artwork.category) === normalizeCategory(category));
    if (!options.length) return null;
    return options.find(artwork => String(artwork.id) === String(id)) || options[0];
  };
  if (settings.manual) {
    const artwork = fromCategory(settings.manualCategory, settings.manualArtworkId);
    return artwork ? { artwork, category: artwork.category, source: 'manual' } : null;
  }
  const windows = settings.windows.filter(window => window.enabled && activeWindow(window, date))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const window of windows) {
    const artwork = fromCategory(window.category, window.featuredArtworkId);
    if (artwork) return { artwork, category: artwork.category, source: 'schedule', scheduleId: window.id };
  }
  return null;
}

export function orderSeasonalArtworks(artworks, feature) {
  if (!feature) return artworks;
  const category = normalizeCategory(feature.category);
  return artworks.map((artwork, index) => ({ artwork, index })).sort((a, b) => {
    const rank = item => String(item.artwork.id) === String(feature.artwork.id) ? 0 :
      normalizeCategory(item.artwork.category) === category ? 1 : 2;
    return rank(a) - rank(b) || a.index - b.index;
  }).map(item => item.artwork);
}
