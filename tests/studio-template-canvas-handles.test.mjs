import test from 'node:test';
import assert from 'node:assert/strict';
import { templateSelectionGeometry, resizeTemplateFromHandle } from '../src/lib/templateOnCanvasGeometry.js';
import { constrainTemplateTransform } from '../src/lib/customStudioV2PrintBounds.js';

const allInk = { x: 0, y: 0, width: 100, height: 100 };
const paddedInk = { x: 17, y: 21, width: 65, height: 55 };
const approx = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 0.005, `${message}: ${actual} !== ${expected}`);

function edgePoint(geometry, edge, aspect) {
  const angle = geometry.rotation * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const x = edge === 'w' ? -geometry.width / 2 : edge === 'e' ? geometry.width / 2 : 0;
  const y = edge === 'n' ? -geometry.height / 2 : edge === 's' ? geometry.height / 2 : 0;
  return {
    x: geometry.centerX + c * x - s * y / aspect,
    y: geometry.centerY + s * x * aspect + c * y,
  };
}

test('top and bottom resize independently, keeping the opposite edge stationary', () => {
  const original = { x: -2, y: 3, rotation: 0, scale: 65, widthScale: 85, heightScale: 90 };
  const before = templateSelectionGeometry(original, allInk, 0.9);
  for (const [handle, other, delta] of [['n', 's', -10], ['s', 'n', 8]]) {
    const resized = resizeTemplateFromHandle(original, allInk, 0.9, handle, 0, delta);
    const after = templateSelectionGeometry(resized, allInk, 0.9);
    approx(edgePoint(after, other, 0.9).y, edgePoint(before, other, 0.9).y, `${handle} fixed edge`);
    assert.notEqual(after.height, before.height);
    approx(after.width, before.width, `${handle} unchanged width`);
  }
});

test('left and right resize independently while keeping the opposite edge stationary', () => {
  const original = { x: 2, y: -4, rotation: 0, scale: 50, widthScale: 100, heightScale: 75 };
  const before = templateSelectionGeometry(original, allInk, 0.8);
  for (const [handle, other, delta] of [['w', 'e', -7], ['e', 'w', 9]]) {
    const after = templateSelectionGeometry(resizeTemplateFromHandle(original, allInk, 0.8, handle, delta, 0), allInk, 0.8);
    approx(edgePoint(after, other, 0.8).x, edgePoint(before, other, 0.8).x, `${handle} fixed edge`);
    assert.notEqual(after.width, before.width);
    approx(after.height, before.height, `${handle} unchanged height`);
  }
});

test('rotated templates and transparent padding use the same visible-ink anchor', () => {
  const aspect = 0.75;
  const original = { x: 0, y: 0, rotation: 34, scale: 45, widthScale: 95, heightScale: 78 };
  const before = templateSelectionGeometry(original, paddedInk, aspect);
  for (const [handle, opposite] of [['n','s'], ['e','w'], ['s','n'], ['w','e']]) {
    const after = templateSelectionGeometry(resizeTemplateFromHandle(original, paddedInk, aspect, handle, -2, 3), paddedInk, aspect);
    const beforeAnchor = edgePoint(before, opposite, aspect);
    const afterAnchor = edgePoint(after, opposite, aspect);
    approx(afterAnchor.x, beforeAnchor.x, `${handle} x anchor`);
    approx(afterAnchor.y, beforeAnchor.y, `${handle} y anchor`);
  }
});

test('dragging past print bounds stops safely without moving the fixed edge', () => {
  const original = { x: 0, y: 0, rotation: 0, scale: 50, widthScale: 100, heightScale: 100 };
  const before = templateSelectionGeometry(original, allInk, 1);
  const result = resizeTemplateFromHandle(original, allInk, 1, 'e', 200, 0);
  const checked = constrainTemplateTransform(result, allInk, 1);
  const after = templateSelectionGeometry(result, allInk, 1);
  approx(after.centerX - after.width / 2, before.centerX - before.width / 2, 'left fixed');
  assert.ok(after.centerX + after.width / 2 <= 100.005);
  for (const key of ['scale', 'widthScale', 'heightScale', 'x', 'y']) approx(result[key], checked[key], `${key} safe`);
});

test('handle resize preserves stored template model and rotation for print parity', () => {
  const original = { x: 1, y: 2, rotation: -19, scale: 60, widthScale: 80, heightScale: 70 };
  const result = resizeTemplateFromHandle(original, paddedInk, 1, 'nw', -5, -4);
  assert.deepEqual(Object.keys(result).sort(), Object.keys(original).sort());
  assert.equal(result.rotation, original.rotation);
  assert.equal(result.scale, original.scale);
});
