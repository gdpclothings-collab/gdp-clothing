from pathlib import Path

path = Path("src/pages/CustomStudio.jsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


def replace_count(old: str, new: str, expected: int, label: str) -> None:
    global text
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} matches, found {count}")
    text = text.replace(old, new)


replace_once(
    '  const [designStyle, setDesignStyle] = useState("");\n',
    '',
    'remove shared design style state',
)

replace_once(
    '  const [previewSide, setPreviewSide] = useState("front");\n',
    '  const [previewSide, setPreviewSide] = useState("front");\n'
    '  const [designStylesBySide, setDesignStylesBySide] = useState({ front: "", back: "" });\n'
    '  const designStyleForSide = (side) => String(designStylesBySide?.[side] || "");\n'
    '  const frontDesignStyle = designStyleForSide("front");\n'
    '  const backDesignStyle = designStyleForSide("back");\n'
    '  const designStyle = designStyleForSide(previewSide);\n'
    '  const orderDesignStyle = placement === "back" ? backDesignStyle : (frontDesignStyle || backDesignStyle);\n',
    'add side-specific design style state',
)

replace_once(
    '  const styleTemplates = normalizeStyleTemplates(studioSettings.styleTemplates);\n'
    '  const activeStyleTemplate = designStyle ?\n'
    '    (designPath === "upload" || designStyle === NO_TEMPLATE_STYLE ? null : styleTemplateForName(designStyle, studioSettings.styleTemplates))\n'
    '    : null;\n'
    '  // Protected GDP layouts are front designs. Back printing is an explicit,\n'
    '  // independently edited add-on so a template click cannot add a second print.\n'
    '  const activePreviewTemplate = previewSide === "front" ? activeStyleTemplate : null;\n',
    '  const styleTemplates = normalizeStyleTemplates(studioSettings.styleTemplates);\n'
    '  const styleTemplateForSide = (side) => {\n'
    '    const sideStyle = designStyleForSide(side);\n'
    '    if (!sideStyle || designPath === "upload" || sideStyle === NO_TEMPLATE_STYLE) return null;\n'
    '    return styleTemplateForName(sideStyle, studioSettings.styleTemplates);\n'
    '  };\n'
    '  const activeStyleTemplate = styleTemplateForSide(previewSide);\n'
    '  const activePreviewTemplate = activeStyleTemplate;\n',
    'make active template side-specific',
)

replace_once(
    '    setEditorLayersBySide((current) => ({ ...current, back: copiedLayers }));\n'
    '    setArtworkStates((current) => ({ ...current, back: JSON.parse(JSON.stringify(current.front || defaultArtworkState(activeStyleTemplate))) }));\n'
    '    setPlacement("front_back");\n',
    '    setEditorLayersBySide((current) => ({ ...current, back: copiedLayers }));\n'
    '    setDesignStylesBySide((current) => ({ ...current, back: current.front || "" }));\n'
    '    setArtworkStates((current) => ({ ...current, back: JSON.parse(JSON.stringify(current.front || defaultArtworkState(styleTemplateForSide("front")))) }));\n'
    '    setPlacement("front_back");\n',
    'copy front style to back with copied design',
)

replace_once(
    '    setDesignStyle(String(draft.designStyle || ""));\n',
    '    setDesignStylesBySide(\n'
    '      draft.designStylesBySide && typeof draft.designStylesBySide === "object"\n'
    '        ? { front: String(draft.designStylesBySide.front || ""), back: String(draft.designStylesBySide.back || "") }\n'
    '        : { front: String(draft.designStyle || ""), back: "" }\n'
    '    );\n',
    'restore side-specific design styles',
)

replace_once(
    '        step,\n'
    '        designPath,\n'
    '        designStyle,\n'
    '        designMood,\n',
    '        step,\n'
    '        designPath,\n'
    '        designStyle: orderDesignStyle,\n'
    '        designStylesBySide,\n'
    '        designMood,\n',
    'persist side-specific styles in draft',
)

replace_once(
    '  }, [draftReady, seasonalMode, saving, product?.id, step, designPath, designStyle, designMood, designIntensity, color, size, qty, placement, previewSide, groupGarments, photos, editorLayersBySide, selectedEditorLayerIds, personalization, memorialNameConfirmed, needByDate, priority, artworkStates, previewZoom, seasonalDraft]);\n',
    '  }, [draftReady, seasonalMode, saving, product?.id, step, designPath, designStylesBySide, orderDesignStyle, designMood, designIntensity, color, size, qty, placement, previewSide, groupGarments, photos, editorLayersBySide, selectedEditorLayerIds, personalization, memorialNameConfirmed, needByDate, priority, artworkStates, previewZoom, seasonalDraft]);\n',
    'update draft autosave dependencies',
)

