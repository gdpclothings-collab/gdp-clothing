
const DEFAULT_GRAPH_VERSION = "v26.0";

function textResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9$%+.#' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function words(value) {
  return normalizeText(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function containsAny(text, phrases) {
  const normalized = normalizeText(text);
  return phrases.some((phrase) => normalized.includes(normalizeText(phrase)));
}

export function scoreKnowledge(text, rows) {
  const normalized = normalizeText(text);
  let best = null;
  let bestScore = -1;

  for (const row of rows || []) {
    if (!row || row.active === false) continue;
    let matched = 0;
    let longest = 0;
    for (const keyword of row.keywords || []) {
      const key = normalizeText(keyword);
      if (key && normalized.includes(key)) {
        matched += 1;
        longest = Math.max(longest, key.length);
      }
    }
    if (!matched) continue;

    const score = Number(row.priority || 0) * 1000 + matched * 100 + longest;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  return best;
}

function renderTemplate(template, settings) {
  return String(template || "")
    .replaceAll("{{website_url}}", settings.website_url || "https://gdpclothing.ca")
    .replaceAll("{{custom_studio_url}}", settings.custom_studio_url || "https://gdpclothing.ca/custom-studio")
    .replaceAll("{{human_handoff_reply}}", settings.human_handoff_reply || "A GDP Clothing team member will follow up here.");
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index];
  }
  return result === 0;
}

export async function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const supplied = hexToBytes(signatureHeader.slice("sha256=".length));
  if (!supplied) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return constantTimeEqual(new Uint8Array(signed), supplied);
}

function supabaseConfig(env) {
  return {
    url: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, ""),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY || ""),
  };
}

async function supabaseRequest(env, path, init = {}) {
  const config = supabaseConfig(env);
  if (!config.url || !config.key) {
    throw new Error("supabase_not_configured");
  }

  const response = await fetch(config.url + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: "Bearer " + config.key,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error("supabase_request_failed_" + response.status);
    error.status = response.status;
    error.body = body.slice(0, 500);
    throw error;
  }

  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function getSettings(env) {
  const rows = await supabaseRequest(
    env,
    "messenger_agent_settings?id=eq.1&select=*&limit=1",
  );
  return rows?.[0] || null;
}

async function getKnowledge(env) {
  return await supabaseRequest(
    env,
    "messenger_agent_knowledge?active=eq.true&select=intent,keywords,response_template,priority,requires_human,active&order=priority.desc",
  );
}

async function reserveEvent(env, eventKey, senderPsid, eventType) {
  const senderHash = await sha256Hex(senderPsid);
  const config = supabaseConfig(env);
  const response = await fetch(config.url + "/rest/v1/messenger_agent_events", {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: "Bearer " + config.key,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event_key: eventKey,
      sender_hash: senderHash,
      event_type: eventType,
      status: "received",
    }),
  });

  if (response.status === 409) return false;
  if (!response.ok) {
    throw new Error("event_reservation_failed_" + response.status);
  }
  return true;
}

