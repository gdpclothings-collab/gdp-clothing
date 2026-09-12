import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  return source.replace(before, after);
}

const pagePath = 'src/pages/CustomStudio.jsx';
let page = fs.readFileSync(pagePath, 'utf8');

page = replaceOnce(
  page,
  'import { customerApi } from "@/lib/customerApi";\n',
  'import { customerApi } from "@/lib/customerApi";\nimport { useNotifications } from "@/lib/NotificationContext";\nimport { ToastAction } from "@/components/ui/toast";\n',
  'CustomStudio notification imports'
);

page = replaceOnce(
  page,
  '  const { addItem } = useCart();\n',
  '  const { addItem } = useCart();\n  const { confirmAction, notify } = useNotifications();\n',
  'CustomStudio notification hook'
);

page = replaceOnce(
  page,
  `  const currentEditorSnapshot = () => ({\n    layersBySide: JSON.parse(JSON.stringify(editorLayersBySide || { front: [], back: [] })),\n    photos: JSON.parse(JSON.stringify(photos || [])),\n    artworkStates: JSON.parse(JSON.stringify(artworkStates || defaultArtworkStates(activeStyleTemplate))),\n  });`,
  `  const currentEditorSnapshot = () => ({\n    layersBySide: JSON.parse(JSON.stringify(editorLayersBySide || { front: [], back: [] })),\n    photos: JSON.parse(JSON.stringify(photos || [])),\n    artworkStates: JSON.parse(JSON.stringify(artworkStates || defaultArtworkStates(activeStyleTemplate))),\n    designStylesBySide: JSON.parse(JSON.stringify(designStylesBySide || { front: "", back: "" })),\n    designMood,\n    designIntensity,\n    personalization: JSON.parse(JSON.stringify(personalization || {})),\n    memorialNameConfirmed,\n    placement,\n    previewSide,\n    previewZoom,\n    seasonalDraft: seasonalDraft ? JSON.parse(JSON.stringify(seasonalDraft)) : null,\n    seasonalMode,\n    rightsConfirmed,\n    approvalAcknowledged,\n  });`,
  'extended editor snapshot'
);

page = replaceOnce(
  page,
  `    setArtworkStates(snapshot.artworkStates || defaultArtworkStates(activeStyleTemplate));\n    setSelectedEditorLayerIds({`,
  `    setArtworkStates(snapshot.artworkStates || defaultArtworkStates(activeStyleTemplate));\n    if (snapshot.designStylesBySide) setDesignStylesBySide(snapshot.designStylesBySide);\n    if (typeof snapshot.designMood === "string") setDesignMood(snapshot.designMood);\n    if (Number.isFinite(Number(snapshot.designIntensity))) setDesignIntensity(Number(snapshot.designIntensity));\n    if (snapshot.personalization) setPersonalization(snapshot.personalization);\n    if (typeof snapshot.memorialNameConfirmed === "boolean") setMemorialNameConfirmed(snapshot.memorialNameConfirmed);\n    if (["front", "back", "front_back"].includes(snapshot.placement)) setPlacement(snapshot.placement);\n    if (["front", "back"].includes(snapshot.previewSide)) setPreviewSide(snapshot.previewSide);\n    if (Number.isFinite(Number(snapshot.previewZoom))) setPreviewZoom(clampPreview(snapshot.previewZoom));\n    if (Object.prototype.hasOwnProperty.call(snapshot, "seasonalDraft")) setSeasonalDraft(snapshot.seasonalDraft);\n    if (typeof snapshot.seasonalMode === "boolean") setSeasonalMode(snapshot.seasonalMode);\n    if (typeof snapshot.rightsConfirmed === "boolean") setRightsConfirmed(snapshot.rightsConfirmed);\n    if (typeof snapshot.approvalAcknowledged === "boolean") setApprovalAcknowledged(snapshot.approvalAcknowledged);\n    setSelectedEditorLayerIds({`,
  'restore extended editor snapshot'
);

