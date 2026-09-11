import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Clock3,
  Facebook,
  Instagram,
  Mail,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  DEFAULT_MAINTENANCE_SETTINGS,
  maintenanceSettingsApi,
} from "@/lib/maintenanceSettingsApi";

const ADMIN_SAFE_PATHS = ["/login", "/forgot-password", "/reset-password"];

export default function MaintenanceGate({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const previewRequested = useMemo(
    () => new URLSearchParams(location.search).get("maintenancePreview") === "1",
    [location.search]
  );

  const isAdmin = user?.role === "admin";
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isSafeAuthRoute = ADMIN_SAFE_PATHS.includes(location.pathname);
  const bypassPublicCheck = (isAdmin && !previewRequested) || isAdminRoute || isSafeAuthRoute;

  useEffect(() => {
    if (bypassPublicCheck) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    let timer;

    const refresh = async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const next = await maintenanceSettingsApi.loadPublic();
        if (active) setSnapshot(next);
      } catch (error) {
        // Fail open: a settings read issue should never make the public store unavailable.
        console.error("Maintenance status check failed:", error);
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    refresh();
    timer = window.setInterval(() => refresh({ silent: true }), 60_000);

    const onFocus = () => refresh({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh({ silent: true });
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bypassPublicCheck]);

  if (bypassPublicCheck) return children;

  if (loading && !snapshot) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-[#080808] text-white">
        <div className="flex items-center gap-3 text-sm text-white/70">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          Checking store status…
        </div>
      </div>
    );
  }

  const maintenance = snapshot?.maintenance || DEFAULT_MAINTENANCE_SETTINGS;
  if (previewRequested && isAdmin) {
    return <MaintenancePage snapshot={snapshot} preview />;
  }

  if (maintenance.enabled) {
    return <MaintenancePage snapshot={snapshot} />;
  }

  return children;
}

function MaintenancePage({ snapshot, preview = false }) {
  const maintenance = snapshot?.maintenance || DEFAULT_MAINTENANCE_SETTINGS;
  const storeName = snapshot?.storeName || "GDP Clothing";
  const socialLinks = [
    { label: "Instagram", href: snapshot?.instagram, icon: Instagram },
    { label: "Facebook", href: snapshot?.facebook, icon: Facebook },
    { label: "TikTok", href: snapshot?.tiktok, icon: ArrowUpRight },
  ].filter((item) => Boolean(item.href));

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${storeName} — ${maintenance.statusLabel || "Maintenance"}`;
    return () => {
      document.title = previousTitle;
    };
  }, [maintenance.statusLabel, storeName]);

  const eta = maintenance.showEstimatedReturn && maintenance.estimatedReturnAt
    ? formatEta(maintenance.estimatedReturnAt)
    : "";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080808] text-white selection:bg-[#d7193f] selection:text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-25rem] h-[52rem] w-[52rem] -translate-x-1/2 rounded-full bg-[#d7193f]/15 blur-[140px]" />
        <div className="absolute bottom-[-18rem] right-[-12rem] h-[38rem] w-[38rem] rounded-full bg-white/5 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {snapshot?.logo ? (
              <img
                src={snapshot.logo}
                alt={`${storeName} logo`}
                className="h-11 max-w-[150px] object-contain object-left"
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#d7193f] text-[11px] font-black tracking-tight shadow-lg shadow-[#d7193f]/20">
                GDP
              </div>
            )}
            <div>
              <div className="text-sm font-semibold tracking-wide">{storeName}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.28em] text-white/45">Good people. Dope clothes.</div>
            </div>
          </div>

          {preview && (
            <a
              href="/admin/settings"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/15"
            >
              Preview mode <ArrowUpRight size={13} />
            </a>
          )}
        </header>

        <section className="flex flex-1 items-center py-12 sm:py-16 lg:py-20">
          <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.65fr)] lg:items-end">
            <div className="max-w-4xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/70 backdrop-blur">
                <Wrench size={13} /> {maintenance.eyebrow || "GDP CLOTHING"}
              </div>

              <h1 className="max-w-4xl text-5xl font-black leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-7xl xl:text-[5.6rem]">
                {maintenance.title || DEFAULT_MAINTENANCE_SETTINGS.title}
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-white/62 sm:text-lg sm:leading-8">
                {maintenance.message || DEFAULT_MAINTENANCE_SETTINGS.message}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {maintenance.showContact && snapshot?.contactEmail && (
                  <a
                    href={`mailto:${snapshot.contactEmail}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90"
                  >
                    <Mail size={16} /> {maintenance.contactLabel || "Contact us"}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <RefreshCw size={15} /> Refresh status
                </button>
              </div>
            </div>

            <aside className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d7193f]/15 text-[#ff5876]">
                  <ShieldCheck size={19} />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Current status</div>
                  <div className="mt-1.5 text-lg font-semibold">{maintenance.statusLabel || "Site maintenance"}</div>
                  <p className="mt-2 text-sm leading-6 text-white/50">The storefront is temporarily paused while we work on the experience.</p>
                </div>
              </div>

              {eta && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <Clock3 size={17} className="mt-0.5 shrink-0 text-white/60" />
                  <div>
                    <div className="text-xs font-semibold text-white/75">Estimated return</div>
                    <div className="mt-1 text-sm text-white/50">{eta}</div>
                  </div>
                </div>
              )}

              {maintenance.showSocialLinks && socialLinks.length > 0 && (
                <div className="mt-5 border-t border-white/10 pt-5">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Stay connected</div>
                  <div className="flex flex-wrap gap-2">
                    {socialLinks.map(({ label, href, icon: Icon }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/10 hover:text-white"
                      >
                        <Icon size={14} /> {label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-5 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {storeName}</span>
          <span>Thanks for your patience.</span>
        </footer>
      </div>
    </main>
  );
}

function formatEta(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
