import React, { useEffect, useState } from "react";
import { Check, Cookie, LockKeyhole, Settings2, X } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "gdp_cookie_preferences_v1";

const ESSENTIAL_ONLY = {
  essential: true,
  analytics: false,
  marketing: false,
  savedAt: null,
};

function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function savePreferences(preferences) {
  const value = { ...preferences, essential: true, savedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Preference still applies for the current page when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent("gdp:cookie-preferences-changed", { detail: value }));
  return value;
}

export function getCookiePreferences() {
  return readStored() || ESSENTIAL_ONLY;
}

export default function CookiePreferences() {
  const [stored, setStored] = useState(() => readStored());
  const [open, setOpen] = useState(() => !readStored());
  const [customize, setCustomize] = useState(false);
  const [draft, setDraft] = useState(() => readStored() || ESSENTIAL_ONLY);

  useEffect(() => {
    const openPreferences = () => {
      const current = readStored() || ESSENTIAL_ONLY;
      setDraft(current);
      setCustomize(true);
      setOpen(true);
    };
    window.addEventListener("gdp:open-cookie-preferences", openPreferences);
    return () => window.removeEventListener("gdp:open-cookie-preferences", openPreferences);
  }, []);

  const apply = (next) => {
    const saved = savePreferences(next);
    setStored(saved);
    setDraft(saved);
    setOpen(false);
    setCustomize(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[120] border-t border-border/80 bg-background/95 p-4 shadow-[0_-16px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-5xl sm:rounded-2xl sm:border md:p-5"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-preferences-title"
      aria-describedby="cookie-preferences-description"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-foreground text-background shadow-sm">
          <Cookie size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="cookie-preferences-title" className="text-base font-bold tracking-tight sm:text-lg">Your privacy choices</h2>
              <p id="cookie-preferences-description" className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                We use essential cookies to keep your cart, account, and checkout working. With your permission, we’ll also use analytics and marketing cookies to improve your experience.
              </p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Learn more in our <Link to="/pages/privacy-policy" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">Privacy Policy</Link> and <Link to="/pages/cookie-policy" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">Cookie Policy</Link>.
              </p>
            </div>
            {stored && (
              <button type="button" onClick={() => setOpen(false)} className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Close privacy choices">
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>

          {customize && (
            <div className="mt-4 grid gap-2 rounded-xl border border-border bg-secondary/25 p-2.5 sm:grid-cols-3">
              <PreferenceRow label="Essential" description="Authentication, cart, checkout, security and core preferences." checked disabled />
              <PreferenceRow label="Analytics" description="Helps us understand how the store is used and improve it." checked={Boolean(draft.analytics)} onChange={(checked) => setDraft((current) => ({ ...current, analytics: checked }))} />
              <PreferenceRow label="Marketing" description="Allows relevant offers and advertising measurement." checked={Boolean(draft.marketing)} onChange={(checked) => setDraft((current) => ({ ...current, marketing: checked }))} />
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {customize ? (
              <>
                <button type="button" onClick={() => apply(draft)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-accent-foreground shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  <Check size={16} aria-hidden="true" /> Save preferences
                </button>
                <button type="button" onClick={() => apply(ESSENTIAL_ONLY)} className="h-11 rounded-lg border border-border bg-background px-5 text-sm font-semibold transition hover:border-foreground/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  Essential only
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => apply({ essential: true, analytics: true, marketing: true })} className="h-11 rounded-lg bg-accent px-5 text-sm font-bold text-accent-foreground shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  Accept all
                </button>
                <button type="button" onClick={() => apply(ESSENTIAL_ONLY)} className="h-11 rounded-lg border border-border bg-background px-5 text-sm font-semibold transition hover:border-foreground/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  Essential only
                </button>
                <button type="button" onClick={() => setCustomize(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <Settings2 size={16} aria-hidden="true" /> Manage preferences
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferenceRow({ label, description, checked, onChange = undefined, disabled = false }) {
  return (
    <label className={`flex min-h-[88px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${checked ? "border-foreground/15 bg-background" : "border-transparent bg-background/60 hover:border-border"} ${disabled ? "cursor-default" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="peer sr-only"
      />
      <span aria-hidden="true" className={`mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 ${checked ? "bg-accent" : "bg-muted-foreground/30"}`}>
        <span className={`grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition ${checked ? "translate-x-4" : "translate-x-0"}`}>
          {disabled && <LockKeyhole size={10} className="text-black" />}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
