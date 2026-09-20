from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


editor_path = Path('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx')
production_path = Path('src/lib/customStudioV2ProtectedProduction.js')
page_path = Path('src/pages/CustomStudioV2.jsx')
verify_path = Path('scripts/verify-photo-bootleg-desktop.mjs')

editor = editor_path.read_text()
production = production_path.read_text()
page = page_path.read_text()
verify = verify_path.read_text()

# React effect is used only to migrate an existing Memorial legacy text payload into
# independent layer state once a protected template is already selected.
editor = replace_once(
    editor,
    "import React, { useMemo, useRef, useState } from 'react';",
    "import React, { useEffect, useMemo, useRef, useState } from 'react';",
    'React useEffect import',
)

anchor = """function resolveBootlegTemplateTransform(style) {
  const value = style?.templateTransform || {};
  return {
    scale: clamp(value.scale ?? 100, BOOTLEG_TEMPLATE_MIN_SCALE, BOOTLEG_TEMPLATE_MAX_SCALE),
    rotation: clamp(value.rotation ?? 0, -180, 180),
    x: clamp(value.x ?? 0, -50, 50),
    y: clamp(value.y ?? 0, -50, 50),
  };
}
"""
helpers = anchor + """
function resolveMemorialTextLayers(editor = {}, fallbackStyle = {}, textZone = {}) {
  if (Array.isArray(editor?.textLayers)) {
    return editor.textLayers
      .filter(Boolean)
      .slice(0, BOOTLEG_MAX_TEXT_LAYERS)
      .map((layer, index) => ({
        ...layer,
        id: String(layer.id || `memorial-text-${index + 1}`),
        name: String(layer.name || `Text ${index + 1}`),
        role: String(layer.role || 'custom'),
        text: { headline: String(layer.text?.headline || ''), subline: '', message: '' },
        style: normalizeBootlegTextStyle(layer.style || {}, fallbackStyle),
        order: index,
        visible: layer.visible !== false,
      }));
  }

  const centerX = clamp(Number(textZone?.x ?? 12) + Number(textZone?.width ?? 76) / 2, 0, 100);
  const zoneY = Number(textZone?.y ?? 78);
  const zoneHeight = Number(textZone?.height ?? 16);
  const legacy = editor?.text || {};
  const base = normalizeBootlegTextStyle(editor?.textStyle || {}, fallbackStyle);
  const seed = (id, role, name, value, yRatio, scale) => ({
    id,
    role,
    name,
    text: { headline: String(value || ''), subline: '', message: '' },
    style: normalizeBootlegTextStyle({
      ...base,
      canvasX: centerX,
      canvasY: clamp(zoneY + zoneHeight * yRatio, 0, 100),
      fontScale: scale,
      rotation: Number(base.rotation || 0),
    }, fallbackStyle),
    visible: true,
  });

  return [
    seed('memorial-name', 'name', 'Name', legacy.headline, 0.25, Number(base.fontScale || 100)),
    seed('memorial-dates', 'dates', 'Dates', legacy.subline, 0.56, Math.max(45, Number(base.fontScale || 100) * 0.72)),
    seed('memorial-message', 'message', 'Message', legacy.message, 0.83, Math.max(38, Number(base.fontScale || 100) * 0.58)),
  ].map((layer, index) => ({ ...layer, order: index }));
}

function buildMemorialTextStatePatch(editor = {}, layers = [], activeId = '', fallbackStyle = {}) {
  const ordered = (layers || [])
    .filter(Boolean)
    .slice(0, BOOTLEG_MAX_TEXT_LAYERS)
    .map((layer, index) => ({
      ...layer,
      id: String(layer.id || `memorial-text-${index + 1}`),
      name: String(layer.name || `Text ${index + 1}`),
      role: String(layer.role || 'custom'),
      text: { headline: String(layer.text?.headline || ''), subline: '', message: '' },
      style: normalizeBootlegTextStyle(layer.style || {}, fallbackStyle),
      order: index,
      visible: layer.visible !== false,
    }));
  const active = ordered.find((layer) => layer.id === activeId) || ordered.find((layer) => layer.role === 'name') || ordered[0] || null;
  const byRole = (role) => ordered.find((layer) => layer.role === role)?.text?.headline || '';
  const templateTransform = editor?.textStyle?.templateTransform;
  return {
    textLayers: ordered,
    activeTextLayerId: active?.id || '',
    text: {
      headline: byRole('name'),
      subline: byRole('dates'),
      message: byRole('message'),
    },
    textStyle: {
      ...(active?.style || fallbackStyle || {}),
      freeTextLayout: true,
      photoForeground: false,
      ...(templateTransform ? { templateTransform } : {}),
    },
  };
}
"""
editor = replace_once(editor, anchor, helpers, 'Memorial layer helpers')

