import fs from 'node:fs';
import {
  bootlegSliderToAnchor,
  resolveBootlegAnchorRanges,
  resolveBootlegTextLayout,
} from '../src/lib/customStudioV2BootlegTextLayout.js';

const studio = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');
const desktopCss = fs.readFileSync('src/components/storefront/customStudioDesktop.css', 'utf8');
const bootlegDesktopCss = fs.readFileSync('public/photo-bootleg-desktop.css', 'utf8');
const editor = fs.readFileSync('src/components/storefront/CustomStudioAdvancedEditor.jsx', 'utf8');
const protectedV2 = fs.readFileSync('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx', 'utf8');
const protectedProduction = fs.readFileSync('src/lib/customStudioV2ProtectedProduction.js', 'utf8');
const bootlegTextLayout = fs.readFileSync('src/lib/customStudioV2BootlegTextLayout.js', 'utf8');
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

// Active V2 Photo Bootleg editor: freedom must remain scoped, intentional and production-safe.
assert(protectedV2.includes('data-gdp-bootleg-template-controls="true"'), 'V2 Bootleg exposes dedicated GDP template transform controls');
assert(protectedV2.includes("isBootleg = path === 'bootleg'"), 'new template/text freedom is explicitly scoped to Photo Bootleg');
assert(protectedV2.includes("path === 'memorial' ? 'memorial_tribute' : 'photo_bootleg'"), 'Memorial remains a separate protected editor category');
assert(protectedV2.includes("'Protected GDP templates'"), 'Memorial keeps protected-template customer guidance');
assert(protectedV2.includes('templateTransform'), 'V2 Bootleg persists template transform in the existing editor snapshot');
assert(protectedV2.includes('BOOTLEG_TEMPLATE_MAX_SCALE = 400'), 'GDP template resize keeps its established visual safety bound');
assert(protectedV2.includes('No preset maximum'), 'Bootleg text size control communicates that it has no preset maximum');
assert(protectedV2.includes('Number.POSITIVE_INFINITY'), 'direct Bootleg text pinch scaling has no configured upper size cap');
assert(protectedV2.includes('freeTextLayout: true'), 'Bootleg text opts into full-print-area production layout');
assert(protectedV2.includes('canvasX') && protectedV2.includes('canvasY'), 'Bootleg text stores full-print-area coordinates');
assert(protectedV2.includes('data-gdp-bootleg-active-layer="true"'), 'Bootleg exposes explicit active-layer selection');
assert(protectedV2.includes("activeLayer === 'text'"), 'only the selected text layer receives direct text gestures');
assert(protectedV2.includes("activeLayer === 'photo'"), 'only the selected photo layer receives direct photo gestures');
assert(protectedV2.includes("activeLayer === 'template'"), 'only the selected template layer receives direct template gestures');
assert(protectedV2.includes('data-gdp-bootleg-linked-photo-zone="true"'), 'photo zone is linked to the editable template transform');
assert(protectedV2.includes('data-gdp-bootleg-sticky-preview'), 'Bootleg live garment preview remains isolated from inspector scrolling');
assert(protectedV2.includes('data-gdp-bootleg-inspector-scroll'), 'Bootleg personalization controls use their own desktop scroll rail');
assert(protectedV2.includes('data-gdp-bootleg-print-boundary-warning="true"'), 'unbounded text gets a non-blocking print-area overflow warning');
assert(protectedV2.includes('bootlegAnchorToSlider') && protectedV2.includes('bootlegSliderToAnchor'), 'text sliders map visible text bounds to print-area edges instead of only moving the anchor point');
assert(protectedV2.includes('layout.headline.glyphs.map'), 'large Arc/Wave text renders as explicit glyphs rather than a fixed SVG textPath');
assert(!protectedV2.includes('unbounded={isBootleg}'), 'Bootleg no longer routes unlimited curved text through the legacy fixed-path renderer');

