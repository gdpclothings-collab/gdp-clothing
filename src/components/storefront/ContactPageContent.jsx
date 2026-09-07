import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Shirt,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { contactApi, CONTACT_TOPICS } from "@/lib/contactApi";
import { mergeContactPageBody } from "@/lib/contactPageDefaults";

const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-foreground/50 focus:ring-2 focus:ring-foreground/10";
const inputClass = `${fieldClass} h-11`;
const textareaClass = `${fieldClass} min-h-[150px] py-3 resize-y`;

function ContactCard({ icon: Icon, label, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center shrink-0">
          <Icon size={17} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-sm md:text-base font-medium leading-6 break-words">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required = false, helper = null, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </span>
      {helper ? (
        <span className="ml-2 text-xs text-muted-foreground">{helper}</span>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function ContactPageContent({ page }) {
  const { user } = useAuth();
  const content = mergeContactPageBody(page?.body);
  const [store, setStore] = useState({
    storeName: "GDP Clothing",
    email: "hello@gdpclothing.ca",
    phone: "",
    address: "Saskatoon, Saskatchewan, Canada",
  });
  const [form, setForm] = useState({
    name: user?.display_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    topic: "order_support",
    orderNumber: "",
    message: "",
    website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    contactApi
      .getStoreContact()
      .then((value) => {
        if (active) setStore(value);
      })
      .catch((error) => {
        console.error("Contact settings load failed:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: current.name || user?.display_name || "",
      email: current.email || user?.email || "",
      phone: current.phone || user?.phone || "",
    }));
  }, [user]);

  const orderHelpful = useMemo(
    () =>
      ["order_support", "return_exchange", "shipping"].includes(form.topic),
    [form.topic]
  );

  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitError("");

    // Honeypot: acknowledge bots without creating support queue noise.
    if (form.website) {
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      await contactApi.submitTicket({
        userId: user?.id || null,
        name: form.name,
        email: form.email,
        phone: form.phone,
        topic: form.topic,
        orderNumber: form.orderNumber,
        message: form.message,
      });
      setSubmitted(true);
      setForm((current) => ({
        ...current,
        orderNumber: "",
        message: "",
        website: "",
      }));
    } catch (error) {
      console.error("Contact form submission failed:", error);
      setSubmitError(
        error?.message ||
          "We could not send your message. Please try again or email us directly."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const telHref = String(store.phone || "").replace(/[^+\d]/g, "");

  return (
    <div className="bg-background">
      <section className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-4xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
              Contact &amp; support
            </div>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl leading-[0.95] mt-3">
              {page?.title || "Contact GDP Clothing"}
            </h1>
            <p className="mt-5 max-w-3xl text-base md:text-lg leading-7 text-muted-foreground">
              {content.intro}
            </p>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-3">
            <ContactCard icon={Mail} label="Email">
              <a
                href={`mailto:${store.email}`}
                className="underline decoration-border underline-offset-4 hover:text-accent"
              >
                {store.email}
              </a>
            </ContactCard>
            <ContactCard icon={Clock3} label="Response time">
              {content.responseTime}
            </ContactCard>
            <ContactCard icon={MapPin} label="Location">
              {store.address || content.locationNote}
            </ContactCard>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-14">
        <div className="grid lg:grid-cols-[1.45fr_.75fr] gap-8 lg:gap-10 items-start">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 md:px-7 py-5 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-foreground text-background grid place-items-center shrink-0">
                  <MessageSquareText size={19} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold">
                    {content.formHeading}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {content.formHelper}
                  </p>
                </div>
              </div>
            </div>

            {submitted ? (
              <div className="p-6 md:p-8">
                <div
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 size={25} />
                  <h3 className="mt-3 text-lg font-semibold">Message received.</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                    Your request is now in the GDP Clothing support queue. We will
                    reply to <strong>{form.email || user?.email}</strong>.
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-semibold"
                  >
                    Send another message
                  </button>
                  <Link
                    to="/shop"
                    className="h-10 px-4 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-2 hover:bg-muted"
                  >
                    Continue shopping <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="p-5 md:p-7 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Name" required>
                    <input
                      autoComplete="name"
                      value={form.name}
                      onChange={(event) => set("name", event.target.value)}
                      className={inputClass}
                      maxLength={120}
                      required
                    />
                  </Field>

                  <Field label="Email" required>
                    <input
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) => set("email", event.target.value)}
                      className={inputClass}
                      maxLength={200}
                      required
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Phone" helper="optional">
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) => set("phone", event.target.value)}
                      className={inputClass}
                      maxLength={60}
                    />
                  </Field>

                  <Field label="What can we help with?" required>
                    <select
                      value={form.topic}
                      onChange={(event) => set("topic", event.target.value)}
                      className={inputClass}
                    >
                      {CONTACT_TOPICS.map((topic) => (
                        <option key={topic.value} value={topic.value}>
                          {topic.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field
                  label="Order number"
                  helper={orderHelpful ? "recommended for this request" : "if applicable"}
                >
                  <input
                    value={form.orderNumber}
                    onChange={(event) => set("orderNumber", event.target.value)}
                    className={inputClass}
                    placeholder="Example: GDP-1001"
                    maxLength={80}
                  />
                </Field>

                <Field label="Message" required>
                  <textarea
                    value={form.message}
                    onChange={(event) => set("message", event.target.value)}
                    className={textareaClass}
                    placeholder="Tell us what happened, what you need, or what you would like to create."
                    minLength={10}
                    maxLength={6000}
                    required
                  />
                  <div className="mt-1 text-right text-[11px] text-muted-foreground">
                    {form.message.length}/6000
                  </div>
                </Field>

                <div
                  className="absolute -left-[9999px] -top-[9999px] h-px w-px overflow-hidden"
                  aria-hidden="true"
                >
                  <label>
                    Website
                    <input
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.website}
                      onChange={(event) => set("website", event.target.value)}
                    />
                  </label>
                </div>

                {submitError ? (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    role="alert"
                  >
                    {submitError}
                  </div>
                ) : null}

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <p className="text-xs leading-5 text-muted-foreground max-w-md">
                    By submitting, you are asking GDP Clothing to contact you
                    about this request. Do not include payment card information
                    in your message.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-11 px-5 rounded-lg bg-foreground text-background text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 shrink-0"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Sending…
                      </>
                    ) : (
                      <>
                        Send message <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl bg-[#111111] text-white p-5 md:p-6">
              <div className="w-10 h-10 rounded-xl bg-white/10 grid place-items-center">
                <Shirt size={19} />
              </div>
              <h2 className="mt-5 text-xl font-semibold">{content.customTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {content.customText}
              </p>
              <Link
                to="/custom-studio"
                className="mt-5 h-10 px-4 rounded-lg bg-white text-black text-sm font-semibold inline-flex items-center gap-2"
              >
                Start a custom design <ArrowRight size={14} />
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
              <div className="w-10 h-10 rounded-xl bg-muted grid place-items-center">
                <HelpCircle size={19} />
              </div>
              <h2 className="mt-5 text-lg font-semibold">{content.faqTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {content.faqText}
              </p>
              <Link
                to="/faq"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:text-accent"
              >
                Visit FAQ <ArrowRight size={14} />
              </Link>
            </div>

            {(store.phone || content.locationNote) && (
              <div className="rounded-2xl border border-border bg-muted/40 p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  GDP Clothing
                </div>
                <div className="mt-3 space-y-3 text-sm">
                  {store.phone ? (
                    <a
                      href={`tel:${telHref}`}
                      className="flex items-center gap-2 hover:text-accent"
                    >
                      <Phone size={15} /> {store.phone}
                    </a>
                  ) : null}
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin size={15} className="mt-0.5 shrink-0" />
                    <span>{content.locationNote}</span>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
