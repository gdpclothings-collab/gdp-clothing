import fs from 'node:fs';

const editorPath = 'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx';
const productionPath = 'src/lib/customStudioV2ProtectedProduction.js';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let editor = fs.readFileSync(editorPath, 'utf8');
let production = fs.readFileSync(productionPath, 'utf8');

const bootlegPhotoHelpers = `
function resolvePhotoCanvasPosition(transform = {}, zone = {}) {
  const directX = Number(transform?.canvasX);
  const directY = Number(transform?.canvasY);
  if (Number.isFinite(directX) && Number.isFinite(directY)) {
    return { x: clamp(directX, 0, 100), y: clamp(directY, 0, 100) };
  }
  const zoneX = Number(zone?.x ?? 15);
  const zoneY = Number(zone?.y ?? 12);
  const zoneWidth = Number(zone?.width ?? 70);
  const zoneHeight = Number(zone?.height ?? 68);
  return {
    x: clamp(zoneX + zoneWidth / 2 + (clamp(transform?.x || 0, -48, 48) / 100) * zoneWidth, 0, 100),
    y: clamp(zoneY + zoneHeight / 2 + (clamp(transform?.y || 0, -48, 48) / 100) * zoneHeight, 0, 100),
  };
}

function BootlegPhotoLayer({ layer, selected, canvasRef, zone, onSelect, onTransform }) {
  const position = resolvePhotoCanvasPosition(layer.transform || {}, zone);
  const gesture = useTouchTransformV2({
    transform: {
      ...(layer.transform || {}),
      x: position.x - 50,
      y: position.y - 50,
    },
    onChange: (next) => onTransform({
      ...(layer.transform || {}),
      scale: next.scale,
      rotation: next.rotation,
      canvasX: clamp(next.x + 50, 0, 100),
      canvasY: clamp(next.y + 50, 0, 100),
    }),
    containerRef: canvasRef,
    enabled: selected,
    minScale: 30,
    maxScale: 220,
    minX: -50,
    maxX: 50,
    minY: -50,
    maxY: 50,
  });
  const transform = layer.transform || {};
  const radius = zone?.shape === 'circle' || zone?.shape === 'oval' ? '50%' : `${Number(zone?.radius || 0)}%`;
  return (
    <div
      {...gesture}
      data-gdp-bootleg-free-photo-layer="true"
      onPointerDown={(event) => { onSelect(); gesture.onPointerDown(event); }}
      className={`absolute origin-center overflow-hidden select-none ${selected ? 'cursor-grab ring-2 ring-cyan-400/90' : 'pointer-events-none'}`}
      style={{
        ...gesture.style,
        zIndex: 5 + Number(layer.order || 0),
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${Math.max(1, Number(zone?.width ?? 70))}%`,
        height: `${Math.max(1, Number(zone?.height ?? 68))}%`,
        borderRadius: radius,
        transform: `translate(-50%, -50%) scale(${clamp(transform.scale, 30, 220) / 100}) rotate(${clamp(transform.rotation, -180, 180)}deg)`,
      }}
    >
      <img src={layer.asset?.url} alt="Customer photo layer" draggable="false" className="h-full w-full select-none object-cover" />
    </div>
  );
}

`;

editor = replaceOnce(
  editor,
  'function StickerLayer({ layer, selected, sticker, canvasRef, onSelect, onTransform }) {',
  bootlegPhotoHelpers + 'function StickerLayer({ layer, selected, sticker, canvasRef, onSelect, onTransform }) {',
  'insert free-canvas Photo Bootleg layer'
);

editor = replaceOnce(
  editor,
  "  const textYSlider = isBootleg && textLayout && textAnchorRanges ? bootlegAnchorToSlider(textLayout.centerY, textAnchorRanges.y) : 50;\n",
  "  const textYSlider = isBootleg && textLayout && textAnchorRanges ? bootlegAnchorToSlider(textLayout.centerY, textAnchorRanges.y) : 50;\n  const activePhotoCanvasPosition = isBootleg && activePhoto ? resolvePhotoCanvasPosition(activePhoto.transform || {}, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 }) : null;\n",
  'derive active Bootleg photo print-area position'
);

const oldPatchActivePhoto = `  const patchActivePhotoTransform = (patch) => {
    if (!activePhoto) return;
    if (isBootleg) setActiveBootlegLayer('photo');
    syncPhotos(photos.map((layer) => layer.id === activePhoto.id ? { ...layer, transform: { ...layer.transform, ...patch } } : layer), activePhoto.id);
  };