replace_once(
    '    const allowedStyles = nextProduct?.customization?.allowedStyles || [];\n'
    '    const styleStillAllowed = Boolean(designStyle) && (designPath === "memorial" || !allowedStyles.length || allowedStyles.includes(designStyle));\n'
    '    if (designStyle && !styleStillAllowed) {\n'
    '      setDesignStyle("");\n'
    '      setArtworkStates(defaultArtworkStates());\n'
    '    }\n'
    '    setPreviewSide("front");\n',
    '    const allowedStyles = nextProduct?.customization?.allowedStyles || [];\n'
    '    const styleStillAllowed = (value) => !value || designPath === "upload" || designPath === "memorial" || value === NO_TEMPLATE_STYLE || !allowedStyles.length || allowedStyles.includes(value);\n'
    '    const nextFrontStyle = styleStillAllowed(frontDesignStyle) ? frontDesignStyle : "";\n'
    '    const nextBackStyle = styleStillAllowed(backDesignStyle) ? backDesignStyle : "";\n'
    '    if (nextFrontStyle !== frontDesignStyle || nextBackStyle !== backDesignStyle) {\n'
    '      setDesignStylesBySide({ front: nextFrontStyle, back: nextBackStyle });\n'
    '      setArtworkStates((current) => ({\n'
    '        front: nextFrontStyle === frontDesignStyle ? current.front : defaultArtworkState(),\n'
    '        back: nextBackStyle === backDesignStyle ? current.back : defaultArtworkState(),\n'
    '      }));\n'
    '    }\n'
    '    setPreviewSide("front");\n',
    'validate styles per side when garment changes',
)

replace_once(
    '  const chooseStyleTemplate = (style) => {\n'
    '    if (!style) return;\n'
    '    setDesignStyle(style.name);\n'
    '    setDesignMood("Original");\n'
    '    setDesignIntensity(3);\n'
    '    setPreviewSide("front");\n'
    '    setPlacement((current) => current === "back" ? "front" : current);\n'
    '    setArtworkStates((current) => ({\n'
    '      front: {\n'
    '        ...defaultArtworkState(style),\n'
    '        sourcePhotoIndex: Number(current?.front?.sourcePhotoIndex || 0),\n'
    '      },\n'
    '      back: {\n'
    '        ...defaultArtworkState(style),\n'
    '        sourcePhotoIndex: Number(current?.back?.sourcePhotoIndex || 0),\n'
    '      },\n'
    '    }));\n'
    '  };\n',
    '  const chooseStyleTemplate = (style) => {\n'
    '    if (!style) return;\n'
    '    const side = previewSide;\n'
    '    setDesignStylesBySide((current) => ({ ...current, [side]: style.name }));\n'
    '    setDesignMood("Original");\n'
    '    setDesignIntensity(3);\n'
    '    activatePrintSide(side);\n'
    '    setArtworkStates((current) => ({\n'
    '      ...current,\n'
    '      [side]: {\n'
    '        ...defaultArtworkState(style),\n'
    '        sourcePhotoIndex: Number(current?.[side]?.sourcePhotoIndex || 0),\n'
    '      },\n'
    '    }));\n'
    '  };\n',
    'keep template selection on active print side',
)

replace_once(
    '  const chooseNoTemplate = () => {\n'
    '    if (activeStyleTemplate && typeof window !== "undefined" && !window.confirm("Switch to a blank design? Your uploaded photos and text will be preserved. The GDP template will be removed.")) return;\n'
    '    setDesignStyle(NO_TEMPLATE_STYLE);\n'
    '    setDesignMood("Original");\n'
    '    setArtworkStates(defaultArtworkStates());\n'
    '    setPreviewSide("front");\n'
    '  };\n',
    '  const chooseNoTemplate = () => {\n'
    '    if (activeStyleTemplate && typeof window !== "undefined" && !window.confirm("Switch to a blank design? Your uploaded photos and text will be preserved. The GDP template will be removed.")) return;\n'
    '    const side = previewSide;\n'
    '    setDesignStylesBySide((current) => ({ ...current, [side]: NO_TEMPLATE_STYLE }));\n'
    '    setDesignMood("Original");\n'
    '    setArtworkStates((current) => ({ ...current, [side]: defaultArtworkState() }));\n'
    '  };\n',
    'keep blank template selection side-specific',
)

