import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const workspace = fs.readFileSync('src/pages/CustomStudioDesktopWorkspace.jsx', 'utf8');
const core = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');

assert.ok(app.includes("CustomStudioDesktopWorkspace'))"), 'Custom Studio must route through the unified workspace.');
assert.ok(!/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(app), 'App must not route through the retired V8-V13 wrapper chain.');
assert.ok(workspace.includes('[data-studio-rail]'), 'Unified workspace must target the desktop rail.');
assert.ok(workspace.includes('z-index: 260 !important'), 'The rail must sit above the ordinary workspace.');
assert.ok(workspace.includes('[data-guide] > div'), 'Unified workspace must style the expanded guide panel.');
assert.ok(workspace.includes('z-index: 999 !important'), 'Expanded guide must stay above ordinary configurator content.');
assert.ok(workspace.includes('data-guide-open'), 'Unified workspace must track expanded guide state.');
assert.ok(workspace.includes('gdp-custom-guide-backdrop'), 'Unified workspace must provide outside-click dismissal.');
assert.ok(workspace.includes('gdp-custom-guide-close'), 'Unified workspace must provide an explicit close control.');
assert.ok(workspace.includes('event.key === "Escape"'), 'Unified workspace must support Escape-to-close.');
assert.ok(workspace.includes('[aria-labelledby="saved-studio-draft-title"]'), 'Unified workspace must explicitly protect the draft recovery modal layer.');
assert.ok(workspace.includes('z-index: 1400 !important'), 'Draft recovery must sit above the help drawer.');
assert.ok(workspace.includes('nextModalOpen && nextGuideOpen'), 'Draft recovery must close Help instead of stacking competing overlays.');
assert.ok(workspace.includes('.gdp-custom-studio-core [data-studio-row]'), 'Guide-aware workspace sizing must apply to all main Studio steps.');
assert.ok(core.includes('data-guide') && core.includes('data-studio-rail'), 'Guide and rail hooks must be owned by core CustomStudio markup.');
assert.ok(workspace.includes('gdp-guide-after-order'), 'After-order guidance must live in the help experience instead of consuming Step 1 page height.');

console.log('Custom order guide, modal exclusivity and unified drawer refinement verified.');