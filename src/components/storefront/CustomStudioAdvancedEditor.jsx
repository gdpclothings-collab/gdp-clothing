import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Copy,
  Crop,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Image as ImageIcon,
  Heart,
  Layers,
  Palette,
  Lock,
  Maximize2,
  Move,
  Redo2,
  RotateCcw,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
  Unlock,
  WandSparkles,
  X,
} from "lucide-react";

export const DEFAULT_EDITOR_TOOLS = {
  erase: true,
  restore: true,
  stickers: false,
  text: true,
  freeStretch: true,
  autoBackgroundRemoval: true,
  crop: true,
  adjustments: true,
  curveText: true,
  textEffects: true,
  layerControls: true,
};

export const DEFAULT_STICKER_LIBRARY = [
  { id: "star", label: "Star", glyph: "★", enabled: true, category: "shapes" },
  { id: "sparkle", label: "Sparkle", glyph: "✦", enabled: true, category: "effects" },
  { id: "cross", label: "Cross", glyph: "✝", enabled: true, category: "symbols" },
  { id: "flame", label: "Flame", glyph: "🔥", enabled: true, category: "effects" },
  { id: "halo", label: "Halo", glyph: "◯", enabled: true, category: "symbols" },
  { id: "heart", label: "Heart", glyph: "♥", enabled: true, category: "symbols" },
  { id: "lightning", label: "Lightning", glyph: "⚡", enabled: true, category: "effects" },
  { id: "grunge", label: "Grunge", glyph: "✹", enabled: true, category: "effects" },
  { id: "dove", label: "Dove", glyph: "🕊", enabled: true, category: "memorial" },
  { id: "wings", label: "Wings", glyph: "𓆩♡𓆪", enabled: true, category: "memorial" },
];

