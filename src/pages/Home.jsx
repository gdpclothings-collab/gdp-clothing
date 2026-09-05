import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Heart,
  ShieldCheck,
  Shirt,
  Truck,
} from "lucide-react";
import { useProducts } from "@/lib/useProducts";
import ProductCard from "@/components/storefront/ProductCard";
import { Image } from "@/components/ui/image";

const CATEGORIES = [
  {
    title: "T-Shirts",
    subtitle: "Everyday essentials",
    image: "/images/gdp-tshirt.svg",
    to: "/shop?category=T-Shirt",
  },
  {
    title: "Hoodies",
    subtitle: "Stay warm. Stay real.",
    image: "/images/gdp-crewneck.svg",
    to: "/shop?category=Hoodie",
  },
  {
    title: "Custom Tees",
    subtitle: "Your design. Our print.",
    image: "/images/gdp-process.svg",
    to: "/custom-studio",
  },
  {
    title: "Collections",
    subtitle: "Explore all",
    image: "/images/gdp-couples.svg",
    to: "/shop",
  },
];

const FEATURES = [
  { icon: Truck, title: "Fast & Reliable Shipping", text: "Across Canada" },
  { icon: ShieldCheck, title: "Premium Quality", text: "Built to last" },
  { icon: Shirt, title: "Custom Designs", text: "Bring your ideas to life" },
  { icon: Heart, title: "Support Local", text: "Small business. Big dreams." },
];

const FALLBACKS = [
  { title: "Custom Photo Tee", price: "34.99", image: "/images/gdp-tshirt.svg" },
  { title: "Memory Collage Tee", price: "36.99", image: "/images/gdp-couples.svg" },
  { title: "GDP Essential Hoodie", price: "64.99", image: "/images/gdp-crewneck.svg" },
  { title: "Pet Tribute Tee", price: "36.99", image: "/images/gdp-process.svg" },
  { title: "Birthday Custom Tee", price: "34.99", image: "/images/gdp-tshirt.svg" },
];

