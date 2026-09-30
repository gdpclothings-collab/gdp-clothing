import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  CreditCard,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
  Webhook,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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

function BooleanCheck({ label, value, icon: Icon }) {
  const healthy = value === true;
  const unknown = value !== true && value !== false;
  const StatusIcon = unknown ? CircleAlert : healthy ? CheckCircle2 : XCircle;
  const tone = unknown
    ? "border-slate-200 bg-slate-50 text-slate-700"
    : healthy
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className={`rounded-xl border px-3 py-3 flex items-center gap-3 ${tone}`}>
      <div className="w-8 h-8 rounded-lg bg-white/80 grid place-items-center shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold leading-4">{label}</div>
        <div className="text-[11px] mt-0.5 opacity-75">{unknown ? "Unknown" : healthy ? "Ready" : "Needs attention"}</div>
      </div>
      <StatusIcon size={16} className="shrink-0" />
    </div>
  );
}

async function readInvokePayload(error) {
  try {
    return await error?.context?.json?.();
  } catch {
    return null;
  }
}

export default function PaymentPreflightCard() {
  const [preflight, setPreflight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ initial = false } = {}) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("payment-preflight", {
        body: { action: "preflight" },
      });

      if (invokeError) {
        const payload = await readInvokePayload(invokeError);
        if (payload && typeof payload === "object") setPreflight(payload);
        throw new Error(payload?.message || invokeError.message || "Payment preflight could not complete.");
      }

      setPreflight(data || null);
    } catch (preflightError) {
      console.error("GDP payment preflight failed", preflightError);
      setError(preflightError?.message || "Payment preflight could not complete.");
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

  const checks = useMemo(() => [
    { label: "Secret key mode", value: preflight?.stripe?.secretModeAligned, icon: KeyRound },
    { label: "Publishable key mode", value: preflight?.stripe?.publishableModeAligned, icon: KeyRound },
    { label: "Stripe connection", value: preflight?.stripe?.connected, icon: CreditCard },
    { label: "Charges enabled", value: preflight?.stripe?.chargesEnabled, icon: CreditCard },
    { label: "Checkout gateway", value: preflight?.checkout?.gatewayReachable, icon: Server },
    { label: "Checkout core", value: preflight?.checkout?.coreReachable, icon: Server },
    { label: "Webhook secret", value: preflight?.webhook?.configured, icon: ShieldCheck },
    { label: "Webhook endpoint", value: preflight?.webhook?.endpointReachable, icon: Webhook },
  ], [preflight]);

  const ready = preflight?.ready === true;
  const statusLabel = loading && !preflight ? "Checking" : ready ? "Payment system ready" : "Payment system needs attention";
  const statusTone = loading && !preflight
    ? "border-slate-200 bg-slate-50 text-slate-800"
    : ready
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-900";
  const StatusIcon = loading && !preflight ? RefreshCw : ready ? CheckCircle2 : XCircle;

  return (
    <section data-gdp-payment-health="true" className="rounded-2xl border border-[#dfe1e5] bg-white shadow-sm overflow-hidden">
      <div className="p-5 md:p-6 border-b border-[#e8e9ec]">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone}`}>
                <StatusIcon size={14} className={loading && !preflight ? "animate-spin" : ""} />
                {statusLabel}
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-700">
                {String(preflight?.paymentMode || "—").toUpperCase()}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-tight">Production payment readiness</h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#5d6169]">
              Live read-only checks for Stripe mode alignment, Stripe connectivity, charge readiness, checkout services and webhook configuration.
            </p>
          </div>

          <button
            type="button"
            onClick={() => load()}
            disabled={refreshing || loading}
            className="h-9 px-3 rounded-lg border border-[#cfd2d7] bg-white inline-flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[#f7f7f8] disabled:opacity-60 shrink-0"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Checking…" : "Check payments now"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 flex items-start gap-2.5">
            <XCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      <div className="p-4 md:p-5 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {checks.map((check) => <BooleanCheck key={check.label} {...check} />)}
      </div>

      <div className="px-5 py-3.5 border-t border-[#ececef] bg-[#fafafa] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-[#777b83]">
        <span>Last checked {formatTime(preflight?.checkedAt)}</span>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> Read-only: no order, Checkout Session, PaymentIntent or charge is created.</span>
      </div>
    </section>
  );
}
