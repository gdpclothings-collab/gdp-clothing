import fs from 'node:fs';

const studio = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');
const desktopCss = fs.readFileSync('src/components/storefront/customStudioDesktop.css', 'utf8');
const bootlegDesktopCss = fs.readFileSync('public/photo-bootleg-desktop.css', 'utf8');
const editor = fs.readFileSync('src/components/storefront/CustomStudioAdvancedEditor.jsx', 'utf8');
const protectedV2 = fs.readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const protectedProduction = fs.readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
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
assert(studio.includes('<Maximize2 size={14}/> Print Area</button>'), 'Photo Bootleg preview exposes the redesigned Print Area control');
assert(studio.includes('<Ruler size={14}/> Measurements</button>'), 'Photo Bootleg preview exposes the redesigned Measurements control');
assert(!studio.includes('aria-label={`Remove selected photo from ${previewSide} fabric`}'), 'duplicate preview-level photo removal is suppressed');
assert(studio.includes('This removes every editable instance of the photo from both fabrics.'), 'global uploaded-photo deletion is explicit and confirmed');
assert(editor.includes('["remove", Trash2, "Remove"]'), 'Bootleg photo tools expose a dedicated remove action');
assert(editor.includes('Remove from {previewSide} fabric'), 'active-side removal is distinct from deleting the uploaded asset');
assert(editor.includes('Delete upload everywhere'), 'global uploaded-photo deletion remains available as a separate action');
assert(editor.includes('["more", Layers, "Layer"]'), 'Bootleg photo tools expose direct layer controls');
assert(editor.includes('["design", Palette, "Template"]'), 'Bootleg editor uses a simplified Template tab label');
assert(editor.includes('["photos", ImageIcon, "Photos"]'), 'Bootleg editor uses a simplified Photos tab label');
assert(editor.includes('viewGuidance && designPath !== "bootleg"') || editor.includes('designPath !== "bootleg" && (sideStatus || viewGuidance || canCopyFrontToBack)'), 'duplicate long guidance is suppressed in the simplified Bootleg inspector');
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

// Active V2 Photo Bootleg editor: template transforms and free text must be production-safe.
assert(protectedV2.includes('data-gdp-bootleg-template-controls="true"'), 'V2 Bootleg exposes dedicated GDP template transform controls');
assert(protectedV2.includes("isBootleg = path === 'bootleg'"), 'new template/text freedom is explicitly scoped to Photo Bootleg');
assert(protectedV2.includes("path === 'memorial' ? 'memorial_tribute' : 'photo_bootleg'"), 'Memorial remains a separate protected editor category');
assert(protectedV2.includes("'Protected GDP templates'"), 'Memorial keeps protected-template customer guidance');
assert(protectedV2.includes('templateTransform'), 'V2 Bootleg persists template transform in the existing editor snapshot');
assert(protectedV2.includes('BOOTLEG_TEMPLATE_MAX_SCALE = 400'), 'GDP template resize has a bounded visual safety limit');
assert(protectedV2.includes('No preset maximum'), 'Bootleg text size control communicates that it has no preset maximum');
assert(protectedV2.includes('Number.POSITIVE_INFINITY'), 'direct Bootleg text pinch scaling has no configured upper size cap');
assert(protectedV2.includes('freeTextLayout: true'), 'Bootleg text opts into full-print-area production layout');
assert(protectedV2.includes('canvasX') && protectedV2.includes('canvasY'), 'Bootleg text stores full-print-area coordinates');
assert(protectedV2.includes('min={0} max={100}'), 'Bootleg text movement sliders cover the print area from edge to edge');
assert(protectedV2.includes("style.curve === 'straight' ? 'whitespace-nowrap overflow-visible'"), 'Bootleg straight headline is no longer truncated by its old text box');

assert(protectedProduction.includes('drawTemplateArtwork'), '300-DPI protected renderer applies GDP template transforms');
assert(protectedProduction.includes('editor.textStyle?.templateTransform'), 'production renderer reads the approved template transform from the snapshot');
assert(protectedProduction.includes('style.freeTextLayout === true'), 'production renderer recognizes full-print-area Bootleg text layout');
assert(protectedProduction.includes('positiveScale(style.fontScale)'), 'production Bootleg text size does not reapply the old 180 percent cap');
assert(protectedProduction.includes('style.canvasX') && protectedProduction.includes('style.canvasY'), 'production renderer uses full-print-area text coordinates');
assert(protectedProduction.includes('freeTextLayout ? undefined : metrics.width * 0.96'), 'large Bootleg headlines are not squeezed back into the old max-width box');
assert(protectedProduction.includes('dpi = 300'), 'Photo Bootleg production output remains deterministic at 300 DPI');

if (process.exitCode) process.exit(process.exitCode);
console.log('Photo Bootleg desktop/mobile and V2 transform verification passed.');
