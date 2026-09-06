import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Heart,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { storefrontContentApi } from "@/lib/storefrontContentApi";
import { DEFAULT_LANDING_PAGE } from "@/lib/landingPageDefaults";
import { useProducts } from "@/lib/useProducts";

const TRUST_ICONS = {
  truck: Truck,
  shield: ShieldCheck,
  shirt: Shirt,
  heart: Heart,
};

const COLOR_MAP = {
  black: "#111111",
  white: "#ffffff",
  charcoal: "#55585c",
  gray: "#a7a7a7",
  grey: "#a7a7a7",
  red: "#d7272f",
  navy: "#1f335f",
  sand: "#d5c4a3",
  forest: "#425744",
  pink: "#e9a9ba",
  "full color": "linear-gradient(135deg,#ec4899,#f59e0b,#3b82f6)",
};

function SmartLink({ to, children, className, ...props }) {
  if (/^https?:\/\//i.test(to || "")) {
    return <a href={to} className={className} {...props}>{children}</a>;
  }
  return <Link to={to || "/"} className={className} {...props}>{children}</Link>;
}

function TrustItem({ item }) {
  const Icon = TRUST_ICONS[item.icon] || ShieldCheck;
  return (
    <div className="flex min-h-[82px] items-center gap-3 border-white/12 px-4 py-4 sm:px-6 lg:border-l first:lg:border-l-0">
      <Icon size={28} strokeWidth={1.7} className="shrink-0 text-white" />
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.04em] text-white sm:text-xs">{item.title}</div>
        <div className="mt-1 text-[10px] text-white/58 sm:text-xs">{item.text}</div>
      </div>
    </div>
  );
}

