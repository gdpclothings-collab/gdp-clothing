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

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function validOrigin(value: unknown) {
  const text = String(value || "");
  if (text === "https://gdp-clothing.pages.dev") return text;
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
    let itemCount = 0;

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

      if (design) {
        const cfg = product.customization || {};
        if (design.placement === "front_back") unitPrice += Number(cfg.frontBackFee ?? 10);
        if (design.priority === "rush") {
          unitPrice += Number(cfg.rushDesignFee ?? 10) + Number(cfg.rushProductionFee ?? 15);
        }
      }

      unitPrice = roundMoney(unitPrice);
      subtotal += unitPrice * quantity;
      itemCount += quantity;

      normalizedItems.push({
        product,
        design,
        variantRow,
        quantity,
        unitPrice,
        size: String(item.size || design?.size || variantRow?.size || ""),
        color: String(item.color || design?.color || variantRow?.color || ""),
        variant: String(variantRow?.name || item.variant || product.type || ""),
      });
    }

    subtotal = roundMoney(subtotal);
    const quantityFactor = itemCount >= 3 ? 0.75 : itemCount >= 2 ? 0.80 : 1;
    const discounted = roundMoney(subtotal * quantityFactor);
    const quantityDiscount = roundMoney(subtotal - discounted);

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

    const { data: settings } = await service
      .from("store_settings")
      .select("order_prefix")
      .eq("id", 1)
      .maybeSingle();

    const prefix = String(settings?.order_prefix || "GDP").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "GDP";
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
        fulfillment_status: "pending_payment",
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

    const orderItems = normalizedItems.map(({ product, design, variantRow, quantity, unitPrice, size, color, variant }) => ({
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
    }));

    const { error: itemError } = await service.from("order_items").insert(orderItems);
    if (itemError) {
      await service.from("orders").delete().eq("id", order.id);
      throw itemError;
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

    if (coupon?.id) {
      await service
        .from("discounts")
        .update({ usage_count: Number(coupon.usage_count || 0) + 1 })
        .eq("id", coupon.id);
    }

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const stripePublishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");

    if (!stripeSecret || !stripePublishableKey) {
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