// Recording-driven follow-up: preserve real multi-photo state and isolate layer controls.
assert(protectedV2.includes('BOOTLEG_MAX_PHOTOS = 8'), 'Photo Bootleg keeps an explicit eight-photo total safety limit');
assert(protectedV2.includes("const photos = [...currentPhotoLayers(editor)].sort"), 'rendering no longer mutates the live editor.photos array in place');
assert(protectedV2.includes('const editorRef = useRef(editor)') && protectedV2.includes('editorRef.current = editor'), 'async uploads can read the latest editor state after background processing');
assert(protectedV2.includes('const latestPhotos = [...currentPhotoLayers(editorRef.current)]'), 'upload completion preserves the latest existing photo layers and transforms');
assert(protectedV2.includes('const next = [...latestPhotos, ...safeAdditions]'), 'new uploads append to existing photo layers instead of replacing them');
assert(protectedV2.includes("data-gdp-bootleg-multi-photo={isBootleg ? 'append' : undefined}"), 'Photo panel exposes the append-only multi-photo contract');
assert(protectedV2.includes("{ value: 'photo', label: 'Photo', enabled: true }"), 'Photo tab remains available before the first upload so Add Photo is reachable');
assert(protectedV2.includes("activeBootlegLayer === 'template' ? templatePanel"), 'Template controls render only when Template is the active Bootleg layer');
assert(protectedV2.includes("activeBootlegLayer === 'photo' ? photoPanel"), 'Photo controls render only when Photo is the active Bootleg layer');
assert(protectedV2.includes("activeBootlegLayer === 'text' ? textPanel"), 'Text controls render only when Text is the active Bootleg layer');
assert(protectedV2.includes('data-gdp-bootleg-workspace={isBootleg ? \'single-viewport\' : undefined}'), 'Bootleg uses a dedicated single-viewport desktop workspace contract');
assert(protectedV2.includes('xl:h-[calc(100dvh-7rem)] xl:items-stretch xl:overflow-hidden'), 'desktop workspace owns a viewport-bounded height instead of growing the page with the inspector');
assert(protectedV2.includes("style={isBootleg ? { maxWidth: 'min(620px, calc((100dvh - 16rem) * 0.8))' } : undefined}"), 'garment preview is viewport-fitted so the full preview remains visible');
assert(protectedV2.includes('data-gdp-bootleg-active-status="true"'), 'active layer gets a persistent visible editing label');
assert(protectedV2.includes('data-gdp-bootleg-upload-status="true"'), 'background processing gets a visible canvas-adjacent progress status');
assert(protectedV2.includes('Finish Template Editing'), 'template completion wording is explicit instead of ambiguous Done editing');
assert(protectedV2.includes("photos.length ? 'Add another photo' : 'Add first photo'"), 'photo add action clearly distinguishes first and additional photos');

assert(bootlegTextLayout.includes('curveGlyphs'), 'shared Bootleg layout owns dynamic per-glyph curve geometry');
assert(bootlegTextLayout.includes('relativeBounds'), 'shared Bootleg layout exposes visible bounds for boundary-aware movement');
assert(bootlegTextLayout.includes('overflow'), 'shared Bootleg layout reports printable-boundary overflow without auto-shrinking text');

assert(protectedProduction.includes("import { resolveBootlegTextLayout }"), '300-DPI renderer consumes the same Bootleg text geometry engine as the preview');
assert(protectedProduction.includes('withTemplateTransform'), '300-DPI renderer has one shared template transform for aligned artwork/photo composition');
assert(protectedProduction.includes('if (templateTransform) withTemplateTransform'), 'production photo zone follows the edited GDP template transform');
assert(protectedProduction.includes('drawTemplateArtwork'), '300-DPI renderer applies GDP template transforms');
assert(protectedProduction.includes('editor.textStyle?.templateTransform'), 'production renderer reads the approved template transform from the snapshot');
assert(protectedProduction.includes('style.freeTextLayout === true'), 'production renderer recognizes full-print-area Bootleg text layout');
assert(protectedProduction.includes('drawBootlegText'), 'Bootleg production text uses the shared unrestricted layout path');
assert(protectedProduction.includes('positiveScale(style.fontScale)'), 'production Bootleg text compatibility path does not reapply the old 180 percent cap');
assert(protectedProduction.includes('style.canvasX') && protectedProduction.includes('style.canvasY'), 'production renderer preserves full-print-area text coordinates and old-draft fallback');
assert(protectedProduction.includes('dpi = 300'), 'Photo Bootleg production output remains deterministic at 300 DPI');
assert(!protectedProduction.includes('The locked GDP template is unavailable.'), 'Bootleg-capable production wording no longer incorrectly calls every GDP template locked');