function CategoryCard({ item }) {
  return (
    <SmartLink
      to={item.url}
      className="group relative min-h-[150px] overflow-hidden bg-black text-white sm:min-h-[175px] lg:min-h-[190px]"
    >
      <img
        src={item.imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <div className="font-display text-4xl uppercase leading-none tracking-wide sm:text-5xl">{item.title}</div>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-medium text-white/78 sm:text-xs">
          <span>{item.subtitle}</span>
          <ArrowRight size={13} />
        </div>
      </div>
    </SmartLink>
  );
}

function HomeProductCard({ product }) {
  const colors = Array.isArray(product.colors) ? product.colors.slice(0, 5) : [];

  return (
    <article className="min-w-0">
      <SmartLink to={"/product/" + product.id} className="group relative block overflow-hidden bg-[#ececec]">
        <div className="aspect-square sm:aspect-[1/1.02]">
          <img
            src={product.images?.[0] || "/images/gdp-tshirt.svg"}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          />
        </div>
        {product.bestSeller && (
          <span className="absolute left-2 top-2 rounded-[3px] bg-black px-2 py-1 text-[8px] font-bold text-white sm:text-[9px]">
            Best Seller
          </span>
        )}
      </SmartLink>
      <div className="pt-2.5">
        <h3 className="truncate text-[11px] font-semibold sm:text-xs">
          <SmartLink to={"/product/" + product.id}>{product.name}</SmartLink>
        </h3>
        <div className="mt-1 text-[10px] font-medium sm:text-xs">{"$" + Number(product.price || 0).toFixed(2)}</div>
        {colors.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5" aria-label="Available colors">
            {colors.map((color) => {
              const background = COLOR_MAP[String(color).toLowerCase()] || "#d8d8d8";
              return (
                <span
                  key={color}
                  title={color}
                  className="h-5 w-5 rounded-full border border-black/25 p-[2px] sm:h-6 sm:w-6"
                >
                  <span
                    className="block h-full w-full rounded-full border border-black/10"
                    style={{ background }}
                  />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

function PromoCard({ item }) {
  return (
    <section className="relative min-h-[255px] overflow-hidden bg-black text-white lg:min-h-[300px]">
      <img src={item.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/48 to-black/18" />
      <div className="relative flex min-h-[255px] max-w-sm flex-col justify-end p-6 lg:min-h-[300px] lg:p-7">
        <h3 className="font-display text-5xl uppercase leading-[0.9] tracking-wide lg:text-6xl">{item.title}</h3>
        <p className="mt-2 text-xs leading-5 text-white/75 sm:text-sm">{item.subtitle}</p>
        <SmartLink
          to={item.url}
          className="mt-5 inline-flex min-h-10 w-fit items-center gap-3 bg-white px-5 text-[10px] font-black uppercase tracking-[0.12em] text-black transition hover:bg-[#e11d2e] hover:text-white"
        >
          {item.buttonLabel} <ArrowRight size={14} />
        </SmartLink>
      </div>
    </section>
  );
}

export default function Home() {
  const [landing, setLanding] = useState(DEFAULT_LANDING_PAGE);
  const { products, loading: productsLoading } = useProducts({ status: "active" });

  useEffect(() => {
    let active = true;
    storefrontContentApi
      .getHomepage()
      .then((data) => {
        if (active && data) setLanding(data);
      })
      .catch((error) => {
        console.error("Landing page content load failed:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const bestSellers = useMemo(() => {
    const limit = Math.max(1, Math.min(8, Number(landing.bestSellers?.limit || 5)));
    const marked = products.filter((product) => product.bestSeller);
    return (marked.length ? marked : products).slice(0, limit);
  }, [products, landing.bestSellers?.limit]);

  return (
    <div className="bg-white text-black">
      <section className="relative min-h-[540px] overflow-hidden bg-black text-white sm:min-h-[610px] lg:min-h-[650px]">
        <img
          src={landing.hero.imageUrl}
          alt="GDP Clothing"
          className="absolute inset-0 h-full w-full object-cover object-[62%_center] sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/58 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-black/15" />

        <div className="relative mx-auto flex min-h-[540px] max-w-[1500px] items-center px-5 py-10 sm:min-h-[610px] sm:px-7 lg:min-h-[650px] lg:px-10">
          <div className="w-full max-w-[600px]">
            <img
              src="/images/gdp-logo.webp"
              alt="GDP Clothing"
              className="h-24 w-48 object-contain object-left sm:h-28 sm:w-56 lg:h-32 lg:w-64"
            />
            <div className="mt-2 text-[12px] font-black uppercase tracking-[0.38em] text-white/88 sm:text-sm">
              {landing.hero.brandLine}
            </div>
            <div className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-white/90 sm:text-lg">
              {landing.hero.headline}
            </div>
            <div className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-white/90 sm:text-lg">
              {landing.hero.subheadline}
            </div>
            <SmartLink
              to={landing.hero.ctaUrl}
              className="mt-6 inline-flex min-h-11 items-center gap-5 bg-white px-7 text-[10px] font-black uppercase tracking-[0.12em] text-black transition hover:bg-[#e11d2e] hover:text-white sm:min-h-12 sm:px-9"
            >
              {landing.hero.ctaLabel} <ArrowRight size={15} />
            </SmartLink>
          </div>

          <div className="absolute bottom-10 right-5 hidden max-w-[210px] rotate-[-5deg] text-right font-display text-6xl uppercase leading-[0.78] tracking-wide text-white lg:block xl:right-12 xl:text-7xl">
            {landing.hero.sideCopy}
          </div>
        </div>
      </section>

      <section className="bg-[#090909] text-white">
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 lg:grid-cols-4">
          {landing.trustBar.map((item, index) => <TrustItem key={item.title + index} item={item} />)}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {landing.categories.map((item, index) => <CategoryCard key={item.title + index} item={item} />)}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 sm:px-6 lg:pb-12">
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-black/10 pb-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{landing.bestSellers.title}</h2>
            <p className="mt-1 text-xs text-black/58 sm:text-sm">{landing.bestSellers.subtitle}</p>
          </div>
          <SmartLink
            to={landing.bestSellers.ctaUrl}
            className="hidden items-center gap-2 text-[10px] font-medium underline-offset-4 hover:underline sm:flex sm:text-xs"
          >
            {landing.bestSellers.ctaLabel} <ArrowRight size={13} />
          </SmartLink>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="aspect-square animate-pulse bg-black/5" />
            ))}
          </div>
        ) : bestSellers.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {bestSellers.map((product) => <HomeProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="flex min-h-44 items-center justify-center border border-dashed border-black/15 text-sm text-black/45">
            <ShoppingBag size={18} className="mr-2" /> Add active products to populate Best Sellers.
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-3">
        {landing.promos.map((item, index) => <PromoCard key={item.title + index} item={item} />)}
      </section>
    </div>
  );
}
