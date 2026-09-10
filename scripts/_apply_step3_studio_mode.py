from pathlib import Path

CUSTOM = Path('src/pages/CustomStudio.jsx')
EDITOR = Path('src/components/storefront/CustomStudioAdvancedEditor.jsx')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)


def remove_between(text, start, end, label):
    i = text.find(start)
    if i < 0:
        raise SystemExit(f'{label}: start not found')
    j = text.find(end, i + len(start))
    if j < 0:
        raise SystemExit(f'{label}: end not found')
    return text[:i] + end + text[j + len(end):]

# ---- Advanced editor ----
editor = EDITOR.read_text()
editor = replace_once(editor, '  Redo2,\n  RotateCcw,', '  Redo2,\n  RotateCcw,\n  Ruler,', 'editor imports ruler')
editor = replace_once(editor, '  Undo2,\n  Upload,', '  Undo2,\n  Upload,\n  ZoomIn,\n  ZoomOut,', 'editor imports zoom')
editor = replace_once(
    editor,
    '  maxPhotos = 6,\n  uploadLimitMb = 15,\n}) {',
    '  maxPhotos = 6,\n  uploadLimitMb = 15,\n  designIntensity = 3,\n  onChooseIntensity,\n  previewSide = "front",\n  onPreviewSideChange,\n  frontBackEnabled = false,\n  previewZoom = 1,\n  onPreviewZoomChange,\n  showGuides = true,\n  onToggleGuides,\n  showMeasurements = false,\n  onToggleMeasurements,\n  viewGuidance = "",\n  sideStatus = "",\n  canCopyFrontToBack = false,\n  onCopyFrontToBack,\n}) {',
    'editor props'
)

selection_effect = '''  useEffect(() => {\n    if (selectedType === "text") { setActiveTool("edit"); setPanelTab("lettering"); }\n    else if (selectedType === "photo") { setActiveTool("transform"); setPanelTab("photos"); }\n    else if (selectedType === "sticker") { setActiveTool("transform"); setPanelTab("layers"); }\n    else { setActiveTool("layers"); setPanelTab(designPath === "upload" ? "photos" : "design"); }\n  }, [selectedLayerId, selectedType, designPath]);\n'''
selection_effect_new = selection_effect + '''\n  useEffect(() => {\n    const openRequestedTab = (event) => {\n      const tab = event?.detail?.tab;\n      if (!["canvas", "design", "photos", "lettering", "details", "layers"].includes(tab)) return;\n      setPanelTab(tab);\n      setShowStickers(false);\n      setShowPhotoPicker(false);\n      if (tab === "layers") setActiveTool("layers");\n    };\n    window.addEventListener("gdp-studio-open-tab", openRequestedTab);\n    return () => window.removeEventListener("gdp-studio-open-tab", openRequestedTab);\n  }, []);\n'''
editor = replace_once(editor, selection_effect, selection_effect_new, 'editor requested tab effect')

editor = replace_once(
    editor,
    '  const panelTabs = /** @type {Array<[string, React.ComponentType<any>, string]>} */ ([\n    ...(designPath !== "upload" ? [["design", Palette, "Design"]] : []),',
    '  const panelTabs = /** @type {Array<[string, React.ComponentType<any>, string]>} */ ([\n    ["canvas", Eye, "Canvas"],\n    ...(designPath !== "upload" ? [["design", Palette, "Design"]] : []),',
    'editor canvas tab'
)

