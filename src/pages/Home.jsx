import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, ShieldCheck, Shirt, Truck } from "lucide-react";
import Seo from "@/components/Seo";

const CATEGORY_SPRITE = "/images/gdp-sold-categories.webp";

const categories = [
  { title: "T-Shirts", subtitle: "Everyday Essentials", position: "0% 50%", to: "/shop?category=T-Shirt" },
  { title: "Custom Tees", subtitle: "Your Design, Our Print", position: "33.333% 50%", to: "/custom-studio" },
  { title: "Pet Designs", subtitle: "Photos Into Keepsakes", position: "66.666% 50%", to: "/custom-studio" },
  { title: "Birthday Tees", subtitle: "Made For The Moment", position: "100% 50%", to: "/custom-studio" },
];

const benefits = [
  { icon: Truck, title: "Fast & Reliable Shipping", text: "Across Canada" },
  { icon: ShieldCheck, title: "Premium Quality", text: "Built to last" },
  { icon: Shirt, title: "Custom Designs", text: "Bring your ideas to life" },
  { icon: Heart, title: "Support Local", text: "Small Business. Big Dreams." },
];

const soldSamples = [
  { title: "Custom Family Graphic Tee", price: "$34.99", image: "/images/gdp-sold-family.webp" },
  { title: "Custom Photo Collage Tee", price: "$34.99", sprite: "33.333% 50%" },
  { title: "Custom Pet Photo Tee", price: "$36.99", image: "/images/gdp-sold-pets.webp" },
  { title: "Custom Name Pet Tee", price: "$34.99", sprite: "66.666% 50%" },
  { title: "Birthday Custom Tee", price: "$34.99", sprite: "100% 50%" },
];

