import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Heart,
  Layers3,
  MapPin,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { isLandingDraftPreview, storefrontContentApi } from "@/lib/storefrontContentApi";
import { storefrontDiscoveryApi } from "@/lib/storefrontDiscoveryApi";
import { DEFAULT_LANDING_PAGE } from "@/lib/landingPageDefaults";
import { useProducts } from "@/lib/useProducts";

const TRUST_ICONS = { truck: Truck, shield: ShieldCheck, shirt: Shirt, heart: Heart };
const COLOR_MAP = {
  black: "#111111", white: "#ffffff", charcoal: "#55585c", gray: "#a7a7a7", grey: "#a7a7a7",
  red: "#d7272f", navy: "#1f335f", sand: "#d5c4a3", forest: "#425744", pink: "#e9a9ba",
  "full color": "linear-gradient(135deg,#ec4899,#f59e0b,#3b82f6)",
};

function SmartLink({ to, children, className = "", ...props }) {
  if (/^https?:\/\//i.test(to || "")) return <a href={to} className={className} {...props}>{children}</a>;
  return <Link to={to || "/"} className={className} {...props}>{children}</Link>;
}

function ManagedImage({ src, fallbackSrc, ...props }) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);
  useEffect(() => setCurrentSrc(src || fallbackSrc), [src, fallbackSrc]);
  return <img {...props} src={currentSrc} onError={() => {
    if (fallbackSrc && currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
  }} />;
}

function TrustItem({ item }) {
  const Icon = TRUST_ICONS[item.icon] || ShieldCheck;
  return (
    <div className="flex min-h-[82px] items-center gap-3 border-white/10 px-4 py-4 sm:px-6 lg:border-l first:lg:border-l-0">
      <Icon size={28} strokeWidth={1.7} className="shrink-0 text-white" />
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.04em] text-white sm:text-xs">{item.title}</div>
        <div className="mt-1 text-[10px] text-white/60 sm:text-xs">{item.text}</div>
      </div>
    </div>
  );
}

function CategoryCard({ item }) {
  return (
    <SmartLink to={item.url} className="group relative min-h-[150px] overflow-hidden bg-black text-white sm:min-h-[175px] lg:min-h-[190px]">
      <ManagedImage src={item.imageUrl} fallbackSrc="/images/gdp-sold-categories.webp" alt={item.title || ""} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <div className="font-display text-4xl uppercase leading-none tracking-wide sm:text-5xl">{item.title}</div>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-medium text-white/80 sm:text-xs"><span>{item.subtitle}</span><ArrowRight size={13} /></div>
      </div>
    </SmartLink>
  );
}