render_canvas = '''  const renderCanvasPanel = () => (\n    <div className="space-y-3">\n      <div className="flex items-center justify-between gap-2">\n        <div className="inline-flex rounded-xl border border-white/10 bg-white/[.035] p-1">\n          <button type="button" onClick={() => onPreviewSideChange?.("front")} className={`rounded-lg px-3 py-2 text-[9px] font-bold uppercase ${previewSide === "front" ? "bg-white text-[#07131F]" : "text-white/55"}`}>Front</button>\n          {frontBackEnabled && <button type="button" onClick={() => onPreviewSideChange?.("back")} className={`rounded-lg px-3 py-2 text-[9px] font-bold uppercase ${previewSide === "back" ? "bg-white text-[#07131F]" : "text-white/55"}`}>Back</button>}\n        </div>\n        <div className="flex items-center gap-1">\n          <button type="button" onClick={() => onPreviewZoomChange?.(Math.max(.6, Number(previewZoom || 1) - .1))} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-white/65" aria-label="Zoom out"><ZoomOut size={14}/></button>\n          <span className="w-11 text-center font-mono text-[9px] text-white/45">{Math.round(Number(previewZoom || 1) * 100)}%</span>\n          <button type="button" onClick={() => onPreviewZoomChange?.(Math.min(1.8, Number(previewZoom || 1) + .1))} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-white/65" aria-label="Zoom in"><ZoomIn size={14}/></button>\n          <button type="button" onClick={() => onPreviewZoomChange?.(1)} className="h-9 rounded-xl border border-white/10 bg-white/[.04] px-2.5 text-[8px] font-bold uppercase text-white/65">Fit</button>\n        </div>\n      </div>\n      <div className="grid grid-cols-2 gap-2">\n        <button type="button" onClick={onToggleGuides} className={`rounded-xl border px-3 py-2.5 text-[9px] font-bold uppercase ${showGuides ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}><Eye size={13} className="mr-1.5 inline"/>{showGuides ? "Hide guide" : "Show guide"}</button>\n        <button type="button" onClick={onToggleMeasurements} className={`rounded-xl border px-3 py-2.5 text-[9px] font-bold uppercase ${showMeasurements ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}><Ruler size={13} className="mr-1.5 inline"/>{showMeasurements ? "Hide measurements" : "Measurements"}</button>\n      </div>\n      <div className="rounded-xl border border-white/[.08] bg-white/[.035] p-3 text-[9px] leading-relaxed text-white/48">\n        <div className="font-mono text-[8px] uppercase tracking-[.13em] text-white/35">Editing {previewSide}</div>\n        {sideStatus && <div className="mt-1 text-white/68">{sideStatus}</div>}\n        {viewGuidance && <div className="mt-2 border-l-2 border-[#D9273E]/60 pl-2.5">{viewGuidance}</div>}\n      </div>\n      {canCopyFrontToBack && <button type="button" onClick={onCopyFrontToBack} className="w-full rounded-xl border border-white/15 bg-white/[.05] px-3 py-2.5 text-[9px] font-bold uppercase text-white">Copy front design to back</button>}\n    </div>\n  );\n\n'''
editor = replace_once(editor, '  const renderDesignPanel = () => (\n', render_canvas + '  const renderDesignPanel = () => (\n', 'editor render canvas')

mood_block = '      {moodOptions?.length > 0 && <div id="custom-studio-color-finish" className="scroll-mt-28 border-t border-white/10 pt-3"><div className="text-[10px] font-bold uppercase tracking-[.09em] text-white">Color finish</div><div className="mt-2 flex max-w-full gap-1.5 overflow-x-auto pb-1">{moodOptions.map((mood) => <button key={mood} type="button" onClick={() => onChooseMood?.(mood)} className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-bold ${designMood === mood ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>{mood}</button>)}</div><div className="mt-2 rounded-xl border border-white/[.08] bg-white/[.035] p-2.5 text-[9px] leading-relaxed text-white/48">{designMood ? <><strong className="text-white/80">{designMood}:</strong> {moodDescription || "This finish is baked into the final print."}</> : "Choose the final print finish."}</div></div>}\n'
intensity_block = mood_block + '      <div id="custom-studio-design-intensity" className="scroll-mt-28 border-t border-white/10 pt-3"><div className="text-[10px] font-bold uppercase tracking-[.09em] text-white">Design intensity</div><div className="mt-1 text-[9px] text-white/42">Controls how strong the personalized treatment appears in the final composition.</div><div className="mt-2 grid grid-cols-5 gap-1.5">{[1,2,3,4,5].map((level) => <button key={level} type="button" onClick={() => onChooseIntensity?.(level)} className={`rounded-xl border px-2 py-2.5 text-[9px] font-bold ${Number(designIntensity) === level ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>{level}</button>)}</div><div className="mt-1.5 text-center text-[8px] uppercase tracking-[.12em] text-white/30">1 subtle · 3 balanced · 5 bold</div></div>\n'
editor = replace_once(editor, mood_block, intensity_block, 'editor design intensity')