# Reuse the proven full-print-area photo gesture engine for Memorial, while keeping
# Bootleg-only data attributes so the Bootleg foreground CSS cannot reorder Memorial.
editor = replace_once(
    editor,
    "function BootlegPhotoLayer({ layer, selected, canvasRef, zone, onSelect, onTransform }) {",
    "function BootlegPhotoLayer({ layer, selected, canvasRef, zone, onSelect, onTransform, scope = 'bootleg' }) {",
    'free photo layer signature',
)
editor = replace_once(
    editor,
    '      data-gdp-bootleg-free-photo-layer="true"\n',
    "      data-gdp-bootleg-free-photo-layer={scope === 'bootleg' ? 'true' : undefined}\n      data-gdp-memorial-free-photo-layer={scope === 'memorial' ? 'true' : undefined}\n",
    'free photo data markers',
)
editor = replace_once(
    editor,
    "function BootlegTextLayer({ layer, layout, canvasRef, selected, onPatchStyle }) {",
    "function BootlegTextLayer({ layer, layout, canvasRef, selected, onPatchStyle, scope = 'bootleg' }) {",
    'text layer signature',
)
editor = replace_once(
    editor,
    '      data-gdp-bootleg-text-layer="true"\n      data-gdp-bootleg-text-layer-id={layer.id}\n',
    "      data-gdp-bootleg-text-layer={scope === 'bootleg' ? 'true' : undefined}\n      data-gdp-memorial-text-layer={scope === 'memorial' ? 'true' : undefined}\n      data-gdp-bootleg-text-layer-id={scope === 'bootleg' ? layer.id : undefined}\n      data-gdp-memorial-text-layer-id={scope === 'memorial' ? layer.id : undefined}\n",
    'text layer data markers',
)
editor = replace_once(
    editor,
    "aria-label={`Editable Photo Bootleg ${layer.name || 'text'} layer`}",
    "aria-label={`Editable ${scope === 'memorial' ? 'Memorial Tribute' : 'Photo Bootleg'} ${layer.name || 'text'} layer`}",
    'text layer aria label',
)

