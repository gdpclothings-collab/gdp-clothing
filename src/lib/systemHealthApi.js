import { supabase } from "@/lib/supabaseClient";

async function invokeHealth(body = { action: "snapshot" }) {
  const { data, error } = await supabase.functions.invoke("system-health", { body });

  if (error) {
    let message = error?.message || "System health check failed.";
    try {
      const payload = await error?.context?.json?.();
      if (payload?.message) message = payload.message;
    } catch {
      // Keep the connector error message when the response body cannot be read.
    }
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.message || "System health check failed.");
  }

  return data?.data ?? data ?? {};
}

async function invokePaymentPreflight() {
  const { data, error } = await supabase.functions.invoke("payment-preflight", {
    body: { action: "preflight" },
  });

  if (!error) return { payload: data ?? null, error: "" };

  let payload = null;
  try {
    payload = await error?.context?.json?.();
  } catch {
    // A network/runtime failure may not include a JSON response body.
  }

  return {
    payload,
    error: payload?.message || error?.message || "Payment readiness could not be confirmed.",
  };
}

const STATUS_PRIORITY = {
  healthy: 0,
  unknown: 1,
  warning: 2,
  critical: 3,
};

function worstStatus(baseStatus, paymentStatus) {
  const base = STATUS_PRIORITY[baseStatus] ?? STATUS_PRIORITY.unknown;
  const payment = STATUS_PRIORITY[paymentStatus] ?? STATUS_PRIORITY.unknown;
  return payment > base ? paymentStatus : (baseStatus || "unknown");
}

function failedPaymentChecks(payload) {
  const candidates = [
    ["Secret key mode", payload?.stripe?.secretModeAligned],
    ["Publishable key mode", payload?.stripe?.publishableModeAligned],
    ["Stripe connection", payload?.stripe?.connected],
    ["Charges enabled", payload?.stripe?.chargesEnabled],
    ["Checkout gateway", payload?.checkout?.gatewayReachable],
    ["Checkout core", payload?.checkout?.coreReachable],
    ["Webhook secret", payload?.webhook?.configured],
    ["Webhook endpoint", payload?.webhook?.endpointReachable],
  ];

  return candidates.filter(([, value]) => value === false).map(([label]) => label);
}

function mergePaymentPreflight(snapshot, preflightResult) {
  const payload = preflightResult?.payload;
  const failed = failedPaymentChecks(payload);
  const paymentStatus = payload?.ready === true
    ? "healthy"
    : payload?.ready === false
      ? "critical"
      : "warning";

  const paymentCheck = {
    key: "payment-preflight",
    category: "Payments",
    label: "Production payment readiness",
    status: paymentStatus,
    summary: paymentStatus === "healthy"
      ? "Stripe, checkout and webhook preflight checks are passing."
      : paymentStatus === "critical"
        ? "One or more production payment preflight checks failed."
        : "Production payment readiness could not be fully confirmed.",
    details: paymentStatus === "healthy"
      ? "Secret/publishable key modes, Stripe connectivity, charges, checkout services and webhook readiness are aligned."
      : failed.length
        ? `Needs attention: ${failed.join(", ")}.`
        : (preflightResult?.error || "Run the payment preflight again from Admin → System Health."),
    metric: paymentStatus === "healthy" ? "PASS" : paymentStatus === "critical" ? "FAIL" : "CHECK",
    updatedAt: payload?.checkedAt || snapshot?.checkedAt || null,
  };

  const checks = [
    ...(Array.isArray(snapshot?.checks)
      ? snapshot.checks.filter((check) => check?.key !== "payment-preflight")
      : []),
    paymentCheck,
  ];

  const currentScore = Number(snapshot?.score);
  const penalty = paymentStatus === "critical" ? 20 : paymentStatus === "warning" ? 6 : paymentStatus === "unknown" ? 2 : 0;
  const score = Number.isFinite(currentScore) ? Math.max(0, currentScore - penalty) : Math.max(0, 100 - penalty);

  return {
    ...snapshot,
    score,
    status: worstStatus(snapshot?.status, paymentStatus),
    paymentMode: snapshot?.paymentMode || payload?.paymentMode || "unknown",
    checks,
  };
}

export const systemHealthApi = {
  async loadSnapshot() {
    const [snapshot, preflightResult] = await Promise.all([
      invokeHealth({ action: "snapshot" }),
      invokePaymentPreflight(),
    ]);

    return mergePaymentPreflight(snapshot, preflightResult);
  },
};
