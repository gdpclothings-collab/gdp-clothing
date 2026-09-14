import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = 'src/App.jsx';
const corePath = 'src/pages/CustomStudio.jsx';
const workspacePath = 'src/pages/CustomStudioDesktopWorkspace.jsx';
const garmentStepPath = 'src/components/storefront/custom-studio/GarmentStep.jsx';
const chooseStepPath = 'src/components/storefront/custom-studio/ChooseDesignStep.jsx';
const timingStepPath = 'src/components/storefront/custom-studio/TimingApprovalStep.jsx';
const reviewStepPath = 'src/components/storefront/custom-studio/ReviewStep.jsx';
const workflowStatePath = 'src/hooks/useCustomStudioWorkflowState.js';
const app = fs.readFileSync(appPath, 'utf8');
const core = fs.readFileSync(corePath, 'utf8');
const workspace = fs.readFileSync(workspacePath, 'utf8');
const garmentStep = fs.readFileSync(garmentStepPath, 'utf8');
const chooseStep = fs.readFileSync(chooseStepPath, 'utf8');
const timingStep = fs.readFileSync(timingStepPath, 'utf8');
const reviewStep = fs.readFileSync(reviewStepPath, 'utf8');
const workflowState = fs.readFileSync(workflowStatePath, 'utf8');
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
assert.ok(core.includes('@/components/storefront/custom-studio/GarmentStep'), 'Core must delegate Step 1 to GarmentStep.');
assert.ok(core.includes('@/components/storefront/custom-studio/ChooseDesignStep'), 'Core must delegate Step 2 to ChooseDesignStep.');
assert.ok(core.includes('@/components/storefront/custom-studio/TimingApprovalStep'), 'Core must delegate Step 4 to TimingApprovalStep.');
assert.ok(core.includes('@/components/storefront/custom-studio/ReviewStep'), 'Core must delegate Step 5 to ReviewStep.');
assert.ok(core.includes('useCustomStudioWorkflowState(FALLBACK_GARMENT)'), 'Core workflow state must use the shared reducer hook.');
assert.ok(garmentStep.includes('onClick={() => chooseProduct(option)}'), 'GarmentStep must preserve the native garment chooseProduct interaction.');
assert.ok(chooseStep.includes('CHOOSE YOUR DESIGN PATH'), 'ChooseDesignStep must own the design-path UI.');
assert.ok(timingStep.includes('TIMING + FINAL APPROVAL'), 'TimingApprovalStep must own approval UI.');
assert.ok(reviewStep.includes('REVIEW THE EXACT RESULT'), 'ReviewStep must own final review UI.');
assert.ok(workflowState.includes('function workflowReducer'), 'Workflow state must be reducer-backed.');
assert.ok(workflowState.includes('setPlacement') && workflowState.includes('setDesignStylesBySide'), 'Workflow reducer must preserve functional setter adapters used by the editor.');
assert.ok(!core.includes('{step === 1 && <div>'), 'Step 1 must not be inlined back into the page monolith.');
assert.ok(!core.includes('{step === 2 && <div>'), 'Step 2 must not be inlined back into the page monolith.');
assert.ok(!core.includes('{step === 4 && <div>'), 'Step 4 must not be inlined back into the page monolith.');
assert.ok(!core.includes('{step === 5 && <div>'), 'Step 5 must not be inlined back into the page monolith.');

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
console.log('- stable customer steps are isolated modules and workflow state is reducer-backed');