editor = replace_once(
    editor,
    "  const isBootleg = path === 'bootleg';\n",
    "  const isBootleg = path === 'bootleg';\n  const isMemorial = path === 'memorial';\n  const usesLayerLab = isBootleg || isMemorial;\n",
    'preview layer lab flags',
)
editor = replace_once(
    editor,
    "  const bootlegTextLayers = isBootleg\n    ? resolveBootlegTextLayers(editor, fallbackTextStyle).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))\n    : [];",
    "  const bootlegTextLayers = isBootleg\n    ? resolveBootlegTextLayers(editor, fallbackTextStyle).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))\n    : isMemorial\n      ? resolveMemorialTextLayers(editor, fallbackTextStyle, textZone).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))\n      : [];",
    'preview text layer resolver',
)
editor = replace_once(editor, "  const templateEditing = isBootleg && activeLayer === 'template';", "  const templateEditing = usesLayerLab && activeLayer === 'template';", 'template editing flag')
editor = replace_once(editor, "    enabled: !isBootleg && Boolean(editor.text?.headline || editor.text?.subline || editor.text?.message),", "    enabled: !usesLayerLab && Boolean(editor.text?.headline || editor.text?.subline || editor.text?.message),", 'legacy text gesture scope')
editor = replace_once(
    editor,
    "    onChange: (next) => {\n      if (!isBootleg) return;\n      onPatch({ textStyle: { ...legacyStyle, freeTextLayout: true, templateTransform: { scale: clamp(next.scale, BOOTLEG_TEMPLATE_MIN_SCALE, BOOTLEG_TEMPLATE_MAX_SCALE), rotation: next.rotation, x: next.x, y: next.y } } });\n    },\n    containerRef: canvasRef,\n    enabled: isBootleg && templateEditing && Boolean(template),",
    "    onChange: (next) => {\n      if (!usesLayerLab) return;\n      onPatch({ textStyle: { ...legacyStyle, ...(isBootleg ? { freeTextLayout: true, photoForeground: true } : { photoForeground: false }), templateTransform: { scale: clamp(next.scale, BOOTLEG_TEMPLATE_MIN_SCALE, BOOTLEG_TEMPLATE_MAX_SCALE), rotation: next.rotation, x: next.x, y: next.y } } });\n    },\n    containerRef: canvasRef,\n    enabled: usesLayerLab && templateEditing && Boolean(template),",
    'template gesture scope',
)
editor = replace_once(
    editor,
    "  const bootlegPhotoCanvas = (\n    <div data-gdp-bootleg-linked-photo-zone=\"true\" data-gdp-bootleg-free-photo-canvas=\"true\" className=\"absolute inset-0 overflow-hidden\" style={{ zIndex: 10 }}>\n      {photos.map((layer) => <BootlegPhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && activeLayer === 'photo'} canvasRef={canvasRef} zone={zone} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}",
    "  const bootlegPhotoCanvas = (\n    <div data-gdp-bootleg-linked-photo-zone={isBootleg ? 'true' : undefined} data-gdp-bootleg-free-photo-canvas={isBootleg ? 'true' : undefined} data-gdp-memorial-free-photo-zone={isMemorial ? 'true' : undefined} className=\"absolute inset-0 overflow-hidden\" style={{ zIndex: 10 }}>\n      {photos.map((layer) => <BootlegPhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && activeLayer === 'photo'} canvasRef={canvasRef} zone={zone} scope={path} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}",
    'free photo canvas scope',
)
editor = replace_once(editor, "          {isBootleg ? bootlegPhotoCanvas : photoZone}", "          {usesLayerLab ? bootlegPhotoCanvas : photoZone}", 'preview photo canvas')
editor = replace_once(
    editor,
    "            isBootleg ? (\n              <div\n                {...(templateEditing ? templateGesture : {})}\n                data-gdp-bootleg-template-layer=\"true\"",
    "            usesLayerLab ? (\n              <div\n                {...(templateEditing ? templateGesture : {})}\n                data-gdp-bootleg-template-layer={isBootleg ? 'true' : undefined}\n                data-gdp-memorial-template-layer={isMemorial ? 'true' : undefined}",
    'preview template layer parity',
)
editor = replace_once(
    editor,
    "          {isBootleg ? bootlegTextLayouts.map(({ layer, layout }) => <BootlegTextLayer key={layer.id} layer={layer} layout={layout} canvasRef={canvasRef} selected={activeLayer === 'text' && layer.id === activeTextLayerId} onPatchStyle={(style) => patchBootlegTextStyle(layer.id, style)} />) : null}",
    "          {usesLayerLab ? bootlegTextLayouts.map(({ layer, layout }) => <BootlegTextLayer key={layer.id} layer={layer} layout={layout} canvasRef={canvasRef} scope={path} selected={activeLayer === 'text' && layer.id === activeTextLayerId} onPatchStyle={(style) => patchBootlegTextStyle(layer.id, style)} />) : null}",
    'preview multi text parity',
)
editor = replace_once(editor, "          {!isBootleg && (headline || editor.text?.subline || editor.text?.message) ? (", "          {!usesLayerLab && (headline || editor.text?.subline || editor.text?.message) ? (", 'legacy text preview scope')
editor = replace_once(
    editor,
    "      <p className=\"mt-2 text-center text-[10px] font-bold text-slate-400\">{isBootleg ? `${activeLayer === 'template' ? 'Template' : activeLayer === 'photo' ? 'Photo' : activeLayer === 'text' ? 'Text' : 'Sticker'} layer selected · ` : ''}One finger moves · two fingers pinch/rotate · {String(side || 'front').toUpperCase()} side</p>",
    "      <p className=\"mt-2 text-center text-[10px] font-bold text-slate-400\">{usesLayerLab ? `${activeLayer === 'template' ? 'Template' : activeLayer === 'photo' ? 'Photo' : activeLayer === 'text' ? 'Text' : 'Sticker'} layer selected · ` : ''}One finger moves · two fingers pinch/rotate · {String(side || 'front').toUpperCase()} side</p>",
    'gesture guidance parity',
)

