import React, { useState } from 'react';

/**
 * Side-by-side detail assessment without mutating uploaded source art.
 * Slider masks the enhanced image; zoomed viewport scrolls/pans on touch.
 */
export default function StudioArtworkComparison({ originalUrl, enhancedUrl }) {
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(1);

  return (
    <div data-gdp-smart-compare="slider-zoom" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-slate-900">Compare image details</p>
        <div role="group" aria-label="Image comparison zoom" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1">
          {[1, 2].map((value) => (
            <button key={value} type="button" aria-pressed={zoom === value} onClick={() => setZoom(value)}
              className={`min-h-10 min-w-12 rounded-lg px-3 text-xs font-black ${zoom === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>
              {value}×
            </button>
          ))}
        </div>
      </div>
      <div data-gdp-smart-compare-viewport="true" className="relative h-[300px] w-full overflow-auto rounded-2xl border border-slate-200 bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] sm:h-[420px]">
        <div className="relative" style={{ width: `${zoom * 100}%`, height: `${zoom * 300}px`, minHeight: '100%' }}>
          <img src={originalUrl} alt="Original image" draggable="false" className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" />
          <img src={enhancedUrl} alt="Basic enhanced image" draggable="false" className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-cyan-700" style={{ left: `${split}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-700"><span>Basic improvement</span><span>Original</span></div>
      <input type="range" min="0" max="100" value={split} onChange={(event) => setSplit(Number(event.target.value))}
        aria-label="Drag to compare original and improved image" aria-valuetext={`${split}% improved image visible`} className="h-11 w-full cursor-ew-resize accent-cyan-700" />
      <p className="text-[11px] font-medium leading-5 text-slate-600">Slide to reveal the improved image. Use 2× to inspect edges and text; drag inside the zoomed image to pan. The print recommendation still uses the original image resolution.</p>
    </div>
  );
}
