import assert from "node:assert/strict";
import { advancedNestArtwork } from "../src/lib/dtfNesting.js";

const EPSILON = 0.001;

function overlaps(a, b) {
  return (
    a.x < b.x + b.width - EPSILON &&
    a.x + a.width > b.x + EPSILON &&
    a.y < b.y + b.height - EPSILON &&
    a.y + a.height > b.y + EPSILON
  );
}

function verifyLayout(result, sheetWidth) {
  assert.equal(result.unpacked.length, 0, "all test artwork should be packed");
  for (const item of result.items) {
    assert.ok(item.x >= -EPSILON, "artwork x must stay on film");
    assert.ok(item.y >= -EPSILON, "artwork y must stay on film");
    assert.ok(item.x + item.width <= sheetWidth + EPSILON, "artwork must stay within film width");
  }

  for (let i = 0; i < result.items.length; i += 1) {
    for (let j = i + 1; j < result.items.length; j += 1) {
      assert.equal(
        overlaps(result.items[i], result.items[j]),
        false,
        `artwork ${result.items[i].id} and ${result.items[j].id} must not overlap`
      );
    }
  }
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