page = replaceOnce(
  page,
  `  const resetAllEditable = () => {\n    checkpointEditor();\n    setEditorLayers((current) => current\n      .filter((layer) => layer.type === "photo")\n      .map((layer, index) => {\n        const photo = photos.find((item) => String(item.id || "") === String(layer.photoId || ""));\n        const reset = createPhotoLayer(photo, index);\n        reset.id = layer.id;\n        return reset;\n      }));\n    setArtworkStates((current) => ({\n      ...current,\n      [previewSide]: defaultArtworkState(activeStyleTemplate),\n    }));\n    setPreviewZoom(1);\n    const firstPhotoLayer = editorLayers.find((layer) => layer.type === "photo");\n    setSelectedEditorLayerId(firstPhotoLayer?.id || "photo");\n  };`,
  `  const resetCurrentSide = () => {\n    checkpointEditor();\n    const side = previewSide;\n    setEditorLayers([]);\n    setArtworkStates((current) => ({\n      ...current,\n      [side]: defaultArtworkState(styleTemplateForSide(side)),\n    }));\n    setSelectedEditorLayerId("photo");\n    setPreviewZoom(1);\n    notify({\n      tone: "success",\n      title: \`${'${side === "front" ? "Front" : "Back"}'} design reset\`,\n      description: "Customer layers were cleared from this side. Uploaded media and protected GDP template artwork were kept.",\n      action: <ToastAction altText="Undo side reset" onClick={undoEditor}>Undo</ToastAction>,\n    });\n  };\n\n  const resetEntireDesign = async ({ removeMedia = false } = {}) => {\n    const confirmed = await confirmAction({\n      eyebrow: "GDP Touch Studio",\n      title: removeMedia ? "Reset design and remove uploads?" : "Reset entire design?",\n      description: removeMedia\n        ? "This clears both fabric sides, selected GDP artwork, lettering, personalization and every uploaded photo from this custom project. Your garment, color and size stay selected."\n        : "This clears both fabric sides, selected GDP artwork, lettering and personalization. Your uploaded photos stay in the Media library so you can reuse them.",\n      confirmLabel: removeMedia ? "Reset & remove media" : "Reset design",\n      cancelLabel: "Keep editing",\n      tone: removeMedia ? "destructive" : "warning",\n    });\n    if (!confirmed) return;\n\n    checkpointEditor();\n    setEditorLayersBySide({ front: [], back: [] });\n    setSelectedEditorLayerIds({ front: "photo", back: "photo" });\n    setDesignStylesBySide({ front: "", back: "" });\n    setDesignMood("Original");\n    setDesignIntensity(3);\n    setPersonalization({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "" });\n    setMemorialNameConfirmed(false);\n    setArtworkStates(defaultArtworkStates());\n    setPlacement("front");\n    setPreviewSide("front");\n    setPreviewZoom(1);\n    setSeasonalDraft(null);\n    setSeasonalMode(false);\n    setRightsConfirmed(false);\n    setApprovalAcknowledged(false);\n    setPhotoBrushOpen(false);\n    setWarn("");\n    if (removeMedia) setPhotos([]);\n\n    notify({\n      tone: "success",\n      title: removeMedia ? "Design and media reset" : "Design reset",\n      description: removeMedia\n        ? "The customization and uploaded media were cleared. Undo can restore the previous design."\n        : "The customization was cleared and uploaded media was kept. Undo can restore the previous design.",\n      action: <ToastAction altText="Undo design reset" onClick={undoEditor}>Undo</ToastAction>,\n    });\n  };`,
  'reset scope handlers'
);

page = replaceOnce(
  page,
  '                  onResetAll={resetAllEditable}\n',
  '                  onResetCurrentSide={resetCurrentSide}\n                  onResetEntireDesign={resetEntireDesign}\n',
  'AdvancedEditorPanel reset props'
);

fs.writeFileSync(pagePath, page);

const editorPath = 'src/components/storefront/CustomStudioAdvancedEditor.jsx';
let editor = fs.readFileSync(editorPath, 'utf8');

editor = replaceOnce(
  editor,
  '  onResetAll,\n',
  '  onResetCurrentSide,\n  onResetEntireDesign,\n',
  'AdvancedEditorPanel reset prop names'
);

editor = replaceOnce(
  editor,
  '  const [showPhotoPicker, setShowPhotoPicker] = useState(false);\n',
  '  const [showPhotoPicker, setShowPhotoPicker] = useState(false);\n  const [showResetMenu, setShowResetMenu] = useState(false);\n',
  'reset menu state'
);

editor = replaceOnce(
  editor,
  '<button type="button" onClick={onResetAll} className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 text-[10px] font-bold uppercase text-white"><WandSparkles size={14} className="mx-auto mb-1"/>Reset layers</button>',
  '<button type="button" onClick={onResetCurrentSide} className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 text-[10px] font-bold uppercase text-white"><WandSparkles size={14} className="mx-auto mb-1"/>Reset current side</button>',
  'legacy photo reset button'
);

editor = replaceOnce(
  editor,
  '          <button type="button" onClick={onRedo} disabled={!canRedo} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-white/65 disabled:opacity-25" aria-label="Redo"><Redo2 size={14}/></button>\n',
  '          <button type="button" onClick={onRedo} disabled={!canRedo} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-white/65 disabled:opacity-25" aria-label="Redo"><Redo2 size={14}/></button>\n          <button type="button" onClick={() => setShowResetMenu((value) => !value)} className={`grid h-9 w-9 place-items-center rounded-xl border ${showResetMenu ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.045] text-white/65"}`} aria-label="Reset options" aria-expanded={showResetMenu}><RotateCcw size={14}/></button>\n',
  'header reset button'
);

