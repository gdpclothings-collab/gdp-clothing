import assert from "node:assert/strict";
import { advancedNestArtwork } from "../src/lib/dtfNesting.js";
import { artworkOverlaps, getArtworkRotatedBounds } from "../src/lib/dtfGangSheet.js";

const EPSILON = 0.001;

function verifyLayout(result, sheetWidth, sheetLength = Infinity) {
  assert.equal(result.unpacked.length, 0, "all test artwork should be packed");
  for (const item of result.items) {
    const bounds = getArtworkRotatedBounds(item);
    assert.ok(bounds.left >= -EPSILON, "rotated artwork must stay inside the left film edge");
    assert.ok(bounds.top >= -EPSILON, "rotated artwork must stay inside the top film edge");
    assert.ok(bounds.right <= sheetWidth + EPSILON, "rotated artwork must stay within film width");
    assert.ok(bounds.bottom <= sheetLength + EPSILON, "rotated artwork must stay within film length");
  }

  assert.deepEqual(artworkOverlaps(result.items), [], "packed rotated artwork must not overlap");
}

const mixed = [
  { id: "a", width: 12, height: 8, rotation: 0 },
  { id: "b", width: 10, height: 11, rotation: 0 },
  { id: "c", width: 7, height: 14, rotation: 0 },
  { id: "d", width: 5, height: 8, rotation: 0 },
  { id: "e", width: 9, height: 6, rotation: 0 },
];

const mixedResult = advancedNestArtwork(mixed, 34, 36, 0.25, {
  allowRotation: true,
  minLength: 6,
});
verifyLayout(mixedResult, 34);
assert.equal(mixedResult.passes, 25, "advanced nesting should evaluate all heuristic passes");
assert.ok(mixedResult.recommendedLength >= 6, "recommended length must respect minimum film length");
assert.ok(mixedResult.efficiency > 0 && mixedResult.efficiency <= 100, "packing efficiency must be valid");

const tall = [
  { id: "t1", width: 5, height: 30, rotation: 0 },
  { id: "t2", width: 5, height: 30, rotation: 0 },
  { id: "t3", width: 5, height: 20, rotation: 0 },
];

const rotatedResult = advancedNestArtwork(tall, 34, 72, 0.25, {
  allowRotation: true,
  minLength: 6,
});
verifyLayout(rotatedResult, 34);
assert.ok(rotatedResult.rotatedCount >= 1, "rotation-aware nesting should rotate tall artwork when beneficial");
assert.ok(rotatedResult.recommendedLength < 30, "rotation should materially reduce film length in the tall-artwork case");

const constrained = advancedNestArtwork(
  [
    { id: "c1", width: 30, height: 8, rotation: 0 },
    { id: "c2", width: 30, height: 8, rotation: 0 },
  ],
  34,
  10,
  0.25,
  {
    allowRotation: false,
    minLength: 6,
    maxLength: 10,
  }
);
assert.ok(constrained.unpacked.length >= 1, "hard film length should leave impossible artwork unpacked");
for (const item of constrained.items) {
  assert.ok(getArtworkRotatedBounds(item).bottom <= 10 + EPSILON, "constrained nesting must stay inside selected film length");
}

const angled = [
  { id: "a37", width: 8, height: 4, rotation: 37 },
  { id: "b18", width: 6, height: 5, rotation: 18 },
  { id: "c0", width: 7, height: 3, rotation: 0 },
];
const angledResult = advancedNestArtwork(angled, 34, 36, 0.25, {
  allowRotation: true,
  minLength: 6,
  maxLength: 36,
});
verifyLayout(angledResult, 34, 36);
assert.ok(
  angledResult.items.some((item) => Math.abs(item.rotation % 90) > EPSILON),
  "advanced nesting should preserve arbitrary source rotation when it is selected"
);

const noRotateResult = advancedNestArtwork(tall, 34, 72, 0.25, {
  allowRotation: false,
  minLength: 6,
});
verifyLayout(noRotateResult, 34);
assert.ok(
  rotatedResult.recommendedLength <= noRotateResult.recommendedLength,
  "allowing rotation must not produce a worse selected layout"
);

console.log(
  JSON.stringify({
    ok: true,
    mixedLength: mixedResult.recommendedLength,
    mixedEfficiency: Number(mixedResult.efficiency.toFixed(2)),
    rotatedLength: rotatedResult.recommendedLength,
    noRotateLength: noRotateResult.recommendedLength,
    rotatedCount: rotatedResult.rotatedCount,
    passes: mixedResult.passes,
  })
);
