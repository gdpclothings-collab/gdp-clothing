from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return source.replace(before, after, 1)


path = Path("src/components/storefront/SeasonalStudioLayered.jsx")
source = path.read_text()

source = replace_once(
    source,
    'import { requestConfirmation } from "@/lib/NotificationContext";\n',
    'import { requestConfirmation, requestNotification } from "@/lib/NotificationContext";\nimport { ToastAction } from "@/components/ui/toast";\n',
    "notification imports",
)

source = replace_once(
    source,
    "  const [tabletControlsOpen, setTabletControlsOpen] = useState(true);\n",
    "  const [tabletControlsOpen, setTabletControlsOpen] = useState(true);\n  const [showResetMenu, setShowResetMenu] = useState(false);\n",
    "reset menu state",
)

reset_anchor = '''  const resetActiveLayer = () => {
    if (!activeEntry?.artwork || !area) return;
    checkpoint();
    const initial = fitSeasonalArtwork(activeEntry.artwork, area, 0);
    patchLayer(activeEntry.layer.id, {
      requested: 0,
      position: { x: initial ? Math.max(0, (area.width - initial.width) / 2) : 0, y: initial ? Math.max(0, (area.height - initial.height) / 2) : 0 },
      rotation: 0,
    });
  };
'''
reset_replacement = reset_anchor + '''
  const resetEntireSeasonalDesign = async () => {
    if (!layers.length) return;
    const confirmed = await requestConfirmation({
      tone: 'warning',
      title: 'Reset entire seasonal design?',
      description: 'All seasonal artwork layers, overlap, positions, rotations and approval for this design will be cleared. Your garment, color, size and quantity stay selected.',
      confirmLabel: 'Reset design',
      cancelLabel: 'Keep editing',
    });
    if (!confirmed) return;

    checkpoint();
    setLayers([]);
    setSelectedLayerId('');
    setPreviewZoom(1.18);
    setReviewZoom(1);
    setShowGuides(true);
    setShowMeasurements(false);
    setTabletControlsOpen(true);
    setShowResetMenu(false);
    invalidateApproval();
    setError('');

    requestNotification({
      tone: 'success',
      title: 'Seasonal design reset',
      description: 'All seasonal artwork was cleared. Your garment choices were kept, and you can undo this reset.',
      action: <ToastAction altText="Undo seasonal design reset" onClick={undo}>Undo</ToastAction>,
    });
  };
'''
source = replace_once(source, reset_anchor, reset_replacement, "full reset handler")

header_before = '''<div className="flex items-center gap-1"><button type="button" onClick={undo} disabled={!historyRef.current.length} className="grid h-9 w-9 place-items-center rounded-xl border border-[#DCE3EA] text-[#52616F] disabled:opacity-30" aria-label="Undo"><Undo2 size={14} /></button><button type="button" onClick={redo} disabled={!redoRef.current.length} className="grid h-9 w-9 place-items-center rounded-xl border border-[#DCE3EA] text-[#52616F] disabled:opacity-30" aria-label="Redo"><Redo2 size={14} /></button></div></div><div className="mt-3 space-y-2">'''
header_after = '''<div className="flex items-center gap-1"><button type="button" onClick={undo} disabled={!historyRef.current.length} className="grid h-9 w-9 place-items-center rounded-xl border border-[#DCE3EA] text-[#52616F] disabled:opacity-30" aria-label="Undo"><Undo2 size={14} /></button><button type="button" onClick={redo} disabled={!redoRef.current.length} className="grid h-9 w-9 place-items-center rounded-xl border border-[#DCE3EA] text-[#52616F] disabled:opacity-30" aria-label="Redo"><Redo2 size={14} /></button><button type="button" onClick={() => setShowResetMenu((value) => !value)} className={`grid h-9 w-9 place-items-center rounded-xl border ${showResetMenu ? 'border-[#A66331] bg-[#A66331]/10 text-[#A66331]' : 'border-[#DCE3EA] text-[#52616F]'}`} aria-label="Reset options" aria-expanded={showResetMenu}><RotateCcw size={14} /></button></div></div>{showResetMenu && <div className="mt-3 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-3"><div className="font-mono text-[9px] font-bold uppercase tracking-[.16em] text-[#A66331]">Reset workspace</div><p className="mt-1 text-[10px] leading-relaxed text-[#667684]">Choose how much of the Seasonal Design Lab to reset. Garment, color, size and quantity stay selected.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" disabled={!activeLayer || activeLayer.locked} onClick={() => { resetActiveLayer(); setShowResetMenu(false); }} className="rounded-xl border border-[#DCE3EA] bg-white px-3 py-3 text-left disabled:opacity-40"><span className="block text-[10px] font-bold uppercase text-[#17324D]">Reset selected artwork</span><span className="mt-1 block text-[9px] leading-relaxed text-[#71808D]">Restore its original size, position and rotation. Locked artwork must be unlocked first.</span></button><button type="button" onClick={resetEntireSeasonalDesign} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-left"><span className="block text-[10px] font-bold uppercase text-amber-900">Reset entire seasonal design</span><span className="mt-1 block text-[9px] leading-relaxed text-amber-800/75">Clear all seasonal artwork layers and approval while keeping your garment choices.</span></button></div><div className="mt-2 flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[.1em] text-[#8A98A4]"><Undo2 size={10} /> Full reset can be undone</div></div>}<div className="mt-3 space-y-2">'''
source = replace_once(source, header_before, header_after, "layers reset menu")

old_clear = '''<button type="button" onClick={async () => { if (await requestConfirmation({ tone: 'destructive', title: 'Clear all seasonal artwork?', description: 'Every seasonal artwork layer on this fabric will be removed. This action can be undone from the editor history.', confirmLabel: 'Clear all layers', cancelLabel: 'Keep layers' })) { checkpoint(); setLayers([]); setSelectedLayerId(''); invalidateApproval(); } }} className="text-[10px] font-bold text-red-600">Clear all</button>'''
new_clear = '''<button type="button" onClick={() => setShowResetMenu((value) => !value)} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#A66331]"><RotateCcw size={11} /> Reset options</button>'''
source = replace_once(source, old_clear, new_clear, "replace ambiguous clear-all action")

path.write_text(source)
print("Seasonal Design Lab reset refinement applied.")
