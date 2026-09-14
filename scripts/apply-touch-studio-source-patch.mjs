import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function patchFile(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`Patch made no changes: ${path}`);
  fs.writeFileSync(path, after);
  console.log(`patched ${path}`);
}

patchFile('src/pages/CustomStudio.jsx', (input) => {
  let source = input;

  source = replaceOnce(
    source,
    '} from "@/components/storefront/CustomStudioAdvancedEditor";\nimport { customerApi } from "@/lib/customerApi";',
    '} from "@/components/storefront/CustomStudioAdvancedEditor";\nimport CustomStudioProtectedArtworkControls from "@/components/storefront/CustomStudioProtectedArtworkControls";\nimport { customerApi } from "@/lib/customerApi";',
    'protected artwork controls import'
  );

  source = source.replace(
    '{ title: "Choose your design", detail: "Select Seasonal Designs, Photo Bootleg Designs, Memorial Tribute Designs or Upload My Own Artwork." },',
    '{ title: "Choose design path", detail: "Start with Seasonal, Photo Bootleg, Memorial Tribute, or your own uploaded artwork." },'
  );
  source = source.replace(
    '{ title: "Customize", detail: "Choose your print side, add artwork or photos, position every layer and personalize text in one workspace." },',
    '{ title: "Customize safely", detail: "Edit front or back, move and resize layers inside the print guide, and adjust or remove protected GDP artwork without editing its internal graphic content." },'
  );
  source = source.replace(
    '{ title: "Timing & approval", detail: "Set your needed-by date and confirm artwork permissions." },',
    '{ title: "Approve timing & rights", detail: "Set your needed-by date, confirm artwork permissions, and acknowledge the exact preview before production." },'
  );
  source = source.replace(
    '{ title: "Review & checkout", detail: "Final-check the exact result, add to cart and complete checkout." }',
    '{ title: "Review & checkout", detail: "Final-check the front/back result, add the approved design to your cart, then continue through secure checkout." }'
  );

  source = source.replace('title: "Switch to a blank design?",', 'title: "Remove protected artwork?",');
  source = source.replace('description: "Your uploaded photos and text will be preserved. The GDP template will be removed from this fabric.",', 'description: "This removes the GDP template from the current fabric. Your uploaded photos and editable text stay in place.",');
  source = source.replace('confirmLabel: "Switch to blank",', 'confirmLabel: "Remove artwork",');
  source = source.replace('cancelLabel: "Keep design",', 'cancelLabel: "Keep artwork",');

  source = source.replace(
    'customers cannot resize, stretch, rotate, delete or erase the selected GDP artwork. Only their photo, text and allowed personalization are editable.',
    'the internal GDP graphic remains protected from erasing or content edits, while the whole artwork can be repositioned, resized, rotated, reset or removed. Customer photo and text layers stay fully editable.'
  );
  source = source.replace(
    'A quick guide from blank garment to finished order.',
    'Five clear steps from garment choice to secure checkout.'
  );

  source = replaceOnce(
    source,
    '  const template = styleTemplate || null;',
    '  const templateLayerStyle = {\n    left: (50 + Number(artworkOffset?.x || 0)) + "%",\n    top: (50 + Number(artworkOffset?.y || 0)) + "%",\n    transform: `translate(-50%, -50%) scale(${Number(artworkScale || 100) / 100}) rotate(${Number(artworkRotation || 0)}deg)`,\n    transformOrigin: "center center",\n  };\n  const template = styleTemplate || null;',
    'template transform style'
  );

  source = replaceOnce(
    source,
    '                  className="absolute inset-0 z-10 h-full w-full object-contain pointer-events-none transition-[filter,opacity] duration-200"\n                  style={{ filter: moodTreatment.templateFilter }}',
    '                  className="absolute z-10 h-full w-full object-contain pointer-events-none transition-[filter,opacity,transform] duration-200"\n                  style={{ ...templateLayerStyle, filter: moodTreatment.templateFilter }}',
    'template image transform'
  );

  source = replaceOnce(
    source,
    '              <div className="p-4 border-t border-[#ebe5dc] bg-[#FFFFFF]">\n                {step === 3 && <AdvancedEditorPanel',
    '              <div data-touch-studio-card={step === 3 ? "true" : undefined} className="p-4 border-t border-[#ebe5dc] bg-[#FFFFFF]">\n                {step === 3 && activeStyleTemplate && (designPath === "bootleg" || designPath === "memorial") && <CustomStudioProtectedArtworkControls\n                  templateName={activeStyleTemplate.name}\n                  scale={artworkScale}\n                  rotation={artworkRotation}\n                  offset={artworkOffset}\n                  onScaleChange={setArtworkScale}\n                  onRotationChange={setArtworkRotation}\n                  onOffsetChange={setArtworkOffset}\n                  onReset={resetPreviewPlacement}\n                  onRemove={chooseNoTemplate}\n                  onTransformStart={checkpointEditor}\n                />}\n                {step === 3 && <AdvancedEditorPanel',
    'Touch Studio card and protected controls'
  );

  source = source.replace(
    'activePreviewTemplate ? "GDP template is locked on this side. Drag, resize and rotate only customer-added content inside the print guide; lettering stays editable."',
    'activePreviewTemplate ? "GDP artwork contents stay protected, while the whole template can be resized, rotated, repositioned, reset or removed. Customer layers remain fully editable."'
  );

  source = replaceOnce(
    source,
    '<div className="flex flex-col gap-2 border-t border-[#ebe5dc] bg-[#17212B] px-4 py-3 text-white sm:flex-row sm:items-center">',
    '<div data-guide-after-order-core="true" className="flex flex-col gap-2 border-t border-[#ebe5dc] bg-[#17212B] px-4 py-3 text-white sm:flex-row sm:items-center">',
    'guide after-order hook'
  );

  return source;
});

patchFile('src/components/storefront/StoreNav.jsx', (input) => {
  let source = input;
  source = replaceOnce(
    source,
    '];\n\nfunction ManagedLogo',
    '];\n\nfunction normalizeNavigationItem(item) {\n  const path = String(item?.path || "");\n  const pathname = path.split("?")[0].split("#")[0].replace(/\\/$/, "") || "/";\n  if (pathname === "/custom-studio" || pathname === "/design") {\n    return { ...item, label: "Custom Studio" };\n  }\n  return item;\n}\n\nfunction ManagedLogo',
    'navigation label normalizer'
  );
  source = replaceOnce(
    source,
    '.map((item) => ({ label: item.label, path: item.url }));',
    '.map((item) => normalizeNavigationItem({ label: item.label, path: item.url }));',
    'managed navigation map'
  );
  return source;
});

patchFile('.github/workflows/build-verification.yml', (input) => {
  let source = input;
  source = replaceOnce(
    source,
    '          node --check scripts/verify-custom-studio-layout-refinement.mjs\n',
    '          node --check scripts/verify-custom-studio-layout-refinement.mjs\n          node --check scripts/verify-custom-studio-touch-studio.mjs\n',
    'Touch Studio syntax check'
  );
  source = replaceOnce(
    source,
    '      - name: Verify Custom Studio garment interactions\n        run: node scripts/verify-custom-studio-garment-interactions.mjs\n',
    '      - name: Verify GDP Touch Studio refinement\n        run: node scripts/verify-custom-studio-touch-studio.mjs\n\n      - name: Verify Custom Studio garment interactions\n        run: node scripts/verify-custom-studio-garment-interactions.mjs\n',
    'Touch Studio verification step'
  );
  return source;
});

console.log('Touch Studio source patch complete.');
