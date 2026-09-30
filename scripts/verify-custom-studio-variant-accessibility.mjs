import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const fail = (message) => { throw new Error(message); };
const expect = (condition, message) => { if (!condition) fail(message); };

const guard = read("src/components/storefront/CustomStudioVariantAccessibilityGuard.jsx");
const layout = read("src/components/storefront/Layout.jsx");

for (const token of [
  'data-gdp-selected-garment-configurator="true"',
  'data-gdp-garment-swatch="true"',
  '"role", "group"',
  '"aria-label", "Garment color"',
  '"data-gdp-garment-color-group", "true"',
  'leafLabel(configurator, "Quantity")',
  'input[type="number"]',
  '"aria-label", "Garment quantity"',
  '"data-gdp-garment-quantity-group", "true"',
  '"data-gdp-garment-quantity", "true"',
  '"aria-label", "Decrease garment quantity"',
  '"aria-label", "Increase garment quantity"',
  "new MutationObserver(scheduleSync)",
  "observer.observe(root, { childList: true, subtree: true })",
]) expect(guard.includes(token), `Variant accessibility contract missing: ${token}`);

expect(
  layout.includes('import CustomStudioVariantAccessibilityGuard from "./CustomStudioVariantAccessibilityGuard";'),
  "Layout must import the Custom Studio variant accessibility guard."
);
expect(
  layout.includes("{studioActive && <CustomStudioVariantAccessibilityGuard />}") ,
  "Variant accessibility guard must be scoped to active Custom Studio routes."
);

for (const forbidden of [
  "customerApi",
  "createCustomDesign",
  "addItem(",
  "replaceItem(",
  "renderStudioV2",
  "supabase",
  "stripe",
  "fetch(",
  "dispatch(",
  ".value =",
]) expect(!guard.includes(forbidden), `Accessibility guard must remain presentation-only; forbidden token found: ${forbidden}`);

console.log("Custom Studio variant accessibility verification passed.");
console.log("- color controls expose a named semantic group");
console.log("- quantity controls expose a named group plus explicit decrease/input/increase labels");
console.log("- enhancer remains isolated from editor, commerce, persistence and production rendering state");
