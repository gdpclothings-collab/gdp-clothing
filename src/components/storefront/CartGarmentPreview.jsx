import React from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { cartPreviewSides } from '@/lib/cartPreviewSides';

// The customer sees approved garment mockups, never the transparent print PNGs.
export default function CartGarmentPreview({ item }) {
  const isCustom = Boolean(item.isCustom && !item.isDtf);
  const sides = cartPreviewSides(item);
  const [selectedSide, setSelectedSide] = React.useState(null);
  const [zoom, setZoom] = React.useState(1);
  const active = sides.find((entry) => entry.side === selectedSide) || sides[0];
  const adjustZoom = (delta) => setZoom((value) => Math.max(0.8, Math.min(1.8, Number((value + delta).toFixed(2)))));
  const chooseSide = (side) => {
    setSelectedSide(side);
    setZoom(1);
  };

  return (
    <div className="min-w-0" data-gdp-cart-garment-preview={isCustom ? 'custom' : 'standard'}>
      <div
        className={`${isCustom ? 'aspect-[4/5] bg-[#f3eee6]' : 'aspect-square bg-secondary sm:aspect-[4/5]'} relative overflow-hidden rounded-xl border border-black/10`}
        data-gdp-cart-preview-side={active?.side || ''}
      >
        {item.isDtf ? (
          <img src={item.image} alt={`${item.name} film layout`} className="h-full w-full bg-white object-contain" />
        ) : isCustom ? (
          <img
            src={active?.url || item.image}
            alt={`${item.name} approved ${active?.side === 'back' ? 'back' : 'front'} garment preview`}
            className="h-full w-full object-contain transition-transform duration-200 ease-out"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          />
        ) : (
          <Image src={item.image} alt={item.name} fittingType="fill" className="h-full w-full object-cover" />
        )}
        {isCustom && active && (
          <span className="absolute bottom-2 left-2 rounded-full border border-white/80 bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#17324D] shadow-sm">
            {active.side} print
          </span>
        )}
        {isCustom && (
          <div className="absolute right-2 top-2 z-20 flex items-center overflow-hidden rounded-xl border border-white/80 bg-white/95 shadow-[0_8px_22px_rgba(0,0,0,.14)] backdrop-blur-md sm:hidden" aria-label="Cart garment zoom controls">
            <button type="button" onClick={() => adjustZoom(-0.1)} disabled={zoom <= 0.8} className="grid h-9 w-9 place-items-center text-[#52616F] disabled:opacity-35" aria-label="Zoom garment preview out"><ZoomOut size={14} /></button>
            <span className="min-w-11 text-center font-mono text-[9px] font-bold tabular-nums text-[#52616F]">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => adjustZoom(0.1)} disabled={zoom >= 1.8} className="grid h-9 w-9 place-items-center text-[#52616F] disabled:opacity-35" aria-label="Zoom garment preview in"><ZoomIn size={14} /></button>
            <button type="button" onClick={() => setZoom(1)} className="h-9 border-l border-[#DCE3EA] px-2.5 text-[8px] font-black uppercase text-[#52616F]" aria-label="Fit garment preview to canvas">Fit</button>
          </div>
        )}
      </div>
      {isCustom && sides.length > 1 && (
        <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={`Choose ${item.name} garment print side`}>
          {sides.map(({ side, url }) => (
            <button
              key={side}
              type="button"
              aria-label={`View ${side} design`}
              aria-pressed={active?.side === side}
              onClick={() => chooseSide(side)}
              className={`min-h-12 overflow-hidden rounded-xl border-2 bg-[#f3eee6] p-1 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17324D] ${active?.side === side ? 'border-[#17324D] shadow-sm' : 'border-[#DCE3EA] hover:border-[#7F91A3]'}`}
            >
              <img src={url} alt="" aria-hidden="true" loading="lazy" className="mx-auto h-16 w-full object-contain sm:h-20" />
              <span className="block py-1 text-[10px] font-black uppercase tracking-wider text-[#17324D]">{side}</span>
            </button>
          ))}
        </div>
      )}
      {isCustom && item.placement === 'front_back' && sides.length < 2 && (
        <p className="mt-2 text-[11px] leading-4 text-[#687683]">
          Only one garment mockup is available for this saved item. Both approved print sides remain in the production package.
        </p>
      )}
    </div>
  );
}
