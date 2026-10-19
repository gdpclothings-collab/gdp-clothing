import React from 'react';

/**
 * Inline, non-obstructing phone preview. All editing controls remain clickable.
 * Children are a read-only mirror of the same layout used by the main editor.
 */
export default function StudioMobilePreviewMirror({
  side = 'front',
  minimized = false,
  onMinimize,
  onRestore,
  children,
}) {
  return (
    <div data-gdp-mobile-live-preview={minimized ? 'minimized' : 'inline'} data-gdp-mobile-preview-safe="controls-unobstructed" className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 sm:hidden">
      <div className="flex min-h-10 items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-black uppercase tracking-[.1em] text-slate-700">Live {side} preview</p>
        <button type="button" onClick={minimized ? onRestore : onMinimize} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">
          {minimized ? 'Show preview' : 'Hide preview'}
        </button>
      </div>
      {!minimized ? (
        <div className="pointer-events-none mx-auto mt-2 w-[124px] max-w-full select-none" aria-hidden="true">
          {children}
        </div>
      ) : null}
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
