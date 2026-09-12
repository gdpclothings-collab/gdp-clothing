import fs from 'node:fs';

const studio = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');
const editor = fs.readFileSync('src/components/storefront/CustomStudioAdvancedEditor.jsx', 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const modernPhotoFallbackGuard = 'photo && !hasEditablePhotoLayers && !preferEditablePhotoLayers';
const modernPathProp = 'preferEditablePhotoLayers={designPath === "bootleg" || designPath === "memorial"}';

assert(
  studio.includes('preferEditablePhotoLayers = false'),
  'StudioPreview supports explicitly disabling legacy photo fallback'
);
assert(
  (studio.match(new RegExp(modernPhotoFallbackGuard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 2,
  'both protected-template and legacy preview fallback branches are guarded'
);
assert(
  (studio.match(new RegExp(modernPathProp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 3,
  'live, production, and fullscreen previews use editable-photo-only behavior for Bootleg/Memorial'
);
assert(
  studio.includes('setEditorLayers((current) => current.filter((layer) => layer.id !== layerId));\n    setSelectedEditorLayerId("");'),
  'deleting an editor layer clears the stale pseudo-photo selection'
);
assert(
  editor.includes('if (event.repeat || (event.key !== "Delete" && event.key !== "Backspace")) return;'),
  'Delete and Backspace remain the supported keyboard removal keys'
);
assert(
  editor.includes('const isTyping = Boolean(target?.isContentEditable) || tagName === "input" || tagName === "textarea" || tagName === "select";'),
  'keyboard deletion stays disabled while typing in editable controls'
);
assert(
  editor.includes('event.preventDefault();\n      onDeleteLayer?.(selectedLayer.id);\n      onSelectLayer?.("");'),
  'keyboard Delete removes the selected layer and clears selection instead of restoring the photo fallback'
);

if (process.exitCode) process.exit(process.exitCode);
console.log('Photo Bootleg delete-key regression verification passed.');
