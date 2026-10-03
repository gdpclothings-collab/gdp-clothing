import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const allowedOrigins = new Set([
  "https://gdp-clothing.pages.dev",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
]);
const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function requestOrigin(req: Request) {
  return req.headers.get("origin") || "";
}

function isAllowedOrigin(origin: string) {
  return !origin || allowedOrigins.has(origin) || localOriginPattern.test(origin);
}

function headers(req: Request) {
  const origin = requestOrigin(req);
  return {
    ...(origin && isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function bearer(req: Request) {
  return (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
}

function readJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1] || "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (!isAllowedOrigin(requestOrigin(req))) {
    return respond(req, { error: true, message: "Origin not allowed." }, 403);
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = bearer(req);

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond(req, { error: true, message: "Service is not configured." }, 500);
  }
  if (!token) return respond(req, { error: true, message: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData?.user || null;
  if (userError || !user) return respond(req, { error: true, message: "Authentication required." }, 401);

  // The token is verified above. Business intelligence is admin-only data and
  // must not be exposed to an AAL1 session even when that session has admin role.
  if (readJwtPayload(token).aal !== "aal2") {
    return respond(req, { error: true, message: "MFA verification required." }, 403);
  }

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return respond(req, { error: true, message: "Could not verify admin access." }, 500);
  if (profile?.role !== "admin") return respond(req, { error: true, message: "Admin access required." }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  const action = typeof body.action === "string" ? body.action : "summary";
  if (!["summary", "briefing"].includes(action)) {
    return respond(req, { error: true, message: "Read-only gateway supports summary and briefing only." }, 400);
  }

  const [orders, products, variants, inventory, leads, tickets] = await Promise.all([
    service.from("orders").select("status,payment_status,fulfillment_status,total,created_at"),
    service.from("products").select("id,status,track_inventory"),
    service.from("product_variants").select("id,active,stock"),
    service.from("inventory_levels").select("available,committed,incoming"),
    service.from("sales_leads").select("status,priority,created_at"),
    service.from("support_tickets").select("status,priority,created_at"),
  ]);

  const results = [orders, products, variants, inventory, leads, tickets];
  const failures = results.filter((result) => result.error).map((result) => result.error?.message);
  if (failures.length) {
    return respond(req, { error: true, message: "One or more read-only queries failed.", details: failures }, 500);
  }

  const orderRows = orders.data || [];
  const inventoryRows = inventory.data || [];
  const now = Date.now();
  const daysAgo = (days: number) => now - days * 86400000;
  const paid = orderRows.filter((row: any) => row.payment_status === "paid");
  const failed = orderRows.filter((row: any) => row.payment_status === "failed");
  const recent = orderRows.filter((row: any) => new Date(row.created_at).getTime() >= daysAgo(7));
  const previous = orderRows.filter((row: any) => {
    const created = new Date(row.created_at).getTime();
    return created >= daysAgo(14) && created < daysAgo(7);
  });
  const outOfStock = inventoryRows.filter((row: any) => Number(row.available || 0) <= 0).length;
  const lowStock = inventoryRows.filter((row: any) => Number(row.available || 0) > 0 && Number(row.available || 0) <= 5).length;

  const summary = {
    orders: orderRows.length,
    paidOrders: paid.length,
    failedPayments: failed.length,
    totalRevenueRecorded: orderRows.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0),
    paidRevenueRecorded: paid.reduce((sum: number, row: any) => sum + Number(row.total || 0), 0),
    products: (products.data || []).length,
    variants: (variants.data || []).length,
    inventoryLocations: inventoryRows.length,
    inventoryAvailable: inventoryRows.reduce((sum: number, row: any) => sum + Number(row.available || 0), 0),
    inventoryCommitted: inventoryRows.reduce((sum: number, row: any) => sum + Number(row.committed || 0), 0),
    outOfStockLocations: outOfStock,
    lowStockLocations: lowStock,
    salesLeads: (leads.data || []).length,
    supportTickets: (tickets.data || []).length,
  };

  const priorities: Array<Record<string, unknown>> = [];
  if (failed.length) {
    priorities.push({ severity: "high", title: "Review failed payment records", detail: `${failed.length} order record(s) show failed payment. No automatic retry or payment action will be taken.` });
  }
  if (outOfStock) {
    priorities.push({ severity: "medium", title: "Review zero-stock locations", detail: `${outOfStock} inventory location record(s) have zero available units.` });
  }
  if (lowStock) {
    priorities.push({ severity: "medium", title: "Review low-stock locations", detail: `${lowStock} inventory location record(s) have 1–5 units available.` });
  }
  if (!(leads.data || []).length) {
    priorities.push({ severity: "info", title: "Sales pipeline is empty", detail: "No sales leads are currently recorded. Consider adding or importing qualified prospects." });
  }
  if (!(tickets.data || []).length) {
    priorities.push({ severity: "info", title: "No open support workload recorded", detail: "No support tickets are currently recorded in the support ticket table." });
  }

  const data = {
    generatedAt: new Date().toISOString(),
    mode: "read-only",
    capabilities: ["business-summary", "daily-briefing", "attention-priorities", "7-day-order-trend"],
    restrictions: ["no inserts", "no updates", "no deletes", "no refunds", "no emails", "no deployments"],
    summary,
    briefing: {
      headline: priorities.length
        ? `${priorities.filter((item: any) => item.severity === "high").length} high-priority and ${priorities.filter((item: any) => item.severity === "medium").length} medium-priority item(s) detected.`
        : "No summary-level attention items detected.",
      priorities,
      trend: {
        ordersLast7Days: recent.length,
        ordersPrevious7Days: previous.length,
        paidOrdersLast7Days: recent.filter((row: any) => row.payment_status === "paid").length,
      },
    },
    meta: { adminOnly: true, containsCustomerPII: false, phase: "1.1", deterministic: true },
  };

  return respond(req, { data });
});
