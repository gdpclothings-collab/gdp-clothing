import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roundMoney = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return respond({ error: true, message: "Method not allowed." }, 405);

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
      if (!code) return respond({ active: false });

      const { data } = await service
        .from("discounts")
        .select("code,type,value,min_purchase,active,starts_at,ends_at,usage_count,usage_limit")
        .eq("code", code)
        .maybeSingle();

      const active = couponIsUsable(data, Number.MAX_SAFE_INTEGER);
      return respond(active ? {
        active: true,
        code: data.code,
        type: data.type,
        value: Number(data.value || 0),
        minPurchase: data.min_purchase == null ? null : Number(data.min_purchase),
      } : { active: false });
    }

    if (action === "getOrder") {
      const orderNumber = String(body?.orderNumber || "").trim();
      const token = String(body?.token || "").trim();
      const user = await optionalUser(req, supabaseUrl, anonKey);

      if (!orderNumber) return respond({ error: true, message: "Missing order number." }, 400);

      let query = service
        .from("orders")
        .select("*, order_items(*)")
        .eq("order_number", orderNumber);

      if (token && uuidRe.test(token)) {
        query = query.eq("confirmation_token", token);
      } else if (user) {
        query = query.eq("user_id", user.id);
      } else {
        return respond({ error: true, message: "Order access denied." }, 403);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return respond({ error: true, message: "Order not found." }, 404);
      return respond({ order: data });
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
        return respond({
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

      return respond({ sessionToken, status: "active" });
    }

    if (action !== "createOrder") {
      return respond({ error: true, message: "Unknown checkout action." }, 400);
    }

    const cart = Array.isArray(body?.cart) ? body.cart : [];
    const customer = body?.customer || {};
    const checkoutSessionToken = uuidRe.test(String(body?.checkoutSessionToken || ""))
      ? String(body.checkoutSessionToken)
      : null;
    const origin = validOrigin(body?.origin || req.headers.get("origin"));

    if (!cart.length || cart.length > 100) {
      return respond({ error: true, message: "Cart is empty or too large." }, 400);
    }
    if (!customer.email || !customer.firstName || !customer.address || !customer.city || !customer.postalCode) {
      return respond({ error: true, message: "Missing required customer fields." }, 400);
    }

    const productIds = [...new Set(cart.map((item: any) => String(item?.productId || "")).filter((id: string) => uuidRe.test(id)))];
    if (productIds.length !== new Set(cart.map((item: any) => String(item?.productId || ""))).size) {
      return respond({ error: true, message: "One or more cart products are invalid." }, 400);
    }

    const { data: productRows, error: productError } = await service
      .from("products")
      .select("*")
      .in("id", productIds)
      .eq("status", "active");
    if (productError) throw productError;

    const products = new Map((productRows || []).map((p: any) => [p.id, p]));
    if (products.size !== productIds.length) {
      return respond({ error: true, message: "One or more products are unavailable." }, 400);
    }

    const user = await optionalUser(req, supabaseUrl, anonKey);
    const customIds = [...new Set(cart.map((item: any) => String(item?.customDesignId || "")).filter((id: string) => uuidRe.test(id)))];
    const customDesigns = new Map<string, any>();

    if (customIds.length) {
      if (!user) return respond({ error: true, message: "Sign in before checking out a custom design." }, 401);

      const { data: designs, error: designError } = await service
        .from("custom_designs")
        .select("*")
        .in("id", customIds)
        .eq("user_id", user.id);
      if (designError) throw designError;
      for (const design of designs || []) customDesigns.set(design.id, design);

      if (customDesigns.size !== customIds.length) {
        return respond({ error: true, message: "A custom design is missing or does not belong to this account." }, 403);
      }
    }

    const normalizedItems: any[] = [];
    let subtotal = 0;
    let itemCount = 0;

    for (const item of cart) {
      const product = products.get(String(item.productId));
      if (!product) continue;

      const quantity = Math.max(1, Math.min(99, Math.floor(Number(item.quantity || 1))));
      let unitPrice = Number(product.price || 0);

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
        quantity,
        unitPrice,
        size: String(item.size || design?.size || ""),
        color: String(item.color || design?.color || ""),
        variant: String(item.variant || product.type || ""),
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
    const shippingMethod = customer.shippingMethod === "pickup" ? "pickup" : "standard";
    const shipping = shippingMethod === "pickup" || freeShipping || afterCoupon >= 150 ? 0 : 12.99;
    const tax = roundMoney((afterCoupon + shipping) * 0.11);
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

    const orderItems = normalizedItems.map(({ product, design, quantity, unitPrice, size, color, variant }) => ({
      order_id: order.id,
      product_id: product.id,
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

      return respond({
        orderNumber: order.order_number,
        confirmationToken: order.confirmation_token,
        configured: false,
        missing: !stripeSecret ? "STRIPE_SECRET_KEY" : "STRIPE_PUBLISHABLE_KEY",
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

      return respond(
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

    return respond({
      orderNumber: order.order_number,
      confirmationToken: order.confirmation_token,
      clientSecret: stripeData.client_secret,
      publishableKey: stripePublishableKey,
      configured: true,
      uiMode: "custom",
    });
  } catch (error) {
    console.error("checkout error", error);
    return respond({ error: true, message: error?.message || "Checkout failed." }, 500);
  }
});
