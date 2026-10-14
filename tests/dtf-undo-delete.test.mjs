import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  DTF_UNDO_DELETE_MS,
  createDtfDeleteSnapshot,
  restoreDtfDeletedArtwork,
} from "../src/lib/dtfUndoDelete.js";

const design = {
  id: "a", name: "Artwork.png", file: { name: "Artwork.png" }, previewUrl: "blob:artwork",
  x: 2.5, y: 1.75, width: 3.43, height: 5.09, rotation: 90,
};
const sibling = { id: "b", x: 7, y: 8, width: 4, height: 5, rotation: 0 };
const workspace = { mode: "build", sheetWidth: 34, sheetLength: 48 };

test("Undo keeps the original File, preview, geometry, rotation, position and ordering", () => {
  const originals = [sibling, design, { id: "c" }];
  const pending = createDtfDeleteSnapshot(originals, design.id, workspace, 1000);
  assert.equal(pending.item, design);
  assert.equal(pending.index, 1);
  assert.deepEqual([pending.sheetWidth, pending.sheetLength], [34, 48]);
  assert.equal(pending.expiresAt, 1000 + DTF_UNDO_DELETE_MS);
  const restored = restoreDtfDeletedArtwork([sibling, originals[2]], pending, "build", 10999);
  assert.deepEqual(restored, originals);
  assert.equal(restored[1].file, design.file);
  assert.equal(restored[1].previewUrl, design.previewUrl);
  assert.deepEqual([restored[1].x, restored[1].y, restored[1].width, restored[1].height, restored[1].rotation], [2.5, 1.75, 3.43, 5.09, 90]);
});

test("Undo expires exactly at 10 seconds and cannot revive a missing item", () => {
  assert.equal(DTF_UNDO_DELETE_MS, 10_000);
  const pending = createDtfDeleteSnapshot([design], "a", workspace, 5);
  assert.equal(restoreDtfDeletedArtwork([], pending, "build", 10004)?.length, 1);
  assert.equal(restoreDtfDeletedArtwork([], pending, "build", 10005), null);
  assert.equal(createDtfDeleteSnapshot([design], "missing", workspace), null);
});

test("Undo respects each workspace and does not overwrite a replacement print-ready film", () => {
  const pendingBuild = createDtfDeleteSnapshot([design], "a", workspace, 100);
  assert.equal(restoreDtfDeletedArtwork([], pendingBuild, "upload", 101), null);
  assert.equal(restoreDtfDeletedArtwork([design], pendingBuild, "build", 101), null);
  const pendingUpload = createDtfDeleteSnapshot([design], "a", { ...workspace, mode: "upload" }, 100);
  assert.deepEqual(restoreDtfDeletedArtwork([], pendingUpload, "upload", 101), [design]);
  assert.equal(restoreDtfDeletedArtwork([sibling], pendingUpload, "upload", 101), null);
});

test("DTF editor renders the 10-second Undo action and keeps preview alive until expiry", () => {
  const page = readFileSync("src/pages/DTFGangSheet.jsx", "utf8");
  assert.match(page, /createDtfDeleteSnapshot\(artworks, artworkId, \{ mode, sheetWidth, sheetLength \}\)/);
  assert.match(page, /restoreDtfDeletedArtwork\(artworks, pending, mode\)/);
  assert.match(page, /window\.setTimeout\(\(\) => clearUndoDeletion\(pending\.token\), 10_000\)/);
  assert.match(page, /undoDeletionRef\.current = pending;/);
  assert.match(page, /Undo within 10 seconds/);
  assert.match(page, /onClick=\{undoDeletedArtwork\}/);
  assert.match(page, /role="status"/);
  assert.match(page, /clearUndoDeletion\(pending\.token, true\)/);
  assert.match(page, /setSheetWidth\(pending\.sheetWidth\)/);
  assert.match(page, /setSheetLength\(pending\.sheetLength\)/);
  assert.match(page, /setSelectedId\(pending\.item\.id\)/);
  assert.doesNotMatch(page, /URL\.revokeObjectURL\(target\.previewUrl\)/);
  assert.match(page, /undoDeletionRef\.current\?\.item\.previewUrl === previousPreviewUrl/);
});
