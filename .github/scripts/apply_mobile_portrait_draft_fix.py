from pathlib import Path

repo = Path('.')
editor_path = repo / 'src/components/storefront/CustomStudioAdvancedEditor.jsx'
studio_path = repo / 'src/pages/CustomStudio.jsx'

editor = editor_path.read_text()
studio = studio_path.read_text()

old_tool = '''function ToolButton({ active = false, icon: Icon, label, onClick, disabled = false }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex min-w-[66px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-[9px] font-bold uppercase tracking-[.04em] transition disabled:opacity-35 ${active ? "border-[#D9273E] bg-[#D9273E]/15 text-white shadow-[0_0_22px_rgba(217,39,62,.16)]" : "border-white/10 bg-white/[.045] text-white/65 hover:border-white/20 hover:text-white"}`}>
      {Icon && <Icon size={14}/>}<span>{label}</span>
    </button>
  );
}'''
new_tool = '''function ToolButton({ active = false, icon: Icon, label, onClick, disabled = false, mobileFill = false }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-[9px] font-bold uppercase tracking-[.04em] transition disabled:opacity-35 ${mobileFill ? "w-full min-w-0 sm:w-auto sm:min-w-[66px] sm:shrink-0" : "min-w-[66px] shrink-0"} ${active ? "border-[#D9273E] bg-[#D9273E]/15 text-white shadow-[0_0_22px_rgba(217,39,62,.16)]" : "border-white/10 bg-white/[.045] text-white/65 hover:border-white/20 hover:text-white"}`}>
      {Icon && <Icon size={14}/>}<span className="max-w-full truncate">{label}</span>
    </button>
  );
}'''
if old_tool not in editor:
    raise SystemExit('ToolButton source changed; aborting safely')
editor = editor.replace(old_tool, new_tool, 1)

old_root = 'className="sticky bottom-2 z-30 mt-4 w-full min-w-0 max-w-full max-h-[62dvh] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[22px] border border-white/10 bg-[#07131F]/[.96] p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-xl md:static md:max-h-none md:overflow-visible"'
new_root = 'className="sticky bottom-2 z-30 mx-auto mt-4 w-full min-w-0 max-w-[430px] max-h-[74dvh] overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-[24px] border border-white/10 bg-[#07131F]/[.97] p-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-3 md:static md:max-h-none md:max-w-full md:overflow-visible"'
if old_root not in editor:
    raise SystemExit('Panel root source changed; aborting safely')
editor = editor.replace(old_root, new_root, 1)

old_tabs = '''      <div className="mt-3 flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x">{panelTabs.map(([id, icon, label]) => <ToolButton key={id} active={panelTab === id} icon={icon} label={label} onClick={() => { setPanelTab(id); setShowStickers(false); setShowPhotoPicker(false); }}/>)}</div>

      {((panelTab === "photos" && selectedType === "photo") || (panelTab === "lettering" && selectedType === "text") || (panelTab === "layers" && selectedType === "sticker")) && contextTools.length > 0 && <div className="mt-3 flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x">{contextTools.map(([id, icon, label]) => <ToolButton key={id} active={activeTool === id} icon={icon} label={label} onClick={() => setActiveTool(id)} disabled={id === "erase" && !hasPhoto}/>)}</div>}'''
new_tabs = '''      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:flex sm:max-w-full sm:overflow-x-auto sm:overscroll-x-contain sm:pb-1 sm:touch-pan-x">{panelTabs.map(([id, icon, label]) => <ToolButton key={id} mobileFill active={panelTab === id} icon={icon} label={label} onClick={() => { setPanelTab(id); setShowStickers(false); setShowPhotoPicker(false); }}/>)}</div>

      {((panelTab === "photos" && selectedType === "photo") || (panelTab === "lettering" && selectedType === "text") || (panelTab === "layers" && selectedType === "sticker")) && contextTools.length > 0 && <div className="mt-3 grid grid-cols-3 gap-1.5 sm:flex sm:max-w-full sm:overflow-x-auto sm:overscroll-x-contain sm:pb-1 sm:touch-pan-x">{contextTools.map(([id, icon, label]) => <ToolButton key={id} mobileFill active={activeTool === id} icon={icon} label={label} onClick={() => setActiveTool(id)} disabled={id === "erase" && !hasPhoto}/>)}</div>}'''
if old_tabs not in editor:
    raise SystemExit('Panel tab source changed; aborting safely')
editor = editor.replace(old_tabs, new_tabs, 1)

old_state = '''  const [draftStatus, setDraftStatus] = useState("idle");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftSaveTimerRef = useRef(null);'''
new_state = '''  const [draftStatus, setDraftStatus] = useState("idle");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const draftSaveTimerRef = useRef(null);'''
if old_state not in studio:
    raise SystemExit('Draft state source changed; aborting safely')
studio = studio.replace(old_state, new_state, 1)

start = studio.index('  useEffect(() => {\n    if (draftReady || !catalog.length || location.state?.seasonalDraft) return;')
end_marker = '  useEffect(() => {\n    if (!draftReady || seasonalMode || saving || !product?.id || typeof window === "undefined") return undefined;'
end = studio.index(end_marker, start)
old_restore_block = studio[start:end]