function SpriteImage({ position, className = "" }) {
  return (
    <div
      className={className}
      style={{
        backgroundImage: `url(${CATEGORY_SPRITE})`,
        backgroundSize: "400% 100%",
        backgroundPosition: position,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

function CategoryTile({ item }) {
  return (
    <Link to={item.to} className="group relative overflow-hidden bg-neutral-900 aspect-[1.55/1]">
      <SpriteImage
        position={item.position}
        className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/5" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
        <div className="font-display text-3xl leading-none sm:text-4xl">{item.title}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/80 sm:text-sm">
          {item.subtitle} <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  );
}

function SampleCard({ item }) {
  return (
    <article className="group min-w-0">
      <Link to="/custom-studio" className="relative block overflow-hidden bg-[#efefef]">
        <div className="aspect-[4/5] overflow-hidden">
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <SpriteImage
              position={item.sprite}
              className="h-full w-full transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
        <span className="absolute left-2 top-2 bg-black px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white sm:left-3 sm:top-3 sm:text-[10px]">
          Sold Sample
        </span>
      </Link>
      <div className="pt-3">
        <Link to="/custom-studio" className="line-clamp-2 text-xs font-semibold hover:underline sm:text-sm">
          {item.title}
        </Link>
        <div className="mt-1 text-sm font-semibold">{item.price}</div>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          <span className="h-4 w-4 rounded-full border border-black bg-black sm:h-5 sm:w-5" />
          <span className="h-4 w-4 rounded-full border border-neutral-400 bg-white sm:h-5 sm:w-5" />
          <span className="h-4 w-4 rounded-full border border-neutral-400 bg-neutral-300 sm:h-5 sm:w-5" />
        </div>
        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">Made by GDP</div>
      </div>
    </article>
  );
}

export default function Home() {
  return (
    <div className="bg-white text-black">
      <Seo title="Custom Apparel & Personalized Streetwear" description="GDP Clothing creates custom tees, photo designs, personalized streetwear and wearable keepsakes from Saskatoon, Saskatchewan." path="/" />
      <section className="relative min-h-[490px] overflow-hidden bg-black text-white md:min-h-[610px]">
        <img
          src="/images/gdp-hero-approved.webp"
          alt="GDP Clothing custom streetwear"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[67%_center] md:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/5" />
        <div className="relative mx-auto flex min-h-[490px] max-w-[1500px] items-center px-5 py-10 md:min-h-[610px] lg:px-10">
          <div className="max-w-[630px]">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.38em] text-white/80">GDP Clothing</p>
            <h1 className="font-display text-[68px] leading-[0.82] sm:text-[88px] md:text-[112px] lg:text-[128px]">
              WEAR YOUR<br />STORY
            </h1>
            <div className="mt-3 h-[7px] w-56 -skew-x-12 bg-[#e11d2e] sm:w-72" />
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.26em] text-white/90 sm:text-sm">
              Custom Apparel · Streetwear · Good Vibes
            </p>
            <p className="mt-3 max-w-lg text-sm text-white/70 sm:text-base">
              Turn photos, memories, people, pets and milestones into clothing made to be remembered.
            </p>
            <Link
              to="/shop"
              className="mt-7 inline-flex items-center gap-3 bg-white px-7 py-4 text-sm font-black uppercase tracking-wide text-black transition hover:bg-[#e11d2e] hover:text-white"
            >
              Shop Now <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0a0a0a] text-white">
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 lg:grid-cols-4">
          {benefits.map((item, index) => (
            <div
              key={item.title}
              className={`flex min-h-[96px] items-center gap-3 px-4 py-5 sm:gap-4 sm:px-6 lg:px-8 ${index ? "lg:border-l lg:border-white/15" : ""}`}
            >
              <item.icon size={28} strokeWidth={1.7} className="shrink-0" />
              <div>
                <div className="text-[11px] font-black uppercase leading-tight sm:text-sm">{item.title}</div>
                <div className="mt-1 text-[10px] text-white/60 sm:text-xs">{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5 lg:px-7">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {categories.map((item) => <CategoryTile key={item.title} item={item} />)}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">Recently Made</h2>
            <p className="mt-1 text-xs text-neutral-500 sm:text-sm">Real GDP sold samples. Custom made from customer ideas.</p>
          </div>
          <Link to="/shop" className="hidden items-center gap-2 text-sm font-semibold hover:underline sm:flex">
            View All Products <ArrowRight size={15} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 lg:gap-x-5 xl:grid-cols-5">
          {soldSamples.map((item) => <SampleCard key={item.title} item={item} />)}
        </div>
      </section>

      <section className="grid md:grid-cols-3">
        <Link to="/custom-studio" className="group relative min-h-[280px] overflow-hidden bg-black text-white">
          <img src="/images/gdp-sold-family.webp" alt="GDP custom tee example" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <h3 className="font-display text-5xl leading-none">Custom Tees</h3>
            <p className="mt-1 text-sm text-white/75">Turn your ideas into reality.</p>
            <span className="mt-5 inline-flex items-center gap-2 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-black">
              Start Your Design <ArrowRight size={15} />
            </span>
          </div>
        </Link>

        <Link to="/pages/about" className="group relative min-h-[280px] overflow-hidden bg-black text-white">
          <SpriteImage position="0% 50%" className="absolute inset-0 transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <h3 className="font-display text-5xl leading-none">Our Story</h3>
            <p className="mt-1 text-sm text-white/75">Built around memories, creativity and community.</p>
            <span className="mt-5 inline-flex items-center gap-2 border border-white px-5 py-3 text-xs font-black uppercase tracking-wide">
              Learn More <ArrowRight size={15} />
            </span>
          </div>
        </Link>

        <Link to="/shop" className="group relative min-h-[280px] overflow-hidden bg-black text-white">
          <img src="/images/gdp-sold-pets.webp" alt="GDP Clothing print quality sample" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/65" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <h3 className="font-display text-5xl leading-none">Quality. Bigger Moves.</h3>
            <p className="mt-1 text-sm text-white/75">Made to turn your photos into wearable keepsakes.</p>
            <span className="mt-5 inline-flex items-center gap-2 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-black">
              Shop Now <ArrowRight size={15} />
            </span>
          </div>
        </Link>
      </section>
    </div>
  );
}
