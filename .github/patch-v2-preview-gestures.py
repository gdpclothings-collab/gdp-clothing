from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)


# Protected editor: side-aware garment preview and direct text gesture.
path = Path('src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx')
text = path.read_text()
text = replace_once(
    text,
    "import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';",
    "import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';\nimport { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';",
    'protected preview import',
)
text = replace_once(
    text,
    "function ProtectedPreview({ product, template, editor, path, stickers, side, onPatch }) {",
    "function ProtectedPreview({ product, color, template, editor, path, stickers, side, onPatch }) {",
    'protected preview signature',
)
anchor = "  const stickerById = Object.fromEntries(stickers.map((item) => [item.id, item]));\n"
insert = """  const garmentPreview = studioV2GarmentPreview(product, color, side);
  const textGesture = useTouchTransformV2({
    transform: { scale: style.fontScale || 100, rotation: style.rotation || 0, x: style.x || 0, y: style.y || 0 },
    onChange: (next) => onPatch({ textStyle: { ...style, fontScale: next.scale, rotation: next.rotation, x: next.x, y: next.y } }),
    containerRef: canvasRef,
    enabled: Boolean(editor.text?.headline || editor.text?.subline || editor.text?.message),
    minScale: 55,
    maxScale: 180,
    minX: -42,
    maxX: 42,
    minY: -42,
    maxY: 42,
  });
"""
text = replace_once(text, anchor, anchor + insert, 'protected preview setup')
old = "{product?.images?.[0] ? <img src={product.images[0]} alt={`${product.name} ${side} preview`} className=\"absolute inset-0 h-full w-full object-contain\" /> : null}"
new = "{garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className=\"absolute inset-0 h-full w-full object-contain\" /> : <div className=\"absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80\" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}"
text = replace_once(text, old, new, 'protected garment image')
old = '''            <div className="pointer-events-none absolute z-30 flex flex-col justify-center px-1 text-center font-black drop-shadow-[0_2px_3px_rgba(0,0,0,.8)]" style={{ left: `${textZone.x}%`, top: `${textZone.y}%`, width: `${textZone.width}%`, height: `${textZone.height}%`, color: style.color, fontFamily: style.fontFamily, transform: textTransform, ...textEffectStyle(style) }}>'''
new = '''            <div {...textGesture} className="absolute z-30 flex cursor-grab flex-col justify-center px-1 text-center font-black drop-shadow-[0_2px_3px_rgba(0,0,0,.8)] ring-1 ring-transparent active:ring-cyan-400/80" style={{ ...textGesture.style, left: `${textZone.x}%`, top: `${textZone.y}%`, width: `${textZone.width}%`, height: `${textZone.height}%`, color: style.color, fontFamily: style.fontFamily, transform: textTransform, ...textEffectStyle(style) }}>'''
text = replace_once(text, old, new, 'protected text gesture')
text = replace_once(
    text,
    "export default function ProtectedTemplateEditorV2({ path, product, settings, editor, side = 'front', onPatch, onConfirmedChange }) {",
    "export default function ProtectedTemplateEditorV2({ path, product, color, settings, editor, side = 'front', onPatch, onConfirmedChange }) {",
    'protected component signature',
)
text = replace_once(
    text,
    "<ProtectedPreview product={product} template={template}",
    "<ProtectedPreview product={product} color={color} template={template}",
    'protected preview call',
)
old = '''          <RangeControl label="Text size" value={textStyle.fontScale} min={55} max={180} suffix="%" onChange={(value) => patchTextStyle({ fontScale: value })} />{textStyle.curve !== 'straight' ? <RangeControl label="Curve amount" value={textStyle.curveAmount} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ curveAmount: value })} /> : null}
'''
new = '''          <RangeControl label="Text size" value={textStyle.fontScale} min={55} max={180} suffix="%" onChange={(value) => patchTextStyle({ fontScale: value })} />
          <RangeControl label="Move text left / right" value={textStyle.x || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ x: value })} />
          <RangeControl label="Move text up / down" value={textStyle.y || 0} min={-42} max={42} suffix="%" onChange={(value) => patchTextStyle({ y: value })} />
          <RangeControl label="Text rotation" value={textStyle.rotation || 0} min={-25} max={25} suffix="°" onChange={(value) => patchTextStyle({ rotation: value })} />
          {textStyle.curve !== 'straight' ? <RangeControl label="Curve amount" value={textStyle.curveAmount} min={0} max={100} suffix="%" onChange={(value) => patchTextStyle({ curveAmount: value })} /> : null}
'''
text = replace_once(text, old, new, 'protected text controls')
path.write_text(text)

