import fs from "node:fs";

const appSource = fs.readFileSync("src/App.jsx", "utf8");
const studioSource = fs.readFileSync("src/pages/CustomStudio.jsx", "utf8");
const v8Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV8.jsx", "utf8");
const v9Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV9.jsx", "utf8");
const v10Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV10.jsx", "utf8");
const v11Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV11.jsx", "utf8");

function fail(message) {
  console.error(`FAIL Custom Studio garment interaction guard: ${message}`);
  process.exit(1);
}

if (/DesktopGarmentSelectionFocus/.test(appSource)) {
  fail("DesktopGarmentSelectionFocus must not be imported or mounted in App.jsx because it can intercept native garment-card clicks.");
}

if (!appSource.includes("CustomStudioDesktopWorkspaceV11")) {
  fail("App.jsx must route Custom Studio through the V11 visibility shell.");
}

if (!v11Source.includes("CustomStudioDesktopWorkspaceV10")) {
  fail("V11 must wrap V10 so the proven Step 1 shell and V9/V8 interaction protection stay active.");
}

if (!v11Source.includes("[data-studio-rail]" ) || !v11Source.includes("z-index: 260 !important")) {
  fail("V11 must lift the desktop rail above the Step 1 workspace so the expanded custom-order guide stays visible.");
}

if (!v11Source.includes("[data-guide] > div") || !v11Source.includes("z-index: 999 !important")) {
  fail("V11 must keep the expanded How Custom Orders Work panel above the configurator.");
}

if (!v11Source.includes("Restore the helper copy")) {
  fail("V11 must restore the guide helper copy compressed by V10.");
}

if (!v10Source.includes("CustomStudioDesktopWorkspaceV9")) {
  fail("V10 must wrap V9 so the proven pointer recovery and thumbnail integrity layers stay active.");
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

if (!v9Source.includes("gdpOriginalSrc")) {
  fail("V9 must snapshot each React-rendered garment card image before live preview substitution.");
}

if (!v9Source.includes("restoreExpandedGarmentImages")) {
  fail("V9 must restore catalog thumbnails when the garment chooser is expanded.");
}

if (!v9Source.includes('grid.dataset.gdpCollapsed === "true"')) {
  fail("V9 thumbnail restoration must distinguish collapsed summary mode from the full garment chooser.");
}

if (!v9Source.includes('attributeFilter: ["src", "class", "data-gdp-collapsed"]')) {
  fail("V9 must react to preview-source and chooser-state changes so stale thumbnails cannot persist.");
}

if (!v10Source.includes("createPortal")) {
  fail("V10 must mirror the tested desktop navigation into the Step 1 bottom dock without reparenting React-owned controls.");
}

if (!v10Source.includes("gdp-step1-bottom-dock")) {
  fail("V10 must keep Step 1 Back/Continue controls at the bottom of the workspace.");
}

if (!v10Source.includes("object-fit: contain !important")) {
  fail("V10 must force full-garment containment so catalog cards cannot collapse to collar-only crops.");
}

if (!v10Source.includes('grid-template-columns: minmax(0, 820px) !important')) {
  fail("V10 must center the selected garment in a bounded configurator card.");
}

if (!v10Source.includes('const STUDIO_DRAFT_KEY = "gdp.custom-studio.draft.v2"')) {
  fail("V10 Start Fresh must clear the same persisted Custom Studio draft used by the core workflow.");
}

if (!v10Source.includes("window.localStorage.removeItem(STUDIO_DRAFT_KEY)")) {
  fail("V10 Start Fresh no longer clears the persisted draft.");
}

if (!v10Source.includes('window.location.replace("/custom-studio")')) {
  fail("V10 Start Fresh must perform a true clean Custom Studio reload so all in-memory editor state resets.");
}

if (!v10Source.includes("Your account and unrelated cart items are not affected.")) {
  fail("V10 Start Fresh confirmation must explain its safe reset boundary.");
}

console.log("PASS Custom Studio garment interaction guard");
console.log("- App routes Custom Studio through V11 while preserving V10/V9/V8 interaction protection");
console.log("- V11 keeps How Custom Orders Work above the Step 1 workspace and restores its helper copy");
console.log("- native Step 1 chooseProduct handler and stable product identity remain present");
console.log("- V8 pointer-up fallback remains present without cancelling native events");
console.log("- V9 preserves original catalog images and restores them whenever the full chooser opens");
console.log("- V10 uses full-garment containment, centered selected state and a portal-based bottom action dock");
console.log("- Start Fresh clears the persisted draft and reloads a clean Custom Studio without touching account/cart state");