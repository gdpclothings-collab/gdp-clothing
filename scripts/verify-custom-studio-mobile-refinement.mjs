import fs from 'node:fs';

const mainPath = 'src/main.jsx';
const cssPath = 'src/components/storefront/customStudioMobileRefinement.css';
const main = fs.readFileSync(mainPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(
  main.includes("import '@/components/storefront/customStudioMobileRefinement.css'"),
  'Mobile refinement CSS must be imported after the existing Custom Studio refinement layers.'
);

expect(css.includes('@media (max-width: 1279px)'), 'Mobile refinement must be explicitly capped below the 1280px desktop breakpoint.');
expect(!css.includes('@media (min-width: 1280px)'), 'Mobile refinement must never modify the desktop 1280px+ layout.');
expect(!css.includes('@media (min-width:'), 'Mobile refinement must not add min-width desktop/tablet overrides.');

expect(css.includes('[data-gdp-studio-preview="live"]'), 'Mobile preview needs an explicit responsive-height rule.');
expect(css.includes('height: clamp('), 'Mobile preview height must use a bounded responsive clamp.');
expect(css.includes('#gdp-touch-studio-panel'), 'Touch Studio must receive mobile containment treatment.');
expect(css.includes('position: relative !important;'), 'Touch Studio mobile panel must stay in document flow rather than nested sticky positioning.');
expect(css.includes('font-size: 16px !important;'), 'Mobile text inputs must avoid iOS focus zoom.');
expect(css.includes('env(safe-area-inset-bottom'), 'Mobile navigation must respect iPhone/Android safe-area insets.');
expect(css.includes('[data-actions] [data-gdp-step-nav="desktop"]'), 'Mobile actions must reuse the canonical navigation DOM rather than introduce duplicate handlers.');
expect(css.includes('position: sticky !important;'), 'Canonical mobile actions should remain reachable at the bottom of the viewport.');
expect(css.includes('[data-guide-open="true"] [data-guide] > div'), 'View Guide must receive a mobile bottom-sheet treatment.');
expect(css.includes('max-height: min(86svh, 760px)'), 'Mobile guide must remain bounded within the visible viewport.');
expect(css.includes('.gdp-protected-artwork-controls__actions'), 'Protected artwork controls need a compact mobile action layout.');
expect(css.includes('grid-template-columns: repeat(3'), 'Protected artwork actions should collapse from the desktop five-column layout on mobile.');

const forbiddenBusinessTokens = [
  'addItem(',
  'replaceItem(',
  'createAndAdd',
  'customerApi',
  'stripe',
  'checkout',
  'supabase',
];
for (const token of forbiddenBusinessTokens) {
  expect(!css.toLowerCase().includes(token.toLowerCase()), `Presentation-only mobile CSS must not contain business wiring token: ${token}`);
}

console.log('Custom Studio mobile-only refinement guard passed.');
