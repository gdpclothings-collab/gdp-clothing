import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { mergeAboutPageBody } from "@/lib/aboutPageDefaults";

function StorySection({ eyebrow, title, body, dark = false }) {
  return (
    <section className={dark ? "bg-[#111] text-white" : "bg-background text-foreground"}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
        {eyebrow && (
          <div className="font-mono text-[11px] md:text-xs uppercase tracking-[0.22em] text-accent mb-4">
            {eyebrow}
          </div>
        )}
        <h2 className="font-display text-4xl md:text-6xl lg:text-7xl leading-[0.95] max-w-5xl">
          {title}
        </h2>
        <p className={`mt-7 max-w-4xl text-base md:text-lg leading-8 ${dark ? "text-white/72" : "text-muted-foreground"}`}>
          {body}
        </p>
      </div>
    </section>
  );
}

export default function AboutPageContent({ page }) {
  const content = mergeAboutPageBody(page?.body);

  return (
    <article className="overflow-hidden bg-background">
      <section className="relative min-h-[68vh] md:min-h-[76vh] flex items-end bg-[#101010] text-white">
        {content.heroImageUrl && (
          <img
            src={content.heroImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pb-12 md:pb-20 pt-28">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-white/75">
            <Sparkles size={13} className="text-accent" />
            {content.heroEyebrow}
          </div>
          <h1 className="font-display text-[clamp(4rem,12vw,9rem)] leading-[0.78] tracking-[-0.035em] mt-5 max-w-6xl">
            {content.heroTitle}
          </h1>
          <p className="mt-6 text-lg md:text-2xl text-white/78 max-w-2xl">
            {content.heroSubtitle}
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid lg:grid-cols-[0.78fr_1.22fr] gap-10 lg:gap-16 items-start">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                {content.founderKicker}
              </div>
              <h2 className="font-display text-5xl md:text-7xl leading-[0.9] mt-4">
                {content.founderTitle}
              </h2>
            </div>
            <p className="text-base md:text-lg leading-8 text-muted-foreground">
              {content.founderBody}
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-px bg-border border border-border mt-12 md:mt-16">
            {content.stats.map((stat, index) => (
              <div key={index} className="bg-background px-6 py-8 md:py-10">
                <div className="font-display text-5xl md:text-6xl">{stat.value}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground mt-2">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StorySection
        eyebrow="WEAR YOUR STORY"
        title={content.memoryTitle}
        body={content.memoryBody}
        dark
      />

      <section className="bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                THE CRAFT
              </div>
              <h2 className="font-display text-5xl md:text-7xl leading-[0.92] mt-4">
                {content.experienceTitle}
              </h2>
              <p className="mt-7 text-base md:text-lg leading-8 text-muted-foreground">
                {content.experienceBody}
              </p>
            </div>
            <div className="order-1 lg:order-2 aspect-[4/5] bg-[#efefef] overflow-hidden">
              {content.storyImageUrl ? (
                <img
                  src={content.storyImageUrl}
                  alt="GDP Clothing custom apparel"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center font-display text-5xl text-black/15">
                  GDP
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <StorySection
        eyebrow="INDEPENDENT BY DESIGN"
        title={content.dreamTitle}
        body={content.dreamBody}
        dark
      />

      <section className="bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="border border-border p-6 md:p-10">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                GOOD PEOPLE. DOPE CLOTHES.
              </div>
              <h2 className="font-display text-4xl md:text-6xl leading-[0.94] mt-4">
                {content.standsTitle}
              </h2>
              <p className="mt-6 text-base md:text-lg leading-8 text-muted-foreground">
                {content.standsBody}
              </p>
            </div>
            <div className="border border-border p-6 md:p-10 bg-[#111] text-white">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                THE VISION
              </div>
              <h2 className="font-display text-4xl md:text-6xl leading-[0.94] mt-4">
                {content.cultureTitle}
              </h2>
              <p className="mt-6 text-base md:text-lg leading-8 text-white/70">
                {content.cultureBody}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-accent text-accent-foreground">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
          <div className="max-w-5xl">
            <div className="font-mono text-xs uppercase tracking-[0.22em] opacity-75">
              GDP CLOTHING
            </div>
            <h2 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.86] mt-4">
              {content.ctaTitle}
            </h2>
            <p className="mt-6 text-lg md:text-xl max-w-2xl opacity-80">
              {content.ctaBody}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to={content.ctaUrl || "/custom-studio"}
                className="inline-flex items-center justify-center gap-2 min-h-12 px-5 bg-black text-white font-bold uppercase tracking-[0.08em] text-sm"
              >
                {content.ctaLabel}
                <ArrowRight size={16} />
              </Link>
              <Link
                to={content.secondaryCtaUrl || "/shop"}
                className="inline-flex items-center justify-center min-h-12 px-5 border border-black/35 font-bold uppercase tracking-[0.08em] text-sm"
              >
                {content.secondaryCtaLabel}
              </Link>
            </div>
            <div className="mt-10 font-display text-2xl md:text-3xl">
              {content.closingLine}
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
