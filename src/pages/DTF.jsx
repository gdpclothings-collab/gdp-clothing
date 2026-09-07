import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileImage,
  Layers3,
  Move,
  PackageCheck,
  Ruler,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { dtfGangSheetApi } from "@/lib/dtfGangSheetApi";
import { normalizeDtfSettings } from "@/lib/dtfGangSheet";

const round = (value, decimals = 2) => {
  const power = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * power) / power;
};

function Feature({ icon: Icon, title, text }) {
  return (
    <div className="border border-black/10 bg-white p-5 sm:p-6">
      <div className="grid h-10 w-10 place-items-center bg-black text-white">
        <Icon size={18} />
      </div>
      <h3 className="mt-5 text-sm font-black uppercase tracking-[0.08em]">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-black/55 sm:text-sm">{text}</p>
    </div>
  );
}

function Step({ number, title, text }) {
  return (
    <div className="relative border-t border-black/15 pt-5">
      <div className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-black/35">
        Step {number}
      </div>
      <h3 className="mt-3 text-xl font-black tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-black/55">{text}</p>
    </div>
  );
}

function Spec({ label, value, helper }) {
  return (
    <div className="border-b border-white/10 py-4 last:border-b-0">
      <div className="flex items-baseline justify-between gap-5">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">{label}</span>
        <span className="text-right font-mono text-sm font-black text-white">{value}</span>
      </div>
      {helper && <div className="mt-1 text-right text-[10px] leading-4 text-white/40">{helper}</div>}
    </div>
  );
}

