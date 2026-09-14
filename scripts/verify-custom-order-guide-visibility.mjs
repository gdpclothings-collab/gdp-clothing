import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const v11 = fs.readFileSync('src/pages/CustomStudioDesktopWorkspaceV11.jsx', 'utf8');
const v12 = fs.readFileSync('src/pages/CustomStudioDesktopWorkspaceV12.jsx', 'utf8');

assert.ok(app.includes("CustomStudioDesktopWorkspaceV12"), 'Custom Studio must route through the V12 guide drawer shell.');
assert.ok(v12.includes("CustomStudioDesktopWorkspaceV11"), 'V12 must preserve the proven V11 visibility layer underneath.');
assert.ok(v11.includes('[data-studio-rail]'), 'V11 must continue targeting the desktop rail.');
assert.ok(v11.includes('z-index: 260 !important'), 'The rail must continue sitting above the Step 1 workspace.');
assert.ok(v11.includes('[data-guide] > div'), 'V11 must continue styling the expanded guide panel.');
assert.ok(v11.includes('z-index: 999 !important'), 'The expanded guide must stay above the configurator.');
assert.ok(v12.includes('data-guide-open'), 'V12 must track expanded guide state.');
assert.ok(v12.includes('translateX(calc(var(--gdp-guide-drawer-width) + 16px))'), 'Step 1 must yield horizontal space instead of allowing the guide to cover garment cards.');
assert.ok(v12.includes('gdp-custom-guide-backdrop'), 'V12 must provide outside-click dismissal.');
assert.ok(v12.includes('gdp-custom-guide-close'), 'V12 must provide an explicit close control.');
assert.ok(v12.includes('event.key === "Escape"'), 'V12 must support Escape-to-close for keyboard users.');
assert.ok(v12.includes('aria-label="Close How Custom Orders Work"'), 'Guide dismissal controls must be accessible.');

console.log('Custom order guide drawer refinement verified.');
