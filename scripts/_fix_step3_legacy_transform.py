from pathlib import Path

CUSTOM = Path('src/pages/CustomStudio.jsx')
EDITOR = Path('src/components/storefront/CustomStudioAdvancedEditor.jsx')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new, 1)

editor = EDITOR.read_text()
editor = replace_once(
    editor,
    '  onCopyFrontToBack,\n}) {',
    '  onCopyFrontToBack,\n  legacyArtworkActive = false,\n  artworkScale = 92,\n  onArtworkScaleChange,\n  artworkRotation = 0,\n  onArtworkRotationChange,\n  artworkFitMode = "fit",\n  onArtworkFitModeChange,\n  artworkConstrainRatio = true,\n  onArtworkConstrainRatioChange,\n  artworkStretchX = 100,\n  onArtworkStretchXChange,\n  artworkStretchY = 100,\n  onArtworkStretchYChange,\n  artworkSourcePhotoIndex = 0,\n  onArtworkSourcePhotoIndexChange,\n  onArtworkTransformStart,\n  allowFreeStretch = false,\n}) {',
    'editor legacy artwork props'
)

legacy_renderer = '''  const renderLegacyArtworkTool = () => {\n    if (!legacyArtworkActive) return null;\n    return (\n      <div className="space-y-3 rounded-2xl border border-white/[.07] bg-black/10 p-3">\n        <div className="flex items-center justify-between gap-3">\n          <div><div className="text-[10px] font-bold uppercase tracking-[.09em] text-white">Artwork transform</div><div className="mt-0.5 text-[9px] text-white/42">Edit the selected uploaded artwork directly on the garment.</div></div>\n          <Move size={15} className="text-[#D9273E]"/>\n        </div>\n        {(photoAssets || []).length > 1 && <label className="block text-[9px] font-bold uppercase tracking-wide text-white/45">Artwork source<select value={Number(artworkSourcePhotoIndex || 0)} onChange={(event) => onArtworkSourcePhotoIndexChange?.(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#0B1A28] px-3 text-[10px] normal-case tracking-normal text-white outline-none">{photoAssets.map((photo, index) => <option key={photo.id || photo.url || index} value={index}>{index + 1}. {photo.name || "Uploaded photo"}</option>)}</select></label>}\n        <RangeRow label="Design size" value={Number(artworkScale || 92)} min={55} max={180} suffix="%" onPointerDown={onArtworkTransformStart} onChange={(value) => onArtworkScaleChange?.(value)}/>\n        <div className="grid grid-cols-2 gap-2">\n          <button type="button" onClick={() => onArtworkFitModeChange?.("fit")} className={`rounded-xl border px-3 py-2.5 text-[9px] font-bold uppercase ${artworkFitMode !== "crop" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>Fit · no crop</button>\n          <button type="button" onClick={() => onArtworkFitModeChange?.("crop")} className={`rounded-xl border px-3 py-2.5 text-[9px] font-bold uppercase ${artworkFitMode === "crop" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>Crop to fill</button>\n        </div>\n        {artworkFitMode === "crop" && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[9px] leading-relaxed text-amber-100">Crop to Fill trims image edges. Use Fit · No Crop to keep the full artwork visible.</div>}\n        {allowFreeStretch && <div className="rounded-xl border border-white/[.08] bg-white/[.035] p-3">\n          <button type="button" onClick={() => onArtworkConstrainRatioChange?.(!artworkConstrainRatio)} className="inline-flex items-center gap-2 text-[9px] font-bold uppercase text-white/75">{artworkConstrainRatio ? <Lock size={13}/> : <Unlock size={13}/>} {artworkConstrainRatio ? "Constrain aspect ratio" : "Free stretch enabled"}</button>\n          <div className="mt-1 text-[8px] leading-relaxed text-white/35">{artworkConstrainRatio ? "Recommended: resizing keeps the original proportions." : "Advanced: width and height can be adjusted independently."}</div>\n          {!artworkConstrainRatio && <div className="mt-3 grid gap-3 sm:grid-cols-2"><RangeRow label="Width" value={Number(artworkStretchX || 100)} min={60} max={160} suffix="%" onPointerDown={onArtworkTransformStart} onChange={(value) => onArtworkStretchXChange?.(value)}/><RangeRow label="Height" value={Number(artworkStretchY || 100)} min={60} max={160} suffix="%" onPointerDown={onArtworkTransformStart} onChange={(value) => onArtworkStretchYChange?.(value)}/></div>}\n        </div>}\n        <RangeRow label="Rotation" value={Number(artworkRotation || 0)} min={-180} max={180} suffix="°" onPointerDown={onArtworkTransformStart} onChange={(value) => onArtworkRotationChange?.(value)}/>\n      </div>\n    );\n  };\n\n'''
editor = replace_once(editor, '  const renderUploadPanel = () => (\n', legacy_renderer + '  const renderUploadPanel = () => (\n', 'editor legacy renderer')
editor = replace_once(
    editor,
    '      {panelTab === "photos" && <div className="mt-3 space-y-3"><div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderUploadPanel()}</div>{selectedType === "photo" && <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderPhotoTool()}</div>}</div>}',
    '      {panelTab === "photos" && <div className="mt-3 space-y-3"><div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderUploadPanel()}</div>{legacyArtworkActive && !selectedLayer ? renderLegacyArtworkTool() : selectedType === "photo" && <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderPhotoTool()}</div>}</div>}',
    'editor legacy renderer placement'
)
EDITOR.write_text(editor)

custom = CUSTOM.read_text()
custom = replace_once(
    custom,
    '                  onCopyFrontToBack={copyFrontDesignToBack}\n                  pathLabel=',
    '''                  onCopyFrontToBack={copyFrontDesignToBack}\n                  legacyArtworkActive={Boolean(previewArtworkPhoto && activeSideHasPrint && designPath !== "bootleg" && !editorLayers.some((layer) => layer.type === "photo"))}\n                  artworkScale={artworkScale}\n                  onArtworkScaleChange={setArtworkScale}\n                  artworkRotation={artworkRotation}\n                  onArtworkRotationChange={setArtworkRotation}\n                  artworkFitMode={artworkFitMode}\n                  onArtworkFitModeChange={setArtworkFitMode}\n                  artworkConstrainRatio={artworkConstrainRatio}\n                  onArtworkConstrainRatioChange={setArtworkConstrainRatio}\n                  artworkStretchX={artworkStretchX}\n                  onArtworkStretchXChange={setArtworkStretchX}\n                  artworkStretchY={artworkStretchY}\n                  onArtworkStretchYChange={setArtworkStretchY}\n                  artworkSourcePhotoIndex={Number(activeArtworkState.sourcePhotoIndex || 0)}\n                  onArtworkSourcePhotoIndexChange={setArtworkSourcePhotoIndex}\n                  onArtworkTransformStart={checkpointEditor}\n                  allowFreeStretch={designPath === "upload" && editorTools.freeStretch !== false}\n                  pathLabel=''',
    'pass legacy artwork controls'
)
CUSTOM.write_text(custom)
print('Fallback artwork controls moved into GDP Touch Studio')
