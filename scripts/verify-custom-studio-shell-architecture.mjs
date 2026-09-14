import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = 'src/App.jsx';
const workspacePath = 'src/pages/CustomStudioDesktopWorkspace.jsx';
const app = fs.readFileSync(appPath, 'utf8');
const workspace = fs.readFileSync(workspacePath, 'utf8');
const retired = [8, 9, 10, 11, 12, 13].map((version) => `src/pages/CustomStudioDesktopWorkspaceV${version}.jsx`);

assert.ok(app.includes("import('@/pages/CustomStudioDesktopWorkspace')"), 'App must route through the unversioned Custom Studio workspace.');
assert.ok(!/CustomStudioDesktopWorkspaceV(?:8|9|10|11|12|13)/.test(app), 'App must not reference retired V8-V13 wrappers.');
assert.ok(workspace.includes('CustomStudioDesktopWorkspaceV7'), 'V7 is the only temporary legacy base allowed under the unified workspace.');
assert.ok(!/CustomStudioDesktopWorkspaceV(?:8|9|10|11|12|13)/.test(workspace), 'Unified workspace must not nest retired wrappers.');

for (const path of retired) {
  assert.equal(fs.existsSync(path), false, `${path} must stay retired; use git history for rollback instead of restoring wrapper layers.`);
}

const observerCount = (workspace.match(/new MutationObserver/g) || []).length;
assert.equal(observerCount, 1, `Unified workspace must own one DOM observer runtime, found ${observerCount}.`);
assert.ok(workspace.includes('restoreExpandedGarmentImages'), 'Catalog thumbnail integrity must live in the unified runtime.');
assert.ok(workspace.includes('pending.card.click()'), 'Pointer recovery must live in the unified runtime.');
assert.ok(workspace.includes('gdp-step1-bottom-dock'), 'Step 1 bottom navigation must live in the unified runtime.');
assert.ok(workspace.includes('gdp-custom-guide-backdrop'), 'Help drawer behavior must live in the unified runtime.');
assert.ok(workspace.includes('colorMockup(product, color)'), 'Exact selected-color resolution must live in the unified runtime.');
assert.ok(workspace.includes('estimatedPhotoDpi'), 'Print-quality refinement must live in the unified runtime.');

console.log('PASS Custom Studio shell architecture guard');
console.log('- V8-V13 are retired');
console.log('- App routes through one unversioned desktop workspace');
console.log('- unified workspace owns one DOM observer runtime above the temporary V7 base');