new_restore_block = r'''  const restoreStudioDraft = (draft) => {
    if (!draft) return false;
    const requestedProductId = String(params.get("product") || "");
    const savedProductId = String(draft.productId || "");
    if (requestedProductId && savedProductId && requestedProductId !== savedProductId) return false;

    const draftProduct = catalog.find((item) => String(item.id) === savedProductId)
      || catalog.find((item) => String(item.id) === requestedProductId)
      || null;
    if (!draftProduct) return false;

    const colors = productColors(draftProduct);
    const restoredColor = colors.includes(draft.color) ? draft.color : (colors[0] || "");
    const sizes = productSizes(draftProduct, restoredColor);
    const restoredSize = sizes.includes(draft.size) ? draft.size : "";
    const restoredPhotos = Array.isArray(draft.photos) ? draft.photos.map((photo) => ({
      ...photo,
      sourceFile: null,
      processingStatus: photo?.processingStatus === "processing" ? "failed" : photo?.processingStatus,
      processingMessage: photo?.processingStatus === "processing"
        ? "Background processing was interrupted. Tap retry to continue."
        : photo?.processingMessage,
    })) : [];

    setProduct(draftProduct);
    setGarment(garmentFromProduct(draftProduct));
    setColor(restoredColor);
    setSize(restoredSize);
    setQty(Math.max(1, Math.min(99, Number(draft.qty || 1))));
    setStep(Math.max(1, Math.min(STEPS.length, Number(draft.step || 1))));
    setDesignPath(String(draft.designPath || ""));
    setDesignStyle(String(draft.designStyle || ""));
    setDesignMood(String(draft.designMood || ""));
    setDesignIntensity(Math.max(1, Math.min(5, Number(draft.designIntensity || 3))));
    setPlacement(["front", "back", "front_back"].includes(draft.placement) ? draft.placement : "front");
    setPreviewSide(draft.previewSide === "back" ? "back" : "front");
    setGroupGarments(Array.isArray(draft.groupGarments) ? draft.groupGarments : []);
    setPhotos(restoredPhotos);
    setEditorLayersBySide(draft.editorLayersBySide || { front: [], back: [] });
    setSelectedEditorLayerIds(draft.selectedEditorLayerIds || { front: "photo", back: "photo" });
    setPersonalization({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "", ...(draft.personalization || {}) });
    setMemorialNameConfirmed(Boolean(draft.memorialNameConfirmed));
    setNeedByDate(String(draft.needByDate || ""));
    setPriority(draft.priority === "rush" ? "rush" : "standard");
    setArtworkStates(draft.artworkStates || defaultArtworkStates());
    setPreviewZoom(clampPreview(draft.previewZoom || 1));
    setRightsConfirmed(false);
    setApprovalAcknowledged(false);
    setPendingDraft(null);
    setDraftRestored(true);
    setDraftStatus("saved");
    setDraftReady(true);
    window.scrollTo({ top: 0, behavior: "instant" });
    return true;
  };

  const startFreshStudio = () => {
    try {
      window.localStorage.removeItem(STUDIO_DRAFT_KEY);
    } catch {
      // Starting fresh should still work when browser storage is unavailable.
    }
    setPendingDraft(null);
    setDraftRestored(false);
    setDraftStatus("idle");
    setDraftReady(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  useEffect(() => {
    if (draftReady || pendingDraft || !catalog.length || location.state?.seasonalDraft) return;
    const draft = readStudioDraft();
    if (!draft) {
      setDraftReady(true);
      return;
    }

    const requestedProductId = String(params.get("product") || "");
    const savedProductId = String(draft.productId || "");
    if (requestedProductId && savedProductId && requestedProductId !== savedProductId) {
      setDraftReady(true);
      return;
    }

    if (location.state?.resumeStudioDraft === true || params.get("resume") === "1") {
      if (!restoreStudioDraft(draft)) setDraftReady(true);
      return;
    }

    setPendingDraft(draft);
    setDraftStatus("saved");
  }, [catalog, draftReady, pendingDraft]);

'''
studio = studio[:start] + new_restore_block + studio[end:]

root = '    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[linear-gradient(180deg,#F4F7FA_0%,#EDF2F6_38%,#F8FAFC_100%)]">'
if root not in studio:
    raise SystemExit('Custom Studio root source changed; aborting safely')
modal = r'''    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[linear-gradient(180deg,#F4F7FA_0%,#EDF2F6_38%,#F8FAFC_100%)]">
      {pendingDraft && <div className="fixed inset-0 z-[150] grid place-items-center bg-[#07131F]/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="saved-studio-draft-title">
        <div className="w-full max-w-[390px] rounded-[24px] border border-white/10 bg-[#07131F] p-5 text-white shadow-[0_28px_90px_rgba(0,0,0,.45)]">
          <div className="font-mono text-[9px] uppercase tracking-[.2em] text-[#D9273E]">Saved custom design</div>
          <h2 id="saved-studio-draft-title" className="mt-2 text-xl font-black tracking-tight">Resume your unfinished design?</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">Your previous Custom Studio work is saved, but it will not reopen automatically. Resume it only when you want to continue.</p>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => restoreStudioDraft(pendingDraft)} className="h-11 rounded-xl bg-[#D9273E] px-4 text-xs font-bold uppercase tracking-wide text-white">Resume previous design</button>
            <button type="button" onClick={startFreshStudio} className="h-11 rounded-xl border border-white/12 bg-white/[.045] px-4 text-xs font-bold uppercase tracking-wide text-white/80">Start fresh</button>
          </div>
          <p className="mt-3 text-center text-[9px] leading-relaxed text-white/35">Starting fresh clears the saved unfinished draft. Completed cart designs are not affected.</p>
        </div>
      </div>}'''
studio = studio.replace(root, modal, 1)

editor_path.write_text(editor)
studio_path.write_text(studio)
print('Applied portrait mobile panel and explicit draft-resume behavior.')