function FallbackProduct({ item }) {
  return (
    <article className="group">
      <Link to="/custom-studio" className="block relative overflow-hidden bg-[#efefef]">
        <div className="aspect-[4/5] overflow-hidden">
          <Image
            src={item.image}
            alt={item.title}
            fittingType="fill"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <span className="absolute top-3 left-3 bg-black text-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide">
          Best Seller
        </span>
      </Link>
      <div className="pt-3">
        <Link to="/custom-studio" className="text-sm font-semibold hover:underline">
          {item.title}
        </Link>
        <div className="mt-1 font-mono text-sm">${item.price}</div>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          <span className="h-5 w-5 rounded-full border border-black bg-black" />
          <span className="h-5 w-5 rounded-full border border-neutral-400 bg-white" />
          <span className="h-5 w-5 rounded-full border border-neutral-400 bg-neutral-300" />
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const { products } = useProducts({ status: "active" });
  const bestSellers = products.filter((p) => p.bestSeller).slice(0, 5);
  const showcase = bestSellers.length ? bestSellers : products.slice(0, 5);

  return (
    <div className="bg-white text-black">
      {/* HERO */}
      <section className="relative min-h-[520px] md:min-h-[610px] overflow-hidden bg-[#0a0a0a] text-white">
        <div className="absolute inset-0">
          <Image
            src="/images/gdp-hero.svg"
            alt="GDP Clothing custom streetwear"
            fittingType="fill"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/25" />
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_80%_20%,white_0,transparent_25%)]" />

        <div className="relative mx-auto flex min-h-[520px] md:min-h-[610px] max-w-[1500px] items-center px-5 lg:px-10">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-white/70">
              GDP Clothing
              <span className="h-px w-10 bg-[#e11d2e]" />
            </div>

            <h1 className="font-display text-[72px] leading-[0.82] sm:text-[92px] md:text-[120px] lg:text-[138px]">
              WEAR YOUR
              <br />
              STORY
            </h1>

            <div className="mt-3 h-2 w-56 -skew-x-12 bg-[#e11d2e] sm:w-72" />

            <p className="mt-7 max-w-xl text-sm font-semibold uppercase tracking-[0.25em] text-white/85 sm:text-base">
              Custom apparel · Streetwear · Good vibes
            </p>
            <p className="mt-3 max-w-lg text-base text-white/65">
              Turn photos, memories, people, pets and milestones into clothing made to be remembered.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 bg-white px-7 py-4 text-sm font-black uppercase tracking-wider text-black transition hover:bg-[#e11d2e] hover:text-white"
              >
                Shop Now <ArrowRight size={17} />
              </Link>
              <Link
                to="/custom-studio"
                className="inline-flex items-center gap-2 border border-white/40 px-7 py-4 text-sm font-black uppercase tracking-wider text-white transition hover:border-white hover:bg-white hover:text-black"
              >
                Create Custom Tee
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICE STRIP */}
      <section className="bg-[#0b0b0b] text-white border-t border-white/10">
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className={`flex min-h-[104px] items-center gap-4 px-5 py-5 lg:px-8 ${
                index > 0 ? "lg:border-l lg:border-white/15" : ""
              }`}
            >
              <feature.icon size={30} strokeWidth={1.7} className="shrink-0" />
              <div>
                <div className="text-xs font-black uppercase tracking-wide sm:text-sm">
                  {feature.title}
                </div>
                <div className="mt-1 text-xs text-white/60 sm:text-sm">{feature.text}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5 lg:px-7">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {CATEGORIES.map((category) => (
            <Link
              key={category.title}
              to={category.to}
              className="group relative aspect-[1.65/1] overflow-hidden bg-neutral-900"
            >
              <Image
                src={category.image}
                alt={category.title}
                fittingType="fill"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/5" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
                <div className="font-display text-3xl leading-none sm:text-4xl">{category.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-white/75 sm:text-sm">
                  {category.subtitle} <ArrowRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* BEST SELLERS */}
      <section className="mx-auto max-w-[1500px] px-5 py-12 lg:px-8 lg:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black tracking-tight md:text-5xl">
              Best Sellers
              <span className="ml-3 inline-block h-8 w-1 bg-[#e11d2e] align-middle" />
            </h2>
            <p className="mt-2 text-sm text-neutral-500">Fan favorites. Real style. Everyday wear.</p>
          </div>
          <Link
            to="/shop?filter=best"
            className="hidden items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline sm:flex"
          >
            View All Products <ArrowRight size={16} />
          </Link>
        </div>

        {showcase.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-5">
            {showcase.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-5">
            {FALLBACKS.map((item) => (
              <FallbackProduct key={item.title} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* PROMO PANELS */}
      <section className="grid md:grid-cols-3">
        <Link to="/custom-studio" className="group relative min-h-[300px] overflow-hidden bg-black text-white">
          <Image
            src="/images/gdp-process.svg"
            alt="GDP Clothing custom tee design process"
            fittingType="fill"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-x-0 bottom-0 p-7">
            <h3 className="font-display text-5xl leading-none">Custom Tees</h3>
            <p className="mt-1 text-white/75">Turn your ideas into reality.</p>
            <span className="mt-5 inline-flex items-center gap-2 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-black">
              Start Your Design <ArrowRight size={15} />
            </span>
          </div>
        </Link>

        <Link to="/pages/about" className="group relative min-h-[300px] overflow-hidden bg-black text-white">
          <Image
            src="/images/gdp-couples.svg"
            alt="GDP Clothing community"
            fittingType="fill"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-0 bottom-0 p-7">
            <h3 className="font-display text-5xl leading-none">Our Story</h3>
            <p className="mt-1 text-white/75">Built by the culture, for the culture.</p>
            <span className="mt-5 inline-flex items-center gap-2 border border-white px-5 py-3 text-xs font-black uppercase tracking-wide">
              Learn More <ArrowRight size={15} />
            </span>
          </div>
        </Link>

        <Link to="/shop" className="group relative min-h-[300px] overflow-hidden bg-black text-white">
          <Image
            src="/images/gdp-crewneck.svg"
            alt="GDP Clothing premium quality"
            fittingType="fill"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-x-0 bottom-0 p-7">
            <h3 className="font-display text-5xl leading-none">Quality. Bigger Moves.</h3>
            <p className="mt-1 text-white/75">It is in the details.</p>
            <span className="mt-5 inline-flex items-center gap-2 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-black">
              Shop Now <ArrowRight size={15} />
            </span>
          </div>
        </Link>
      </section>

      {/* MOBILE VIEW ALL */}
      <div className="px-5 py-8 text-center sm:hidden">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 border border-black px-6 py-3 text-xs font-black uppercase tracking-wide"
        >
          View All Products <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
