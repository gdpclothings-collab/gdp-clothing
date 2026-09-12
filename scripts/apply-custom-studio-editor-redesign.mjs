import fs from "node:fs";

const advancedPath = "src/components/storefront/CustomStudioAdvancedEditor.jsx";
const studioPath = "src/pages/CustomStudio.jsx";

function mustReplace(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Redesign migration could not find: ${label}`);
  }
  return source.replace(search, replacement);
}

function mustReplaceAll(source, search, replacement, minimum, label) {
  const count = source.split(search).length - 1;
  if (count < minimum) {
    throw new Error(`Redesign migration expected at least ${minimum} matches for ${label}, found ${count}`);
  }
  return source.split(search).join(replacement);
}

let advanced = fs.readFileSync(advancedPath, "utf8");
let studio = fs.readFileSync(studioPath, "utf8");

advanced = mustReplace(
  advanced,
  '<div className="mt-0.5 text-[8px] uppercase tracking-[.12em] text-white/35">{layer.type}{layer.locked ? " · locked" : ""}</div>',
  '<div className="mt-0.5 text-[8px] uppercase tracking-[.12em] text-white/35">{layer.type}{layer.locked ? " · locked" : ""} · Layer {index + 1} of {editorLayers.length}</div>',
  "layer position label"
);

advanced = mustReplace(
  advanced,
  `            <div className="flex gap-1">\n              <button type="button" onClick={() => onPatchLayer?.(layer.id, { visible: layer.visible === false })} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-white/65" title={layer.visible === false ? "Show layer" : "Hide layer"}>{layer.visible === false ? <EyeOff size={13}/> : <Eye size={13}/>}</button>\n              <button type="button" onClick={() => onPatchLayer?.(layer.id, { locked: !layer.locked })} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-white/65" title={layer.locked ? "Unlock layer" : "Lock layer"}>{layer.locked ? <Lock size={13}/> : <Unlock size={13}/>}</button>\n            </div>`,
  `            <div className="flex gap-1">\n              <button type="button" onClick={() => onMoveLayer?.(layer.id, -1)} disabled={index === 0 || layer.locked} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-white/65 disabled:opacity-25" title="Send backward"><ArrowDown size={13}/></button>\n              <button type="button" onClick={() => onMoveLayer?.(layer.id, 1)} disabled={index === editorLayers.length - 1 || layer.locked} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-white/65 disabled:opacity-25" title="Bring forward"><ArrowUp size={13}/></button>\n              <button type="button" onClick={() => onPatchLayer?.(layer.id, { visible: layer.visible === false })} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-white/65" title={layer.visible === false ? "Show layer" : "Hide layer"}>{layer.visible === false ? <EyeOff size={13}/> : <Eye size={13}/>}</button>\n              <button type="button" onClick={() => onPatchLayer?.(layer.id, { locked: !layer.locked })} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-white/65" title={layer.locked ? "Unlock layer" : "Lock layer"}>{layer.locked ? <Lock size={13}/> : <Unlock size={13}/>}</button>\n            </div>`,
  "layer ordering controls"
);

advanced = mustReplace(
  advanced,
  `    ["erase", Eraser, "Erase"],\n    ["remove", Trash2, "Remove"],\n  ] : [`,
  `    ["erase", Eraser, "Erase"],\n    ["remove", Trash2, "Remove"],\n    ["more", Layers, "Layer"],\n  ] : [`,
  "bootleg layer tool"
);

advanced = mustReplace(
  advanced,
  'className="sticky bottom-2 z-30 mx-auto mt-4 w-full min-w-0 max-w-[430px] max-h-[74dvh] overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-[24px] border border-white/10 bg-[#07131F]/[.97] p-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-3 md:static md:max-h-none md:max-w-full md:overflow-visible"',
  'className="sticky bottom-2 z-30 mx-auto mt-4 w-full min-w-0 max-w-[430px] max-h-[74dvh] overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-[24px] border border-white/10 bg-[#07131F]/[.97] p-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-3 md:sticky md:top-24 md:bottom-auto md:max-h-[calc(100dvh-7rem)] md:max-w-full md:overflow-y-auto"',
  "desktop sticky editor"
);

advanced = mustReplace(
  advanced,
  `      <div className="mt-2 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] leading-relaxed text-white/48">\n        {designPath === "bootleg" ? <><strong className="text-white/80">Simple editing:</strong> select a photo or text on the garment, then move, resize or edit it here. Press Delete / Backspace to remove the selected item from the canvas. Uploaded photos stay saved in Media.</> : <><strong className="text-white/80">Touch-first:</strong> drag to move · pinch to resize · twist to rotate · double-tap text to type · double-tap a photo for crop mode.</>}\n      </div>`,
  `      {designPath === "bootleg" ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] text-white/55">\n        <span className="font-mono uppercase tracking-[.12em] text-[#FF8A9A]">Editing {previewSide}</span>\n        <span className="text-white/25">•</span>\n        <span className="min-w-0 truncate"><strong className="text-white/80">Selected:</strong> {selectedLayer ? labelForLayer(selectedLayer, Math.max(0, editorLayers.findIndex((item) => item.id === selectedLayer.id)), photosById) : "Choose a layer"}</span>\n        {selectedLayer && <><span className="text-white/25">•</span><span>Layer {Math.max(0, editorLayers.findIndex((item) => item.id === selectedLayer.id)) + 1} of {editorLayers.length}</span></>}\n        <span className="ml-auto rounded-full border border-[#D9273E]/35 bg-[#D9273E]/10 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[.1em] text-white">{String(activeTool || "layers").replace(/[-_]/g, " ")}</span>\n      </div> : <div className="mt-2 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] leading-relaxed text-white/48"><strong className="text-white/80">Touch-first:</strong> drag to move · pinch to resize · twist to rotate · double-tap text to type · double-tap a photo for crop mode.</div>}`,
  "compact bootleg status row"
);

advanced = mustReplace(
  advanced,
  '{(sideStatus || viewGuidance || canCopyFrontToBack) && <div className="mt-2 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2.5 text-[9px] leading-relaxed text-white/48">',
  '{designPath !== "bootleg" && (sideStatus || viewGuidance || canCopyFrontToBack) && <div className="mt-2 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2.5 text-[9px] leading-relaxed text-white/48">',
  "remove duplicate bootleg side guidance"
);

advanced = mustReplaceAll(
  advanced,
  'outline: selected ? "1px solid rgba(255,255,255,.95)" : "none", outlineOffset: selected ? "4px" : "0"',
  'outline: selected ? "2px solid rgba(217,39,62,.98)" : "none", outlineOffset: selected ? "5px" : "0", boxShadow: selected ? "0 0 0 5px rgba(217,39,62,.12), 0 10px 28px rgba(7,19,31,.26)" : "none"',
  2,
  "selected layer canvas emphasis"
);

advanced = mustReplaceAll(advanced, '>Fit · no crop</button>', '>Fit Inside</button>', 2, "fit labels");
advanced = mustReplaceAll(advanced, '>Crop 4:5</button>', '>Fill & Crop</button>', 1, "photo crop label");
advanced = mustReplaceAll(advanced, '>Crop to fill</button>', '>Fill & Crop</button>', 1, "legacy crop label");
advanced = mustReplaceAll(advanced, 'Crop to Fill trims image edges. Use Fit · No Crop to keep the full artwork visible.', 'Fill & Crop trims image edges. Use Fit Inside to keep the full artwork visible.', 1, "crop helper copy");
advanced = mustReplaceAll(advanced, '<Eye size={12} className="mr-1 inline"/>Guide</button>', '<Eye size={12} className="mr-1 inline"/>Print Area</button>', 1, "print area canvas label");
advanced = mustReplaceAll(advanced, '<Ruler size={12} className="mr-1 inline"/>Measure</button>', '<Ruler size={12} className="mr-1 inline"/>Measurements</button>', 1, "measurements canvas label");
advanced = mustReplaceAll(advanced, '<span className="mr-1 uppercase tracking-wide text-amber-100">Print-area check:</span>', '<span className="mr-1 uppercase tracking-wide text-amber-100">Production check:</span>', 1, "production warning label");

advanced = mustReplace(
  advanced,
  '<label className={`flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[.035] px-3 text-center transition hover:border-[#D9273E]/60 ${uploading ? "pointer-events-none opacity-55" : ""}`}>',
  '<label className={`flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[.035] px-3 text-center transition hover:border-[#D9273E]/60 ${(photoAssets || []).length ? "min-h-12 py-2" : "min-h-20"} ${uploading ? "pointer-events-none opacity-55" : ""}`}>',
  "compact uploader with media"
);

advanced = mustReplace(
  advanced,
  '{uploading ? "Preparing upload…" : designPath === "upload" ? "Upload print artwork" : "Upload photo"}',
  '{uploading ? "Preparing upload…" : (photoAssets || []).length ? "Add more photos" : designPath === "upload" ? "Upload print artwork" : "Upload photo"}',
  "uploader title"
);

advanced = mustReplace(
  advanced,
  '<span className="mt-0.5 block text-[8px] text-white/38">JPG, PNG or WEBP · max {uploadLimitMb}MB each</span>',
  '{!(photoAssets || []).length && <span className="mt-0.5 block text-[8px] text-white/38">JPG, PNG or WEBP · max {uploadLimitMb}MB each</span>}',
  "uploader helper collapse"
);

advanced = mustReplace(
  advanced,
  '        <PositionRows layer={selectedLayer} patch={patch}/>\n        <div className="grid grid-cols-2 gap-2">',
  '        <PositionRows layer={selectedLayer} patch={patch}/>\n        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">\n          <button type="button" onClick={() => patch({ x: 50 })} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-[9px] font-bold uppercase text-white/60">Center H</button>\n          <button type="button" onClick={() => patch({ y: 50 })} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-[9px] font-bold uppercase text-white/60">Center V</button>\n          <button type="button" onClick={() => patch({ rotation: Math.max(-180, Number(selectedLayer.rotation || 0) - 90) })} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-[9px] font-bold uppercase text-white/60">−90°</button>\n          <button type="button" onClick={() => patch({ rotation: Math.min(180, Number(selectedLayer.rotation || 0) + 90) })} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-[9px] font-bold uppercase text-white/60">+90°</button>\n        </div>\n        <div className="grid grid-cols-2 gap-2">',
  "photo transform quick actions"
);

advanced = mustReplace(
  advanced,
  'legacyArtworkActive && !selectedLayer ? renderLegacyArtworkTool() : selectedType === "photo" && <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderPhotoTool()}</div>',
  'legacyArtworkActive && !selectedLayer ? renderLegacyArtworkTool() : selectedType === "photo" && <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3"><div className="mb-3 flex min-w-0 items-center justify-between gap-2 border-b border-white/[.07] pb-2"><div className="min-w-0"><div className="font-mono text-[8px] font-bold uppercase tracking-[.15em] text-[#FF8A9A]">{String(activeTool || "transform").replace(/[-_]/g, " ")}</div><div className="mt-0.5 truncate text-[10px] font-semibold text-white/78">{selectedLayer ? labelForLayer(selectedLayer, Math.max(0, editorLayers.findIndex((item) => item.id === selectedLayer.id)), photosById) : "Photo"}</div></div><div className="shrink-0 rounded-full border border-white/10 bg-white/[.04] px-2 py-1 font-mono text-[8px] uppercase text-white/45">{previewSide} · Layer {Math.max(0, editorLayers.findIndex((item) => item.id === selectedLayer?.id)) + 1}/{Math.max(1, editorLayers.length)}</div></div>{renderPhotoTool()}</div>',
  "photo tool mode header"
);

studio = mustReplace(
  studio,
  'ZoomIn, ZoomOut, Lock, Unlock, Trash2 } from "lucide-react";',
  'ZoomIn, ZoomOut, Lock, Unlock } from "lucide-react";',
  "remove unused Trash2 import"
);

studio = mustReplace(
  studio,
  '{selectedPhotoLayer && <button type="button" onClick={() => deleteEditorLayer(selectedPhotoLayer.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#D9273E]/30 bg-[#D9273E]/[.06] px-3 py-2 text-[11px] font-bold text-[#B91C31] transition hover:bg-[#D9273E]/10" aria-label={`Remove selected photo from ${previewSide} fabric`}><Trash2 size={14}/> Remove photo</button>}',
  '',
  "duplicate preview remove action"
);

studio = mustReplaceAll(
  studio,
  '(fullscreen ? "h-full" : "h-[370px] sm:h-[430px]")',
  '(fullscreen ? "h-full" : "h-[420px] sm:h-[520px] lg:h-[580px]")',
  1,
  "larger garment canvas"
);

studio = mustReplaceAll(
  studio,
  '<Maximize2 size={14}/> Print area {showGuides ? "on" : "off"}</button>',
  '<Maximize2 size={14}/> Print Area</button>',
  1,
  "preview print area label"
);

studio = mustReplaceAll(
  studio,
  '<Ruler size={14}/> Measurements {showMeasurements ? "on" : "off"}</button>',
  '<Ruler size={14}/> Measurements</button>',
  1,
  "preview measurements label"
);

fs.writeFileSync(advancedPath, advanced);
fs.writeFileSync(studioPath, studio);

console.log("Applied GDP Custom Studio editor redesign successfully.");
