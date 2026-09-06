import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Heart, ShieldCheck, Sparkles, Truck } from "lucide-react";

const categories = [
  { index: "01", title: "T-Shirts", subtitle: "Everyday / graphic", to: "/shop?category=T-Shirt" },
  { index: "02", title: "Custom", subtitle: "Photo / memory", to: "/custom-studio" },
  { index: "03", title: "Pets", subtitle: "Portrait / tribute", to: "/custom-studio" },
  { index: "04", title: "Moments", subtitle: "Birthday / event", to: "/custom-studio" },
];

const process = [
  { number: "01", title: "Send the story", text: "Upload the photos, names, references and the moment behind the shirt." },
  { number: "02", title: "Choose the direction", text: "Pick your garment, size, colour and the visual style you want GDP to build." },
  { number: "03", title: "Approve the proof", text: "Review the design before anything is printed. Changes happen before production." },
  { number: "04", title: "Wear the result", text: "We print the approved piece and prepare it for pickup or shipping." },
];

function CategoryTile({ item }) {
  return (
    <Link
      to={item.to}
      className="group relative min-h-[220px] overflow-hidden border border-black/10 bg-black text-white sm:min-h-[300px]"
    >
      <div className="gdp-editorial-grid absolute inset-0 opacity-45" />
      <div className="absolute -right-2 -top-6 font-display text-[150px] leading-none text-white/[0.045] sm:text-[210px]">
        {item.index}
      </div>
      <div className="absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
        {item.index}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <div className="font-display text-4xl leading-none tracking-wide sm:text-5xl">{item.title}</div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/15 pt-3 text-[10px] font-black uppercase tracking-[0.15em] text-white/55">
          <span>{item.subtitle}</span>
          <ArrowUpRight size={15} />
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="bg-[#f7f6f1] text-black">
      <section className="relative min-h-[640px] overflow-hidden bg-black text-white md:min-h-[760px]">
        <img
          src="/images/gdp-hero-approved.webp"
          alt="GDP Clothing custom streetwear"
          className="absolute inset-0 h-full w-full object-cover object-[66%_center] md:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/72 to-black/15" />
        <div className="gdp-editorial-grid absolute inset-0 opacity-60" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/35 to-transparent" />

        <div className="relative mx-auto flex min-h-[640px] max-w-[1500px] flex-col justify-between px-5 py-7 md:min-h-[760px] lg:px-8 lg:py-9">
          <div className="flex items-start justify-between gap-4 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45 sm:text-[10px]">
            <span>GDP / Saskatchewan / 2026</span>
            <span className="hidden sm:block">Custom culture / made to wear</span>
          </div>

          <div className="max-w-[760px] pb-8 md:pb-12">
            <div className="gdp-reveal mb-5 inline-flex items-center gap-2 border border-white/20 bg-black/25 px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e11d2e]" />
              Drop 001 / Custom Series
            </div>
            <h1 className="gdp-reveal gdp-reveal-delay font-display text-[78px] leading-[0.78] tracking-[0.015em] sm:text-[110px] md:text-[138px] lg:text-[164px]">
              WEAR YOUR<br />STORY.
            </h1>
            <div className="mt-6 max-w-xl border-l border-[#e11d2e] pl-4 text-sm leading-6 text-white/68 sm:text-base">
              Photo-driven custom apparel, streetwear and one-off pieces built around the people, pets and moments that matter.
            </div>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link to="/shop" className="inline-flex min-h-12 items-center gap-3 bg-white px-6 text-[11px] font-black uppercase tracking-[0.14em] text-black transition hover:bg-[#e11d2e] hover:text-white">
                Shop the drop <ArrowRight size={16} />
              </Link>
              <Link to="/custom-studio" className="inline-flex min-h-12 items-center gap-3 border border-white/35 bg-black/20 px-6 text-[11px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm transition hover:border-white hover:bg-white hover:text-black">
                Create your shirt <Sparkles size={15} />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/15 pt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40 sm:grid-cols-3">
            <span>01 / Original GDP builds</span>
            <span>02 / Proof before print</span>
            <span>03 / Canada + US shipping</span>
          </div>
        </div>
      </section>

      <section className="border-b border-black/10 bg-[#f7f6f1]">
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: "Fast shipping", text: "Across Canada" },
            { icon: ShieldCheck, title: "Proof first", text: "Approve before print" },
            { icon: Sparkles, title: "Custom built", text: "Your photos + story" },
            { icon: Heart, title: "Made local", text: "Saskatoon, SK" },
          ].map((item, index) => (
            <div key={item.title} className={"flex min-h-[105px] items-center gap-3 px-4 py-5 sm:px-6 " + (index > 0 ? "border-l border-black/10" : "")}>
              <item.icon size={21} strokeWidth={1.6} className="shrink-0" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] sm:text-[11px]">{item.title}</div>
                <div className="mt-1 text-[10px] text-black/45 sm:text-xs">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 py-12 sm:px-5 lg:px-8 lg:py-16">
        <div className="mb-7 flex items-end justify-between gap-5 border-b border-black/15 pb-5">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-black/45">Shop by direction</div>
            <h2 className="mt-2 font-display text-5xl leading-none tracking-wide sm:text-6xl md:text-7xl">FIND YOUR FORMAT</h2>
          </div>
          <Link to="/shop" className="hidden items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] sm:flex">
            Shop all <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {categories.map((item) => <CategoryTile key={item.title} item={item} />)}
        </div>
      </section>


      <section className="gdp-soft-grid mx-auto max-w-[1500px] px-4 py-14 sm:px-5 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-black/45">Custom studio / workflow</div>
            <h2 className="mt-2 max-w-xl font-display text-6xl leading-[0.88] tracking-wide sm:text-7xl md:text-8xl">
              YOUR IDEA.<br />OUR BUILD.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-black/55">
              The custom experience is built around clarity: tell us the story, choose the direction, approve the proof, then we print.
            </p>
            <Link to="/custom-studio" className="mt-7 inline-flex min-h-12 items-center gap-3 bg-black px-6 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#e11d2e]">
              Start your design <ArrowRight size={16} />
            </Link>
          </div>

          <div className="border-t border-black">
            {process.map((item) => (
              <div key={item.number} className="grid gap-3 border-b border-black/20 py-6 sm:grid-cols-[72px_1fr_1.25fr] sm:items-start">
                <div className="font-mono text-[10px] text-[#e11d2e]">{item.number}</div>
                <div className="text-sm font-black uppercase tracking-[0.12em]">{item.title}</div>
                <p className="text-sm leading-6 text-black/52">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="gdp-editorial-grid flex min-h-[460px] items-center bg-black px-5 py-14 text-white sm:px-8 lg:px-14">
        <div className="mx-auto w-full max-w-[1500px]">
          <div className="max-w-3xl">
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">GDP / custom culture</div>
            <h2 className="mt-3 font-display text-6xl leading-[0.86] tracking-wide sm:text-7xl lg:text-8xl">
              NOT JUST<br />A T-SHIRT.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-6 text-white/55 sm:text-base">
              GDP turns photos and memories into wearable keepsakes. The goal is a piece that feels personal before it feels commercial.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link to="/custom-studio" className="inline-flex min-h-12 items-center gap-3 bg-white px-6 text-[11px] font-black uppercase tracking-[0.14em] text-black transition hover:bg-[#e11d2e] hover:text-white">
                Build yours <ArrowRight size={16} />
              </Link>
              <Link to="/shop?filter=new" className="inline-flex min-h-12 items-center gap-3 border border-white/25 px-6 text-[11px] font-black uppercase tracking-[0.14em] text-white transition hover:border-white">
                View latest drop <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
