import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const v11 = fs.readFileSync('src/pages/CustomStudioDesktopWorkspaceV11.jsx', 'utf8');
const v12 = fs.readFileSync('src/pages/CustomStudioDesktopWorkspaceV12.jsx', 'utf8');
const v13 = fs.readFileSync('src/pages/CustomStudioDesktopWorkspaceV13.jsx', 'utf8');

assert.ok(app.includes("CustomStudioDesktopWorkspaceV13"), 'Custom Studio must route through the V13 hardening shell.');
assert.ok(v13.includes("CustomStudioDesktopWorkspaceV12"), 'V13 must preserve the proven V12 guide drawer underneath.');
assert.ok(v12.includes("CustomStudioDesktopWorkspaceV11"), 'V12 must preserve V11 visibility behavior.');
assert.ok(v11.includes('[data-studio-rail]'), 'V11 must continue targeting the desktop rail.');
assert.ok(v11.includes('z-index: 260 !important'), 'The rail must continue sitting above the ordinary workspace.');
assert.ok(v11.includes('[data-guide] > div'), 'V11 must continue styling the expanded guide panel.');
assert.ok(v11.includes('z-index: 999 !important'), 'The expanded guide must stay above ordinary configurator content.');
assert.ok(v12.includes('data-guide-open'), 'V12 must track expanded guide state.');
assert.ok(v12.includes('gdp-custom-guide-backdrop'), 'V12 must provide outside-click dismissal.');
assert.ok(v12.includes('gdp-custom-guide-close'), 'V12 must provide an explicit close control.');
assert.ok(v12.includes('event.key === "Escape"'), 'V12 must support Escape-to-close for keyboard users.');
assert.ok(v13.includes('[aria-labelledby="saved-studio-draft-title"]'), 'V13 must explicitly protect the draft recovery modal layer.');
assert.ok(v13.includes('z-index: 1400 !important'), 'Draft recovery must sit above the help drawer.');
assert.ok(v13.includes('nextModalOpen && nextGuideOpen'), 'Opening draft recovery must close the guide instead of stacking two overlays.');
assert.ok(v13.includes('.gdp-custom-studio-v7 [data-studio-row]'), 'Guide-aware workspace sizing must apply to all main Studio steps.');
assert.ok(v13.includes('gdp-guide-after-order'), 'After-order guidance must move into the help experience instead of consuming Step 1 page height.');

console.log('Custom order guide, modal exclusivity and drawer refinement verified.');
