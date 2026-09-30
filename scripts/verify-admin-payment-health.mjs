import fs from "node:fs";

const admin = fs.readFileSync("src/pages/AdminV3.jsx", "utf8");
const card = fs.readFileSync("src/components/admin/PaymentPreflightCard.jsx", "utf8");

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
  console.log(`PASS ${message}`);
}

requireMatch(admin, /import PaymentPreflightCard from "@\/components\/admin\/PaymentPreflightCard";/, "AdminV3 imports the payment health card");
requireMatch(admin, /SystemHealthPage[\s\S]*<PaymentPreflightCard\/>[\s\S]*<SystemHealthModule\/>/, "System Health renders payment readiness above the existing health module");
requireMatch(card, /data-gdp-payment-health="true"/, "Payment health exposes a stable regression marker");
requireMatch(card, /supabase\.functions\.invoke\("payment-preflight"/, "Payment health uses the production preflight function");
requireMatch(card, /body:\s*\{\s*action:\s*"preflight"\s*\}/, "Payment health requests the read-only preflight action");
requireMatch(card, /secretModeAligned/, "Payment health reports Stripe secret-mode alignment");
requireMatch(card, /publishableModeAligned/, "Payment health reports publishable-key alignment");
requireMatch(card, /gatewayReachable/, "Payment health reports checkout gateway readiness");
requireMatch(card, /coreReachable/, "Payment health reports checkout core readiness");
requireMatch(card, /endpointReachable/, "Payment health reports webhook endpoint readiness");
requireMatch(card, /no order, Checkout Session, PaymentIntent or charge is created/i, "Payment health communicates the no-charge safety boundary");

const forbidden = [
  /\.from\s*\(/,
  /checkout\.sessions\.create/,
  /paymentIntents?\.create/,
  /charges?\.create/,
  /fetch\s*\([^)]*api\.stripe\.com/i,
];
for (const pattern of forbidden) {
  if (pattern.test(card)) {
    console.error(`FAIL Payment health contains forbidden write/payment logic: ${pattern}`);
    process.exit(1);
  }
}
console.log("PASS Payment health remains read-only and delegates payment verification to preflight");
