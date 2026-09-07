import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Database,
  FileCheck2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { securityComplianceApi } from "@/lib/securityComplianceApi";

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  verified: "Verified",
  not_applicable: "N/A",
};

const PRIORITY_WEIGHT = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2,
};

const STATUS_CREDIT = {
  open: 0,
  in_progress: 0.45,
  verified: 1,
  not_applicable: null,
};

const EMPTY_SNAPSHOT = {
  checked_at: null,
  public_table_count: 0,
  rls_enabled_count: 0,
  rls_missing_count: 0,
  anon_security_definer_count: 0,
  customer_upload_policy_count: 0,
  checkout_rate_limit_private: false,
  public_view_count: 0,
};

function formatCheckedAt(value) {
  if (!value) return "Not checked";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Not checked";
  }
}

function priorityClass(priority) {
  if (priority === "critical") return "bg-red-50 text-red-700 border-red-200";
  if (priority === "high") return "bg-amber-50 text-amber-700 border-amber-200";
  if (priority === "low") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function statusClass(status) {
  if (status === "verified") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "in_progress") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "not_applicable") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function readinessScore(controls, systemChecks) {
  let earned = 0;
  let possible = 0;

  controls.forEach((control) => {
    const weight = PRIORITY_WEIGHT[control.priority] || 4;
    const credit = STATUS_CREDIT[control.status];
    if (credit === null || credit === undefined) return;
    possible += weight;
    earned += weight * credit;
  });

  systemChecks.forEach((check) => {
    const weight = 8;
    possible += weight;
    earned += check.ok ? weight : 0;
  });

  if (!possible) return 0;
  return Math.round((earned / possible) * 100);
}

function SystemCheck({ check }) {
  const Icon = check.ok ? CheckCircle2 : AlertTriangle;
  return (
    <div className="rounded-xl border border-[#e1e1e1] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${check.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1f1f1f]">{check.title}</div>
          <div className="mt-1 text-xs leading-5 text-[#666]">{check.detail}</div>
        </div>
      </div>
    </div>
  );
}

