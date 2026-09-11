from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if new in text:
        print(f"{label}: already applied")
        return
    if old not in text:
        raise SystemExit(f"{label}: expected source block not found")
    p.write_text(text.replace(old, new, 1))
    print(f"{label}: applied")


studio_path = "src/pages/CustomStudio.jsx"
editor_path = "src/components/storefront/CustomStudioAdvancedEditor.jsx"
focus_path = "src/components/storefront/DesktopGarmentSelectionFocus.jsx"
css_path = "src/components/storefront/customStudioDesktop.css"

replace_once(
    studio_path,
    '''  const activatePrintSide = (side = previewSide) => {
    setPlacement((current) => {
      if (side === "back") return current === "front" ? "front_back" : "back";
      return current === "back" ? "front_back" : "front";
    });
  };''',
    '''  const activatePrintSide = (side = previewSide) => {
    setPlacement((current) => {
      // Once both print sides are active, choosing or editing artwork on either
      // side must never disable the opposite side. Side switching is view-only.
      if (current === "front_back") return current;
      if (side === "back") return current === "front" ? "front_back" : "back";
      return current === "back" ? "front_back" : "front";
    });
  };''',
    "front/back placement persistence",
)

replace_once(
    studio_path,
    '''  const activeSideHasPrint =
    (previewSide === "front" && placement !== "back") ||
    (previewSide === "back" && placement !== "front");
  const activePhotoIndex = photos.length''',
    '''  const activeSideHasPrint =
    (previewSide === "front" && placement !== "back") ||
    (previewSide === "back" && placement !== "front");
  const printSummaryForSide = (side) => {
    const sideEnabled = side === "front" ? placement !== "back" : placement !== "front";
    if (!sideEnabled) return "No print";
    const styleName = designStyleForSide(side);
    if (styleName) return styleName.replace(/^GDP\\s+/, "");
    const visibleLayers = (editorLayersBySide[side] || []).filter((layer) => layer?.visible !== false);
    if (visibleLayers.length) return `${visibleLayers.length} editable layer${visibleLayers.length === 1 ? "" : "s"}`;
    if (designPath === "upload" && photos.length) return "Uploaded artwork";
    return "Print enabled";
  };
  const activePhotoIndex = photos.length''',
    "side-specific order summary helper",
)

replace_once(
    studio_path,
    '''              <div className="font-display text-3xl mt-2">{designStyle ? designStyle.replace(/^GDP\\s+/, "") : "Build your order"}</div>
              <SummaryRow label="Style" value={designStyle ? designStyle.replace("GDP ","") : "Not selected"} />''',
    '''              <div className="font-display text-3xl mt-2">{orderDesignStyle ? orderDesignStyle.replace(/^GDP\\s+/, "") : "Build your order"}</div>
              <SummaryRow label="Front" value={printSummaryForSide("front")} />
              <SummaryRow label="Back" value={printSummaryForSide("back")} />''',
    "order summary front/back rows",
)

replace_once(
    studio_path,
    '''              {placement !== "back" && <ReviewCard label="Front artwork" value={frontArtworkPhoto?.name || "Primary photo"} sub={"Scale " + Number(artworkStates.front?.scale ?? 92) + "% · rotation " + Number(artworkStates.front?.rotation ?? 0) + "°"} />}
              {placement !== "front" && <ReviewCard label="Back artwork" value={backArtworkPhoto?.name || "Primary photo"} sub={"Scale " + Number(artworkStates.back?.scale ?? 92) + "% · rotation " + Number(artworkStates.back?.rotation ?? 0) + "°"} />}''',
    '''              {placement !== "back" && <ReviewCard label="Front artwork" value={printSummaryForSide("front")} sub={"Scale " + Number(artworkStates.front?.scale ?? 92) + "% · rotation " + Number(artworkStates.front?.rotation ?? 0) + "°"} />}
              {placement !== "front" && <ReviewCard label="Back artwork" value={printSummaryForSide("back")} sub={"Scale " + Number(artworkStates.back?.scale ?? 92) + "% · rotation " + Number(artworkStates.back?.rotation ?? 0) + "°"} />}''',
    "review front/back summaries",
)

