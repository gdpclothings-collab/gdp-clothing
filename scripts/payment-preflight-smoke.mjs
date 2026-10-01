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

    assert(response.ok, `Payment readiness check returned HTTP ${response.status}.`);
    assert(payload?.ready === true, "Payment readiness did not report ready=true.");
    assert(Boolean(payload?.checkedAt), "Payment readiness did not return a checkedAt timestamp.");

    // Anonymous production checks intentionally receive only a coarse readiness signal.
    // Detailed Stripe/checkout/webhook diagnostics are reserved for authenticated admins.
    for (const privateField of ["paymentMode", "stripe", "checkout", "webhook", "safety"]) {
      assert(!(privateField in (payload || {})), `Public payment readiness exposed ${privateField}.`);
    }

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
        "# GDP Clothing Payment Readiness",
        "",
        "Status: PASS",
        "Payment readiness: READY",
        "Public diagnostics: SANITIZED",
        "",
        "Detailed Stripe, checkout, webhook, and payment-mode diagnostics remain admin-only.",
      ].join("\n"),
    );

    console.log("PASS sanitized public payment readiness");
  } catch (error) {
    const report = {
      status: "failed",
      httpStatus: status || null,
      durationMs: Date.now() - startedAt,
      error: error?.message || String(error),
      payload,
    };
    await fs.writeFile(path.join(ARTIFACT_DIR, "payment-preflight.json"), JSON.stringify(report, null, 2));
    console.error(`FAIL payment readiness: ${report.error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
