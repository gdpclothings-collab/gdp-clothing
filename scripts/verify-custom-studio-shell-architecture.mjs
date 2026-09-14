import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = 'src/App.jsx';
const corePath = 'src/pages/CustomStudio.jsx';
const workspacePath = 'src/pages/CustomStudioDesktopWorkspace.jsx';
const app = fs.readFileSync(appPath, 'utf8');
const core = fs.readFileSync(corePath, 'utf8');
const workspace = fs.readFileSync(workspacePath, 'utf8');
const retired = [7, 8, 9, 10, 11, 12, 13].map((version) => `src/pages/CustomStudioDesktopWorkspaceV${version}.jsx`);

assert.ok(app.includes("import('@/pages/CustomStudioDesktopWorkspace')"), 'App must route through the unversioned Custom Studio workspace.');
assert.ok(!/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(app), 'App must not reference retired versioned workspace wrappers.');
assert.ok(workspace.includes('import CustomStudio from "@/pages/CustomStudio"'), 'Unified workspace must import the core Studio directly.');
assert.ok(!/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(workspace), 'Unified workspace must not nest any retired versioned wrapper.');

for (const path of retired) {
  assert.equal(fs.existsSync(path), false, `${path} must stay retired; use git history for rollback.`);
}

for (const hook of ['data-studio-shell','data-studio-container','data-studio-hero','data-studio-rail','data-mobile-progress','data-stepper','data-guide','data-actions','data-studio-row','data-workspace','data-aside','data-preview-card','data-order-card','data-garment-grid','data-step1-color','data-step1-size-quantity','data-step1-size','data-step1-quantity','data-step1-group','data-step1-complete']) {
  assert.ok(core.includes(hook), `Core CustomStudio must own explicit semantic hook ${hook}.`);
}
assert.ok(core.includes('data-step={step}'), 'Core CustomStudio must expose the canonical active step without DOM inference.');
assert.ok(core.includes('className="gdp-custom-studio-core'), 'Core CustomStudio must expose the stable unversioned shell class.');

const observerCount = (workspace.match(/new MutationObserver/g) || []).length;
assert.equal(observerCount, 1, `Unified workspace must own one DOM observer runtime, found ${observerCount}.`);
assert.ok(workspace.includes('syncGarmentChooserState'), 'Desktop-only chooser collapse/expand behavior must live in the unified runtime.');
assert.ok(workspace.includes('restoreExpandedGarmentImages'), 'Catalog thumbnail integrity must live in the unified runtime.');
assert.ok(workspace.includes('pending.card.click()'), 'Pointer recovery must live in the unified runtime.');
assert.ok(workspace.includes('gdp-step1-bottom-dock'), 'Step 1 bottom navigation must live in the unified runtime.');
assert.ok(workspace.includes('gdp-custom-guide-backdrop'), 'Help drawer behavior must live in the unified runtime.');
assert.ok(workspace.includes('colorMockup(product, color)'), 'Exact selected-color resolution must live in the unified runtime.');
assert.ok(workspace.includes('estimatedPhotoDpi'), 'Print-quality refinement must live in the unified runtime.');

console.log('PASS Custom Studio shell architecture guard');
console.log('- V7-V13 are retired');
console.log('- core CustomStudio owns semantic layout hooks and active-step identity');
console.log('- one unversioned desktop runtime owns desktop-only presentation behavior');
