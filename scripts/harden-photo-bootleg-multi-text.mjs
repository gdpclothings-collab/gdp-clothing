import fs from 'node:fs';

const componentPath = 'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx';
const verifierPath = 'scripts/verify-photo-bootleg-desktop.mjs';
let component = fs.readFileSync(componentPath, 'utf8');
let verifier = fs.readFileSync(verifierPath, 'utf8');

const startToken = '  const selectTemplate = (item) => {';
const endToken = '  const prepareAsset = async (file) => {';
const start = component.indexOf(startToken);
const end = component.indexOf(endToken, start);
if (start < 0 || end < 0) throw new Error('Could not find selectTemplate boundaries.');

const replacement = `  const selectTemplate = (item) => {
    const defaults = {
      scale: Number(item.defaultTransform?.scale || 100),
      rotation: Number(item.defaultTransform?.rotation || 0),
      x: Number(item.defaultTransform?.offset?.x || 0),
      y: Number(item.defaultTransform?.offset?.y || 0),
    };
    const nextPhotos = photos.length ? photos : [];
    if (isBootleg) {
      const nextTextPosition = resolveBootlegTextPosition(textStyle, item.textZone || { x: 12, y: 78, width: 76, height: 16 });
      const nextLayers = bootlegTextLayers.map((layer) => layer.id === activeTextLayer?.id
        ? { ...layer, style: normalizeBootlegTextStyle({ ...layer.style, canvasX: nextTextPosition.x, canvasY: nextTextPosition.y }, fallbackBootlegTextStyle) }
        : layer);
      const latestEditor = editorRef.current || editor;
      const textPatch = buildBootlegTextStatePatch(latestEditor, nextLayers, activeTextLayer?.id || '', fallbackBootlegTextStyle);
      const patch = {
        templateId: item.id,
        ...(nextPhotos.length ? {} : { transform: defaults }),
        ...textPatch,
        textStyle: { ...textPatch.textStyle, templateTransform: { scale: 100, rotation: 0, x: 0, y: 0 } },
      };
      editorRef.current = { ...latestEditor, ...patch };
      onPatch(patch);
      setActiveBootlegLayer('template');
      return;
    }
    onPatch({ templateId: item.id, ...(nextPhotos.length ? {} : { transform: defaults }) });
  };

`;
component = component.slice(0, start) + replacement + component.slice(end);

const hiddenSelector = `<button type="button" onClick={() => { selectTextLayer(layer); setTimeout(() => {}, 0); }} className="hidden" aria-hidden="true" tabIndex={-1}>Select</button>`;
if (!component.includes(hiddenSelector)) throw new Error('Expected temporary hidden text selector was not found.');
component = component.replace(hiddenSelector, '');

const anchor = `assert(protectedV2.includes('buildBootlegTextStatePatch'), 'Photo Bootleg mirrors active text into legacy fields for backward compatibility');`;
if (!verifier.includes(anchor)) throw new Error('Missing verifier anchor.');
const additions = `
assert(protectedV2.includes('const nextLayers = bootlegTextLayers.map'), 'template changes preserve independent text layers');
assert(protectedV2.includes("layer.id === activeTextLayer?.id"), 'template text-zone repositioning is scoped to the active text layer');
assert(!protectedV2.includes('setTimeout(() => {}, 0)'), 'multi-text layer list contains no generated hidden selector shim');`;
if (!verifier.includes('template changes preserve independent text layers')) verifier = verifier.replace(anchor, anchor + additions);

fs.writeFileSync(componentPath, component);
fs.writeFileSync(verifierPath, verifier);
console.log('Hardened Photo Bootleg multi-text template switching.');