replace_once(
    studio_path,
    '''  return <div className={"rounded-2xl border border-[#DCE3EA] bg-white shadow-sm " + (compact ? "px-3 py-3" : "px-3 py-2.5")}>''',
    '''  return <div data-gdp-step-nav={compact ? "mobile" : "desktop"} className={"gdp-studio-step-nav rounded-2xl border border-[#DCE3EA] bg-white shadow-sm " + (compact ? "px-3 py-3" : "px-3 py-2.5")}>''',
    "compact desktop step navigation hook",
)

replace_once(
    studio_path,
    '''  const dragRef = useRef(null);
  const [failedMockupUrl, setFailedMockupUrl] = useState("");''',
    '''  const dragRef = useRef(null);
  const viewPanRef = useRef(null);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [failedMockupUrl, setFailedMockupUrl] = useState("");''',
    "preview pan state",
)

studio = Path(studio_path).read_text()
pan_marker = '''  return <div id={containerId} data-gdp-studio-preview={interactiveEditor ? "live" : undefined} onWheel={onWheel}'''
if "const beginViewPan" not in studio:
    if pan_marker not in studio:
        raise SystemExit("preview pan handlers: return marker not found")
    pan_code = '''  useEffect(() => {
    setViewPan({ x: 0, y: 0 });
  }, [side]);

  useEffect(() => {
    if (Number(zoom || 1) <= 1) setViewPan({ x: 0, y: 0 });
  }, [zoom]);

  const canPanView = Boolean(interactiveEditor && Number(zoom || 1) > 1);
  const beginViewPan = (event) => {
    const target = event.target;
    const insidePrintArea = typeof Element !== "undefined" && target instanceof Element && target.closest('[data-gdp-print-area="true"]');
    if (!canPanView || insidePrintArea) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    viewPanRef.current = {
      x: event.clientX,
      y: event.clientY,
      startX: Number(viewPan.x || 0),
      startY: Number(viewPan.y || 0),
    };
  };
  const moveViewPan = (event) => {
    if (!canPanView || !viewPanRef.current) return;
    const start = viewPanRef.current;
    const limit = Math.max(40, Math.round((Number(zoom || 1) - 1) * 240));
    const clampPan = (value) => Math.min(limit, Math.max(-limit, value));
    setViewPan({
      x: clampPan(start.startX + event.clientX - start.x),
      y: clampPan(start.startY + event.clientY - start.y),
    });
  };
  const endViewPan = (event) => {
    if (!viewPanRef.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    viewPanRef.current = null;
  };

'''
    studio = studio.replace(pan_marker, pan_code + pan_marker, 1)
    Path(studio_path).write_text(studio)
    print("preview pan handlers: applied")
else:
    print("preview pan handlers: already applied")

replace_once(
    studio_path,
    '''    <div className="absolute inset-0 grid place-items-center transition-transform duration-200" style={Number(zoom) === 1 ? undefined : { transform: `scale(${zoom})` }}>''',
    '''    <div
      onPointerDown={beginViewPan}
      onPointerMove={moveViewPan}
      onPointerUp={endViewPan}
      onPointerCancel={endViewPan}
      className={"absolute inset-0 grid place-items-center " + (canPanView ? "cursor-grab active:cursor-grabbing touch-none" : "transition-transform duration-200")}
      style={{ transform: `translate3d(${viewPan.x}px, ${viewPan.y}px, 0) scale(${Number(zoom || 1)})` }}
    >''',
    "zoom canvas panning stage",
)

replace_once(
    studio_path,
    '''        <div
          id={printAreaId}
          onPointerDown={onPointerDown}''',
    '''        <div
          id={printAreaId}
          data-gdp-print-area="true"
          onPointerDown={onPointerDown}''',
    "print area pan guard",
)

replace_once(
    studio_path,
    '''{photo ? <><Move size={10}/> Drag editable layer</> : <><Sparkles size={10}/> {template?.name?.replace("GDP ","") || "Own artwork"} · {mood || "Original"}</>}''',
    '''{canPanView ? <><Move size={10}/> Drag canvas to pan</> : photo ? <><Move size={10}/> Drag editable layer</> : <><Sparkles size={10}/> {template?.name?.replace("GDP ","") || "Own artwork"} · {mood || "Original"}</>}''',
    "zoom pan affordance",
)

