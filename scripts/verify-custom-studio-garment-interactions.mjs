import fs from "node:fs";

const appSource = fs.readFileSync("src/App.jsx", "utf8");
const studioSource = fs.readFileSync("src/pages/CustomStudio.jsx", "utf8");
const v8Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV8.jsx", "utf8");
const v9Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV9.jsx", "utf8");

function fail(message) {
  console.error(`FAIL Custom Studio garment interaction guard: ${message}`);
  process.exit(1);
}

if (/DesktopGarmentSelectionFocus/.test(appSource)) {
  fail("DesktopGarmentSelectionFocus must not be imported or mounted in App.jsx because it can intercept native garment-card clicks.");
}

if (!appSource.includes("CustomStudioDesktopWorkspaceV9")) {
  fail("App.jsx must route Custom Studio through the V9 interaction and thumbnail-integrity shell.");
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

console.log("PASS Custom Studio garment interaction guard");
console.log("- legacy garment click interceptor is not mounted in App.jsx");
console.log("- App routes Custom Studio through V9 interaction and thumbnail integrity");
console.log("- native Step 1 chooseProduct handler is present");
console.log("- garment cards retain stable product identity");
console.log("- V8 pointer-up fallback remains present without cancelling native events");
console.log("- V9 preserves original catalog images and restores them whenever the full chooser opens");
