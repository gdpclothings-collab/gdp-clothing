import React from "react";
import { ArrowRight, Check } from "lucide-react";
import DesignPathPreview from "./DesignPathPreview";

const PRESENTATION = {
  seasonal: {
    background: "linear-gradient(118deg, #FFF4E7 2%, #FFF1E5 49%, #DCEBF8 100%)",
    icon: "bg-[#FF8126] text-white",
    title: "text-[#172038]",
    muted: "text-[#505D6D]",
    checklist: "text-[#283644]",
    tick: "bg-[#FF941C] text-white",
    cta: "bg-gradient-to-r from-[#FFD46C] to-[#FFAD35] text-[#1C2636]",
    benefits: ["Year-round seasonal artwork", "Easy to customize", "Perfect for holidays & events"]
  },
  bootleg: {
    background: "linear-gradient(118deg, #11142E 2%, #26135D 54%, #5B1EA8 100%)",
    icon: "bg-[#9639F2] text-white",
    title: "text-white",
    muted: "text-white/85",
    checklist: "text-white",
    tick: "bg-[#9233EC] text-white",
    cta: "bg-gradient-to-r from-[#B441FA] to-[#8224EB] text-white",
    benefits: ["Photo collage templates", "Add your own photos", "Bold streetwear designs"]
  },
  memorial: {
    background: "linear-gradient(118deg, #FCE8F6 2%, #F8DEEF 50%, #EAC5ED 100%)",
    icon: "bg-[#C13FE8] text-white",
    title: "text-[#182039]",
    muted: "text-[#4D5971]",
    checklist: "text-[#283644]",
    tick: "bg-[#8D2AD7] text-white",
    cta: "bg-gradient-to-r from-[#C447F1] to-[#8927E7] text-white",
    benefits: ["Meaningful tribute templates", "Add photos, names & dates", "Respectful, elegant designs"]
  },
  upload: {
    background: "linear-gradient(118deg, #F7FAFF 2%, #F0F9FF 51%, #D9F0FF 100%)",
    icon: "bg-[#188CF2] text-white",
    title: "text-[#182039]",
    muted: "text-[#4D5971]",
    checklist: "text-[#283644]",
    tick: "bg-[#158CF3] text-white",
    cta: "bg-gradient-to-r from-[#19A7FE] to-[#0978E9] text-white",
    benefits: ["Use your own design", "Full control of placement", "Ideal for logos, art & ideas"]
  }
};

export default function ChooseDesignStep({ model }) {
  const {
    StepTitle,
    DESIGN_PATHS,
    placement,
    groupGarments,
    designPath,
    setDesignPath,
    setMemorialNameConfirmed,
    setSeasonalMode,
    setDesignStylesBySide,
    setPreviewSide,
    setArtworkStates,
    defaultArtworkStates,
    setDesignMood,
    setDesignIntensity,
    setStep
  } = model;

  const choose = (path) => {
    setDesignPath(path.id);
    setMemorialNameConfirmed(false);
    if (path.id === "seasonal") {
      setSeasonalMode(true);
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      return;
    }
    if (path.id === "upload") {
      setDesignStylesBySide({ front: "Own artwork", back: "Own artwork" });
      setPreviewSide("front");
      setArtworkStates(defaultArtworkStates());
      setDesignMood("Original");
      setDesignIntensity(1);
    } else if (path.id === "bootleg" || path.id === "memorial") {
      setDesignStylesBySide({ front: "", back: "" });
      setPreviewSide("front");
      setDesignMood("Original");
      setDesignIntensity(3);
    }
    setStep(3);
    window.requestAnimationFrame(() => {
      document.getElementById("custom-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div>
      <StepTitle
        eyebrow="Step 2 · Your design"
        title="CHOOSE YOUR DESIGN PATH"
        text="Choose the design experience that fits how you want to create. Each path keeps its own artwork and settings."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:gap-5" aria-label="Design experiences">
        {DESIGN_PATHS.map((path) => {
          const theme = PRESENTATION[path.id] || PRESENTATION.upload;
          const Icon = path.icon;
          const unavailable = path.id === "seasonal" && (placement !== "front" || groupGarments.length > 0);
          const selected = designPath === path.id;

          return (
            <button
              key={path.id}
              type="button"
              disabled={unavailable}
              aria-pressed={selected}
              onClick={() => choose(path)}
              style={{ background: theme.background }}
              className={
                "group relative isolate w-full min-w-0 overflow-hidden rounded-[20px] border-2 text-left shadow-[0_8px_24px_rgba(18,28,48,.09)] transition-all duration-200 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#168AF2] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none " +
                (selected
                  ? "border-[#238B91] ring-2 ring-[#238B91]/25"
                  : "border-white/70 hover:-translate-y-0.5 hover:border-[#AFC5D9] hover:shadow-[0_16px_32px_rgba(18,28,48,.14)]")
              }
            >
              <span className="relative block h-[155px] overflow-hidden sm:absolute sm:inset-y-0 sm:right-[-15px] sm:h-full sm:w-[58%] lg:right-[-18px] lg:w-[59%]" aria-hidden="true">
                <span className="absolute inset-0 pointer-events-none">
                  <DesignPathPreview type={path.id} />
                </span>
              </span>
              <span className="relative z-10 flex min-h-[235px] flex-col items-start p-4 sm:w-[64%] sm:min-h-[251px] sm:p-5 lg:w-[66%] xl:p-5">
                <span className="mb-2.5 flex items-center gap-2.5">
                  <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-sm " + theme.icon}>
                    <Icon size={21} strokeWidth={2.6} />
                  </span>
                  <span className={"text-[17px] font-extrabold leading-tight sm:text-lg " + theme.title}>
                    {path.label}
                  </span>
                </span>
                <span className={"max-w-[275px] text-[12px] leading-[1.45] " + theme.muted}>
                  {path.description}
                </span>
                <span className="mt-3 flex flex-col gap-1.5">
                  {theme.benefits.map((benefit) => (
                    <span key={benefit} className={"flex items-start gap-2 text-[12px] leading-[1.35] " + theme.checklist}>
                      <span className={"mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full " + theme.tick}>
                        <Check size={11} strokeWidth={3} />
                      </span>
                      <span>{benefit}</span>
                    </span>
                  ))}
                </span>
                <span className={"mt-auto inline-flex min-h-10 w-full max-w-[245px] items-center justify-center gap-2 rounded-full px-3 py-2 text-center text-[12px] font-extrabold shadow-sm transition-transform group-hover:scale-[1.02] motion-reduce:transform-none " + theme.cta}>
                  {unavailable ? "Front print only" : selected ? "Selected" : "Choose This Design"}
                  {!unavailable && (selected ? <Check size={15} /> : <ArrowRight size={15} />)}
                </span>
              </span>
              <span className="sr-only">{selected ? "Current choice." : ""} {unavailable ? "Unavailable for this garment setup." : "Opens this design experience."}</span>
              {selected && (
                <span className="absolute right-3 top-3 z-20 grid h-7 w-7 place-items-center rounded-full bg-white text-[#188A8A] shadow" aria-hidden="true">
                  <Check size={17} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[#687386]">
        Illustrated examples only. Your actual print preview and available designs will be shown during customization.
      </p>
      {(placement !== "front" || groupGarments.length > 0) && (
        <p className="mt-3 text-sm text-[#706960]">
          Seasonal designs require front-only printing with no additional garment rows.
        </p>
      )}
    </div>
  );
}
