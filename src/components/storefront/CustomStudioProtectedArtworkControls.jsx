import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Layers, Maximize2, Move, RotateCcw, Trash2, Type } from "lucide-react";

function clampOffset(value) {
  return Math.min(42, Math.max(-42, Number(value || 0)));
}

function clampScale(value) {
  return Math.min(180, Math.max(55, Number(value || 100)));
}

function clampRotation(value) {
  return Math.min(180, Math.max(-180, Number(value || 0)));
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

export default function CustomStudioProtectedArtworkControls({
  templateName = "Protected GDP artwork",
  scale = 100,
  rotation = 0,
  offset = { x: 0, y: 0 },
  onScaleChange,
  onRotationChange,
  onOffsetChange,
  onReset,
  onRemove,
  onTransformStart,
}) {
  const [canvasEditMode, setCanvasEditMode] = useState(false);
  const [canvasHost, setCanvasHost] = useState(null);
  const gestureRef = useRef(null);

  useEffect(() => {
    const resolveHost = () => {
      if (typeof document === "undefined") return;
      setCanvasHost(document.querySelector('[data-gdp-studio-preview="live"] [data-gdp-print-area="true"]'));
    };
    resolveHost();
    const frame = typeof window !== "undefined" ? window.requestAnimationFrame(resolveHost) : 0;
    return () => {
      if (frame && typeof window !== "undefined") window.cancelAnimationFrame(frame);
    };
  }, [templateName]);

  useEffect(() => {
    if (!canvasEditMode) gestureRef.current = null;
  }, [canvasEditMode]);

  const setOffset = (patch) => {
    onOffsetChange?.({
      x: clampOffset(patch.x ?? offset?.x ?? 0),
      y: clampOffset(patch.y ?? offset?.y ?? 0),
    });
  };

  const changeOffset = (patch) => {
    onTransformStart?.();
    setOffset(patch);
  };

  const openTextLab = () => {
    if (typeof window === "undefined") return;
    setCanvasEditMode(false);
    window.dispatchEvent(new CustomEvent("gdp-studio-open-tab", { detail: { tab: "lettering" } }));
    window.requestAnimationFrame(() => document.getElementById("gdp-touch-studio-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const addAnotherText = () => {
    if (typeof document === "undefined") return;
    setCanvasEditMode(false);
    const panel = document.getElementById("gdp-touch-studio-panel");
    const addTextButton = [...(panel?.querySelectorAll("button") || [])].find((button) =>
      String(button.textContent || "").trim().toLowerCase().includes("add text")
    );
    if (addTextButton) {
      addTextButton.click();
      return;
    }
    openTextLab();
  };

  const beginCanvasGesture = (event) => {
    if (!canvasEditMode || !canvasHost) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    let gesture = gestureRef.current;
    if (!gesture) {
      onTransformStart?.();
      gesture = {
        rect: canvasHost.getBoundingClientRect(),
        pointers: new Map(),
        startOffset: { x: Number(offset?.x || 0), y: Number(offset?.y || 0) },
        startScale: Number(scale || 100),
        startRotation: Number(rotation || 0),
        startPoint: point,
        startMidpoint: point,
        startDistance: 0,
        startAngle: 0,
      };
      gestureRef.current = gesture;
    }
    gesture.pointers.set(event.pointerId, point);
    const points = [...gesture.pointers.values()];
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.startOffset = { x: Number(offset?.x || 0), y: Number(offset?.y || 0) };
      gesture.startScale = Number(scale || 100);
      gesture.startRotation = Number(rotation || 0);
      gesture.startMidpoint = midpoint(a, b);
      gesture.startDistance = Math.max(1, distance(a, b));
      gesture.startAngle = angle(a, b);
    } else {
      gesture.startPoint = point;
      gesture.startMidpoint = point;
    }
  };

  const moveCanvasGesture = (event) => {
    const gesture = gestureRef.current;
    if (!gesture || !gesture.pointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const width = Math.max(1, gesture.rect?.width || 1);
    const height = Math.max(1, gesture.rect?.height || 1);
    const points = [...gesture.pointers.values()];

    if (points.length >= 2) {
      const [a, b] = points;
      const center = midpoint(a, b);
      onOffsetChange?.({
        x: clampOffset(gesture.startOffset.x + ((center.x - gesture.startMidpoint.x) / width) * 100),
        y: clampOffset(gesture.startOffset.y + ((center.y - gesture.startMidpoint.y) / height) * 100),
      });
      onScaleChange?.(clampScale(gesture.startScale * (distance(a, b) / Math.max(1, gesture.startDistance))));
      onRotationChange?.(clampRotation(gesture.startRotation + angleDelta(angle(a, b), gesture.startAngle)));
      return;
    }

    const current = points[0];
    const snap = (value) => Math.abs(value) <= 2.4 ? 0 : value;
    onOffsetChange?.({
      x: snap(clampOffset(gesture.startOffset.x + ((current.x - gesture.startPoint.x) / width) * 100)),
      y: snap(clampOffset(gesture.startOffset.y + ((current.y - gesture.startPoint.y) / height) * 100)),
    });
  };

  const endCanvasGesture = (event) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    gesture.pointers.delete(event.pointerId);
    if (!gesture.pointers.size) {
      gestureRef.current = null;
      return;
    }
    const remaining = [...gesture.pointers.values()][0];
    gesture.startPoint = remaining;
    gesture.startMidpoint = remaining;
    gesture.startOffset = { x: Number(offset?.x || 0), y: Number(offset?.y || 0) };
    gesture.startScale = Number(scale || 100);
    gesture.startRotation = Number(rotation || 0);
    gesture.startDistance = 0;
  };

  const canvasOverlay = canvasEditMode && canvasHost ? createPortal(
    <div
      className="absolute inset-0 z-[80] cursor-move touch-none select-none"
      data-gdp-template-edit-overlay="true"
      role="application"
      aria-label="Edit protected template on garment"
      onPointerDown={beginCanvasGesture}
      onPointerMove={moveCanvasGesture}
      onPointerUp={endCanvasGesture}
      onPointerCancel={endCanvasGesture}
    >
      <div className="pointer-events-none absolute inset-1 rounded-md border-2 border-[#D9273E] shadow-[0_0_0_4px_rgba(217,39,62,.12)]" />
      <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-white/20 bg-[#07131F]/90 px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[.1em] text-white shadow-lg">
        Template edit · drag · pinch · rotate
      </div>
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-[#D9273E] px-2.5 py-1 text-[8px] font-bold uppercase text-white shadow-lg">
        Protected artwork selected
      </div>
    </div>,
    canvasHost
  ) : null;

  return (
    <section className="gdp-protected-artwork-controls" data-protected-artwork-controls="true" aria-label="Protected artwork controls">
      {canvasOverlay}
      <div className="gdp-protected-artwork-controls__heading">
        <div>
          <div className="gdp-protected-artwork-controls__eyebrow">Protected artwork</div>
          <div className="gdp-protected-artwork-controls__title">{String(templateName || "GDP artwork").replace(/^GDP\s+/, "")}</div>
        </div>
        <span className="gdp-protected-artwork-controls__badge">Artwork protected · placement editable</span>
      </div>
      <p className="gdp-protected-artwork-controls__copy">Move, resize and rotate the whole GDP template like a Bootleg Lab layer. Its internal graphic content stays locked, so customer photos and text remain separate.</p>

      <button
        type="button"
        onClick={() => setCanvasEditMode((value) => !value)}
        className={"mb-3 w-full rounded-xl border px-3 py-2.5 text-[10px] font-bold uppercase transition " + (canvasEditMode ? "border-[#D9273E] bg-[#D9273E]/15 text-white" : "border-white/10 bg-white/[.04] text-white/70")}
        aria-pressed={canvasEditMode}
      >
        <Move size={13} className="mr-1.5 inline" /> {canvasEditMode ? "Finish template canvas edit" : "Edit template directly on garment"}
      </button>
      {canvasEditMode && <p className="mb-3 rounded-xl border border-[#D9273E]/25 bg-[#D9273E]/10 px-3 py-2 text-[9px] leading-relaxed text-white/70">Template edit mode temporarily captures the print area so you can drag the frame safely. Finish template edit to select and move the customer photo or text again.</p>}

      <div className="gdp-protected-artwork-controls__ranges">
        <label>
          <span><Maximize2 size={13} /> Size</span>
          <strong>{Math.round(Number(scale || 100))}%</strong>
          <input type="range" min="55" max="180" value={Number(scale || 100)} onPointerDown={() => onTransformStart?.()} onChange={(event) => onScaleChange?.(Number(event.target.value))} />
        </label>
        <label>
          <span><RotateCcw size={13} /> Rotation</span>
          <strong>{Math.round(Number(rotation || 0))}°</strong>
          <input type="range" min="-180" max="180" value={Number(rotation || 0)} onPointerDown={() => onTransformStart?.()} onChange={(event) => onRotationChange?.(Number(event.target.value))} />
        </label>
        <label>
          <span><Move size={13} /> Left / right</span>
          <strong>{Math.round(Number(offset?.x || 0))}%</strong>
          <input type="range" min="-42" max="42" value={Number(offset?.x || 0)} onPointerDown={() => onTransformStart?.()} onChange={(event) => setOffset({ x: Number(event.target.value) })} />
        </label>
        <label>
          <span><Move size={13} /> Up / down</span>
          <strong>{Math.round(Number(offset?.y || 0))}%</strong>
          <input type="range" min="-42" max="42" value={Number(offset?.y || 0)} onPointerDown={() => onTransformStart?.()} onChange={(event) => setOffset({ y: Number(event.target.value) })} />
        </label>
      </div>

      <div className="gdp-protected-artwork-controls__actions" aria-label="Artwork position controls">
        <button type="button" onClick={() => changeOffset({ x: Number(offset?.x || 0) - 5 })} aria-label="Move protected artwork left">←</button>
        <button type="button" onClick={() => changeOffset({ y: Number(offset?.y || 0) - 5 })} aria-label="Move protected artwork up">↑</button>
        <button type="button" onClick={() => changeOffset({ x: 0, y: 0 })}><Move size={13} /> Center</button>
        <button type="button" onClick={() => changeOffset({ y: Number(offset?.y || 0) + 5 })} aria-label="Move protected artwork down">↓</button>
        <button type="button" onClick={() => changeOffset({ x: Number(offset?.x || 0) + 5 })} aria-label="Move protected artwork right">→</button>
        <button type="button" className="gdp-protected-artwork-controls__reset" onClick={() => { onTransformStart?.(); onReset?.(); }}><RotateCcw size={13} /> Reset</button>
        <button type="button" className="gdp-protected-artwork-controls__remove" onClick={() => { setCanvasEditMode(false); onRemove?.(); }}><Trash2 size={13} /> Remove artwork</button>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[.035] p-2.5">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.08em] text-white/75"><Layers size={13} className="text-[#D9273E]" /> Bootleg-style customer layers</div>
        <p className="mt-1 text-[8px] leading-relaxed text-white/42">Your portrait can be dragged anywhere inside the print area. Every added text block stays independent so it can be moved, resized, rotated, duplicated and styled separately.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={openTextLab} className="rounded-lg border border-white/10 bg-white/[.04] px-2 py-2 text-[8px] font-bold uppercase text-white/65"><Type size={12} className="mr-1 inline" /> Text layers</button>
          <button type="button" onClick={addAnotherText} className="rounded-lg border border-[#D9273E]/35 bg-[#D9273E]/10 px-2 py-2 text-[8px] font-bold uppercase text-white"><Type size={12} className="mr-1 inline" /> Add another text</button>
        </div>
      </div>
    </section>
  );
}
