import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(path, source, replacement, label) {
  const current = read(path);
  const next = current.replace(source, replacement);
  if (next === current) throw new Error(`Patch failed: ${label}`);
  write(path, next);
}

function insertBefore(path, marker, insertion, label) {
  const current = read(path);
  const index = current.indexOf(marker);
  if (index < 0) throw new Error(`Patch failed: ${label}`);
  write(path, current.slice(0, index) + insertion + current.slice(index));
}

function replaceAllChecked(path, source, replacement, minCount, label) {
  const current = read(path);
  const count = current.split(source).length - 1;
  if (count < minCount) throw new Error(`Patch failed: ${label}; found ${count}`);
  write(path, current.split(source).join(replacement));
}

const checkoutPath = "supabase/functions/checkout/index.ts";
replaceOnce(
  checkoutPath,
  `function respond(req: Request, body: unknown, status = 200) {\n  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });\n}`,
  `function respond(\n  req: Request,\n  body: unknown,\n  status = 200,\n  extraHeaders: Record<string, string> = {},\n) {\n  return new Response(JSON.stringify(body), {\n    status,\n    headers: { ...corsHeaders(req), ...extraHeaders },\n  });\n}`,
  "checkout response headers",
);

insertBefore(
  checkoutPath,
  `function guestUploadPath(value: unknown) {`,
  `function clientIp(req: Request) {\n  const direct = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";\n  if (direct) return direct.trim().slice(0, 128);\n  const forwarded = req.headers.get("x-forwarded-for") || "";\n  return (forwarded.split(",")[0] || "unknown").trim().slice(0, 128);\n}\n\nasync function consumePublicRateLimit(\n  service: any,\n  key: string,\n  limit: number,\n  windowSeconds: number,\n) {\n  const { data, error } = await service.rpc("consume_checkout_rate_limit", {\n    p_key: key,\n    p_limit: limit,\n    p_window_seconds: windowSeconds,\n  });\n  if (error) throw error;\n  return data || { allowed: false, retry_after: 60 };\n}\n\nasync function releaseCheckoutSessionClaim(service: any, sessionToken: string | null) {\n  if (!sessionToken) return;\n  const { error } = await service.rpc("release_checkout_session_claim", {\n    p_session_token: sessionToken,\n  });\n  if (error) console.error("checkout session claim release failed", error);\n}\n\n`,
  "checkout rate-limit helpers",
);

