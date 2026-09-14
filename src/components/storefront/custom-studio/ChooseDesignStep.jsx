import React from "react";
import { ArrowRight } from "lucide-react";

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
                <StepTitle eyebrow="Start your design" title="CHOOSE YOUR DESIGN PATH" text="Choose the kind of design you want. You will customize everything in the next workspace." />
                <div className="grid sm:grid-cols-2 gap-4">
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
                      className={"rounded-[20px] border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 " + (designPath === path.id ? "border-accent bg-accent/[0.055] shadow-sm" : "border-[#ddd7ce] bg-white hover:border-accent hover:-translate-y-0.5")}
                    >
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F1F5F8] text-[#17324D]"><Icon size={20}/></span>
                      <div className="mt-4 text-lg font-extrabold">{path.label}</div>
                      <p className="mt-1 text-sm leading-relaxed text-[#6b645c]">{path.description}</p>
                      <div className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.08em] text-accent">{designPath === path.id ? "Selected" : "Choose this path"} <ArrowRight size={13} className="inline"/></div>
                    </button>;
                  })}
                </div>
                {placement !== "front" || groupGarments.length > 0 ? <p className="mt-4 text-sm text-[#706960]">Seasonal designs require front-only printing with no additional garment rows.</p> : null}
    </div>
  );
}
