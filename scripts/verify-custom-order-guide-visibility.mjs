import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const v11 = fs.readFileSync('src/pages/CustomStudioDesktopWorkspaceV11.jsx', 'utf8');

assert.ok(app.includes("CustomStudioDesktopWorkspaceV11"), 'Custom Studio must route through the V11 guide visibility shell.');
assert.ok(v11.includes('[data-studio-rail]'), 'V11 must target the desktop rail.');
assert.ok(v11.includes('z-index: 260 !important'), 'The rail must sit above the Step 1 workspace.');
assert.ok(v11.includes('[data-guide] > div'), 'V11 must style the expanded guide panel.');
assert.ok(v11.includes('z-index: 999 !important'), 'The expanded guide must stay above the configurator.');
assert.ok(v11.includes('Restore the helper copy'), 'The compact guide helper copy must remain visible.');

console.log('Custom order guide visibility verified.');