insertBefore(
  checkoutPath,
  `function reservationErrorMessage(error: any, fallback: string) {`,
  `async function resumeConvertedCheckout(service: any, orderId: string) {\n  const { data: order, error: orderError } = await service\n    .from("orders")\n    .select("id,order_number,confirmation_token,stripe_checkout_session_id,payment_mode,payment_status,subtotal,discount,shipping,tax,total,shipping_address")\n    .eq("id", orderId)\n    .maybeSingle();\n\n  if (orderError) throw orderError;\n  if (!order) {\n    return { status: 409, body: { error: true, retryable: true, message: "The previous checkout could not be found. Please try again." } };\n  }\n\n  if (order.payment_status === "paid") {\n    return {\n      status: 200,\n      body: {\n        paid: true,\n        orderNumber: order.order_number,\n        confirmationToken: order.confirmation_token,\n      },\n    };\n  }\n\n  const paymentMode = order.payment_mode === "test" ? "test" : "live";\n  const stripeSecret = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY");\n  const stripePublishableKey = Deno.env.get(paymentMode === "test" ? "STRIPE_TEST_PUBLISHABLE_KEY" : "STRIPE_PUBLISHABLE_KEY");\n\n  if (!stripeSecret || !stripePublishableKey || !order.stripe_checkout_session_id) {\n    return {\n      status: 409,\n      body: { error: true, retryable: true, message: "The previous payment session is not ready. Please try again." },\n    };\n  }\n\n  const stripeResponse = await fetch(\n    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(order.stripe_checkout_session_id)}`,\n    {\n      headers: {\n        Authorization: `Bearer ${stripeSecret}`,\n        "Stripe-Version": "2026-08-26.dahlia",\n      },\n    },\n  );\n  const stripeSession = await stripeResponse.json();\n  if (!stripeResponse.ok) {\n    return {\n      status: 502,\n      body: { error: true, retryable: true, message: stripeSession?.error?.message || "The secure payment session could not be resumed." },\n    };\n  }\n\n  if (stripeSession.status === "expired") {\n    return {\n      status: 409,\n      body: { error: true, retryable: true, message: "This secure payment session expired. Please try checkout again." },\n    };\n  }\n\n  const taxRule = await getTaxRule(service, order.shipping_address?.province);\n  return {\n    status: 200,\n    body: {\n      orderNumber: order.order_number,\n      confirmationToken: order.confirmation_token,\n      clientSecret: stripeSession.client_secret,\n      publishableKey: stripePublishableKey,\n      configured: true,\n      paymentMode,\n      uiMode: "custom",\n      resumed: true,\n      pricing: {\n        subtotal: Number(order.subtotal || 0),\n        discount: Number(order.discount || 0),\n        shipping: Number(order.shipping || 0),\n        tax: Number(order.tax || 0),\n        total: Number(order.total || 0),\n        taxRate: Number(taxRule?.rate || 0),\n        taxName: taxRule?.name || "Tax",\n      },\n    },\n  };\n}\n\n`,
  "checkout resume helper",
);

replaceOnce(
  checkoutPath,
  `  try {\n    const body = await req.json();`,
  `  let checkoutSessionTokenForRecovery: string | null = null;\n\n  try {\n    const body = await req.json();`,
  "checkout recovery token declaration",
);

replaceOnce(
  checkoutPath,
  `    if (action !== "createOrder") {\n      return respond(req, { error: true, message: "Unknown checkout action." }, 400);\n    }\n\n    const cart = Array.isArray(body?.cart) ? body.cart : [];`,
  `    if (action !== "createOrder") {\n      return respond(req, { error: true, message: "Unknown checkout action." }, 400);\n    }\n\n    const ipRateKey = await sha256Hex(\`checkout:create:ip:\${clientIp(req)}\`);\n    const ipRate = await consumePublicRateLimit(service, ipRateKey, 20, 600);\n    if (!ipRate.allowed) {\n      const retryAfter = Math.max(1, Number(ipRate.retry_after || 60));\n      return respond(\n        req,\n        { error: true, retryable: true, rateLimited: true, message: "Too many checkout attempts. Please wait a moment and try again." },\n        429,\n        { "Retry-After": String(retryAfter) },\n      );\n    }\n\n    const cart = Array.isArray(body?.cart) ? body.cart : [];`,
  "checkout IP rate limit",
);

replaceOnce(
  checkoutPath,
  `    const checkoutSessionToken = uuidRe.test(String(body?.checkoutSessionToken || ""))\n      ? String(body.checkoutSessionToken)\n      : null;\n    const origin = validOrigin(body?.origin || req.headers.get("origin"));`,
  `    const checkoutSessionToken = uuidRe.test(String(body?.checkoutSessionToken || ""))\n      ? String(body.checkoutSessionToken)\n      : null;\n    checkoutSessionTokenForRecovery = checkoutSessionToken;\n    const origin = validOrigin(body?.origin || req.headers.get("origin"));`,
  "checkout recovery token assignment",
);

insertBefore(
  checkoutPath,
  `      const payload = {\n        user_id: user?.id || null,`,
  `      if (existing?.status === "processing") {\n        return respond(req, {\n          sessionToken,\n          status: "processing",\n          convertedOrderId: existing.converted_order_id,\n        });\n      }\n\n`,
  "preserve processing checkout session",
);

insertBefore(
  checkoutPath,
  `    customer.email = customerEmail.toLowerCase();`,
  `    const emailRateKey = await sha256Hex(\`checkout:create:email:\${customerEmail.toLowerCase()}\`);\n    const emailRate = await consumePublicRateLimit(service, emailRateKey, 8, 600);\n    if (!emailRate.allowed) {\n      const retryAfter = Math.max(1, Number(emailRate.retry_after || 60));\n      return respond(\n        req,\n        { error: true, retryable: true, rateLimited: true, message: "Too many checkout attempts for this email. Please wait and try again." },\n        429,\n        { "Retry-After": String(retryAfter) },\n      );\n    }\n\n`,
  "checkout email rate limit",
);

insertBefore(
  checkoutPath,
  `    const prefix = String(storeSettings?.order_prefix || "GDP").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "GDP";`,
  `    if (!checkoutSessionToken) {\n      return respond(req, {\n        error: true,\n        retryable: true,\n        message: "Your checkout session is not ready yet. Please try again.",\n      }, 409);\n    }\n\n    const { data: checkoutClaim, error: checkoutClaimError } = await service.rpc(\n      "claim_checkout_session",\n      { p_session_token: checkoutSessionToken },\n    );\n    if (checkoutClaimError) throw checkoutClaimError;\n\n    if (!checkoutClaim?.claimed) {\n      if (checkoutClaim?.status === "converted" && checkoutClaim?.converted_order_id) {\n        const resumed = await resumeConvertedCheckout(service, String(checkoutClaim.converted_order_id));\n        return respond(req, resumed.body, resumed.status);\n      }\n      if (checkoutClaim?.status === "processing") {\n        return respond(req, {\n          error: true,\n          retryable: true,\n          message: "Checkout is already being prepared. Please wait a moment and try again.",\n        }, 409, { "Retry-After": "2" });\n      }\n      return respond(req, {\n        error: true,\n        retryable: true,\n        message: "This checkout session expired. Refresh checkout and try again.",\n      }, 409);\n    }\n\n`,
  "atomic checkout session claim",
);

replaceOnce(
  checkoutPath,
  `    if (orderError) throw orderError;`,
  `    if (orderError) {\n      await releaseCheckoutSessionClaim(service, checkoutSessionToken);\n      throw orderError;\n    }\n\n    const { data: linkedCheckout, error: linkCheckoutError } = await service\n      .from("checkout_sessions")\n      .update({\n        converted_order_id: order.id,\n        last_activity_at: new Date().toISOString(),\n      })\n      .eq("session_token", checkoutSessionToken)\n      .eq("status", "processing")\n      .select("id")\n      .maybeSingle();\n\n    if (linkCheckoutError || !linkedCheckout) {\n      await service.from("orders").delete().eq("id", order.id);\n      await releaseCheckoutSessionClaim(service, checkoutSessionToken);\n      throw linkCheckoutError || new Error("Checkout session could not be linked to the order.");\n    }`,
  "link checkout session to order",
);

replaceAllChecked(
  checkoutPath,
  `      await service.from("orders").delete().eq("id", order.id);`,
  `      await service.from("orders").delete().eq("id", order.id);\n      await releaseCheckoutSessionClaim(service, checkoutSessionToken);`,
  3,
  "release checkout claim after order deletion",
);

replaceOnce(
  checkoutPath,
  `        "Stripe-Version": "2026-08-26.dahlia",\n      },`,
  `        "Stripe-Version": "2026-08-26.dahlia",\n        "Idempotency-Key": \`gdp-checkout-\${checkoutSessionToken}\`,\n      },`,
  "Stripe idempotency header",
);

replaceOnce(
  checkoutPath,
  `  } catch (error) {\n    console.error("checkout error", error);\n    return respond(req, { error: true, message: error?.message || "Checkout failed." }, 500);\n  }`,
  `  } catch (error) {\n    if (checkoutSessionTokenForRecovery) {\n      await releaseCheckoutSessionClaim(service, checkoutSessionTokenForRecovery);\n    }\n    console.error("checkout error", error);\n    return respond(req, { error: true, message: error?.message || "Checkout failed." }, 500);\n  }`,
  "checkout catch recovery",
);

const webhookPath = "supabase/functions/stripe-webhook/index.ts";
insertBefore(
  webhookPath,
  `Deno.serve(async (req: Request) => {`,
  `async function resetUnpaidCustomOrderState(service: any, orderId: string) {\n  const { data: items, error: itemError } = await service\n    .from("order_items")\n    .select("custom_design_id")\n    .eq("order_id", orderId)\n    .eq("is_custom", true);\n  if (itemError) throw itemError;\n\n  const designIds = [...new Set((items || []).map((item: any) => item.custom_design_id).filter(Boolean))];\n  if (designIds.length) {\n    const { error: designError } = await service\n      .from("custom_designs")\n      .update({ order_id: null, status: "in_cart" })\n      .in("id", designIds)\n      .eq("order_id", orderId);\n    if (designError) throw designError;\n  }\n\n  const { error: proofError } = await service\n    .from("design_proofs")\n    .delete()\n    .eq("order_id", orderId)\n    .eq("status", "pending");\n  if (proofError) throw proofError;\n\n  const now = new Date().toISOString();\n  const { error: guestError } = await service\n    .from("guest_design_sessions")\n    .update({ converted_order_id: null, converted_at: null, updated_at: now })\n    .eq("converted_order_id", orderId);\n  if (guestError) throw guestError;\n\n  const { error: checkoutError } = await service\n    .from("checkout_sessions")\n    .update({ status: "active", converted_order_id: null, last_activity_at: now })\n    .eq("converted_order_id", orderId);\n  if (checkoutError) throw checkoutError;\n}\n\n`,
  "webhook unpaid custom cleanup helper",
);

replaceOnce(
  webhookPath,
  `      if (orderId) {\n        await releaseCheckoutReservations(service, orderId, "expired");\n        await service`,
  `      if (orderId) {\n        await releaseCheckoutReservations(service, orderId, "expired");\n        await resetUnpaidCustomOrderState(service, orderId);\n        await service`,
  "expired checkout cleanup",
);

replaceOnce(
  webhookPath,
  `    if (event.type === "payment_intent.payment_failed") {\n      const intent = event.data.object;\n      const orderId = intent?.metadata?.order_id;\n      if (orderId) {\n        await releaseCheckoutReservations(service, orderId);\n        await service\n          .from("orders")\n          .update({\n            payment_status: "failed",\n            status: "payment_failed",\n            fulfillment_status: "unfulfilled",\n            stripe_payment_intent_id: intent.id,\n          })\n          .eq("id", orderId);\n      }\n    }`,
  `    if (event.type === "checkout.session.async_payment_failed") {\n      const session = event.data.object;\n      const orderId = session?.metadata?.order_id;\n      if (orderId) {\n        await releaseCheckoutReservations(service, orderId);\n        await resetUnpaidCustomOrderState(service, orderId);\n        await service\n          .from("orders")\n          .update({\n            payment_status: "failed",\n            status: "payment_failed",\n            fulfillment_status: "unfulfilled",\n            stripe_payment_intent_id: session.payment_intent || null,\n          })\n          .eq("id", orderId);\n      }\n    }\n\n    if (event.type === "payment_intent.payment_failed") {\n      const intent = event.data.object;\n      const orderId = intent?.metadata?.order_id;\n      if (orderId) {\n        // A failed attempt inside an open Checkout Session is retryable. Keep\n        // the inventory/coupon reservation until the session actually expires.\n        await service\n          .from("orders")\n          .update({\n            payment_status: "pending",\n            status: "pending_payment",\n            fulfillment_status: "unfulfilled",\n            stripe_payment_intent_id: intent.id,\n          })\n          .eq("id", orderId)\n          .eq("payment_status", "pending");\n      }\n    }`,
  "retryable Stripe payment failure handling",
);

const maintenancePath = "supabase/functions/maintenance-access/index.ts";
replaceOnce(
  maintenancePath,
  `function respond(body: unknown, status = 200) {\n  return new Response(JSON.stringify(body), { status, headers: cors });\n}`,
  `function respond(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {\n  return new Response(JSON.stringify(body), { status, headers: { ...cors, ...extraHeaders } });\n}`,
  "maintenance response headers",
);

insertBefore(
  maintenancePath,
  `Deno.serve(async (req: Request) => {`,
  `function clientIp(req: Request) {\n  const direct = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";\n  if (direct) return direct.trim().slice(0, 128);\n  const forwarded = req.headers.get("x-forwarded-for") || "";\n  return (forwarded.split(",")[0] || "unknown").trim().slice(0, 128);\n}\n\nasync function sha256Hex(value: string) {\n  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));\n  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");\n}\n\n`,
  "maintenance rate-limit helpers",
);

replaceOnce(
  maintenancePath,
  `      const row = await getPasswordRow();\n      if (!row?.password_hash) {`,
  `      const rateKey = await sha256Hex(\`maintenance:verify:ip:\${clientIp(req)}\`);\n      const { data: rateLimit, error: rateLimitError } = await service.rpc("consume_checkout_rate_limit", {\n        p_key: rateKey,\n        p_limit: 10,\n        p_window_seconds: 900,\n      });\n      if (rateLimitError) throw rateLimitError;\n      if (!rateLimit?.allowed) {\n        const retryAfter = Math.max(1, Number(rateLimit?.retry_after || 60));\n        return respond(\n          { error: true, message: "Too many password attempts. Please wait before trying again." },\n          429,\n          { "Retry-After": String(retryAfter) },\n        );\n      }\n\n      const row = await getPasswordRow();\n      if (!row?.password_hash) {`,
  "maintenance password rate limit",
);

const checkoutPagePath = "src/pages/Checkout.jsx";
replaceOnce(
  checkoutPagePath,
  `    let token = "";\n    try {\n      token = window.localStorage.getItem(checkoutStorageKey) || "";\n    } catch {\n      token = "";\n    }\n    setCheckoutSessionToken(token);`,
  `    let token = "";\n    try {\n      token = window.localStorage.getItem(checkoutStorageKey) || "";\n      if (!token) {\n        token = crypto.randomUUID();\n        window.localStorage.setItem(checkoutStorageKey, token);\n      }\n    } catch {\n      token = crypto.randomUUID();\n    }\n    setCheckoutSessionToken(token);`,
  "eager checkout session token",
);

replaceOnce(
  checkoutPagePath,
  `        if (data?.error) {\n          setError(data.message || "Order could not be prepared. Please try again.");\n          return;\n        }`,
  `        if (data?.paid && data?.orderNumber) {\n          try {\n            window.localStorage.removeItem(checkoutStorageKey);\n          } catch {\n            // Local storage is optional.\n          }\n          clearCart();\n          const paidToken = data.confirmationToken\n            ? \`&token=\${encodeURIComponent(data.confirmationToken)}\`\n            : "";\n          navigate(\`/order/\${data.orderNumber}?status=success\${paidToken}\`);\n          return;\n        }\n\n        if (data?.error) {\n          setError(data.message || "Order could not be prepared. Please try again.");\n          return;\n        }`,
  "resume already-paid checkout",
);

replaceOnce(
  checkoutPagePath,
  `        try {\n          window.localStorage.removeItem(checkoutStorageKey);\n        } catch {\n          // Local storage is optional.\n        }\n\n        window.setTimeout(() => {`,
  `        window.setTimeout(() => {`,
  "keep checkout token while payment is open",
);

replaceOnce(
  checkoutPagePath,
  `      clearCart();\n      if (paymentSession?.orderNumber) {`,
  `      try {\n        window.localStorage.removeItem(checkoutStorageKey);\n      } catch {\n        // Local storage is optional.\n      }\n      clearCart();\n      if (paymentSession?.orderNumber) {`,
  "clear checkout token only after payment success",
);

const headersPath = "public/_headers";
replaceOnce(
  headersPath,
  `  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://*.stripe.com; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com; worker-src 'self' blob:; upgrade-insecure-requests`,
  `  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://*.stripe.com; script-src 'self' 'unsafe-inline' https://js.stripe.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com https://cloudflareinsights.com; frame-src https://js.stripe.com https://hooks.stripe.com https://*.stripe.com; worker-src 'self' blob:; upgrade-insecure-requests`,
  "Cloudflare/Google Fonts CSP",
);

const migrationSql = `-- Production checkout/security hardening.\n-- Applied to Supabase production after branch validation.\n\ncreate or replace function public.claim_checkout_session(p_session_token uuid)\nreturns jsonb\nlanguage plpgsql\nset search_path to 'public'\nas $$\ndeclare\n  v_session public.checkout_sessions%rowtype;\nbegin\n  select *\n    into v_session\n  from public.checkout_sessions\n  where session_token = p_session_token\n  for update;\n\n  if not found then\n    return jsonb_build_object('claimed', false, 'status', 'missing');\n  end if;\n\n  if v_session.expires_at <= now() then\n    update public.checkout_sessions\n    set status = 'expired', last_activity_at = now()\n    where id = v_session.id;\n    return jsonb_build_object('claimed', false, 'status', 'expired');\n  end if;\n\n  if v_session.status = 'converted' then\n    return jsonb_build_object(\n      'claimed', false,\n      'status', 'converted',\n      'converted_order_id', v_session.converted_order_id\n    );\n  end if;\n\n  if v_session.status = 'processing'\n     and v_session.last_activity_at > now() - interval '10 minutes' then\n    return jsonb_build_object(\n      'claimed', false,\n      'status', 'processing',\n      'converted_order_id', v_session.converted_order_id\n    );\n  end if;\n\n  if v_session.status not in ('active', 'processing') then\n    return jsonb_build_object('claimed', false, 'status', v_session.status);\n  end if;\n\n  update public.checkout_sessions\n  set status = 'processing', last_activity_at = now()\n  where id = v_session.id;\n\n  return jsonb_build_object(\n    'claimed', true,\n    'status', 'processing',\n    'converted_order_id', v_session.converted_order_id\n  );\nend;\n$$;\n\ncreate or replace function public.release_checkout_session_claim(p_session_token uuid)\nreturns boolean\nlanguage plpgsql\nset search_path to 'public'\nas $$\ndeclare\n  v_count integer;\nbegin\n  update public.checkout_sessions\n  set status = 'active',\n      converted_order_id = null,\n      last_activity_at = now()\n  where session_token = p_session_token\n    and status = 'processing';\n\n  get diagnostics v_count = row_count;\n  return v_count > 0;\nend;\n$$;\n\nrevoke execute on function public.claim_checkout_session(uuid) from public, anon, authenticated;\nrevoke execute on function public.release_checkout_session_claim(uuid) from public, anon, authenticated;\nrevoke execute on function public.consume_checkout_rate_limit(text, integer, integer) from public, anon, authenticated;\ngrant execute on function public.claim_checkout_session(uuid) to service_role;\ngrant execute on function public.release_checkout_session_claim(uuid) to service_role;\ngrant execute on function public.consume_checkout_rate_limit(text, integer, integer) to service_role;\n\ncreate index if not exists dtf_export_audit_log_order_id_idx on public.dtf_export_audit_log(order_id);\ncreate index if not exists dtf_export_audit_log_order_item_id_idx on public.dtf_export_audit_log(order_item_id);\ncreate index if not exists dtf_export_audit_log_user_id_idx on public.dtf_export_audit_log(user_id);\ncreate index if not exists order_activity_events_actor_user_id_idx on public.order_activity_events(actor_user_id);\ncreate index if not exists payment_mode_audit_log_changed_by_idx on public.payment_mode_audit_log(changed_by);\ncreate index if not exists security_incidents_created_by_idx on public.security_incidents(created_by);\n\nupdate storage.buckets\nset file_size_limit = 41943040,\n    allowed_mime_types = array['image/png','image/jpeg','image/webp']::text[]\nwhere id = 'customer-uploads';\n`;

fs.mkdirSync("supabase/migrations", { recursive: true });
write("supabase/migrations/20260912214500_harden_production_checkout_security.sql", migrationSql);

console.log("Production hardening patch applied successfully.");
