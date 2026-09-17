from pathlib import Path
import re

production_path = Path('src/lib/customStudioV2Production.js')
production = production_path.read_text()
replacement = r'''function configuredPrintProfile(product, size, side) {
  const guide = product?.customization?.preview?.printGuide?.[side];
  if (!guide || typeof guide !== 'object') return null;

  const overrides = guide.sizeOverrides && typeof guide.sizeOverrides === 'object' ? guide.sizeOverrides : {};
  const wantedSize = normalizeToken(size);
  const overrideKey = Object.keys(overrides).find((key) => normalizeToken(key) === wantedSize);
  const sized = guide.sizeScalingEnabled === false ? {} : (overrideKey ? overrides[overrideKey] : {});
  const widthIn = Number(sized?.widthIn ?? guide.widthIn);
  const heightIn = Number(sized?.heightIn ?? guide.heightIn);
  if (!Number.isFinite(widthIn) || !Number.isFinite(heightIn) || widthIn <= 0 || heightIn <= 0) return null;

  const maxWidthIn = Number(guide.maxWidthIn);
  const maxHeightIn = Number(guide.maxHeightIn);
  const collarIn = Number(sized?.collarIn ?? guide.collarIn);
  return {
    widthIn: Number.isFinite(maxWidthIn) && maxWidthIn > 0 ? Math.min(widthIn, maxWidthIn) : widthIn,
    heightIn: Number.isFinite(maxHeightIn) && maxHeightIn > 0 ? Math.min(heightIn, maxHeightIn) : heightIn,
    ...(Number.isFinite(collarIn) && collarIn > 0 ? { collarIn } : {}),
    side,
    dpi: 300,
  };
}

function fallbackPrintProfile(product, size, side) {
  const key = normalizeToken([product?.name, product?.type, product?.category].filter(Boolean).join(' '));
  const normalizedSize = String(size || '').toUpperCase().replace(/\s+/g, '');
  const back = side === 'back';
  const toddlerSize = /^(2T|3T|4T|5T)$/.test(normalizedSize);

  if (key.includes('baby') || key.includes('bodysuit') || key.includes('onesie') || key.includes('infant')) {
    return { widthIn: 4, heightIn: 4, collarIn: back ? 1.75 : 1.5, side, dpi: 300 };
  }
  if (key.includes('toddler') || ((key.includes('youth') || key.includes('kids')) && toddlerSize)) {
    return { widthIn: 5.5, heightIn: 5.5, collarIn: back ? 2.5 : 2, side, dpi: 300 };
  }
  if (key.includes('youth') || key.includes('kids')) {
    const small = ['XS', 'S', 'YS'].includes(normalizedSize);
    if (back) return small
      ? { widthIn: 8.5, heightIn: 10, collarIn: 3, side, dpi: 300 }
      : { widthIn: 10, heightIn: 12, collarIn: 3, side, dpi: 300 };
    return small
      ? { widthIn: 8.5, heightIn: 8.5, collarIn: 2.5, side, dpi: 300 }
      : { widthIn: 10.5, heightIn: 10.5, collarIn: 2.5, side, dpi: 300 };
  }
  if (key.includes('hoodie') || key.includes('hooded')) {
    if (back) return normalizedSize === 'S'
      ? { widthIn: 11, heightIn: 13, collarIn: 5.5, side, dpi: 300 }
      : { widthIn: 12, heightIn: 14, collarIn: 5.5, side, dpi: 300 };
    return { widthIn: 11, heightIn: 10, collarIn: 3, side, dpi: 300 };
  }

  if (back) {
    if (normalizedSize === 'XS') return { widthIn: 10.5, heightIn: 12.5, collarIn: 4, side, dpi: 300 };
    if (normalizedSize === 'S') return { widthIn: 11, heightIn: 13, collarIn: 4, side, dpi: 300 };
    if (normalizedSize === 'M') return { widthIn: 11.5, heightIn: 13.5, collarIn: 4, side, dpi: 300 };
    return { widthIn: 12, heightIn: 14, collarIn: 4, side, dpi: 300 };
  }
  if (normalizedSize === 'XS') return { widthIn: 10, heightIn: 12.5, collarIn: 2.75, side, dpi: 300 };
  if (normalizedSize === 'S') return { widthIn: 10.5, heightIn: 13, collarIn: 2.75, side, dpi: 300 };
  if (normalizedSize === 'M') return { widthIn: 11, heightIn: 13.5, collarIn: 2.75, side, dpi: 300 };
  return { widthIn: 11.25, heightIn: 14, collarIn: 2.75, side, dpi: 300 };
}

export function resolveStudioV2PrintProfile(product, size, side = 'front') {
  const normalizedSide = side === 'back' ? 'back' : 'front';
  return configuredPrintProfile(product, size, normalizedSide)
    || fallbackPrintProfile(product, size, normalizedSide);
}

async function loadImage'''
pattern = re.compile(r"function pick\(map, key, fallback\) \{.*?\n\}\n\nexport function resolveStudioV2PrintProfile\(product, size, side = 'front'\) \{.*?\n\}\n\nasync function loadImage", re.S)
production, count = pattern.subn(replacement, production, count=1)
if count != 1:
    raise SystemExit(f'Production profile patch count was {count}, expected 1')
production_path.write_text(production)

