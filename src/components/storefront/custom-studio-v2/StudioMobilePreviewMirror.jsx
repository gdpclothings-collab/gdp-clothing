import React, { useRef, useState } from 'react';

/**
 * Read-only, movable floating preview for mobile editing.
 * The drag handle, side switch and minimize button prevent the preview from
 * trapping users over sliders, uploads, or the final approval control.
 */
export default function StudioMobilePreviewMirror({
  side = 'front',
  minimized = false,
  onMinimize,
  onRestore,
  children,
}) {
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const [position, setPosition] = useState(null);

  const bounds = (width, height) => ({
    maxX: Math.max(8, window.innerWidth - width - 8),
    maxY: Math.max(8, window.innerHeight - height - 8),
  });

  const beginMove = (event) => {
    if (event.button !== 0 || !panelRef.current || typeof window === 'undefined') return;
    event.preventDefault();
    event.stopPropagation();
    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const move = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const { maxX, maxY } = bounds(drag.width, drag.height);
    setPosition({
      x: Math.max(8, Math.min(maxX, drag.left + event.clientX - drag.startX)),
      y: Math.max(8, Math.min(maxY, drag.top + event.clientY - drag.startY)),
    });
  };

  const endMove = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const switchSide = () => {
    if (typeof window === 'undefined' || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const { maxX, maxY } = bounds(rect.width, rect.height);
    setPosition({ x: rect.left > window.innerWidth / 2 ? 8 : maxX, y: Math.max(8, Math.min(maxY, rect.top)) });
  };

  return (
    <div
      ref={panelRef}
      data-gdp-mobile-live-preview={minimized ? 'minimized' : 'floating'}
      data-gdp-mobile-preview-safe="draggable-minimizable"
      className={`pointer-events-none fixed z-[45] sm:hidden ${minimized ? 'w-auto' : 'w-[154px] max-w-[48vw]'}`}
      style={position ? { left: position.x, top: position.y } : { right: 12, top: 96 }}
    >
      {minimized ? (
        <button type="button" onClick={onRestore} aria-label={`Show floating ${side} preview`} className="pointer-events-auto min-h-11 rounded-full border border-slate-200 bg-slate-950 px-3 text-[11px] font-black text-white shadow-lg">Show preview</button>
      ) : (
        <div className="pointer-events-auto overflow-hidden rounded-2xl border-2 border-white bg-white p-1.5 shadow-xl">
          <div className="mb-1 flex items-center gap-1 rounded-lg bg-slate-100 px-1 py-0.5">
            <button
              type="button"
              onPointerDown={beginMove}
              onPointerMove={move}
              onPointerUp={endMove}
              onPointerCancel={endMove}
              onLostPointerCapture={() => { dragRef.current = null; }}
              aria-label="Drag to move floating live preview"
              title="Drag to move"
              className="min-h-9 min-w-0 flex-1 cursor-move touch-none select-none text-left text-[9px] font-black uppercase tracking-wide text-slate-700"
            >↕ Live {side}</button>
            <button type="button" onClick={switchSide} aria-label="Move floating preview to other side" title="Switch side" className="grid h-9 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-black text-slate-700">↔</button>
            <button type="button" onClick={onMinimize} aria-label="Minimize floating live preview" title="Minimize" className="grid h-9 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-black text-slate-700">×</button>
          </div>
          <div className="pointer-events-none mx-auto w-full select-none" aria-hidden="true">{children}</div>
          <p className="mt-1 text-center text-[9px] font-semibold text-slate-500">Updates as you adjust</p>
        </div>
      )}
    </div>
  );
}

export function StudioMobileGarmentMirror({ garmentPreview, productName, side, printGuide, children }) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-white shadow-inner">
      {garmentPreview
        ? <img src={garmentPreview} alt="" className="absolute inset-0 h-full w-full object-contain" />
        : <div className="absolute inset-[8%] rounded-[42%_42%_18%_18%] bg-slate-200/80" aria-hidden="true" />}
      <div data-gdp-mirror-print-guide={side} aria-label={`${productName || 'Garment'} ${side} preview`} className="absolute left-1/2 -translate-x-1/2 overflow-hidden" style={printGuide.style}>
        {children}
      </div>
    </div>
  );
}
