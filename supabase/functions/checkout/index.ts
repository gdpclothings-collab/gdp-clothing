import { createClient } from "npm:@supabase/supabase-js@2";

const baseCors = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function corsHeaders(req: Request) {
  return {
    ...baseCors,
    "Access-Control-Allow-Origin": validOrigin(req.headers.get("origin")),
    "Vary": "Origin",
  };
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roundMoney = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const defaultDtfSettings = {
  enabled: true,
  maxWidth: 34,
  defaultWidth: 34,
  minLength: 6,
  standardMaxLength: 36,
  pricingMode: "graduated",
  standardRate: 0.028,
  volumeRate: 0.025,
  breakpointArea: 1224,
  spacing: 0.25,
  minimumDpi: 200,
  recommendedDpi: 300,
  artworkReviewEnabled: true,
  artworkReviewPrice: 0,
  maxUploadMb: 100,
  acceptedMimeTypes: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "application/pdf",
  ],
};

function numberOr(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDtfSettings(raw: any = {}) {
  const next = { ...defaultDtfSettings, ...(raw || {}) };
  next.maxWidth = Math.max(1, numberOr(next.maxWidth, 34));
  next.defaultWidth = Math.min(next.maxWidth, Math.max(1, numberOr(next.defaultWidth, next.maxWidth)));
  next.minLength = Math.max(1, numberOr(next.minLength, 6));
  next.standardRate = Math.max(0, numberOr(next.standardRate, 0.028));
  next.volumeRate = Math.max(0, numberOr(next.volumeRate, 0.025));
  next.breakpointArea = Math.max(1, numberOr(next.breakpointArea, 1224));
  next.spacing = Math.max(0, numberOr(next.spacing, 0.25));
  next.artworkReviewPrice = Math.max(0, numberOr(next.artworkReviewPrice, 0));
  next.maxUploadMb = Math.max(1, numberOr(next.maxUploadMb, 100));
  next.pricingMode = next.pricingMode === "flat_tier" ? "flat_tier" : "graduated";
  next.acceptedMimeTypes = Array.isArray(next.acceptedMimeTypes) && next.acceptedMimeTypes.length
    ? next.acceptedMimeTypes.map((value: unknown) => String(value))
    : defaultDtfSettings.acceptedMimeTypes;
  return next;
}

function calculateDtfPrice(width: number, length: number, rawSettings: any) {
  const settings = normalizeDtfSettings(rawSettings);
  const area = width * length;
  let price = 0;
  let standardArea = 0;
  let volumeArea = 0;

  if (settings.pricingMode === "flat_tier" && area > settings.breakpointArea) {
    volumeArea = area;
    price = area * settings.volumeRate;
  } else {
    standardArea = Math.min(area, settings.breakpointArea);
    volumeArea = Math.max(0, area - settings.breakpointArea);
    price = standardArea * settings.standardRate + volumeArea * settings.volumeRate;
  }

  return {
    area,
    price: roundMoney(price),
    standardArea,
    volumeArea,
    settings,
  };
}

function safeUploadFileName(value: unknown) {
  return String(value || "artwork")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "artwork";
}

function isDtfProduct(product: any) {
  return product?.slug === "dtf-gang-sheet"
    || product?.theme_template === "dtf-gang-sheet"
    || product?.metafields?.dtf_gang_sheet === true;
}

function validDtfStoragePath(value: unknown) {
  return /^dtf\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i.test(String(value || ""));
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function validOrigin(value: unknown) {
  const text = String(value || "");
  if (["https://gdp-clothing.pages.dev", "https://gdpclothing.ca", "https://www.gdpclothing.ca"].includes(text)) return text;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(text)) return text;
  return "https://gdp-clothing.pages.dev";
}

async function optionalUser(req: Request, url: string, anonKey: string) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await client.auth.getUser();
  return data?.user || null;
}

function couponIsUsable(row: any, purchase: number) {
  if (!row || row.active !== true) return false;
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() < now) return false;
  if (row.usage_limit != null && Number(row.usage_count || 0) >= Number(row.usage_limit)) return false;
  if (row.min_purchase != null && purchase < Number(row.min_purchase)) return false;
  return true;
}

async function getCoupon(service: any, code: string, purchase = 0) {
  if (!code) return null;
  const { data } = await service
    .from("discounts")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  return couponIsUsable(data, purchase) ? data : null;
}

const provinceCodes: Record<string, string> = {
  AB: "AB",
  ALBERTA: "AB",
  BC: "BC",
  "BRITISH COLUMBIA": "BC",
  MB: "MB",
  MANITOBA: "MB",
  NB: "NB",
  "NEW BRUNSWICK": "NB",
  NL: "NL",
  "NEWFOUNDLAND AND LABRADOR": "NL",
  NT: "NT",
  NWT: "NT",
  "NORTHWEST TERRITORIES": "NT",
  NS: "NS",
  "NOVA SCOTIA": "NS",
  NU: "NU",
  NUNAVUT: "NU",
  ON: "ON",
  ONTARIO: "ON",
  PE: "PE",
  PEI: "PE",
  "PRINCE EDWARD ISLAND": "PE",
  QC: "QC",
  QUEBEC: "QC",
  SK: "SK",
  SASKATCHEWAN: "SK",
  YT: "YT",
  YUKON: "YT",
};

const fallbackTaxRates: Record<string, number> = {
  SK: 0.11,
  ON: 0.13,
  NS: 0.14,
  NB: 0.15,
  NL: 0.15,
  PE: 0.15,
};