function ControlRow({ control, saving, onSave }) {
  const [evidence, setEvidence] = useState(control.evidence || "");

  useEffect(() => {
    setEvidence(control.evidence || "");
  }, [control.control_key, control.evidence]);

  const evidenceChanged = evidence !== (control.evidence || "");

  return (
    <div className="border-t border-[#ececec] px-4 py-4 first:border-t-0 md:px-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-[#202020]">{control.title}</div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityClass(control.priority)}`}>
              {control.priority}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(control.status)}`}>
              {STATUS_LABELS[control.status] || control.status}
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#666]">{control.description}</p>

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer select-none font-medium text-[#444]">Recommended action</summary>
            <p className="mt-2 rounded-lg bg-[#f7f7f7] px-3 py-2.5 leading-6 text-[#666]">{control.remediation}</p>
          </details>
        </div>

        <div className="w-full shrink-0 space-y-2 xl:w-[360px]">
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <select
              value={control.status}
              disabled={saving}
              onChange={(event) => onSave(control.control_key, { status: event.target.value })}
              className="h-10 rounded-lg border border-[#d6d6d6] bg-white px-2 text-sm outline-none focus:border-[#888]"
              aria-label={`Status for ${control.title}`}
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="verified">Verified</option>
              <option value="not_applicable">Not applicable</option>
            </select>
            <div className="flex h-10 items-center rounded-lg border border-[#e2e2e2] bg-[#fafafa] px-3 text-xs text-[#666]">
              Owner: {control.owner_label || "Store owner"}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              placeholder="Add verification evidence or notes"
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#d6d6d6] bg-white px-3 text-sm outline-none focus:border-[#888]"
            />
            <button
              type="button"
              disabled={!evidenceChanged || saving}
              onClick={() => onSave(control.control_key, { evidence })}
              className="h-10 shrink-0 rounded-lg bg-[#222] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          {control.reviewed_at && (
            <div className="text-[11px] text-[#888]">Last reviewed {formatCheckedAt(control.reviewed_at)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SecurityComplianceModule() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [controls, setControls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");

  const load = async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await securityComplianceApi.load();
      setSnapshot({ ...EMPTY_SNAPSHOT, ...(data.snapshot || {}) });
      setControls(data.controls || []);
    } catch (loadError) {
      console.error("Security compliance load failed:", loadError);
      setError(loadError?.message || "Could not load the security compliance center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const systemChecks = useMemo(() => {
    const tableCount = Number(snapshot.public_table_count || 0);
    const rlsEnabled = Number(snapshot.rls_enabled_count || 0);
    const rlsMissing = Number(snapshot.rls_missing_count || 0);
    const definerCount = Number(snapshot.anon_security_definer_count || 0);
    const uploadPolicyCount = Number(snapshot.customer_upload_policy_count || 0);
    const publicViewCount = Number(snapshot.public_view_count || 0);

    return [
      {
        id: "rls",
        title: "Supabase RLS coverage",
        ok: tableCount > 0 && rlsMissing === 0,
        detail: tableCount
          ? `${rlsEnabled}/${tableCount} public tables have RLS enabled; ${rlsMissing} missing.`
          : "Waiting for database posture data.",
      },
      {
        id: "definer",
        title: "Privileged function exposure",
        ok: definerCount === 0,
        detail: definerCount === 0
          ? "No SECURITY DEFINER function in public is directly executable by anonymous clients."
          : `${definerCount} public SECURITY DEFINER function(s) are executable anonymously and require review.`,
      },
      {
        id: "uploads",
        title: "Customer upload isolation",
        ok: uploadPolicyCount >= 4,
        detail: `${uploadPolicyCount}/4 owner-scoped storage operations detected for customer uploads.`,
      },
      {
        id: "checkout",
        title: "Checkout rate-limit isolation",
        ok: Boolean(snapshot.checkout_rate_limit_private),
        detail: snapshot.checkout_rate_limit_private
          ? "The checkout rate-limit table is RLS-protected, has no browser policy, and its consume RPC is not anonymous."
          : "Checkout rate-limit access requires review.",
      },
      {
        id: "views",
        title: "Public database views",
        ok: publicViewCount === 0,
        detail: publicViewCount === 0
          ? "No public SQL views currently require a security-invoker review."
          : `${publicViewCount} public view(s) exist and should be checked for security-invoker behavior.`,
      },
    ];
  }, [snapshot]);

  const score = useMemo(() => readinessScore(controls, systemChecks), [controls, systemChecks]);
  const verified = controls.filter((control) => control.status === "verified").length;
  const criticalOpen = controls.filter(
    (control) => control.priority === "critical" && control.status === "open"
  ).length;
  const livePassed = systemChecks.filter((check) => check.ok).length;

  const groupedControls = useMemo(() => {
    return controls.reduce((groups, control) => {
      if (!groups[control.category]) groups[control.category] = [];
      groups[control.category].push(control);
      return groups;
    }, {});
  }, [controls]);

  const updateControl = async (controlKey, changes) => {
    setSavingKey(controlKey);
    setError("");
    try {
      const updated = await securityComplianceApi.updateControl(controlKey, changes);
      setControls((current) =>
        current.map((control) => (control.control_key === controlKey ? updated : control))
      );
    } catch (saveError) {
      console.error("Security compliance update failed:", saveError);
      setError(saveError?.message || "Could not update this security control.");
    } finally {
      setSavingKey("");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 pb-12 md:px-6">
        <div className="rounded-2xl border border-[#dfdfdf] bg-white p-8 text-sm text-[#666]">
          Loading security posture…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 pb-12 md:px-6">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button type="button" onClick={() => load()} className="font-semibold underline">Retry</button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#dadada] bg-white">
        <div className="grid gap-0 lg:grid-cols-[1.45fr_0.55fr]">
          <div className="p-5 md:p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6d6d6d]">
              <ShieldCheck size={16} /> Production security baseline
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div>
                <div className="text-4xl font-black tracking-tight text-[#171717]">{score}%</div>
                <div className="mt-1 text-sm font-medium text-[#555]">Security readiness</div>
              </div>
              <div className="mb-1 rounded-full border border-[#ddd] bg-[#fafafa] px-3 py-1 text-xs text-[#666]">
                Not a certification score
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#ececec]">
              <div className="h-full rounded-full bg-[#222] transition-all" style={{ width: `${score}%` }} />
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[#666]">
              This center combines live Supabase checks with reviewable controls for Cloudflare, GitHub,
              Stripe/payment scope, privacy, backups, access reviews, and incident response.
            </p>
          </div>

          <div className="border-t border-[#e5e5e5] bg-[#fafafa] p-5 lg:border-l lg:border-t-0 md:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#777]">Last live check</div>
            <div className="mt-2 text-sm font-semibold text-[#222]">{formatCheckedAt(snapshot.checked_at)}</div>
            <button
              type="button"
              onClick={() => load({ quiet: true })}
              disabled={refreshing}
              className="mt-4 flex h-9 items-center gap-2 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm font-medium hover:bg-[#f7f7f7] disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh posture"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Critical open", value: criticalOpen, Icon: AlertTriangle },
          { label: "Manual controls verified", value: verified, Icon: FileCheck2 },
          { label: "Live checks passed", value: `${livePassed}/${systemChecks.length}`, Icon: Database },
          { label: "Admin-only registry", value: "Protected", Icon: LockKeyhole },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-[#dedede] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-[#777]">{label}</div>
              <Icon size={16} className="text-[#777]" />
            </div>
            <div className="mt-2 text-2xl font-bold text-[#222]">{value}</div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#222]">Live technical checks</h2>
            <p className="mt-1 text-sm text-[#777]">Read-only checks generated from the production database posture.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {systemChecks.map((check) => <SystemCheck key={check.id} check={check} />)}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#dadada] bg-white">
        <div className="border-b border-[#e6e6e6] px-4 py-4 md:px-5">
          <div className="flex items-center gap-2">
            <CircleDot size={17} className="text-[#555]" />
            <h2 className="font-bold text-[#222]">Required and recommended controls</h2>
          </div>
          <p className="mt-1 text-sm text-[#777]">
            Mark a control verified only when you have evidence. Status and notes are stored in the admin-only compliance registry.
          </p>
        </div>

        {Object.entries(groupedControls).map(([category, categoryControls]) => (
          <div key={category}>
            <div className="border-t border-[#e6e6e6] bg-[#fafafa] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#666] first:border-t-0 md:px-5">
              {category}
            </div>
            {categoryControls.map((control) => (
              <ControlRow
                key={control.control_key}
                control={control}
                saving={savingKey === control.control_key}
                onSave={updateControl}
              />
            ))}
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {[
          ["PIPEDA / Canadian privacy", "Protect customer personal information with appropriate safeguards, transparent handling, retention rules, access controls, and a breach-response process."],
          ["PCI DSS", "Minimize GDP Clothing card-data scope by keeping raw payment-card data inside Stripe-controlled payment components and documenting the applicable merchant responsibilities."],
          ["OWASP ASVS 5.0", "Use ASVS as the application-security verification baseline for authentication, access control, input handling, session security, data protection, logging, and deployment."],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl border border-[#dedede] bg-white p-4">
            <div className="flex items-center gap-2 font-semibold text-[#222]">
              <ShieldCheck size={16} /> {title}
            </div>
            <p className="mt-2 text-sm leading-6 text-[#666]">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
