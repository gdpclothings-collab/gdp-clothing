import React, { useEffect, useState } from "react";
import { Facebook, Instagram, Youtube, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { DEFAULT_LANDING_PAGE } from "@/lib/landingPageDefaults";
import { isLandingDraftPreview, storefrontContentApi } from "@/lib/storefrontContentApi";
import { privacyApi } from "@/lib/privacyApi";

function ManagedLogo({ src, alt }) {
  const [currentSrc, setCurrentSrc] = useState(src || "/images/gdp-logo.webp");

  useEffect(() => {
    setCurrentSrc(src || "/images/gdp-logo.webp");
  }, [src]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className="h-11 w-[78px] object-contain object-left"
      onError={() => {
        if (currentSrc !== "/images/gdp-logo.webp") setCurrentSrc("/images/gdp-logo.webp");
      }}
    />
  );
}

const CUSTOMER_LINKS = [
  ["Contact", "/pages/contact"],
  ["FAQ", "/faq"],
  ["Shipping & Delivery", "/pages/shipping-delivery"],
  ["Returns & Refunds", "/pages/returns-refunds"],
  ["Custom Artwork Policy", "/pages/custom-artwork-policy"],
];

const LEGAL_LINKS = [
  ["Privacy Policy", "/pages/privacy"],
  ["Terms & Conditions", "/pages/terms"],
  ["Data Retention & Deletion", "/pages/data-retention"],
  ["Cookie & Tracking Policy", "/pages/cookie-policy"],
  ["Marketing Consent", "/pages/marketing-consent"],
];

const SECURITY_LINKS = [
  ["Payment Security", "/pages/payment-security"],
  ["Account Security", "/pages/account-security"],
  ["Security & Disclosure", "/pages/security"],
];

export default function StoreFooter() {
  const [landing, setLanding] = useState(DEFAULT_LANDING_PAGE);
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [subscribeState, setSubscribeState] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const previewDraft = isLandingDraftPreview();

  useEffect(() => {
    let active = true;
    storefrontContentApi
      .getHomepage({ previewDraft })
      .then((data) => {
        if (active && data) setLanding(data);
      })
      .catch((error) => {
        console.error("Store footer content load failed:", error);
      });

    return () => {
      active = false;
    };
  }, [previewDraft]);

  const branding = landing.branding || DEFAULT_LANDING_PAGE.branding;
  const footer = landing.footer || DEFAULT_LANDING_PAGE.footer;
  const social = footer.social || DEFAULT_LANDING_PAGE.footer.social;

  const subscribe = async (event) => {
    event.preventDefault();
    setSubscribeState("");
    if (!email.trim() || !email.includes("@")) {
      setSubscribeState("Enter a valid email address.");
      return;
    }
    if (!marketingOptIn) {
      setSubscribeState("Confirm the marketing consent checkbox first.");
      return;
    }

    setSubmitting(true);
    try {
      await privacyApi.recordMarketingConsent(email.trim(), true, "footer");
      setSubscribeState("Subscribed. You can withdraw consent at any time.");
      setEmail("");
      setMarketingOptIn(false);
    } catch (error) {
      setSubscribeState(error?.message || "Could not save your marketing preference.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-white/10 bg-[#080909] text-white">
      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-[1.25fr_.8fr_.9fr_.8fr_1.35fr]">
          <div>
            <Link to="/" aria-label="GDP Clothing home" className="inline-flex">
              <ManagedLogo
                src={branding.footerLogoUrl || branding.logoUrl}
                alt={branding.logoAlt || "GDP Clothing"}
              />
            </Link>
            <div className="mt-4 text-xs font-medium text-white/75">{footer.tagline}</div>
            {footer.description && (
              <div className="mt-2 max-w-sm text-[11px] leading-5 text-white/45">{footer.description}</div>
            )}
            <div className="mt-4 flex items-center gap-1">
              {social.instagram && <Social href={social.instagram} label="Instagram" icon={Instagram} />}
              {social.youtube && <Social href={social.youtube} label="YouTube" icon={Youtube} />}
              {social.facebook && <Social href={social.facebook} label="Facebook" icon={Facebook} />}
            </div>
          </div>

          <FooterGroup title="Customer Care" links={CUSTOMER_LINKS} />
          <FooterGroup title="Legal & Privacy" links={LEGAL_LINKS} />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">Security</div>
            <div className="mt-3 space-y-2.5">
              {SECURITY_LINKS.map(([label, to]) => (
                <Link key={to} to={to} className="block text-xs text-white/65 transition hover:text-white">{label}</Link>
              ))}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("gdp:open-cookie-preferences"))}
                className="block text-left text-xs text-white/65 transition hover:text-white"
              >
                Cookie Preferences
              </button>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1.5 text-[10px] text-emerald-100/75">
              <ShieldCheck size={13} /> Secure checkout via Stripe
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">GDP updates</div>
            <p className="mt-3 text-xs leading-5 text-white/55">
              Optional email updates for new drops, custom-printing news and special offers.
            </p>
            <form onSubmit={subscribe} className="mt-3">
              <div className="flex">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  aria-label="Marketing email"
                  className="min-w-0 flex-1 border border-white/15 bg-white/5 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-white/40"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="border border-l-0 border-white/15 bg-white px-3 text-[10px] font-black uppercase tracking-wide text-black disabled:opacity-50"
                >
                  {submitting ? "Saving" : "Join"}
                </button>
              </div>
              <label className="mt-2 flex items-start gap-2 text-[10px] leading-4 text-white/45">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(event) => setMarketingOptIn(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I agree to receive GDP Clothing marketing emails. I can unsubscribe anytime.{" "}
                  <Link to="/pages/marketing-consent" className="underline hover:text-white">Details</Link>
                </span>
              </label>
              {subscribeState && <div className="mt-2 text-[10px] leading-4 text-white/65">{subscribeState}</div>}
            </form>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-[9px] text-white/35 sm:flex-row sm:items-center sm:justify-between sm:text-[10px]">
          <div>{footer.copyrightText || ("© " + new Date().getFullYear() + " GDP Clothing. All rights reserved.")}</div>
          <div>Privacy-first custom apparel · Saskatoon, Saskatchewan, Canada</div>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">{title}</div>
      <div className="mt-3 space-y-2.5">
        {links.map(([label, to]) => (
          <Link key={to} to={to} className="block text-xs text-white/65 transition hover:text-white">{label}</Link>
        ))}
      </div>
    </div>
  );
}

function Social({ href, label, icon: Icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white hover:text-black"
      aria-label={label}
    >
      <Icon size={18} />
    </a>
  );
}