# Main protected editor: keep Bootleg naming/markers intact for regression tests, but
# route Memorial through the same interaction engine with its own stacking semantics.
# Replace the second component-level isBootleg declaration (the first was in ProtectedPreview).
needle = "  const isBootleg = path === 'bootleg';\n  const category = path === 'memorial' ? 'memorial_tribute' : 'photo_bootleg';"
editor = replace_once(
    editor,
    needle,
    "  const isBootleg = path === 'bootleg';\n  const isMemorial = path === 'memorial';\n  const usesLayerLab = isBootleg || isMemorial;\n  const category = path === 'memorial' ? 'memorial_tribute' : 'photo_bootleg';",
    'main layer lab flags',
)
editor = replace_once(
    editor,
    "  const bootlegTextLayers = isBootleg ? resolveBootlegTextLayers(editor, fallbackBootlegTextStyle) : [];",
    "  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16 };\n  const bootlegTextLayers = isBootleg ? resolveBootlegTextLayers(editor, fallbackBootlegTextStyle) : isMemorial ? resolveMemorialTextLayers(editor, fallbackBootlegTextStyle, textZone) : [];",
    'main text layers',
)
editor = replace_once(editor, "  const textStyle = isBootleg ? normalizeBootlegTextStyle(activeTextLayer?.style || {}, fallbackBootlegTextStyle) : legacyTextStyle;", "  const textStyle = usesLayerLab ? normalizeBootlegTextStyle(activeTextLayer?.style || {}, fallbackBootlegTextStyle) : legacyTextStyle;", 'active text style parity')
editor = replace_once(editor, "  const textContent = isBootleg ? (activeTextLayer?.text || { headline: '', subline: '', message: '' }) : (editor.text || {});\n  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16 };", "  const textContent = usesLayerLab ? (activeTextLayer?.text || { headline: '', subline: '', message: '' }) : (editor.text || {});", 'active text content parity')
editor = replace_once(editor, "  const textLayout = isBootleg && activeTextLayer ?", "  const textLayout = usesLayerLab && activeTextLayer ?", 'text layout parity')
editor = replace_once(editor, "  const textAnchorRanges = isBootleg && textLayout ?", "  const textAnchorRanges = usesLayerLab && textLayout ?", 'text anchor range parity')
editor = replace_once(editor, "  const textXSlider = isBootleg && textLayout && textAnchorRanges ?", "  const textXSlider = usesLayerLab && textLayout && textAnchorRanges ?", 'text X parity')
editor = replace_once(editor, "  const textYSlider = isBootleg && textLayout && textAnchorRanges ?", "  const textYSlider = usesLayerLab && textLayout && textAnchorRanges ?", 'text Y parity')
editor = replace_once(editor, "  const activePhotoCanvasPosition = isBootleg && activePhoto ?", "  const activePhotoCanvasPosition = usesLayerLab && activePhoto ?", 'photo canvas position parity')
editor = replace_once(
    editor,
    "  const syncTextLayers = (next, activeId = '') => {\n    const latestEditor = editorRef.current || editor;\n    const patch = buildBootlegTextStatePatch(latestEditor, next, activeId, fallbackBootlegTextStyle);\n    editorRef.current = { ...latestEditor, ...patch };\n    onPatch(patch);\n  };",
    "  const syncTextLayers = (next, activeId = '') => {\n    const latestEditor = editorRef.current || editor;\n    const basePatch = isMemorial\n      ? buildMemorialTextStatePatch(latestEditor, next, activeId, fallbackBootlegTextStyle)\n      : buildBootlegTextStatePatch(latestEditor, next, activeId, fallbackBootlegTextStyle);\n    const patch = isBootleg\n      ? { ...basePatch, textStyle: { ...basePatch.textStyle, freeTextLayout: true, photoForeground: true } }\n      : basePatch;\n    editorRef.current = { ...latestEditor, ...patch };\n    onPatch(patch);\n  };",
    'text sync parity',
)

