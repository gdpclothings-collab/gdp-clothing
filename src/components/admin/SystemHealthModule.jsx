import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cloud,
  CreditCard,
  Database,
  ExternalLink,
  Gauge,
  GitBranch,
  Globe2,
  HeartPulse,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import { systemHealthApi } from "@/lib/systemHealthApi";

const STATUS = {
  healthy: {
    label: "Healthy",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  warning: {
    label: "Warning",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
    icon: AlertTriangle,
  },
  critical: {
    label: "Critical",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    icon: XCircle,
  },
  info: {
    label: "Info",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    icon: CircleAlert,
  },
  unknown: {
    label: "Unknown",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    icon: CircleAlert,
  },
};

const CATEGORY_ICONS = {
  Website: Globe2,
  Supabase: Database,
  Payments: CreditCard,
  Commerce: PackageCheck,
  "Custom Studio": Sparkles,
  Deployment: GitBranch,
  Security: ShieldCheck,
};

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function relativeTime(value) {
  if (!value) return "—";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusMeta(status) {
  return STATUS[status] || STATUS.unknown;
}

function StatusBadge({ status, compact = false }) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs"} ${meta.badge}`}>
      <Icon size={compact ? 12 : 13} />
      {meta.label}
    </span>
  );
}

function ScoreCard({ snapshot }) {
  const score = Number(snapshot?.score ?? 0);
  const status = snapshot?.status || "unknown";
  const meta = statusMeta(status);

  return (
    <section className="rounded-2xl border border-[#dfe1e5] bg-white p-5 md:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="relative w-24 h-24 rounded-full border-[9px] border-[#eceef1] grid place-items-center shrink-0">
            <div className={`absolute inset-[-9px] rounded-full border-[9px] ${status === "healthy" ? "border-emerald-500" : status === "critical" ? "border-red-500" : "border-amber-500"}`} style={{ clipPath: `inset(${Math.max(0, 100 - score)}% 0 0 0)` }} />
            <div className="relative text-center">
              <div className="text-2xl font-black tracking-tight">{score}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#74777e]">of 100</div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Overall system health</h2>
              <StatusBadge status={status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-[#5d6169] max-w-2xl">
              Live operational checks for GDP Clothing production. The score is calculated from current customer-facing, database, payment, checkout, deployment and security signals.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#777b83]">
              <span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> Last checked {relativeTime(snapshot?.checkedAt)}</span>
              <span className="inline-flex items-center gap-1.5"><CreditCard size={13} /> Stripe {String(snapshot?.paymentMode || "unknown").toUpperCase()}</span>
              <span className="inline-flex items-center gap-1.5"><Wrench size={13} /> Maintenance {snapshot?.maintenanceEnabled ? "ON" : "OFF"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#e3e4e7] bg-[#f8f9fa] px-4 py-3 min-w-[230px]">
          <div className="text-[11px] uppercase tracking-[0.13em] font-bold text-[#7b7e85]">Production posture</div>
          <div className="mt-1.5 flex items-center gap-2 font-semibold">
            <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
            {status === "healthy" ? "Ready" : status === "critical" ? "Needs attention" : "Operational with warnings"}
          </div>
          <div className="text-xs text-[#777] mt-1">Live checks only — no simulated health score.</div>
        </div>
      </div>
    </section>
  );
}

function CheckCard({ check }) {
  const meta = statusMeta(check.status);
  const Icon = meta.icon;

  return (
    <article className="rounded-xl border border-[#e0e2e6] bg-white p-4 hover:border-[#c9ccd2] transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${check.status === "healthy" ? "bg-emerald-50 text-emerald-700" : check.status === "critical" ? "bg-red-50 text-red-700" : check.status === "warning" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-sm leading-5">{check.label}</div>
            <StatusBadge status={check.status} compact />
          </div>
          <div className="text-sm text-[#565a62] mt-1.5 leading-5">{check.summary}</div>
          {check.details && <div className="text-xs text-[#80838a] mt-2 leading-5 break-words">{check.details}</div>}
          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#92959b]">
            <span>{check.metric !== undefined && check.metric !== null ? `Metric: ${check.metric}` : check.category}</span>
            <span>{relativeTime(check.updatedAt)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CategorySection({ category, checks }) {
  const Icon = CATEGORY_ICONS[category] || Activity;
  const critical = checks.filter((check) => check.status === "critical").length;
  const warning = checks.filter((check) => check.status === "warning").length;
  const categoryStatus = critical ? "critical" : warning ? "warning" : checks.some((check) => check.status === "unknown") ? "unknown" : "healthy";

  return (
    <section className="rounded-2xl border border-[#dfe1e5] bg-[#fafafa] overflow-hidden">
      <div className="px-4 md:px-5 py-4 border-b border-[#e4e5e8] bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#17181b] text-white grid place-items-center"><Icon size={16} /></div>
          <div>
            <div className="font-semibold text-sm">{category}</div>
            <div className="text-[11px] text-[#7b7e84]">{checks.length} live check{checks.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <StatusBadge status={categoryStatus} compact />
      </div>
      <div className="p-3 md:p-4 grid md:grid-cols-2 gap-3">
        {checks.map((check) => <CheckCard key={check.key} check={check} />)}
      </div>
    </section>
  );
}

function IncidentsPanel({ incidents = [] }) {
  return (
    <section className="rounded-2xl border border-[#dfe1e5] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[#e7e8eb] flex items-center justify-between">
        <div>
          <div className="font-semibold">Recent incidents</div>
          <div className="text-xs text-[#7b7e84] mt-0.5">Open security issues and failed production checks</div>
        </div>
        <HeartPulse size={18} className="text-[#686c73]" />
      </div>

      {incidents.length ? (
        <div className="divide-y divide-[#ececef]">
          {incidents.map((incident, index) => (
            <div key={`${incident.type || "incident"}-${index}`} className="px-5 py-4 flex items-start gap-3">
              <AlertTriangle size={17} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{incident.title || "System incident"}</div>
                <div className="text-xs text-[#777b82] mt-1">
                  {String(incident.severity || "warning").toUpperCase()} · {incident.status || "open"} · {formatTime(incident.detectedAt)}
                </div>
                {incident.affectedSystems?.length ? (
                  <div className="text-xs text-[#8b8e94] mt-1.5">Affected: {incident.affectedSystems.join(", ")}</div>
                ) : null}
              </div>
              {incident.url ? (
                <a href={incident.url} target="_blank" rel="noreferrer" className="text-[#4f535a] hover:text-black" aria-label="Open incident source">
                  <ExternalLink size={15} />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
          <div className="font-semibold text-sm mt-2">No active incidents</div>
          <div className="text-xs text-[#7d8087] mt-1">No open security incidents or failed production workflows were reported.</div>
        </div>
      )}
    </section>
  );
}

export default function SystemHealthModule() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const next = await systemHealthApi.loadSnapshot();
      setSnapshot(next);
    } catch (healthError) {
      console.error("GDP system health load failed", healthError);
      setError(healthError?.message || "System health could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load({ initial: true });
    const timer = window.setInterval(() => load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const check of snapshot?.checks || []) {
      if (!groups.has(check.category)) groups.set(check.category, []);
      groups.get(check.category).push(check);
    }
    return [...groups.entries()];
  }, [snapshot]);

  const counts = useMemo(() => {
    const checks = snapshot?.checks || [];
    return {
      healthy: checks.filter((check) => check.status === "healthy").length,
      warning: checks.filter((check) => check.status === "warning").length,
      critical: checks.filter((check) => check.status === "critical").length,
      unknown: checks.filter((check) => check.status === "unknown").length,
    };
  }, [snapshot]);

  if (loading && !snapshot) {
    return (
      <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="rounded-2xl border border-[#dfe1e5] bg-white min-h-[320px] grid place-items-center">
          <div className="text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-[#6d7178]" />
            <div className="font-semibold mt-3">Running live production checks…</div>
            <div className="text-xs text-[#7d8087] mt-1">Website, Supabase, Stripe, checkout, inventory and deployment</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} /> {counts.healthy} healthy</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"><AlertTriangle size={13} /> {counts.warning} warning</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"><XCircle size={13} /> {counts.critical} critical</span>
          {counts.unknown ? <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><CircleAlert size={13} /> {counts.unknown} unknown</span> : null}
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="h-9 px-3 rounded-lg border border-[#cfd2d7] bg-white flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[#f7f7f8] disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Checking…" : "Run diagnostic now"}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <XCircle size={18} className="text-red-700 mt-0.5" />
          <div>
            <div className="font-semibold text-sm text-red-900">System health request failed</div>
            <div className="text-sm text-red-800 mt-1">{error}</div>
          </div>
        </div>
      )}

      {snapshot?.maintenanceEnabled && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Wrench size={18} className="text-amber-700 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm text-amber-950">Maintenance mode is currently ON</div>
            <div className="text-xs text-amber-900 mt-1 leading-5">Customer storefront access is intentionally gated. Health checks still validate the domain, database, payments and deployment underneath the maintenance screen.</div>
          </div>
        </div>
      )}

      {snapshot ? <ScoreCard snapshot={snapshot} /> : null}

      <div className="mt-5 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#dfe1e5] bg-white p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#686c73]">Live checks</span><Activity size={16} /></div>
          <div className="text-2xl font-bold mt-2">{snapshot?.checks?.length || 0}</div>
          <div className="text-xs text-[#8a8d93] mt-1">Auto-refresh every 60 seconds</div>
        </div>
        <div className="rounded-xl border border-[#dfe1e5] bg-white p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#686c73]">Production score</span><Gauge size={16} /></div>
          <div className="text-2xl font-bold mt-2">{snapshot?.score ?? "—"}%</div>
          <div className="text-xs text-[#8a8d93] mt-1">Weighted by customer impact</div>
        </div>
        <div className="rounded-xl border border-[#dfe1e5] bg-white p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#686c73]">Payments</span><CreditCard size={16} /></div>
          <div className="text-2xl font-bold mt-2">{String(snapshot?.paymentMode || "—").toUpperCase()}</div>
          <div className="text-xs text-[#8a8d93] mt-1">Stripe mode from store settings</div>
        </div>
        <div className="rounded-xl border border-[#dfe1e5] bg-white p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#686c73]">Cloud delivery</span><Cloud size={16} /></div>
          <div className="text-2xl font-bold mt-2">Cloudflare</div>
          <div className="text-xs text-[#8a8d93] mt-1">Apex, www redirect and Pages origin</div>
        </div>
      </div>

      <div className="mt-5 grid xl:grid-cols-[1.6fr_0.8fr] gap-5 items-start">
        <div className="space-y-5">
          {grouped.map(([category, checks]) => <CategorySection key={category} category={category} checks={checks} />)}
        </div>
        <div className="space-y-5 xl:sticky xl:top-20">
          <IncidentsPanel incidents={snapshot?.incidents || []} />
          <section className="rounded-2xl border border-[#dfe1e5] bg-white p-5">
            <div className="font-semibold text-sm">How to read this page</div>
            <div className="mt-3 space-y-3 text-xs leading-5 text-[#686c73]">
              <div><strong className="text-emerald-700">Healthy</strong> means the live check passed.</div>
              <div><strong className="text-amber-800">Warning</strong> means the store can operate, but something needs review.</div>
              <div><strong className="text-red-700">Critical</strong> means a customer-facing, payment, checkout, inventory or deployment check failed.</div>
              <div><strong>Maintenance mode</strong> is shown as a warning rather than a failure because it can be intentionally enabled.</div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#ececef] text-[11px] text-[#96999f]">
              Checked {formatTime(snapshot?.checkedAt)}. This dashboard performs read-only diagnostics and does not create orders or charges.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