function normalizeProvinceCode(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  return provinceCodes[normalized] || normalized.slice(0, 2);
}

const canadianProvinceCodes = new Set([
  "AB", "BC", "MB", "NB", "NL", "NT", "NS", "NU", "ON", "PE", "QC", "SK", "YT",
]);
const canadianPostalCodeRe = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeCanadianPostalCode(value: unknown) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!canadianPostalCodeRe.test(compact)) return "";
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

async function getTaxRule(service: any, province: unknown) {
  const regionCode = normalizeProvinceCode(province);
  let row: any = null;

  if (regionCode) {
    const { data, error } = await service
      .from("tax_rules")
      .select("name,rate,tax_shipping,region_code,priority")
      .eq("country_code", "CA")
      .eq("region_code", regionCode)
      .eq("active", true)
      .order("priority", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    row = data;
  }

  if (!row) {
    const { data, error } = await service
      .from("tax_rules")
      .select("name,rate,tax_shipping,region_code,priority")
      .eq("country_code", "CA")
      .is("region_code", null)
      .eq("active", true)
      .order("priority", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    row = data;
  }

  if (row) return row;

  const fallbackRate = fallbackTaxRates[regionCode] ?? 0.05;
  return {
    name: regionCode === "SK" ? "Saskatchewan GST + PST" : "Canada GST/HST",
    rate: fallbackRate,
    tax_shipping: true,
    region_code: regionCode || null,
    priority: 999,
  };
}

async function getShippingRule(service: any, amount: number) {
  const safeAmount = Math.max(0, roundMoney(amount));
  const { data, error } = await service
    .from("shipping_rates")
    .select("name,method_code,price,min_order,max_order,min_delivery_days,max_delivery_days")
    .eq("active", true)
    .eq("method_code", "standard")
    .lte("min_order", safeAmount)
    .or(`max_order.is.null,max_order.gte.${safeAmount}`)
    .order("min_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  return safeAmount >= 150
    ? {
        name: "Free Standard Shipping",
        method_code: "standard",
        price: 0,
        min_order: 150,
        max_order: null,
        min_delivery_days: 3,
        max_delivery_days: 7,
      }
    : {
        name: "Standard Shipping",
        method_code: "standard",
        price: 12.99,
        min_order: 0,
        max_order: 149.99,
        min_delivery_days: 3,
        max_delivery_days: 7,
      };
}

async function getCheckoutRules(
  service: any,
  customer: any,
  amountAfterDiscounts: number,
  freeShipping = false,
) {
  const amount = Math.max(0, roundMoney(amountAfterDiscounts));
  const shippingMethod = customer?.shippingMethod === "pickup" ? "pickup" : "standard";
  const shippingRule = await getShippingRule(service, amount);
  const shipping =
    shippingMethod === "pickup" || freeShipping
      ? 0
      : roundMoney(Number(shippingRule?.price || 0));

  const taxRule = await getTaxRule(service, customer?.province);
  const taxRate = Math.max(0, Number(taxRule?.rate || 0));
  const taxShipping = taxRule?.tax_shipping !== false;
  const taxBase = amount + (taxShipping ? shipping : 0);
  const tax = roundMoney(taxBase * taxRate);

  return {
    shippingMethod,
    shipping,
    shippingName: shippingMethod === "pickup" ? "Local Pickup" : shippingRule?.name || "Standard Shipping",
    minDeliveryDays: shippingMethod === "pickup" ? 0 : shippingRule?.min_delivery_days ?? 3,
    maxDeliveryDays: shippingMethod === "pickup" ? 0 : shippingRule?.max_delivery_days ?? 7,
    freeShippingThreshold:
      shippingRule?.price === 0 && shippingRule?.min_order != null
        ? Number(shippingRule.min_order)
        : 150,
    tax,
    taxRate,
    taxName: taxRule?.name || "Canada GST/HST",
    taxShipping,
    regionCode: normalizeProvinceCode(customer?.province),
  };
}

async function releaseCheckoutReservations(service: any, orderId: string, status = "released") {
  const [inventory, coupon] = await Promise.all([
    service.rpc("release_order_inventory_reservations", {
      p_order_id: orderId,
      p_status: status,
    }),
    service.rpc("release_order_coupon_reservation", {
      p_order_id: orderId,
      p_status: status,
    }),
  ]);

  if (inventory.error) console.error("inventory reservation release failed", inventory.error);
  if (coupon.error) console.error("coupon reservation release failed", coupon.error);
}

function reservationErrorMessage(error: any, fallback: string) {
  const message = String(error?.message || "");
  if (message.includes("INSUFFICIENT_INVENTORY")) {
    const parts = message.split("|");
    const itemName = parts[1] || "One of your items";
    return itemName + " no longer has enough inventory for this checkout. Please review your cart and try again.";
  }
  if (message.includes("COUPON_USAGE_LIMIT_REACHED") || message.includes("COUPON_NOT_AVAILABLE")) {
    return "That discount code is no longer available. Please remove it or use another code.";
  }
  return fallback;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "createDtfUpload") {
      const files = Array.isArray(body?.files) ? body.files.slice(0, 30) : [];
      if (!files.length) {
        return respond(req, { error: true, message: "Choose at least one artwork file." }, 400);
      }

      const { data: settingsRow, error: settingsError } = await service
        .from("store_settings")
        .select("dtf_settings")
        .eq("id", 1)
        .maybeSingle();
      if (settingsError) throw settingsError;

      const dtfSettings = normalizeDtfSettings(settingsRow?.dtf_settings || {});
      if (!dtfSettings.enabled) {
        return respond(req, { error: true, message: "DTF ordering is currently paused." }, 409);
      }

      const uploads: Array<{ path: string; token: string }> = [];
      for (const descriptor of files) {
        const mimeType = String(descriptor?.type || "");
        const size = Number(descriptor?.size || 0);
        if (!dtfSettings.acceptedMimeTypes.includes(mimeType)) {
          return respond(req, { error: true, message: "One or more artwork file types are not supported." }, 400);
        }
        if (!Number.isFinite(size) || size <= 0 || size > dtfSettings.maxUploadMb * 1024 * 1024) {
          return respond(req, { error: true, message: `Artwork files must be ${dtfSettings.maxUploadMb} MB or smaller.` }, 400);
        }

        const path = `dtf/${crypto.randomUUID()}/${safeUploadFileName(descriptor?.name)}`;
        const { data: signed, error: signedError } = await service.storage
          .from("dtf-artwork")
          .createSignedUploadUrl(path);
        if (signedError || !signed?.token) throw signedError || new Error("Could not create a DTF upload token.");

        uploads.push({ path, token: signed.token });
      }

      return respond(req, { uploads });
    }

    if (action === "validateCoupon") {
      const code = String(body?.code || "").trim().toUpperCase();
      if (!code) return respond(req, { active: false });

      const { data } = await service
        .from("discounts")
        .select("code,type,value,min_purchase,active,starts_at,ends_at,usage_count,usage_limit")
        .eq("code", code)
        .maybeSingle();

      const purchase = Math.max(0, Number(body?.purchase || 0));
      const active = couponIsUsable(data, purchase);
      return respond(req, active ? {
        active: true,
        code: data.code,
        type: data.type,
        value: Number(data.value || 0),
        minPurchase: data.min_purchase == null ? null : Number(data.min_purchase),
      } : { active: false });
    }

    if (action === "checkoutConfig") {
      const amount = Math.max(0, Math.min(1000000, Number(body?.amount || 0)));
      const customer = {
        province: body?.province || "Saskatchewan",
        shippingMethod: body?.shippingMethod || "standard",
      };
      const rules = await getCheckoutRules(
        service,
        customer,
        amount,
        Boolean(body?.freeShipping),
      );
      return respond(req, { configured: true, ...rules });
    }


    if (action === "recordMarketingConsent") {
      const user = await optionalUser(req, supabaseUrl, anonKey);
      const email = String(body?.email || user?.email || "").trim().toLowerCase();
      const source = String(body?.source || "account").trim().toLowerCase();
      const allowedSources = new Set(["footer", "checkout", "register", "account"]);

      if (!email || !email.includes("@") || email.length > 254) {
        return respond(req, { error: true, message: "Enter a valid email address." }, 400);
      }
      if (!allowedSources.has(source)) {
        return respond(req, { error: true, message: "Invalid consent source." }, 400);
      }

      const status = body?.consent === true ? "subscribed" : "unsubscribed";
      const { error: consentError } = await service.from("marketing_consents").insert({
        user_id: user?.id || null,
        email,
        status,
        source,
        consent_text_version: "2026-09-07",
        policy_version: "2026-09-07",
      });
      if (consentError) throw consentError;

      return respond(req, { success: true, status });
    }

    if (action === "recordRegistrationAcceptance") {
      const userId = String(body?.userId || "").trim();
      const email = String(body?.email || "").trim().toLowerCase();

      if (!uuidRe.test(userId) || !email || !email.includes("@") || email.length > 254) {
        return respond(req, { error: true, message: "Invalid registration acceptance request." }, 400);
      }

      const { data: authUserData, error: authUserError } = await service.auth.admin.getUserById(userId);
      if (authUserError || !authUserData?.user || String(authUserData.user.email || "").toLowerCase() !== email) {
        return respond(req, { error: true, message: "Registration acceptance could not be verified." }, 403);
      }

      const signupMetadata = authUserData.user.user_metadata || {};
      const termsAcceptedAt = String(signupMetadata.terms_accepted_at || "");
      const privacyAcknowledgedAt = String(signupMetadata.privacy_acknowledged_at || "");
      const metadataPolicyVersion = String(signupMetadata.policy_version || "");
      const acceptedTimestamp = Date.parse(termsAcceptedAt);
      const privacyTimestamp = Date.parse(privacyAcknowledgedAt);
      const recentCutoff = Date.now() - 60 * 60 * 1000;

      if (
        metadataPolicyVersion !== "2026-09-07" ||
        !Number.isFinite(acceptedTimestamp) ||
        !Number.isFinite(privacyTimestamp) ||
        acceptedTimestamp < recentCutoff ||
        privacyTimestamp < recentCutoff
      ) {
        return respond(req, { error: true, message: "Registration policy acceptance is missing or expired." }, 403);
      }

      const acceptedAt = new Date().toISOString();
      const { error: acceptanceError } = await service.from("policy_acceptances").insert([
        {
          user_id: userId,
          email,
          policy_key: "terms_conditions",
          policy_version: "2026-09-07",
          source: "register",
          accepted_at: acceptedAt,
        },
        {
          user_id: userId,
          email,
          policy_key: "privacy_policy",
          policy_version: "2026-09-07",
          source: "register",
          accepted_at: acceptedAt,
        },
      ]);
      if (acceptanceError) throw acceptanceError;

      if (signupMetadata.marketing_consent === true) {
        const { error: marketingError } = await service.from("marketing_consents").insert({
          user_id: userId,
          email,
          status: "subscribed",
          source: "register",
          consent_text_version: "2026-09-07",
          policy_version: "2026-09-07",
        });
        if (marketingError) throw marketingError;
      }

      return respond(req, { success: true });
    }

    if (action === "getOrder") {
      const orderNumber = String(body?.orderNumber || "").trim();
      const token = String(body?.token || "").trim();
      const user = await optionalUser(req, supabaseUrl, anonKey);

      if (!orderNumber) return respond(req, { error: true, message: "Missing order number." }, 400);

      let query = service
        .from("orders")
        .select("*, order_items(*)")
        .eq("order_number", orderNumber);

      if (token && uuidRe.test(token)) {
        query = query.eq("confirmation_token", token);
      } else if (user) {
        query = query.eq("user_id", user.id);
      } else {
        return respond(req, { error: true, message: "Order access denied." }, 403);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return respond(req, { error: true, message: "Order not found." }, 404);
      return respond(req, { order: data });
    }


    if (action === "trackCheckout") {
      const user = await optionalUser(req, supabaseUrl, anonKey);
      const incomingToken = String(body?.sessionToken || "").trim();
      const sessionToken = uuidRe.test(incomingToken) ? incomingToken : crypto.randomUUID();
      const cart = Array.isArray(body?.cart) ? body.cart.slice(0, 100) : [];
      const customer = body?.customer || {};
      const totals = body?.totals || {};

      const safeMoney = (value: unknown) => {
        const number = Number(value || 0);
        if (!Number.isFinite(number) || number < 0) return 0;
        return roundMoney(Math.min(number, 1000000));
      };

      const customerName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      const shippingAddress = {
        address: customer.address || "",
        city: customer.city || "",
        province: customer.province || "",
        postalCode: customer.postalCode || "",
        country: customer.country || "Canada",
      };

      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: existing } = await service
        .from("checkout_sessions")
        .select("id,status,converted_order_id")
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (existing?.status === "converted") {
        return respond(req, {
          sessionToken,
          status: "converted",
          convertedOrderId: existing.converted_order_id,
        });
      }

      const payload = {
        user_id: user?.id || null,
        session_token: sessionToken,
        customer_email: String(customer.email || user?.email || "").trim() || null,
        customer_name: customerName || null,
        cart,
        shipping_address: shippingAddress,
        billing_address: shippingAddress,
        currency: "CAD",
        subtotal: safeMoney(totals.subtotal),
        discount: safeMoney(totals.discount),
        shipping: safeMoney(totals.shipping),
        tax: safeMoney(totals.tax),
        total: safeMoney(totals.total),
        status: "active",
        last_activity_at: nowIso,
        expires_at: expiresAt,
      };

      const { error } = await service
        .from("checkout_sessions")
        .upsert(payload, { onConflict: "session_token" });

      if (error) throw error;

      return respond(req, { sessionToken, status: "active" });
    }

    if (action !== "createOrder") {
      return respond(req, { error: true, message: "Unknown checkout action." }, 400);
    }

    const cart = Array.isArray(body?.cart) ? body.cart : [];
    const customer = body?.customer || {};
    const checkoutSessionToken = uuidRe.test(String(body?.checkoutSessionToken || ""))
      ? String(body.checkoutSessionToken)
      : null;
    const origin = validOrigin(body?.origin || req.headers.get("origin"));

    if (!cart.length || cart.length > 100) {
      return respond(req, { error: true, message: "Cart is empty or too large." }, 400);
    }
    if (!customer.email || !customer.firstName || !customer.address || !customer.city || !customer.postalCode) {
      return respond(req, { error: true, message: "Missing required customer fields." }, 400);
    }

    const customerEmail = String(customer.email || "").trim();
    const country = String(customer.country || "Canada").trim().toUpperCase();
    const provinceCode = normalizeProvinceCode(customer.province);
    const postalCode = normalizeCanadianPostalCode(customer.postalCode);

    if (!emailRe.test(customerEmail) || customerEmail.length > 254) {
      return respond(req, { error: true, message: "Enter a valid email address." }, 400);
    }
    if (country !== "CANADA" && country !== "CA") {
      return respond(req, { error: true, message: "Shipping is currently available within Canada only." }, 400);
    }
    if (!canadianProvinceCodes.has(provinceCode)) {
      return respond(req, { error: true, message: "Choose a valid Canadian province or territory." }, 400);
    }
    if (!postalCode) {
      return respond(req, { error: true, message: "Enter a valid Canadian postal code in the format A1A 1A1." }, 400);
    }

    if (customer.termsAccepted !== true) {
      return respond(req, { error: true, message: "Accept the Terms & Conditions and Privacy Policy before checkout." }, 400);
    }

    customer.email = customerEmail.toLowerCase();
    customer.country = "Canada";
    customer.postalCode = postalCode;

    const productIds = [...new Set(cart.map((item: any) => String(item?.productId || "")).filter((id: string) => uuidRe.test(id)))];
    if (productIds.length !== new Set(cart.map((item: any) => String(item?.productId || ""))).size) {
      return respond(req, { error: true, message: "One or more cart products are invalid." }, 400);
    }

    const { data: productRows, error: productError } = await service
      .from("products")
      .select("*")
      .in("id", productIds)
      .eq("status", "active");
    if (productError) throw productError;

    const products = new Map((productRows || []).map((p: any) => [p.id, p]));
    if (products.size !== productIds.length) {
      return respond(req, { error: true, message: "One or more products are unavailable." }, 400);
    }

    const { data: storeSettings, error: storeSettingsError } = await service
      .from("store_settings")
      .select("order_prefix,dtf_settings")
      .eq("id", 1)
      .maybeSingle();
    if (storeSettingsError) throw storeSettingsError;

    const dtfSettings = normalizeDtfSettings(storeSettings?.dtf_settings || {});

    const { data: variantRows, error: variantError } = await service
      .from("product_variants")
      .select("*")
      .in("product_id", productIds)
      .eq("active", true);
    if (variantError) throw variantError;

    const variantsById = new Map<string, any>();
    const variantsByProduct = new Map<string, any[]>();
    for (const variant of variantRows || []) {
      variantsById.set(variant.id, variant);
      if (!variantsByProduct.has(variant.product_id)) {
        variantsByProduct.set(variant.product_id, []);
      }
      variantsByProduct.get(variant.product_id)!.push(variant);
    }

    const user = await optionalUser(req, supabaseUrl, anonKey);
    const customIds = [...new Set(cart.map((item: any) => String(item?.customDesignId || "")).filter((id: string) => uuidRe.test(id)))];
    const customDesigns = new Map<string, any>();

    if (customIds.length) {
      if (!user) return respond(req, { error: true, message: "Sign in before checking out a custom design." }, 401);

      const { data: designs, error: designError } = await service
        .from("custom_designs")
        .select("*")
        .in("id", customIds)
        .eq("user_id", user.id);
      if (designError) throw designError;
      for (const design of designs || []) customDesigns.set(design.id, design);

      if (customDesigns.size !== customIds.length) {
        return respond(req, { error: true, message: "A custom design is missing or does not belong to this account." }, 403);
      }
    }

    const normalizedItems: any[] = [];
    let subtotal = 0;
    let eligibleSubtotal = 0;
    let exemptSubtotal = 0;
    let eligibleItemCount = 0;

    for (const item of cart) {
      const product = products.get(String(item.productId));
      if (!product) continue;

      const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity || 1))));
      const productVariants = variantsByProduct.get(product.id) || [];
      const requestedVariantId = uuidRe.test(String(item.variantId || ""))
        ? String(item.variantId)
        : null;

      let variantRow = requestedVariantId
        ? variantsById.get(requestedVariantId)
        : null;

      if (requestedVariantId && (!variantRow || variantRow.product_id !== product.id)) {
        return respond(req, 
          { error: true, message: `A selected variant for ${product.name} is unavailable.` },
          400
        );
      }

      if (!variantRow && productVariants.length) {
        const requestedSize = String(item.size || "").trim().toLowerCase();
        const requestedColor = String(item.color || "").trim().toLowerCase();

        variantRow =
          productVariants.find((variant: any) => {
            const sizeMatches =
              !requestedSize ||
              !variant.size ||
              String(variant.size).trim().toLowerCase() === requestedSize;
            const colorMatches =
              !requestedColor ||
              !variant.color ||
              String(variant.color).trim().toLowerCase() === requestedColor;
            return sizeMatches && colorMatches;
          }) || null;
      }

      if (product.track_inventory && productVariants.length && !variantRow) {
        return respond(req, 
          { error: true, message: `Choose an available variant for ${product.name}.` },
          400
        );
      }

      if (
        product.track_inventory &&
        variantRow &&
        Number(variantRow.stock || 0) < quantity
      ) {
        return respond(req, 
          {
            error: true,
            message: `${product.name} only has ${Number(variantRow.stock || 0)} unit(s) available for the selected variant.`,
          },
          409
        );
      }

      let unitPrice =
        variantRow?.price == null
          ? Number(product.price || 0)
          : Number(variantRow.price || 0);

      const designId = uuidRe.test(String(item.customDesignId || "")) ? String(item.customDesignId) : null;
      const design = designId ? customDesigns.get(designId) : null;
      let customData: Record<string, unknown> = {};
      let discountExempt = false;

      if (isDtfProduct(product)) {
        if (!dtfSettings.enabled) {
          return respond(req, { error: true, message: "DTF ordering is currently paused." }, 409);
        }

        const spec = item?.dtfSpec || {};
        const mode = String(spec.mode || "");
        const width = Number(spec.width);
        const length = Number(spec.length);
        const layout = Array.isArray(spec.layout) ? spec.layout.slice(0, 100) : [];

        if (!["build", "upload"].includes(mode)) {
          return respond(req, { error: true, message: "Choose a valid DTF order type." }, 400);
        }
        if (!Number.isFinite(width) || width < 1 || width > dtfSettings.maxWidth) {
          return respond(req, { error: true, message: `DTF film width must be between 1" and ${dtfSettings.maxWidth}".` }, 400);
        }
        if (!Number.isFinite(length) || length < dtfSettings.minLength || length > 10000) {
          return respond(req, { error: true, message: `DTF film length must be at least ${dtfSettings.minLength}".` }, 400);
        }
        if (spec.approvalAcknowledged !== true) {
          return respond(req, { error: true, message: "Approve the DTF film layout before checkout." }, 400);
        }
        if (spec.rightsConfirmed !== true) {
          return respond(req, { error: true, message: "Confirm that you own or have permission to reproduce the DTF artwork." }, 400);
        }
        if (!layout.length || (mode === "upload" && layout.length !== 1)) {
          return respond(req, { error: true, message: mode === "upload" ? "Upload one print-ready gang sheet." : "Add artwork to the DTF film." }, 400);
        }

        const cleanLayout = [];
        for (const artwork of layout) {
          const storagePath = String(artwork?.storagePath || "");
          const x = Number(artwork?.x);
          const y = Number(artwork?.y);
          const artWidth = Number(artwork?.width);
          const artHeight = Number(artwork?.height);
          const rotation = Number(artwork?.rotation || 0);

          if (!validDtfStoragePath(storagePath)) {
            return respond(req, { error: true, message: "A DTF artwork upload is missing or invalid." }, 400);
          }
          if (![x, y, artWidth, artHeight, rotation].every(Number.isFinite) || x < 0 || y < 0 || artWidth <= 0 || artHeight <= 0) {
            return respond(req, { error: true, message: "A DTF artwork placement is invalid." }, 400);
          }
          if (x + artWidth > width + 0.05 || y + artHeight > length + 0.05) {
            return respond(req, { error: true, message: "DTF artwork extends beyond the selected film." }, 400);
          }

          const rawCrop = artwork?.cropBounds;
          const cropBounds =
            rawCrop &&
            [rawCrop.left, rawCrop.top, rawCrop.right, rawCrop.bottom].every((value) => Number.isFinite(Number(value))) &&
            Number(rawCrop.left) >= 0 &&
            Number(rawCrop.top) >= 0 &&
            Number(rawCrop.right) <= 1 &&
            Number(rawCrop.bottom) <= 1 &&
            Number(rawCrop.right) > Number(rawCrop.left) &&
            Number(rawCrop.bottom) > Number(rawCrop.top)
              ? {
                  left: Number(rawCrop.left),
                  top: Number(rawCrop.top),
                  right: Number(rawCrop.right),
                  bottom: Number(rawCrop.bottom),
                }
              : null;

          cleanLayout.push({
            name: safeUploadFileName(artwork?.name),
            type: String(artwork?.type || ""),
            storagePath,
            x,
            y,
            width: artWidth,
            height: artHeight,
            rotation,
            pixelWidth: Math.max(0, Number(artwork?.pixelWidth || 0)),
            pixelHeight: Math.max(0, Number(artwork?.pixelHeight || 0)),
            originalPixelWidth: Math.max(0, Number(artwork?.originalPixelWidth || artwork?.pixelWidth || 0)),
            originalPixelHeight: Math.max(0, Number(artwork?.originalPixelHeight || artwork?.pixelHeight || 0)),
            cropBounds,
            transparentTrimmed: artwork?.transparentTrimmed === true && Boolean(cropBounds),
          });
        }

        for (let i = 0; i < cleanLayout.length; i += 1) {
          const a = cleanLayout[i];
          for (let j = i + 1; j < cleanLayout.length; j += 1) {
            const b = cleanLayout[j];
            const overlaps =
              a.x < b.x + b.width &&
              a.x + a.width > b.x &&
              a.y < b.y + b.height &&
              a.y + a.height > b.y;
            if (overlaps) {
              return respond(req, { error: true, message: "DTF artwork items overlap. Adjust the film layout before checkout." }, 400);
            }
          }
        }

        const dtfPrice = calculateDtfPrice(width, length, dtfSettings);
        const reviewRequested = spec.artworkReviewRequested === true && dtfSettings.artworkReviewEnabled === true;
        unitPrice = dtfPrice.price + (reviewRequested ? dtfSettings.artworkReviewPrice : 0);
        discountExempt = true;
        customData = {
          type: "dtf_gang_sheet",
          mode,
          width,
          length,
          area: dtfPrice.area,
          pricingMode: dtfSettings.pricingMode,
          standardArea: dtfPrice.standardArea,
          volumeArea: dtfPrice.volumeArea,
          standardRate: dtfSettings.standardRate,
          volumeRate: dtfSettings.volumeRate,
          artworkReviewRequested: reviewRequested,
          rightsConfirmed: true,
          rightsTimestamp: String(spec.rightsTimestamp || new Date().toISOString()),
          approvalAcknowledged: true,
          approvalTimestamp: String(spec.approvalTimestamp || new Date().toISOString()),
          utilization: Math.max(0, Math.min(100, Number(spec.utilization || 0))),
          usedLength: Math.max(0, Number(spec.usedLength || 0)),
          layout: cleanLayout,
        };
      } else if (design) {
        const cfg = product.customization || {};
        if (design.placement === "front_back") unitPrice += Number(cfg.frontBackFee ?? 10);
        if (design.priority === "rush") {
          unitPrice += Number(cfg.rushDesignFee ?? 10) + Number(cfg.rushProductionFee ?? 15);
        }
      }

      unitPrice = roundMoney(unitPrice);
      const lineSubtotal = unitPrice * quantity;
      subtotal += lineSubtotal;
      if (discountExempt) {
        exemptSubtotal += lineSubtotal;
      } else {
        eligibleSubtotal += lineSubtotal;
        eligibleItemCount += quantity;
      }

      normalizedItems.push({
        product,
        design,
        variantRow,
        quantity,
        unitPrice,
        customData,
        discountExempt,
        size: isDtfProduct(product)
          ? `${Number((customData as any).width || 0)}" × ${Number((customData as any).length || 0)}"`
          : String(item.size || design?.size || variantRow?.size || ""),
        color: isDtfProduct(product) ? "DTF Film" : String(item.color || design?.color || variantRow?.color || ""),
        variant: isDtfProduct(product)
          ? ((customData as any).mode === "upload" ? "Upload Print-Ready Gang Sheet" : "Build My Gang Sheet")
          : String(variantRow?.name || item.variant || product.type || ""),
      });
    }

    subtotal = roundMoney(subtotal);
    eligibleSubtotal = roundMoney(eligibleSubtotal);
    exemptSubtotal = roundMoney(exemptSubtotal);
    const quantityFactor = eligibleItemCount >= 3 ? 0.75 : eligibleItemCount >= 2 ? 0.80 : 1;
    const eligibleDiscounted = roundMoney(eligibleSubtotal * quantityFactor);
    const discounted = roundMoney(eligibleDiscounted + exemptSubtotal);
    const quantityDiscount = roundMoney(eligibleSubtotal - eligibleDiscounted);

    const couponCode = String(body?.discountCode || customer.discountCode || "").trim().toUpperCase();
    const coupon = await getCoupon(service, couponCode, discounted);
    let couponAmount = 0;
    let freeShipping = false;

    if (coupon) {
      if (coupon.type === "percentage") couponAmount = roundMoney(discounted * (Number(coupon.value || 0) / 100));
      if (coupon.type === "fixed") couponAmount = Math.min(discounted, roundMoney(Number(coupon.value || 0)));
      if (coupon.type === "free_shipping") freeShipping = true;
    }

    const afterCoupon = roundMoney(Math.max(0, discounted - couponAmount));
    const checkoutRules = await getCheckoutRules(service, customer, afterCoupon, freeShipping);
    const shippingMethod = checkoutRules.shippingMethod;
    const shipping = checkoutRules.shipping;
    const tax = checkoutRules.tax;
    const total = roundMoney(afterCoupon + shipping + tax);

    const prefix = String(storeSettings?.order_prefix || "GDP").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "GDP";
    const orderNumber = `${prefix}-${Date.now().toString().slice(-8)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim();
    const shippingAddress = {
      address: customer.address,
      city: customer.city,
      province: customer.province,
      postalCode: customer.postalCode,
      country: customer.country || "Canada",
    };

    const { data: order, error: orderError } = await service
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: user?.id || null,
        customer_email: user?.email || customer.email,
        customer_name: customerName,
        customer_phone: customer.phone || null,
        subtotal,
        discount: roundMoney(quantityDiscount + couponAmount),
        shipping,
        tax,
        total,
        status: "pending_payment",
        design_status: "not_required",
        production_status: "not_started",
        fulfillment_status: "unfulfilled",
        shipping_address: shippingAddress,
        billing_address: shippingAddress,
        shipping_method: shippingMethod,
        payment_status: "pending",
        notes: customer.notes || null,
        discount_code: coupon?.code || null,
        is_guest: !user,
        need_by_date: normalizedItems.map((x) => x.design?.need_by_date).filter(Boolean).sort()[0] || null,
        priority: normalizedItems.some((x) => x.design?.priority === "rush") ? "rush" : "standard",
      })
      .select("id,order_number,confirmation_token")
      .single();

    if (orderError) throw orderError;

    const acceptedAt = new Date().toISOString();
    const { error: policyAcceptanceError } = await service.from("policy_acceptances").insert([
      {
        user_id: user?.id || null,
        email: user?.email || customer.email,
        order_id: order.id,
        policy_key: "terms_conditions",
        policy_version: "2026-09-07",
        source: "checkout",
        accepted_at: acceptedAt,
      },
      {
        user_id: user?.id || null,
        email: user?.email || customer.email,
        order_id: order.id,
        policy_key: "privacy_policy",
        policy_version: "2026-09-07",
        source: "checkout",
        accepted_at: acceptedAt,
      },
    ]);
    if (policyAcceptanceError) {
      console.error("checkout policy acceptance audit failed", policyAcceptanceError);
    }

    if (customer.marketingConsent === true) {
      const { error: marketingConsentError } = await service.from("marketing_consents").insert({
        user_id: user?.id || null,
        email: user?.email || customer.email,
        status: "subscribed",
        source: "checkout",
        consent_text_version: "2026-09-07",
        policy_version: "2026-09-07",
      });
      if (marketingConsentError) {
        console.error("checkout marketing consent audit failed", marketingConsentError);
      }
    }

    const orderItems = normalizedItems.map(({ product, design, variantRow, quantity, unitPrice, size, color, variant, customData }) => ({
      order_id: order.id,
      product_id: product.id,
      variant_id: variantRow?.id || null,
      custom_design_id: design?.id || null,
      name: product.name,
      image: product.images?.[0] || null,
      variant,
      size,
      color,
      quantity,
      unit_price: unitPrice,
      fulfillment_mode: product.fulfillment_mode || "in_house",
      is_custom: Boolean(design),
      custom_data: customData || {},
    }));

    const { error: itemError } = await service.from("order_items").insert(orderItems);
    if (itemError) {
      await service.from("orders").delete().eq("id", order.id);
      throw itemError;
    }

    const reservationExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error: inventoryReservationError } = await service.rpc(
      "reserve_order_inventory",
      { p_order_id: order.id, p_expires_at: reservationExpiresAt }
    );
    if (inventoryReservationError) {
      await service.from("orders").delete().eq("id", order.id);
      return respond(req, {
        error: true,
        message: reservationErrorMessage(
          inventoryReservationError,
          "One or more items became unavailable while checkout was being created."
        ),
      }, 409);
    }

    if (coupon?.id) {
      const { error: couponReservationError } = await service.rpc(
        "reserve_order_coupon",
        {
          p_order_id: order.id,
          p_discount_id: coupon.id,
          p_expires_at: reservationExpiresAt,
        }
      );
      if (couponReservationError) {
        await releaseCheckoutReservations(service, order.id);
        await service.from("orders").delete().eq("id", order.id);
        return respond(req, {
          error: true,
          message: reservationErrorMessage(
            couponReservationError,
            "That discount code could not be reserved for checkout."
          ),
        }, 409);
      }
    }

    const uniqueDesigns = [...new Map(normalizedItems.filter((x) => x.design).map((x) => [x.design.id, x.design])).values()];
    for (const design of uniqueDesigns as any[]) {
      await service
        .from("custom_designs")
        .update({ order_id: order.id, status: "ordered" })
        .eq("id", design.id);

      if (design.proof_required !== false) {
        const { data: existing } = await service
          .from("design_proofs")
          .select("id")
          .eq("custom_design_id", design.id)
          .eq("order_id", order.id)
          .maybeSingle();

        if (!existing) {
          await service.from("design_proofs").insert({
            custom_design_id: design.id,
            order_id: order.id,
            status: "pending",
            max_revisions: Number(design.revision_allowance ?? 2),
          });
        }
      }
    }

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const stripePublishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");

    if (!stripeSecret || !stripePublishableKey) {
      await releaseCheckoutReservations(service, order.id);
      await service
        .from("orders")
        .update({
          payment_status: "failed",
          status: "payment_failed",
          fulfillment_status: "unfulfilled",
        })
        .eq("id", order.id);

      if (checkoutSessionToken) {
        await service
          .from("checkout_sessions")
          .update({
            status: "converted",
            converted_order_id: order.id,
            last_activity_at: new Date().toISOString(),
          })
          .eq("session_token", checkoutSessionToken);
      }

      return respond(req, {
        orderNumber: order.order_number,
        confirmationToken: order.confirmation_token,
        configured: false,
        missing: !stripeSecret ? "STRIPE_SECRET_KEY" : "STRIPE_PUBLISHABLE_KEY",
        pricing: {
          subtotal,
          discount: roundMoney(quantityDiscount + couponAmount),
          shipping,
          tax,
          total,
          taxRate: checkoutRules.taxRate,
          taxName: checkoutRules.taxName,
        },
      });
    }

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("ui_mode", "elements");
    form.set("expires_at", String(Math.floor(new Date(reservationExpiresAt).getTime() / 1000)));
    form.set(
      "return_url",
      `${origin}/order/${encodeURIComponent(order.order_number)}?status=success&token=${order.confirmation_token}&session_id={CHECKOUT_SESSION_ID}`
    );
    form.set("customer_email", user?.email || customer.email);
    form.set("line_items[0][price_data][currency]", "cad");
    form.set(
      "line_items[0][price_data][product_data][name]",
      `GDP Clothing Order ${order.order_number}`
    );
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(total * 100)));
    form.set("line_items[0][quantity]", "1");
    form.set("metadata[order_id]", order.id);
    form.set("metadata[order_number]", order.order_number);
    form.set("payment_intent_data[metadata][order_id]", order.id);
    form.set("payment_intent_data[metadata][order_number]", order.order_number);

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2026-08-26.dahlia",
      },
      body: form,
    });

    const stripeData = await stripeResponse.json();
    if (!stripeResponse.ok || !stripeData?.client_secret) {
      await releaseCheckoutReservations(service, order.id);

      for (const design of uniqueDesigns as any[]) {
        await service
          .from("custom_designs")
          .update({ order_id: null, status: "in_cart" })
          .eq("id", design.id);
      }
      await service.from("orders").delete().eq("id", order.id);

      if (checkoutSessionToken) {
        await service
          .from("checkout_sessions")
          .update({
            status: "active",
            converted_order_id: null,
            last_activity_at: new Date().toISOString(),
          })
          .eq("session_token", checkoutSessionToken);
      }

      return respond(req, 
        {
          error: true,
          message: stripeData?.error?.message || "Stripe payment form could not be created.",
        },
        502
      );
    }

    await service
      .from("orders")
      .update({ stripe_checkout_session_id: stripeData.id })
      .eq("id", order.id);

    if (checkoutSessionToken) {
      await service
        .from("checkout_sessions")
        .update({
          status: "converted",
          converted_order_id: order.id,
          last_activity_at: new Date().toISOString(),
        })
        .eq("session_token", checkoutSessionToken);
    }

    return respond(req, {
      orderNumber: order.order_number,
      confirmationToken: order.confirmation_token,
      clientSecret: stripeData.client_secret,
      publishableKey: stripePublishableKey,
      configured: true,
      uiMode: "custom",
      pricing: {
        subtotal,
        discount: roundMoney(quantityDiscount + couponAmount),
        shipping,
        tax,
        total,
        taxRate: checkoutRules.taxRate,
        taxName: checkoutRules.taxName,
      },
    });
  } catch (error) {
    console.error("checkout error", error);
    return respond(req, { error: true, message: error?.message || "Checkout failed." }, 500);
  }
});