export default function DTF() {
  const [settings, setSettings] = useState(() => normalizeDtfSettings({}));
  const [product, setProduct] = useState(null);

  useEffect(() => {
    let active = true;
    dtfGangSheetApi
      .load()
      .then(({ settings: nextSettings, product: nextProduct }) => {
        if (!active) return;
        setSettings(nextSettings);
        setProduct(nextProduct);
      })
      .catch((error) => {
        console.error("DTF storefront settings load failed:", error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.head.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute("content") || "";

    document.title = "Custom DTF Transfers & Gang Sheets | GDP Clothing";
    description?.setAttribute(
      "content",
      "Build custom DTF gang sheets with live film preview, artwork resizing, DPI checks and print-ready upload options from GDP Clothing."
    );

    return () => {
      document.title = previousTitle;
      description?.setAttribute("content", previousDescription);
    };
  }, []);

  const thresholdLength = useMemo(
    () => round(settings.breakpointArea / Math.max(1, settings.maxWidth), 0),
    [settings.breakpointArea, settings.maxWidth]
  );

  const pricingHelper =
    settings.pricingMode === "flat_tier"
      ? `Orders above ${round(settings.breakpointArea, 0)} in² use the volume rate.`
      : `Film above ${round(settings.breakpointArea, 0)} in² uses the volume rate for the additional area.`;

  const productImage = product?.images?.[0] || "/images/dtf-gang-sheet.svg";

  return (
    <div className="bg-[#f4f2ec] text-[#111]">
      <section className="overflow-hidden bg-[#090909] text-white">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 sm:px-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10 lg:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/70">
              <Sparkles size={13} /> DTF Transfers / Film Only
            </div>
            <h1 className="mt-6 max-w-4xl font-display text-6xl uppercase leading-[0.86] tracking-wide sm:text-7xl lg:text-8xl">
              Build your DTF gang sheet
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
              Upload separate designs or a complete print-ready sheet, arrange everything on film up to{" "}
              <strong className="text-white">{settings.maxWidth}" wide</strong>, check print quality and approve the exact layout before checkout.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/dtf-gang-sheet?mode=build"
                className="inline-flex min-h-12 items-center justify-center gap-3 bg-white px-6 text-[10px] font-black uppercase tracking-[0.13em] text-black transition hover:bg-[#e11d2e] hover:text-white"
              >
                Build my gang sheet <ArrowRight size={15} />
              </Link>
              <Link
                to="/dtf-gang-sheet?mode=upload"
                className="inline-flex min-h-12 items-center justify-center gap-3 border border-white/25 px-6 text-[10px] font-black uppercase tracking-[0.13em] text-white transition hover:border-white hover:bg-white hover:text-black"
              >
                Upload print-ready sheet <Upload size={15} />
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-medium text-white/55 sm:text-xs">
              <span className="flex items-center gap-2"><CheckCircle2 size={14} /> Live film preview</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={14} /> Automatic DPI checks</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={14} /> Advanced nesting</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_0.8fr] lg:grid-cols-1 xl:grid-cols-[1fr_0.72fr]">
            <div className="relative min-h-[360px] overflow-hidden border border-white/15 bg-[#151515] p-7">
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage:
                  "linear-gradient(45deg,#222 25%,transparent 25%),linear-gradient(-45deg,#222 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#222 75%),linear-gradient(-45deg,transparent 75%,#222 75%)",
                backgroundSize: "24px 24px",
                backgroundPosition: "0 0,0 12px,12px -12px,-12px 0px",
              }} />
              <div className="relative flex min-h-[310px] items-center justify-center">
                <img
                  src={productImage}
                  alt="GDP Clothing custom DTF gang sheet"
                  className="max-h-[310px] w-full max-w-[420px] object-contain drop-shadow-2xl"
                />
              </div>
            </div>

            <div className="border border-white/15 bg-[#101010] px-5 py-3">
              <Spec label="Maximum width" value={`${settings.maxWidth}"`} helper="Custom film length" />
              <Spec label="Standard rate" value={`$${settings.standardRate.toFixed(3)}/in²`} helper={`Up to approximately ${settings.maxWidth}" × ${thresholdLength}"`} />
              <Spec label="Volume rate" value={`$${settings.volumeRate.toFixed(3)}/in²`} helper={pricingHelper} />
              <Spec label="Artwork files" value="PNG · JPG · WEBP · SVG · PDF" helper={`Up to ${settings.maxUploadMb} MB per file`} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-12 sm:px-7 lg:px-10 lg:py-16">
        <div className="grid gap-5 lg:grid-cols-2">
          <article className="border border-black/10 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Layers3 size={22} />
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.15em] text-black/45">Option 01</span>
            </div>
            <h2 className="mt-6 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">Build my gang sheet</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-black/55">
              Upload separate artwork files, resize and position them directly on the film, duplicate designs and use advanced nesting to reduce wasted space.
            </p>
            <ul className="mt-6 grid gap-3 text-xs sm:grid-cols-2">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} /> Drag-to-position editor</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} /> Resize with locked proportions</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} /> Duplicate & rotate</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} /> Advanced auto-nesting</li>
            </ul>
            <Link
              to="/dtf-gang-sheet?mode=build"
              className="mt-7 inline-flex min-h-11 items-center gap-3 bg-black px-5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:bg-[#e11d2e]"
            >
              Open builder <ArrowRight size={14} />
            </Link>
          </article>

          <article className="border border-black/10 bg-[#eae7de] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <FileCheck2 size={22} />
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.15em] text-black/45">Option 02</span>
            </div>
            <h2 className="mt-6 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">Upload print-ready</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-black/55">
              Already built your full gang sheet? Upload one finished file, verify the film dimensions, review preflight checks and submit it without rebuilding the layout.
            </p>
            <ul className="mt-6 grid gap-3 text-xs sm:grid-cols-2">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} /> One finished sheet</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} /> Size verification</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} /> Print-readiness review</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} /> Exact layout approval</li>
            </ul>
            <Link
              to="/dtf-gang-sheet?mode=upload"
              className="mt-7 inline-flex min-h-11 items-center gap-3 border border-black bg-white px-5 text-[10px] font-black uppercase tracking-[0.12em] text-black hover:bg-black hover:text-white"
            >
              Upload complete sheet <Upload size={14} />
            </Link>
          </article>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white">
        <div className="mx-auto max-w-[1500px] px-5 py-12 sm:px-7 lg:px-10 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/40">Simple workflow</div>
              <h2 className="mt-3 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">From artwork to print-ready film</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-black/55 lg:justify-self-end">
              The builder keeps the customer in control of placement and dimensions while adding production checks before the order reaches GDP Clothing.
            </p>
          </div>
          <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            <Step number="01" title="Choose film" text={`Select up to ${settings.maxWidth}" wide and choose the length your job needs.`} />
            <Step number="02" title="Upload artwork" text="Add separate designs or one finished print-ready gang sheet." />
            <Step number="03" title="Arrange & verify" text="Move, resize, nest and review DPI, dimensions and overlap checks." />
            <Step number="04" title="Approve & order" text="Approve the exact layout and add the finished DTF film configuration to cart." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-12 sm:px-7 lg:px-10 lg:py-16">
        <div className="mb-7 max-w-2xl">
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/40">Built for print confidence</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Tools customers need before production</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={Move} title="Live layout editor" text="Move and resize artwork directly inside the film workspace while keeping designs inside printable bounds." />
          <Feature icon={Zap} title="Advanced nesting" text="Automatically pack multiple designs efficiently to reduce unnecessary film length and wasted space." />
          <Feature icon={ShieldCheck} title="Artwork preflight" text={`Check resolution against the recommended ${settings.recommendedDpi} DPI target and catch overlaps before checkout.`} />
          <Feature icon={Ruler} title="Source-aware sizing" text="Raster artwork keeps its real pixel dimensions, aspect ratio and print-quality relationship as customers resize." />
        </div>
      </section>

      <section className="bg-[#111] text-white">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-12 sm:px-7 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-10 lg:py-16">
          <div>
            <div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Artwork guide</div>
            <h2 className="mt-3 font-display text-5xl uppercase leading-[0.9] tracking-wide sm:text-6xl">Send cleaner files. Get cleaner transfers.</h2>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/60">
              Transparent PNG is the easiest choice for raster artwork. SVG and print-ready PDF are ideal when vector artwork is available. JPEG can work, but may include a background.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Feature icon={FileImage} title="Preferred raster" text="Transparent PNG with clean edges and enough pixels for the intended print size." />
            <Feature icon={FileCheck2} title="Vector / PDF" text="SVG and print-ready PDF remain sharp at different print dimensions." />
            <Feature icon={PackageCheck} title="Film only" text="This product is DTF transfer film. Garments are not included with the gang sheet order." />
            <Feature icon={ShieldCheck} title="Optional review" text="Professional artwork review can be enabled for an additional production-readiness check." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-14 text-center sm:px-7 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-black/40">Ready to print?</div>
          <h2 className="mt-4 font-display text-6xl uppercase leading-[0.86] tracking-wide sm:text-7xl">Start your DTF gang sheet</h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-black/55">
            Build the layout yourself or upload a finished sheet. Your film dimensions and price update before checkout.
          </p>
          <Link
            to="/dtf-gang-sheet?mode=build"
            className="mt-7 inline-flex min-h-12 items-center gap-3 bg-black px-7 text-[10px] font-black uppercase tracking-[0.13em] text-white transition hover:bg-[#e11d2e]"
          >
            Open DTF builder <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