`;

const newPatchActivePhoto = `  const patchActivePhotoTransform = (patch) => {
    if (!activePhoto) return;
    if (isBootleg) setActiveBootlegLayer('photo');
    syncPhotos(photos.map((layer) => {
      if (layer.id !== activePhoto.id) return layer;
      const nextTransform = { ...layer.transform, ...patch };
      if (isBootleg) {
        const position = resolvePhotoCanvasPosition(nextTransform, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 });
        if (!Number.isFinite(Number(nextTransform.canvasX))) nextTransform.canvasX = position.x;
        if (!Number.isFinite(Number(nextTransform.canvasY))) nextTransform.canvasY = position.y;
      }
      return { ...layer, transform: nextTransform };
    }), activePhoto.id);
  };
`;

editor = replaceOnce(editor, oldPatchActivePhoto, newPatchActivePhoto, 'persist free-canvas photo coordinates');

const oldDuplicate = "    const duplicate = { ...activePhoto, id: v2LayerId('photo'), transform: { ...activePhoto.transform, x: clamp(Number(activePhoto.transform?.x || 0) + 8, -48, 48), y: clamp(Number(activePhoto.transform?.y || 0) + 8, -48, 48) } };\n";
const newDuplicate = `    const duplicatePosition = resolvePhotoCanvasPosition(activePhoto.transform || {}, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 });
    const duplicateTransform = isBootleg
      ? { ...activePhoto.transform, canvasX: clamp(duplicatePosition.x + 4, 0, 100), canvasY: clamp(duplicatePosition.y + 4, 0, 100) }
      : { ...activePhoto.transform, x: clamp(Number(activePhoto.transform?.x || 0) + 8, -48, 48), y: clamp(Number(activePhoto.transform?.y || 0) + 8, -48, 48) };
    const duplicate = { ...activePhoto, id: v2LayerId('photo'), transform: duplicateTransform };
`;
editor = replaceOnce(editor, oldDuplicate, newDuplicate, 'duplicate free-canvas photo position');

const oldPhotoZone = `  const photoZone = (
    <div ref={zoneRef} className="absolute overflow-hidden" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, borderRadius: radius }}>
      {photos.map((layer) => <PhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && (isBootleg ? activeLayer === 'photo' : !activeStickerId)} zoneRef={zoneRef} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}
      {!photos.length && <div className="absolute inset-0 grid place-items-center border border-dashed border-white/45 bg-slate-900/10 p-2 text-center text-[7px] font-black uppercase tracking-wider text-white/90">Photo zone</div>}
    </div>
  );
`;

const newPhotoZone = `  const photoZone = (
    <div ref={zoneRef} className="absolute overflow-hidden" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, borderRadius: radius }}>
      {photos.map((layer) => <PhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && !activeStickerId} zoneRef={zoneRef} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}
      {!photos.length && <div className="absolute inset-0 grid place-items-center border border-dashed border-white/45 bg-slate-900/10 p-2 text-center text-[7px] font-black uppercase tracking-wider text-white/90">Photo zone</div>}
    </div>
  );

  const bootlegPhotoCanvas = (
    <div data-gdp-bootleg-linked-photo-zone="true" data-gdp-bootleg-free-photo-canvas="true" className="absolute inset-0 overflow-hidden" style={{ zIndex: 10 }}>
      {photos.map((layer) => <BootlegPhotoLayer key={layer.id} layer={layer} selected={layer.id === activePhotoId && activeLayer === 'photo'} canvasRef={canvasRef} zone={zone} onSelect={() => { onActiveLayerChange?.('photo'); onPatch({ activePhotoId: layer.id, activeStickerId: '' }); }} onTransform={(transform) => patchPhotoTransform(layer.id, transform)} />)}
      {!photos.length && <div className="absolute grid place-items-center border border-dashed border-white/45 bg-slate-900/10 p-2 text-center text-[7px] font-black uppercase tracking-wider text-white/90" style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, borderRadius: radius }}>Photo zone</div>}
    </div>
  );
