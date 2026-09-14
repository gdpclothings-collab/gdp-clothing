import fs from "node:fs";

const appSource = fs.readFileSync("src/App.jsx", "utf8");
const studioSource = fs.readFileSync("src/pages/CustomStudio.jsx", "utf8");
const v8Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV8.jsx", "utf8");
const v9Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV9.jsx", "utf8");
const v10Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV10.jsx", "utf8");
const v11Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV11.jsx", "utf8");
const v12Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV12.jsx", "utf8");
const v13Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV13.jsx", "utf8");

function fail(message) {
  console.error(`FAIL Custom Studio garment interaction guard: ${message}`);
  process.exit(1);
}

if (/DesktopGarmentSelectionFocus/.test(appSource)) {
  fail("DesktopGarmentSelectionFocus must not be imported or mounted in App.jsx because it can intercept native garment-card clicks.");
}

if (!appSource.includes("CustomStudioDesktopWorkspaceV13")) {
  fail("App.jsx must route Custom Studio through the V13 hardening shell.");
}

if (!v13Source.includes("CustomStudioDesktopWorkspaceV12")) {
  fail("V13 must preserve the proven V12/V11/V10/V9/V8 interaction stack underneath.");
}

if (!v12Source.includes("CustomStudioDesktopWorkspaceV11")) {
  fail("V12 must wrap V11 so the proven visibility and Step 1 shell remain active.");
}

if (!v11Source.includes("CustomStudioDesktopWorkspaceV10")) {
  fail("V11 must wrap V10 so the proven Step 1 shell and V9/V8 interaction protection stay active.");
}

if (!v10Source.includes("CustomStudioDesktopWorkspaceV9")) {
  fail("V10 must wrap V9 so pointer recovery and thumbnail integrity remain active.");
}

if (!studioSource.includes('onClick={() => chooseProduct(option)}')) {
  fail("The native Step 1 garment-card chooseProduct click handler is missing.");
}

if (!studioSource.includes('key={option.id}')) {
  fail("The Step 1 garment-card mapping no longer exposes stable product identity.");
}

if (!v8Source.includes('document.addEventListener("pointerup", onPointerUp, true)')) {
  fail("The V8 pointer-up recovery path is missing.");
}

if (!v8Source.includes("pending.card.click()")) {
  fail("The V8 fallback no longer retries a swallowed garment-card click.");
}

if (/preventDefault\(|stopPropagation\(|stopImmediatePropagation\(/.test(v8Source)) {
  fail("V8 must never cancel native pointer/click propagation; React remains the primary interaction owner.");
}

if (!v9Source.includes("gdpOriginalSrc") || !v9Source.includes("restoreExpandedGarmentImages")) {
  fail("V9 must snapshot and restore original garment catalog thumbnails.");
}

if (!v10Source.includes("createPortal") || !v10Source.includes("gdp-step1-bottom-dock")) {
  fail("V10 must keep the portal-based Step 1 bottom action dock.");
}

if (!v10Source.includes("object-fit: contain !important")) {
  fail("V10 must force full-garment containment so catalog cards cannot collapse to collar-only crops.");
}

if (!v10Source.includes('grid-template-columns: minmax(0, 820px) !important')) {
  fail("V10 must center the selected garment in a bounded configurator card.");
}

if (!v13Source.includes("customerApi.getStudioCatalog()") || !v13Source.includes("colorMockup(product, color)")) {
  fail("V13 must resolve the selected garment thumbnail from the real product/color mockup catalog.");
}

if (!v13Source.includes("gdp-change-garment-button") || !v13Source.includes("Change garment")) {
  fail("V13 must provide a real accessible Change garment button rather than a CSS pseudo-label.");
}

if (!v13Source.includes("position: sticky !important") || !v13Source.includes(".gdp-step1-bottom-dock")) {
  fail("V13 must keep Step 1 navigation visible while the workspace scrolls.");
}

if (!v10Source.includes('const STUDIO_DRAFT_KEY = "gdp.custom-studio.draft.v2"') || !v10Source.includes("window.location.replace(\"/custom-studio\")")) {
  fail("V10 Start Fresh must still clear the saved draft and perform a clean Studio reload.");
}

console.log("PASS Custom Studio garment interaction guard");
console.log("- App routes Custom Studio through V13 while preserving V12/V11/V10/V9/V8 interaction protection");
console.log("- V13 resolves selected-color mockups from live catalog data and exposes a real Change garment control");
console.log("- V8 pointer recovery, V9 catalog restoration, V10 full-garment layout and clean Start Fresh remain protected");