async function updateEvent(env, eventKey, status, intent = null, errorCode = null) {
  await supabaseRequest(
    env,
    "messenger_agent_events?event_key=eq." + encodeURIComponent(eventKey),
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status,
        intent,
        error_code: errorCode,
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

async function activeHandoff(env, psid) {
  const now = encodeURIComponent(new Date().toISOString());
  const rows = await supabaseRequest(
    env,
    "messenger_agent_handoffs?psid=eq." + encodeURIComponent(psid) +
      "&status=eq.open&expires_at=gt." + now +
      "&select=psid,expires_at&limit=1",
  );
  return rows?.[0] || null;
}

async function touchHandoff(env, psid) {
  await supabaseRequest(
    env,
    "messenger_agent_handoffs?psid=eq." + encodeURIComponent(psid),
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        last_customer_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    },
  );
}

async function openHandoff(env, psid, reason, timeoutMinutes) {
  const openedAt = new Date();
  const expiresAt = new Date(openedAt.getTime() + Number(timeoutMinutes || 720) * 60 * 1000);

  const config = supabaseConfig(env);
  const response = await fetch(
    config.url + "/rest/v1/messenger_agent_handoffs?on_conflict=psid",
    {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: "Bearer " + config.key,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        psid,
        reason,
        status: "open",
        opened_at: openedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        last_customer_message_at: openedAt.toISOString(),
        updated_at: openedAt.toISOString(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error("handoff_upsert_failed_" + response.status);
  }
}

async function sendText(env, recipientId, text) {
  const pageToken = String(env.META_PAGE_ACCESS_TOKEN || "");
  const pageId = String(env.META_PAGE_ID || "");
  const version = String(env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION);

  if (!pageToken || !pageId) throw new Error("meta_send_not_configured");

  const response = await fetch(
    "https://graph.facebook.com/" + version + "/" + encodeURIComponent(pageId) + "/messages",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + pageToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text: String(text || "").slice(0, 1900) },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = new Error("meta_send_failed_" + response.status);
    error.body = body.slice(0, 500);
    throw error;
  }
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return "$" + number.toFixed(2);
}

function productSynonyms(message) {
  const normalized = normalizeText(message);
  const tokens = new Set(words(normalized));

  if (normalized.includes("t-shirt") || normalized.includes("t shirt") || normalized.includes("shirt")) {
    tokens.add("tee");
  }
  if (normalized.includes("sweat shirt")) tokens.add("sweatshirt");
  if (normalized.includes("crew neck")) tokens.add("crewneck");
  if (normalized.includes("gangsheet")) {
    tokens.add("gang");
    tokens.add("sheet");
  }
  if (normalized.includes("kids") || normalized.includes("kid")) {
    tokens.add("youth");
    tokens.add("toddler");
  }

  return [...tokens];
}

export function selectProductMatches(message, products, limit = 3) {
  const tokens = productSynonyms(message)
    .filter((token) => token.length >= 3)
    .filter((token) => !["how", "much", "price", "cost", "custom", "make", "want", "need", "your", "with", "have"].includes(token));

  const scored = (products || []).map((product) => {
    const haystack = normalizeText([
      product.name,
      product.slug,
      ...(product.tags || []),
    ].join(" "));

    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += token.length >= 6 ? 4 : 2;
    }

    if (normalizeText(message).includes("hoodie") && haystack.includes("hoodie")) score += 8;
    if (normalizeText(message).includes("crewneck") && haystack.includes("crewneck")) score += 8;
    if (normalizeText(message).includes("sweatshirt") && haystack.includes("sweatshirt")) score += 8;
    if (normalizeText(message).includes("long sleeve") && haystack.includes("long sleeve")) score += 8;
    if (
      (normalizeText(message).includes("short sleeve") || normalizeText(message).includes("t shirt") || normalizeText(message).includes("t-shirt")) &&
      haystack.includes("short sleeve")
    ) score += 8;

    return { product, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.product);
}

export function isProductSellable(product, stockedProductIds = new Set()) {
  if (!product) return false;
  if (product.status && product.status !== "active") return false;
  if (product.track_inventory !== true) return true;
  if (product.sell_when_out_of_stock === true) return true;
  return stockedProductIds.has(product.id);
}

async function filterSellableProducts(env, products) {
  const candidates = products || [];
  const stockTrackedIds = candidates
    .filter((product) => product?.track_inventory === true && product?.sell_when_out_of_stock !== true)
    .map((product) => product.id)
    .filter(Boolean);

  if (!stockTrackedIds.length) {
    return candidates.filter((product) => isProductSellable(product));
  }

  const variants = await supabaseRequest(
    env,
    "product_variants?active=eq.true&stock=gt.0&product_id=in.(" +
      stockTrackedIds.map((id) => encodeURIComponent(id)).join(",") +
      ")&select=product_id&limit=1000",
  );
  const stockedProductIds = new Set((variants || []).map((variant) => variant.product_id).filter(Boolean));

  return candidates.filter((product) => isProductSellable(product, stockedProductIds));
}

async function productReply(env, message, settings) {
  const productRows = await supabaseRequest(
    env,
    "products?status=eq.active&select=id,name,slug,price,compare_at_price,tags,custom_designable,status,track_inventory,sell_when_out_of_stock&limit=100",
  );
  const products = await filterSellableProducts(env, productRows);

  let matches = selectProductMatches(message, products, 3);

  if (!matches.length && containsAny(message, ["price", "prices", "how much", "cost"])) {
    const preferred = [
      "adult short sleeve tee",
      "adult long sleeve tee",
      "crewneck",
      "pullover hoodie",
    ];
    matches = preferred
      .map((needle) => products.find((product) => normalizeText(product.name).includes(needle)))
      .filter(Boolean)
      .slice(0, 4);
  }

  if (!matches.length) return null;

  const lines = matches.map((product) => {
    const current = money(product.price);
    const compare = money(product.compare_at_price);
    let line = product.name + ": " + current;
    if (compare && Number(product.compare_at_price) > Number(product.price)) {
      line += " (was " + compare + ")";
    }
    if (product.slug) {
      line += "\n" + settings.website_url.replace(/\/$/, "") + "/products/" + product.slug;
    }
    return line;
  });

  let intro = matches.length === 1 ? "Here’s the current price:" : "Here are current GDP Clothing prices:";
  if (containsAny(message, ["custom", "customize", "customise", "design"])) {
    intro += "\nYou can customize here: " + settings.custom_studio_url;
  }

  return intro + "\n\n" + lines.join("\n\n");
}

async function shippingReply(env) {
  const [settingsRows, rates] = await Promise.all([
    supabaseRequest(
      env,
      "delivery_settings?id=eq.1&select=local_pickup_enabled,pickup_name,pickup_location,processing_min_days,processing_max_days,carrier_name,fallback_rate_enabled,fallback_rate&limit=1",
    ),
    supabaseRequest(
      env,
      "shipping_rates?active=eq.true&select=name,price,min_order,max_order,min_delivery_days,max_delivery_days,priority&order=priority.asc&limit=50",
    ),
  ]);

  const delivery = settingsRows?.[0] || {};
  const paid = (rates || [])
    .filter((rate) => Number(rate.price) > 0)
    .sort((left, right) => Number(left.price) - Number(right.price))[0];
  const free = (rates || [])
    .filter((rate) => Number(rate.price) === 0 && rate.min_order != null)
    .sort((left, right) => Number(left.min_order) - Number(right.min_order))[0];

  const lines = [];
  if (paid) {
    let line = "Standard shipping: " + money(paid.price);
    if (paid.max_order != null) line += " for eligible orders under " + money(Number(paid.max_order) + 0.01);
    if (paid.min_delivery_days && paid.max_delivery_days) {
      line += " (" + paid.min_delivery_days + "–" + paid.max_delivery_days + " delivery days)";
    }
    lines.push(line);
  }

  if (free) {
    lines.push("Free standard shipping: orders " + money(free.min_order) + "+");
  }

  if (delivery.processing_min_days && delivery.processing_max_days) {
    lines.push("Typical processing: " + delivery.processing_min_days + "–" + delivery.processing_max_days + " business days");
  }

  if (delivery.local_pickup_enabled) {
    lines.push(
      (delivery.pickup_name || "Local Pickup") +
      ": available" +
      (delivery.pickup_location ? " — " + delivery.pickup_location : ""),
    );
  }

  if (!lines.length && delivery.fallback_rate_enabled && delivery.fallback_rate != null) {
    lines.push("Fallback shipping rate: " + money(delivery.fallback_rate));
  }

  return lines.length
    ? lines.join("\n")
    : "Shipping and pickup options are calculated from your order at checkout.";
}

export function formatDiscountLine(row, product, settings = {}) {
  const amount = row.type === "percentage"
    ? Number(row.value).toFixed(0) + "% off"
    : money(row.value) + " off";

  let line = "Code " + row.code + ": " + amount;
  if (row.applies_to === "product" && product) {
    line += " " + product.name;
    if (product.slug && settings.website_url) {
      line += "\n" + String(settings.website_url).replace(/\/$/, "") + "/products/" + product.slug;
    }
  } else {
    line += " eligible " + (row.applies_to || "items");
  }

  if (Number(row.min_purchase || 0) > 0) {
    line += " (minimum " + money(row.min_purchase) + ")";
  }
  return line;
}

async function discountReply(env, settings) {
  const rows = await supabaseRequest(
    env,
    "discounts?active=eq.true&select=code,type,value,applies_to,applies_to_id,min_purchase,starts_at,ends_at,usage_count,usage_limit&order=created_at.desc&limit=20",
  );

  const now = Date.now();
  const active = (rows || []).filter((row) => {
    const starts = row.starts_at ? new Date(row.starts_at).getTime() : null;
    const ends = row.ends_at ? new Date(row.ends_at).getTime() : null;
    if (starts && starts > now) return false;
    if (ends && ends < now) return false;
    if (row.usage_limit != null && Number(row.usage_count || 0) >= Number(row.usage_limit)) return false;
    return true;
  });

  if (!active.length) {
    return "There isn’t an active public discount code I can confirm right now. Current promotions will appear on eligible GDP Clothing product or checkout pages.";
  }

  const productIds = unique(
    active
      .filter((row) => row.applies_to === "product" && row.applies_to_id)
      .map((row) => row.applies_to_id),
  );

  let productById = new Map();
  if (productIds.length) {
    const productRows = await supabaseRequest(
      env,
      "products?status=eq.active&id=in.(" +
        productIds.map((id) => encodeURIComponent(id)).join(",") +
        ")&select=id,name,slug,status,track_inventory,sell_when_out_of_stock",
    );
    const sellableProducts = await filterSellableProducts(env, productRows);
    productById = new Map(sellableProducts.map((product) => [product.id, product]));
  }

  const visible = active.filter((row) => {
    if (row.applies_to !== "product") return true;
    return Boolean(row.applies_to_id && productById.has(row.applies_to_id));
  });

  if (!visible.length) {
    return "There isn’t an active public discount code I can confirm for an available product right now. Current promotions will appear on eligible GDP Clothing product or checkout pages.";
  }

  const lines = visible.slice(0, 3).map((row) =>
    formatDiscountLine(row, productById.get(row.applies_to_id), settings),
  );

  return "Current active GDP Clothing discount code" + (lines.length > 1 ? "s" : "") + ":\n" +
    lines.join("\n\n") +
    "\nExact eligibility is confirmed in the cart/checkout.";
}

function shouldCheckProducts(message) {
  return containsAny(message, [
    "price",
    "prices",
    "how much",
    "cost",
    "hoodie",
    "shirt",
    "tee",
    "crewneck",
    "sweatshirt",
    "sweater",
    "gang sheet",
    "gangsheet",
  ]);
}

async function buildReply(env, message, settings, knowledge) {
  const best = scoreKnowledge(message, knowledge);

  if (best?.requires_human) {
    return {
      text: renderTemplate(best.response_template, settings),
      intent: best.intent,
      handoff: true,
    };
  }

  if (containsAny(message, ["shipping", "delivery", "deliver", "pickup", "pick up"])) {
    return { text: await shippingReply(env), intent: "shipping", handoff: false };
  }

  if (containsAny(message, ["discount", "promo", "coupon", "sale", "discount code", "promo code"])) {
    return { text: await discountReply(env, settings), intent: "discounts", handoff: false };
  }

  if (shouldCheckProducts(message)) {
    const product = await productReply(env, message, settings);
    if (product) return { text: product, intent: "products", handoff: false };
  }

  if (best) {
    return {
      text: renderTemplate(best.response_template, settings),
      intent: best.intent,
      handoff: false,
    };
  }

  return {
    text: renderTemplate(settings.fallback_reply, settings),
    intent: "fallback",
    handoff: false,
  };
}

async function eventKeyFor(event) {
  const mid = event?.message?.mid;
  if (mid) return "m:" + mid;

  const sender = String(event?.sender?.id || "");
  const timestamp = String(event?.timestamp || "");
  const payload = String(event?.postback?.payload || event?.message?.quick_reply?.payload || "");
  return "e:" + await sha256Hex(sender + "|" + timestamp + "|" + payload);
}

async function processMessagingEvent(env, event) {
  const senderPsid = String(event?.sender?.id || "");
  if (!senderPsid) return;

  if (event?.message?.is_echo) return;

  const eventType = event?.postback ? "postback" : "message";
  const eventKey = await eventKeyFor(event);

  let reserved = false;
  try {
    reserved = await reserveEvent(env, eventKey, senderPsid, eventType);
    if (!reserved) return;

    const settings = await getSettings(env);
    if (!settings || settings.enabled === false) {
      await updateEvent(env, eventKey, "ignored", "disabled");
      return;
    }

    const handoff = await activeHandoff(env, senderPsid);
    if (handoff) {
      await touchHandoff(env, senderPsid);
      await updateEvent(env, eventKey, "ignored", "human_handoff_active");
      return;
    }

    const incomingText = String(
      event?.message?.text ||
      event?.message?.quick_reply?.payload ||
      event?.postback?.title ||
      event?.postback?.payload ||
      "",
    ).trim();

    if (!incomingText) {
      await sendText(
        env,
        senderPsid,
        "Thanks for messaging GDP Clothing. For the fastest help, send your question as text, or type “human” for a team member.",
      );
      await updateEvent(env, eventKey, "replied", "non_text");
      return;
    }

    const knowledge = await getKnowledge(env);
    const reply = await buildReply(env, incomingText, settings, knowledge);

    if (reply.handoff) {
      await openHandoff(
        env,
        senderPsid,
        reply.intent,
        settings.handoff_timeout_minutes,
      );
      await sendText(env, senderPsid, reply.text);
      await updateEvent(env, eventKey, "handoff", reply.intent);
      return;
    }

    await sendText(env, senderPsid, reply.text);
    await updateEvent(env, eventKey, "replied", reply.intent);
  } catch (error) {
    console.error("gdp-messenger-agent", error);
    if (reserved) {
      try {
        await updateEvent(
          env,
          eventKey,
          "error",
          null,
          String(error?.message || "unknown_error").slice(0, 120),
        );
      } catch {
        // Do not throw from diagnostics.
      }
    }
  }
}

async function processWebhook(env, payload) {
  if (payload?.object !== "page") return;

  const tasks = [];
  for (const entry of payload?.entry || []) {
    for (const event of entry?.messaging || []) {
      tasks.push(processMessagingEvent(env, event));
    }
  }
  await Promise.allSettled(tasks);
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (!mode && !verifyToken && !challenge) {
    return jsonResponse({ ok: true, service: "gdp-messenger-agent" });
  }

  if (
    mode === "subscribe" &&
    verifyToken &&
    verifyToken === String(context.env.META_VERIFY_TOKEN || "") &&
    challenge
  ) {
    return textResponse(challenge);
  }

  return textResponse("Forbidden", 403);
}

export async function onRequestPost(context) {
  const appSecret = String(context.env.META_APP_SECRET || "");
  if (!appSecret) return textResponse("Service not configured", 503);

  const rawBody = await context.request.text();
  const signature = context.request.headers.get("x-hub-signature-256") || "";
  const valid = await verifyMetaSignature(rawBody, signature, appSecret);
  if (!valid) return textResponse("Invalid signature", 401);

  let payload = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return textResponse("Invalid JSON", 400);
  }

  context.waitUntil(processWebhook(context.env, payload));
  return textResponse("EVENT_RECEIVED");
}
