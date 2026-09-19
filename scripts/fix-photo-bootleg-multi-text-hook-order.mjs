import fs from 'node:fs';

const path = 'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx';
let source = fs.readFileSync(path, 'utf8');

const before = `function BootlegTextLayer({ layer, layout, canvasRef, selected, onPatchStyle }) {
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
  });`;

const after = `function BootlegTextLayer({ layer, layout, canvasRef, selected, onPatchStyle }) {
  const style = layer?.style || {};
  const bounds = layout?.bounds || null;
  const rawLimits = layout ? bootlegGestureLimits(layout) : { minX: -50, maxX: 50, minY: -50, maxY: 50 };
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
    enabled: selected && Boolean(layout) && Boolean(layer?.text?.headline),
    minScale: 1,
    maxScale: Number.POSITIVE_INFINITY,
    minX: clamp(rawLimits.minX, -50, 50),
    maxX: clamp(rawLimits.maxX, -50, 50),
    minY: clamp(rawLimits.minY, -50, 50),
    maxY: clamp(rawLimits.maxY, -50, 50),
  });
  if (!layout || (!layout.headline && !layout.subline && !layout.message)) return null;`;

if (!source.includes(before)) throw new Error('Expected BootlegTextLayer hook block was not found.');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Applied Photo Bootleg multi-text hook-order fix.');