# Upload editor: side-aware preview.
path = Path('src/components/storefront/custom-studio-v2/UploadArtworkEditorV2.jsx')
text = path.read_text()
text = replace_once(
    text,
    "import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';",
    "import useTouchTransformV2 from '@/components/storefront/custom-studio-v2/useTouchTransformV2';\nimport { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';",
    'upload preview import',
)
text = replace_once(
    text,
    "export default function UploadArtworkEditorV2({ product, side, editor, onPatch, onConfirmedChange }) {",
    "export default function UploadArtworkEditorV2({ product, color, side, editor, onPatch, onConfirmedChange }) {",
    'upload component signature',
)
anchor = "  const transform = editor.transform || { scale: 100, rotation: 0, x: 0, y: 0 };\n"
text = replace_once(text, anchor, anchor + "  const garmentPreview = studioV2GarmentPreview(product, color, side);\n", 'upload preview setup')
old = "{product?.images?.[0] ? <img src={product.images[0]} alt={`${product.name} ${side} preview`} className=\"absolute inset-0 h-full w-full object-contain\" /> : null}"
new = "{garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className=\"absolute inset-0 h-full w-full object-contain\" /> : <div className=\"absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80\" aria-label={`${product?.name || 'Garment'} ${side} silhouette`} />}"
text = replace_once(text, old, new, 'upload garment image')
path.write_text(text)

