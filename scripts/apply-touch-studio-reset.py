from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return source.replace(before, after, 1)


page_path = Path("src/pages/CustomStudio.jsx")
page = page_path.read_text()

page = replace_once(
    page,
    'import { customerApi } from "@/lib/customerApi";\n',
    'import { customerApi } from "@/lib/customerApi";\nimport { useNotifications } from "@/lib/NotificationContext";\nimport { ToastAction } from "@/components/ui/toast";\n',
    "notification imports",
)

page = replace_once(
    page,
    '  const { addItem } = useCart();\n',
    '  const { addItem } = useCart();\n  const { confirmAction, notify } = useNotifications();\n',
    "notification hook",
)

page = replace_once(
    page,
    '''  const currentEditorSnapshot = () => ({
    layersBySide: JSON.parse(JSON.stringify(editorLayersBySide || { front: [], back: [] })),
    photos: JSON.parse(JSON.stringify(photos || [])),
    artworkStates: JSON.parse(JSON.stringify(artworkStates || defaultArtworkStates(activeStyleTemplate))),
  });''',
    '''  const currentEditorSnapshot = () => ({
    layersBySide: JSON.parse(JSON.stringify(editorLayersBySide || { front: [], back: [] })),
    photos: JSON.parse(JSON.stringify(photos || [])),
    artworkStates: JSON.parse(JSON.stringify(artworkStates || defaultArtworkStates(activeStyleTemplate))),
    designStylesBySide: JSON.parse(JSON.stringify(designStylesBySide || { front: "", back: "" })),
    designMood,
    designIntensity,
    personalization: JSON.parse(JSON.stringify(personalization || {})),
    memorialNameConfirmed,
    placement,
    previewSide,
    previewZoom,
    seasonalDraft: seasonalDraft ? JSON.parse(JSON.stringify(seasonalDraft)) : null,
    seasonalMode,
    rightsConfirmed,
    approvalAcknowledged,
  });''',
    "extended editor snapshot",
)

page = replace_once(
    page,
    '''    setArtworkStates(snapshot.artworkStates || defaultArtworkStates(activeStyleTemplate));
    setSelectedEditorLayerIds({''',
    '''    setArtworkStates(snapshot.artworkStates || defaultArtworkStates(activeStyleTemplate));
    if (snapshot.designStylesBySide) setDesignStylesBySide(snapshot.designStylesBySide);
    if (typeof snapshot.designMood === "string") setDesignMood(snapshot.designMood);
    if (Number.isFinite(Number(snapshot.designIntensity))) setDesignIntensity(Number(snapshot.designIntensity));
    if (snapshot.personalization) setPersonalization(snapshot.personalization);
    if (typeof snapshot.memorialNameConfirmed === "boolean") setMemorialNameConfirmed(snapshot.memorialNameConfirmed);
    if (["front", "back", "front_back"].includes(snapshot.placement)) setPlacement(snapshot.placement);
    if (["front", "back"].includes(snapshot.previewSide)) setPreviewSide(snapshot.previewSide);
    if (Number.isFinite(Number(snapshot.previewZoom))) setPreviewZoom(clampPreview(snapshot.previewZoom));
    if (Object.prototype.hasOwnProperty.call(snapshot, "seasonalDraft")) setSeasonalDraft(snapshot.seasonalDraft);
    if (typeof snapshot.seasonalMode === "boolean") setSeasonalMode(snapshot.seasonalMode);
    if (typeof snapshot.rightsConfirmed === "boolean") setRightsConfirmed(snapshot.rightsConfirmed);
    if (typeof snapshot.approvalAcknowledged === "boolean") setApprovalAcknowledged(snapshot.approvalAcknowledged);
    setSelectedEditorLayerIds({''',
    "extended snapshot restore",
)

