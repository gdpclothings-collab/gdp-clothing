import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/DTFGangSheet.jsx", "utf8");
const exportLib = readFileSync("src/lib/dtfFilmExport.js", "utf8");

// Build and print-ready upload share the same unwatermarked film canvas.
assert.match(page, /changeMode\("build"\)/);
assert.match(page, /changeMode\("upload"\)/);
assert.match(page, /data-testid="dtf-film-printable-canvas"/);
assert.doesNotMatch(page, /WorkspaceWatermark|watermarkApplies\(|drawWatermark\(/);

// Cart proof thumbnails and customer preview downloads remain watermark-free.
assert.match(page, /createGangSheetThumbnail\(artworks, sheetWidth, sheetLength\)/);
assert.match(page, /downloadFilmPreview\(\{[^}]*clean: true/);
assert.match(page, /exportType: "clean_preview"/);
assert.doesNotMatch(page, /exportType: "watermarked_preview"/);
assert.match(page, /watermarkedPreviewEnabled: false,/);

// Handles sit outside the artwork; the delete button is in the film toolbar.
assert.match(page, /rotateHandleBelow/);
assert.match(page, /-bottom-5 -right-5/);
assert.match(page, /aria-label=\{\x60Rotate \$\{item.name\} freely\x60\}/);
assert.match(page, /aria-label=\{\x60Resize \$\{item.name\}\x60\}/);
assert.match(page, /aria-label="Delete selected artwork"/);
assert.doesNotMatch(page, /controlsAbove|left-1 top-1 z-30 bg-black\/85/);

// Critical print dimensions, placement and production-quality exports are preserved.
assert.match(page, /const onResizePointerDown =/);
assert.match(page, /const onRotatePointerDown =/);
assert.match(page, /const onPointerMove =/);
assert.match(page, /const readyLength = mode === "upload"/);
assert.match(exportLib, /export async function exportProductionPackage/);
assert.match(exportLib, /const canvas = await renderFilmSegment\(\{ items, width, startY, length: partLength, dpi \}\)/);

console.log("PASS: DTF build/upload previews, compact handles and production export isolation");
