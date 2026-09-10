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

  useEffect(() => {
    const isVisible = Boolean(open);
    document.documentElement.dataset.privacyPanelOpen = isVisible ? "true" : "false";
    window.dispatchEvent(
      new CustomEvent("gdp:privacy-panel-visibility", {
        detail: { open: isVisible, customize: Boolean(customize) },
      })
    );

    return () => {
      document.documentElement.dataset.privacyPanelOpen = "false";
      window.dispatchEvent(
        new CustomEvent("gdp:privacy-panel-visibility", {
          detail: { open: false, customize: false },
        })
      );
    };
  }, [open, customize]);

  useEffect(() => {
    if (!open || !customize) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (stored) {
        setOpen(false);
        setCustomize(false);
      } else {
        setCustomize(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, customize, stored]);

  const apply = (next) => {
    const saved = savePreferences(next);
    setStored(saved);
    setDraft(saved);
    setOpen(false);
    setCustomize(false);
  };

  const exitCustomize = () => {
    if (stored) {
      setOpen(false);
      setCustomize(false);
      return;
    }
    setCustomize(false);
  };

  if (!open) return null;

  if (customize) {
    return (
      <div
        className="fixed inset-0 z-[130] flex items-end justify-center bg-black/35 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        aria-describedby="cookie-preferences-description"
        data-privacy-panel="manage"
      >
        <div className="flex max-h-[min(84dvh,680px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground text-background shadow-sm">
              <Cookie size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="cookie-preferences-title" className="text-base font-bold tracking-tight sm:text-lg">Manage privacy choices</h2>
              <p id="cookie-preferences-description" className="mt-1 text-sm leading-5 text-muted-foreground">
                Essential cookies always stay on. Choose whether GDP Clothing may also use analytics and marketing cookies.
              </p>
            </div>
            <button
              type="button"
              onClick={exitCustomize}
              className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close privacy preferences"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <div className="grid gap-2.5 md:grid-cols-3">
              <PreferenceRow label="Essential" description="Authentication, cart, checkout, security and core preferences." checked disabled />
              <PreferenceRow label="Analytics" description="Helps us understand how the store is used and improve it." checked={Boolean(draft.analytics)} onChange={(checked) => setDraft((current) => ({ ...current, analytics: checked }))} />
              <PreferenceRow label="Marketing" description="Allows relevant offers and advertising measurement." checked={Boolean(draft.marketing)} onChange={(checked) => setDraft((current) => ({ ...current, marketing: checked }))} />
            </div>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Learn more in our <Link to="/pages/privacy-policy" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">Privacy Policy</Link> and <Link to="/pages/cookie-policy" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">Cookie Policy</Link>.
            </p>
          </div>

          <div className="grid shrink-0 gap-2 border-t border-border bg-background px-4 py-3 sm:flex sm:justify-end sm:px-5">
            <button type="button" onClick={() => apply(ESSENTIAL_ONLY)} className="h-11 rounded-lg border border-border bg-background px-5 text-sm font-semibold transition hover:border-foreground/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Essential only
            </button>
            <button type="button" onClick={() => apply(draft)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-bold text-accent-foreground shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              <Check size={16} aria-hidden="true" /> Save preferences
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed left-3 right-3 z-[90] rounded-2xl border border-border/90 bg-background/98 p-3.5 shadow-2xl backdrop-blur-xl sm:left-5 sm:right-auto sm:w-[420px] sm:p-4"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-preferences-title"
      aria-describedby="cookie-preferences-description"
      data-privacy-panel="compact"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-foreground text-background shadow-sm">
          <Cookie size={17} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="cookie-preferences-title" className="text-sm font-bold tracking-tight sm:text-base">Your privacy choices</h2>
              <p id="cookie-preferences-description" className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
                Essential cookies keep your cart and checkout working. Analytics and marketing stay off unless you allow them.
              </p>
            </div>
            {stored && (
              <button type="button" onClick={() => setOpen(false)} className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Close privacy choices">
                <X size={17} aria-hidden="true" />
              </button>
            )}
          </div>

          <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
            <Link to="/pages/privacy-policy" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">Privacy</Link>
            <span aria-hidden="true"> · </span>
            <Link to="/pages/cookie-policy" className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">Cookies</Link>
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => apply({ essential: true, analytics: true, marketing: true })} className="h-10 rounded-lg bg-accent px-3 text-xs font-bold text-accent-foreground shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:text-sm">
          Accept all
        </button>
        <button type="button" onClick={() => apply(ESSENTIAL_ONLY)} className="h-10 rounded-lg border border-border bg-background px-3 text-xs font-semibold transition hover:border-foreground/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:text-sm">
          Essential only
        </button>
        <button type="button" onClick={() => setCustomize(true)} className="col-span-2 inline-flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Settings2 size={14} aria-hidden="true" /> Manage preferences
        </button>
      </div>
    </div>
  );
}

function PreferenceRow({ label, description, checked, onChange = undefined, disabled = false }) {
  return (
    <label className={`flex min-h-[88px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${checked ? "border-foreground/15 bg-secondary/30" : "border-border bg-background hover:border-foreground/25"} ${disabled ? "cursor-default" : ""}`}>
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