page = replace_once(
    page,
    '''  const resetAllEditable = () => {
    checkpointEditor();
    setEditorLayers((current) => current
      .filter((layer) => layer.type === "photo")
      .map((layer, index) => {
        const photo = photos.find((item) => String(item.id || "") === String(layer.photoId || ""));
        const reset = createPhotoLayer(photo, index);
        reset.id = layer.id;
        return reset;
      }));
    setArtworkStates((current) => ({
      ...current,
      [previewSide]: defaultArtworkState(activeStyleTemplate),
    }));
    setPreviewZoom(1);
    const firstPhotoLayer = editorLayers.find((layer) => layer.type === "photo");
    setSelectedEditorLayerId(firstPhotoLayer?.id || "photo");
  };''',
    '''  const resetCurrentSide = () => {
    checkpointEditor();
    const side = previewSide;
    setEditorLayers([]);
    setArtworkStates((current) => ({
      ...current,
      [side]: defaultArtworkState(styleTemplateForSide(side)),
    }));
    setSelectedEditorLayerId("photo");
    setPreviewZoom(1);
    notify({
      tone: "success",
      title: `${side === "front" ? "Front" : "Back"} design reset`,
      description: "Customer layers were cleared from this side. Uploaded media and protected GDP template artwork were kept.",
      action: <ToastAction altText="Undo side reset" onClick={undoEditor}>Undo</ToastAction>,
    });
  };

  const resetEntireDesign = async ({ removeMedia = false } = {}) => {
    const confirmed = await confirmAction({
      eyebrow: "GDP Touch Studio",
      title: removeMedia ? "Reset design and remove uploads?" : "Reset entire design?",
      description: removeMedia
        ? "This clears both fabric sides, selected GDP artwork, lettering, personalization and every uploaded photo from this custom project. Your garment, color and size stay selected."
        : "This clears both fabric sides, selected GDP artwork, lettering and personalization. Your uploaded photos stay in the Media library so you can reuse them.",
      confirmLabel: removeMedia ? "Reset & remove media" : "Reset design",
      cancelLabel: "Keep editing",
      tone: removeMedia ? "destructive" : "warning",
    });
    if (!confirmed) return;

    checkpointEditor();
    setEditorLayersBySide({ front: [], back: [] });
    setSelectedEditorLayerIds({ front: "photo", back: "photo" });
    setDesignStylesBySide({ front: "", back: "" });
    setDesignMood("Original");
    setDesignIntensity(3);
    setPersonalization({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "" });
    setMemorialNameConfirmed(false);
    setArtworkStates(defaultArtworkStates());
    setPlacement("front");
    setPreviewSide("front");
    setPreviewZoom(1);
    setSeasonalDraft(null);
    setSeasonalMode(false);
    setRightsConfirmed(false);
    setApprovalAcknowledged(false);
    setPhotoBrushOpen(false);
    setWarn("");
    if (removeMedia) setPhotos([]);

    notify({
      tone: "success",
      title: removeMedia ? "Design and media reset" : "Design reset",
      description: removeMedia
        ? "The customization and uploaded media were cleared. Undo can restore the previous design."
        : "The customization was cleared and uploaded media was kept. Undo can restore the previous design.",
      action: <ToastAction altText="Undo design reset" onClick={undoEditor}>Undo</ToastAction>,
    });
  };''',
    "scoped reset handlers",
)

page = replace_once(
    page,
    '                  onResetAll={resetAllEditable}\n',
    '                  onResetCurrentSide={resetCurrentSide}\n                  onResetEntireDesign={resetEntireDesign}\n',
    "reset props",
)

page_path.write_text(page)

editor_path = Path("src/components/storefront/CustomStudioAdvancedEditor.jsx")
editor = editor_path.read_text()

editor = replace_once(
    editor,
    '  onResetAll,\n',
    '  onResetCurrentSide,\n  onResetEntireDesign,\n',
    "editor reset props",
)

editor = replace_once(
    editor,
    '  const [showPhotoPicker, setShowPhotoPicker] = useState(false);\n',
    '  const [showPhotoPicker, setShowPhotoPicker] = useState(false);\n  const [showResetMenu, setShowResetMenu] = useState(false);\n',
    "reset menu state",
)

