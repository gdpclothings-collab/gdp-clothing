import React from 'react';
import { ArrowRight, Check, Heart, ImageUp, Sparkles, Star } from 'lucide-react';
import DesignPathPreview from '@/components/storefront/custom-studio/DesignPathPreview';

const PATH_STYLE = {
  seasonal: {
    background: 'linear-gradient(112deg, #fff5e7 0%, #fef0dc 53%, #d9edf6 100%)',
    icon: 'bg-[#FF7C27] text-white', label: 'text-[#172034]', body: 'text-[#48576A]',
    mark: 'bg-[#FF911F]', cta: 'bg-gradient-to-r from-[#FFDB7B] to-[#FFAA35] text-[#1B2635]',
    benefits: ['Year-round seasonal artwork', 'Easy to customize', 'Perfect for holidays & events'],
    Icon: Sparkles,
  },
  bootleg: {
    background: 'linear-gradient(112deg, #0e1230 0%, #241057 54%, #5620A0 100%)',
    icon: 'bg-[#9935F0] text-white', label: 'text-white', body: 'text-[#E5DEFF]',
    mark: 'bg-[#9C38F1]', cta: 'bg-gradient-to-r from-[#B545F8] to-[#8123EF] text-white',
    benefits: ['Photo collage templates', 'Add your own photos', 'Bold streetwear style'],
    Icon: Star,
  },
  memorial: {
    background: 'linear-gradient(112deg, #ffeaf5 0%, #fae0f1 53%, #eac8f2 100%)',
    icon: 'bg-[#BE43E9] text-white', label: 'text-[#20213A]', body: 'text-[#565A74]',
    mark: 'bg-[#9C2BE8]', cta: 'bg-gradient-to-r from-[#C14CF2] to-[#8B2AEA] text-white',
    benefits: ['Meaningful tribute templates', 'Add photos, names & dates', 'Respectful, elegant designs'],
    Icon: Heart,
  },
  upload: {
    background: 'linear-gradient(112deg, #F9FCFF 0%, #F1F9FF 51%, #D6EFFF 100%)',
    icon: 'bg-[#198EF5] text-white', label: 'text-[#172034]', body: 'text-[#4F6075]',
    mark: 'bg-[#188AF1]', cta: 'bg-gradient-to-r from-[#1CACFF] to-[#0876EE] text-white',
    benefits: ['Use your own design', 'Full control of placement', 'Perfect for logos & artwork'],
    Icon: ImageUp,
  },
};

export default function CustomStudioV2DesignGallery({ paths, dispatch }) {
  return (
    <div data-gdp-v2-design-gallery="true">
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#79869D]">Step 2</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Choose a design path</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">
          Choose the design experience that fits how you want to create. Each path keeps its own artwork and settings.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:gap-5">
        {paths.map((path) => {
          const style = PATH_STYLE[path.id] || PATH_STYLE.upload;
          const Icon = style.Icon;
          return (
            <button
              data-gdp-v2-design-path={path.id}
              key={path.id}
              type="button"
              onClick={() => dispatch({ type: 'SET_DESIGN_PATH', designPath: path.id })}
              style={{ background: style.background }}
              className="group relative isolate min-w-0 overflow-hidden rounded-[20px] border border-[#E2E6EE]/80 text-left shadow-[0_8px_22px_rgba(18,30,53,.09)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#9DAFC5] hover:shadow-[0_16px_30px_rgba(18,30,53,.15)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#147DE5] motion-reduce:transform-none"
              aria-label={"Choose " + path.label}
            >
              <span className="relative block h-[140px] sm:absolute sm:inset-y-0 sm:right-[-12px] sm:h-full sm:w-[48%] xl:w-[60%]" aria-hidden="true">
                <span className="absolute inset-0">
                  <DesignPathPreview type={path.id} />
                </span>
              </span>
              <span className="relative z-10 flex min-h-[216px] flex-col items-start p-4 sm:min-h-[235px] sm:w-[64%] sm:p-5 xl:min-h-[251px] xl:w-[66%]">
                <span className="mb-2.5 flex items-center gap-2.5">
                  <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-sm " + style.icon}>
                    <Icon size={21} strokeWidth={2.5} />
                  </span>
                  <span className={"text-[16px] font-black leading-tight xl:text-lg " + style.label}>
                    {path.label}
                  </span>
                </span>
                <span className={"max-w-[260px] text-[12px] font-medium leading-[1.45] " + style.body}>
                  {path.description}
                </span>
                <span className="mt-3 flex flex-col gap-1.5">
                  {style.benefits.map((benefit) => (
                    <span key={benefit} className={"flex items-center gap-2 text-[12px] font-semibold leading-4 " + style.label}>
                      <span className={"grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-white " + style.mark}><Check size={12} strokeWidth={3} /></span>
                      <span>{benefit}</span>
                    </span>
                  ))}
                </span>
                <span className={"mt-auto inline-flex min-h-10 w-full max-w-[260px] items-center justify-center gap-2 rounded-full px-3 py-2 text-center text-[12px] font-black shadow-sm " + style.cta}>
                  Choose This Design <ArrowRight size={15} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] font-medium leading-relaxed text-slate-500">
        Sample artwork is for inspiration only. Your personalized garment preview appears in the next step.
      </p>
    </div>
  );
}
