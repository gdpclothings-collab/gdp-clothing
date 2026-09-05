import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Upload, Palette, Eye, CreditCard, Printer, Truck, Star } from "lucide-react";
import { useProducts } from "@/lib/useProducts";
import ProductCard from "@/components/storefront/ProductCard";
import { Image } from "@/components/ui/image";

const STEPS = [
  { icon: Upload, label: "Upload Photo", desc: "Drop your memory — people, pets, moments." },
  { icon: Palette, label: "Choose Style", desc: "Vintage bootleg, retro, memorial & more." },
  { icon: Eye, label: "Preview", desc: "See your apparel before it's made." },
  { icon: CreditCard, label: "Order", desc: "Secure checkout in CAD." },
  { icon: Printer, label: "Production", desc: "GDP produces it in-house or via POD." },
  { icon: Truck, label: "Delivery", desc: "Shipped to your door, worldwide." },
];

const HERO_IMG = "/images/gdp-hero.svg";
const PROCESS_IMG = "/images/gdp-process.svg";
const COUPLES_IMG = "/images/gdp-couples.svg";

export default function Home() {
  const { products } = useProducts({ status: "active" });
  const bestSellers = products.filter(p => p.bestSeller).slice(0, 4);
  const showcase = bestSellers.length ? bestSellers : products.slice(0, 4);

  return (
    <div className="grain">
      {/* HERO */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <Image src={HERO_IMG} alt="GDP custom hoodies" fittingType="fill" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/70 to-transparent" />
        <div className="relative max-w-[1500px] mx-auto px-4 lg:px-8 py-20 md:py-32 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-block font-mono text-xs uppercase tracking-[0.3em] text-accent border border-accent px-3 py-1 mb-6">
              Saskatoon · Custom Streetwear
            </span>
            <h1 className="font-display text-6xl md:text-8xl xl:text-9xl leading-[0.85] tracking-tight">
              DESIGN YOUR DREAM,<br />WEAR YOUR VISION!
            </h1>
            <p className="mt-6 text-primary-foreground/80 max-w-md text-lg">
              Transform meaningful photos into premium, personalized streetwear. Vintage bootleg, retro, memorial & more — printed in-house or on-demand.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/custom-studio" className="bg-accent text-accent-foreground px-7 py-4 font-bold uppercase tracking-wide hover:opacity-90 inline-flex items-center gap-2">
                Open Custom Studio <ArrowRight size={18} />
              </Link>
              <Link to="/shop?filter=best" className="border border-primary-foreground/30 px-7 py-4 font-bold uppercase tracking-wide hover:border-accent hover:text-accent">
                Shop Best Sellers
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE SHOWCASE */}
      <section className="bg-primary text-primary-foreground border-t border-primary-foreground/10">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {STEPS.map((s, i) => (
              <div key={s.label} className="group flex flex-col items-center text-center">
                <div className="h-14 w-14 border border-primary-foreground/20 flex items-center justify-center mb-2 group-hover:border-accent group-hover:text-accent transition-colors">
                  <s.icon size={22} />
                </div>
                <div className="font-mono text-[10px] text-accent">0{i + 1}</div>
                <div className="text-xs font-semibold uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BEST SELLERS */}
      <section className="max-w-[1500px] mx-auto px-4 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Most Wanted</span>
            <h2 className="font-display text-5xl md:text-6xl mt-1 leading-none">BEST SELLERS</h2>
          </div>
          <Link to="/shop?filter=best" className="hidden sm:flex items-center gap-2 text-sm font-bold uppercase hover:text-accent">
            View All <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
          {showcase.map(p => <ProductCard key={p.id} product={p} />)}
          {showcase.length === 0 && <p className="col-span-full text-muted-foreground">Products loading…</p>}
        </div>
      </section>

      {/* DESIGN YOUR OWN BANNER */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-16 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-accent">The Atelier</span>
            <h2 className="font-display text-5xl md:text-6xl mt-2 leading-none">DESIGN YOUR OWN</h2>
            <p className="mt-4 text-primary-foreground/80 max-w-md">
              Choose the occasion and style, upload up to 10 photos, tell us the story, then place the order. A GDP designer creates a proof for your approval before production.
            </p>
            <Link to="/custom-studio" className="mt-6 inline-flex items-center gap-2 bg-accent text-accent-foreground px-6 py-3 font-bold uppercase tracking-wide hover:opacity-90">
              Start Designing <ArrowRight size={18} />
            </Link>
          </div>
          <div className="aspect-[4/3] overflow-hidden">
            <Image src={COUPLES_IMG} alt="Custom couples hoodies by GDP" fittingType="fill" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-[1500px] mx-auto px-4 lg:px-8 py-16">
        <div className="text-center mb-10">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">The Process</span>
          <h2 className="font-display text-5xl md:text-6xl mt-1 leading-none">HOW IT WORKS</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.slice(0, 3).map((s, i) => (
            <div key={s.label} className="border border-border p-6 bg-card hover:border-accent transition-colors">
              <div className="font-mono text-sm text-accent mb-3">STEP 0{i + 1}</div>
              <s.icon size={28} className="mb-3" />
              <h3 className="font-bold uppercase tracking-wide mb-1">{s.label}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BEFORE / AFTER */}
      <section className="bg-secondary border-y border-border">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-16">
          <div className="text-center mb-10">
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Transformation</span>
            <h2 className="font-display text-5xl md:text-6xl mt-1 leading-none">YOUR MEMORY → YOUR GEAR</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { img: PROCESS_IMG, label: "1. Original Photo" },
              { img: HERO_IMG, label: "2. Finished GDP Design" },
              { img: COUPLES_IMG, label: "3. Printed Product" },
            ].map((b, i) => (
              <div key={i} className="relative aspect-[4/3] overflow-hidden">
                <Image src={b.img} alt={b.label} fittingType="fill" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground px-4 py-2">
                  <span className="font-mono text-xs uppercase tracking-wide">{b.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY GDP */}
      <section className="max-w-[1500px] mx-auto px-4 lg:px-8 py-16 grid md:grid-cols-3 gap-6">
        {[
          { t: "In-House Production", d: "GDP operates its own DTF & printing in Saskatoon — full quality control, fast turnaround." },
          { t: "Hybrid POD Network", d: "Routed to Printful, Printify or Gelato when it fits — more products, fewer stockouts." },
          { t: "Proof Before Print", d: "Every custom order gets a digital proof you approve before anything is printed." },
        ].map(f => (
          <div key={f.t} className="border-l-2 border-accent pl-5">
            <h3 className="font-bold uppercase tracking-wide text-lg">{f.t}</h3>
            <p className="text-sm text-muted-foreground mt-1">{f.d}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-accent text-accent-foreground">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-16 text-center">
          <h2 className="font-display text-5xl md:text-7xl leading-none">READY TO WEAR YOUR VISION?</h2>
          <Link to="/custom-studio" className="mt-6 inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 font-bold uppercase tracking-wide hover:opacity-90">
            Start Your Custom Design <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}