function HomeProductCard({ product }) {
  const colors = Array.isArray(product.colors) ? product.colors.slice(0, 5) : [];
  const productHref = product.slug === "dtf-gang-sheet" ? "/products/dtf-gang-sheet" : "/product/" + product.id;
  return (
    <article className="min-w-0">
      <SmartLink to={productHref} className="group relative block overflow-hidden bg-[#ececec]">
        <div className="aspect-square sm:aspect-[1/1.02]">
          <ManagedImage src={product.images?.[0]} fallbackSrc="/images/gdp-tshirt.svg" alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" />
        </div>
        {product.bestSeller && <span className="absolute left-2 top-2 rounded-[3px] bg-black px-2 py-1 text-[8px] font-bold text-white sm:text-[9px]">Best Seller</span>}
      </SmartLink>
      <div className="pt-2.5">
        <h3 className="truncate text-[11px] font-semibold sm:text-xs"><SmartLink to={productHref}>{product.name}</SmartLink></h3>
        <div className="mt-1 text-[10px] font-medium sm:text-xs">
          {(product.slug === "dtf-gang-sheet" ? "From " : "") + "$" + Number(product.price || 0).toFixed(2) + " CAD"}
        </div>
        {colors.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5" aria-label="Available colors">
            {colors.map((color) => {
              const background = COLOR_MAP[String(color).toLowerCase()] || "#d8d8d8";
              return <span key={color} title={color} className="h-5 w-5 rounded-full border border-black/25 p-[2px] sm:h-6 sm:w-6"><span className="block h-full w-full rounded-full border border-black/10" style={{ background }} /></span>;
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
      <ManagedImage src={item.imageUrl} fallbackSrc="/images/gdp-sold-family.webp" alt={item.title || ""} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-black/20" />
      <div className="relative flex min-h-[255px] max-w-sm flex-col justify-end p-6 lg:min-h-[300px] lg:p-7">
        <h3 className="font-display text-5xl uppercase leading-[0.9] tracking-wide lg:text-6xl">{item.title}</h3>
        <p className="mt-2 text-xs leading-5 text-white/75 sm:text-sm">{item.subtitle}</p>
        <SmartLink to={item.url} className="mt-5 inline-flex min-h-10 w-fit items-center gap-3 bg-white px-5 text-[10px] font-black uppercase tracking-[0.12em] text-black transition hover:bg-[#e11d2e] hover:text-white">{item.buttonLabel} <ArrowRight size={14} /></SmartLink>
      </div>
    </section>
  );
}

function CustomStudioFeature({ config }) {
  return (
    <section className="border-y border-black/10 bg-[#f1eee6]">
      <div className="mx-auto grid max-w-[1500px] gap-7 px-5 py-10 sm:px-7 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-10 lg:py-14">
        <div className="relative min-h-[320px] overflow-hidden bg-black sm:min-h-[380px]">
          <ManagedImage src={config.imageUrl} fallbackSrc="/images/gdp-sold-family.webp" alt="GDP Custom Studio apparel example" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute bottom-5 left-5 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/75">Photo → proof → finished garment</div>
        </div>
        <div className="max-w-2xl">
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/45">{config.eyebrow}</div>
          <h2 className="mt-3 font-display text-5xl uppercase leading-[0.88] tracking-wide sm:text-6xl lg:text-7xl">{config.title}</h2>
          <p className="mt-5 max-w-xl text-sm leading-6 text-black/60 sm:text-base">{config.subtitle}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <SmartLink to={config.ctaUrl} className="inline-flex min-h-11 items-center justify-center gap-3 bg-black px-5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:bg-[#e11d2e]">{config.ctaLabel} <ArrowRight size={14} /></SmartLink>
            <SmartLink to={config.secondaryUrl} className="inline-flex min-h-11 items-center justify-center gap-3 border border-black/20 bg-white px-5 text-[10px] font-black uppercase tracking-[0.12em] text-black hover:border-black">{config.secondaryLabel}</SmartLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function DTFSpotlight({ config }) {
  return (
    <section className="border-b border-black/10 bg-[#eae7de]">
      <div className="mx-auto grid max-w-[1500px] gap-7 px-5 py-9 sm:px-7 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-10 lg:py-11">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/45"><Sparkles size={13} /> {config.eyebrow}</div>
          <h2 className="mt-3 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">{config.title}</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-black/55">{config.subtitle}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <SmartLink to={config.primaryUrl} className="inline-flex min-h-11 items-center justify-center gap-3 bg-black px-5 text-[10px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#e11d2e]">{config.primaryLabel} <ArrowRight size={14} /></SmartLink>
            <SmartLink to={config.secondaryUrl} className="inline-flex min-h-11 items-center justify-center gap-3 border border-black/20 bg-white px-5 text-[10px] font-black uppercase tracking-[0.12em] text-black transition hover:border-black">{config.secondaryLabel} <Layers3 size={14} /></SmartLink>
          </div>
        </div>
        <SmartLink to={config.primaryUrl} className="group relative min-h-[220px] overflow-hidden border border-black/10 bg-[#111] p-6 text-white sm:min-h-[250px]">
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)", backgroundSize: "22px 22px", backgroundPosition: "0 0,0 11px,11px -11px,-11px 0px" }} />
          <ManagedImage src={config.imageUrl} fallbackSrc="/images/dtf-gang-sheet.svg" alt="Custom DTF gang sheet" className="relative mx-auto h-[170px] w-full max-w-[360px] object-contain transition duration-500 group-hover:scale-[1.03] sm:h-[195px]" />
          <div className="relative mt-2 flex items-center justify-between gap-4 border-t border-white/15 pt-4"><span className="text-[10px] font-black uppercase tracking-[0.12em]">Film only · Custom length</span><ArrowRight size={15} /></div>
        </SmartLink>
      </div>
    </section>
  );
}

function OccasionsSection({ config }) {
  return (
    <section className="mx-auto max-w-[1500px] px-5 py-11 sm:px-7 lg:px-10 lg:py-14">
      <div className="mb-7 grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div><div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/40">{config.eyebrow}</div><h2 className="mt-2 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">{config.title}</h2></div>
        <p className="max-w-2xl text-sm leading-6 text-black/55 lg:justify-self-end">{config.subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {(config.items || []).map((item) => (
          <SmartLink key={item.title} to={item.url} className="group min-h-[138px] border border-black/10 bg-[#f4f2ec] p-4 transition hover:border-black hover:bg-black hover:text-white">
            <div className="font-display text-3xl uppercase leading-[0.92] tracking-wide">{item.title}</div>
            <div className="mt-3 text-[10px] leading-4 opacity-55">{item.subtitle}</div>
            <ArrowRight size={14} className="mt-5 transition group-hover:translate-x-1" />
          </SmartLink>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection({ config }) {
  return (
    <section id="how-it-works" className="border-y border-black/10 bg-white">
      <div className="mx-auto max-w-[1500px] px-5 py-12 sm:px-7 lg:px-10 lg:py-16">
        <div className="max-w-3xl"><div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/40">{config.eyebrow}</div><h2 className="mt-3 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">{config.title}</h2><p className="mt-4 text-sm text-black/55">{config.subtitle}</p></div>
        <div className="mt-9 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {(config.steps || []).map((step, index) => (
            <div key={step.title} className="border-t border-black/15 pt-5">
              <div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/35">Step {String(index + 1).padStart(2, "0")}</div>
              <h3 className="mt-3 text-lg font-black tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-black/55">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewsSection({ config, reviews }) {
  if (!reviews.length) return null;
  return (
    <section className="bg-[#0b0b0b] text-white">
      <div className="mx-auto max-w-[1500px] px-5 py-12 sm:px-7 lg:px-10 lg:py-16">
        <div className="mb-8"><div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/40">{config.eyebrow}</div><h2 className="mt-3 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">{config.title}</h2><p className="mt-3 text-sm text-white/55">{config.subtitle}</p></div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <article key={review.id} className="border border-white/12 bg-white/[0.04] p-5">
              <div className="flex items-center gap-1 text-[#f4c95d]" aria-label={review.rating + " out of 5 stars"}>
                {Array.from({ length: 5 }).map((_, index) => <Star key={index} size={13} className={index < review.rating ? "fill-current" : "opacity-20"} />)}
              </div>
              <h3 className="mt-4 text-sm font-black">{review.title || review.product_name || "GDP customer review"}</h3>
              <p className="mt-2 text-xs leading-5 text-white/65">{review.body}</p>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-[10px] text-white/45"><span>{review.customer_name || "GDP customer"}</span>{review.verified && <span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> Verified</span>}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LocalFulfillmentSection({ config }) {
  return (
    <section className="border-y border-black/10 bg-[#f4f2ec]">
      <div className="mx-auto grid max-w-[1500px] gap-7 px-5 py-11 sm:px-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-10 lg:py-14">
        <div><div className="inline-flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/40"><MapPin size={13} /> {config.eyebrow}</div><h2 className="mt-3 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">{config.title}</h2><p className="mt-4 max-w-xl text-sm leading-6 text-black/55">{config.subtitle}</p></div>
        <div className="grid gap-2 sm:grid-cols-2">{(config.points || []).map((point) => <div key={point} className="flex min-h-16 items-center gap-3 border border-black/10 bg-white px-4 py-3 text-xs font-semibold"><Check size={15} className="shrink-0" /> {point}</div>)}</div>
      </div>
    </section>
  );
}

function FaqSection({ config }) {
  return (
    <section className="mx-auto max-w-[1100px] px-5 py-12 sm:px-7 lg:py-16">
      <div className="text-center"><div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/40">{config.eyebrow}</div><h2 className="mt-3 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">{config.title}</h2></div>
      <div className="mt-8 divide-y divide-black/15 border-y border-black/15">
        {(config.items || []).map((item) => <details key={item.question} className="group py-4"><summary className="cursor-pointer list-none pr-8 text-sm font-black">{item.question}</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-black/55">{item.answer}</p></details>)}
      </div>
      <div className="mt-6 text-center"><SmartLink to={config.ctaUrl} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] underline underline-offset-4">{config.ctaLabel} <ArrowRight size={13} /></SmartLink></div>
    </section>
  );
}

function FinalCtaSection({ config }) {
  return (
    <section className="bg-[#e11d2e] text-white">
      <div className="mx-auto max-w-[1500px] px-5 py-14 text-center sm:px-7 lg:px-10 lg:py-20">
        <div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/60">{config.eyebrow}</div>
        <h2 className="mx-auto mt-4 max-w-5xl font-display text-6xl uppercase leading-[0.86] tracking-wide sm:text-7xl lg:text-8xl">{config.title}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-white/75">{config.subtitle}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <SmartLink to={config.primaryUrl} className="inline-flex min-h-12 items-center justify-center gap-3 bg-white px-7 text-[10px] font-black uppercase tracking-[0.13em] text-black">{config.primaryLabel} <ArrowRight size={14} /></SmartLink>
          <SmartLink to={config.secondaryUrl} className="inline-flex min-h-12 items-center justify-center border border-white/45 px-7 text-[10px] font-black uppercase tracking-[0.13em] text-white hover:bg-white hover:text-black">{config.secondaryLabel}</SmartLink>
        </div>
      </div>
    </section>
  );
}

function useLandingSeo(landing) {
  useEffect(() => {
    const seo = landing.seo || {};
    const branding = landing.branding || {};
    const description = document.head.querySelector('meta[name="description"]');
    const ogTitle = document.head.querySelector('meta[property="og:title"]');
    const ogDescription = document.head.querySelector('meta[property="og:description"]');
    const favicon = document.head.querySelector('link[rel~="icon"]');
    const previous = { title: document.title, description: description?.getAttribute("content") || "", ogTitle: ogTitle?.getAttribute("content") || "", ogDescription: ogDescription?.getAttribute("content") || "", favicon: favicon?.getAttribute("href") || "", faviconType: favicon?.getAttribute("type") || "" };
    document.title = seo.title || DEFAULT_LANDING_PAGE.seo.title;
    description?.setAttribute("content", seo.description || DEFAULT_LANDING_PAGE.seo.description);
    ogTitle?.setAttribute("content", seo.ogTitle || seo.title || DEFAULT_LANDING_PAGE.seo.ogTitle);
    ogDescription?.setAttribute("content", seo.ogDescription || seo.description || DEFAULT_LANDING_PAGE.seo.ogDescription);
    if (favicon && branding.faviconUrl) { favicon.setAttribute("href", branding.faviconUrl); favicon.removeAttribute("type"); }
    let ogImage = document.head.querySelector('meta[property="og:image"]');
    const createdOgImage = !ogImage;
    if (!ogImage) { ogImage = document.createElement("meta"); ogImage.setAttribute("property", "og:image"); document.head.appendChild(ogImage); }
    const previousOgImage = ogImage.getAttribute("content") || "";
    const imageUrl = seo.ogImageUrl || branding.socialShareImageUrl;
    if (imageUrl) ogImage.setAttribute("content", imageUrl);
    return () => {
      document.title = previous.title;
      description?.setAttribute("content", previous.description);
      ogTitle?.setAttribute("content", previous.ogTitle);
      ogDescription?.setAttribute("content", previous.ogDescription);
      if (favicon) { favicon.setAttribute("href", previous.favicon); if (previous.faviconType) favicon.setAttribute("type", previous.faviconType); else favicon.removeAttribute("type"); }
      if (createdOgImage) ogImage.remove(); else ogImage.setAttribute("content", previousOgImage);
    };
  }, [landing]);
}

export default function Home() {
  const [landing, setLanding] = useState(DEFAULT_LANDING_PAGE);
  const [reviews, setReviews] = useState([]);
  const { products, loading: productsLoading } = useProducts({ status: "active" });
  const previewDraft = isLandingDraftPreview();
  useLandingSeo(landing);

  useEffect(() => {
    let active = true;
    storefrontContentApi.getHomepage({ previewDraft }).then((data) => { if (active && data) setLanding(data); }).catch((error) => console.error("Landing page content load failed:", error));
    return () => { active = false; };
  }, [previewDraft]);

  useEffect(() => {
    let active = true;
    storefrontDiscoveryApi.getApprovedReviews(landing.reviews?.limit || 6).then((data) => { if (active) setReviews(data); }).catch((error) => console.error("Homepage reviews load failed:", error));
    return () => { active = false; };
  }, [landing.reviews?.limit]);

  const bestSellers = useMemo(() => {
    const limit = Math.max(1, Math.min(8, Number(landing.bestSellers?.limit || 5)));
    return products.filter((product) => product.bestSeller).slice(0, limit);
  }, [products, landing.bestSellers?.limit]);

  const sections = {
    trustBar: <section className="bg-[#090909] text-white"><div className="mx-auto grid max-w-[1500px] grid-cols-2 lg:grid-cols-4">{landing.trustBar.map((item, index) => <TrustItem key={(item.title || "trust") + index} item={item} />)}</div></section>,
    categories: <section className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5"><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{landing.categories.map((item, index) => <CategoryCard key={(item.title || "category") + index} item={item} />)}</div></section>,
    customStudio: <CustomStudioFeature config={landing.customStudio} />,
    bestSellers: (
      <section className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 sm:px-6 lg:pb-12">
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-black/10 pb-4">
          <div><h2 className="text-3xl font-black tracking-tight sm:text-4xl">{landing.bestSellers.title}</h2><p className="mt-1 text-xs text-black/60 sm:text-sm">{landing.bestSellers.subtitle}</p></div>
          <SmartLink to={landing.bestSellers.ctaUrl} className="hidden items-center gap-2 text-[10px] font-medium underline-offset-4 hover:underline sm:flex sm:text-xs">{landing.bestSellers.ctaLabel} <ArrowRight size={13} /></SmartLink>
        </div>
        {productsLoading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="aspect-square animate-pulse bg-black/5" />)}</div>
          : bestSellers.length > 0 ? <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">{bestSellers.map((product) => <HomeProductCard key={product.id} product={product} />)}</div>
          : <div className="flex min-h-44 items-center justify-center border border-dashed border-black/15 text-sm text-black/45"><ShoppingBag size={18} className="mr-2" /> No Best Sellers are currently marked in the catalog.</div>}
      </section>
    ),
    dtfSpotlight: <DTFSpotlight config={landing.dtfSpotlight} />,
    occasions: <OccasionsSection config={landing.occasions} />,
    howItWorks: <HowItWorksSection config={landing.howItWorks} />,
    reviews: <ReviewsSection config={landing.reviews} reviews={reviews} />,
    promos: <section className="grid lg:grid-cols-3">{landing.promos.map((item, index) => <PromoCard key={(item.title || "promo") + index} item={item} />)}</section>,
    localFulfillment: <LocalFulfillmentSection config={landing.localFulfillment} />,
    faq: <FaqSection config={landing.faq} />,
    finalCta: <FinalCtaSection config={landing.finalCta} />,
  };

  return (
    <div className="overflow-x-hidden bg-white text-black">
      {landing.hero?.enabled !== false && (
        <section className="relative min-h-[540px] overflow-hidden bg-black text-white sm:min-h-[610px] lg:min-h-[650px]">
          <ManagedImage src={landing.hero.imageUrl} fallbackSrc="/images/gdp-hero-approved.webp" alt="GDP Clothing" className="absolute inset-0 h-full w-full object-cover object-[62%_center] sm:object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/15" />
          <div className="relative mx-auto flex min-h-[540px] max-w-[1500px] items-center px-5 py-10 sm:min-h-[610px] sm:px-7 lg:min-h-[650px] lg:px-10">
            <div className="w-full max-w-[640px]">
              <ManagedImage src={landing.branding?.logoUrl} fallbackSrc="/images/gdp-logo.webp" alt={landing.branding?.logoAlt || "GDP Clothing"} className="h-24 w-48 object-contain object-left sm:h-28 sm:w-56 lg:h-32 lg:w-64" />
              <div className="mt-2 text-[12px] font-black uppercase tracking-[0.38em] text-white/90 sm:text-sm">{landing.hero.brandLine}</div>
              <div className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-white/90 sm:text-lg">{landing.hero.headline}</div>
              <div className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-white/90 sm:text-lg">{landing.hero.subheadline}</div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <SmartLink to={landing.hero.ctaUrl} className="inline-flex min-h-11 items-center justify-center gap-5 bg-white px-7 text-[10px] font-black uppercase tracking-[0.12em] text-black transition hover:bg-[#e11d2e] hover:text-white sm:min-h-12">{landing.hero.ctaLabel} <ArrowRight size={15} /></SmartLink>
                {landing.hero.secondaryCtaLabel && <SmartLink to={landing.hero.secondaryCtaUrl} className="inline-flex min-h-11 items-center justify-center border border-white/30 px-7 text-[10px] font-black uppercase tracking-[0.12em] text-white transition hover:bg-white hover:text-black sm:min-h-12">{landing.hero.secondaryCtaLabel}</SmartLink>}
              </div>
              {landing.hero.tertiaryCtaLabel && <SmartLink to={landing.hero.tertiaryCtaUrl} className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/65 hover:text-white">{landing.hero.tertiaryCtaLabel} <ArrowRight size={13} /></SmartLink>}
            </div>
            <div className="absolute bottom-10 right-5 hidden max-w-[210px] rotate-[-5deg] text-right font-display text-6xl uppercase leading-[0.78] tracking-wide text-white lg:block xl:right-12 xl:text-7xl">{landing.hero.sideCopy}</div>
          </div>
        </section>
      )}
      {(landing.layout?.sectionOrder || []).map((key) => landing.layout?.visibility?.[key] === false ? null : <React.Fragment key={key}>{sections[key]}</React.Fragment>)}
    </div>
  );
}