# Seasonal editor: pinch-scale/rotate + side-aware garment preview.
path = Path('src/components/storefront/custom-studio-v2/SeasonalEditorV2.jsx')
text = path.read_text()
text = replace_once(
    text,
    "import { fitSeasonalArtwork } from '@/lib/seasonalArtwork';",
    "import { fitSeasonalArtwork } from '@/lib/seasonalArtwork';\nimport { studioV2GarmentPreview } from '@/lib/customStudioV2Preview';",
    'seasonal preview import',
)
start = text.index('function ArtworkLayer(')
end = text.index('\nfunction ToolbarButton', start)
replacement = r'''function ArtworkLayer({ entry, area, active, onSelect, onTransform }) {
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  if (!entry?.artwork || !entry?.layout || !area) return null;

  const restart = () => {
    const points = [...pointers.current.values()];
    const currentWidth = Number(entry.layout.width || 1);
    const currentHeight = Number(entry.layout.height || 1);
    const center = { x: Number(entry.layout.x || 0) + currentWidth / 2, y: Number(entry.layout.y || 0) + currentHeight / 2 };
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.current = {
        mode: 'pinch',
        distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
        angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI,
        pointerCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        center,
        width: currentWidth,
        height: currentHeight,
        rotation: Number(entry.layer.rotation || 0),
      };
    } else if (points.length == 1) {
      gesture.current = { mode: 'drag', point: points[0], center, width: currentWidth, height: currentHeight };
    } else {
      gesture.current = null;
    }
  };

  const begin = (event) => {
    onSelect(entry.layer.id);
    if (entry.layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    restart();
  };

  const move = (event) => {
    if (entry.layer.locked || !pointers.current.has(event.pointerId)) return;
    event.preventDefault();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const state = gesture.current;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!state || !rect?.width || !rect?.height) return;
    const points = [...pointers.current.values()];

    if (state.mode === 'drag' && points.length === 1) {
      const point = points[0];
      const cx = state.center.x + ((point.x - state.point.x) / rect.width) * area.width;
      const cy = state.center.y + ((point.y - state.point.y) / rect.height) * area.height;
      onTransform(entry.layer.id, {
        position: {
          x: clamp(cx - state.width / 2, 0, Math.max(0, area.width - state.width)),
          y: clamp(cy - state.height / 2, 0, Math.max(0, area.height - state.height)),
        },
      });
      return;
    }

    if (state.mode === 'pinch' && points.length >= 2) {
      const [a, b] = points;
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      const pointerCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const maxWidth = Math.max(0.5, Number(entry.layout.maxWidth || area.width));
      const width = clamp(state.width * (distance / state.distance), 0.5, maxWidth);
      const height = state.height * (width / Math.max(0.01, state.width));
      const cx = state.center.x + ((pointerCenter.x - state.pointerCenter.x) / rect.width) * area.width;
      const cy = state.center.y + ((pointerCenter.y - state.pointerCenter.y) / rect.height) * area.height;
      let rotation = state.rotation + (angle - state.angle);
      while (rotation > 180) rotation -= 360;
      while (rotation < -180) rotation += 360;
      onTransform(entry.layer.id, {
        requested: width,
        rotation,
        position: {
          x: clamp(cx - width / 2, 0, Math.max(0, area.width - width)),
          y: clamp(cy - height / 2, 0, Math.max(0, area.height - height)),
        },
      });
    }
  };

  const end = (event) => {
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
    pointers.current.delete(event.pointerId);
    restart();
  };

  return (
    <button
      type="button"
      data-seasonal-v2-layer
      aria-label={`${entry.artwork.title}${active ? ', selected' : ''}`}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`absolute touch-none select-none border-0 bg-transparent p-0 ${entry.layer.locked ? 'cursor-default' : 'cursor-move'} ${active ? 'ring-2 ring-[#D9273E] ring-offset-2' : ''}`}
      style={{
        left: `${(entry.layout.x / area.width) * 100}%`,
        top: `${(entry.layout.y / area.height) * 100}%`,
        width: `${(entry.layout.width / area.width) * 100}%`,
        height: `${(entry.layout.height / area.height) * 100}%`,
        transform: `rotate(${Number(entry.layer.rotation || 0)}deg)`,
        transformOrigin: 'center',
        zIndex: entry.order + 1,
      }}
    >
      <img src={entry.artwork.preview} alt="" draggable="false" className="pointer-events-none h-full w-full object-fill" />
    </button>
  );
}
'''
text = text[:start] + replacement + text[end:]
text = replace_once(
    text,
    "export default function SeasonalEditorV2({ product, size, layers, activeLayerId, confirmed, onLayersChange, onActiveLayerChange, onConfirmedChange }) {",
    "export default function SeasonalEditorV2({ product, color, side = 'front', size, layers, activeLayerId, confirmed, onLayersChange, onActiveLayerChange, onConfirmedChange }) {",
    'seasonal component signature',
)
anchor = "  const [category, setCategory] = useState('');\n"
text = replace_once(text, anchor, anchor + "  const garmentPreview = studioV2GarmentPreview(product, color, side);\n", 'seasonal preview setup')
text = replace_once(
    text,
    '<p className="text-sm font-bold text-slate-700">Drag artwork directly in the print area</p>',
    '<p className="text-sm font-bold text-slate-700">Drag with one finger · pinch/rotate with two fingers</p>',
    'seasonal gesture hint',
)
text = replace_once(
    text,
    '<span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 sm:inline">Front</span>',
    '<span className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase text-slate-600 sm:inline">{side}</span>',
    'seasonal side label',
)
old = '{product?.images?.[0] ? <img src={product.images[0]} alt={product.name} className="absolute inset-0 h-full w-full object-contain opacity-95" /> : null}'
new = '{garmentPreview ? <img src={garmentPreview} alt={`${product.name} ${side} preview`} className="absolute inset-0 h-full w-full object-contain opacity-95" /> : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-label={`${product?.name || \'Garment\'} ${side} silhouette`} />}'
text = replace_once(text, old, new, 'seasonal garment image')
old = '<ArtworkLayer key={entry.layer.id} entry={entry} area={area} active={entry.layer.id === activeLayerId} onSelect={onActiveLayerChange} onMove={(id, position) => patchLayer(id, { position })} />'
new = '<ArtworkLayer key={entry.layer.id} entry={entry} area={area} active={entry.layer.id === activeLayerId} onSelect={onActiveLayerChange} onTransform={(id, patch) => patchLayer(id, patch)} />'
text = replace_once(text, old, new, 'seasonal layer transform call')
path.write_text(text)

# Page passes side/color to all V2 previews.
path = Path('src/pages/CustomStudioV2.jsx')
text = path.read_text()
text = replace_once(
    text,
    "<SeasonalEditorV2 product={product} size={state.size}",
    "<SeasonalEditorV2 product={product} color={state.color} side={state.side} size={state.size}",
    'page seasonal props',
)
text = replace_once(
    text,
    "<ProtectedTemplateEditorV2 path={state.designPath} product={product} settings={settings}",
    "<ProtectedTemplateEditorV2 path={state.designPath} product={product} color={state.color} settings={settings}",
    'page protected props',
)
text = replace_once(
    text,
    "<UploadArtworkEditorV2 product={product} side={state.side}",
    "<UploadArtworkEditorV2 product={product} color={state.color} side={state.side}",
    'page upload props',
)
path.write_text(text)

# Self-clean the temporary files only after all source changes succeeded.
Path('.github/workflows/patch-v2-preview-gestures.yml').unlink(missing_ok=True)
Path('.github/patch-v2-preview-gestures.py').unlink(missing_ok=True)
