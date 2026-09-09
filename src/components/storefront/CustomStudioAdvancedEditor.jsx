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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

export function EditableOverlayLayers({
  layers = [],
  stickerLibrary = [],
  interactive = false,
  selectedLayerId = "",
  onSelectLayer = null,
  onPatchLayer = null,
  onDragStart = null,
}) {
  const dragRef = useRef(null);
  const stickers = useMemo(
    () => Object.fromEntries(normalizeStickerLibrary(stickerLibrary).map((item) => [item.id, item])),
    [stickerLibrary]
  );

  const startDrag = (event, layer) => {
    if (!interactive || !onPatchLayer) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelectLayer?.(layer.id);
    onDragStart?.();
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    dragRef.current = {
      id: layer.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: Number(layer.x || 50),
      startY: Number(layer.y || 50),
      width: Math.max(1, rect?.width || 1),
      height: Math.max(1, rect?.height || 1),
    };
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || !onPatchLayer) return;
    event.preventDefault();
    event.stopPropagation();
    onPatchLayer(drag.id, {
      x: clamp(drag.startX + ((event.clientX - drag.startClientX) / drag.width) * 100, 0, 100),
      y: clamp(drag.startY + ((event.clientY - drag.startClientY) / drag.height) * 100, 0, 100),
    }, { history: false });
  };

  const stopDrag = (event) => {
    if (!dragRef.current) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    dragRef.current = null;
  };

  return (
    <>
      {(layers || []).filter((layer) => layer?.visible !== false).map((layer, index) => {
        const selected = interactive && selectedLayerId === layer.id;
        const baseStyle = /** @type {React.CSSProperties} */ ({
          position: "absolute",
          left: clamp(layer.x, 0, 100) + "%",
          top: clamp(layer.y, 0, 100) + "%",
          transform: `translate(-50%, -50%) rotate(${Number(layer.rotation || 0)}deg)`,
          transformOrigin: "center center",
          zIndex: 30 + index,
          cursor: interactive ? "move" : "default",
          pointerEvents: interactive ? "auto" : "none",
          touchAction: "none",
        });

        if (layer.type === "text") {
          return (
            <div
              key={layer.id}
              data-editor-layer={layer.id}
              style={{
                ...baseStyle,
                fontSize: Math.max(8, Number(layer.size || 28)) + "px",
                lineHeight: Number(layer.lineHeight || 1),
                letterSpacing: Number(layer.letterSpacing || 0) + "px",
                color: layer.color || "#ffffff",
                fontFamily: layer.fontFamily || "Impact, sans-serif",
                textAlign: layer.align || "center",
                whiteSpace: "pre-wrap",
                maxWidth: "92%",
                WebkitTextStroke: `${Number(layer.strokeWidth || 0)}px ${layer.strokeColor || "#111111"}`,
                textShadow: layer.shadow ? "0 2px 4px rgba(0,0,0,.65)" : "none",
                outline: selected ? "1px dashed rgba(255,255,255,.9)" : "none",
                outlineOffset: selected ? "4px" : "0",
              }}
              onPointerDown={(event) => startDrag(event, layer)}
              onPointerMove={moveDrag}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
            >
              {layer.text || "YOUR TEXT"}
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
              outline: selected ? "1px dashed rgba(255,255,255,.9)" : "none",
              outlineOffset: selected ? "4px" : "0",
            }}
            onPointerDown={(event) => startDrag(event, layer)}
            onPointerMove={moveDrag}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
          >
            {sticker.assetUrl
              ? <img src={sticker.assetUrl} alt={sticker.label || "Sticker"} draggable="false" className="h-full w-full object-contain pointer-events-none" />
              : <span className="leading-none select-none pointer-events-none" style={{ fontSize: Math.max(14, Number(layer.size || 34)) + "px" }}>{sticker.glyph || "✦"}</span>}
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
  selectedLayerId = "photo",
  onSelectLayer,
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
  onResetAll,
  hasPhoto,
  templateName,
  outsideWarning = "",
}) {
  const tools = normalizeEditorTools(enabledTools);
  const stickers = normalizeStickerLibrary(stickerLibrary).filter((item) => item.enabled !== false);
  const selectedLayer = editorLayers.find((layer) => layer.id === selectedLayerId) || null;
  const photoSelected = selectedLayerId === "photo" || !selectedLayer;
  const patch = (value) => selectedLayer && onPatchLayer?.(selectedLayer.id, value);

  return (
    <div className="mt-4 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-3">
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
        <span><strong className="text-[#17324D]">{templateName}</strong> is locked and cannot be moved, resized, stretched, rotated, cropped, erased or deleted.</span>
      </div>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onSelectLayer?.("photo")} className={"rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase " + (photoSelected ? "border-[#17324D] bg-[#17324D] text-white" : "border-[#D5DDE4] bg-white text-[#5B6874]")}>Photo</button>
        {editorLayers.map((layer) => <button key={layer.id} type="button" onClick={() => onSelectLayer?.(layer.id)} className={"max-w-[120px] truncate rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase " + (selectedLayerId === layer.id ? "border-[#17324D] bg-[#17324D] text-white" : "border-[#D5DDE4] bg-white text-[#5B6874]")}>{layer.type === "text" ? layer.text || "Text" : "Sticker"}</button>)}
      </div>

      {outsideWarning && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold text-amber-800">{outsideWarning}</div>}

      {photoSelected ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(tools.erase || tools.restore) && <button type="button" disabled={!hasPhoto} onClick={onOpenPhotoEditor} className="rounded-xl border border-[#D5DDE4] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#17324D] disabled:opacity-35 inline-flex items-center justify-center gap-1.5"><Eraser size={13}/> Erase / Restore</button>}
          <button type="button" disabled={!hasPhoto} onClick={onResetPhoto} className="rounded-xl border border-[#D5DDE4] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#17324D] disabled:opacity-35 inline-flex items-center justify-center gap-1.5"><RotateCcw size={13}/> Reset photo</button>
          <button type="button" disabled={!hasPhoto} onClick={onDeletePhoto} className="rounded-xl border border-[#E4C9CC] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#A63D4A] disabled:opacity-35 inline-flex items-center justify-center gap-1.5"><Trash2 size={13}/> Delete photo</button>
          <button type="button" onClick={onResetAll} className="rounded-xl border border-[#D5DDE4] bg-white px-3 py-2 text-[10px] font-bold uppercase text-[#17324D] inline-flex items-center justify-center gap-1.5"><WandSparkles size={13}/> Reset editable</button>
        </div>
      ) : selectedLayer?.type === "text" ? (
        <div className="mt-3 space-y-3">
          <textarea value={selectedLayer.text || ""} onChange={(event) => patch({ text: event.target.value })} rows={2} className="w-full rounded-lg border border-[#D5DDE4] bg-white p-2 text-xs" placeholder="Type your text"/>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">Font
              <select value={selectedLayer.fontFamily} onChange={(event) => patch({ fontFamily: event.target.value })} className="mt-1 h-8 w-full rounded-lg border border-[#D5DDE4] bg-white px-2 text-[10px] normal-case">
                <option value="Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif">Impact</option>
                <option value="'Arial Black', Arial, sans-serif">Arial Black</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Courier New', monospace">Courier</option>
              </select>
            </label>
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">Color
              <input type="color" value={selectedLayer.color || "#ffffff"} onChange={(event) => patch({ color: event.target.value })} className="mt-1 h-8 w-full rounded-lg border border-[#D5DDE4] bg-white p-1"/>
            </label>
          </div>
          <RangeRow label="Size" value={selectedLayer.size} min={10} max={72} suffix="px" onChange={(value) => patch({ size: value })}/>
          <RangeRow label="Rotation" value={selectedLayer.rotation} min={-180} max={180} suffix="°" onChange={(value) => patch({ rotation: value })}/>
          <RangeRow label="Letter spacing" value={selectedLayer.letterSpacing} min={-2} max={12} suffix="px" onChange={(value) => patch({ letterSpacing: value })}/>
          <RangeRow label="Outline" value={selectedLayer.strokeWidth} min={0} max={4} step={0.5} suffix="px" onChange={(value) => patch({ strokeWidth: value })}/>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">X position<input type="range" min="0" max="100" value={selectedLayer.x} onChange={(event) => patch({ x: Number(event.target.value) })} className="mt-1 w-full accent-[#17324D]"/></label>
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">Y position<input type="range" min="0" max="100" value={selectedLayer.y} onChange={(event) => patch({ y: Number(event.target.value) })} className="mt-1 w-full accent-[#17324D]"/></label>
          </div>
          <label className="flex items-center gap-2 text-[10px] font-semibold text-[#53616D]"><input type="checkbox" checked={selectedLayer.shadow !== false} onChange={(event) => patch({ shadow: event.target.checked })}/> Shadow</label>
          <LayerActionRow layer={selectedLayer} onDuplicate={onDuplicateLayer} onDelete={onDeleteLayer} onMoveLayer={onMoveLayer} onReset={onResetLayer}/>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <RangeRow label="Sticker size" value={selectedLayer?.size} min={14} max={96} suffix="px" onChange={(value) => patch({ size: value })}/>
          <RangeRow label="Rotation" value={selectedLayer?.rotation} min={-180} max={180} suffix="°" onChange={(value) => patch({ rotation: value })}/>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">X position<input type="range" min="0" max="100" value={selectedLayer?.x || 50} onChange={(event) => patch({ x: Number(event.target.value) })} className="mt-1 w-full accent-[#17324D]"/></label>
            <label className="text-[9px] font-mono uppercase text-[#6C7883]">Y position<input type="range" min="0" max="100" value={selectedLayer?.y || 50} onChange={(event) => patch({ y: Number(event.target.value) })} className="mt-1 w-full accent-[#17324D]"/></label>
          </div>
          <LayerActionRow layer={selectedLayer} onDuplicate={onDuplicateLayer} onDelete={onDeleteLayer} onMoveLayer={onMoveLayer} onReset={onResetLayer}/>
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

function RangeRow({ label, value, min, max, step = 1, suffix = "", onChange }) {
  return <label className="block text-[9px] font-mono uppercase text-[#6C7883]">
    <span className="flex justify-between"><span>{label}</span><span>{Number(value || 0)}{suffix}</span></span>
    <input type="range" min={min} max={max} step={step} value={Number(value || 0)} onChange={(event) => onChange?.(Number(event.target.value))} className="mt-1 w-full accent-[#17324D]"/>
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
    const next = [...historyRef.current, canvas.toDataURL("image/png")].slice(-12);
    historyRef.current = next;
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

  const point = (event) => {
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
    const { x, y } = point(event);
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
