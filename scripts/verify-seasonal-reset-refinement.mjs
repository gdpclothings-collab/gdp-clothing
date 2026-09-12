import fs from 'node:fs';

const source = fs.readFileSync('src/components/storefront/SeasonalStudioLayered.jsx', 'utf8');
const checks = [
  ['shared confirmation + notification imports', source.includes('requestConfirmation, requestNotification') && source.includes('ToastAction')],
  ['reset menu state', source.includes('showResetMenu')],
  ['selected artwork reset option', source.includes('Reset selected artwork')],
  ['entire seasonal design reset option', source.includes('Reset entire seasonal design')],
  ['full reset confirmation', source.includes("title: 'Reset entire seasonal design?'")],
  ['garment choices preserved copy', source.includes('Your garment, color, size and quantity stay selected.')],
  ['undo toast', source.includes('Undo seasonal design reset') && source.includes('Full reset can be undone')],
  ['mobile-first one column / desktop two column reset menu', source.includes('grid gap-2 sm:grid-cols-2')],
  ['ambiguous clear all action removed', !source.includes('>Clear all</button>')],
  ['legacy selected reset remains available', source.includes('const resetActiveLayer = () =>')],
  ['full reset clears layers', source.includes('setLayers([]);')],
  ['full reset does not mutate garment product selection', !source.includes("resetEntireSeasonalDesign = async () => {\n    setProduct")],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