helper = '''import { resolveStudioV2PrintProfile } from '@/lib/customStudioV2Production';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function garmentKind(product) {
  const token = [product?.name, product?.type, product?.category, product?.slug]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(baby|bodysuit|onesie|infant)/.test(token)) return 'baby';
  if (token.includes('toddler')) return 'toddler';
  if (/(youth|kids|kid)/.test(token)) return 'youth';
  if (/(hoodie|hooded)/.test(token)) return 'hoodie';
  if (/(crewneck|crew neck|sweatshirt|sweater)/.test(token) && !/(t-shirt|t shirt|tee|long sleeve)/.test(token)) return 'crewneck';
  return 'adult';
}

const DISPLAY_GEOMETRY = {
  baby: { maxWidthIn: 4, maxVisualWidth: 30, frontTop: 31, backTop: 29 },
  toddler: { maxWidthIn: 5.5, maxVisualWidth: 34, frontTop: 28, backTop: 26 },
  youth: { maxWidthIn: 10.5, maxVisualWidth: 40, frontTop: 25, backTop: 24 },
  hoodie: { maxWidthIn: 12, maxVisualWidth: 41, frontTop: 25, backTop: 28 },
  crewneck: { maxWidthIn: 12, maxVisualWidth: 43, frontTop: 23, backTop: 22 },
  adult: { maxWidthIn: 12, maxVisualWidth: 44, frontTop: 22, backTop: 21 },
};

function formatInches(value) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) return String(number);
  return String(Math.round(number * 100) / 100).replace(/0$/, '');
}

/**
 * Visual mapping of the exact recommended production area onto the garment mockup.
 * Physical width/height always come from resolveStudioV2PrintProfile, so preview,
 * Seasonal workspace and final 300-DPI output share the same source of truth.
 */
export function resolveStudioV2PrintGuide(product, size, side = 'front') {
  const normalizedSide = side === 'back' ? 'back' : 'front';
  const profile = resolveStudioV2PrintProfile(product, size, normalizedSide);
  const geometry = DISPLAY_GEOMETRY[garmentKind(product)] || DISPLAY_GEOMETRY.adult;
  const ratio = clamp(Number(profile.widthIn) / geometry.maxWidthIn, 0.5, 1);
  const widthPercent = Math.round(geometry.maxVisualWidth * ratio * 10) / 10;
  const topPercent = normalizedSide === 'back' ? geometry.backTop : geometry.frontTop;
  const dimensions = `${formatInches(profile.widthIn)} × ${formatInches(profile.heightIn)} in`;

  return {
    ...profile,
    label: dimensions,
    recommendationLabel: `Recommended print area: ${dimensions}`,
    style: {
      top: `${topPercent}%`,
      width: `${widthPercent}%`,
      aspectRatio: `${Number(profile.widthIn)} / ${Number(profile.heightIn)}`,
    },
  };
}
'''
Path('src/lib/customStudioV2PrintGuide.js').write_text(helper)

seasonal_path = Path('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx')
seasonal = seasonal_path.read_text()
old_rpc = "supabase.rpc('list_seasonal_artworks', { p_product: product.id, p_size: size })"
new_rpc = "supabase.rpc('list_seasonal_artworks', { p_product: product.id, p_size: size, p_side: side })"
if old_rpc not in seasonal:
    raise SystemExit('Seasonal RPC call shape changed; refusing unsafe patch')
seasonal = seasonal.replace(old_rpc, new_rpc, 1)
old_dep = "}, [product.id, size]);"
new_dep = "}, [product.id, size, side]);"
if old_dep not in seasonal:
    raise SystemExit('Seasonal effect dependency shape changed; refusing unsafe patch')
seasonal = seasonal.replace(old_dep, new_dep, 1)
seasonal_path.write_text(seasonal)

verification = '''import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => { throw new Error(message); };

const production = read('src/lib/customStudioV2Production.js');
const helper = read('src/lib/customStudioV2PrintGuide.js');
const seasonal = read('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx');
const protectedEditor = read('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx');
const upload = read('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx');
const studio = read('src/pages/CustomStudioV2.jsx');
const migration = read('supabase/migrations/20260917021000_recommended_apparel_print_guides_v2.sql');

for (const token of ['customization?.preview?.printGuide', 'widthIn: 11, heightIn: 10', 'widthIn: 4, heightIn: 4', 'widthIn: 5.5, heightIn: 5.5', 'widthIn: 10.5, heightIn: 10.5']) {
  if (!production.includes(token)) fail(`Production profile missing calibrated token: ${token}`);
}
for (const kind of ['baby', 'toddler', 'youth', 'hoodie', 'crewneck', 'adult']) {
  if (!helper.includes(`${kind}:`)) fail(`Missing ${kind} display calibration.`);
}
if (!helper.includes('recommendationLabel')) fail('Recommended print area label is missing.');
if (!seasonal.includes('p_side: side')) fail('Seasonal library is not side-aware.');
if (!seasonal.includes('[product.id, size, side]')) fail('Seasonal side change will not refresh its physical print area.');
for (const [name, source] of [['seasonal', seasonal], ['protected', protectedEditor], ['upload', upload]]) {
  if (!source.includes('data-gdp-print-guide="true"')) fail(`${name} editor is missing the calibrated print guide.`);
  if (!source.includes('printGuide.label')) fail(`${name} editor does not show print dimensions.`);
}
for (const token of ['"widthIn":11,"heightIn":10', '"widthIn":4,"heightIn":4', '"widthIn":5.5,"heightIn":5.5', '"widthIn":10.5,"heightIn":10.5', 'p_side text']) {
  if (!migration.includes(token)) fail(`Database migration missing calibrated token: ${token}`);
}
if (!studio.includes('size={state.size} settings={settings}')) fail('Protected editor is not receiving selected size.');
if (!studio.includes('size={state.size} side={state.side} editor={currentEditor}')) fail('Upload editor is not receiving selected size.');
console.log('Custom Studio recommended print guide verification passed.');
'''
Path('scripts/verify-custom-studio-print-guides.mjs').write_text(verification)