replace_once(
    '      return Boolean(designStyle) && photos.length >= minPhotos && memorialDetailsReady;\n',
    '      return Boolean(orderDesignStyle) && photos.length >= minPhotos && memorialDetailsReady;\n',
    'continue validation uses order style',
)
replace_once(
    '      if (!designStyle) return "Choose an artwork style to continue.";\n',
    '      if (!orderDesignStyle) return "Choose an artwork style to continue.";\n',
    'continue hint uses order style',
)
replace_once(
    '      if (!designStyle) { targetId = "custom-studio-artwork-style"; panelTab = "design"; }\n',
    '      if (!orderDesignStyle) { targetId = "custom-studio-artwork-style"; panelTab = "design"; }\n',
    'focus requirement uses order style',
)
replace_once(
    '    if (!designPath || !designStyle) {\n',
    '    if (!designPath || !orderDesignStyle) {\n',
    'cart validation uses order style',
)

replace_once(
    '      const approvedAt = new Date().toISOString();\n'
    '      const renderSnapshot = {\n'
    '        version: 1,\n'
    '        designPath,\n'
    '        designStyle,\n'
    '        template: activeStyleTemplate ? {\n'
    '          id: activeStyleTemplate.id,\n'
    '          assetUrl: activeStyleTemplate.assetUrl || "",\n'
    '          photoZone: activeStyleTemplate.photoZone || null,\n'
    '          textZone: activeStyleTemplate.textZone || null,\n'
    '        } : null,\n',
    '      const approvedAt = new Date().toISOString();\n'
    '      const serializeStyleTemplate = (template) => template ? {\n'
    '        id: template.id,\n'
    '        assetUrl: template.assetUrl || "",\n'
    '        photoZone: template.photoZone || null,\n'
    '        textZone: template.textZone || null,\n'
    '      } : null;\n'
    '      const frontStyleTemplate = styleTemplateForSide("front");\n'
    '      const backStyleTemplate = styleTemplateForSide("back");\n'
    '      const primaryStyleTemplate = placement === "back" ? backStyleTemplate : (frontStyleTemplate || backStyleTemplate);\n'
    '      const renderSnapshot = {\n'
    '        version: 2,\n'
    '        designPath,\n'
    '        designStyle: orderDesignStyle,\n'
    '        designStylesBySide: { front: frontDesignStyle, back: backDesignStyle },\n'
    '        template: serializeStyleTemplate(primaryStyleTemplate),\n'
    '        templatesBySide: {\n'
    '          front: serializeStyleTemplate(frontStyleTemplate),\n'
    '          back: serializeStyleTemplate(backStyleTemplate),\n'
    '        },\n',
    'store both templates in locked render snapshot',
)

replace_once(
    '        name: personalization.name || ((designStyle || "Custom") + " Design"),\n',
    '        name: personalization.name || ((orderDesignStyle || "Custom") + " Design"),\n',
    'custom design name uses primary style',
)
replace_count(
    '        designStyle,\n        designPath,\n',
    '        designStyle: orderDesignStyle,\n        designPath,\n',
    2,
    'persist primary style in design and cart payloads',
)

replace_once(
    '                      setDesignStyle("Own artwork");\n'
    '                      setArtworkStates(defaultArtworkStates());\n',
    '                      setDesignStylesBySide({ front: "Own artwork", back: "Own artwork" });\n'
    '                      setPreviewSide("front");\n'
    '                      setArtworkStates(defaultArtworkStates());\n',
    'initialize upload style for both sides',
)
replace_once(
    '                      setDesignStyle("");\n'
    '                      setDesignMood("Original");\n',
    '                      setDesignStylesBySide({ front: "", back: "" });\n'
    '                      setPreviewSide("front");\n'
    '                      setDesignMood("Original");\n',
    'reset template styles when choosing template path',
)

replace_once(
    '              <ReviewCard label={designPath === "upload" ? "Artwork" : "Ready layout"} value={(designStyle || "Not selected").replace(/^GDP\\s+/, "")} sub={designStyle ? `${designMood || "Original"} finish` : ""} />\n',
    '              <ReviewCard label={designPath === "upload" ? "Artwork" : "Ready layout"} value={(orderDesignStyle || "Not selected").replace(/^GDP\\s+/, "")} sub={orderDesignStyle ? `${designMood || "Original"} finish` : ""} />\n',
    'review uses primary order style',
)