`;

editor = replaceOnce(editor, oldPhotoZone, newPhotoZone, 'add full-print-area Photo Bootleg canvas');

const oldLinkedRender = `          {isBootleg ? (
            <div data-gdp-bootleg-linked-photo-zone="true" className="absolute inset-0" style={{ zIndex: 10, transform: `translate(${templateTransform.x}%, ${templateTransform.y}%)` }}>
              <div className="absolute inset-0" style={{ transformOrigin: '50% 50%', transform: `scale(${templateTransform.scale / 100}) rotate(${templateTransform.rotation}deg)` }}>{photoZone}</div>
            </div>
          ) : photoZone}
`;

editor = replaceOnce(
  editor,
  oldLinkedRender,
  '          {isBootleg ? bootlegPhotoCanvas : photoZone}\n',
  'render Photo Bootleg photos on the full print canvas'
);

const oldMoveControls = `        <RangeControl label="Move left / right" value={activePhoto.transform?.x || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ x: value })} />
        <RangeControl label="Move up / down" value={activePhoto.transform?.y || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ y: value })} />
`;
const newMoveControls = `        {isBootleg ? <>
          <RangeControl label="Move photo left / right" value={activePhotoCanvasPosition?.x ?? 50} min={0} max={100} suffix="%" onChange={(value) => patchActivePhotoTransform({ canvasX: value })} />
          <RangeControl label="Move photo up / down" value={activePhotoCanvasPosition?.y ?? 50} min={0} max={100} suffix="%" onChange={(value) => patchActivePhotoTransform({ canvasY: value })} />
        </> : <>
          <RangeControl label="Move left / right" value={activePhoto.transform?.x || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ x: value })} />
          <RangeControl label="Move up / down" value={activePhoto.transform?.y || 0} min={-48} max={48} suffix="%" onChange={(value) => patchActivePhotoTransform({ y: value })} />
        </>}