editor = replaceOnce(
  editor,
  '      </div>\n\n      {designPath === "bootleg" ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] text-white/55">',
  `      </div>\n\n      {showResetMenu && <div className="mt-2 rounded-2xl border border-white/10 bg-[#0A1927] p-2.5 shadow-[0_16px_40px_rgba(0,0,0,.22)]">\n        <div className="px-1 pb-2"><div className="font-mono text-[8px] font-bold uppercase tracking-[.16em] text-[#FF8A9A]">Reset workspace</div><div className="mt-1 text-[9px] leading-relaxed text-white/45">Choose how much to reset. Uploaded media stays reusable unless you explicitly remove it.</div></div>\n        <div className="grid gap-1.5 sm:grid-cols-2">\n          <button type="button" disabled={!selectedLayer} onClick={() => { if (selectedLayer) onResetLayer?.(selectedLayer.id); setShowResetMenu(false); }} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-left disabled:opacity-35"><span className="block text-[9px] font-bold uppercase text-white">Reset selected item</span><span className="mt-0.5 block text-[8px] text-white/35">Restore the selected photo, text or sticker layer.</span></button>\n          <button type="button" onClick={() => { onResetCurrentSide?.(); setShowResetMenu(false); }} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-left"><span className="block text-[9px] font-bold uppercase text-white">Reset current {previewSide}</span><span className="mt-0.5 block text-[8px] text-white/35">Clear customer layers on this side. Keep uploads and protected template.</span></button>\n          <button type="button" onClick={() => { onResetEntireDesign?.({ removeMedia: false }); setShowResetMenu(false); }} className="rounded-xl border border-amber-300/20 bg-amber-300/[.07] px-3 py-2.5 text-left"><span className="block text-[9px] font-bold uppercase text-amber-100">Reset entire design</span><span className="mt-0.5 block text-[8px] text-amber-100/55">Clear both sides and personalization. Keep uploaded media.</span></button>\n          <button type="button" onClick={() => { onResetEntireDesign?.({ removeMedia: true }); setShowResetMenu(false); }} className="rounded-xl border border-[#D9273E]/30 bg-[#D9273E]/10 px-3 py-2.5 text-left"><span className="block text-[9px] font-bold uppercase text-[#FFB2BD]">Reset & remove media</span><span className="mt-0.5 block text-[8px] text-[#FFB2BD]/55">Start completely fresh and remove uploaded photos from this project.</span></button>\n        </div>\n        <div className="mt-2 flex items-center gap-1.5 px-1 font-mono text-[8px] uppercase tracking-[.1em] text-white/30"><Undo2 size={10}/> Reset actions can be undone once</div>\n      </div>}\n\n      {designPath === "bootleg" ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] text-white/55">`,
  'reset options menu'
);

editor = replaceOnce(
  editor,
  '          <ToolButton icon={RotateCcw} label="Reset all" onClick={onResetAll}/>\n',
  '          <ToolButton icon={RotateCcw} label="Reset" onClick={() => setShowResetMenu((value) => !value)} active={showResetMenu}/>\n',
  'footer reset button'
);

fs.writeFileSync(editorPath, editor);

const verifyPath = 'scripts/verify-touch-studio-reset.mjs';
fs.writeFileSync(verifyPath, `import fs from 'node:fs';\n\nconst page = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');\nconst editor = fs.readFileSync('src/components/storefront/CustomStudioAdvancedEditor.jsx', 'utf8');\n\nconst checks = [\n  ['notification system wired', page.includes('useNotifications') && page.includes('ToastAction')],\n  ['history snapshot covers full reset state', page.includes('designStylesBySide: JSON.parse') && page.includes('previewZoom,') && page.includes('personalization: JSON.parse')],\n  ['current-side reset implemented', page.includes('const resetCurrentSide = () =>') && page.includes('setEditorLayers([])')],\n  ['entire-design reset implemented', page.includes('const resetEntireDesign = async ({ removeMedia = false } = {}) =>')],\n  ['media-preserving reset implemented', page.includes('uploaded media was kept')],\n  ['destructive media reset implemented', page.includes('if (removeMedia) setPhotos([])')],\n  ['undo toast implemented', page.includes('Undo design reset') && page.includes('onClick={undoEditor}')],\n  ['reset menu has selected scope', editor.includes('Reset selected item')],\n  ['reset menu has side scope', editor.includes('Reset current {previewSide}')],\n  ['reset menu has full scope', editor.includes('Reset entire design')],\n  ['reset menu has remove-media scope', editor.includes('Reset & remove media')],\n  ['old ambiguous Reset all footer removed', !editor.includes('label="Reset all"')],\n];\n\nlet failed = false;\nfor (const [label, ok] of checks) {\n  console.log(`${'${ok ? "PASS" : "FAIL"}'}: ${'${label}'}`);\n  if (!ok) failed = true;\n}\nif (failed) process.exit(1);\n`);

console.log('Touch Studio reset controls applied.');