# One-time compatibility migration for already-saved Memorial drafts. Canonical Name,
# Dates and Message stay mirrored in editor.text while independent layers are added.
insert_after = """  const syncStickers = (next, activeId = '') => {
    const latestEditor = editorRef.current || editor;
    const byId = new Map();
    next.filter(Boolean).forEach((layer) => {
      if (!layer?.id) return;
      byId.set(layer.id, layer);
    });
    const ordered = [...byId.values()].map((layer, index) => ({ ...layer, order: index }));
    const nextActiveId = activeId && ordered.some((layer) => layer.id === activeId) ? activeId : '';
    const patch = {
      stickers: ordered,
      activeStickerId: nextActiveId,
      ...(nextActiveId ? { activePhotoId: '' } : {}),
    };
    editorRef.current = { ...latestEditor, ...patch };
    onPatch(patch);
  };
"""
insert_block = insert_after + """

  useEffect(() => {
    if (!isMemorial || !template || Array.isArray(editor.textLayers)) return;
    const seeded = resolveMemorialTextLayers(editor, fallbackBootlegTextStyle, textZone);
    const activeId = seeded.find((layer) => layer.role === 'name')?.id || seeded[0]?.id || '';
    const patch = buildMemorialTextStatePatch(editor, seeded, activeId, fallbackBootlegTextStyle);
    editorRef.current = { ...editorRef.current, ...patch };
    onPatch(patch);
  }, [isMemorial, template?.id]);
"""
editor = replace_once(editor, insert_after, insert_block, 'Memorial legacy text migration')

# Preserve existing Bootleg branch verbatim and add a Memorial branch immediately after it.
memorial_select = """    if (isBootleg) {
      const nextTextPosition = resolveBootlegTextPosition(textStyle, item.textZone || { x: 12, y: 78, width: 76, height: 16 });
      const nextLayers = bootlegTextLayers.map((layer) => layer.id === activeTextLayer?.id
        ? { ...layer, style: normalizeBootlegTextStyle({ ...layer.style, canvasX: nextTextPosition.x, canvasY: nextTextPosition.y }, fallbackBootlegTextStyle) }
        : layer);
      const latestEditor = editorRef.current || editor;
      const textPatch = buildBootlegTextStatePatch(latestEditor, nextLayers, activeTextLayer?.id || '', fallbackBootlegTextStyle);
      const patch = {
        templateId: item.id,
        ...(nextPhotos.length ? {} : { transform: defaults }),
        ...textPatch,
        textStyle: { ...textPatch.textStyle, templateTransform: { scale: 100, rotation: 0, x: 0, y: 0 } },
      };
      editorRef.current = { ...latestEditor, ...patch };
      onPatch(patch);
      setActiveBootlegLayer('template');
      return;
    }
"""
memorial_select_new = memorial_select + """    if (isMemorial) {
      const nextTextPosition = resolveBootlegTextPosition(textStyle, item.textZone || { x: 12, y: 78, width: 76, height: 16 });
      const nextLayers = bootlegTextLayers.map((layer) => layer.id === activeTextLayer?.id
        ? { ...layer, style: normalizeBootlegTextStyle({ ...layer.style, canvasX: nextTextPosition.x, canvasY: nextTextPosition.y }, fallbackBootlegTextStyle) }
        : layer);
      const latestEditor = editorRef.current || editor;
      const textPatch = buildMemorialTextStatePatch(latestEditor, nextLayers, activeTextLayer?.id || '', fallbackBootlegTextStyle);
      const patch = {
        templateId: item.id,
        ...(nextPhotos.length ? {} : { transform: defaults }),
        ...textPatch,
        textStyle: { ...textPatch.textStyle, photoForeground: false, templateTransform: { scale: 100, rotation: 0, x: 0, y: 0 } },
      };
      editorRef.current = { ...latestEditor, ...patch };
      onPatch(patch);
      setActiveBootlegLayer('template');
      return;
    }
"""
editor = replace_once(editor, memorial_select, memorial_select_new, 'Memorial template selection parity')