editor = replace_once(
    editor,
    '          <button type="button" onClick={() => setActiveTool("layers")} className={`grid h-9 w-9 place-items-center rounded-xl border ${activeTool === "layers" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.045] text-white/65"}`} aria-label="Layers"><Layers size={14}/></button>',
    '          <button type="button" onClick={() => { setPanelTab("layers"); setActiveTool("layers"); }} className={`grid h-9 w-9 place-items-center rounded-xl border ${panelTab === "layers" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.045] text-white/65"}`} aria-label="Layers"><Layers size={14}/></button>',
    'editor header layers action'
)
editor = replace_once(
    editor,
    '      {panelTab === "design" && <div className="mt-3 min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderDesignPanel()}</div>}',
    '      {panelTab === "canvas" && <div className="mt-3 min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderCanvasPanel()}</div>}\n      {panelTab === "design" && <div className="mt-3 min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderDesignPanel()}</div>}',
    'editor canvas rendering'
)
editor = replace_once(
    editor,
    '    <div className="sticky bottom-2 z-30 mt-4 w-full min-w-0 max-w-full max-h-[58dvh] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[22px] border border-white/10 bg-[#07131F]/[.96] p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-xl md:static md:max-h-none md:overflow-visible">',
    '    <div id="gdp-touch-studio-panel" className="sticky bottom-2 z-30 mt-4 w-full min-w-0 max-w-full max-h-[62dvh] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[22px] border border-white/10 bg-[#07131F]/[.96] p-3 text-white shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-xl md:static md:max-h-none md:overflow-visible">',
    'editor panel id'
)
EDITOR.write_text(editor)

# ---- Custom Studio page ----
custom = CUSTOM.read_text()
step_title = '''            <StepTitle\n              eyebrow={designPath === "memorial" ? "Create a remembrance" : "Build and personalize in one place"}\n              title={designPath === "upload" ? "CUSTOMIZE YOUR ARTWORK" : designPath === "memorial" ? "CUSTOMIZE YOUR MEMORIAL TRIBUTE" : "CUSTOMIZE YOUR DESIGN"}\n              text={designPath === "upload"\n                ? "Upload your artwork, adjust its placement, size and proportions, then personalize the final result."\n                : designPath === "memorial"\n                  ? "Choose one of five protected remembrance layouts, then add the portrait, verified name, optional dates and message."\n                  : "Choose a protected GDP layout, or start blank and build only with your own photos, text and stickers."}\n            />\n\n'''
custom = replace_once(custom, step_title, '', 'remove duplicate step 3 title')
custom = replace_once(
    custom,
    '{designPath === "upload" && <div className="mt-6 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] px-4 py-3 text-sm text-[#52616F]"><span className="font-semibold text-[#17324D]">Your own artwork:</span> resize, rotate and move it freely. Proportions stay locked by default, with an optional unlock control in the preview tools.</div>}',
    '{designPath === "upload" && <div className="hidden" aria-hidden="true">Your own artwork controls are available in GDP Touch Studio.</div>}',
    'hide upload guidance card'
)

# Remove the external print-guide/message strip entirely.
guide_start = '              <div className="border-y border-[#ebe5dc] bg-[#fbf9f6] px-3 py-3 sm:px-4">'
editor_wrapper = '              <div className="p-4 border-t border-[#ebe5dc] bg-[#FFFFFF]">'
custom = remove_between(custom, guide_start, editor_wrapper, 'remove external guide strip')

# Inside editor wrapper, remove external side/zoom/status/legacy transform controls before AdvancedEditorPanel.
wrapper_pos = custom.find(editor_wrapper)
if wrapper_pos < 0:
    raise SystemExit('editor wrapper not found after guide removal')
content_start = wrapper_pos + len(editor_wrapper)
advanced_marker = '\n                {step === 3 && <AdvancedEditorPanel'
advanced_pos = custom.find(advanced_marker, content_start)
if advanced_pos < 0:
    raise SystemExit('AdvancedEditorPanel marker not found')
custom = custom[:content_start] + advanced_marker + custom[advanced_pos + len(advanced_marker):]

reset_block = '''\n\n                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">\n                  <button type="button" onClick={() => { checkpointEditor(); resetPreviewPlacement(); }} className="inline-flex items-center gap-1.5 text-[11px] sm:text-[10px] font-semibold text-[#706a62] hover:text-accent"><RotateCcw size={13} /> Reset</button>\n                </div>'''
custom = replace_once(custom, reset_block, '', 'remove external reset')

