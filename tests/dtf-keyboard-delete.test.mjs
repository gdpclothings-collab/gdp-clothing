import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isDtfArtworkDeleteShortcut } from "../src/lib/dtfKeyboardShortcuts.js";

const canvasTarget = { closest: () => null };
const inputTarget = { closest: () => ({ tagName: "INPUT" }) };
const event = (key, target = canvasTarget, extra = {}) => ({ key, target, ...extra });

test("Delete and Backspace remove a selected design regardless of canvas focus", () => {
  assert.equal(isDtfArtworkDeleteShortcut(event("Delete")), true);
  assert.equal(isDtfArtworkDeleteShortcut(event("Backspace")), true);
});

test("typing in print size, rotation, file, and other input controls never deletes artwork", () => {
  for (const key of ["Delete", "Backspace"]) {
    assert.equal(isDtfArtworkDeleteShortcut(event(key, inputTarget)), false);
  }
});

test("modifier keys, repeated keydown, previously handled keys and unrelated keys are ignored", () => {
  for (const extra of [
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    { repeat: true }, { defaultPrevented: true },
  ]) assert.equal(isDtfArtworkDeleteShortcut(event("Delete", canvasTarget, extra)), false);
  for (const key of ["a", "Enter", "Escape", " "]) {
    assert.equal(isDtfArtworkDeleteShortcut(event(key)), false);
  }
});

test("the gang sheet editor wires a single window keyboard listener and preserves Escape", () => {
  const source = readFileSync("src/pages/DTFGangSheet.jsx", "utf8");
  assert.match(source, /window\.addEventListener\("keydown", onWorkspaceKeyDown\)/);
  assert.match(source, /window\.removeEventListener\("keydown", onWorkspaceKeyDown\)/);
  assert.match(source, /if \(event\.key === "Escape"\)/);
  assert.match(source, /isDtfArtworkDeleteShortcut\(event\)/);
  assert.match(source, /removeArtwork\(selectedArtwork\.id\)/);
  assert.match(source, /event\.currentTarget\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(source, /if \(\(event\.key === "Delete" \|\| event\.key === "Backspace"\) && selected\)/);
});
