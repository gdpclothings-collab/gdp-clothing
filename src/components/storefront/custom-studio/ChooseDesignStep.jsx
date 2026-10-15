import React from "react";
import { ArrowRight, Check } from "lucide-react";
import DesignPathPreview from "./DesignPathPreview";

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

  return (
    <div>
                <StepTitle eyebrow="Step 2 · Pick your style" title="CHOOSE YOUR DESIGN PATH" text="Discover what you can create. Choose a style you love, then make it your own in the next workspace." />
                <p className="mb-4 text-xs text-[#697184]">Each card shows an original example design — your finished artwork will be personalized.</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5">
                  {DESIGN_PATHS.map((path) => {
                    const Icon = path.icon;
                    const unavailable = path.id === "seasonal" && (placement !== "front" || groupGarments.length > 0);
                    return <button
                      key={path.id}
                      type="button"
                      disabled={unavailable}
                      aria-pressed={designPath === path.id}
                      onClick={() => {
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
                      }}
                      className={
                        "group relative min-w-0 overflow-hidden rounded-[22px] border-2 text-left shadow-[0_6px_22px_rgba(20,30,46,.08)] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#253D57] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none " +
                        (designPath === path.id
                          ? "border-[#288D89] bg-[#F5FFFD] ring-2 ring-[#288D89]/20"
                          : "border-[#E4E8EF] bg-white hover:-translate-y-1 hover:border-[#99B8C4] hover:shadow-[0_16px_36px_rgba(20,30,46,.15)]")
                      }
                    >
                      <span className="relative block h-[138px] overflow-hidden sm:h-[156px] xl:h-[172px]">
                        <DesignPathPreview type={path.id} />
                        <span className="absolute left-3 top-3 rounded-full border border-white/25 bg-[#1B263C]/35 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.13em] text-white backdrop-blur-sm">
                          Sample preview
                        </span>
                        {designPath === path.id && (
                          <span aria-hidden="true" className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white text-[#228D84] shadow">
                            <Check size={16} strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span className="flex min-h-[134px] items-start gap-3 p-4 sm:min-h-[151px] xl:min-h-[141px] xl:p-5">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#F0F3FA] text-[#253D60]">
                          <Icon size={21} strokeWidth={2} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col items-start">
                          <span className="text-base font-extrabold leading-tight text-[#162238] sm:text-[17px]">{path.label}</span>
                          <span className="mt-1.5 text-[12px] leading-relaxed text-[#657189]">{path.description}</span>
                          <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.06em] text-[#145A72]">
                            {unavailable ? "Front-only option" : designPath === path.id ? "Selected" : "Explore this design"}
                            {!unavailable && <ArrowRight size={14} className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />}
                          </span>
                        </span>
                      </span>
                    </button>;
                  })}
                </div>
                {placement !== "front" || groupGarments.length > 0 ? <p className="mt-4 text-sm text-[#706960]">Seasonal designs require front-only printing with no additional garment rows.</p> : null}
    </div>
  );
}