focus = Path(focus_path).read_text()
if "const FADE_MS = 300;" not in focus:
    if "const FADE_MS = 420;\nconst MOVE_MS = 320;" not in focus:
        raise SystemExit("garment focus timing: expected constants not found")
    focus = focus.replace("const FADE_MS = 420;\nconst MOVE_MS = 320;", "const FADE_MS = 300;\nconst MOVE_MS = 260;", 1)
    Path(focus_path).write_text(focus)
    print("garment focus timing: applied")
else:
    print("garment focus timing: already applied")

editor = Path(editor_path).read_text()
toolbar_start = editor.find('  const renderCanvasPanel = () => (')
toolbar_end = editor.find('\n\n  return (', toolbar_start)
if toolbar_start < 0 or toolbar_end < 0:
    raise SystemExit("canvas toolbar: source boundaries not found")
current_toolbar = editor[toolbar_start:toolbar_end]
if "Fabric side" not in current_toolbar:
    new_toolbar = '''  const renderCanvasPanel = () => (
    <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Garment canvas controls">
      <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] p-1">
        <span className="hidden px-1 font-mono text-[7px] font-bold uppercase tracking-[.16em] text-white/40 xl:inline">Fabric side</span>
        <div className="inline-flex rounded-lg border border-white/10 bg-black/10 p-0.5">
          <button type="button" onClick={() => onPreviewSideChange?.("front")} className={`rounded-md px-3 py-2 text-[9px] font-bold uppercase transition ${previewSide === "front" ? "bg-[#D9273E] text-white shadow-sm" : "text-white/60 hover:text-white"}`}>Front</button>
          {frontBackEnabled && <button type="button" onClick={() => onPreviewSideChange?.("back")} className={`rounded-md px-3 py-2 text-[9px] font-bold uppercase transition ${previewSide === "back" ? "bg-[#D9273E] text-white shadow-sm" : "text-white/60 hover:text-white"}`}>Back</button>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[.04] p-1">
        <span className="hidden px-1 font-mono text-[7px] font-bold uppercase tracking-[.16em] text-white/40 xl:inline">View</span>
        <button type="button" onClick={() => onPreviewZoomChange?.(Math.max(.7, Number(previewZoom || 1) - .1))} className="grid h-9 w-9 place-items-center rounded-lg text-white/75 hover:bg-white/[.06]" aria-label="Zoom fabric out"><ZoomOut size={14}/></button>
        <span className="w-10 text-center font-mono text-[9px] text-white/65">{Math.round(Number(previewZoom || 1) * 100)}%</span>
        <button type="button" onClick={() => onPreviewZoomChange?.(Math.min(2, Number(previewZoom || 1) + .1))} className="grid h-9 w-9 place-items-center rounded-lg text-white/75 hover:bg-white/[.06]" aria-label="Zoom fabric in"><ZoomIn size={14}/></button>
        <button type="button" onClick={() => onPreviewZoomChange?.(1)} className="h-9 rounded-lg px-2.5 text-[8px] font-bold uppercase text-white/75 hover:bg-white/[.06]" aria-label="Fit garment to canvas">Fit</button>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[.04] p-1">
        <span className="hidden px-1 font-mono text-[7px] font-bold uppercase tracking-[.16em] text-white/40 xl:inline">Production guides</span>
        <button type="button" onClick={onToggleGuides} className={`h-9 rounded-lg px-2.5 text-[8px] font-bold uppercase transition ${showGuides ? "bg-[#D9273E]/20 text-white" : "text-white/60 hover:bg-white/[.06]"}`}><Eye size={12} className="mr-1 inline"/>Guide</button>
        <button type="button" onClick={onToggleMeasurements} className={`h-9 rounded-lg px-2.5 text-[8px] font-bold uppercase transition ${showMeasurements ? "bg-[#D9273E]/20 text-white" : "text-white/60 hover:bg-white/[.06]"}`}><Ruler size={12} className="mr-1 inline"/>Measure</button>
      </div>
    </div>
  );'''
    editor = editor[:toolbar_start] + new_toolbar + editor[toolbar_end:]
    Path(editor_path).write_text(editor)
    print("grouped canvas toolbar: applied")
