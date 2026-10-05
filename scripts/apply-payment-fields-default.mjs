import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(from, to);
}

function replaceRegexOnce(source, regex, to, label) {
  if (!regex.test(source)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(regex, to);
}

const checkoutPath = 'src/pages/CheckoutTwoStep.jsx';
let checkout = fs.readFileSync(checkoutPath, 'utf8');

checkout = replaceOnce(
  checkout,
  'useEffect(() => { if (!isPayment || !items.length || actions || form.termsAccepted || !detailsComplete || isIframe) return; beginCheckoutTracking().catch(() => {}); }, [isPayment, items.length, actions, detailsComplete]);',
  'useEffect(() => { if (!isPayment || !items.length || actions || !detailsComplete || isIframe) return; beginCheckoutTracking().catch(() => {}); }, [isPayment, items.length, actions, detailsComplete]);',
  'tracking should not wait for policy acceptance',
);

checkout = replaceOnce(
  checkout,
  'useEffect(() => { if (!isPayment || !items.length || actions || preparing.current || !form.termsAccepted) return;',
  'useEffect(() => { if (!isPayment || !items.length || actions || preparing.current) return;',
  'Stripe initialization gate',
);

checkout = replaceOnce(
  checkout,
  'const checkoutForm = { ...form, postalCode:normalizePostal(form.postalCode), country:"Canada", termsAccepted:true };',
  'const checkoutForm = { ...form, postalCode:normalizePostal(form.postalCode), country:"Canada", termsAccepted:false };',
  'prepare checkout without claiming acceptance',
);

checkout = replaceOnce(
  checkout,
  '}, [isPayment, form.termsAccepted]);',
  '}, [isPayment, items.length, actions, detailsComplete]);',
  'Stripe initialization dependencies',
);

checkout = replaceOnce(
  checkout,
  '    try {\n      const result = await actions.confirm();',
  '    try {\n      await customerApi.acceptCheckoutPolicies(paymentSession.orderNumber, paymentSession.confirmationToken, ensureToken());\n      const result = await actions.confirm();',
  'record policies immediately before Stripe confirmation',
);

checkout = replaceRegexOnce(
  checkout,
  /<label className="mb-4 flex items-start gap-3 rounded-xl border border-border p-4 text-sm"><input type="checkbox" checked=\{!!form\.termsAccepted\} onChange=\{e=>set\("termsAccepted",e\.target\.checked\)\} disabled=\{placing\|\|!!actions\} className="mt-1"\/><span>I agree to the <Link to="\/pages\/terms" target="_blank" className="text-accent font-semibold">Terms & Conditions<\/Link> and acknowledge the <Link to="\/pages\/privacy" target="_blank" className="text-accent font-semibold">Privacy Policy<\/Link>\. Acceptance is required before secure card entry and payment submission\.<\/span><\/label>/,
  '',
  'remove policy checkbox from payment field section',
);

checkout = replaceRegexOnce(
  checkout,
  /\{!form\.termsAccepted&&!actions&&<div className="min-h-24 rounded-xl border border-border bg-secondary\/25 flex items-center justify-center px-4 text-sm text-muted-foreground"><CreditCard size=\{18\} className="mr-3 shrink-0 text-foreground"\/><div><p className="font-semibold text-foreground">Credit \/ Debit Card selected<\/p><p className="mt-1 text-xs">Accept the policies above to activate Stripe's secure card fields\. Your payment method is already selected\.<\/p><\/div><\/div>\}/,
  '{!actions&&!placing&&<div className="min-h-40 rounded-xl border border-border flex items-center justify-center text-sm text-muted-foreground"><Lock size={18} className="mr-2"/> Loading secure payment…</div>}',
  'replace gated placeholder with default loading state',
);

checkout = replaceOnce(
  checkout,
  '</button><button onClick={editInformation} disabled={placing} className="w-full mt-2 py-2 text-sm font-semibold text-accent hover:underline">← Edit information & delivery</button>',
  '</button><label className="mt-3 flex items-start gap-3 rounded-xl border border-border p-3 text-xs text-left"><input type="checkbox" checked={!!form.termsAccepted} onChange={e=>set("termsAccepted",e.target.checked)} disabled={placing} className="mt-0.5"/><span>I agree to the <Link to="/pages/terms" target="_blank" className="text-accent font-semibold">Terms & Conditions</Link> and acknowledge the <Link to="/pages/privacy" target="_blank" className="text-accent font-semibold">Privacy Policy</Link>.</span></label><button onClick={editInformation} disabled={placing} className="w-full mt-2 py-2 text-sm font-semibold text-accent hover:underline">← Edit information & delivery</button>',
  'move policy checkbox below Pay button',
);

fs.writeFileSync(checkoutPath, checkout);

const apiPath = 'src/lib/customerApi.js';
let api = fs.readFileSync(apiPath, 'utf8');
api = replaceOnce(
  api,
  '  async createOrder(cart, customer, discountCode, origin, checkoutSessionToken) {',
  `  async acceptCheckoutPolicies(orderNumber, confirmationToken, checkoutSessionToken) {\n    const { data, error } = await supabase.functions.invoke("checkout", {\n      body: {\n        action: "acceptCheckoutPolicies",\n        orderNumber,\n        confirmationToken,\n        checkoutSessionToken,\n      },\n    });\n    if (error) throw new Error(await functionErrorMessage(error, "Could not record checkout policy acceptance."));\n    if (data?.error || data?.success !== true) throw new Error(data?.message || "Could not record checkout policy acceptance.");\n    return data;\n  },\n\n  async createOrder(cart, customer, discountCode, origin, checkoutSessionToken) {`,
  'customer policy acceptance API',
);
fs.writeFileSync(apiPath, api);

const edgePath = 'supabase/functions/checkout/index.ts';
let edge = fs.readFileSync(edgePath, 'utf8');

edge = replaceOnce(
  edge,
  `    if (customer.termsAccepted !== true) {\n      return respond(req, { error: true, message: "Accept the Terms & Conditions and Privacy Policy before checkout." }, 400);\n    }\n\n`,
  '',
  'allow payment session preparation before policy acceptance',
);

edge = replaceOnce(
  edge,
  `    const acceptedAt = new Date().toISOString();\n    const { error: policyAcceptanceError } = await service.from("policy_acceptances").insert([\n      {\n        user_id: user?.id || null,\n        email: user?.email || customer.email,\n        order_id: order.id,\n        policy_key: "terms_conditions",\n        policy_version: "2026-09-07",\n        source: "checkout",\n        accepted_at: acceptedAt,\n      },\n      {\n        user_id: user?.id || null,\n        email: user?.email || customer.email,\n        order_id: order.id,\n        policy_key: "privacy_policy",\n        policy_version: "2026-09-07",\n        source: "checkout",\n        accepted_at: acceptedAt,\n      },\n    ]);\n    if (policyAcceptanceError) {\n      console.error("checkout policy acceptance audit failed", policyAcceptanceError);\n    }\n\n`,
  `    if (customer.termsAccepted === true) {\n      const acceptedAt = new Date().toISOString();\n      const { error: policyAcceptanceError } = await service.from("policy_acceptances").insert([\n        {\n          user_id: user?.id || null,\n          email: user?.email || customer.email,\n          order_id: order.id,\n          policy_key: "terms_conditions",\n          policy_version: "2026-09-07",\n          source: "checkout",\n          accepted_at: acceptedAt,\n        },\n        {\n          user_id: user?.id || null,\n          email: user?.email || customer.email,\n          order_id: order.id,\n          policy_key: "privacy_policy",\n          policy_version: "2026-09-07",\n          source: "checkout",\n          accepted_at: acceptedAt,\n        },\n      ]);\n      if (policyAcceptanceError) {\n        console.error("checkout policy acceptance audit failed", policyAcceptanceError);\n      }\n    }\n\n`,
  'only audit policy acceptance when actually accepted',
);

edge = replaceOnce(
  edge,
  '    if (action === "trackCheckout") {',
  `    if (action === "acceptCheckoutPolicies") {\n      const orderNumber = String(body?.orderNumber || "").trim();\n      const confirmationToken = String(body?.confirmationToken || "").trim();\n      const checkoutSessionToken = String(body?.checkoutSessionToken || "").trim();\n      if (!orderNumber || !uuidRe.test(confirmationToken) || !uuidRe.test(checkoutSessionToken)) {\n        return respond(req, { error: true, message: "Checkout policy acceptance could not be verified." }, 400);\n      }\n\n      const { data: order, error: orderError } = await service\n        .from("orders")\n        .select("id,user_id,customer_email,payment_status")\n        .eq("order_number", orderNumber)\n        .eq("confirmation_token", confirmationToken)\n        .maybeSingle();\n      if (orderError) throw orderError;\n      if (!order || order.payment_status !== "pending") {\n        return respond(req, { error: true, message: "This checkout is no longer awaiting payment." }, 409);\n      }\n\n      const { data: tracked, error: trackedError } = await service\n        .from("checkout_sessions")\n        .select("converted_order_id")\n        .eq("session_token", checkoutSessionToken)\n        .eq("converted_order_id", order.id)\n        .maybeSingle();\n      if (trackedError) throw trackedError;\n      if (!tracked) {\n        return respond(req, { error: true, message: "Checkout policy acceptance could not be verified." }, 403);\n      }\n\n      const { data: existing, error: existingError } = await service\n        .from("policy_acceptances")\n        .select("policy_key")\n        .eq("order_id", order.id)\n        .eq("source", "checkout")\n        .in("policy_key", ["terms_conditions", "privacy_policy"]);\n      if (existingError) throw existingError;\n      const present = new Set((existing || []).map((row: any) => String(row.policy_key || "")));\n      const acceptedAt = new Date().toISOString();\n      const rows = ["terms_conditions", "privacy_policy"]\n        .filter((policyKey) => !present.has(policyKey))\n        .map((policyKey) => ({\n          user_id: order.user_id || null,\n          email: order.customer_email,\n          order_id: order.id,\n          policy_key: policyKey,\n          policy_version: "2026-09-07",\n          source: "checkout",\n          accepted_at: acceptedAt,\n        }));\n      if (rows.length) {\n        const { error: insertError } = await service.from("policy_acceptances").insert(rows);\n        if (insertError) throw insertError;\n      }\n      return respond(req, { success: true, acceptedAt });\n    }\n\n    if (action === "trackCheckout") {`,
  'server action to record policy acceptance before payment confirmation',
);

fs.writeFileSync(edgePath, edge);

const verifyPath = 'scripts/verify-checkout-terms-hotfix.mjs';
const verify = `import fs from 'node:fs';\nconst src = fs.readFileSync('src/pages/CheckoutTwoStep.jsx','utf8');\nconst api = fs.readFileSync('src/lib/customerApi.js','utf8');\nconst edge = fs.readFileSync('supabase/functions/checkout/index.ts','utf8');\nconst checks = [\n  ['payment initializes without acceptance gate', !src.includes('preparing.current || !form.termsAccepted') && src.includes('[isPayment, items.length, actions, detailsComplete]')],\n  ['payment session preparation does not claim acceptance', src.includes('termsAccepted:false }; if (tracking.current')],\n  ['policy checkbox moved below Pay button', src.indexOf('Pay · $') < src.indexOf('I agree to the <Link to="/pages/terms"')],\n  ['Pay remains gated by acceptance', src.includes('disabled={placing||!actions||!canConfirm||!form.termsAccepted}')],\n  ['acceptance recorded immediately before Stripe confirm', src.includes('await customerApi.acceptCheckoutPolicies') && src.indexOf('await customerApi.acceptCheckoutPolicies') < src.indexOf('await actions.confirm()')],\n  ['customer API exposes acceptance action', api.includes('action: "acceptCheckoutPolicies"')],\n  ['server allows pre-consent payment session preparation', !edge.includes('Accept the Terms & Conditions and Privacy Policy before checkout.')],\n  ['server audits acceptance separately', edge.includes('if (action === "acceptCheckoutPolicies")') && edge.includes('policy_acceptances')],\n];\nfor (const [name, ok] of checks) { console.log(\`${'${ok?\'PASS\':\'FAIL\'}'} ${'${name}'}\`); if (!ok) process.exitCode = 1; }\n`;
fs.writeFileSync(verifyPath, verify);

console.log('Applied payment-fields-default patch.');
