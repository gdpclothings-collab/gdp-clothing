import fs from 'node:fs';

const studio = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');
const desktopCss = fs.readFileSync('src/components/storefront/customStudioDesktop.css', 'utf8');
const bootlegDesktopCss = fs.readFileSync('public/photo-bootleg-desktop.css', 'utf8');
const editor = fs.readFileSync('src/components/storefront/CustomStudioAdvancedEditor.jsx', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

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
assert(studio.includes('This removes every editable instance of the photo from both fabrics.'), 'global uploaded-photo deletion is explicit and confirmed');
assert(editor.includes('[\"remove\", Trash2, \"Remove\"]'), 'Bootleg photo tools expose a dedicated remove action');
assert(editor.includes('Remove from {previewSide} fabric'), 'active-side removal is distinct from deleting the uploaded asset');
assert(editor.includes('Delete upload everywhere'), 'global uploaded-photo deletion remains available as a separate action');
assert(editor.includes('[\"design\", Palette, \"Template\"]'), 'Bootleg editor uses a simplified Template tab label');
assert(editor.includes('[\"photos\", ImageIcon, \"Photos\"]'), 'Bootleg editor uses a simplified Photos tab label');
assert(editor.includes('viewGuidance && designPath !== \"bootleg\"'), 'duplicate long guidance is suppressed in the simplified Bootleg inspector');
assert(studio.includes('const backHasLockedTemplate = previewSide === "back" && Boolean(styleTemplateForSide("back"));'), 'back-side deletion checks for a protected template');
assert(studio.includes('if (previewSide === "back" && editorLayers.length === 1 && !backHasLockedTemplate)'), 'deleting the last customer layer cannot disable a protected back template');
assert(desktopCss.includes('[data-gdp-design-path="bootleg"] #gdp-canvas-control-dock'), 'redundant in-canvas Bootleg control dock is suppressed');
assert(desktopCss.includes('[data-gdp-design-path="bootleg"] [data-gdp-studio-preview="live"] > div.absolute.inset-0.grid > div.relative'), 'Bootleg garment receives its own fill-canvas override');
assert(desktopCss.includes('Photo Bootleg desktop parity'), 'Bootleg desktop refinements remain explicitly scoped and documented');

assert(html.includes('href="/photo-bootleg-desktop.css"'), 'desktop Bootleg refinement stylesheet is loaded by the storefront shell');
assert(bootlegDesktopCss.includes('Photo Bootleg desktop card refinement'), 'desktop Bootleg card sizing refinement remains documented');
assert(bootlegDesktopCss.includes('minmax(400px, 440px)'), 'desktop Bootleg inspector has a wider readable card footprint');
assert(bootlegDesktopCss.includes('clamp(560px, calc(100dvh - 310px), 660px)'), 'desktop Bootleg canvas is capped for 1080p-friendly proportions');
assert(bootlegDesktopCss.includes('min-height: 400px !important'), 'Bootleg editor keeps a stable minimum card height across tabs');
assert(bootlegDesktopCss.includes('max-height: clamp(460px, calc(100dvh - 390px), 580px) !important'), 'Bootleg editor scrolls inside a controlled desktop card height');
assert(bootlegDesktopCss.includes('@media (min-width: 1600px)'), 'large desktop monitors receive a bounded wider inspector rail');

assert(bootlegDesktopCss.includes('Photo Bootleg mobile preview cleanup'), 'mobile Bootleg preview cleanup is documented');
assert(bootlegDesktopCss.includes('@media (max-width: 767px)'), 'mobile cleanup is limited to phone-width viewports');
assert(bootlegDesktopCss.includes('[data-gdp-design-path="bootleg"] [data-gdp-studio-preview="live"] #gdp-canvas-control-dock'), 'mobile cleanup targets only the Bootleg live-preview canvas dock');
assert(bootlegDesktopCss.includes('display: none !important;'), 'duplicate dark canvas control dock is removed on Photo Bootleg mobile');
assert(desktopCss.includes('@media (min-width: 768px)') && desktopCss.includes('#gdp-canvas-control-dock'), 'desktop and tablet canvas dock behavior remains available');

if (process.exitCode) process.exit(process.exitCode);
console.log('Photo Bootleg desktop/mobile verification passed.');
