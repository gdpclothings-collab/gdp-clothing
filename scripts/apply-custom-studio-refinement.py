from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


def replace_block(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker missing")
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{label}: end marker missing")
    return text[:start] + replacement + text[end:]


advanced_path = Path("src/components/storefront/CustomStudioAdvancedEditor.jsx")
advanced = advanced_path.read_text()

advanced = replace_once(
    advanced,
    'import React, { useEffect, useMemo, useRef, useState } from "react";\n',
    'import React, { useEffect, useMemo, useRef, useState } from "react";\nimport { createPortal } from "react-dom";\n',
    "react-dom portal import",
)
advanced = replace_once(advanced, "  stickers: true,\n", "  stickers: false,\n", "default sticker tool")
advanced = advanced.replace("Add a photo, text or sticker to create editable layers.", "Add a photo or text to create editable layers.")
advanced = advanced.replace("photos, lettering and stickers will print.", "photos and text will print.")
advanced = advanced.replace("Optional custom lettering can still be added separately in the Lettering tab.", "Optional custom text can still be added separately in the Text tab.")

state_marker = '  const [showPhotoPicker, setShowPhotoPicker] = useState(false);\n'
state_addition = '''  const [showPhotoPicker, setShowPhotoPicker] = useState(false);\n  const [canvasDockHost, setCanvasDockHost] = useState(null);\n\n  useEffect(() => {\n    const resolveCanvasDockHost = () => {\n      if (typeof document === "undefined") return;\n      setCanvasDockHost(document.querySelector('[data-gdp-studio-preview="live"]'));\n    };\n    resolveCanvasDockHost();\n    const frame = typeof window !== "undefined" ? window.requestAnimationFrame(resolveCanvasDockHost) : 0;\n    return () => {\n      if (frame && typeof window !== "undefined") window.cancelAnimationFrame(frame);\n    };\n  }, [designPath]);\n\n  useEffect(() => {\n    if (!designStyle) return;\n    const neutralIntensity = designPath === "upload" ? 1 : 3;\n    if (designMood !== "Original") onChooseMood?.("Original");\n    if (Number(designIntensity || 0) !== neutralIntensity) onChooseIntensity?.(neutralIntensity);\n  }, [designPath, designStyle, designMood, designIntensity, onChooseMood, onChooseIntensity]);\n'''
advanced = replace_once(advanced, state_marker, state_addition, "canvas host state")

old_context = '''  ] : selectedType === "sticker" ? [\n    ["stickers", Sparkles, "Replace"],\n    ["transform", Move, "Transform"],\n    ["more", Layers, "More"],\n  ] : []);'''
new_context = '''  ] : selectedType === "sticker" ? [\n    ["transform", Move, "Transform"],\n    ["more", Layers, "More"],\n  ] : []);'''
advanced = replace_once(advanced, old_context, new_context, "sticker replacement control")

old_tabs = '''  const panelTabs = /** @type {Array<[string, React.ComponentType<any>, string]>} */ ([\n    ["canvas", Eye, "Canvas"],\n    ...(designPath !== "upload" ? [["design", Palette, "Design"]] : []),\n    ["photos", ImageIcon, designPath === "upload" ? "Artwork" : "Photos"],\n    ...(tools.text ? [["lettering", Type, "Lettering"]] : []),\n    ...(designPath === "memorial" ? [["details", Heart, "Details"]] : []),\n    ["layers", Layers, "Layers"],\n  ]);'''
new_tabs = '''  const panelTabs = /** @type {Array<[string, React.ComponentType<any>, string]>} */ ([\n    ...(designPath !== "upload" ? [["design", Palette, "Design"]] : []),\n    ["photos", ImageIcon, designPath === "upload" ? "Artwork" : "Photos"],\n    ...(tools.text ? [["lettering", Type, "Text"]] : []),\n    ...(designPath === "memorial" ? [["details", Heart, "Details"]] : []),\n    ["layers", Layers, "Layers"],\n  ]);'''
advanced = replace_once(advanced, old_tabs, new_tabs, "editor tabs")

canvas_dock = '''  const renderCanvasPanel = () => (\n    <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Garment canvas controls">\n      <div className="inline-flex shrink-0 rounded-xl border border-white/10 bg-white/[.04] p-1">\n        <button type="button" onClick={() => onPreviewSideChange?.("front")} className={`rounded-lg px-3 py-2 text-[9px] font-bold uppercase ${previewSide === "front" ? "bg-white text-[#07131F]" : "text-white/60"}`}>Front</button>\n        {frontBackEnabled && <button type="button" onClick={() => onPreviewSideChange?.("back")} className={`rounded-lg px-3 py-2 text-[9px] font-bold uppercase ${previewSide === "back" ? "bg-white text-[#07131F]" : "text-white/60"}`}>Back</button>}\n      </div>\n      <button type="button" onClick={() => onPreviewZoomChange?.(Math.max(.7, Number(previewZoom || 1) - .1))} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-white/75" aria-label="Zoom fabric out"><ZoomOut size={14}/></button>\n      <span className="w-10 shrink-0 text-center font-mono text-[9px] text-white/65">{Math.round(Number(previewZoom || 1) * 100)}%</span>\n      <button type="button" onClick={() => onPreviewZoomChange?.(Math.min(2, Number(previewZoom || 1) + .1))} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-white/75" aria-label="Zoom fabric in"><ZoomIn size={14}/></button>\n      <button type="button" onClick={() => onPreviewZoomChange?.(1)} className="h-9 shrink-0 rounded-xl border border-white/10 bg-white/[.04] px-2.5 text-[8px] font-bold uppercase text-white/75">Fit</button>\n      <button type="button" onClick={onToggleGuides} className={`h-9 shrink-0 rounded-xl border px-2.5 text-[8px] font-bold uppercase ${showGuides ? "border-[#D9273E] bg-[#D9273E]/20 text-white" : "border-white/10 bg-white/[.04] text-white/60"}`}><Eye size={12} className="mr-1 inline"/>Guide</button>\n      <button type="button" onClick={onToggleMeasurements} className={`h-9 shrink-0 rounded-xl border px-2.5 text-[8px] font-bold uppercase ${showMeasurements ? "border-[#D9273E] bg-[#D9273E]/20 text-white" : "border-white/10 bg-white/[.04] text-white/60"}`}><Ruler size={12} className="mr-1 inline"/>Measure</button>\n    </div>\n  );\n\n'''
advanced = replace_block(
    advanced,
    "  const renderCanvasPanel = () => (\n",
    "  const renderDesignPanel =",
    canvas_dock,
    "canvas toolbar",
)

# Both removed controls are single-line JSX blocks in this component. Remove whole lines to avoid
# touching the rest of Design panel structure.
advanced_lines = []
for line in advanced.splitlines(keepends=True):
    if 'id="custom-studio-color-finish"' in line:
        continue
    if 'id="custom-studio-design-intensity"' in line:
        continue
    advanced_lines.append(line)
advanced = "".join(advanced_lines)

advanced = advanced.replace(
    'onClick={() => onChooseStyle?.(style)}',
    'onClick={() => { onChooseStyle?.(style); onChooseMood?.("Original"); onChooseIntensity?.(designPath === "upload" ? 1 : 3); }}',
)

panel_open = '    <div id="gdp-touch-studio-panel" className='
if panel_open not in advanced:
    raise SystemExit("editor panel opening marker missing")
advanced = advanced.replace(
    panel_open,
    '    <div id="gdp-touch-studio-panel" className=',
    1,
)
# Insert the portal after the opening div tag line, which is a single source line.
panel_line_end = advanced.find("\n", advanced.find(panel_open))
if panel_line_end < 0:
    raise SystemExit("editor panel opening line end missing")
advanced = advanced[:panel_line_end + 1] + '      {canvasDockHost ? createPortal(<div id="gdp-canvas-control-dock">{renderCanvasPanel()}</div>, canvasDockHost) : null}\n' + advanced[panel_line_end + 1:]

advanced = advanced.replace('{panelTab === "canvas" && <div className="mt-3 min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderCanvasPanel()}</div>}\n      ', '')
advanced = advanced.replace('{tools.stickers && <ToolButton icon={Sparkles} label="Sticker"', '{false && tools.stickers && <ToolButton icon={Sparkles} label="Sticker"')
advanced = advanced.replace('{showStickers && tools.stickers && <div', '{false && showStickers && tools.stickers && <div')

if 'id="custom-studio-color-finish"' in advanced or 'id="custom-studio-design-intensity"' in advanced:
    raise SystemExit("removed Design controls are still present")
if '["canvas", Eye, "Canvas"]' in advanced:
    raise SystemExit("Canvas tab is still present")
if 'id="gdp-canvas-control-dock"' not in advanced:
    raise SystemExit("Canvas dock was not inserted")
advanced_path.write_text(advanced)


studio_path = Path("src/pages/CustomStudio.jsx")
studio = studio_path.read_text()
studio = replace_once(studio, 'const [designMood, setDesignMood] = useState("");', 'const [designMood, setDesignMood] = useState("Original");', "design mood default")
studio = replace_once(studio, 'setDesignMood(String(draft.designMood || ""));', 'setDesignMood("Original");', "restored draft neutral mood")
studio = replace_once(studio, '  const [previewZoom, setPreviewZoom] = useState(1.15);', '  const [previewZoom, setPreviewZoom] = useState(1);', "preview zoom default")
studio = studio.replace('setPreviewZoom(clampPreview(draft.previewZoom || 1.15));', 'setPreviewZoom(clampPreview(draft.previewZoom || 1));')
studio = studio.replace('setPreviewZoom(1.15);', 'setPreviewZoom(1);')
studio = replace_once(
    studio,
    '    setDesignStyle(style.name);\n    setPreviewSide("front");',
    '    setDesignStyle(style.name);\n    setDesignMood("Original");\n    setDesignIntensity(3);\n    setPreviewSide("front");',
    "template neutral values",
)
studio = replace_once(
    studio,
    '                    } else if (path.id === "bootleg" || path.id === "memorial") {\n                      setDesignStyle("");\n                      setDesignMood("");\n                    }',
    '                    } else if (path.id === "bootleg" || path.id === "memorial") {\n                      setDesignStyle("");\n                      setDesignMood("Original");\n                      setDesignIntensity(3);\n                    }',
    "path neutral values",
)
studio = replace_once(
    studio,
    '      return Boolean(designStyle) && Boolean(designMood) && photos.length >= minPhotos && Boolean(designIntensity) && memorialDetailsReady;',
    '      return Boolean(designStyle) && photos.length >= minPhotos && memorialDetailsReady;',
    "continue requirements",
)
studio = studio.replace('      if (!designMood) return "Choose a color finish to continue.";\n', '')
studio = studio.replace('      if (!designIntensity) return "Choose a design intensity to continue.";\n', '')
studio = studio.replace('      else if (!designMood) { targetId = "custom-studio-color-finish"; panelTab = "design"; }\n', '')
studio = studio.replace('      else if (!designIntensity) { targetId = "custom-studio-design-intensity"; panelTab = "design"; }\n', '')
studio = replace_once(
    studio,
    '    if (!designPath || !designStyle || !designMood || !designIntensity) {\n      setWarn("Complete the design path, artwork, color finish and design intensity before adding to cart.");',
    '    if (!designPath || !designStyle) {\n      setWarn("Complete the design path and artwork before adding to cart.");',
    "cart requirements",
)
studio = studio.replace('Your uploaded photos, text and stickers will be preserved.', 'Your uploaded photos and text will be preserved.')
studio = studio.replace('use only your own photos, text or stickers.', 'use only your own photos or text.')
studio = replace_once(
    studio,
    'return <div id={containerId} onWheel={onWheel} className=',
    'return <div id={containerId} data-gdp-studio-preview={interactiveEditor ? "live" : undefined} onWheel={onWheel} className=',
    "live preview marker",
)
studio = replace_once(studio, '"w-[275px] sm:w-[305px]"', '"h-[82%] w-auto max-w-[90%]"', "larger garment fit")

if 'Boolean(designMood)' in studio or 'Boolean(designIntensity)' in studio:
    raise SystemExit("removed controls still gate Continue")
if 'Complete the design path, artwork, color finish and design intensity' in studio:
    raise SystemExit("old cart validation remains")
studio_path.write_text(studio)


desktop_path = Path("src/components/storefront/customStudioDesktop.css")
desktop = desktop_path.read_text()
desktop += r'''

/* 2026-09-10 garment-canvas refinement: controls live with the fabric preview. */
@media (min-width: 768px) {
  .gdp-studio-active [data-gdp-studio-preview="live"] #gdp-canvas-control-dock {
    position: absolute;
    left: 50%;
    bottom: 12px;
    z-index: 85;
    width: min(calc(100% - 24px), 620px);
    transform: translateX(-50%);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 16px;
    background: rgba(7,19,31,.91);
    padding: 6px;
    box-shadow: 0 14px 38px rgba(0,0,0,.22);
    backdrop-filter: blur(16px);
  }

  .gdp-studio-active [data-gdp-studio-preview="live"] > div.absolute.inset-0.grid > div.relative {
    height: 82% !important;
    width: auto !important;
    max-width: 90% !important;
  }
}
'''
desktop_path.write_text(desktop)


mobile_path = Path("src/components/storefront/customStudioMobile.css")
mobile = mobile_path.read_text()
mobile += r'''

/* 2026-09-10 mobile garment-canvas refinement. */
@media (max-width: 767px) {
  .gdp-studio-active [data-gdp-studio-preview="live"] #gdp-canvas-control-dock {
    position: absolute;
    left: 50%;
    bottom: 8px;
    z-index: 85;
    width: calc(100% - 16px);
    transform: translateX(-50%);
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 14px;
    background: rgba(7,19,31,.92);
    padding: 5px;
    box-shadow: 0 12px 30px rgba(0,0,0,.22);
    backdrop-filter: blur(14px);
  }

  .gdp-studio-active main > div > div > div:nth-child(3) > aside > div:nth-child(2) > div:nth-child(2) {
    height: clamp(350px, 58dvh, 430px);
  }

  .gdp-studio-active [data-gdp-studio-preview="live"] > div.absolute.inset-0.grid > div.relative {
    height: 80% !important;
    width: auto !important;
    max-width: 92% !important;
  }
}
'''
mobile_path.write_text(mobile)

print("Custom Studio refinement patch applied with guards.")