// Runtime geometry checks: no missing glyphs at the large sizes shown in the recording.
const hugeArc = resolveBootlegTextLayout({
  text: { headline: 'GERALD' },
  zone: { x: 12, y: 78, width: 76, height: 16 },
  style: { freeTextLayout: true, canvasX: 50, canvasY: 50, fontScale: 500, curve: 'arc-up', curveAmount: 70, rotation: 0 },
  width: 1000,
  height: 1200,
});
assert(hugeArc.headline?.kind === 'glyphs' && hugeArc.headline.glyphs.length === 6, '500 percent Arc Up preserves every headline glyph');
assert(hugeArc.headline.glyphs.every((glyph) => Number.isFinite(glyph.x) && Number.isFinite(glyph.y) && Number.isFinite(glyph.rotation)), '500 percent Arc Up produces finite positions and rotations for every glyph');

const hugeWave = resolveBootlegTextLayout({
  text: { headline: 'GERALD' },
  zone: { x: 12, y: 78, width: 76, height: 16 },
  style: { freeTextLayout: true, canvasX: 50, canvasY: 50, fontScale: 500, curve: 'wave', curveAmount: 70, rotation: 0 },
  width: 1000,
  height: 1200,
});
assert(hugeWave.headline?.kind === 'glyphs' && hugeWave.headline.glyphs.length === 6, '500 percent Wave preserves every headline glyph');
assert(new Set(hugeWave.headline.glyphs.map((glyph) => `${glyph.x.toFixed(3)}:${glyph.y.toFixed(3)}`)).size === 6, '500 percent Wave does not collapse multiple letters onto one position');

// Visible-bound slider contract: endpoints align the actual text bounds to the printable edges when the design fits.
const edgeBase = resolveBootlegTextLayout({
  text: { headline: 'GDP' },
  zone: { x: 12, y: 78, width: 76, height: 16 },
  style: { freeTextLayout: true, canvasX: 50, canvasY: 50, fontScale: 100, curve: 'straight', rotation: 0 },
  width: 1000,
  height: 1200,
});
const edgeRanges = resolveBootlegAnchorRanges(edgeBase);
const leftAnchor = bootlegSliderToAnchor(0, edgeRanges.x);
const rightAnchor = bootlegSliderToAnchor(100, edgeRanges.x);
const topAnchor = bootlegSliderToAnchor(0, edgeRanges.y);
const bottomAnchor = bootlegSliderToAnchor(100, edgeRanges.y);
const leftLayout = resolveBootlegTextLayout({ text: { headline: 'GDP' }, zone: { x: 12, y: 78, width: 76, height: 16 }, style: { freeTextLayout: true, fontScale: 100, curve: 'straight', rotation: 0 }, width: 1000, height: 1200, anchorX: leftAnchor, anchorY: edgeBase.centerY });
const rightLayout = resolveBootlegTextLayout({ text: { headline: 'GDP' }, zone: { x: 12, y: 78, width: 76, height: 16 }, style: { freeTextLayout: true, fontScale: 100, curve: 'straight', rotation: 0 }, width: 1000, height: 1200, anchorX: rightAnchor, anchorY: edgeBase.centerY });
const topLayout = resolveBootlegTextLayout({ text: { headline: 'GDP' }, zone: { x: 12, y: 78, width: 76, height: 16 }, style: { freeTextLayout: true, fontScale: 100, curve: 'straight', rotation: 0 }, width: 1000, height: 1200, anchorX: edgeBase.centerX, anchorY: topAnchor });
const bottomLayout = resolveBootlegTextLayout({ text: { headline: 'GDP' }, zone: { x: 12, y: 78, width: 76, height: 16 }, style: { freeTextLayout: true, fontScale: 100, curve: 'straight', rotation: 0 }, width: 1000, height: 1200, anchorX: edgeBase.centerX, anchorY: bottomAnchor });
assert(Math.abs(leftLayout.bounds.minX) < 0.001, 'left slider endpoint aligns the visible text edge to the left print boundary');
assert(Math.abs(rightLayout.bounds.maxX - 1000) < 0.001, 'right slider endpoint aligns the visible text edge to the right print boundary');
assert(Math.abs(topLayout.bounds.minY) < 0.001, 'top slider endpoint aligns the visible text edge to the top print boundary');
assert(Math.abs(bottomLayout.bounds.maxY - 1200) < 0.001, 'bottom slider endpoint aligns the visible text edge to the bottom print boundary');

if (process.exitCode) process.exit(process.exitCode);
console.log('Photo Bootleg desktop/mobile and V2 safety repair verification passed.');