else:
    print("grouped canvas toolbar: already applied")

css = Path(css_path).read_text()
css_marker = "/* GDP desktop studio stabilization · 2026-09-11 */"
if css_marker not in css:
    css += '''

/* GDP desktop studio stabilization · 2026-09-11 */
@media (min-width: 1024px) {
  #custom-studio-workspace .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] {
    grid-template-columns: minmax(0, 380px) !important;
    width: min(100%, 380px) !important;
    max-width: 380px !important;
    gap: 0 !important;
    align-items: start !important;
  }

  #custom-studio-workspace .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] > button[data-gdp-selected="true"] {
    width: 100% !important;
    max-width: 380px !important;
  }

  #custom-studio-workspace .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] > button[data-gdp-selected="true"] > div:first-child {
    height: 150px !important;
    aspect-ratio: auto !important;
  }

  .gdp-studio-step-nav[data-gdp-step-nav="desktop"] {
    padding: 6px 8px !important;
    border-radius: 14px !important;
    background: rgba(255, 255, 255, .92) !important;
    backdrop-filter: blur(14px);
  }

  .gdp-studio-step-nav[data-gdp-step-nav="desktop"] button {
    min-height: 38px !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }

  #gdp-touch-studio-panel {
    max-height: min(46vh, 430px) !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  #gdp-touch-studio-panel::-webkit-scrollbar {
    width: 7px;
  }

  #gdp-touch-studio-panel::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 255, 255, .18);
  }

  #gdp-canvas-control-dock > * {
    width: fit-content;
    max-width: min(100%, 760px) !important;
  }
}
'''
    Path(css_path).write_text(css)
    print("desktop CSS stabilization: applied")
else:
    print("desktop CSS stabilization: already applied")

verifier = Path("scripts/verify-custom-studio-desktop.mjs")
verifier.write_text('''import assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst studio = fs.readFileSync("src/pages/CustomStudio.jsx", "utf8");\nconst editor = fs.readFileSync("src/components/storefront/CustomStudioAdvancedEditor.jsx", "utf8");\nconst focus = fs.readFileSync("src/components/storefront/DesktopGarmentSelectionFocus.jsx", "utf8");\nconst css = fs.readFileSync("src/components/storefront/customStudioDesktop.css", "utf8");\n\nassert.match(studio, /if \\(current === "front_back"\\) return current;/, "front+back placement must persist while editing either side");\nassert.match(studio, /printSummaryForSide\\("front"\\)/, "order summary must report front independently");\nassert.match(studio, /printSummaryForSide\\("back"\\)/, "order summary must report back independently");\nassert.match(studio, /data-gdp-print-area="true"/, "preview panning must not steal artwork gestures");\nassert.match(studio, /Drag canvas to pan/, "zoomed canvas must expose pan affordance");\nassert.match(studio, /data-gdp-step-nav=\\{compact \\? "mobile" : "desktop"\\}/, "desktop step nav needs compact styling hook");\nassert.match(editor, />Fabric side<\\/span>/, "canvas toolbar must group the fabric side controls");\nassert.match(editor, />View<\\/span>/, "canvas toolbar must group view controls");\nassert.match(editor, />Production guides<\\/span>/, "canvas toolbar must group production controls");\nassert.match(focus, /const FADE_MS = 300;/, "garment focus transition should settle quickly");\nassert.match(css, /grid-template-columns: minmax\\(0, 380px\\) !important;/, "focused garment grid must collapse to the selected card");\nassert.match(css, /#gdp-touch-studio-panel[\\s\\S]*max-height: min\\(46vh, 430px\\) !important;/, "desktop editor inspector must use an internal scroll region");\n\nconsole.log("Desktop Custom Studio regression checks passed.");\n''')
print("desktop regression verifier: written")
