import fs from 'node:fs';

const studio = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');
const desktopCss = fs.readFileSync('src/components/storefront/customStudioDesktop.css', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

assert(studio.includes('data-gdp-design-path={designPath || "none"}'), 'preview card exposes the active design path for scoped desktop behavior');
assert(studio.includes('Garment view size controls'), 'Photo Bootleg preview exposes Seasonal-style garment zoom controls');
assert(studio.includes('Print area {showGuides ? "on" : "off"}'), 'Photo Bootleg preview exposes print-area control');
assert(studio.includes('Measurements {showMeasurements ? "on" : "off"}'), 'Photo Bootleg preview exposes measurement control');
assert(studio.includes('Remove photo'), 'selected customer photo can be removed directly from the active fabric');
assert(studio.includes('const backHasLockedTemplate = previewSide === "back" && Boolean(styleTemplateForSide("back"));'), 'back-side deletion checks for a protected template');
assert(studio.includes('if (previewSide === "back" && editorLayers.length === 1 && !backHasLockedTemplate)'), 'deleting the last customer layer cannot disable a protected back template');
assert(desktopCss.includes('[data-gdp-design-path="bootleg"] #gdp-canvas-control-dock'), 'redundant in-canvas Bootleg control dock is suppressed');
assert(desktopCss.includes('[data-gdp-design-path="bootleg"] [data-gdp-studio-preview="live"] > div.absolute.inset-0.grid > div.relative'), 'Bootleg garment receives its own fill-canvas override');
assert(desktopCss.includes('Photo Bootleg desktop parity'), 'Bootleg desktop refinements remain explicitly scoped and documented');

if (process.exitCode) process.exit(process.exitCode);
console.log('Photo Bootleg desktop verification passed.');
