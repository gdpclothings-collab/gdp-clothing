import React from "react";
import { Maximize2, Move, RotateCcw, Trash2 } from "lucide-react";

function clampOffset(value) {
  return Math.min(42, Math.max(-42, Number(value || 0)));
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
  const changeOffset = (patch) => {
    onTransformStart?.();
    onOffsetChange?.({
      x: clampOffset(patch.x ?? offset?.x ?? 0),
      y: clampOffset(patch.y ?? offset?.y ?? 0),
    });
  };

  return (
    <section className="gdp-protected-artwork-controls" data-protected-artwork-controls="true" aria-label="Protected artwork controls">
      <div className="gdp-protected-artwork-controls__heading">
        <div>
          <div className="gdp-protected-artwork-controls__eyebrow">Protected artwork</div>
          <div className="gdp-protected-artwork-controls__title">{String(templateName || "GDP artwork").replace(/^GDP\s+/, "")}</div>
        </div>
        <span className="gdp-protected-artwork-controls__badge">Artwork protected · placement editable</span>
      </div>
      <p className="gdp-protected-artwork-controls__copy">Resize, rotate, reposition, reset, or remove the whole GDP artwork. Its internal graphic content remains protected from accidental edits.</p>

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
      </div>

      <div className="gdp-protected-artwork-controls__actions" aria-label="Artwork position controls">
        <button type="button" onClick={() => changeOffset({ x: Number(offset?.x || 0) - 5 })} aria-label="Move protected artwork left">←</button>
        <button type="button" onClick={() => changeOffset({ y: Number(offset?.y || 0) - 5 })} aria-label="Move protected artwork up">↑</button>
        <button type="button" onClick={() => changeOffset({ x: 0, y: 0 })}><Move size={13} /> Center</button>
        <button type="button" onClick={() => changeOffset({ y: Number(offset?.y || 0) + 5 })} aria-label="Move protected artwork down">↓</button>
        <button type="button" onClick={() => changeOffset({ x: Number(offset?.x || 0) + 5 })} aria-label="Move protected artwork right">→</button>
        <button type="button" className="gdp-protected-artwork-controls__reset" onClick={() => { onTransformStart?.(); onReset?.(); }}><RotateCcw size={13} /> Reset</button>
        <button type="button" className="gdp-protected-artwork-controls__remove" onClick={onRemove}><Trash2 size={13} /> Remove artwork</button>
      </div>
    </section>
  );
}