custom = replace_once(
    custom,
    '                {step === 3 && <AdvancedEditorPanel\n                  designPath={designPath}',
    '''                {step === 3 && <AdvancedEditorPanel\n                  designPath={designPath}\n                  designIntensity={designIntensity}\n                  onChooseIntensity={setDesignIntensity}\n                  previewSide={previewSide}\n                  onPreviewSideChange={setPreviewSide}\n                  frontBackEnabled={frontBackEnabled}\n                  previewZoom={previewZoom}\n                  onPreviewZoomChange={setPreviewZoom}\n                  showGuides={showGuides}\n                  onToggleGuides={() => setShowGuides((value) => !value)}\n                  showMeasurements={showMeasurements}\n                  onToggleMeasurements={() => setShowMeasurements((value) => !value)}\n                  viewGuidance={activePreviewTemplate ? "GDP template is locked. Drag, resize and rotate only customer-added content inside the print guide; lettering stays editable." : previewSide === "back" && activeStyleTemplate ? "Back print is independent. Add your own photos, lettering or stickers; the protected front template is not duplicated here." : designStyle === NO_TEMPLATE_STYLE ? "Blank canvas selected. Add and edit your own photos, lettering and stickers inside the print guide." : "Move and resize your uploaded artwork inside the print guide. Aspect ratio stays constrained by default."}\n                  sideStatus={activeSideHasPrint ? `${previewSide === "front" ? "Front" : "Back"} artwork is saved independently.${previewSide === "back" && placement === "front_back" ? " Additional print charge applies." : ""}` : `${previewSide === "front" ? "Front" : "Back"} is blank until you add artwork.`}\n                  canCopyFrontToBack={previewSide === "back" && !(editorLayersBySide.back || []).length && (editorLayersBySide.front || []).length > 0}\n                  onCopyFrontToBack={copyFrontDesignToBack}''',
    'pass canvas controls to panel'
)

old_focus = '''  const focusMissingRequirement = () => {\n    let targetId = "custom-studio-workspace";\n    if (step === 3) {\n      if (!designStyle) targetId = "custom-studio-artwork-style";\n      else if (!designMood) targetId = "custom-studio-color-finish";\n      else if (photos.length < minPhotos) targetId = "custom-studio-photo-upload";\n      else if (designPath === "memorial" && (!String(personalization.name || "").trim() || !memorialNameConfirmed)) targetId = "custom-studio-memorial-details";\n    }\n    const target = document.getElementById(targetId) || document.getElementById("custom-studio-workspace");\n    if (!target) return;\n    target.scrollIntoView({ behavior: "smooth", block: "center" });\n    if (typeof target.animate === "function") {\n      target.animate(\n        [\n          { boxShadow: "0 0 0 0 rgba(217,39,62,0)" },\n          { boxShadow: "0 0 0 4px rgba(217,39,62,.28)" },\n          { boxShadow: "0 0 0 0 rgba(217,39,62,0)" },\n        ],\n        { duration: 900, easing: "ease-out" }\n      );\n    }\n  };'''
new_focus = '''  const focusMissingRequirement = () => {\n    let targetId = "custom-studio-workspace";\n    let panelTab = "";\n    if (step === 3) {\n      if (!designStyle) { targetId = "custom-studio-artwork-style"; panelTab = "design"; }\n      else if (!designMood) { targetId = "custom-studio-color-finish"; panelTab = "design"; }\n      else if (!designIntensity) { targetId = "custom-studio-design-intensity"; panelTab = "design"; }\n      else if (photos.length < minPhotos) { targetId = "custom-studio-photo-upload"; panelTab = "photos"; }\n      else if (designPath === "memorial" && (!String(personalization.name || "").trim() || !memorialNameConfirmed)) { targetId = "custom-studio-memorial-details"; panelTab = "details"; }\n    }\n    if (panelTab) {\n      window.dispatchEvent(new CustomEvent("gdp-studio-open-tab", { detail: { tab: panelTab } }));\n    }\n    window.setTimeout(() => {\n      const target = document.getElementById(targetId) || document.getElementById("gdp-touch-studio-panel") || document.getElementById("custom-studio-workspace");\n      if (!target) return;\n      target.scrollIntoView({ behavior: "smooth", block: "center" });\n      if (typeof target.animate === "function") {\n        target.animate(\n          [\n            { boxShadow: "0 0 0 0 rgba(217,39,62,0)" },\n            { boxShadow: "0 0 0 4px rgba(217,39,62,.28)" },\n            { boxShadow: "0 0 0 0 rgba(217,39,62,0)" },\n          ],\n          { duration: 900, easing: "ease-out" }\n        );\n      }\n    }, panelTab ? 80 : 0);\n  };'''
custom = replace_once(custom, old_focus, new_focus, 'validation opens correct panel tab')

CUSTOM.write_text(custom)
print('Step 3 studio mode patch applied successfully')
