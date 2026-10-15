import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import CustomStudioV2DesignGallery from './CustomStudioV2DesignGallery';

const GENERATED_ASSETS = Object.freeze({
  seasonal: '/images/custom-studio/gallery/seasonal-designs.webp',
  bootleg: '/images/custom-studio/gallery/photo-bootleg.webp',
  memorial: '/images/custom-studio/gallery/memorial-tribute.webp',
  upload: '/images/custom-studio/gallery/upload-artwork.webp',
});

export default function CustomStudioV2GeneratedGallery({ paths, dispatch }) {
  const [imagesReady, setImagesReady] = useState(false);

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
    return <CustomStudioV2DesignGallery paths={paths} dispatch={dispatch} />;
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
            <img
              src={GENERATED_ASSETS[path.id]}
              alt=""
              decoding="async"
              width="1603"
              height="756"
              className="block h-auto w-full select-none"
            />
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