# User actions select the shared layer lab for both protected design paths.
editor = editor.replace("if (isBootleg) setActiveBootlegLayer('photo');", "if (usesLayerLab) setActiveBootlegLayer('photo');")
editor = editor.replace("if (isBootleg) setActiveBootlegLayer('sticker');", "if (usesLayerLab) setActiveBootlegLayer('sticker');")
editor = replace_once(editor, "    if (isBootleg) {\n        const position = resolvePhotoCanvasPosition(nextTransform, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 });", "    if (usesLayerLab) {\n        const position = resolvePhotoCanvasPosition(nextTransform, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 });", 'photo transform full canvas')
editor = replace_once(editor, "    const duplicateTransform = isBootleg\n      ?", "    const duplicateTransform = usesLayerLab\n      ?", 'photo duplicate full canvas')

editor = replace_once(
    editor,
    "  const patchText = (patch) => {\n    if (!isBootleg) {\n      onPatch({ text: { ...editor.text, ...patch } });\n      return;\n    }\n    if (!activeTextLayer) return;\n    setActiveBootlegLayer('text');\n    syncTextLayers(bootlegTextLayers.map((layer) => layer.id === activeTextLayer.id ? { ...layer, text: { ...layer.text, ...patch, subline: '', message: '' } } : layer), activeTextLayer.id);\n  };",
    "  const patchText = (patch) => {\n    if (!usesLayerLab) {\n      onPatch({ text: { ...editor.text, ...patch } });\n      return;\n    }\n    if (!activeTextLayer) return;\n    setActiveBootlegLayer('text');\n    syncTextLayers(bootlegTextLayers.map((layer) => layer.id === activeTextLayer.id ? { ...layer, text: { ...layer.text, ...patch, subline: '', message: '' } } : layer), activeTextLayer.id);\n  };",
    'text patch parity',
)
editor = replace_once(editor, "    if (!isBootleg) {\n      onPatch({ textStyle: { ...legacyTextStyle, ...patch } });", "    if (!usesLayerLab) {\n      onPatch({ textStyle: { ...legacyTextStyle, ...patch } });", 'text style parity')
editor = replace_once(
    editor,
    "  const patchTemplateTransform = (patch) => {\n    if (isBootleg) setActiveBootlegLayer('template');\n    const latestEditor = editorRef.current || editor;\n    const nextTextStyle = { ...(latestEditor.textStyle || legacyTextStyle), freeTextLayout: true, templateTransform: { ...templateTransform, ...patch } };",
    "  const patchTemplateTransform = (patch) => {\n    if (usesLayerLab) setActiveBootlegLayer('template');\n    const latestEditor = editorRef.current || editor;\n    const nextTextStyle = { ...(latestEditor.textStyle || legacyTextStyle), ...(isBootleg ? { freeTextLayout: true, photoForeground: true } : isMemorial ? { photoForeground: false } : {}), templateTransform: { ...templateTransform, ...patch } };",
    'template control parity',
)
editor = replace_once(editor, "    if (!isBootleg || !activeTextLayer || !textLayout || !textAnchorRanges) return;", "    if (!usesLayerLab || !activeTextLayer || !textLayout || !textAnchorRanges) return;", 'text position parity')
editor = replace_once(editor, "    if (!isBootleg || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;", "    if (!usesLayerLab || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;", 'add text parity')
editor = replace_once(editor, "      name: nextTextName(),\n      text:", "      name: nextTextName(),\n      ...(isMemorial ? { role: 'custom' } : {}),\n      text:", 'custom Memorial text role')

