import fs from "node:fs";

const appSource = fs.readFileSync("src/App.jsx", "utf8");
const studioSource = fs.readFileSync("src/pages/CustomStudio.jsx", "utf8");
const v8Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV8.jsx", "utf8");

function fail(message) {
  console.error(`FAIL Custom Studio garment interaction guard: ${message}`);
  process.exit(1);
}

if (/DesktopGarmentSelectionFocus/.test(appSource)) {
  fail("DesktopGarmentSelectionFocus must not be imported or mounted in App.jsx because it can intercept native garment-card clicks.");
}

if (!appSource.includes("CustomStudioDesktopWorkspaceV8")) {
  fail("App.jsx must route Custom Studio through the V8 resilient interaction shell.");
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

console.log("PASS Custom Studio garment interaction guard");
console.log("- legacy garment click interceptor is not mounted in App.jsx");
console.log("- App routes Custom Studio through V8 interaction resilience");
console.log("- native Step 1 chooseProduct handler is present");
console.log("- garment cards retain stable product identity");
console.log("- V8 pointer-up fallback is present without cancelling native events");
