import assert from "node:assert/strict";
import fs from "node:fs";

const studio = fs.readFileSync("src/pages/CustomStudio.jsx", "utf8");
const editor = fs.readFileSync("src/components/storefront/CustomStudioAdvancedEditor.jsx", "utf8");
const focus = fs.readFileSync("src/components/storefront/DesktopGarmentSelectionFocus.jsx", "utf8");
const css = fs.readFileSync("src/components/storefront/customStudioDesktop.css", "utf8");

assert.match(studio, /if \(current === "front_back"\) return current;/, "front+back placement must persist while editing either side");
assert.match(studio, /printSummaryForSide\("front"\)/, "order summary must report front independently");
assert.match(studio, /printSummaryForSide\("back"\)/, "order summary must report back independently");
assert.match(studio, /data-gdp-print-area="true"/, "preview panning must not steal artwork gestures");
assert.match(studio, /Drag canvas to pan/, "zoomed canvas must expose pan affordance");
assert.match(studio, /data-gdp-step-nav=\{compact \? "mobile" : "desktop"\}/, "desktop step nav needs compact styling hook");
assert.match(editor, />Fabric side<\/span>/, "canvas toolbar must group the fabric side controls");
assert.match(editor, />View<\/span>/, "canvas toolbar must group view controls");
assert.match(editor, />Production guides<\/span>/, "canvas toolbar must group production controls");
assert.match(focus, /const FADE_MS = 300;/, "garment focus transition should settle quickly");
assert.match(css, /grid-template-columns: minmax\(0, 380px\) !important;/, "focused garment grid must collapse to the selected card");
assert.match(css, /#gdp-touch-studio-panel[\s\S]*max-height: min\(46vh, 430px\) !important;/, "desktop editor inspector must use an internal scroll region");

console.log("Desktop Custom Studio regression checks passed.");