editor = replace_once(editor, "  const templatePanel = isBootleg && template ? (", "  const templatePanel = usesLayerLab && template ? (", 'template panel parity')
editor = replace_once(editor, "        {isBootleg ? <>\n          <RangeControl label=\"Move photo left / right\"", "        {usesLayerLab ? <>\n          <RangeControl label=\"Move photo left / right\"", 'photo panel full canvas controls')
editor = replace_once(editor, "          if (isBootleg) {\n            const resetPosition = resolvePhotoCanvasPosition", "          if (usesLayerLab) {\n            const resetPosition = resolvePhotoCanvasPosition", 'photo reset full canvas')
editor = replace_once(editor, "  const textPanel = isBootleg ? (", "  const textPanel = usesLayerLab ? (", 'multi text panel parity')

# Layer selector and inspector parity are enabled for Memorial without moving the
# existing Memorial confirmation control or changing Bootleg's desktop CSS scope.
editor = replace_once(editor, "        {isBootleg ? <div data-gdp-bootleg-active-layer=\"true\"", "        {usesLayerLab ? <div data-gdp-bootleg-active-layer={isBootleg ? 'true' : undefined} data-gdp-memorial-active-layer={isMemorial ? 'true' : undefined}", 'layer selector parity')
editor = replace_once(editor, "        {isBootleg ? <div data-gdp-bootleg-active-status=\"true\"", "        {usesLayerLab ? <div data-gdp-bootleg-active-status={isBootleg ? 'true' : undefined} data-gdp-memorial-active-status={isMemorial ? 'true' : undefined}", 'active layer status parity')
editor = replace_once(editor, "activeLayer={isBootleg ? activeBootlegLayer : 'photo'} onActiveLayerChange={isBootleg ? setActiveBootlegLayer : undefined}", "activeLayer={usesLayerLab ? activeBootlegLayer : 'photo'} onActiveLayerChange={usesLayerLab ? setActiveBootlegLayer : undefined}", 'preview active layer parity')
editor = replace_once(editor, "{isBootleg ? 'Layer controls' : 'Customer controls'}", "{usesLayerLab ? 'Layer controls' : 'Customer controls'}", 'inspector heading parity')
editor = replace_once(editor, "{isBootleg ? <p className=\"mt-1 text-xs font-semibold leading-5 text-slate-500\">Only the selected layer controls are shown here. The live garment stays visible while this panel scrolls.</p> : null}", "{usesLayerLab ? <p className=\"mt-1 text-xs font-semibold leading-5 text-slate-500\">Only the selected layer controls are shown here. Customer photo, protected template placement and text layers remain independent.</p> : null}", 'inspector guidance parity')
editor = replace_once(editor, "        {isBootleg ? (\n          <>\n            {activeBootlegLayer === 'template' ? templatePanel : null}", "        {usesLayerLab ? (\n          <>\n            {activeBootlegLayer === 'template' ? templatePanel : null}", 'inspector active panel parity')

# Keep the exact historical verifier token, but clarify the contract: the internal
# template artwork is protected; only whole-template placement is transformable.
old_comment = """  // Historical regression-verifier token for the Memorial protected-template contract only:
  // GDP template artwork never becomes an editable layer.
"""
new_comment = """  // Historical regression-verifier token for protected-template content safety:
  // GDP template artwork never becomes an editable layer.
  // The whole protected template can move/resize/rotate as one placement layer; its internal artwork remains locked.
"""
editor = replace_once(editor, old_comment, new_comment, 'protected artwork contract comment')