replace_once(
    '              <StudioPreview\n'
    '                garment={garment}\n'
    '                color={previewColor}\n'
    '                side={previewSide}\n',
    '              <StudioPreview\n'
    '                garment={garment}\n'
    '                color={previewColor}\n'
    '                side={previewSide}\n'
    '                fillCanvas={designPath === "bootleg"}\n',
    'enable canvas fill for bootleg live preview',
)

replace_once(
    '                  viewGuidance={activePreviewTemplate ? "GDP template is locked. Drag, resize and rotate only customer-added content inside the print guide; lettering stays editable." : previewSide === "back" && activeStyleTemplate ? "Back print is independent. Add your own photos, lettering or stickers; the protected front template is not duplicated here." : designStyle === NO_TEMPLATE_STYLE ? "Blank canvas selected. Add and edit your own photos, lettering and stickers inside the print guide." : "Move and resize your uploaded artwork inside the print guide. Aspect ratio stays constrained by default."}\n',
    '                  viewGuidance={activePreviewTemplate ? "GDP template is locked on this side. Drag, resize and rotate only customer-added content inside the print guide; lettering stays editable." : designStyle === NO_TEMPLATE_STYLE ? "Blank canvas selected. Add and edit your own photos, lettering and stickers inside the print guide." : previewSide === "back" ? "Back print is independent. Choose a back template or add your own photos and lettering without changing the front." : "Move and resize your uploaded artwork inside the print guide. Aspect ratio stays constrained by default."}\n',
    'update side-specific editor guidance',
)

replace_once(
    '                  templateName={previewSide === "front" && (designPath === "bootleg" || designPath === "memorial") ? activeStyleTemplate?.name || "" : ""}\n',
    '                  templateName={(designPath === "bootleg" || designPath === "memorial") ? activeStyleTemplate?.name || "" : ""}\n',
    'show protected template name on either side',
)

replace_once(
    '              styleTemplate={side === "front" ? activeStyleTemplate : null}\n',
    '              styleTemplate={styleTemplateForSide(side)}\n',
    'render side-specific templates in production previews',
)

replace_once(
    'export function StudioPreview({ garment, color, side, placement, photo, uploading = false, personalization, editorLayers = [], stickerLibrary = [], photoAssets = [], selectedEditorLayerId = "", onSelectEditorLayer = null, onPatchEditorLayer = null, onEditorDragStart = null, interactiveEditor = false, onArtworkDragStart = null, zoom, setZoom = null, artworkScale, artworkStretchX = 100, artworkStretchY = 100, artworkRotation, artworkOffset, setArtworkOffset = null, artworkFitMode = "crop", showGuides, showMeasurements, size, previewConfig = {}, styleTemplate, mood = "", fullscreen = false, seasonalOverlay = null, containerId = "", printAreaId = "" }) {\n',
    'export function StudioPreview({ garment, color, side, placement, photo, uploading = false, personalization, editorLayers = [], stickerLibrary = [], photoAssets = [], selectedEditorLayerId = "", onSelectEditorLayer = null, onPatchEditorLayer = null, onEditorDragStart = null, interactiveEditor = false, onArtworkDragStart = null, zoom, setZoom = null, artworkScale, artworkStretchX = 100, artworkStretchY = 100, artworkRotation, artworkOffset, setArtworkOffset = null, artworkFitMode = "crop", showGuides, showMeasurements, size, previewConfig = {}, styleTemplate, mood = "", fullscreen = false, fillCanvas = false, seasonalOverlay = null, containerId = "", printAreaId = "" }) {\n',
    'add fill canvas preview option',
)

replace_once(
    '        className={"relative " + (fullscreen ? "w-[min(55vh,520px)]" : "h-[82%] w-auto max-w-[90%]")}\n',
    '        className={"relative " + (fullscreen ? "w-[min(55vh,520px)]" : fillCanvas ? "h-[86%] w-auto max-w-[94%] sm:h-[96%] sm:max-w-[98%]" : "h-[82%] w-auto max-w-[90%]")}\n',
    'make bootleg garment fill desktop canvas',
)

# Safety assertions: no shared setter or forced-front style selection should remain.
if 'setDesignStyle(' in text:
    raise SystemExit('shared setDesignStyle call remains after patch')
if 'const [designStyle, setDesignStyle]' in text:
    raise SystemExit('shared design style state remains after patch')
if 'styleTemplate={side === "front" ? activeStyleTemplate : null}' in text:
    raise SystemExit('front-only production template logic remains after patch')
if 'fillCanvas={designPath === "bootleg"}' not in text:
    raise SystemExit('bootleg canvas fill flag was not added')

path.write_text(text, encoding="utf-8")
print("Custom Studio desktop patch applied successfully.")
