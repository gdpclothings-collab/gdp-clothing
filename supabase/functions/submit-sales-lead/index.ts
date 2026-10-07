import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const ALLOWED_ORIGINS = new Set([
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
  "https://gdp-clothing.pages.dev",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://gdpclothing.ca";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function respond(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), ...extra },
  });
}

function clean(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clientIp(req: Request) {
  const direct = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "";
  if (direct) return direct.trim().slice(0, 128);
  const forwarded = req.headers.get("x-forwarded-for") || "";
  return (forwarded.split(",")[0] || "unknown").trim().slice(0, 128);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function scoreLead(input: {
  quantity: number;
  artworkReady: boolean;
  deadline: string | null;
  budgetRange: string;
  orderType: string;
  businessName: string;
  phone: string;
}) {
  let score = 10;

  if (input.quantity >= 50) score += 30;
  else if (input.quantity >= 25) score += 24;
  else if (input.quantity >= 12) score += 16;
  else if (input.quantity >= 6) score += 8;

  if (input.artworkReady) score += 15;
  if (input.businessName) score += 5;
  if (input.phone) score += 5;

  if (input.orderType === "bulk_apparel") score += 10;
  else if (input.orderType === "team_event") score += 8;
  else if (input.orderType === "dtf_transfers") score += 6;

  const budgetPoints: Record<string, number> = {
    under_250: 2,
    "250_499": 8,
    "500_999": 14,
    "1000_2499": 20,
    "2500_plus": 25,
  };
  score += budgetPoints[input.budgetRange] || 0;

  if (input.deadline) {
    const deadlineMs = Date.parse(`${input.deadline}T23:59:59Z`);
    const days = Number.isFinite(deadlineMs)
      ? Math.ceil((deadlineMs - Date.now()) / 86_400_000)
      : null;
    if (days !== null && days >= 7 && days <= 30) score += 15;
    else if (days !== null && days > 30 && days <= 60) score += 8;
    else if (days !== null && days >= 0 && days < 7) score += 5;
  }

  score = Math.max(0, Math.min(100, score));
  const priority = score >= 65 ? "hot" : score >= 35 ? "warm" : "cold";
  return { score, priority };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders(req) });
    }
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return respond(req, { error: true, message: "Request origin is not allowed." }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return respond(req, { error: true, message: "Server configuration is incomplete." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return respond(req, { error: true, message: "Invalid request body." }, 400);
  }

  // Honeypot: bots often fill hidden website fields. Return success without storing anything.
  if (clean(body.website, 200)) {
    return respond(req, { data: { accepted: true } });
  }

  const customerName = clean(body.customerName, 120);
  const customerEmail = clean(body.customerEmail, 200).toLowerCase();
  const customerPhone = clean(body.customerPhone, 60);
  const businessName = clean(body.businessName, 160);
  const orderType = clean(body.orderType, 60);
  const garmentType = clean(body.garmentType, 100);
  const quantity = Math.max(0, Math.trunc(Number(body.quantity) || 0));
  const artworkReady = body.artworkReady === true;
  const deadline = clean(body.deadline, 20) || null;
  const budgetRange = clean(body.budgetRange, 40);
  const preferredContact = clean(body.preferredContact, 20) || "email";
  const notes = clean(body.notes, 3000);
  const source = clean(body.source, 80) || "custom_orders_page";
  const utmSource = clean(body.utmSource, 120);
  const utmMedium = clean(body.utmMedium, 120);
  const utmCampaign = clean(body.utmCampaign, 160);
  const referrer = clean(body.referrer, 500);

  const allowedOrderTypes = new Set(["custom_apparel", "bulk_apparel", "dtf_transfers", "team_event", "other"]);
  const allowedContacts = new Set(["email", "phone", "text"]);
  const allowedBudgets = new Set(["", "under_250", "250_499", "500_999", "1000_2499", "2500_plus"]);

  if (customerName.length < 2) return respond(req, { error: true, message: "Please enter your name." }, 400);
  if (!isEmail(customerEmail)) return respond(req, { error: true, message: "Please enter a valid email address." }, 400);
  if (!allowedOrderTypes.has(orderType)) return respond(req, { error: true, message: "Please choose what you need." }, 400);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return respond(req, { error: true, message: "Please enter a valid quantity." }, 400);
  if (!allowedContacts.has(preferredContact)) return respond(req, { error: true, message: "Please choose a preferred contact method." }, 400);
  if (!allowedBudgets.has(budgetRange)) return respond(req, { error: true, message: "Please choose a valid budget range." }, 400);
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return respond(req, { error: true, message: "Please choose a valid deadline." }, 400);

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const rateKey = await sha256Hex(`sales-lead:ip:${clientIp(req)}`);
    const { data: rateLimit, error: rateError } = await service.rpc("consume_checkout_rate_limit", {
      p_key: rateKey,
      p_limit: 5,
      p_window_seconds: 900,
    });
    if (rateError) throw rateError;
    if (!rateLimit?.allowed) {
      const retryAfter = Math.max(1, Number(rateLimit?.retry_after || 60));
      return respond(
        req,
        { error: true, message: "Too many quote requests. Please wait a few minutes and try again." },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    // Prevent accidental double-submits from the same email/order type within five minutes.
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: existing, error: existingError } = await service
      .from("sales_leads")
      .select("id,lead_score,priority")
      .eq("customer_email", customerEmail)
      .eq("order_type", orderType)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return respond(req, {
        data: {
          accepted: true,
          id: existing.id,
          leadScore: existing.lead_score,
          priority: existing.priority,
          duplicate: true,
        },
      });
    }

    const { score, priority } = scoreLead({
      quantity,
      artworkReady,
      deadline,
      budgetRange,
      orderType,
      businessName,
      phone: customerPhone,
    });

    const { data, error } = await service
      .from("sales_leads")
      .insert({
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        business_name: businessName || null,
        order_type: orderType,
        garment_type: garmentType || null,
        quantity,
        artwork_ready: artworkReady,
        deadline,
        budget_range: budgetRange || null,
        preferred_contact: preferredContact,
        notes: notes || null,
        source,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        referrer: referrer || null,
        lead_score: score,
        priority,
        status: "new",
      })
      .select("id,lead_score,priority")
      .single();
    if (error) throw error;

    return respond(req, {
      data: {
        accepted: true,
        id: data.id,
        leadScore: data.lead_score,
        priority: data.priority,
      },
    });
  } catch (error) {
    console.error("submit-sales-lead error", error);
    return respond(req, { error: true, message: "We could not submit your request right now. Please try again." }, 500);
  }
});