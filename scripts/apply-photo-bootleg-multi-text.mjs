import fs from 'node:fs';

const componentPath = 'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx';
const productionPath = 'src/lib/customStudioV2ProtectedProduction.js';
const verifierPath = 'scripts/verify-photo-bootleg-desktop.mjs';

let component = fs.readFileSync(componentPath, 'utf8');
let production = fs.readFileSync(productionPath, 'utf8');
let verifier = fs.readFileSync(verifierPath, 'utf8');

function replaceOnce(source, label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing expected ${label} source contract.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Expected exactly one ${label} source contract.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceBetween(source, label, startToken, endToken, replacement) {
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`Missing ${label} start token.`);
  const end = source.indexOf(endToken, start);
  if (end < 0) throw new Error(`Missing ${label} end token.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const textLayerImport = `import {\n  BOOTLEG_MAX_TEXT_LAYERS,\n  buildBootlegTextStatePatch,\n  normalizeBootlegTextStyle,\n  resolveBootlegTextLayers,\n} from '@/lib/customStudioV2BootlegTextLayers';\n`;
if (!component.includes("from '@/lib/customStudioV2BootlegTextLayers'")) {
  component = replaceOnce(
    component,
    'Bootleg text layout import',
    "} from '@/lib/customStudioV2BootlegTextLayout';\n",
    "} from '@/lib/customStudioV2BootlegTextLayout';\n" + textLayerImport,
  );
}

const interactiveTextLayer = `function BootlegTextLayer({ layer, layout, canvasRef, selected, onPatchStyle }) {
  if (!layout || (!layout.headline && !layout.subline && !layout.message)) return null;
  const style = layer.style || {};
  const bounds = layout.bounds;
  const rawLimits = bootlegGestureLimits(layout);
  const canvasX = Number.isFinite(Number(style.canvasX)) ? clamp(Number(style.canvasX), 0, 100) : 50;
  const canvasY = Number.isFinite(Number(style.canvasY)) ? clamp(Number(style.canvasY), 0, 100) : 50;
  const gesture = useTouchTransformV2({
    transform: { scale: positiveScale(style.fontScale), rotation: style.rotation || 0, x: canvasX - 50, y: canvasY - 50 },
    onChange: (next) => onPatchStyle({
      ...style,
      freeTextLayout: true,
      fontScale: positiveScale(next.scale),
      rotation: next.rotation,
      canvasX: clamp(next.x + 50, 0, 100),
      canvasY: clamp(next.y + 50, 0, 100),
    }),
    containerRef: canvasRef,
    enabled: selected && Boolean(layer.text?.headline),
    minScale: 1,
    maxScale: Number.POSITIVE_INFINITY,
    minX: clamp(rawLimits.minX, -50, 50),
    maxX: clamp(rawLimits.maxX, -50, 50),
    minY: clamp(rawLimits.minY, -50, 50),
    maxY: clamp(rawLimits.maxY, -50, 50),
  });
  const common = /** @type {const} */ ({
    fill: style.color || '#ffffff',
    fontFamily: style.fontFamily || 'Arial, sans-serif',
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  });
  return (
    <div
      {...gesture}
      data-gdp-bootleg-text-layer="true"
      data-gdp-bootleg-text-layer-id={layer.id}
      className={\`absolute inset-0 z-30 \${selected ? 'cursor-grab' : 'pointer-events-none'}\`}
      style={gesture.style}
    >
      <svg viewBox={\`0 0 \${layout.width} \${layout.height}\`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={\`Editable Photo Bootleg \${layer.name || 'text'} layer\`}>
        {selected && bounds ? <rect data-gdp-bootleg-text-bounds="true" x={bounds.minX} y={bounds.minY} width={Math.max(0, bounds.maxX - bounds.minX)} height={Math.max(0, bounds.maxY - bounds.minY)} fill="none" stroke="rgb(34 211 238)" strokeWidth={Math.max(2, layout.width * 0.004)} strokeDasharray={\`\${Math.max(5, layout.width * 0.009)} \${Math.max(4, layout.width * 0.006)}\`} /> : null}
        {layout.headline?.kind === 'straight' ? (
          <text {...common} x={layout.headline.x} y={layout.headline.y} fontSize={layout.headline.fontSize} fontWeight="900" transform={\`rotate(\${layout.headline.rotation || 0} \${layout.headline.x} \${layout.headline.y})\`} style={svgTextEffect(style, layout.headline.fontSize)}>{layout.headline.text}</text>
        ) : null}
        {layout.headline?.kind === 'glyphs' ? layout.headline.glyphs.map((glyph, index) => (
          <text key={\`\${glyph.character}-\${index}\`} {...common} x={glyph.x} y={glyph.y} fontSize={glyph.fontSize} fontWeight="900" transform={\`rotate(\${glyph.rotation || 0} \${glyph.x} \${glyph.y})\`} style={svgTextEffect(style, glyph.fontSize)}>{glyph.character}</text>
        )) : null}
        {layout.subline ? <text {...common} x={layout.subline.x} y={layout.subline.y} fontSize={layout.subline.fontSize} fontWeight="700" transform={\`rotate(\${layout.subline.rotation || 0} \${layout.subline.x} \${layout.subline.y})\`} style={svgTextEffect(style, layout.subline.fontSize)}>{layout.subline.text}</text> : null}
        {layout.message ? <text {...common} x={layout.message.x} y={layout.message.y} fontSize={layout.message.fontSize} fontWeight="600" transform={\`rotate(\${layout.message.rotation || 0} \${layout.message.x} \${layout.message.y})\`} style={svgTextEffect(style, layout.message.fontSize)}>{layout.message.text}</text> : null}
      </svg>
    </div>
  );
}

`;
component = replaceBetween(component, 'Bootleg text layer component', 'function BootlegTextLayer(', 'function ProtectedPreview(', interactiveTextLayer + 'function ProtectedPreview(');

const protectedPreview = `function ProtectedPreview({ product, color, size, template, editor, path, stickers, side, onPatch, activeLayer = 'photo', onActiveLayerChange }) {
  const zoneRef = useRef(null);
  const canvasRef = useRef(null);
  const isBootleg = path === 'bootleg';
  const zone = template?.photoZone || { x: 15, y: 12, width: 70, height: 68, radius: 12, shape: 'rounded' };
  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16, align: 'center' };
  const photos = currentPhotoLayers(editor).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activePhotoId = editor.activePhotoId || photos.at(-1)?.id || '';
  const stickerLayers = (editor.stickers || []).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const activeStickerId = editor.activeStickerId || '';
  const fallbackTextStyle = defaultV2TextStyle(path);
  const legacyStyle = { ...fallbackTextStyle, ...(editor.textStyle || {}) };
  const bootlegTextLayers = isBootleg
    ? resolveBootlegTextLayers(editor, fallbackTextStyle).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    : [];
  const activeTextLayerId = editor.activeTextLayerId || bootlegTextLayers.at(-1)?.id || '';
  const radius = zone.shape === 'circle' || zone.shape === 'oval' ? '50%' : \`\${Number(zone.radius || 0)}%\`;
  const stickerById = Object.fromEntries(stickers.map((item) => [item.id, item]));
  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side), [product, size, side]);
  const templateTransform = resolveBootlegTemplateTransform(legacyStyle);
  const templateEditing = isBootleg && activeLayer === 'template';
  const layoutWidth = 1000;
  const layoutHeight = Math.max(1, layoutWidth * Number(printGuide.heightIn || 1) / Math.max(0.01, Number(printGuide.widthIn || 1)));
  const bootlegTextLayouts = bootlegTextLayers.map((layer) => {
    const style = normalizeBootlegTextStyle(layer.style || {}, fallbackTextStyle);
    const position = resolveBootlegTextPosition(style, textZone);
    const layout = resolveBootlegTextLayout({
      text: layer.text || {},
      zone: textZone,
      style: { ...style, canvasX: position.x, canvasY: position.y },
      width: layoutWidth,
      height: layoutHeight,
    });
    return { layer: { ...layer, style }, layout };
  });

  const legacyTextGesture = useTouchTransformV2({
    transform: { scale: legacyStyle.fontScale || 100, rotation: legacyStyle.rotation || 0, x: legacyStyle.x || 0, y: legacyStyle.y || 0 },
    onChange: (next) => onPatch({ textStyle: { ...legacyStyle, fontScale: next.scale, rotation: next.rotation, x: next.x, y: next.y } }),
    containerRef: canvasRef,
    enabled: !isBootleg && Boolean(editor.text?.headline || editor.text?.subline || editor.text?.message),
    minScale: 55,
    maxScale: 180,
    minX: -42,
    maxX: 42,
    minY: -42,
    maxY: 42,
  });

  const templateGesture = useTouchTransformV2({
    transform: templateTransform,
    onChange: (next) => {
      if (!isBootleg) return;
      onPatch({ textStyle: { ...legacyStyle, freeTextLayout: true, templateTransform: { scale: clamp(next.scale, BOOTLEG_TEMPLATE_MIN_SCALE, BOOTLEG_TEMPLATE_MAX_SCALE), rotation: next.rotation, x: next.x, y: next.y } } });
    },
    containerRef: canvasRef,
    enabled: isBootleg && templateEditing && Boolean(template),
    minScale: BOOTLEG_TEMPLATE_MIN_SCALE,
    maxScale: BOOTLEG_TEMPLATE_MAX_SCALE,
    minX: -50,
    maxX: 50,
    minY: -50,
    maxY: 50,
  });

  const patchPhotoTransform = (id, transform) => {
    const next = photos.map((layer) => layer.id === id ? { ...layer, transform } : layer);
    const first = next[0] || null;
    onPatch({ photos: next, activePhotoId: id, photo: first?.asset || null, transform: first?.transform || editor.transform });
  };
  const patchStickerTransform = (id, transform) => {
    onPatch({ stickers: (editor.stickers || []).map((layer) => layer.id === id ? { ...layer, transform } : layer), activeStickerId: id });
  };
  const patchBootlegTextStyle = (id, style) => {
    const current = resolveBootlegTextLayers(editor, fallbackTextStyle);
    const next = current.map((layer) => layer.id === id ? { ...layer, style: normalizeBootlegTextStyle(style, fallbackTextStyle) } : layer);
    onPatch(buildBootlegTextStatePatch(editor, next, id, fallbackTextStyle));
  };

  const textTransform = \`translate(\${clamp(legacyStyle.x, -42, 42)}%, \${clamp(legacyStyle.y, -42, 42)}%) rotate(\${clamp(legacyStyle.rotation, -25, 25)}deg)\`;
  const textBlockStyle = { left: \`\${textZone.x}%\`, top: \`\${textZone.y}%\`, width: \`\${textZone.width}%\`, height: \`\${textZone.height}%\` };
  const fontScale = clamp(legacyStyle.fontScale, 55, 180);
  const headline = String(editor.text?.headline || '').trim();

  const photoZone = (
    <div ref={zoneRef} className="absolute overflow-hidden" style={{ left: \`\${zone.x}%\`, top: \`\${zone.y}%\`, width: \`\${zone.width}%\`, height: \`\${zone.height}%\`, borderRadius: radius }}>
      {photos.map((layer) => <PhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && (isBootleg ? activeLayer === 'photo' : !activeStickerId)} zoneRef={zoneRef} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}
      {!photos.length && <div className="absolute inset-0 grid place-items-center border border-dashed border-white/45 bg-slate-900/10 p-2 text-center text-[7px] font-black uppercase tracking-wider text-white/90">Photo zone</div>}
    </div>
  );

  return (
    <div
      data-gdp-bootleg-preview-canvas={isBootleg ? 'viewport-fit' : undefined}
      className="mx-auto w-full max-w-[620px] rounded-[28px] bg-slate-100 p-3 sm:p-5"
      style={isBootleg ? { maxWidth: 'min(620px, calc((100dvh - 16rem) * 0.8))' } : undefined}
    >
      <div className="relative mx-auto aspect-[4/5] overflow-hidden rounded-2xl bg-white shadow-inner">
        {garmentPreview ? <img src={garmentPreview} alt={\`\${product.name} \${side} preview\`} className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={\`\${product?.name || 'Garment'} \${side} silhouette\`} />}
        <div ref={canvasRef} data-gdp-print-guide="true" aria-label={\`Recommended \${side} print area \${printGuide.label}\`} className="absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-lg border border-dashed border-slate-400/70 bg-white/10" style={printGuide.style}>
          <span className="pointer-events-none absolute right-1 top-1 z-50 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[8px] font-black tracking-wide text-white">{printGuide.label}</span>

          {isBootleg ? (
            <div data-gdp-bootleg-linked-photo-zone="true" className="absolute inset-0" style={{ zIndex: 10, transform: \`translate(\${templateTransform.x}%, \${templateTransform.y}%)\` }}>
              <div className="absolute inset-0" style={{ transformOrigin: '50% 50%', transform: \`scale(\${templateTransform.scale / 100}) rotate(\${templateTransform.rotation}deg)\` }}>{photoZone}</div>
            </div>
          ) : photoZone}

          {template?.assetUrl ? (
            isBootleg ? (
              <div
                {...(templateEditing ? templateGesture : {})}
                data-gdp-bootleg-template-layer="true"
                className={\`absolute inset-0 select-none \${templateEditing ? 'cursor-grab ring-2 ring-cyan-400/90 ring-inset' : 'pointer-events-none'}\`}
                style={{ ...(templateEditing ? templateGesture.style : {}), zIndex: templateEditing ? 45 : 20, transform: \`translate(\${templateTransform.x}%, \${templateTransform.y}%)\` }}
              >
                <div className="absolute inset-0" style={{ transformOrigin: '50% 50%', transform: \`scale(\${templateTransform.scale / 100}) rotate(\${templateTransform.rotation}deg)\` }}>
                  <img src={template.assetUrl} alt="GDP template artwork" draggable="false" className="absolute inset-0 h-full w-full select-none object-fill" />
                </div>
              </div>
            ) : <img src={template.assetUrl} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute inset-0 z-20 h-full w-full select-none object-fill" />
          ) : null}

          {isBootleg ? bootlegTextLayouts.map(({ layer, layout }) => <BootlegTextLayer key={layer.id} layer={layer} layout={layout} canvasRef={canvasRef} selected={activeLayer === 'text' && layer.id === activeTextLayerId} onPatchStyle={(style) => patchBootlegTextStyle(layer.id, style)} />) : null}

          {!isBootleg && (headline || editor.text?.subline || editor.text?.message) ? (
            <div {...legacyTextGesture} className="absolute z-30 flex cursor-grab flex-col justify-center px-1 text-center font-black drop-shadow-[0_2px_3px_rgba(0,0,0,.8)] ring-1 ring-transparent active:ring-cyan-400/80" style={{ ...legacyTextGesture.style, ...textBlockStyle, color: legacyStyle.color, fontFamily: legacyStyle.fontFamily, transform: textTransform, ...textEffectStyle(legacyStyle) }}>
              {headline ? <div className={\`\${legacyStyle.curve === 'straight' ? 'truncate' : 'h-[70%]'} leading-none uppercase\`} style={{ fontSize: \`\${fontScale * 0.105}px\` }}><CurvedHeadline text={headline.toUpperCase()} style={legacyStyle} /></div> : null}
              {editor.text?.subline ? <div className="truncate font-bold leading-tight">{editor.text.subline}</div> : null}
              {editor.text?.message ? <div className="mt-0.5 line-clamp-2 font-semibold leading-tight">{editor.text.message}</div> : null}
            </div>
          ) : null}

          {stickerLayers.map((layer) => <StickerLayer key={layer.id} layer={layer} selected={layer.id === activeStickerId && (isBootleg ? activeLayer === 'sticker' : true)} sticker={stickerById[layer.stickerId]} canvasRef={canvasRef} onSelect={() => { onActiveLayerChange?.('sticker'); onPatch({ activeStickerId: layer.id, activePhotoId: '' }); }} onTransform={(transform) => patchStickerTransform(layer.id, transform)} />)}
        </div>
        {!template && <div className="absolute inset-x-4 bottom-4 rounded-xl bg-slate-950/80 p-3 text-center text-xs font-bold text-white">Choose a {path === 'memorial' ? 'memorial' : 'bootleg'} template to begin.</div>}
      </div>
      {isBootleg && bootlegTextLayouts.some(({ layout }) => layout?.overflow?.any) ? <div data-gdp-bootleg-print-boundary-warning="true" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[11px] font-bold leading-4 text-amber-900"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>Part of a text layer is outside the print area. Text size is not limited, but anything outside the dashed print boundary will not be printed.</span></div> : null}
      <p className="mt-2 text-center text-[10px] font-bold text-slate-400">{isBootleg ? \`\${activeLayer === 'template' ? 'Template' : activeLayer === 'photo' ? 'Photo' : activeLayer === 'text' ? 'Text' : 'Sticker'} layer selected · \` : ''}One finger moves · two fingers pinch/rotate · {String(side || 'front').toUpperCase()} side</p>
    </div>
  );
}

`;
component = replaceBetween(component, 'Protected preview', 'function ProtectedPreview(', 'export default function ProtectedTemplateEditorV2', protectedPreview + 'export default function ProtectedTemplateEditorV2');

const oldParentTextState = `  const textStyle = { ...defaultV2TextStyle(path), ...(editor.textStyle || {}) };\n  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16 };\n  const textPosition = resolveBootlegTextPosition(textStyle, textZone);\n  const templateTransform = resolveBootlegTemplateTransform(textStyle);\n  const activeSticker = (editor.stickers || []).find((layer) => layer.id === editor.activeStickerId) || null;\n  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side), [product, size, side]);\n  const layoutWidth = 1000;\n  const layoutHeight = Math.max(1, layoutWidth * Number(printGuide.heightIn || 1) / Math.max(0.01, Number(printGuide.widthIn || 1)));\n  const textLayout = isBootleg ? resolveBootlegTextLayout({ text: editor.text || {}, zone: textZone, style: { ...textStyle, canvasX: textPosition.x, canvasY: textPosition.y }, width: layoutWidth, height: layoutHeight }) : null;\n  const textAnchorRanges = isBootleg ? resolveBootlegAnchorRanges(textLayout) : null;\n  const textXSlider = isBootleg ? bootlegAnchorToSlider(textLayout.centerX, textAnchorRanges.x) : 50;\n  const textYSlider = isBootleg ? bootlegAnchorToSlider(textLayout.centerY, textAnchorRanges.y) : 50;`;
const newParentTextState = `  const fallbackBootlegTextStyle = defaultV2TextStyle(path);\n  const legacyTextStyle = { ...fallbackBootlegTextStyle, ...(editor.textStyle || {}) };\n  const bootlegTextLayers = isBootleg ? resolveBootlegTextLayers(editor, fallbackBootlegTextStyle) : [];\n  const activeTextLayerId = editor.activeTextLayerId || bootlegTextLayers.at(-1)?.id || '';\n  const activeTextLayer = bootlegTextLayers.find((layer) => layer.id === activeTextLayerId) || bootlegTextLayers.at(-1) || null;\n  const textStyle = isBootleg ? normalizeBootlegTextStyle(activeTextLayer?.style || {}, fallbackBootlegTextStyle) : legacyTextStyle;\n  const textContent = isBootleg ? (activeTextLayer?.text || { headline: '', subline: '', message: '' }) : (editor.text || {});\n  const textZone = template?.textZone || { x: 12, y: 78, width: 76, height: 16 };\n  const textPosition = resolveBootlegTextPosition(textStyle, textZone);\n  const templateTransform = resolveBootlegTemplateTransform(legacyTextStyle);\n  const activeSticker = (editor.stickers || []).find((layer) => layer.id === editor.activeStickerId) || null;\n  const printGuide = useMemo(() => resolveStudioV2PrintGuide(product, size, side), [product, size, side]);\n  const layoutWidth = 1000;\n  const layoutHeight = Math.max(1, layoutWidth * Number(printGuide.heightIn || 1) / Math.max(0.01, Number(printGuide.widthIn || 1)));\n  const textLayout = isBootleg && activeTextLayer ? resolveBootlegTextLayout({ text: textContent, zone: textZone, style: { ...textStyle, canvasX: textPosition.x, canvasY: textPosition.y }, width: layoutWidth, height: layoutHeight }) : null;\n  const textAnchorRanges = isBootleg && textLayout ? resolveBootlegAnchorRanges(textLayout) : null;\n  const textXSlider = isBootleg && textLayout && textAnchorRanges ? bootlegAnchorToSlider(textLayout.centerX, textAnchorRanges.x) : 50;\n  const textYSlider = isBootleg && textLayout && textAnchorRanges ? bootlegAnchorToSlider(textLayout.centerY, textAnchorRanges.y) : 50;`;
component = replaceOnce(component, 'parent text state', oldParentTextState, newParentTextState);

const syncTextLayers = `  const syncTextLayers = (next, activeId = '') => {
    const latestEditor = editorRef.current || editor;
    const patch = buildBootlegTextStatePatch(latestEditor, next, activeId, fallbackBootlegTextStyle);
    editorRef.current = { ...latestEditor, ...patch };
    onPatch(patch);
  };

`;
component = replaceOnce(component, 'syncPhotos insertion', '  const syncPhotos = (next, activeId = \'\') => {', syncTextLayers + '  const syncPhotos = (next, activeId = \'\') => {');

const newTextActions = `  const patchText = (patch) => {
    if (!isBootleg) {
      onPatch({ text: { ...editor.text, ...patch } });
      return;
    }
    if (!activeTextLayer) return;
    setActiveBootlegLayer('text');
    syncTextLayers(bootlegTextLayers.map((layer) => layer.id === activeTextLayer.id ? { ...layer, text: { ...layer.text, ...patch, subline: '', message: '' } } : layer), activeTextLayer.id);
  };
  const patchTextStyle = (patch, activateText = true) => {
    if (!isBootleg) {
      onPatch({ textStyle: { ...legacyTextStyle, ...patch } });
      return;
    }
    if (!activeTextLayer) return;
    if (activateText) setActiveBootlegLayer('text');
    syncTextLayers(bootlegTextLayers.map((layer) => layer.id === activeTextLayer.id ? { ...layer, style: normalizeBootlegTextStyle({ ...layer.style, ...patch }, fallbackBootlegTextStyle) } : layer), activeTextLayer.id);
  };
  const patchTemplateTransform = (patch) => {
    if (isBootleg) setActiveBootlegLayer('template');
    const latestEditor = editorRef.current || editor;
    const nextTextStyle = { ...(latestEditor.textStyle || legacyTextStyle), freeTextLayout: true, templateTransform: { ...templateTransform, ...patch } };
    editorRef.current = { ...latestEditor, textStyle: nextTextStyle };
    onPatch({ textStyle: nextTextStyle });
  };
  const patchTextVisualPosition = (axis, value) => {
    if (!isBootleg || !activeTextLayer || !textLayout || !textAnchorRanges) return;
    const anchor = bootlegSliderToAnchor(value, textAnchorRanges[axis]);
    const canvasX = axis === 'x' ? clamp(anchor / layoutWidth * 100, 0, 100) : textPosition.x;
    const canvasY = axis === 'y' ? clamp(anchor / layoutHeight * 100, 0, 100) : textPosition.y;
    patchTextStyle({ canvasX, canvasY });
  };

  const nextTextName = () => {
    const used = new Set(bootlegTextLayers.map((layer) => layer.name));
    let index = 1;
    while (used.has(\`Text \${index}\`)) index += 1;
    return \`Text \${index}\`;
  };
  const selectTextLayer = (layer) => {
    if (!layer) return;
    setActiveBootlegLayer('text');
    syncTextLayers(bootlegTextLayers, layer.id);
  };
  const addTextLayer = () => {
    if (!isBootleg || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;
    const layer = {
      id: v2LayerId('text'),
      name: nextTextName(),
      text: { headline: '', subline: '', message: '' },
      style: normalizeBootlegTextStyle({ ...fallbackBootlegTextStyle, canvasX: 50, canvasY: clamp(50 + bootlegTextLayers.length * 5, 15, 85), fontScale: 100, rotation: 0 }, fallbackBootlegTextStyle),
      order: bootlegTextLayers.length,
      visible: true,
    };
    setActiveBootlegLayer('text');
    syncTextLayers([...bootlegTextLayers, layer], layer.id);
  };
  const duplicateActiveTextLayer = () => {
    if (!activeTextLayer || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;
    const style = normalizeBootlegTextStyle(activeTextLayer.style || {}, fallbackBootlegTextStyle);
    const duplicate = {
      ...activeTextLayer,
      id: v2LayerId('text'),
      name: nextTextName(),
      text: { ...activeTextLayer.text },
      style: { ...style, canvasX: clamp(Number(style.canvasX ?? 50) + 4, 0, 100), canvasY: clamp(Number(style.canvasY ?? 50) + 4, 0, 100) },
      order: bootlegTextLayers.length,
    };
    setActiveBootlegLayer('text');
    syncTextLayers([...bootlegTextLayers, duplicate], duplicate.id);
  };
  const deleteActiveTextLayer = () => {
    if (!activeTextLayer) return;
    const index = bootlegTextLayers.findIndex((layer) => layer.id === activeTextLayer.id);
    const remaining = bootlegTextLayers.filter((layer) => layer.id !== activeTextLayer.id);
    const nextActive = remaining[Math.max(0, index - 1)] || remaining[0] || null;
    syncTextLayers(remaining, nextActive?.id || '');
    setActiveBootlegLayer('text');
  };

`;
component = replaceBetween(component, 'text patch actions', '  const patchText = (patch) => {', '  const addSticker = (sticker) => {', newTextActions + '  const addSticker = (sticker) => {');

component = replaceOnce(
  component,
  'active text layer summary',
  "        ? `Editing Text — ${String(editor.text?.headline || 'your text').slice(0, 28)}`",
  "        ? `Editing Text — ${activeTextLayer?.name || 'add text'}${activeTextLayer?.text?.headline ? ` · ${String(activeTextLayer.text.headline).slice(0, 22)}` : ''}`",
);

const multiTextPanel = `  const textPanel = isBootleg ? (
    <div data-gdp-bootleg-panel="text" data-gdp-bootleg-multi-text="true" className="space-y-3 rounded-2xl border border-slate-100 p-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Text</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{bootlegTextLayers.length} / {BOOTLEG_MAX_TEXT_LAYERS} text layers</p></div>
        <button type="button" onClick={addTextLayer} disabled={bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS} className="min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">+ Add Text</button>
      </div>
      <p className="text-[10px] font-semibold leading-4 text-slate-400">Only the active text layer can move, resize or rotate on the print area.</p>
      {bootlegTextLayers.length ? <div data-gdp-bootleg-text-layer-list="true" className="space-y-2">{bootlegTextLayers.map((layer, index) => {
        const selected = layer.id === activeTextLayer?.id;
        return <div key={layer.id} className={\`flex items-center gap-1 rounded-xl border p-1 \${selected ? 'border-slate-900 bg-slate-900' : 'border-slate-200 bg-white'}\`}><button type="button" onClick={() => selectTextLayer(layer)} className={\`min-h-10 min-w-0 flex-1 rounded-lg px-2 text-left text-xs font-black \${selected ? 'text-white' : 'text-slate-700'}\`}><span className="block truncate">{layer.name || \`Text \${index + 1}\`}</span><span className={\`block truncate text-[10px] font-semibold \${selected ? 'text-white/60' : 'text-slate-400'}\`}>{layer.text?.headline || 'Empty text'}</span></button><button type="button" onClick={() => { selectTextLayer(layer); setTimeout(() => {}, 0); }} className="hidden" aria-hidden="true" tabIndex={-1}>Select</button>{selected ? <><button type="button" onClick={duplicateActiveTextLayer} disabled={bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white disabled:opacity-30" aria-label="Duplicate selected text layer"><Copy size={14} /></button><button type="button" onClick={deleteActiveTextLayer} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-red-200" aria-label="Delete selected text layer"><Trash2 size={14} /></button></> : null}</div>;
      })}</div> : <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500"><p>No text added yet.</p><button type="button" onClick={addTextLayer} className="mt-2 min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-black text-white">+ Add Text</button></div>}
      {bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS ? <p className="text-[10px] font-bold text-amber-700">Maximum {BOOTLEG_MAX_TEXT_LAYERS} text layers.</p> : null}
      {activeTextLayer ? <div className="space-y-2 rounded-2xl bg-slate-50 p-3" data-gdp-bootleg-active-text-editor="true">
        <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Selected text</p><p className="text-xs font-black text-slate-700">{activeTextLayer.name}</p></div><span className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-black text-white">Text layer active</span></div>
        <label className="block text-xs font-black text-slate-600">Your Text<input value={activeTextLayer.text?.headline || ''} onFocus={() => setActiveBootlegLayer('text')} onChange={(event) => patchText({ headline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
        <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Font<select value={textStyle.fontFamily} onChange={(event) => patchTextStyle({ fontFamily: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_FONT_PRESETS.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Curve<select value={textStyle.curve} onChange={(event) => patchTextStyle({ curve: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_CURVES.map((curve) => <option key={curve.id} value={curve.id}>{curve.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Effect<select value={textStyle.effect} onChange={(event) => patchTextStyle({ effect: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Color<input type="color" value={textStyle.color || '#ffffff'} onChange={(event) => patchTextStyle({ color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label></div>
        <UnboundedTextSizeControl value={textStyle.fontScale} onChange={(value) => patchTextStyle({ fontScale: value })} />
        <RangeControl label="Move text left / right" value={textXSlider} min={0} max={100} suffix="%" onChange={(value) => patchTextVisualPosition('x', value)} />
        <RangeControl label="Move text up / down" value={textYSlider} min={0} max={100} suffix="%" onChange={(value) => patchTextVisualPosition('y', value)} />
        {textLayout?.overflow?.any ? <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] font-bold leading-4 text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> Text size remains unlimited. Reposition it or reduce its size if you want every visible letter inside the printable boundary.</div> : null}
        <RangeControl label="Text rotation" value={textStyle.rotation || 0} min={-180} max={180} suffix="°" onChange={(value) => patchTextStyle({ rotation: value })} />
        {textStyle.curve !== 'straight' ? <RangeControl label="Curve amount" value={textStyle.curveAmount} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ curveAmount: value })} /> : null}
      </div> : null}
    </div>
  ) : (
    <div className="space-y-2 rounded-2xl border border-slate-100 p-3">
      <div className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Text</div>
      <label className="block text-xs font-black text-slate-600">Name<input value={editor.text?.headline || ''} onChange={(event) => patchText({ headline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <label className="block text-xs font-black text-slate-600">Dates<input value={editor.text?.subline || ''} onChange={(event) => patchText({ subline: event.target.value })} maxLength={80} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <label className="block text-xs font-black text-slate-600">Message<textarea value={editor.text?.message || ''} onChange={(event) => patchText({ message: event.target.value })} maxLength={180} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-500" /></label>
      <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Font<select value={textStyle.fontFamily} onChange={(event) => patchTextStyle({ fontFamily: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_FONT_PRESETS.map((font) => <option key={font.id} value={font.family}>{font.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Curve<select value={textStyle.curve} onChange={(event) => patchTextStyle({ curve: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_CURVES.map((curve) => <option key={curve.id} value={curve.id}>{curve.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Effect<select value={textStyle.effect} onChange={(event) => patchTextStyle({ effect: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold">{V2_TEXT_EFFECTS.map((effect) => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><label className="text-xs font-black text-slate-600">Color<input type="color" value={textStyle.color || '#ffffff'} onChange={(event) => patchTextStyle({ color: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white p-1" /></label></div>
      <RangeControl label="Text size" value={textStyle.fontScale} min={55} max={180} suffix="%" onChange={(value) => patchTextStyle({ fontScale: value })} />
      <RangeControl label="Move text left / right" value={textStyle.x || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ x: value })} />
      <RangeControl label="Move text up / down" value={textStyle.y || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ y: value })} />
      <RangeControl label="Text rotation" value={textStyle.rotation || 0} min={-25} max={25} suffix="°" onChange={(value) => patchTextStyle({ rotation: value })} />
      {textStyle.curve !== 'straight' ? <RangeControl label="Curve amount" value={textStyle.curveAmount} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ curveAmount: value })} /> : null}
    </div>
  );

`;
component = replaceBetween(component, 'text panel', '  const textPanel = (', '  const stickerPanel =', multiTextPanel + '  const stickerPanel =');

if (!component.includes('data-gdp-bootleg-multi-text="true"')) throw new Error('Multi-text panel was not applied.');
if (!component.includes('BOOTLEG_MAX_TEXT_LAYERS')) throw new Error('Multi-text cap is not wired into the editor.');

const productionImport = "import { resolveBootlegTextLayers } from '@/lib/customStudioV2BootlegTextLayers';\n";
if (!production.includes("from '@/lib/customStudioV2BootlegTextLayers'")) {
  production = productionImport + production;
}
const oldProductionText = `  drawStyledText(output.context, editor.text || {}, template.textZone || {}, editor.textStyle || {}, output.widthPx, output.heightPx);`;
const newProductionText = `  if (bootlegPhotoForeground) {\n    const bootlegTextLayers = resolveBootlegTextLayers(editor, editor.textStyle || {}).filter((layer) => layer.visible !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));\n    for (const layer of bootlegTextLayers) {\n      drawStyledText(output.context, layer.text || {}, template.textZone || {}, layer.style || {}, output.widthPx, output.heightPx);\n    }\n  } else {\n    drawStyledText(output.context, editor.text || {}, template.textZone || {}, editor.textStyle || {}, output.widthPx, output.heightPx);\n  }`;
production = replaceOnce(production, 'production text rendering', oldProductionText, newProductionText);

if (!verifier.includes("customStudioV2BootlegTextLayers.js")) {
  verifier = replaceOnce(
    verifier,
    'verifier imports',
    "} from '../src/lib/customStudioV2BootlegTextLayout.js';\n",
    "} from '../src/lib/customStudioV2BootlegTextLayout.js';\nimport { BOOTLEG_MAX_TEXT_LAYERS, buildBootlegTextStatePatch, resolveBootlegTextLayers } from '../src/lib/customStudioV2BootlegTextLayers.js';\n",
  );
}

const verifierAnchor = `assert(protectedV2.includes("photos.length ? 'Add another photo' : 'Add first photo'"), 'photo add action clearly distinguishes first and additional photos');`;
if (!verifier.includes(verifierAnchor)) throw new Error('Missing multi-text verifier anchor.');
const staticAssertions = `
assert(protectedV2.includes('data-gdp-bootleg-multi-text="true"'), 'Photo Bootleg exposes the dedicated multi-text panel');
assert(protectedV2.includes('data-gdp-bootleg-text-layer-list="true"'), 'Photo Bootleg exposes an explicit text-layer list');
assert(protectedV2.includes('+ Add Text'), 'Photo Bootleg exposes an Add Text action');
assert(protectedV2.includes('duplicateActiveTextLayer'), 'Photo Bootleg supports independent text duplication');
assert(protectedV2.includes('deleteActiveTextLayer'), 'Photo Bootleg supports independent text deletion');
assert(protectedV2.includes('activeTextLayerId'), 'Photo Bootleg persists an active text layer id');
assert(protectedV2.includes('buildBootlegTextStatePatch'), 'Photo Bootleg mirrors active text into legacy fields for backward compatibility');
assert(protectedProduction.includes('resolveBootlegTextLayers'), '300-DPI renderer resolves the same Bootleg multi-text model');
assert(protectedProduction.includes('for (const layer of bootlegTextLayers)'), '300-DPI renderer prints every visible Bootleg text layer');`;
if (!verifier.includes('Photo Bootleg exposes the dedicated multi-text panel')) {
  verifier = verifier.replace(verifierAnchor, verifierAnchor + staticAssertions);
}

const runtimeAnchor = '// Runtime geometry checks: no missing glyphs at the large sizes shown in the recording.';
if (!verifier.includes(runtimeAnchor)) throw new Error('Missing multi-text runtime anchor.');
const runtimeChecks = `// Multi-text compatibility/runtime state checks.\nconst legacyTextLayers = resolveBootlegTextLayers({ text: { headline: 'LEGACY' }, textStyle: { fontScale: 140, canvasX: 42, canvasY: 61 } }, { fontScale: 100, canvasX: 50, canvasY: 50 });\nassert(legacyTextLayers.length === 1 && legacyTextLayers[0].name === 'Text 1' && legacyTextLayers[0].text.headline === 'LEGACY', 'legacy single-text Bootleg designs migrate to Text 1 without losing content');\nassert(resolveBootlegTextLayers({ textLayers: [] }, {}).length === 0, 'an explicitly empty multi-text design remains a valid zero-text state');\nconst sampleLayers = Array.from({ length: 10 }, (_, index) => ({ id: \`t-\${index}\`, name: \`Text \${index + 1}\`, text: { headline: \`Layer \${index + 1}\` }, style: { fontScale: 100 + index, canvasX: 40 + index, canvasY: 50 } }));\nconst samplePatch = buildBootlegTextStatePatch({ textStyle: { templateTransform: { scale: 120, x: 3, y: 4, rotation: 5 } } }, sampleLayers, 't-1', { fontScale: 100 });\nassert(samplePatch.textLayers.length === BOOTLEG_MAX_TEXT_LAYERS, 'multi-text state enforces the eight-layer safety cap');\nassert(samplePatch.activeTextLayerId === 't-1' && samplePatch.text.headline === 'Layer 2' && samplePatch.textStyle.fontScale === 101, 'active text layer mirrors into legacy text/textStyle fields');\nassert(samplePatch.textStyle.templateTransform?.scale === 120, 'multi-text state preserves the independent GDP template transform');\n\n`;
if (!verifier.includes('legacy single-text Bootleg designs migrate to Text 1')) {
  verifier = verifier.replace(runtimeAnchor, runtimeChecks + runtimeAnchor);
}

fs.writeFileSync(componentPath, component);
fs.writeFileSync(productionPath, production);
fs.writeFileSync(verifierPath, verifier);
console.log('Applied guarded Photo Bootleg multi-text implementation.');
