import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('src/main.jsx', 'utf8');
const seasonalEntry = fs.readFileSync('src/components/storefront/SeasonalStudio.jsx', 'utf8');
const layoutCss = fs.readFileSync('src/components/storefront/customStudioLayoutRefinement.css', 'utf8');
const priorityCss = fs.readFileSync('src/components/storefront/customStudioLayoutPriority.css', 'utf8');
const seasonalEngine = fs.readFileSync('src/components/storefront/SeasonalStudioLayered.jsx', 'utf8');

assert.ok(
  main.includes("@/components/storefront/customStudioLayoutRefinement.css"),
  'main.jsx must load the Custom Studio layout refinement layer.'
);
assert.ok(
  main.includes("@/components/storefront/customStudioLayoutPriority.css"),
  'main.jsx must load the high-specificity Customize containment layer.'
);

assert.ok(
  seasonalEntry.includes("import SeasonalStudioLayered from './SeasonalStudioLayered.jsx'"),
  'Seasonal entry must preserve the existing layered editor engine.'
);
assert.ok(
  seasonalEntry.includes('gdp-seasonal-shared-shell'),
  'Seasonal entry must render inside the shared Custom Studio visual shell.'
);
assert.ok(
  seasonalEntry.includes('gdp-seasonal-shared-shell__rail'),
  'Seasonal desktop shell must expose the same persistent step-rail pattern.'
);
assert.ok(
  seasonalEntry.includes('onClick={onBack}'),
  'Seasonal shell must preserve a working return to design-path selection.'
);
assert.ok(
  !seasonalEntry.trimStart().startsWith("export { default } from './SeasonalStudioLayered.jsx'"),
  'SeasonalStudio.jsx must not regress to a bare full-page re-export.'
);

assert.ok(
  layoutCss.includes('grid-template-areas:') && layoutCss.includes('"rail work"'),
  'Seasonal desktop shell must retain rail/work grid parity.'
);
assert.ok(
  layoutCss.includes('header + div.grid.grid-cols-3'),
  'Seasonal duplicate internal progress chrome must stay hidden on desktop.'
);
assert.ok(
  layoutCss.includes('grid-row: 1 / 3 !important'),
  'Seasonal garment preview must span the complete editor-card height.'
);
assert.ok(
  layoutCss.includes('overflow-y: auto !important'),
  'Seasonal editor controls must scroll internally instead of overlapping cards.'
);

assert.ok(
  priorityCss.includes('html body .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="3"] [data-preview-card]'),
  'Customize containment override must remain more specific than the runtime style block.'
);
assert.ok(
  priorityCss.includes('minmax(320px, .78fr) minmax(0, 1.22fr)'),
  'Customize desktop grid must use flexible editor/preview tracks.'
);
assert.ok(
  !priorityCss.includes('minmax(620px'),
  'Customize refinement must never reintroduce the fragile 620px preview minimum.'
);

assert.ok(
  seasonalEngine.includes('MAX_LAYERS = 10') && seasonalEngine.includes('SeasonalOverlay'),
  'Seasonal layered artwork engine must remain intact during shell refactors.'
);

console.log('PASS Custom Studio layout refinement guard');
console.log('- Seasonal uses the shared desktop shell presentation');
console.log('- Customize editor/preview tracks are flexible and contained');
console.log('- Seasonal layered editor engine remains intact');
