import fs from 'node:fs';

const page = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');
const editor = fs.readFileSync('src/components/storefront/CustomStudioAdvancedEditor.jsx', 'utf8');
const alertDialog = fs.readFileSync('src/components/ui/alert-dialog.jsx', 'utf8');
const toast = fs.readFileSync('src/components/ui/toast.jsx', 'utf8');

const checks = [
  ['notification system wired', page.includes('useNotifications') && page.includes('ToastAction') && page.includes('confirmAction, notify')],
  ['history snapshot covers full reset state', page.includes('designStylesBySide: JSON.parse') && page.includes('personalization: JSON.parse') && page.includes('previewZoom,') && page.includes('seasonalDraft:')],
  ['current-side reset implemented', page.includes('const resetCurrentSide = () =>') && page.includes('setEditorLayers([])')],
  ['entire-design reset implemented', page.includes('const resetEntireDesign = async ({ removeMedia = false } = {}) =>')],
  ['media-preserving reset implemented', page.includes('uploaded media was kept')],
  ['destructive media reset implemented', page.includes('if (removeMedia) setPhotos([])')],
  ['garment selection survives full reset', !page.includes('setGarment(FALLBACK_GARMENT)') && !page.includes('setProduct(null);\n    setColor("");')],
  ['undo toast implemented', page.includes('Undo design reset') && page.includes('onClick={undoEditor}')],
  ['reset menu has selected scope', editor.includes('Reset selected item')],
  ['reset menu has side scope', editor.includes('Reset current {previewSide}')],
  ['reset menu has full scope', editor.includes('Reset entire design')],
  ['reset menu has remove-media scope', editor.includes('Reset & remove media')],
  ['old ambiguous Reset all footer removed', !editor.includes('label="Reset all"')],
  ['notification forwardRef typing bridge installed', alertDialog.includes('/** @type {any} */ { className') && toast.includes('/** @type {any} */ { className')],
];

let failed = false;
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + label);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
