import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import CustomStudioV2DesignGallery from './CustomStudioV2DesignGallery';
import { supabase } from '@/lib/supabaseClient';
import { resolveSeasonalFeature } from '@/lib/seasonalRotation';

const GENERATED_ASSETS = Object.freeze({
  seasonal: '/images/custom-studio/gallery/seasonal-designs.webp',
  bootleg: '/images/custom-studio/gallery/photo-bootleg.webp',
  memorial: '/images/custom-studio/gallery/memorial-tribute.webp',
  upload: '/images/custom-studio/gallery/upload-artwork.webp',
});

export default function CustomStudioV2GeneratedGallery({ paths, dispatch, product, size }) {
  const [imagesReady, setImagesReady] = useState(false);
  const [seasonalFeature, setSeasonalFeature] = useState(null);

  useEffect(() => {
    if (!product?.id || !size) { setSeasonalFeature(null); return undefined; }
    let active = true;
    Promise.all([
      supabase.from('store_settings').select('custom_studio_settings').eq('id', 1).maybeSingle(),
      supabase.rpc('list_seasonal_artworks', { p_product: product.id, p_size: size, p_side: 'front' }),
    ]).then(([settings, catalog]) => {
      if (!active || settings.error || catalog.error) return;
      const feature = resolveSeasonalFeature(settings.data?.custom_studio_settings?.seasonalRotation, catalog.data?.artworks || []);
      setSeasonalFeature(feature);
    }).catch(() => { if (active) setSeasonalFeature(null); });
    return () => { active = false; };
  }, [product?.id, size]);

  useEffect(() => {
    let active = true;
    const sources = paths.map((path) => GENERATED_ASSETS[path.id]).filter(Boolean);
    if (!sources.length || sources.length !== paths.length) return undefined;
    Promise.all(sources.map((src) => new Promise((resolve, reject) => {
      const picture = new Image();
      picture.onload = resolve;
      picture.onerror = reject;
      picture.src = src;
    }))).then(() => { if (active) setImagesReady(true); }).catch(() => { if (active) setImagesReady(false); });
    return () => { active = false; };
  }, [paths]);

  if (!imagesReady) {
    return <CustomStudioV2DesignGallery paths={paths} dispatch={dispatch} seasonalFeature={seasonalFeature} />;
  }

  return (
    <div data-gdp-v2-design-gallery="true" data-gdp-generated-gallery="true">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Step 2</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Choose a design path</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
          Choose the design experience that fits how you want to create. Each path keeps its own artwork and settings.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5">
        {paths.map((path) => (
          <button
            key={path.id}
            type="button"
            data-gdp-v2-design-path={path.id}
            data-gdp-generated-card="true"
            onClick={() => dispatch({ type: 'SET_DESIGN_PATH', designPath: path.id })}
            aria-label={`Choose ${path.label}. ${path.description}`}
            className="group relative block min-w-0 overflow-hidden rounded-[20px] border border-slate-200 bg-white text-left shadow-[0_7px_22px_rgba(18,30,53,.10)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-[0_16px_35px_rgba(18,30,53,.15)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#147DE5] motion-reduce:transform-none"
          >
            {path.id === 'seasonal' && seasonalFeature ? (
              <span data-gdp-seasonal-featured-card="true" data-seasonal-feature-category={seasonalFeature.category}
                className="relative grid aspect-[1603/756] w-full grid-cols-[1.1fr_.9fr] overflow-hidden bg-gradient-to-br from-[#FFF0D7] via-[#FFE1BE] to-[#C8E7E8]">
                <span className="flex min-w-0 flex-col items-start justify-center gap-1.5 p-4 sm:gap-3 sm:p-6">
                  <span className="text-[10px] font-black uppercase tracking-[.12em] text-orange-700 sm:text-xs">Seasonal Designs</span>
                  <span className="text-xl font-black leading-tight text-slate-900 sm:text-3xl">{seasonalFeature.category}</span>
                  <span className="text-[11px] font-semibold text-slate-600 sm:text-sm">Featured this season</span>
                  <span className="mt-1 rounded-full bg-amber-500 px-3 py-2 text-[10px] font-black text-slate-950 sm:text-xs">Choose This Design →</span>
                </span>
                <span className="m-3 flex min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white/85 p-2 shadow-lg sm:m-5 sm:p-4">
                  <img src={seasonalFeature.artwork.preview} alt="" decoding="async" className="max-h-full max-w-full object-contain" />
                </span>
              </span>
            ) : (
              <img src={GENERATED_ASSETS[path.id]} alt="" decoding="async"
                width="1603" height="756" className="block h-auto w-full select-none" />
            )}
            <span className="flex min-h-11 items-center justify-between gap-2 bg-white px-4 py-2 text-xs font-extrabold text-slate-900 sm:hidden">
              <span>Choose {path.label}</span>
              <ArrowRight size={17} />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">
        Examples for inspiration only. Your actual artwork and garment preview are customized in the next step.
      </p>
    </div>
  );
}
