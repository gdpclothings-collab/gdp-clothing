import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle2, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { BUDGET_RANGES, ORDER_TYPES, salesLeadApi } from "@/lib/salesLeadApi";

const initialForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  businessName: "",
  orderType: "bulk_apparel",
  garmentType: "",
  quantity: "",
  artworkReady: false,
  deadline: "",
  budgetRange: "",
  preferredContact: "email",
  notes: "",
  website: "",
};

const intakeHighlights = [
  { Icon: PackageCheck, title: "Quantity first", copy: "We size the job properly." },
  { Icon: ShieldCheck, title: "Clear intake", copy: "Fewer missing details." },
  { Icon: Sparkles, title: "Artwork aware", copy: "Ready art gets identified early." },
];

function localDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export default function CustomOrders() {
  const location = useLocation();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const tracking = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
    };
  }, [location.search]);

  const update = (key) => (event) => {
    const value = event?.target?.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await salesLeadApi.submit({
        ...form,
        quantity: Number(form.quantity),
        source: "custom_orders_page",
        ...tracking,
        referrer: typeof document !== "undefined" ? document.referrer : "",
      });
      setSubmitted(true);
      setForm(initialForm);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submissionError) {
      setError(submissionError?.message || "We could not submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-[70vh] bg-[#f7f7f8] px-4 py-14 md:py-20">
        <div className="mx-auto max-w-2xl rounded-3xl border border-[#e2e3e7] bg-white p-7 text-center shadow-sm md:p-10">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={30} />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#a70f2d]">Request received</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[#171717] md:text-4xl">Thanks — GDP has your project details.</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#5b5e65]">
            We’ll review the quantity, timing, artwork status and order details so we can respond with the right next step instead of making you repeat everything again.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/custom-studio" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#171717] px-5 font-bold text-white hover:bg-black">
              Start a design <ArrowRight size={17} />
            </Link>
            <button type="button" onClick={() => setSubmitted(false)} className="h-12 rounded-xl border border-[#d8d9de] bg-white px-5 font-bold text-[#25272b] hover:bg-[#f7f7f8]">
              Submit another request
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[#f7f7f8] text-[#171717]">
      <section className="border-b border-[#e2e3e7] bg-white px-4 py-12 md:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#efc5ce] bg-[#fff5f7] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#a70f2d]">
              <Sparkles size={14} /> Custom + Bulk Orders
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-0.035em] md:text-6xl">
              Tell us what you need. We’ll qualify the project before the back-and-forth starts.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#555961]">
              Shirts, hoodies, team orders, business apparel and DTF transfers. Share the essentials once and GDP can prioritize the right jobs faster.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {intakeHighlights.map(({ Icon, title, copy }) => (
                <div key={title} className="rounded-2xl border border-[#e3e4e8] bg-[#fafafa] p-4">
                  <Icon size={20} className="text-[#a70f2d]" />
                  <div className="mt-2 text-sm font-extrabold">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-[#6b6e75]">{copy}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#dedfe3] bg-[#111214] p-6 text-white shadow-xl shadow-black/10 md:p-8">
            <div className="text-sm font-bold text-white/70">Best fit for</div>
            <div className="mt-3 space-y-3 text-lg font-bold">
              <div>• Businesses and staff apparel</div>
              <div>• Teams, events and group orders</div>
              <div>• 12+ shirt / hoodie projects</div>
              <div>• DTF transfer and repeat orders</div>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/75">
              Not sure about budget or garment type yet? That’s okay. Submit what you know and leave the rest blank.
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:py-14">
        <form onSubmit={submit} className="mx-auto max-w-4xl rounded-3xl border border-[#dedfe3] bg-white p-5 shadow-sm md:p-8">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a70f2d]">Project intake</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Custom / bulk quote request</h2>
            <p className="mt-2 text-sm leading-6 text-[#696c73]">Fields marked * help us qualify the request correctly.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Your name *"><input required minLength={2} value={form.customerName} onChange={update("customerName")} className={inputClass} placeholder="Full name" /></Field>
            <Field label="Email *"><input required type="email" value={form.customerEmail} onChange={update("customerEmail")} className={inputClass} placeholder="you@example.com" /></Field>
            <Field label="Phone"><input value={form.customerPhone} onChange={update("customerPhone")} className={inputClass} placeholder="Phone number" /></Field>
            <Field label="Business / organization"><input value={form.businessName} onChange={update("businessName")} className={inputClass} placeholder="Optional" /></Field>

            <Field label="What do you need? *">
              <select required value={form.orderType} onChange={update("orderType")} className={inputClass}>
                {ORDER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Garment / item"><input value={form.garmentType} onChange={update("garmentType")} className={inputClass} placeholder="Hoodie, T-shirt, crewneck..." /></Field>

            <Field label="Quantity *"><input required min={1} max={10000} type="number" value={form.quantity} onChange={update("quantity")} className={inputClass} placeholder="e.g. 50" /></Field>
            <Field label="Budget range">
              <select value={form.budgetRange} onChange={update("budgetRange")} className={inputClass}>
                {BUDGET_RANGES.map((item) => <option key={item.value || "none"} value={item.value}>{item.label}</option>)}
              </select>
            </Field>

            <Field label="Needed by"><input type="date" min={localDateInputValue()} value={form.deadline} onChange={update("deadline")} className={inputClass} /></Field>
            <Field label="Preferred contact *">
              <select required value={form.preferredContact} onChange={update("preferredContact")} className={inputClass}>
                <option value="email">Email</option>
                <option value="text">Text message</option>
                <option value="phone">Phone call</option>
              </select>
            </Field>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[#e2e3e7] bg-[#fafafa] p-4">
            <input type="checkbox" checked={form.artworkReady} onChange={update("artworkReady")} className="mt-1 h-4 w-4" />
            <span>
              <span className="block text-sm font-extrabold">My artwork is ready</span>
              <span className="mt-1 block text-xs leading-5 text-[#6b6e75]">Check this if you already have print-ready artwork or a finished design.</span>
            </span>
          </label>

          <Field label="Project details" className="mt-5">
            <textarea value={form.notes} onChange={update("notes")} rows={5} className={`${inputClass} min-h-[130px] resize-y py-3`} placeholder="Colors, sizes, print locations, event details, anything else we should know..." />
          </Field>

          <div className="hidden" aria-hidden="true">
            <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} /></label>
          </div>

          {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

          <div className="mt-7 flex flex-col gap-3 border-t border-[#ececef] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-xs leading-5 text-[#777a81]">Submitting this form creates a GDP project lead so we can organize and prioritize your request. It does not place an order or charge you.</p>
            <button disabled={submitting} type="submit" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d7193f] px-6 font-extrabold text-white shadow-sm hover:bg-[#bd1235] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Submitting..." : "Request a quote"} {!submitting ? <ArrowRight size={17} /> : null}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

const inputClass = "h-12 w-full rounded-xl border border-[#d9dbe0] bg-white px-3.5 text-sm text-[#22242a] outline-none transition focus:border-[#b61234] focus:ring-2 focus:ring-[#d7193f]/10";

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-extrabold text-[#34363b]">{label}</span>
      {children}
    </label>
  );
}
