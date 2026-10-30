import React, { useRef, useState } from 'react';
import { Hand, Maximize2, Minus, Plus } from 'lucide-react';
import {
  clampStudioViewPan,
  clampStudioViewZoom,
  STUDIO_VIEW_MAX_ZOOM,
  STUDIO_VIEW_MIN_ZOOM,
  STUDIO_VIEW_ZOOM_STEP,
} from '@/lib/studioGarmentViewZoom';

/**
 * View-only desktop magnification for the entire garment and its print guide.
 * Never modifies a saved artwork transform, print profile, or production output.
 * Pan mode deliberately blocks layer gestures so editing and navigation cannot
 * accidentally happen in the same pointer movement.
 */
export default function StudioDesktopViewZoom({ children, side = 'front', disabled = false }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);

  // The mobile floating mirror is read-only; leave its existing layout intact.
  if (disabled) return children;

  const changeZoom = (delta) => {
    setZoom((current) => clampStudioViewZoom(current + delta));
    setPan({ x: 0, y: 0 });
    setPanMode(false);
  };
  const fit = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
    setPanMode(false);
  };

  const beginPan = (event) => {
    if (event.button !== 0 || !panMode || zoom <= 100) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: pan };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const movePan = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId || !viewportRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setPan(clampStudioViewPan(
      zoom,
      viewportRef.current.clientWidth,
      viewportRef.current.clientHeight,
      drag.origin.x + event.clientX - drag.x,
      drag.origin.y + event.clientY - drag.y,
    ));
  };
  const endPan = (event) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const buttonStyle = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-700 transition hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <div data-gdp-desktop-view-zoom="true" data-gdp-view-only="true" data-gdp-zoom-percent={zoom}>
      <div role="group" aria-label="Garment preview view zoom" className="mb-2 hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
        <span className="mr-auto text-[10px] font-bold text-slate-500">View zoom · print unchanged</span>
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm">
          <button type="button" className={buttonStyle} onClick={() => changeZoom(-STUDIO_VIEW_ZOOM_STEP)} disabled={zoom <= STUDIO_VIEW_MIN_ZOOM} title="Zoom out garment view" aria-label="Zoom out garment view"><Minus size={16} /></button>
          <output aria-live="polite" aria-label="Current garment view zoom" className="min-w-[48px] text-center text-xs font-black tabular-nums text-slate-800">{zoom}%</output>
          <button type="button" className={buttonStyle} onClick={() => changeZoom(STUDIO_VIEW_ZOOM_STEP)} disabled={zoom >= STUDIO_VIEW_MAX_ZOOM} title="Zoom in garment view" aria-label="Zoom in garment view"><Plus size={16} /></button>
          <button type="button" className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-black text-slate-700 transition hover:bg-white" onClick={fit} title="Fit the full garment in view" aria-label="Fit entire garment in preview"><Maximize2 size={14} /> Fit</button>
          <button type="button" disabled={zoom <= 100} aria-label="Pan zoomed garment preview" aria-pressed={panMode} onClick={() => setPanMode((current) => !current)} title="Pan: drag the garment view without moving artwork" className={'inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-35 ' + (panMode ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white')}><Hand size={14} /> Pan</button>
        </div>
      </div>
      <div ref={viewportRef} data-gdp-view-zoom-viewport={side} className="relative w-full overflow-hidden rounded-2xl">
        <div data-gdp-view-zoom-content="true" style={{ transformOrigin: 'center center', transform: 'translate3d(' + pan.x + 'px, ' + pan.y + 'px, 0) scale(' + zoom / 100 + ')' }}>
          {children}
        </div>
        {panMode && zoom > 100 ? (
          <div
            data-gdp-view-pan-overlay="true"
            aria-label="Drag to pan the magnified garment"
            className="absolute inset-0 z-[60] hidden cursor-grab touch-none select-none active:cursor-grabbing sm:block"
            onPointerDown={beginPan}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onLostPointerCapture={() => { dragRef.current = null; }}
          />
        ) : null}
      </div>
    </div>
  );
}