const FONT_PRESETS = [
  { label: "Impact", family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", group: "Bold" },
  { label: "Arial Black", family: "'Arial Black', Arial, sans-serif", group: "Bold" },
  { label: "Trebuchet", family: "'Trebuchet MS', sans-serif", group: "Modern" },
  { label: "Georgia", family: "Georgia, serif", group: "Memorial" },
  { label: "Times", family: "'Times New Roman', serif", group: "Classic" },
  { label: "Courier", family: "'Courier New', monospace", group: "Retro" },
  { label: "Arial", family: "Arial, Helvetica, sans-serif", group: "Clean" },
];

const TEXT_CURVES = [
  { id: "straight", label: "Straight" },
  { id: "arc-up", label: "Arc Up" },
  { id: "arc-down", label: "Arc Down" },
  { id: "wave", label: "Wave" },
  { id: "circle", label: "Circle" },
];

const TEXT_EFFECTS = [
  { id: "none", label: "None" },
  { id: "outline", label: "Outline" },
  { id: "shadow", label: "Shadow" },
  { id: "glow", label: "Glow" },
  { id: "3d", label: "3D" },
  { id: "vintage", label: "Vintage" },
];

function uid(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function angle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

function angleDelta(next, start) {
  let value = next - start;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function layerSizeBounds(layer) {
  if (layer?.type === "photo") return [10, 180];
  if (layer?.type === "text") return [8, 144];
  return [14, 140];
}

function labelForLayer(layer, index, photosById = {}) {
  if (!layer) return "Layer";
  if (layer.type === "text") return String(layer.text || `Text ${index + 1}`).slice(0, 26);
  if (layer.type === "photo") return photosById[String(layer.photoId || "")]?.name || `Photo ${index + 1}`;
  return `Sticker ${index + 1}`;
}

const EDITOR_CENTER_SNAP_THRESHOLD = 2.4;
const EDITOR_SAFE_EDGE = 7;

function snapEditorCoordinate(value) {
  const next = clamp(value, 0, 100);
  if (Math.abs(next - 50) <= EDITOR_CENTER_SNAP_THRESHOLD) return { value: 50, snapped: true };
  return { value: next, snapped: false };
}

function layerOutsideEditorSafeArea(layer) {
  if (!layer) return false;
  const x = Number(layer.x ?? 50);
  const y = Number(layer.y ?? 50);
  const oversizedPhoto = layer.type === "photo" && Number(layer.size || 62) > 135;
  return x < EDITOR_SAFE_EDGE || x > 100 - EDITOR_SAFE_EDGE || y < EDITOR_SAFE_EDGE || y > 100 - EDITOR_SAFE_EDGE || oversizedPhoto;
}

function editorTextValue(layer) {
  const raw = String(layer?.text || "YOUR TEXT");
  return layer?.textTransform === "uppercase" ? raw.toUpperCase() : raw;
}

function textShadowFor(layer) {
  const effect = layer?.effect || (layer?.shadow ? "shadow" : "none");
  const strength = clamp(layer?.effectStrength ?? 50, 0, 100) / 100;
  const color = layer?.shadowColor || "#000000";
  const offset = Math.round(2 + strength * 7);
  const blur = Math.round(2 + strength * 10);
  if (effect === "outline" || effect === "none") return "none";
  if (effect === "glow") return `0 0 ${Math.round(5 + strength * 14)}px ${layer?.glowColor || layer?.color || "#ffffff"}`;
  if (effect === "3d") return `${offset}px ${offset}px 0 ${color}, ${offset + 2}px ${offset + 2}px 0 rgba(0,0,0,.35)`;
  if (effect === "vintage") return `1px 1px 0 rgba(255,255,255,.22), ${offset}px ${offset}px ${blur}px rgba(0,0,0,.45)`;
  return `${Number(layer?.shadowX ?? 2)}px ${Number(layer?.shadowY ?? 3)}px ${Number(layer?.shadowBlur ?? blur)}px ${color}`;
}

function photoFilterFor(layer) {
  const brightness = clamp(layer?.brightness ?? 100, 25, 200);
  const contrast = clamp(layer?.contrast ?? 100, 25, 200);
  const saturation = clamp(layer?.saturation ?? 100, 0, 220);
  const warmth = clamp(layer?.warmth ?? 0, -100, 100);
  const sepia = Math.max(0, warmth) * 0.18;
  const hue = warmth < 0 ? Math.abs(warmth) * 0.12 : warmth * -0.08;
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) hue-rotate(${hue}deg)`;
}

function safeVibrate() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(8);
  } catch {
    // Haptics are an optional enhancement only.
  }
}

export function normalizeEditorTools(value = {}) {
  return { ...DEFAULT_EDITOR_TOOLS, ...(value || {}) };
}

export function normalizeStickerLibrary(value = []) {
  const custom = Array.isArray(value) ? value.filter(Boolean) : [];
  const customById = Object.fromEntries(custom.map((item) => [String(item.id || ""), item]));
  const builtIns = DEFAULT_STICKER_LIBRARY.map((base) => ({
    ...base,
    ...(customById[base.id] || {}),
    id: base.id,
    label: String(customById[base.id]?.label || base.label),
    glyph: String(customById[base.id]?.glyph || base.glyph),
    assetUrl: String(customById[base.id]?.assetUrl || ""),
    enabled: customById[base.id]?.enabled !== false,
  }));
  const extra = custom
    .filter((item) => item.id && !DEFAULT_STICKER_LIBRARY.some((base) => base.id === item.id))
    .map((item) => ({
      id: String(item.id),
      label: String(item.label || "Custom sticker"),
      glyph: String(item.glyph || "✦"),
      assetUrl: String(item.assetUrl || ""),
      enabled: item.enabled !== false,
      category: String(item.category || "custom"),
    }));
  return [...builtIns, ...extra];
}

export function createTextLayer(text = "YOUR TEXT") {
  return {
    id: uid("text"),
    type: "text",
    text,
    x: 50,
    y: 72,
    size: 28,
    rotation: 0,
    color: "#ffffff",
    fontFamily: FONT_PRESETS[0].family,
    fontWeight: 700,
    fontStyle: "normal",
    textTransform: "none",
    lineHeight: 1,
    letterSpacing: 1,
    align: "center",
    strokeWidth: 1,
    strokeColor: "#111111",
    effect: "shadow",
    effectStrength: 45,
    shadow: true,
    shadowColor: "#000000",
    shadowX: 2,
    shadowY: 3,
    shadowBlur: 5,
    glowColor: "#ffffff",
    curve: "straight",
    curveAmount: 45,
    opacity: 1,
    locked: false,
    visible: true,
  };
}

export function createStickerLayer(sticker) {
  return {
    id: uid("sticker"),
    type: "sticker",
    stickerId: sticker?.id || "sparkle",
    x: 50,
    y: 50,
    size: 34,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
  };
}

export function createPhotoLayer(photo, index = 0) {
  const offset = (Number(index || 0) % 5) - 2;
  return {
    id: uid("photo"),
    type: "photo",
    photoId: String(photo?.id || ""),
    x: clamp(50 + offset * 7, 12, 88),
    y: clamp(50 + (Number(index || 0) % 2 ? 4 : -4), 12, 88),
    size: 62,
    rotation: 0,
    opacity: 1,
    fitMode: "fit",
    cropX: 50,
    cropY: 50,
    cropZoom: 100,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    warmth: 0,
    flipX: false,
    flipY: false,
    locked: false,
    visible: true,
  };
}

function CurvedText({ layer }) {
  const text = editorTextValue(layer);
  const curve = layer.curve || "straight";
  if (curve === "straight") return <span>{text}</span>;

  const amount = clamp(layer.curveAmount ?? 45, -100, 100);
  const magnitude = Math.abs(amount) || 45;
  let path = "M 12 72 Q 150 20 288 72";
  if (curve === "arc-down") path = `M 12 42 Q 150 ${78 + magnitude * 0.38} 288 42`;
  if (curve === "arc-up") path = `M 12 92 Q 150 ${66 - magnitude * 0.46} 288 92`;
  if (curve === "wave") path = `M 10 70 C 72 ${52 - magnitude * 0.28}, 102 ${88 + magnitude * 0.18}, 150 70 C 198 ${52 - magnitude * 0.18}, 228 ${88 + magnitude * 0.28}, 290 70`;
  if (curve === "circle") path = "M 35 104 A 116 86 0 0 1 265 104";
  const pathId = `gdp-curve-${String(layer.id || "text").replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg viewBox="0 0 300 140" className="block h-auto w-full overflow-visible" aria-label={text} role="img">
      <defs><path id={pathId} d={path} /></defs>
      <text
        fill={layer.color || "#ffffff"}
        fontFamily={layer.fontFamily || FONT_PRESETS[0].family}
        fontWeight={layer.fontWeight || 700}
        fontStyle={layer.fontStyle || "normal"}
        fontSize={clamp(layer.size || 28, 8, 78)}
        letterSpacing={Number(layer.letterSpacing || 0)}
        stroke={Number(layer.strokeWidth || 0) > 0 ? (layer.strokeColor || "#111111") : "none"}
        strokeWidth={Number(layer.strokeWidth || 0)}
        paintOrder="stroke"
        style={{ filter: textShadowFor(layer) !== "none" ? `drop-shadow(${Number(layer.shadowX ?? 2)}px ${Number(layer.shadowY ?? 3)}px ${Math.max(1, Number(layer.shadowBlur ?? 4))}px ${layer.shadowColor || "#000000"})` : undefined }}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">{text}</textPath>
      </text>
    </svg>
  );
}

export function EditableOverlayLayers({
  layers = [],
  stickerLibrary = [],
  photoAssets = [],
  interactive = false,
  selectedLayerId = "",
  onSelectLayer = null,
  onPatchLayer = null,
  onDragStart = null,
}) {
  const gestureRef = useRef(null);
  const resizeRef = useRef(null);
  const lastTapRef = useRef({ id: "", at: 0 });
  const editRef = useRef(null);
  const lastSnapRef = useRef({ x: false, y: false });
  const [editingTextId, setEditingTextId] = useState("");
  const [snapGuides, setSnapGuides] = useState({ x: false, y: false });
  const [showGestureHint, setShowGestureHint] = useState(() => {
    try { return typeof window === "undefined" || window.localStorage.getItem("gdp-editor-gesture-hint-v2") !== "seen"; }
    catch { return true; }
  });

  const stickers = useMemo(
    () => Object.fromEntries(normalizeStickerLibrary(stickerLibrary).map((item) => [item.id, item])),
    [stickerLibrary]
  );
  const photosById = useMemo(
    () => Object.fromEntries((photoAssets || []).filter((item) => item?.id).map((item) => [String(item.id), item])),
    [photoAssets]
  );

  const dismissGestureHint = () => {
    if (!showGestureHint) return;
    setShowGestureHint(false);
    try { window.localStorage.setItem("gdp-editor-gesture-hint-v2", "seen"); } catch { /* optional */ }
  };

  useEffect(() => {
    if (!editingTextId) return;
    const timer = window.setTimeout(() => {
      editRef.current?.focus?.();
      editRef.current?.select?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editingTextId]);

  useEffect(() => {
    if (editingTextId && !layers.some((layer) => layer.id === editingTextId && layer.type === "text")) setEditingTextId("");
  }, [editingTextId, layers]);

  const beginGesture = (event, layer) => {
    if (!interactive || !onPatchLayer || editingTextId === layer.id || layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelectLayer?.(layer.id);

    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    const point = { x: event.clientX, y: event.clientY };
    let gesture = gestureRef.current;
    if (!gesture || gesture.id !== layer.id) {
      onDragStart?.();
      gesture = {
        id: layer.id,
        rect,
        pointers: new Map(),
        startX: Number(layer.x ?? 50),
        startY: Number(layer.y ?? 50),
        startSize: Number(layer.size || (layer.type === "photo" ? 62 : 28)),
        startRotation: Number(layer.rotation || 0),
        startPoint: point,
        startMidpoint: point,
        startDistance: 0,
        startAngle: 0,
        moved: false,
      };
      gestureRef.current = gesture;
    }

    gesture.pointers.set(event.pointerId, point);
    const points = [...gesture.pointers.values()];
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.startX = Number(layer.x ?? 50);
      gesture.startY = Number(layer.y ?? 50);
      gesture.startSize = Number(layer.size || gesture.startSize);
      gesture.startRotation = Number(layer.rotation || 0);
      gesture.startMidpoint = midpoint(a, b);
      gesture.startDistance = Math.max(1, distance(a, b));
      gesture.startAngle = angle(a, b);
    } else {
      gesture.startPoint = point;
      gesture.startMidpoint = point;
    }
  };

  const moveGesture = (event, layer) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== layer.id || !gesture.pointers.has(event.pointerId) || !onPatchLayer || layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dismissGestureHint();

    const rect = gesture.rect || event.currentTarget.parentElement?.getBoundingClientRect();
    const width = Math.max(1, rect?.width || 1);
    const height = Math.max(1, rect?.height || 1);
    const points = [...gesture.pointers.values()];
    let patch = {};

    if (points.length >= 2) {
      const [a, b] = points;
      const center = midpoint(a, b);
      const scale = distance(a, b) / Math.max(1, gesture.startDistance || distance(a, b));
      const [minSize, maxSize] = layerSizeBounds(layer);
      patch = {
        x: clamp(gesture.startX + ((center.x - gesture.startMidpoint.x) / width) * 100, 0, 100),
        y: clamp(gesture.startY + ((center.y - gesture.startMidpoint.y) / height) * 100, 0, 100),
        size: clamp(gesture.startSize * scale, minSize, maxSize),
        rotation: clamp(gesture.startRotation + angleDelta(angle(a, b), gesture.startAngle), -180, 180),
      };
    } else {
      const current = points[0];
      patch = {
        x: clamp(gesture.startX + ((current.x - gesture.startPoint.x) / width) * 100, 0, 100),
        y: clamp(gesture.startY + ((current.y - gesture.startPoint.y) / height) * 100, 0, 100),
      };
    }

    if (Object.prototype.hasOwnProperty.call(patch, "x") && Object.prototype.hasOwnProperty.call(patch, "y")) {
      const snappedX = snapEditorCoordinate(patch.x);
      const snappedY = snapEditorCoordinate(patch.y);
      patch = { ...patch, x: snappedX.value, y: snappedY.value };
      if ((snappedX.snapped && !lastSnapRef.current.x) || (snappedY.snapped && !lastSnapRef.current.y)) safeVibrate();
      lastSnapRef.current = { x: snappedX.snapped, y: snappedY.snapped };
      setSnapGuides(lastSnapRef.current);
    }

    gesture.moved = true;
    onPatchLayer(gesture.id, patch, { history: false });
  };

  const endGesture = (event, layer) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== layer.id) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const wasTap = !gesture.moved && gesture.pointers.size === 1;
    gesture.pointers.delete(event.pointerId);
    if (wasTap && event.pointerType === "touch") {
      const now = Date.now();
      if (lastTapRef.current.id === layer.id && now - lastTapRef.current.at < 360) {
        onDragStart?.();
        if (layer.type === "text") setEditingTextId(layer.id);
        if (layer.type === "photo") onPatchLayer?.(layer.id, { fitMode: "crop" });
        lastTapRef.current = { id: "", at: 0 };
      } else {
        lastTapRef.current = { id: layer.id, at: now };
      }
    }

    if (!gesture.pointers.size) {
      gestureRef.current = null;
      lastSnapRef.current = { x: false, y: false };
      setSnapGuides({ x: false, y: false });
      return;
    }
    const remaining = [...gesture.pointers.values()][0];
    gesture.startPoint = remaining;
    gesture.startMidpoint = remaining;
    gesture.startX = Number(layer.x ?? 50);
    gesture.startY = Number(layer.y ?? 50);
    gesture.startSize = Number(layer.size || gesture.startSize);
    gesture.startRotation = Number(layer.rotation || 0);
    gesture.startDistance = 0;
    gesture.moved = false;
  };

  const beginResize = (event, layer) => {
    if (!interactive || !onPatchLayer || layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelectLayer?.(layer.id);
    onDragStart?.();
    dismissGestureHint();
    const rect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    resizeRef.current = {
      id: layer.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startSize: Number(layer.size || 28),
      width: Math.max(1, rect?.width || 1),
      layerType: layer.type,
    };
  };

  const moveResize = (event) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId || !onPatchLayer) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.clientX - resize.startX + (event.clientY - resize.startY);
    const factor = resize.layerType === "photo" ? 100 / resize.width : 0.45;
    const layer = layers.find((item) => item.id === resize.id);
    const [minSize, maxSize] = layerSizeBounds(layer);
    onPatchLayer(resize.id, { size: clamp(resize.startSize + delta * factor, minSize, maxSize) }, { history: false });
  };

  const endResize = (event) => {
    if (!resizeRef.current) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    resizeRef.current = null;
  };

  const beginTextEdit = (event, layer) => {
    if (!interactive || layer.type !== "text" || layer.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectLayer?.(layer.id);
    onDragStart?.();
    setEditingTextId(layer.id);
  };

  const selectionChrome = (layer, selected, _index) => selected ? (
    <>
      {!layer.locked && <button
        type="button"
        data-editor-control="true"
        aria-label="Resize selected layer"
        className="absolute -bottom-1 -right-1 grid h-8 w-8 touch-none place-items-center rounded-full border-2 border-white bg-[#D9273E] text-white shadow-[0_5px_16px_rgba(0,0,0,.35)]"
        onPointerDown={(event) => beginResize(event, layer)}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      ><Maximize2 size={12}/></button>}
    </>
  ) : null;

  const selectedLayerForGuide = layers.find((layer) => layer.id === selectedLayerId) || null;
  const selectedOutsideSafeArea = layerOutsideEditorSafeArea(selectedLayerForGuide);

  return (
    <>
      {interactive && selectedLayerForGuide && <div className={`pointer-events-none absolute inset-[6%] z-[65] rounded-sm border border-dashed ${selectedOutsideSafeArea ? "border-amber-400/95" : "border-white/30"}`} aria-hidden="true" />}
      {interactive && snapGuides.x && <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[66] w-px -translate-x-1/2 bg-[#D9273E] shadow-[0_0_10px_rgba(217,39,62,.7)]" aria-hidden="true" />}
      {interactive && snapGuides.y && <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[66] h-px -translate-y-1/2 bg-[#D9273E] shadow-[0_0_10px_rgba(217,39,62,.7)]" aria-hidden="true" />}

      {(layers || []).filter((layer) => layer?.visible !== false).map((layer, index) => {
        const selected = interactive && selectedLayerId === layer.id;
        const isEditingText = editingTextId === layer.id && layer.type === "text";
        const baseStyle = /** @type {React.CSSProperties} */ ({
          position: "absolute",
          left: clamp(layer.x, 0, 100) + "%",
          top: clamp(layer.y, 0, 100) + "%",
          transform: `translate(-50%, -50%) rotate(${Number(layer.rotation || 0)}deg)`,
          transformOrigin: "center center",
          zIndex: (layer.type === "photo" ? 20 : layer.type === "text" ? 40 : 50) + index,
          cursor: interactive && !layer.locked ? "move" : "default",
          pointerEvents: interactive ? "auto" : "none",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        });

        if (layer.type === "photo") {
          const asset = photosById[String(layer.photoId || "")] || null;
          if (!asset?.url) return null;
          const cropMode = layer.fitMode === "crop";
          const imageTransform = `scale(${clamp(layer.cropZoom ?? 100, 100, 220) / 100}) scaleX(${layer.flipX ? -1 : 1}) scaleY(${layer.flipY ? -1 : 1})`;
          return (
            <div
              key={layer.id}
              data-editor-layer={layer.id}
              style={{ ...baseStyle, width: clamp(layer.size || 62, 10, 180) + "%", opacity: clamp(layer.opacity ?? 1, 0.1, 1), outline: selected ? "1px solid rgba(255,255,255,.95)" : "none", outlineOffset: selected ? "4px" : "0" }}
              onPointerDown={(event) => beginGesture(event, layer)}
              onPointerMove={(event) => moveGesture(event, layer)}
              onPointerUp={(event) => endGesture(event, layer)}
              onPointerCancel={(event) => endGesture(event, layer)}
              onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); onSelectLayer?.(layer.id); onPatchLayer?.(layer.id, { fitMode: "crop" }); }}
            >
              <div className={cropMode ? "aspect-[4/5] w-full overflow-hidden rounded-[3%]" : "w-full overflow-visible"}>
                <img
                  src={asset.url}
                  alt={asset.name || "Customer photo"}
                  draggable="false"
                  className={cropMode ? "h-full w-full select-none object-cover pointer-events-none" : "h-auto w-full select-none object-contain pointer-events-none"}
                  style={{ objectPosition: `${clamp(layer.cropX ?? 50, 0, 100)}% ${clamp(layer.cropY ?? 50, 0, 100)}%`, transform: imageTransform, transformOrigin: "center", filter: photoFilterFor(layer) }}
                />
              </div>
              {selectionChrome(layer, selected, index)}
            </div>
          );
        }

        if (layer.type === "text") {
          const curved = (layer.curve || "straight") !== "straight";
          const textStyle = {
            ...baseStyle,
            fontSize: Math.max(8, Number(layer.size || 28)) + "px",
            lineHeight: Number(layer.lineHeight || 1),
            letterSpacing: Number(layer.letterSpacing || 0) + "px",
            color: layer.color || "#ffffff",
            fontFamily: layer.fontFamily || FONT_PRESETS[0].family,
            fontWeight: layer.fontWeight || 700,
            fontStyle: layer.fontStyle || "normal",
            textAlign: layer.align || "center",
            whiteSpace: "pre-wrap",
            width: curved ? `${clamp(160 + editorTextValue(layer).length * Number(layer.size || 28) * 0.55, 180, 520)}px` : "max-content",
            maxWidth: "92%",
            opacity: clamp(layer.opacity ?? 1, 0.1, 1),
            WebkitTextStroke: curved ? undefined : `${Number(layer.strokeWidth || 0)}px ${layer.strokeColor || "#111111"}`,
            paintOrder: "stroke",
            textShadow: curved ? "none" : textShadowFor(layer),
            outline: selected ? "1px solid rgba(255,255,255,.95)" : "none",
            outlineOffset: selected ? "4px" : "0",
          };

          if (isEditingText && !curved) {
            const rows = Math.max(1, String(layer.text || "").split("\n").length);
            return (
              <textarea
                key={layer.id}
                ref={editRef}
                data-editor-layer={layer.id}
                value={layer.text || ""}
                rows={rows}
                aria-label="Edit text directly on garment"
                style={{ ...textStyle, width: "min(76vw, 340px)", minWidth: "120px", minHeight: Math.max(44, Number(layer.size || 28) * Number(layer.lineHeight || 1) * rows + 16) + "px", resize: "none", overflow: "hidden", background: "rgba(7,19,31,.62)", border: "1px solid rgba(255,255,255,.9)", borderRadius: "8px", padding: "6px 8px", cursor: "text", touchAction: "manipulation", userSelect: "text", WebkitUserSelect: "text" }}
                onChange={(event) => onPatchLayer?.(layer.id, { text: event.target.value }, { history: false })}
                onPointerDown={(event) => event.stopPropagation()}
                onBlur={() => setEditingTextId("")}
                onKeyDown={(event) => { if (event.key === "Escape" || ((event.metaKey || event.ctrlKey) && event.key === "Enter")) event.currentTarget.blur(); }}
              />
            );
          }

          return (
            <div
              key={layer.id}
              data-editor-layer={layer.id}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? "Text layer. Drag to move, pinch to resize, double-tap to edit." : undefined}
              style={textStyle}
              onPointerDown={(event) => beginGesture(event, layer)}
              onPointerMove={(event) => moveGesture(event, layer)}
              onPointerUp={(event) => endGesture(event, layer)}
              onPointerCancel={(event) => endGesture(event, layer)}
              onDoubleClick={(event) => beginTextEdit(event, layer)}
              onKeyDown={(event) => { if (event.key === "Enter") beginTextEdit(event, layer); }}
            >
              <CurvedText layer={layer}/>
              {selectionChrome(layer, selected, index)}
            </div>
          );
        }

        const sticker = stickers[layer.stickerId] || {};
        return (
          <div
            key={layer.id}
            data-editor-layer={layer.id}
            style={{ ...baseStyle, width: Math.max(14, Number(layer.size || 34)) + "px", height: Math.max(14, Number(layer.size || 34)) + "px", display: "grid", placeItems: "center", opacity: clamp(layer.opacity ?? 1, 0.1, 1), outline: selected ? "1px solid rgba(255,255,255,.95)" : "none", outlineOffset: selected ? "4px" : "0" }}
            onPointerDown={(event) => beginGesture(event, layer)}
            onPointerMove={(event) => moveGesture(event, layer)}
            onPointerUp={(event) => endGesture(event, layer)}
            onPointerCancel={(event) => endGesture(event, layer)}
          >
            {sticker.assetUrl
              ? <img src={sticker.assetUrl} alt={sticker.label || "Sticker"} draggable="false" className="h-full w-full object-contain pointer-events-none" />
              : <span className="leading-none select-none pointer-events-none" style={{ fontSize: Math.max(14, Number(layer.size || 34)) + "px" }}>{sticker.glyph || "✦"}</span>}
            {selectionChrome(layer, selected, index)}
          </div>
        );
      })}
    </>
  );
}

function ToolButton({ active = false, icon: Icon, label, onClick, disabled = false, mobileFill = false }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-[9px] font-bold uppercase tracking-[.04em] transition disabled:opacity-35 ${mobileFill ? "w-full min-w-0 sm:w-auto sm:min-w-[66px] sm:shrink-0" : "min-w-[66px] shrink-0"} ${active ? "border-[#D9273E] bg-[#D9273E]/15 text-white shadow-[0_0_22px_rgba(217,39,62,.16)]" : "border-white/10 bg-white/[.045] text-white/65 hover:border-white/20 hover:text-white"}`}>
      {Icon && <Icon size={14}/>}<span className="max-w-full truncate">{label}</span>
    </button>
  );
}

function RangeRow({ label, value, min, max, step = 1, suffix = "", onChange, onPointerDown = undefined }) {
  const numericValue = Number(value ?? 0);
  const display = Number.isInteger(numericValue) ? numericValue : Number(numericValue.toFixed(2));
  return (
    <label className="block min-w-0 text-[9px] font-mono uppercase tracking-[.08em] text-white/48">
      <span className="flex justify-between gap-3"><span>{label}</span><span className="text-white/80">{display}{suffix}</span></span>
      <input type="range" min={min} max={max} step={step} value={numericValue} onPointerDown={onPointerDown} onChange={(event) => onChange?.(Number(event.target.value))} className="mt-1.5 w-full min-w-0 max-w-full accent-[#D9273E]"/>
    </label>
  );
}

function PositionRows({ layer, patch }) {
  if (!layer) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <RangeRow label="X position" value={Number(layer.x ?? 50)} min={0} max={100} suffix="%" onChange={(value) => patch({ x: value })}/>
      <RangeRow label="Y position" value={Number(layer.y ?? 50)} min={0} max={100} suffix="%" onChange={(value) => patch({ y: value })}/>
    </div>
  );
}

function LayerActionRow({ layer, onDuplicate, onDelete, onMoveLayer, onReset }) {
  if (!layer) return null;
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <button type="button" onClick={() => onDuplicate?.(layer.id)} className="grid h-9 place-items-center rounded-lg border border-white/10 bg-white/[.045] text-white/75" title="Duplicate"><Copy size={14}/></button>
      <button type="button" onClick={() => onMoveLayer?.(layer.id, 1)} className="grid h-9 place-items-center rounded-lg border border-white/10 bg-white/[.045] text-white/75" title="Bring forward"><ArrowUp size={14}/></button>
      <button type="button" onClick={() => onMoveLayer?.(layer.id, -1)} className="grid h-9 place-items-center rounded-lg border border-white/10 bg-white/[.045] text-white/75" title="Send backward"><ArrowDown size={14}/></button>
      <button type="button" onClick={() => onDelete?.(layer.id)} className="grid h-9 place-items-center rounded-lg border border-[#D9273E]/30 bg-[#D9273E]/10 text-[#FF8898]" title="Delete"><Trash2 size={14}/></button>
      <button type="button" onClick={() => onReset?.(layer.id)} className="col-span-4 mt-1 h-9 rounded-lg border border-white/10 bg-white/[.045] text-[9px] font-bold uppercase text-white/65 inline-flex items-center justify-center gap-1.5"><RotateCcw size={12}/> Reset selected layer</button>
    </div>
  );
}

export function AdvancedEditorPanel({
  enabledTools = DEFAULT_EDITOR_TOOLS,
  stickerLibrary = DEFAULT_STICKER_LIBRARY,
  editorLayers = [],
  photoAssets = [],
  selectedLayerId = "photo",
  onSelectLayer,
  onAddPhoto,
  onAddText,
  onAddSticker,
  onPatchLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onMoveLayer,
  onResetLayer,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenPhotoEditor,
  onResetPhoto,
  onDeletePhoto,
  onTogglePhotoBackground,
  onResetAll,
  hasPhoto,
  templateName,
  outsideWarning = "",
  designPath = "",
  pathLabel = "",
  designOptions = [],
  designStyle = "",
  blankStyleName = "No Template — Upload Only",
  onChooseStyle,
  onChooseBlank,
  moodOptions = [],
  designMood = "",
  onChooseMood,
  moodDescription = "",
  personalization = {},
  onChangePersonalization,
  memorialNameConfirmed = false,
  onMemorialNameConfirmedChange,
  onUploadFiles,
  uploading = false,
  uploadProgress = { done: 0, total: 0 },
  uploadWarning = "",
  maxPhotos = 6,
  uploadLimitMb = 15,
  designIntensity = 3,
  onChooseIntensity,
  previewSide = "front",
  onPreviewSideChange,
  frontBackEnabled = false,
  previewZoom = 1,
  onPreviewZoomChange,
  showGuides = true,
  onToggleGuides,
  showMeasurements = false,
  onToggleMeasurements,
  viewGuidance = "",
  sideStatus = "",
  canCopyFrontToBack = false,
  onCopyFrontToBack,
  legacyArtworkActive = false,
  artworkScale = 92,
  onArtworkScaleChange,
  artworkRotation = 0,
  onArtworkRotationChange,
  artworkFitMode = "fit",
  onArtworkFitModeChange,
  artworkConstrainRatio = true,
  onArtworkConstrainRatioChange,
  artworkStretchX = 100,
  onArtworkStretchXChange,
  artworkStretchY = 100,
  onArtworkStretchYChange,
  artworkSourcePhotoIndex = 0,
  onArtworkSourcePhotoIndexChange,
  onArtworkTransformStart,
  allowFreeStretch = false,
}) {
  const tools = normalizeEditorTools(enabledTools);
  const stickers = normalizeStickerLibrary(stickerLibrary).filter((item) => item.enabled !== false);
  const photosById = useMemo(() => Object.fromEntries((photoAssets || []).filter((item) => item?.id).map((item) => [String(item.id), item])), [photoAssets]);
  const selectedLayer = editorLayers.find((layer) => layer.id === selectedLayerId) || null;
  const selectedPhotoAsset = selectedLayer?.type === "photo"
    ? photosById[String(selectedLayer.photoId || "")] || null
    : (selectedLayerId === "photo" ? (photoAssets || [])[0] || null : null);
  const selectedType = selectedLayer?.type || (hasPhoto ? "photo" : "none");
  const patch = (value) => selectedLayer && onPatchLayer?.(selectedLayer.id, value);
  const [activeTool, setActiveTool] = useState("layers");
  const [panelTab, setPanelTab] = useState(designPath === "upload" ? "photos" : "design");
  const [showStickers, setShowStickers] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [canvasDockHost, setCanvasDockHost] = useState(null);

  useEffect(() => {
    const handleKeyboardDelete = (event) => {
      if (event.repeat || (event.key !== "Delete" && event.key !== "Backspace")) return;
      const target = event.target;
      const tagName = String(target?.tagName || "").toLowerCase();
      const isTyping = Boolean(target?.isContentEditable) || tagName === "input" || tagName === "textarea" || tagName === "select";
      if (isTyping || !selectedLayer || selectedLayer.locked) return;
      event.preventDefault();
      onDeleteLayer?.(selectedLayer.id);
      onSelectLayer?.("photo");
      setShowStickers(false);
      setShowPhotoPicker(false);
      setActiveTool("layers");
      setPanelTab(selectedLayer.type === "text" ? "lettering" : selectedLayer.type === "sticker" ? "layers" : "photos");
    };
    window.addEventListener("keydown", handleKeyboardDelete);
    return () => window.removeEventListener("keydown", handleKeyboardDelete);
  }, [selectedLayer?.id, selectedLayer?.locked, selectedLayer?.type, onDeleteLayer, onSelectLayer]);

  useEffect(() => {
    const resolveCanvasDockHost = () => {
      if (typeof document === "undefined") return;
      setCanvasDockHost(document.querySelector('[data-gdp-studio-preview="live"]'));
    };
    resolveCanvasDockHost();
    const frame = typeof window !== "undefined" ? window.requestAnimationFrame(resolveCanvasDockHost) : 0;
    return () => {
      if (frame && typeof window !== "undefined") window.cancelAnimationFrame(frame);
    };
  }, [designPath]);

  useEffect(() => {
    if (!designStyle) return;
    const neutralIntensity = designPath === "upload" ? 1 : 3;
    if (designMood !== "Original") onChooseMood?.("Original");
    if (Number(designIntensity || 0) !== neutralIntensity) onChooseIntensity?.(neutralIntensity);
  }, [designPath, designStyle, designMood, designIntensity, onChooseMood, onChooseIntensity]);

  useEffect(() => {
    if (selectedType === "text") { setActiveTool("edit"); setPanelTab("lettering"); }
    else if (selectedType === "photo") { setActiveTool("transform"); setPanelTab("photos"); }
    else if (selectedType === "sticker") { setActiveTool("transform"); setPanelTab("layers"); }
    else { setActiveTool("layers"); setPanelTab(designPath === "upload" ? "photos" : "design"); }
  }, [selectedLayerId, selectedType, designPath]);

  useEffect(() => {
    const openRequestedTab = (event) => {
      const tab = event?.detail?.tab;
      if (!["canvas", "design", "photos", "lettering", "details", "layers"].includes(tab)) return;
      setPanelTab(tab);
      setShowStickers(false);
      setShowPhotoPicker(false);
      if (tab === "layers") setActiveTool("layers");
    };
    window.addEventListener("gdp-studio-open-tab", openRequestedTab);
    return () => window.removeEventListener("gdp-studio-open-tab", openRequestedTab);
  }, []);

  const chooseLayer = (id) => {
    onSelectLayer?.(id);
    setShowStickers(false);
    setShowPhotoPicker(false);
  };

  const renderLayers = () => (
    <div className="space-y-2">
      {templateName && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-[10px] text-white/65"><Lock size={13} className="text-[#D9273E]"/><span><strong className="text-white">{templateName}</strong> is protected from accidental edits.</span></div>}
      {!editorLayers.length && <div className="rounded-xl border border-dashed border-white/15 p-4 text-center text-[10px] text-white/45">Add a photo or text to create editable layers.</div>}
      {[...editorLayers].map((layer, index) => {
        const active = layer.id === selectedLayerId;
        return (
          <div key={layer.id} className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border p-2 ${active ? "border-[#D9273E]/70 bg-[#D9273E]/10" : "border-white/10 bg-white/[.035]"}`}>
            <button type="button" onClick={() => chooseLayer(layer.id)} className="min-w-0 text-left">
              <div className="truncate text-[10px] font-bold text-white">{labelForLayer(layer, index, photosById)}</div>
              <div className="mt-0.5 text-[8px] uppercase tracking-[.12em] text-white/35">{layer.type}{layer.locked ? " · locked" : ""}</div>
            </button>
            <div className="flex gap-1">
              <button type="button" onClick={() => onPatchLayer?.(layer.id, { visible: layer.visible === false })} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-white/65" title={layer.visible === false ? "Show layer" : "Hide layer"}>{layer.visible === false ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
              <button type="button" onClick={() => onPatchLayer?.(layer.id, { locked: !layer.locked })} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[.04] text-white/65" title={layer.locked ? "Unlock layer" : "Lock layer"}>{layer.locked ? <Lock size={13}/> : <Unlock size={13}/>}</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderPhotoTool = () => {
    if (!selectedLayer && hasPhoto) {
      return (
        <div className="grid grid-cols-2 gap-2">
          {(tools.erase || tools.restore) && <button type="button" onClick={onOpenPhotoEditor} className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 text-[10px] font-bold uppercase text-white"><Eraser size={14} className="mx-auto mb-1"/>Erase / Restore</button>}
          <button type="button" onClick={onResetPhoto} className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 text-[10px] font-bold uppercase text-white"><RotateCcw size={14} className="mx-auto mb-1"/>Reset photo</button>
          {designPath !== "bootleg" && <button type="button" onClick={onDeletePhoto} className="rounded-xl border border-[#D9273E]/30 bg-[#D9273E]/10 px-3 py-3 text-[10px] font-bold uppercase text-[#FF8898]"><Trash2 size={14} className="mx-auto mb-1"/>Delete photo</button>}
          <button type="button" onClick={onResetAll} className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 text-[10px] font-bold uppercase text-white"><WandSparkles size={14} className="mx-auto mb-1"/>Reset layers</button>
        </div>
      );
    }
    if (!selectedLayer || selectedLayer.type !== "photo") return renderLayers();

    if (activeTool === "replace") {
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(photoAssets || []).map((photo, index) => <button key={photo.id || index} type="button" onClick={() => { patch({ photoId: String(photo.id || "") }); setActiveTool("transform"); }} className={`overflow-hidden rounded-xl border p-1.5 text-left ${String(selectedLayer.photoId) === String(photo.id) ? "border-[#D9273E] bg-[#D9273E]/10" : "border-white/10 bg-white/[.04]"}`}>
            <img src={photo.url || photo.originalUrl} alt="" className="aspect-square w-full rounded-lg object-cover"/>
            <div className="mt-1 truncate text-[9px] font-semibold text-white/75">{photo.name || `Photo ${index + 1}`}</div>
          </button>)}
        </div>
      );
    }

    if (activeTool === "crop") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => patch({ fitMode: "fit" })} className={`rounded-xl border px-3 py-2 text-[9px] font-bold uppercase ${selectedLayer.fitMode !== "crop" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>Fit · no crop</button>
            <button type="button" onClick={() => patch({ fitMode: "crop" })} className={`rounded-xl border px-3 py-2 text-[9px] font-bold uppercase ${selectedLayer.fitMode === "crop" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>Crop 4:5</button>
          </div>
          {selectedLayer.fitMode === "crop" && <>
            <RangeRow label="Crop left / right" value={selectedLayer.cropX ?? 50} min={0} max={100} suffix="%" onChange={(value) => patch({ cropX: value })}/>
            <RangeRow label="Crop up / down" value={selectedLayer.cropY ?? 50} min={0} max={100} suffix="%" onChange={(value) => patch({ cropY: value })}/>
            <RangeRow label="Crop zoom" value={selectedLayer.cropZoom ?? 100} min={100} max={220} suffix="%" onChange={(value) => patch({ cropZoom: value })}/>
          </>}
        </div>
      );
    }

    if (activeTool === "adjust") {
      return (
        <div className="space-y-3">
          <RangeRow label="Brightness" value={selectedLayer.brightness ?? 100} min={25} max={175} suffix="%" onChange={(value) => patch({ brightness: value })}/>
          <RangeRow label="Contrast" value={selectedLayer.contrast ?? 100} min={25} max={175} suffix="%" onChange={(value) => patch({ contrast: value })}/>
          <RangeRow label="Saturation" value={selectedLayer.saturation ?? 100} min={0} max={200} suffix="%" onChange={(value) => patch({ saturation: value })}/>
          <RangeRow label="Warmth" value={selectedLayer.warmth ?? 0} min={-100} max={100} onChange={(value) => patch({ warmth: value })}/>
          <button type="button" onClick={() => patch({ brightness: 100, contrast: 100, saturation: 100, warmth: 0 })} className="h-9 w-full rounded-xl border border-white/10 bg-white/[.04] text-[9px] font-bold uppercase text-white/65">Reset photo adjustments</button>
        </div>
      );
    }

    if (activeTool === "erase") {
      return <button type="button" onClick={onOpenPhotoEditor} className="w-full rounded-xl border border-[#D9273E]/40 bg-[#D9273E]/10 px-4 py-3 text-[10px] font-bold uppercase text-white"><Eraser size={15} className="mr-2 inline"/>Open precision Erase / Restore</button>;
    }

    if (activeTool === "background") {
      return (
        <div className="space-y-2">
          <div className="rounded-xl border border-white/10 bg-white/[.035] p-3 text-[10px] leading-relaxed text-white/55">GDP keeps the original photo available. Background removal switches the garment preview between the original and transparent cutout.</div>
          <button type="button" disabled={!selectedPhotoAsset} onClick={() => selectedPhotoAsset && onTogglePhotoBackground?.(selectedPhotoAsset.id)} className="w-full rounded-xl border border-[#D9273E]/40 bg-[#D9273E]/10 px-4 py-3 text-[10px] font-bold uppercase text-white disabled:opacity-35"><WandSparkles size={15} className="mr-2 inline"/>{selectedPhotoAsset?.backgroundRemoved ? "Restore original background" : "Use transparent background"}</button>
        </div>
      );
    }

    if (activeTool === "more") return <LayerActionRow layer={selectedLayer} onDuplicate={onDuplicateLayer} onDelete={onDeleteLayer} onMoveLayer={onMoveLayer} onReset={onResetLayer}/>;

    return (
      <div className="space-y-3">
        <RangeRow label="Photo size" value={selectedLayer.size ?? 62} min={10} max={180} suffix="%" onChange={(value) => patch({ size: value })}/>
        <RangeRow label="Rotation" value={selectedLayer.rotation ?? 0} min={-180} max={180} suffix="°" onChange={(value) => patch({ rotation: value })}/>
        <RangeRow label="Opacity" value={Math.round((selectedLayer.opacity ?? 1) * 100)} min={10} max={100} suffix="%" onChange={(value) => patch({ opacity: value / 100 })}/>
        <PositionRows layer={selectedLayer} patch={patch}/>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => patch({ flipX: !selectedLayer.flipX })} className={`rounded-xl border px-3 py-2 text-[9px] font-bold uppercase ${selectedLayer.flipX ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/60"}`}><FlipHorizontal size={13} className="mr-1 inline"/>Flip H</button>
          <button type="button" onClick={() => patch({ flipY: !selectedLayer.flipY })} className={`rounded-xl border px-3 py-2 text-[9px] font-bold uppercase ${selectedLayer.flipY ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/60"}`}><FlipVertical size={13} className="mr-1 inline"/>Flip V</button>
        </div>
      </div>
    );
  };

  const renderTextTool = () => {
    if (!selectedLayer || selectedLayer.type !== "text") return renderLayers();

    if (activeTool === "font") {
      return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{FONT_PRESETS.map((font) => <button key={font.label} type="button" onClick={() => patch({ fontFamily: font.family })} className={`rounded-xl border p-3 text-left ${selectedLayer.fontFamily === font.family ? "border-[#D9273E] bg-[#D9273E]/10" : "border-white/10 bg-white/[.035]"}`}><div className="truncate text-base text-white" style={{ fontFamily: font.family }}>{font.label}</div><div className="mt-1 text-[8px] uppercase tracking-wide text-white/35">{font.group}</div></button>)}</div>;
    }

    if (activeTool === "style") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => patch({ fontWeight: Number(selectedLayer.fontWeight || 700) >= 700 ? 400 : 700 })} className={`rounded-xl border py-2 text-sm font-black ${Number(selectedLayer.fontWeight || 700) >= 700 ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>B</button>
            <button type="button" onClick={() => patch({ fontStyle: selectedLayer.fontStyle === "italic" ? "normal" : "italic" })} className={`rounded-xl border py-2 text-sm italic ${selectedLayer.fontStyle === "italic" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>I</button>
            <button type="button" onClick={() => patch({ textTransform: selectedLayer.textTransform === "uppercase" ? "none" : "uppercase" })} className={`rounded-xl border py-2 text-[10px] font-black ${selectedLayer.textTransform === "uppercase" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>ABC</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => patch({ align: "left" })} className={`grid h-10 place-items-center rounded-xl border ${selectedLayer.align === "left" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}><AlignLeft size={15}/></button>
            <button type="button" onClick={() => patch({ align: "center" })} className={`grid h-10 place-items-center rounded-xl border ${selectedLayer.align !== "left" && selectedLayer.align !== "right" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}><AlignCenter size={15}/></button>
            <button type="button" onClick={() => patch({ align: "right" })} className={`grid h-10 place-items-center rounded-xl border ${selectedLayer.align === "right" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}><AlignRight size={15}/></button>
          </div>
        </div>
      );
    }

    if (activeTool === "color") {
      return <div className="grid grid-cols-2 gap-3"><label className="text-[9px] font-bold uppercase tracking-wide text-white/45">Text color<input type="color" value={selectedLayer.color || "#ffffff"} onChange={(event) => patch({ color: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[.04] p-1"/></label><label className="text-[9px] font-bold uppercase tracking-wide text-white/45">Outline color<input type="color" value={selectedLayer.strokeColor || "#111111"} onChange={(event) => patch({ strokeColor: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[.04] p-1"/></label></div>;
    }

    if (activeTool === "curve") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">{TEXT_CURVES.map((curve) => <button key={curve.id} type="button" onClick={() => patch({ curve: curve.id })} className={`rounded-xl border px-2 py-2 text-[8px] font-bold uppercase ${String(selectedLayer.curve || "straight") === curve.id ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>{curve.label}</button>)}</div>
          {(selectedLayer.curve || "straight") !== "straight" && <RangeRow label="Curve intensity" value={selectedLayer.curveAmount ?? 45} min={-100} max={100} onChange={(value) => patch({ curveAmount: value })}/>}
        </div>
      );
    }

    if (activeTool === "effects") {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">{TEXT_EFFECTS.map((effect) => <button key={effect.id} type="button" onClick={() => patch({ effect: effect.id, shadow: effect.id !== "none" && effect.id !== "outline" })} className={`rounded-xl border px-2 py-2 text-[8px] font-bold uppercase ${String(selectedLayer.effect || "shadow") === effect.id ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>{effect.label}</button>)}</div>
          <RangeRow label="Effect strength" value={selectedLayer.effectStrength ?? 45} min={0} max={100} suffix="%" onChange={(value) => patch({ effectStrength: value })}/>
          <RangeRow label="Outline thickness" value={selectedLayer.strokeWidth ?? 1} min={0} max={8} step={0.5} suffix="px" onChange={(value) => patch({ strokeWidth: value })}/>
        </div>
      );
    }

    if (activeTool === "spacing") {
      return <div className="space-y-3"><RangeRow label="Letter spacing" value={selectedLayer.letterSpacing ?? 1} min={-3} max={18} suffix="px" onChange={(value) => patch({ letterSpacing: value })}/><RangeRow label="Line height" value={selectedLayer.lineHeight ?? 1} min={0.7} max={2} step={0.05} suffix="×" onChange={(value) => patch({ lineHeight: value })}/></div>;
    }

    if (activeTool === "transform") {
      return <div className="space-y-3"><RangeRow label="Size" value={selectedLayer.size ?? 28} min={8} max={144} suffix="px" onChange={(value) => patch({ size: value })}/><RangeRow label="Rotation" value={selectedLayer.rotation ?? 0} min={-180} max={180} suffix="°" onChange={(value) => patch({ rotation: value })}/><RangeRow label="Opacity" value={Math.round((selectedLayer.opacity ?? 1) * 100)} min={10} max={100} suffix="%" onChange={(value) => patch({ opacity: value / 100 })}/><PositionRows layer={selectedLayer} patch={patch}/></div>;
    }

    if (activeTool === "more") return <LayerActionRow layer={selectedLayer} onDuplicate={onDuplicateLayer} onDelete={onDeleteLayer} onMoveLayer={onMoveLayer} onReset={onResetLayer}/>;

    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[.1em] text-white/45"><span>Wording</span><span>Double-tap text on garment</span></div>
        <textarea value={selectedLayer.text || ""} onChange={(event) => patch({ text: event.target.value })} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-white/[.055] p-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D9273E]/70" placeholder="Type your wording"/>
      </div>
    );
  };

  const renderStickerTool = () => {
    if (!selectedLayer || selectedLayer.type !== "sticker") return renderLayers();
    if (activeTool === "stickers") return <div className="grid grid-cols-5 gap-1.5">{stickers.map((sticker) => <button key={sticker.id} type="button" title={sticker.label} onClick={() => patch({ stickerId: sticker.id })} className={`grid aspect-square place-items-center overflow-hidden rounded-xl border text-lg ${selectedLayer.stickerId === sticker.id ? "border-[#D9273E] bg-[#D9273E]/15" : "border-white/10 bg-white/[.04]"}`}>{sticker.assetUrl ? <img src={sticker.assetUrl} alt={sticker.label} className="h-full w-full object-contain p-1"/> : sticker.glyph}</button>)}</div>;
    if (activeTool === "more") return <LayerActionRow layer={selectedLayer} onDuplicate={onDuplicateLayer} onDelete={onDeleteLayer} onMoveLayer={onMoveLayer} onReset={onResetLayer}/>;
    return <div className="space-y-3"><RangeRow label="Sticker size" value={selectedLayer.size ?? 34} min={14} max={140} suffix="px" onChange={(value) => patch({ size: value })}/><RangeRow label="Rotation" value={selectedLayer.rotation ?? 0} min={-180} max={180} suffix="°" onChange={(value) => patch({ rotation: value })}/><RangeRow label="Opacity" value={Math.round((selectedLayer.opacity ?? 1) * 100)} min={10} max={100} suffix="%" onChange={(value) => patch({ opacity: value / 100 })}/><PositionRows layer={selectedLayer} patch={patch}/></div>;
  };

  const photoContextTools = /** @type {Array<[string, React.ComponentType<any>, string]>} */ (designPath === "bootleg" ? [
    ["transform", Move, "Move / Size"],
    ["crop", Crop, "Crop"],
    ["background", WandSparkles, "Remove BG"],
    ["erase", Eraser, "Erase"],
    ["more", Layers, "More"],
  ] : [
    ["replace", ImageIcon, "Replace"],
    ["background", WandSparkles, "Remove BG"],
    ["crop", Crop, "Crop"],
    ["adjust", SlidersHorizontal, "Adjust"],
    ["erase", Eraser, "Erase"],
    ["transform", Move, "Transform"],
    ["more", Layers, "More"],
  ]);

  const textContextTools = /** @type {Array<[string, React.ComponentType<any>, string]>} */ (designPath === "bootleg" ? [
    ["edit", Type, "Edit"],
    ["font", Type, "Font"],
    ["style", Sparkles, "Style"],
    ["color", Sparkles, "Color"],
    ["curve", RotateCcw, "Curve"],
    ["transform", Move, "Move / Size"],
    ["more", Layers, "More"],
  ] : [
    ["edit", Type, "Edit"],
    ["font", Type, "Font"],
    ["style", Sparkles, "Style"],
    ["color", Sparkles, "Color"],
    ["curve", RotateCcw, "Curve"],
    ["effects", WandSparkles, "Effects"],
    ["spacing", Maximize2, "Spacing"],
    ["transform", Move, "Transform"],
    ["more", Layers, "More"],
  ]);

  const contextTools = selectedType === "photo"
    ? photoContextTools
    : selectedType === "text"
      ? textContextTools
      : selectedType === "sticker"
        ? [["transform", Move, "Transform"], ["more", Layers, "More"]]
        : [];

  const panelTabs = /** @type {Array<[string, React.ComponentType<any>, string]>} */ ([
    ...(designPath !== "upload" ? [["design", Palette, "Design"]] : []),
    ["photos", ImageIcon, designPath === "upload" ? "Artwork" : "Media"],
    ...(tools.text ? [["lettering", Type, "Text"]] : []),
    ...(designPath === "memorial" ? [["details", Heart, "Details"]] : []),
    ["layers", Layers, "Layers"],
  ]);

  const renderCanvasPanel = () => (
    <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Garment canvas controls">
      <div className="inline-flex shrink-0 rounded-xl border border-white/10 bg-white/[.04] p-1">
        <button type="button" onClick={() => onPreviewSideChange?.("front")} className={`rounded-lg px-3 py-2 text-[9px] font-bold uppercase ${previewSide === "front" ? "bg-white text-[#07131F]" : "text-white/60"}`}>Front</button>
        {frontBackEnabled && <button type="button" onClick={() => onPreviewSideChange?.("back")} className={`rounded-lg px-3 py-2 text-[9px] font-bold uppercase ${previewSide === "back" ? "bg-white text-[#07131F]" : "text-white/60"}`}>Back</button>}
      </div>
      <button type="button" onClick={() => onPreviewZoomChange?.(Math.max(.7, Number(previewZoom || 1) - .1))} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-white/75" aria-label="Zoom fabric out"><ZoomOut size={14}/></button>
      <span className="w-10 shrink-0 text-center font-mono text-[9px] text-white/65">{Math.round(Number(previewZoom || 1) * 100)}%</span>
      <button type="button" onClick={() => onPreviewZoomChange?.(Math.min(2, Number(previewZoom || 1) + .1))} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-white/75" aria-label="Zoom fabric in"><ZoomIn size={14}/></button>
      <button type="button" onClick={() => onPreviewZoomChange?.(1)} className="h-9 shrink-0 rounded-xl border border-white/10 bg-white/[.04] px-2.5 text-[8px] font-bold uppercase text-white/75">Fit</button>
      <button type="button" onClick={onToggleGuides} className={`h-9 shrink-0 rounded-xl border px-2.5 text-[8px] font-bold uppercase ${showGuides ? "border-[#D9273E] bg-[#D9273E]/20 text-white" : "border-white/10 bg-white/[.04] text-white/60"}`}><Eye size={12} className="mr-1 inline"/>Guide</button>
      <button type="button" onClick={onToggleMeasurements} className={`h-9 shrink-0 rounded-xl border px-2.5 text-[8px] font-bold uppercase ${showMeasurements ? "border-[#D9273E] bg-[#D9273E]/20 text-white" : "border-white/10 bg-white/[.04] text-white/60"}`}><Ruler size={12} className="mr-1 inline"/>Measure</button>
    </div>
  );

  const renderDesignPanel = () => (
    <div className="space-y-4">
      <div id="custom-studio-artwork-style" className="scroll-mt-28">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div><div className="text-[10px] font-bold uppercase tracking-[.09em] text-white">Choose design</div><div className="mt-0.5 text-[9px] text-white/42">Protected artwork stays locked. Customer content stays editable.</div></div>
          <Palette size={15} className="text-[#D9273E]"/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {onChooseBlank && <button type="button" onClick={onChooseBlank} className={`rounded-xl border p-2.5 text-left ${designStyle === blankStyleName ? "border-[#D9273E] bg-[#D9273E]/12" : "border-white/10 bg-white/[.035]"}`}><div className="text-[10px] font-bold text-white">No template</div><div className="mt-1 text-[8px] leading-relaxed text-white/38">Blank editable print area</div></button>}
          {(designOptions || []).map((style) => <button key={style.id || style.name} type="button" onClick={() => { onChooseStyle?.(style); onChooseMood?.("Original"); onChooseIntensity?.(designPath === "upload" ? 1 : 3); }} className={`overflow-hidden rounded-xl border p-1.5 text-left ${designStyle === style.name ? "border-[#D9273E] bg-[#D9273E]/12" : "border-white/10 bg-white/[.035]"}`}><div className="aspect-[4/3] overflow-hidden rounded-lg bg-white/[.05]"><img src={style.thumbnail || style.assetUrl} alt="" className="h-full w-full object-contain"/></div><div className="mt-1.5 truncate text-[9px] font-bold text-white">{String(style.name || "Template").replace(/^GDP\s+/, "")}</div><div className="mt-0.5 text-[8px] text-white/35">Locked GDP artwork</div></button>)}
        </div>
        {(designPath === "bootleg" || designPath === "memorial") && <div className="mt-3 rounded-xl border border-white/[.08] bg-white/[.035] p-2.5 text-[9px] leading-relaxed text-white/48"><strong className="text-white/80">{designPath === "memorial" ? "Memorial front design:" : "Front template:"}</strong> {designStyle === blankStyleName ? "Blank canvas selected. Only customer-added photos and text will print." : "The selected GDP artwork is protected. The back stays blank until you add a separate back design."}</div>}
      </div>
    </div>
  );

  const renderLegacyArtworkTool = () => {
    if (!legacyArtworkActive) return null;
    return (
      <div className="space-y-3 rounded-2xl border border-white/[.07] bg-black/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-[10px] font-bold uppercase tracking-[.09em] text-white">Artwork transform</div><div className="mt-0.5 text-[9px] text-white/42">Edit the selected uploaded artwork directly on the garment.</div></div>
          <Move size={15} className="text-[#D9273E]"/>
        </div>
        {(photoAssets || []).length > 1 && <label className="block text-[9px] font-bold uppercase tracking-wide text-white/45">Artwork source<select value={Number(artworkSourcePhotoIndex || 0)} onPointerDown={onArtworkTransformStart} onChange={(event) => onArtworkSourcePhotoIndexChange?.(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#0B1A28] px-3 text-[10px] normal-case tracking-normal text-white outline-none">{photoAssets.map((photo, index) => <option key={photo.id || photo.url || index} value={index}>{index + 1}. {photo.name || "Uploaded photo"}</option>)}</select></label>}
        <RangeRow label="Design size" value={Number(artworkScale || 92)} min={55} max={180} suffix="%" onPointerDown={onArtworkTransformStart} onChange={(value) => onArtworkScaleChange?.(value)}/>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onPointerDown={onArtworkTransformStart} onClick={() => onArtworkFitModeChange?.("fit")} className={`rounded-xl border px-3 py-2.5 text-[9px] font-bold uppercase ${artworkFitMode !== "crop" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>Fit · no crop</button>
          <button type="button" onPointerDown={onArtworkTransformStart} onClick={() => onArtworkFitModeChange?.("crop")} className={`rounded-xl border px-3 py-2.5 text-[9px] font-bold uppercase ${artworkFitMode === "crop" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}>Crop to fill</button>
        </div>
        {artworkFitMode === "crop" && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[9px] leading-relaxed text-amber-100">Crop to Fill trims image edges. Use Fit · No Crop to keep the full artwork visible.</div>}
        {allowFreeStretch && <div className="rounded-xl border border-white/[.08] bg-white/[.035] p-3">
          <button type="button" onPointerDown={onArtworkTransformStart} onClick={() => onArtworkConstrainRatioChange?.(!artworkConstrainRatio)} className="inline-flex items-center gap-2 text-[9px] font-bold uppercase text-white/75">{artworkConstrainRatio ? <Lock size={13}/> : <Unlock size={13}/>} {artworkConstrainRatio ? "Constrain aspect ratio" : "Free stretch enabled"}</button>
          <div className="mt-1 text-[8px] leading-relaxed text-white/35">{artworkConstrainRatio ? "Recommended: resizing keeps the original proportions." : "Advanced: width and height can be adjusted independently."}</div>
          {!artworkConstrainRatio && <div className="mt-3 grid gap-3 sm:grid-cols-2"><RangeRow label="Width" value={Number(artworkStretchX || 100)} min={60} max={160} suffix="%" onPointerDown={onArtworkTransformStart} onChange={(value) => onArtworkStretchXChange?.(value)}/><RangeRow label="Height" value={Number(artworkStretchY || 100)} min={60} max={160} suffix="%" onPointerDown={onArtworkTransformStart} onChange={(value) => onArtworkStretchYChange?.(value)}/></div>}
        </div>}
        <RangeRow label="Rotation" value={Number(artworkRotation || 0)} min={-180} max={180} suffix="°" onPointerDown={onArtworkTransformStart} onChange={(value) => onArtworkRotationChange?.(value)}/>
      </div>
    );
  };

  const renderUploadPanel = () => (
    <div id="custom-studio-photo-upload" className="scroll-mt-28 space-y-3">
      <label className={`flex min-h-20 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[.035] px-3 text-center transition hover:border-[#D9273E]/60 ${uploading ? "pointer-events-none opacity-55" : ""}`}>
        <Upload size={17} className="text-[#D9273E]"/>
        <span><span className="block text-[10px] font-bold uppercase text-white">{uploading ? "Preparing upload…" : designPath === "upload" ? "Upload print artwork" : "Upload photo"}</span><span className="mt-0.5 block text-[8px] text-white/38">JPG, PNG or WEBP · max {uploadLimitMb}MB each</span></span>
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading} onChange={(event) => { const files = event.target.files; if (files?.length) onUploadFiles?.(files); event.target.value = ""; }}/>
      </label>
      {uploading && Number(uploadProgress?.total || 0) > 0 && <div className="rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-[9px] text-white/55">Preparing {uploadProgress.done}/{uploadProgress.total} · {Math.round((Number(uploadProgress.done || 0) / Math.max(1, Number(uploadProgress.total || 1))) * 100)}%</div>}
      {uploadWarning && <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[9px] leading-relaxed text-amber-100">{uploadWarning}</div>}
      {(photoAssets || []).length > 0 && <div><div className="mb-1.5 flex items-center justify-between text-[8px] uppercase tracking-[.1em] text-white/35"><span>Media library</span><span>{photoAssets.length}/{maxPhotos}</span></div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{photoAssets.map((photo, index) => <button key={photo.id || index} type="button" onClick={() => { const existing = editorLayers.find((layer) => layer.type === "photo" && String(layer.photoId || "") === String(photo.id || "")); if (existing) chooseLayer(existing.id); else onAddPhoto?.(photo); }} className="w-[104px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[.035] p-1.5 text-left"><img src={photo.url || photo.originalUrl} alt="" className="aspect-square w-full rounded-lg object-cover"/><div className="mt-1 truncate text-[8px] font-semibold text-white/65">{photo.name || `Photo ${index + 1}`}</div></button>)}</div></div>}
    </div>
  );

  const renderLetteringPanel = () => {
    if (selectedLayer?.type === "text") return <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderTextTool()}</div>;
    const textLayers = editorLayers.filter((layer) => layer.type === "text");
    return <div className="space-y-2"><button type="button" onClick={() => onAddText?.()} className="w-full rounded-xl border border-[#D9273E]/35 bg-[#D9273E]/10 px-4 py-3 text-[10px] font-bold uppercase text-white"><Type size={14} className="mr-2 inline"/>Add lettering</button>{textLayers.length ? textLayers.map((layer, index) => <button key={layer.id} type="button" onClick={() => chooseLayer(layer.id)} className="w-full rounded-xl border border-white/10 bg-white/[.035] px-3 py-2.5 text-left"><div className="truncate text-[10px] font-bold text-white">{layer.text || `Text ${index + 1}`}</div><div className="mt-0.5 text-[8px] uppercase tracking-wide text-white/35">Tap to edit font, curve, effects and spacing</div></button>) : <div className="rounded-xl border border-dashed border-white/15 p-4 text-center text-[9px] text-white/42">Add a title, message, name or extra wording here.</div>}</div>;
  };

  const memorialPersonalization = /** @type {{ name?: string, dates?: string, message?: string }} */ (personalization || {});

  const renderMemorialDetails = () => (
    <div id="custom-studio-memorial-details" className="scroll-mt-28 space-y-3">
      <div className="rounded-xl border border-white/[.08] bg-white/[.035] p-3 text-[9px] leading-relaxed text-white/50"><strong className="text-white/80">Printed memorial details:</strong> enter the protected-template wording exactly as it should appear. Optional custom text can still be added separately in the Text tab.</div>
      <label className="block text-[9px] font-bold uppercase tracking-wide text-white/45">Memorial name <span className="text-[#FF8898]">*</span><input type="text" maxLength={60} value={memorialPersonalization.name || ""} onChange={(event) => { onChangePersonalization?.({ name: event.target.value }); onMemorialNameConfirmedChange?.(false); }} placeholder="Full name as it should print" className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[.055] px-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-[#D9273E]/70"/></label>
      <label className="block text-[9px] font-bold uppercase tracking-wide text-white/45">Dates <span className="font-normal text-white/30">optional</span><input type="text" maxLength={40} value={memorialPersonalization.dates || ""} onChange={(event) => onChangePersonalization?.({ dates: event.target.value })} placeholder="e.g. 1984 — 2026" className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[.055] px-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-[#D9273E]/70"/></label>
      <label className="block text-[9px] font-bold uppercase tracking-wide text-white/45">Remembrance message <span className="font-normal text-white/30">optional</span><textarea maxLength={140} rows={3} value={memorialPersonalization.message || ""} onChange={(event) => onChangePersonalization?.({ message: event.target.value })} placeholder="Forever loved, always remembered." className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[.055] p-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-white/25 focus:border-[#D9273E]/70"/><span className="mt-1 block text-right font-mono text-[8px] font-normal text-white/30">{String(memorialPersonalization.message || "").length}/140</span></label>
      <label className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[9px] leading-relaxed ${memorialNameConfirmed ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[.035] text-white/55"}`}><input type="checkbox" checked={memorialNameConfirmed} disabled={!String(memorialPersonalization.name || "").trim()} onChange={(event) => onMemorialNameConfirmedChange?.(event.target.checked)} className="mt-0.5 accent-[#D9273E]"/><span><strong className="text-white/85">I verified the memorial name spelling.</strong> Changing the name requires verification again.</span></label>
    </div>
  );

  return (
    <div id="gdp-touch-studio-panel" className="sticky bottom-2 z-30 mx-auto mt-4 w-full min-w-0 max-w-[430px] max-h-[74dvh] overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-[24px] border border-white/10 bg-[#07131F]/[.97] p-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,.28)] backdrop-blur-xl sm:p-3 md:static md:max-h-none md:max-w-full md:overflow-visible">
      {canvasDockHost ? createPortal(<div id="gdp-canvas-control-dock">{renderCanvasPanel()}</div>, canvasDockHost) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-[.22em] text-[#D9273E]">GDP Touch Studio</div>
          <div className="mt-1 truncate text-xs font-bold text-white">{pathLabel || (selectedLayer ? labelForLayer(selectedLayer, Math.max(0, editorLayers.findIndex((item) => item.id === selectedLayer.id)), photosById) : hasPhoto ? "Photo tools" : "Personalization controls")}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onUndo} disabled={!canUndo} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-white/65 disabled:opacity-25" aria-label="Undo"><Undo2 size={14}/></button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.045] text-white/65 disabled:opacity-25" aria-label="Redo"><Redo2 size={14}/></button>
          <button type="button" onClick={() => { setPanelTab("layers"); setActiveTool("layers"); }} className={`grid h-9 w-9 place-items-center rounded-xl border ${panelTab === "layers" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.045] text-white/65"}`} aria-label="Layers"><Layers size={14}/></button>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2 text-[9px] leading-relaxed text-white/48">
        {designPath === "bootleg" ? <><strong className="text-white/80">Simple editing:</strong> select a photo or text on the garment, then move, resize or edit it here. Press Delete / Backspace to remove the selected item from the canvas. Uploaded photos stay saved in Media.</> : <><strong className="text-white/80">Touch-first:</strong> drag to move · pinch to resize · twist to rotate · double-tap text to type · double-tap a photo for crop mode.</>}
      </div>

      {outsideWarning && <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[9px] font-semibold leading-relaxed text-amber-200"><span className="mr-1 uppercase tracking-wide text-amber-100">Print-area check:</span>{outsideWarning}</div>}

      {(sideStatus || viewGuidance || canCopyFrontToBack) && <div className="mt-2 rounded-xl border border-white/[.08] bg-white/[.035] px-3 py-2.5 text-[9px] leading-relaxed text-white/48">
        <div className="font-mono text-[8px] uppercase tracking-[.13em] text-white/35">Editing {previewSide}</div>
        {sideStatus && <div className="mt-1 text-white/68">{sideStatus}</div>}
        {viewGuidance && <div className="mt-2 border-l-2 border-[#D9273E]/60 pl-2.5">{viewGuidance}</div>}
        {canCopyFrontToBack && <button type="button" onClick={onCopyFrontToBack} className="mt-2.5 w-full rounded-xl border border-white/15 bg-white/[.05] px-3 py-2 text-[9px] font-bold uppercase text-white">Copy front design to back</button>}
      </div>}

      <div className="mt-3 grid grid-cols-3 gap-1.5 sm:flex sm:max-w-full sm:overflow-x-auto sm:overscroll-x-contain sm:pb-1 sm:touch-pan-x">{panelTabs.map(([id, icon, label]) => <ToolButton key={id} mobileFill active={panelTab === id} icon={icon} label={label} onClick={() => { setPanelTab(id); setShowStickers(false); setShowPhotoPicker(false); }}/>)}</div>

      {((panelTab === "photos" && selectedType === "photo") || (panelTab === "lettering" && selectedType === "text") || (panelTab === "layers" && selectedType === "sticker")) && contextTools.length > 0 && <div className="mt-3 grid grid-cols-3 gap-1.5 sm:flex sm:max-w-full sm:overflow-x-auto sm:overscroll-x-contain sm:pb-1 sm:touch-pan-x">{contextTools.map(([id, icon, label]) => <ToolButton key={id} mobileFill active={activeTool === id} icon={icon} label={label} onClick={() => setActiveTool(id)} disabled={id === "erase" && !hasPhoto}/>)}</div>}

      {panelTab === "design" && <div className="mt-3 min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderDesignPanel()}</div>}
      {panelTab === "photos" && <div className="mt-3 space-y-3"><div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderUploadPanel()}</div>{legacyArtworkActive && !selectedLayer ? renderLegacyArtworkTool() : selectedType === "photo" && <div className="min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderPhotoTool()}</div>}</div>}
      {panelTab === "lettering" && <div className="mt-3">{renderLetteringPanel()}</div>}
      {panelTab === "details" && designPath === "memorial" && <div className="mt-3 min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderMemorialDetails()}</div>}
      {panelTab === "layers" && <div className="mt-3">{selectedType === "sticker" && activeTool !== "layers" ? <div className="mb-3 min-w-0 max-w-full overflow-x-hidden rounded-2xl border border-white/[.07] bg-black/10 p-3">{renderStickerTool()}</div> : null}{renderLayers()}</div>}

      <div className={designPath === "bootleg" ? "hidden" : "mt-3 border-t border-white/10 pt-3"}>
        <div className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x">
          {(photoAssets || []).length > 0 && <ToolButton icon={ImageIcon} label="Add photo" onClick={() => { setPanelTab("photos"); setShowPhotoPicker((value) => !value); }} active={showPhotoPicker}/>}
          {tools.text && <ToolButton icon={Type} label="Add text" onClick={() => { onAddText?.(); setPanelTab("lettering"); setShowStickers(false); setShowPhotoPicker(false); }}/>}
          {false && tools.stickers && <ToolButton icon={Sparkles} label="Sticker" onClick={() => { setPanelTab("layers"); setShowStickers((value) => !value); setShowPhotoPicker(false); }} active={showStickers}/>}
          <ToolButton icon={Layers} label="Layers" onClick={() => { setPanelTab("layers"); setActiveTool("layers"); setShowStickers(false); setShowPhotoPicker(false); }} active={panelTab === "layers"}/>
          <ToolButton icon={RotateCcw} label="Reset all" onClick={onResetAll}/>
        </div>

        {showPhotoPicker && <div className="mt-2 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x">{(photoAssets || []).map((photo, index) => {
          const alreadyAdded = editorLayers.some((layer) => layer.type === "photo" && String(layer.photoId || "") === String(photo.id || ""));
          return <button key={photo.id || index} type="button" disabled={alreadyAdded || photo.processingStatus === "failed"} onClick={() => { onAddPhoto?.(photo); setShowPhotoPicker(false); }} className="inline-flex w-[148px] shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] p-1.5 pr-2 text-left text-[9px] font-semibold text-white/75 disabled:opacity-30"><img src={photo.url || photo.originalUrl} alt="" className="h-9 w-9 rounded-lg object-cover"/><span className="truncate">{alreadyAdded ? "Already added" : (photo.name || `Photo ${index + 1}`)}</span></button>;
        })}</div>}

        {false && showStickers && tools.stickers && <div className="mt-2 grid grid-cols-5 gap-1.5">{stickers.map((sticker) => <button key={sticker.id} type="button" title={sticker.label} onClick={() => { onAddSticker?.(sticker); setShowStickers(false); }} className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[.045] text-lg hover:border-[#D9273E]/70">{sticker.assetUrl ? <img src={sticker.assetUrl} alt={sticker.label} className="h-full w-full object-contain p-1"/> : sticker.glyph}</button>)}</div>}
      </div>
    </div>
  );
}

export function PhotoBrushEditor({ open, photo, tools = DEFAULT_EDITOR_TOOLS, onClose, onApply }) {
  const canvasRef = useRef(null);
  const sourceRef = useRef(null);
  const drawingRef = useRef(false);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const [mode, setMode] = useState("erase");
  const [brushSize, setBrushSize] = useState(44);
  const [soft, setSoft] = useState(true);
  const [ready, setReady] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const [applying, setApplying] = useState(false);
  const normalizedTools = normalizeEditorTools(tools);

  const pushHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    historyRef.current = [...historyRef.current, canvas.toDataURL("image/png")].slice(-16);
    redoRef.current = [];
    setHistoryVersion((value) => value + 1);
  };

  const drawDataUrl = (url) => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    const image = new Image();
    image.onload = () => {
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = url;
  };

  useEffect(() => {
    if (!open || !photo?.url) return;
    setReady(false);
    historyRef.current = [];
    redoRef.current = [];
    setHistoryVersion((value) => value + 1);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
      canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
      canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
      const source = document.createElement("canvas");
      source.width = canvas.width;
      source.height = canvas.height;
      const sourceContext = source.getContext("2d");
      sourceContext.drawImage(image, 0, 0, source.width, source.height);
      sourceRef.current = source;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0);
      historyRef.current = [canvas.toDataURL("image/png")];
      setReady(true);
      setHistoryVersion((value) => value + 1);
    };
    image.onerror = () => setReady(false);
    image.src = photo.url;
  }, [open, photo?.url]);

  if (!open) return null;

  const canvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width, y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height };
  };

  const brush = (event) => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source || !ready) return;
    const context = canvas.getContext("2d");
    const { x, y } = canvasPoint(event);
    const radius = Math.max(4, Number(brushSize || 44)) * (canvas.width / Math.max(500, canvas.getBoundingClientRect().width));
    if (mode === "restore") {
      context.save();
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.clip();
      context.globalAlpha = soft ? 0.55 : 1;
      context.globalCompositeOperation = "source-over";
      context.drawImage(source, 0, 0);
      context.restore();
      return;
    }
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    if (soft) {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(0.68, "rgba(0,0,0,.82)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
    } else context.fillStyle = "rgba(0,0,0,1)";
    context.fill();
    context.restore();
  };

  const start = (event) => { if (!ready) return; event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); drawingRef.current = true; brush(event); };
  const move = (event) => { if (!drawingRef.current) return; event.preventDefault(); brush(event); };
  const stop = (event) => { if (!drawingRef.current) return; event?.preventDefault?.(); drawingRef.current = false; pushHistory(); };
  const undo = () => { if (historyRef.current.length <= 1) return; const current = historyRef.current.pop(); redoRef.current.push(current); drawDataUrl(historyRef.current[historyRef.current.length - 1]); setHistoryVersion((value) => value + 1); };
  const redo = () => { const next = redoRef.current.pop(); if (!next) return; historyRef.current.push(next); drawDataUrl(next); setHistoryVersion((value) => value + 1); };
  const reset = () => { const canvas = canvasRef.current; const source = sourceRef.current; if (!canvas || !source) return; const context = canvas.getContext("2d"); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(source, 0, 0); pushHistory(); };
  const apply = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready || !onApply) return;
    setApplying(true);
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not create the edited image.");
      const file = new File([blob], String(photo?.name || "photo").replace(/\.[^.]+$/, "") + "-edited.png", { type: "image/png", lastModified: Date.now() });
      await onApply({ file, width: canvas.width, height: canvas.height });
      onClose?.();
    } catch (error) {
      window.alert(error?.message || "Could not apply the edited photo. Your current photo is unchanged.");
    } finally { setApplying(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Erase and restore photo">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#07131F] text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div><div className="font-mono text-[8px] uppercase tracking-[.2em] text-[#D9273E]">GDP Photo Lab</div><div className="mt-0.5 text-sm font-bold">Precision Erase / Restore</div></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.05]"><X size={16}/></button>
        </div>
        <div className="flex flex-1 min-h-0 flex-col md:grid md:grid-cols-[220px_1fr]">
          <div className="order-2 border-t border-white/10 p-3 md:order-1 md:border-r md:border-t-0">
            <div className="grid grid-cols-2 gap-2">
              {normalizedTools.erase && <button type="button" onClick={() => setMode("erase")} className={`rounded-xl border px-3 py-2 text-[9px] font-bold uppercase ${mode === "erase" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}><Eraser size={13} className="mx-auto mb-1"/>Erase</button>}
              {normalizedTools.restore && <button type="button" onClick={() => setMode("restore")} className={`rounded-xl border px-3 py-2 text-[9px] font-bold uppercase ${mode === "restore" ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/55"}`}><WandSparkles size={13} className="mx-auto mb-1"/>Restore</button>}
            </div>
            <div className="mt-3"><RangeRow label="Brush size" value={brushSize} min={12} max={120} suffix="px" onChange={setBrushSize}/></div>
            <label className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-white/55"><input type="checkbox" checked={soft} onChange={(event) => setSoft(event.target.checked)} className="accent-[#D9273E]"/> Soft edge</label>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={undo} disabled={historyRef.current.length <= 1} className="h-9 rounded-xl border border-white/10 bg-white/[.04] text-[9px] font-bold uppercase disabled:opacity-30"><Undo2 size={13} className="mr-1 inline"/>Undo</button><button type="button" onClick={redo} disabled={!redoRef.current.length} className="h-9 rounded-xl border border-white/10 bg-white/[.04] text-[9px] font-bold uppercase disabled:opacity-30"><Redo2 size={13} className="mr-1 inline"/>Redo</button></div>
            <button type="button" onClick={reset} className="mt-2 h-9 w-full rounded-xl border border-white/10 bg-white/[.04] text-[9px] font-bold uppercase"><RotateCcw size={13} className="mr-1 inline"/>Reset image</button>
            <p className="mt-3 text-[9px] leading-relaxed text-white/38">Edits affect only the customer photo. Locked GDP template artwork remains protected.</p>
          </div>
          <div className="order-1 min-h-0 overflow-auto bg-[linear-gradient(45deg,#1c2732_25%,transparent_25%),linear-gradient(-45deg,#1c2732_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1c2732_75%),linear-gradient(-45deg,transparent_75%,#1c2732_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-3 md:order-2">
            <div className="grid min-h-full place-items-center"><canvas ref={canvasRef} className={`max-h-[65dvh] max-w-full touch-none shadow-2xl ${ready ? "cursor-crosshair" : "opacity-35"}`} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}/></div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold uppercase text-white/60">Cancel</button><button type="button" onClick={apply} disabled={!ready || applying} className="rounded-xl bg-[#D9273E] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-40">{applying ? "Applying…" : "Apply edit"}</button></div>
      </div>
    </div>
  );
}