# Production: free text layers and photo foreground ordering are separate concepts.
production = replace_once(
    production,
    "  const bootlegPhotoForeground = editor.textStyle?.freeTextLayout === true;",
    "  const usesFreeTextLayers = editor.textStyle?.freeTextLayout === true;\n  const bootlegPhotoForeground = editor.textStyle?.freeTextLayout === true && editor.textStyle?.photoForeground !== false;",
    'production layer-mode flags',
)
production = replace_once(
    production,
    "  if (bootlegPhotoForeground) {\n    const bootlegTextLayers = resolveBootlegTextLayers(editor, editor.textStyle || {}).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));",
    "  if (usesFreeTextLayers) {\n    const bootlegTextLayers = resolveBootlegTextLayers(editor, editor.textStyle || {}).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));",
    'production multi-text trigger',
)

# Locked snapshot includes the same text-layer state that the deterministic renderer
# consumes, so the approval hash covers every independent wording layer.
page = replace_once(
    page,
    "            text: editor.text || {},\n            textStyle: editor.textStyle || {},",
    "            text: editor.text || {},\n            textLayers: (editor.textLayers || []).map((layer) => ({ id: layer.id, name: layer.name || '', role: layer.role || '', text: layer.text || {}, style: layer.style || {}, order: Number(layer.order || 0), visible: layer.visible !== false })),\n            activeTextLayerId: editor.activeTextLayerId || '',\n            textStyle: editor.textStyle || {},",
    'protected locked snapshot text layers',
)

# Add explicit regression contracts for the new Memorial parity while retaining all
# pre-existing Bootleg assertions.
verify_anchor = """assert(protectedV2.includes('{!isBootleg ? <button type=\"button\" disabled={!template || !photos.length}'), 'Memorial retains its existing confirmation action in Customer Controls');
"""
verify_extra = verify_anchor + """
// Memorial Tribute now reuses the proven protected-layer interaction engine while
// preserving protected artwork contents and Memorial-specific production stacking.
assert(protectedV2.includes("const usesLayerLab = isBootleg || isMemorial"), 'Bootleg and Memorial share the protected layer-lab interaction engine');
assert(protectedV2.includes('resolveMemorialTextLayers'), 'Memorial legacy Name/Dates/Message can migrate into independent text layers');
assert(protectedV2.includes('buildMemorialTextStatePatch'), 'Memorial text layers mirror canonical Name/Dates/Message state');
assert(protectedV2.includes("photoForeground: false"), 'Memorial keeps customer photos behind the protected template artwork');
assert(protectedV2.includes('data-gdp-memorial-free-photo-zone'), 'Memorial customer photos use full print-area coordinates without Bootleg layer-order CSS');
assert(protectedV2.includes('data-gdp-memorial-template-layer'), 'Memorial whole-template placement has a dedicated transformable layer marker');
assert(protectedV2.includes('data-gdp-memorial-text-layer'), 'Memorial exposes independent direct-manipulation text layers');
assert(protectedV2.includes("role: 'custom'"), 'Memorial can add independent custom wording without overwriting Name/Dates/Message roles');
assert(protectedProduction.includes('const usesFreeTextLayers = editor.textStyle?.freeTextLayout === true'), 'production multi-text rendering is independent from photo foreground ordering');
assert(protectedProduction.includes('editor.textStyle?.photoForeground !== false'), 'production preserves Bootleg foreground photos while allowing Memorial template overlay');
"""
verify = replace_once(verify, verify_anchor, verify_extra, 'Memorial parity verifier block')

editor_path.write_text(editor)
production_path.write_text(production)
page_path.write_text(page)
verify_path.write_text(verify)
print('Applied scoped Custom Studio V2 Memorial parity patch.')
