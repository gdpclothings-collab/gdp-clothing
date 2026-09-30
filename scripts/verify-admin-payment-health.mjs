import fs from "node:fs";

const admin = fs.readFileSync("src/pages/AdminV3.jsx", "utf8");
const card = fs.readFileSync("src/components/admin/PaymentPreflightCard.jsx", "utf8");
const api = fs.readFileSync("src/lib/systemHealthApi.js", "utf8");

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
  console.log(`PASS ${message}`);
}

requireMatch(admin, /import PaymentPreflightCard from "@\/components\/admin\/PaymentPreflightCard";/, "AdminV3 imports the payment health card");
requireMatch(admin, /SystemHealthPage[\s\S]*<PaymentPreflightCard\/>[\s\S]*<SystemHealthModule\/>/, "System Health renders payment readiness above the existing health module");
requireMatch(admin, /HealthShortcut[\s\S]*systemHealthApi\.loadSnapshot\(\)/, "Floating System Health shortcut uses the shared health API");
requireMatch(card, /data-gdp-payment-health="true"/, "Payment health exposes a stable regression marker");
requireMatch(card, /supabase\.functions\.invoke\("payment-preflight"/, "Payment health uses the production preflight function");
requireMatch(card, /body:\s*\{\s*action:\s*"preflight"\s*\}/, "Payment health requests the read-only preflight action");
requireMatch(card, /secretModeAligned/, "Payment health reports Stripe secret-mode alignment");
requireMatch(card, /publishableModeAligned/, "Payment health reports publishable-key alignment");
requireMatch(card, /gatewayReachable/, "Payment health reports checkout gateway readiness");
requireMatch(card, /coreReachable/, "Payment health reports checkout core readiness");
requireMatch(card, /endpointReachable/, "Payment health reports webhook endpoint readiness");
requireMatch(card, /no order, Checkout Session, PaymentIntent or charge is created/i, "Payment health communicates the no-charge safety boundary");

requireMatch(api, /supabase\.functions\.invoke\("payment-preflight"/, "Shared System Health API runs the production payment preflight");
requireMatch(api, /key:\s*"payment-preflight"/, "Shared System Health API adds payment readiness to live checks");
requireMatch(api, /paymentStatus === "critical" \? 20/, "Failed payment readiness reduces the overall health score");
requireMatch(api, /status:\s*worstStatus\(snapshot\?\.status, paymentStatus\)/, "Payment readiness can escalate overall system status");
requireMatch(api, /Promise\.all\(\[[\s\S]*invokeHealth\([\s\S]*invokePaymentPreflight\(\)/, "Health snapshot and payment preflight run together without serial delay");

const forbidden = [
  /\.from\s*\(/,
  /checkout\.sessions\.create/,
  /paymentIntents?\.create/,
  /charges?\.create/,
  /fetch\s*\([^)]*api\.stripe\.com/i,
];
for (const source of [card, api]) {
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      console.error(`FAIL Payment health contains forbidden write/payment logic: ${pattern}`);
      process.exit(1);
    }
  }
}
console.log("PASS Payment health remains read-only and delegates payment verification to preflight");
