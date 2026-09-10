import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eraser,
  Lock,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";

export const DEFAULT_EDITOR_TOOLS = {
  erase: true,
  restore: true,
  stickers: true,
  text: true,
  freeStretch: true,
  autoBackgroundRemoval: true,
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

function uid(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return prefix + "-" + crypto.randomUUID();
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2);
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
    fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
    lineHeight: 1,
    letterSpacing: 1,
    align: "center",
    strokeWidth: 1,
    strokeColor: "#111111",
    shadow: true,
    opacity: 1,
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
    visible: true,
  };
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
  const [editingTextId, setEditingTextId] = useState("");

  const stickers = useMemo(
    () => Object.fromEntries(normalizeStickerLibrary(stickerLibrary).map((item) => [item.id, item])),
    [stickerLibrary]
  );
  const photosById = useMemo(
    () => Object.fromEntries((photoAssets || []).filter((item) => item?.id).map((item) => [String(item.id), item])),
    [photoAssets]
  );

  useEffect(() => {
    if (!editingTextId) return;
    const timer = window.setTimeout(() => {
      editRef.current?.focus?.();
      editRef.current?.select?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editingTextId]);

  useEffect(() => {
    if (editingTextId && !layers.some((layer) => layer.id === editingTextId && layer.type === "text")) {
      setEditingTextId("");
    }
  }, [editingTextId, layers]);

  const beginGesture = (event, layer) => {
    if (!interactive || !onPatchLayer || editingTextId === layer.id) return;
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
        startX: Number(layer.x || 50),
        startY: Number(layer.y || 50),
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
      gesture.startX = Number(layer.x || 50);
      gesture.startY = Number(layer.y || 50);
      gesture.startSize = Number(layer.size || gesture.startSize);
      gesture.startRotation = Number(layer.rotation || 0);
      gesture.startMidpoint = midpoint(a, b);
      gesture.startDistance = Math.max(1, distance(a, b));
      gesture.startAngle = angle(a, b);
    } else {
      gesture.startPoint = point;
      gesture.startMidpoint = point;
      gesture.startX = Number(layer.x || 50);
      gesture.startY = Number(layer.y || 50);
    }
  };

  const moveGesture = (event, layer) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== layer.id || !gesture.pointers.has(event.pointerId) || !onPatchLayer) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

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

    if (wasTap && layer.type === "text" && event.pointerType === "touch") {
      const now = Date.now();
      if (lastTapRef.current.id === layer.id && now - lastTapRef.current.at < 360) {
        onDragStart?.();
        setEditingTextId(layer.id);
        lastTapRef.current = { id: "", at: 0 };
      } else {
        lastTapRef.current = { id: layer.id, at: now };
      }
    }

    if (!gesture.pointers.size) {
      gestureRef.current = null;
      return;
    }

    const remaining = [...gesture.pointers.values()][0];
    gesture.startPoint = remaining;
    gesture.startMidpoint = remaining;
    gesture.startX = Number(layer.x || 50);
    gesture.startY = Number(layer.y || 50);
    gesture.startSize = Number(layer.size || gesture.startSize);
    gesture.startRotation = Number(layer.rotation || 0);
    gesture.startDistance = 0;
    gesture.moved = false;
  };

  const beginResize = (event, layer) => {
    if (!interactive || !onPatchLayer) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelectLayer?.(layer.id);
    onDragStart?.();
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
    if (!interactive || layer.type !== "text") return;
    event.preventDefault();
    event.stopPropagation();
    onSelectLayer?.(layer.id);
    onDragStart?.();
    setEditingTextId(layer.id);
  };

  const selectionChrome = (layer, selected) => selected ? (
    <>
      <div
        className="pointer-events-none absolute left-1/2 top-[-30px] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#17324D] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-white shadow-lg"
        style={{ WebkitTextStroke: "0 transparent", textShadow: "none" }}
      >
        {layer.type === "text" ? "Drag · pinch · double-tap to type" : "Drag · pinch to resize · twist to rotate"}
      </div>
      <button
        type="button"
        data-editor-control="true"
        aria-label="Resize selected layer"
        className="absolute -bottom-3 -right-3 grid h-7 w-7 touch-none place-items-center rounded-full border-2 border-white bg-[#17324D] text-[11px] font-bold text-white shadow-lg"
        onPointerDown={(event) => beginResize(event, layer)}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      >↘</button>
    </>
  ) : null;

  return (
    <>
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
          cursor: interactive ? "move" : "default",
          pointerEvents: interactive ? "auto" : "none",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        });

        if (layer.type === "photo") {
          const asset = photosById[String(layer.photoId || "")] || null;
          if (!asset?.url) return null;
          const cropMode = layer.fitMode === "crop";
          return (
            <div
              key={layer.id}
              data-editor-layer={layer.id}
              style={{
                ...baseStyle,
                width: clamp(layer.size || 62, 10, 180) + "%",
                opacity: clamp(layer.opacity ?? 1, 0.1, 1),
                outline: selected ? "1px dashed rgba(255,255,255,.98)" : "none",
                outlineOffset: selected ? "4px" : "0",
              }}
              onPointerDown={(event) => beginGesture(event, layer)}
              onPointerMove={(event) => moveGesture(event, layer)}
              onPointerUp={(event) => endGesture(event, layer)}
              onPointerCancel={(event) => endGesture(event, layer)}
            >
              <div className={cropMode ? "aspect-[4/5] w-full overflow-hidden" : "w-full"} style={cropMode ? { borderRadius: "2%" } : undefined}>
                <img
                  src={asset.url}
                  alt={asset.name || "Customer photo"}
                  draggable="false"
                  className={cropMode ? "h-full w-full select-none object-cover pointer-events-none" : "h-auto w-full select-none object-contain pointer-events-none"}
                />
              </div>
              {selectionChrome(layer, selected)}
            </div>
          );
        }

        if (layer.type === "text") {
          const textStyle = {
            ...baseStyle,
            fontSize: Math.max(8, Number(layer.size || 28)) + "px",
            lineHeight: Number(layer.lineHeight || 1),
            letterSpacing: Number(layer.letterSpacing || 0) + "px",
            color: layer.color || "#ffffff",
            fontFamily: layer.fontFamily || "Impact, sans-serif",
            textAlign: layer.align || "center",
            whiteSpace: "pre-wrap",
            maxWidth: "92%",
            opacity: clamp(layer.opacity ?? 1, 0.1, 1),
            WebkitTextStroke: `${Number(layer.strokeWidth || 0)}px ${layer.strokeColor || "#111111"}`,
            textShadow: layer.shadow ? "0 2px 4px rgba(0,0,0,.65)" : "none",
            outline: selected ? "1px dashed rgba(255,255,255,.95)" : "none",
            outlineOffset: selected ? "4px" : "0",
          };

          if (isEditingText) {
            const rows = Math.max(1, String(layer.text || "").split("\n").length);
            return (
              <textarea
                key={layer.id}
                ref={editRef}
                data-editor-layer={layer.id}
                value={layer.text || ""}
                rows={rows}
                aria-label="Edit text directly on garment"
                style={{
                  ...textStyle,
                  width: "min(76vw, 320px)",
                  minWidth: "120px",
                  minHeight: Math.max(44, Number(layer.size || 28) * Number(layer.lineHeight || 1) * rows + 16) + "px",
                  resize: "none",
                  overflow: "hidden",
                  background: "rgba(23,50,77,.18)",
                  border: "1px dashed rgba(255,255,255,.98)",
                  padding: "6px 8px",
                  cursor: "text",
                  touchAction: "manipulation",
                  userSelect: "text",
                  WebkitUserSelect: "text",
                }}
                onChange={(event) => onPatchLayer?.(layer.id, { text: event.target.value }, { history: false })}
                onPointerDown={(event) => event.stopPropagation()}
                onBlur={() => setEditingTextId("")}
                onKeyDown={(event) => {
                  if (event.key === "Escape" || ((event.metaKey || event.ctrlKey) && event.key === "Enter")) {
                    event.currentTarget.blur();
                  }
                }}
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
              onKeyDown={(event) => {
                if (event.key === "Enter") beginTextEdit(event, layer);
              }}
            >
              {layer.text || "YOUR TEXT"}
              {selectionChrome(layer, selected)}
            </div>
          );
        }

        const sticker = stickers[layer.stickerId] || {};
        return (
          <div
            key={layer.id}
            data-editor-layer={layer.id}
            style={{
              ...baseStyle,
              width: Math.max(14, Number(layer.size || 34)) + "px",
              height: Math.max(14, Number(layer.size || 34)) + "px",
              display: "grid",
              placeItems: "center",
              opacity: clamp(layer.opacity ?? 1, 0.1, 1),
              outline: selected ? "1px dashed rgba(255,255,255,.95)" : "none",
              outlineOffset: selected ? "4px" : "0",
            }}
            onPointerDown={(event) => beginGesture(event, layer)}
            onPointerMove={(event) => moveGesture(event, layer)}
            onPointerUp={(event) => endGesture(event, layer)}
            onPointerCancel={(event) => endGesture(event, layer)}
          >
            {sticker.assetUrl
              ? <img src={sticker.assetUrl} alt={sticker.label || "Sticker"} draggable="false" className="h-full w-full object-contain pointer-events-none" />
              : <span className="leading-none select-none pointer-events-none" style={{ fontSize: Math.max(14, Number(layer.size || 34)) + "px" }}>{sticker.glyph || "✦"}</span>}
            {selectionChrome(layer, selected)}
          </div>
        );
      })}
    </>
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
}) {
  const tools = normalizeEditorTools(enabledTools);
  const stickers = normalizeStickerLibrary(stickerLibrary).filter((item) => item.enabled !== false);
  const selectedLayer = editorLayers.find((layer) => layer.id === selectedLayerId) || null;
  const selectedPhotoAsset = selectedLayer?.type === "photo"
    ? (photoAssets || []).find((photo) => String(photo?.id || "") === String(selectedLayer.photoId || "")) || null
    : null;
  const photoSelected = selectedLayer?.type === "photo" || selectedLayerId === "photo" || !selectedLayer;
  const patch = (value) => selectedLayer && onPatchLayer?.(selectedLayer.id, value);
  const docked = Boolean(selectedLayer);

  return (
    <div className={(docked ? "sticky bottom-2 z-30 max-h-[58dvh] overflow-y-auto md:static md:max-h-none md:overflow-visible " : "") + "mt-4 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC]/95 p-3 shadow-sm backdrop-blur md:bg-[#F8FAFC]"}>
      <div className="mb-3 rounded-xl border border-[#D7E0E8] bg-white px-3 py-2 text-[10px] leading-relaxed text-[#53616D]">
        <strong className="text-[#17324D]">Touch the design directly:</strong> drag to move · pinch to resize · twist with two fingers to rotate · double-tap text to type.
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#6C7883]">Layer tools</div>
          <div className="mt-0.5 text-xs font-bold text-[#17324D]">{photoSelected ? "Photo tools" : selectedLayer?.type === "text" ? "Text tools" : "Sticker tools"}</div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onUndo} disabled={!canUndo} className="grid h-8 w-8 place-items-center rounded-lg border border-[#D5DDE4] bg-white disabled:opacity-35" aria-label="Undo"><Undo2 size={14}/></button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className="grid h-8 w-8 place-items-center rounded-lg border border-[#D5DDE4] bg-white disabled:opacity-35" aria-label="Redo"><Redo2 size={14}/></button>
        </div>
      </div>

      {templateName && <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#D7E0E8] bg-white p-2.5 text-[10px] leading-relaxed text-[#5B6874]">
        <Lock size={13} className="mt-0.5 shrink-0 text-[#17324D]"/>
        <span><strong className="text-[#17324D]">{templateName}</strong> stays protected. Customer photos, text and stickers remain fully editable.</span>
      </div>}

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {!editorLayers.some((layer) => layer.type === "photo") && <button type="button" onClick={() => onSelectLayer?.("photo")} className={"shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase " + (photoSelected ? "border-[#17324D] bg-[#17324D] text-white" : "border-[#D5DDE4] bg-white text-[#5B6874]")}>Photo</button>}
        {editorLayers.map((layer) => {
          const asset = layer.type === "photo"
            ? (photoAssets || []).find((photo) => String(photo?.id || "") === String(layer.photoId || ""))
            : null;
          const label = layer.type === "text" ? (layer.text || "Text") : layer.type === "photo" ? (asset?.name || "Photo") : "Sticker";
          return <button key={layer.id} type="button" onClick={() => onSelectLayer?.(layer.id)} className={"max-w-[140px] shrink-0 truncate rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase " + (selectedLayerId === layer.id ? "border-[#17324D] bg-[#17324D] text-white" : "border-[#D5DDE4] bg-white text-[#5B6874]")}>{label}</button>;
        })}
      </div>

      {(photoAssets || []).length > 0 && <div className="mt-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#6C7883]">Add an uploaded photo to this side</div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {(photoAssets || []).map((photo, index) => {
            const alreadyAdded = editorLayers.some((layer) => layer.type === "photo" && String(layer.photoId || "") === String(photo.id || ""));
            return <button key={photo.id || photo.url || index} type="button" disabled={alreadyAdded || photo.processingStatus === "failed"} onClick={() => onAddPhoto?.(photo)} className="inline-flex w-[150px] shrink-0 items-center gap-2 rounded-lg border border-[#D5DDE4] bg-white p-1.5 pr-2 text-left text-[9px] font-semibold text-[#17324D] disabled:opacity-40">
              <img src={photo.url || photo.originalUrl} alt="" className="h-8 w-8 rounded object-cover" />
              <span className="truncate">{alreadyAdded ? "Added" : `Add ${photo.name || `photo ${index + 1}`}`}</span>
            </button>;
          })}
        </div>
      </div>}

      {outsideWarning && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold text-amber-800">{outsideWarning}</div>}

      {photoSelected ? (
        <div className="mt-3 space-y-3">
          {selectedLayer?.type === "photo" && <>
            <RangeRow label="Photo size" value={selectedLayer.size} min={10} max={180} suffix="%" onChange={(value) => patch({ size: value })}/>
            <RangeRow label="Rotation" value={selectedLayer.rotation} min={-180} max={180} suffix="°" onChange={(value) => patch({ rotation: value })}/>
            <PositionRows layer={selectedLayer} patch={patch}/>
            <div className="inline-flex rounded-lg border border-[#D5DDE4] bg-white p-1">
              <button type="button" onClick={() => patch({ fitMode: "fit" })} className={"rounded-md px-3 py-1.5 text-[9px] font-bold uppercase " + (selectedLayer.fitMode !== "crop" ? "bg-[#17324D] text-white" : "text-[#64707C]")}>Fit · no crop</button>
              <button type="button" onClick={() => patch({ fitMode: "crop" })} className={"rounded-md px-3 py-1.5 text-[9px] font-bold uppercase " + (selectedLayer.fitMode === "crop" ? "bg-[#17324D] text-white" : "text-[#64707C]")}>Crop 4:5</button>
            </div>
          </>}
          <div className="grid grid-cols-2 gap-2">
            {(tools.erase || tools.restore) && <button type="button" disabled={!hasPhoto} onClick={onOpenPhotoEditor} className="rounded-xl border border-[#D5DDE4] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#17324D] disabled:opacity-35 inline-flex items-center justify-center gap-1.5"><Eraser size={13}/> Erase / Restore</button>}
            {selectedPhotoAsset?.cleanedUrl && <button type="button" onClick={() => onTogglePhotoBackground?.(selectedPhotoAsset.id)} className="rounded-xl border border-[#D5DDE4] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#17324D] inline-flex items-center justify-center gap-1.5"><WandSparkles size={13}/>{selectedPhotoAsset.backgroundRemoved ? "Restore background" : "Remove background"}</button>}
            <button type="button" disabled={!hasPhoto} onClick={onResetPhoto} className="rounded-xl border border-[#D5DDE4] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#17324D] disabled:opacity-35 inline-flex items-center justify-center gap-1.5"><RotateCcw size={13}/> Reset photo</button>
            <button type="button" disabled={!hasPhoto} onClick={onDeletePhoto} className="rounded-xl border border-[#E4C9CC] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#A63D4A] disabled:opacity-35 inline-flex items-center justify-center gap-1.5"><Trash2 size={13}/> Delete photo</button>
            <button type="button" onClick={onResetAll} className="col-span-2 rounded-xl border border-[#D5DDE4] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#17324D] inline-flex items-center justify-center gap-1.5"><WandSparkles size={13}/> Reset editable layers</button>
          </div>
          {selectedLayer?.type === "photo" && <LayerActionRow layer={selectedLayer} onDuplicate={onDuplicateLayer} onDelete={onDeleteLayer} onMoveLayer={onMoveLayer} onReset={onResetLayer}/>}
        </div>
      ) : selectedLayer?.type === "text" ? (
        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[9px] font-mono uppercase text-[#6C7883]"><span>Wording</span><span>Double-tap it on the garment to edit there</span></div>
            <textarea value={selectedLayer.text || ""} onChange={(event) => patch({ text: event.target.value })} rows={2} className="w-full rounded-lg border border-[#D5DDE4] bg-white p-2 text-xs" placeholder="Type your text"/>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">Font
              <select value={selectedLayer.fontFamily} onChange={(event) => patch({ fontFamily: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#D5DDE4] bg-white px-2 text-[10px] normal-case">
                <option value="Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif">Impact</option>
                <option value="'Arial Black', Arial, sans-serif">Arial Black</option>
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Times New Roman', serif">Times</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
                <option value="'Courier New', monospace">Courier</option>
              </select>
            </label>
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">Text color
              <input type="color" value={selectedLayer.color || "#ffffff"} onChange={(event) => patch({ color: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#D5DDE4] bg-white p-1"/>
            </label>
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">Outline color
              <input type="color" value={selectedLayer.strokeColor || "#111111"} onChange={(event) => patch({ strokeColor: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#D5DDE4] bg-white p-1"/>
            </label>
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">Alignment
              <select value={selectedLayer.align || "center"} onChange={(event) => patch({ align: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#D5DDE4] bg-white px-2 text-[10px] normal-case">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <RangeRow label="Size" value={selectedLayer.size} min={8} max={144} suffix="px" onChange={(value) => patch({ size: value })}/>
          <RangeRow label="Rotation" value={selectedLayer.rotation} min={-180} max={180} suffix="°" onChange={(value) => patch({ rotation: value })}/>
          <RangeRow label="Letter spacing" value={selectedLayer.letterSpacing} min={-2} max={16} suffix="px" onChange={(value) => patch({ letterSpacing: value })}/>
          <RangeRow label="Line height" value={selectedLayer.lineHeight} min={0.75} max={2} step={0.05} suffix="×" onChange={(value) => patch({ lineHeight: value })}/>
          <RangeRow label="Outline" value={selectedLayer.strokeWidth} min={0} max={6} step={0.5} suffix="px" onChange={(value) => patch({ strokeWidth: value })}/>
          <RangeRow label="Opacity" value={Math.round((selectedLayer.opacity ?? 1) * 100)} min={10} max={100} suffix="%" onChange={(value) => patch({ opacity: value / 100 })}/>
          <PositionRows layer={selectedLayer} patch={patch}/>
          <label className="flex items-center gap-2 text-[10px] font-semibold text-[#53616D]"><input type="checkbox" checked={selectedLayer.shadow !== false} onChange={(event) => patch({ shadow: event.target.checked })}/> Text shadow</label>
          <LayerActionRow layer={selectedLayer} onDuplicate={onDuplicateLayer} onDelete={onDeleteLayer} onMoveLayer={onMoveLayer} onReset={onResetLayer}/>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <RangeRow label="Sticker size" value={selectedLayer?.size} min={14} max={140} suffix="px" onChange={(value) => patch({ size: value })}/>
          <RangeRow label="Rotation" value={selectedLayer?.rotation} min={-180} max={180} suffix="°" onChange={(value) => patch({ rotation: value })}/>
          <RangeRow label="Opacity" value={Math.round((selectedLayer?.opacity ?? 1) * 100)} min={10} max={100} suffix="%" onChange={(value) => patch({ opacity: value / 100 })}/>
          <PositionRows layer={selectedLayer} patch={patch}/>
          {selectedLayer && <LayerActionRow layer={selectedLayer} onDuplicate={onDuplicateLayer} onDelete={onDeleteLayer} onMoveLayer={onMoveLayer} onReset={onResetLayer}/>} 
        </div>
      )}

      <div className="mt-4 border-t border-[#DCE3EA] pt-3">
        <div className="flex gap-2">
          {tools.text && <button type="button" onClick={onAddText} className="flex-1 rounded-xl bg-[#17324D] px-3 py-2 text-[10px] font-bold uppercase text-white inline-flex items-center justify-center gap-1.5"><Type size={13}/> Add text</button>}
          {tools.stickers && <div className="flex-1 rounded-xl border border-[#D5DDE4] bg-white px-2 py-2 text-center text-[10px] font-bold uppercase text-[#17324D] inline-flex items-center justify-center gap-1.5"><Sparkles size={13}/> Stickers</div>}
        </div>
        {tools.stickers && <div className="mt-2 grid grid-cols-5 gap-1.5">
          {stickers.map((sticker) => <button key={sticker.id} type="button" title={sticker.label} onClick={() => onAddSticker?.(sticker)} className="grid aspect-square place-items-center overflow-hidden rounded-lg border border-[#D5DDE4] bg-white text-lg hover:border-[#17324D]">
            {sticker.assetUrl ? <img src={sticker.assetUrl} alt={sticker.label} className="h-full w-full object-contain p-1"/> : sticker.glyph}
          </button>)}
        </div>}
      </div>
    </div>
  );
}

function PositionRows({ layer, patch }) {
  if (!layer) return null;
  return <div className="grid grid-cols-2 gap-2">
    <label className="text-[9px] font-mono uppercase text-[#6C7883]">X position
      <input type="range" min="0" max="100" value={Number(layer.x || 50)} onChange={(event) => patch({ x: Number(event.target.value) })} className="mt-1 w-full accent-[#17324D]"/>
    </label>
    <label className="text-[9px] font-mono uppercase text-[#6C7883]">Y position
      <input type="range" min="0" max="100" value={Number(layer.y || 50)} onChange={(event) => patch({ y: Number(event.target.value) })} className="mt-1 w-full accent-[#17324D]"/>
    </label>
  </div>;
}

function RangeRow({ label, value, min, max, step = 1, suffix = "", onChange }) {
  const numericValue = Number(value || 0);
  const display = Number.isInteger(numericValue) ? numericValue : Number(numericValue.toFixed(2));
  return <label className="block text-[9px] font-mono uppercase text-[#6C7883]">
    <span className="flex justify-between"><span>{label}</span><span>{display}{suffix}</span></span>
    <input type="range" min={min} max={max} step={step} value={numericValue} onChange={(event) => onChange?.(Number(event.target.value))} className="mt-1 w-full accent-[#17324D]"/>
  </label>;
}

function LayerActionRow({ layer, onDuplicate, onDelete, onMoveLayer, onReset }) {
  return <div className="grid grid-cols-4 gap-1.5">
    <button type="button" onClick={() => onDuplicate?.(layer.id)} className="grid h-8 place-items-center rounded-lg border border-[#D5DDE4] bg-white" title="Duplicate"><Copy size={13}/></button>
    <button type="button" onClick={() => onMoveLayer?.(layer.id, 1)} className="grid h-8 place-items-center rounded-lg border border-[#D5DDE4] bg-white" title="Bring forward"><ArrowUp size={13}/></button>
    <button type="button" onClick={() => onMoveLayer?.(layer.id, -1)} className="grid h-8 place-items-center rounded-lg border border-[#D5DDE4] bg-white" title="Send backward"><ArrowDown size={13}/></button>
    <button type="button" onClick={() => onDelete?.(layer.id)} className="grid h-8 place-items-center rounded-lg border border-[#E4C9CC] bg-white text-[#A63D4A]" title="Delete"><Trash2 size={13}/></button>
    <button type="button" onClick={() => onReset?.(layer.id)} className="col-span-4 h-8 rounded-lg border border-[#D5DDE4] bg-white text-[9px] font-bold uppercase text-[#53616D] inline-flex items-center justify-center gap-1.5"><RotateCcw size={12}/> Reset selected layer</button>
  </div>;
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
    historyRef.current = [...historyRef.current, canvas.toDataURL("image/png")].slice(-12);
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
      redoRef.current = [];
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
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
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
    } else {
      context.fillStyle = "rgba(0,0,0,1)";
    }
    context.fill();
    context.restore();
  };

  const start = (event) => {
    if (!ready) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    brush(event);
  };
  const move = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    brush(event);
  };
  const stop = (event) => {
    if (!drawingRef.current) return;
    event?.preventDefault?.();
    drawingRef.current = false;
    pushHistory();
  };

  const undo = () => {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current.pop();
    redoRef.current.push(current);
    drawDataUrl(historyRef.current[historyRef.current.length - 1]);
    setHistoryVersion((value) => value + 1);
  };
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(next);
    drawDataUrl(next);
    setHistoryVersion((value) => value + 1);
  };
  const reset = () => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
    pushHistory();
  };
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
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Erase and restore photo">
      <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#F4F7FA] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#DCE3EA] bg-white px-4 py-3">
          <div><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6C7883]">Non-destructive photo editor</div><div className="font-bold text-[#17324D]">Erase / Restore</div></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-[#D5DDE4] bg-white"><X size={16}/></button>
        </div>
        <div className="flex flex-1 min-h-0 flex-col md:grid md:grid-cols-[220px_1fr]">
          <div className="order-2 border-t border-[#DCE3EA] bg-white p-3 md:order-1 md:border-r md:border-t-0">
            <div className="grid grid-cols-2 gap-2">
              {normalizedTools.erase && <button type="button" onClick={() => setMode("erase")} className={"rounded-xl border px-3 py-2 text-[10px] font-bold uppercase " + (mode === "erase" ? "border-[#17324D] bg-[#17324D] text-white" : "border-[#D5DDE4] bg-white text-[#53616D]")}><Eraser size={13} className="mx-auto mb-1"/>Erase</button>}
              {normalizedTools.restore && <button type="button" onClick={() => setMode("restore")} className={"rounded-xl border px-3 py-2 text-[10px] font-bold uppercase " + (mode === "restore" ? "border-[#17324D] bg-[#17324D] text-white" : "border-[#D5DDE4] bg-white text-[#53616D]")}><WandSparkles size={13} className="mx-auto mb-1"/>Restore</button>}
            </div>
            <RangeRow label="Brush size" value={brushSize} min={12} max={120} suffix="px" onChange={setBrushSize}/>
            <label className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-[#53616D]"><input type="checkbox" checked={soft} onChange={(event) => setSoft(event.target.checked)}/> Soft edge</label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={undo} disabled={historyRef.current.length <= 1} className="h-9 rounded-lg border border-[#D5DDE4] bg-white text-[10px] font-bold uppercase disabled:opacity-35"><Undo2 size={13} className="inline mr-1"/>Undo</button>
              <button type="button" onClick={redo} disabled={!redoRef.current.length} className="h-9 rounded-lg border border-[#D5DDE4] bg-white text-[10px] font-bold uppercase disabled:opacity-35"><Redo2 size={13} className="inline mr-1"/>Redo</button>
            </div>
            <button type="button" onClick={reset} className="mt-2 h-9 w-full rounded-lg border border-[#D5DDE4] bg-white text-[10px] font-bold uppercase"><RotateCcw size={13} className="inline mr-1"/>Reset image</button>
            <p className="mt-3 text-[9px] leading-relaxed text-[#6C7883]">Erase and Restore only affect the customer photo. The locked GDP template is never edited.</p>
          </div>
          <div className="order-1 min-h-0 overflow-auto bg-[linear-gradient(45deg,#ddd_25%,transparent_25%),linear-gradient(-45deg,#ddd_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ddd_75%),linear-gradient(-45deg,transparent_75%,#ddd_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-3 md:order-2">
            <div className="grid min-h-full place-items-center">
              <canvas
                ref={canvasRef}
                className={"max-h-[65dvh] max-w-full touch-none shadow-xl " + (ready ? "cursor-crosshair" : "opacity-40")}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={stop}
                onPointerCancel={stop}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#DCE3EA] bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#D5DDE4] px-4 py-2 text-xs font-bold uppercase text-[#53616D]">Cancel</button>
          <button type="button" onClick={apply} disabled={!ready || applying} className="rounded-xl bg-[#17324D] px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-40">{applying ? "Applying…" : "Apply photo edit"}</button>
        </div>
      </div>
    </div>
  );
}
