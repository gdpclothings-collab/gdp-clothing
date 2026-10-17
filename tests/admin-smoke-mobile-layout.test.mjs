import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('src/pages/AdminV2.jsx', 'utf8');
const smoke = readFileSync('scripts/admin-authenticated-smoke.mjs', 'utf8');
const shortcuts = readFileSync('src/pages/AdminV3.jsx', 'utf8');

test('mobile admin toolbar search flexes without forcing horizontal scroll', () => {
  assert.ok(shell.includes('mx-auto min-w-0 flex-1 max-w-[640px]'));
  assert.ok(shell.includes('className="min-w-0 truncate">Search orders, products and customers'));
  assert.ok(shell.includes('h-full min-w-0 px-3'));
});

test('recent order table scrolls inside constrained panel, not the document', () => {
  assert.ok(shell.includes('grid grid-cols-1 xl:grid-cols-[1.7fr_1fr]'));
  assert.ok(shell.includes('gdp-admin-neu-panel min-w-0'));
  assert.ok(shell.includes('min-w-0 max-w-full overflow-x-auto'));
});

test('admin quick-actions controls are preserved and responsive regression fails closed', () => {
  assert.ok(shortcuts.includes('Admin quick actions'));
  assert.ok(shortcuts.includes('Quick Actions'));
  assert.ok(smoke.includes('Horizontal overflow:'));
  assert.ok(smoke.includes('Admin viewport overflow element geometry:'));
  assert.ok(smoke.includes('name: "Invoices", exact: true, level: 1'));
  assert.ok(smoke.includes('submitMfaCodeAndAwaitAal2'));
  assert.ok(smoke.includes('process.exitCode = 1'));
});
