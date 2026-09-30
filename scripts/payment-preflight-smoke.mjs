import fs from "node:fs/promises";
import path from "node:path";

const FUNCTION_URL = process.env.PAYMENT_PREFLIGHT_URL
  || "https://mcmancxsqlhxnjhlnfkz.supabase.co/functions/v1/payment-preflight";
const ORIGIN = process.env.PRODUCTION_BASE_URL || "https://gdpclothing.ca";
const ARTIFACT_DIR = process.env.SMOKE_ARTIFACT_DIR || "production-smoke-results";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const startedAt = Date.now();
  let payload = null;
  let status = 0;

  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGIN,
      },
      body: JSON.stringify({ action: "preflight" }),
      signal: AbortSignal.timeout(15000),
    });

    status = response.status;
    payload = await response.json().catch(() => null);

    assert(response.ok, `Payment preflight returned HTTP ${response.status}.`);
    assert(payload?.ready === true, "Payment preflight did not report ready=true.");
    assert(["live", "test"].includes(payload?.paymentMode), "Payment preflight returned an invalid payment mode.");
    assert(payload?.stripe?.secretModeAligned === true, "Stripe secret key does not match configured payment mode.");
    assert(payload?.stripe?.publishableModeAligned === true, "Stripe publishable key does not match configured payment mode.");
    assert(payload?.stripe?.connected === true, "Stripe API connectivity check failed.");
    assert(payload?.stripe?.chargesEnabled === true, "Stripe charge readiness check failed.");
    assert(payload?.checkout?.gatewayReachable === true, "Checkout gateway is not reachable.");
    assert(payload?.checkout?.coreReachable === true, "Checkout core function is not reachable.");
    assert(payload?.webhook?.configured === true, "Stripe webhook secret is not configured for the active payment mode.");
    assert(payload?.webhook?.endpointReachable === true, "Stripe webhook endpoint is not reachable.");
    assert(payload?.safety?.databaseWrites === false, "Preflight unexpectedly reported database writes.");
    assert(payload?.safety?.orderCreated === false, "Preflight unexpectedly reported an order creation.");
    assert(payload?.safety?.stripeSessionCreated === false, "Preflight unexpectedly reported a Stripe Session creation.");
    assert(payload?.safety?.paymentIntentCreated === false, "Preflight unexpectedly reported a PaymentIntent creation.");
    assert(payload?.safety?.chargeAttempted === false, "Preflight unexpectedly reported a charge attempt.");

    const report = {
      status: "passed",
      httpStatus: status,
      durationMs: Date.now() - startedAt,
      ...payload,
    };
    await fs.writeFile(path.join(ARTIFACT_DIR, "payment-preflight.json"), JSON.stringify(report, null, 2));
    await fs.writeFile(
      path.join(ARTIFACT_DIR, "payment-preflight-summary.md"),
      [
        "# GDP Clothing Payment Preflight",
        "",
        `Status: PASS`,
        `Payment mode: ${payload.paymentMode.toUpperCase()}`,
        `Stripe connected: YES`,
        `Charges enabled: YES`,
        `Checkout gateway: REACHABLE`,
        `Checkout core: REACHABLE`,
        `Webhook configured: YES`,
        `Webhook endpoint: REACHABLE`,
        "",
        "Safety: no order, Stripe Checkout Session, PaymentIntent, or charge was created.",
      ].join("\n"),
    );

    console.log(`PASS payment preflight (${payload.paymentMode.toUpperCase()} mode)`);
  } catch (error) {
    const report = {
      status: "failed",
      httpStatus: status || null,
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
      payload,
    };
    await fs.writeFile(path.join(ARTIFACT_DIR, "payment-preflight.json"), JSON.stringify(report, null, 2));
    console.error(`FAIL payment preflight: ${report.error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