editor = replace_once(
    editor,
    '<button type="button" onClick={onResetAll} className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 text-[10px] font-bold uppercase text-white"><WandSparkles size={14} className="mx-auto mb-1"/>Reset layers</button>',
    '<button type="button" onClick={onResetCurrentSide} className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 text-[10px] font-bold uppercase text-white"><WandSparkles size={14} className="mx-auto mb-1"/>Reset current side</button>',
    "legacy reset button",
)

editor = replace_once(
    editor,
    '          <button type="button" onClick={onRedo} disabled={!canRedo} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-white/65 disabled:opacity-25" aria-label="Redo"><Redo2 size={14}/></button>\n',
    '          <button type="button" onClick={onRedo} disabled={!canRedo} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-white/65 disabled:opacity-25" aria-label="Redo"><Redo2 size={14}/></button>\n          <button type="button" onClick={() => setShowResetMenu((value) => !value)} className={`grid h-9 w-9 place-items-center rounded-xl border ${showResetMenu ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.045] text-white/65"}`} aria-label="Reset options" aria-expanded={showResetMenu}><RotateCcw size={14}/></button>\n',
    "header reset button",
)

editor = replace_once(
    editor,
    '      </div>\n\n      {designPath === "bootleg" ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] text-white/55">',
    '''      </div>

      {showResetMenu && <div className="mt-2 rounded-2xl border border-white/10 bg-[#0A1927] p-2.5 shadow-[0_16px_40px_rgba(0,0,0,.22)]">
        <div className="px-1 pb-2"><div className="font-mono text-[8px] font-bold uppercase tracking-[.16em] text-[#FF8A9A]">Reset workspace</div><div className="mt-1 text-[9px] leading-relaxed text-white/45">Choose how much to reset. Uploaded media stays reusable unless you explicitly remove it.</div></div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <button type="button" disabled={!selectedLayer} onClick={() => { if (selectedLayer) onResetLayer?.(selectedLayer.id); setShowResetMenu(false); }} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-left disabled:opacity-35"><span className="block text-[9px] font-bold uppercase text-white">Reset selected item</span><span className="mt-0.5 block text-[8px] text-white/35">Restore the selected photo, text or sticker layer.</span></button>
          <button type="button" onClick={() => { onResetCurrentSide?.(); setShowResetMenu(false); }} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-left"><span className="block text-[9px] font-bold uppercase text-white">Reset current {previewSide}</span><span className="mt-0.5 block text-[8px] text-white/35">Clear customer layers on this side. Keep uploads and protected template.</span></button>
          <button type="button" onClick={() => { onResetEntireDesign?.({ removeMedia: false }); setShowResetMenu(false); }} className="rounded-xl border border-amber-300/20 bg-amber-300/[.07] px-3 py-2.5 text-left"><span className="block text-[9px] font-bold uppercase text-amber-100">Reset entire design</span><span className="mt-0.5 block text-[8px] text-amber-100/55">Clear both sides and personalization. Keep uploaded media.</span></button>
          <button type="button" onClick={() => { onResetEntireDesign?.({ removeMedia: true }); setShowResetMenu(false); }} className="rounded-xl border border-[#D9273E]/30 bg-[#D9273E]/10 px-3 py-2.5 text-left"><span className="block text-[9px] font-bold uppercase text-[#FFB2BD]">Reset & remove media</span><span className="mt-0.5 block text-[8px] text-[#FFB2BD]/55">Start completely fresh and remove uploaded photos from this project.</span></button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 px-1 font-mono text-[8px] uppercase tracking-[.1em] text-white/30"><Undo2 size={10}/> Reset actions can be undone once</div>
      </div>}

      {designPath === "bootleg" ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] text-white/55">''',
    "reset menu",
)

editor = replace_once(
    editor,
    '          <ToolButton icon={RotateCcw} label="Reset all" onClick={onResetAll}/>\n',
    '          <ToolButton icon={RotateCcw} label="Reset" onClick={() => setShowResetMenu((value) => !value)} active={showResetMenu}/>\n',
    "footer reset button",
)

editor_path.write_text(editor)
print("Touch Studio reset controls applied.")