`;
editor = replaceOnce(editor, oldMoveControls, newMoveControls, 'use full print-area photo movement sliders');

const oldReset = `        <button type="button" onClick={() => patchActivePhotoTransform({ scale: template?.defaultTransform?.scale || 100, rotation: 0, x: 0, y: 0 })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset selected photo</button>
`;
const newReset = `        <button type="button" onClick={() => {
          const resetTransform = { scale: template?.defaultTransform?.scale || 100, rotation: 0, x: Number(template?.defaultTransform?.offset?.x || 0), y: Number(template?.defaultTransform?.offset?.y || 0) };
          if (isBootleg) {
            const resetPosition = resolvePhotoCanvasPosition(resetTransform, template?.photoZone || { x: 15, y: 12, width: 70, height: 68 });
            patchActivePhotoTransform({ ...resetTransform, canvasX: resetPosition.x, canvasY: resetPosition.y });
          } else {
            patchActivePhotoTransform(resetTransform);
          }
        }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><RotateCcw size={14} /> Reset selected photo</button>
`;
editor = replaceOnce(editor, oldReset, newReset, 'reset Bootleg photo to its print-area start position');

editor = editor.replace(
  'Editable layer · photo zone stays linked for alignment.',
  'Editable layer · uploaded photos can move independently anywhere inside the print area.'
);
editor = editor.replace(
  'GDP template artwork is an independent editable layer. Resize, position and rotate it inside the print area; the photo zone stays linked so the frame and photo remain aligned.',
  'GDP template artwork is an independent editable layer. Resize, position and rotate it inside the print area; uploaded photos can also move independently across the printable boundary.'
);

const productionHelpers = `
function hasFreePhotoCanvasTransform(transform = {}) {
  return Number.isFinite(Number(transform?.canvasX)) && Number.isFinite(Number(transform?.canvasY));
}

function resolveFreePhotoPosition(transform = {}, zone = {}) {
  const zoneX = Number(zone?.x ?? 15);
  const zoneY = Number(zone?.y ?? 12);
  const zoneWidth = Number(zone?.width ?? 70);
  const zoneHeight = Number(zone?.height ?? 68);
  const directX = Number(transform?.canvasX);
  const directY = Number(transform?.canvasY);
  return {
    x: Number.isFinite(directX) ? clamp(directX, 0, 100) : clamp(zoneX + zoneWidth / 2 + (clamp(transform?.x || 0, -48, 48) / 100) * zoneWidth, 0, 100),
    y: Number.isFinite(directY) ? clamp(directY, 0, 100) : clamp(zoneY + zoneHeight / 2 + (clamp(transform?.y || 0, -48, 48) / 100) * zoneHeight, 0, 100),
  };
}

function clipFreePhotoShape(context, zone, width, height) {
  context.beginPath();
  if (zone?.shape === 'circle' || zone?.shape === 'oval') {
    context.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (typeof context.roundRect === 'function' && zone?.shape === 'rounded') {
    const radius = Math.min(width, height) * clamp(zone?.radius || 0, 0, 50) / 100;
    context.roundRect(-width / 2, -height / 2, width, height, radius);
  } else {
    context.rect(-width / 2, -height / 2, width, height);
  }
  context.clip();
}

function drawFreePhoto(context, loaded, zone, transform, widthPx, heightPx) {
  const boxWidth = Math.max(1, Number(zone?.width ?? 70) / 100 * widthPx);
  const boxHeight = Math.max(1, Number(zone?.height ?? 68) / 100 * heightPx);
  const position = resolveFreePhotoPosition(transform, zone);
  const centerX = position.x / 100 * widthPx;
  const centerY = position.y / 100 * heightPx;
  const userScale = clamp(transform?.scale || 100, 30, 220) / 100;
  const baseScale = Math.max(boxWidth / Math.max(1, loaded.width), boxHeight / Math.max(1, loaded.height));
  const drawWidth = loaded.width * baseScale;
  const drawHeight = loaded.height * baseScale;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(clamp(transform?.rotation || 0, -180, 180) * Math.PI / 180);
  context.scale(userScale, userScale);
  clipFreePhotoShape(context, zone, boxWidth, boxHeight);
  context.drawImage(loaded.image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

`;

production = replaceOnce(
  production,
  'function withTemplateTransform(context, widthPx, heightPx, transform = {}, draw) {',
  productionHelpers + 'function withTemplateTransform(context, widthPx, heightPx, transform = {}, draw) {',
  'insert free-canvas production photo renderer'
);

const oldDrawPhotos = `  const drawPhotos = async () => {
    for (const layer of photos) {
      const loaded = await loadImage(layer.asset?.url, 'A customer photo layer could not be reopened.');
      try {
        const drawPhoto = () => {
          output.context.save();
          const rect = clipZone(output.context, template.photoZone || {}, output.widthPx, output.heightPx);
          drawCover(output.context, loaded, rect, layer.transform || {});
          output.context.restore();
        };
        if (templateTransform) withTemplateTransform(output.context, output.widthPx, output.heightPx, templateTransform, drawPhoto);
        else drawPhoto();
      } finally { loaded.close(); }
    }
  };
`;

const newDrawPhotos = `  const drawPhotos = async () => {
    for (const layer of photos) {
      const loaded = await loadImage(layer.asset?.url, 'A customer photo layer could not be reopened.');
      try {
        if (hasFreePhotoCanvasTransform(layer.transform || {})) {
          drawFreePhoto(output.context, loaded, template.photoZone || {}, layer.transform || {}, output.widthPx, output.heightPx);
          continue;
        }
        const drawPhoto = () => {
          output.context.save();
          const rect = clipZone(output.context, template.photoZone || {}, output.widthPx, output.heightPx);
          drawCover(output.context, loaded, rect, layer.transform || {});
          output.context.restore();
        };
        if (templateTransform) withTemplateTransform(output.context, output.widthPx, output.heightPx, templateTransform, drawPhoto);
        else drawPhoto();
      } finally { loaded.close(); }
    }
  };
`;

production = replaceOnce(production, oldDrawPhotos, newDrawPhotos, 'render saved free-canvas photos at 300 DPI');

const requiredEditorTokens = [
  'data-gdp-bootleg-free-photo-canvas="true"',
  'function BootlegPhotoLayer',
  'canvasX: clamp(next.x + 50, 0, 100)',
  'Move photo left / right',
];
for (const token of requiredEditorTokens) {
  if (!editor.includes(token)) throw new Error(`Editor verification failed: ${token}`);
}
if (!production.includes('function drawFreePhoto') || !production.includes('hasFreePhotoCanvasTransform')) {
  throw new Error('Production verification failed: free-canvas renderer was not installed.');
}

fs.writeFileSync(editorPath, editor);
fs.writeFileSync(productionPath, production);
console.log('Applied full-print-area Photo Bootleg photo movement without changing Memorial photo-zone behavior.');
