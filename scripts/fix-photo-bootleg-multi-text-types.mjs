import fs from 'node:fs';

const path = 'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx';
let source = fs.readFileSync(path, 'utf8');
const before = '    return { layer: { ...layer, style }, layout };';
const after = '    const previewLayer = /** @type {Record<string, any>} */ ({ ...layer, style });\n    return { layer: previewLayer, layout };';
if (!source.includes(before)) throw new Error('Expected Bootleg text preview layer mapping was not found.');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Applied Photo Bootleg multi-text preview typing fix.');
