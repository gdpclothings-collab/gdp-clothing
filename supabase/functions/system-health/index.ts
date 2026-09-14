import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const allowedOrigins = new Set([
  "https://gdp-clothing.pages.dev",
  "https://gdpclothing.ca",
  "https://www.gdpclothing.ca",
]);
const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

type HealthStatus = "healthy" | "warning" | "critical" | "unknown";
type HealthCheck = {
  key: string;
  category: string;
  label: string;
  status: HealthStatus;
  summary: string;
  details?: string;
  metric?: string | number | null;
  updatedAt?: string | null;
};

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

async function timedFetch(url: string, init: RequestInit = {}) {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "GDP-Clothing-System-Health/1.0",
        ...(init.headers || {}),
      },
    });
    return {
      ok: response.ok,
      status: response.status,
      response,
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      response: null,
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}

function scoreFor(checks: HealthCheck[]) {
  return Math.max(0, checks.reduce((score, check) => {
    if (check.status === "critical") return score - 20;
    if (check.status === "warning") return score - (check.key === "maintenance" ? 2 : 6);
    if (check.status === "unknown") return score - 2;
    return score;
  }, 100));
}

function overallFor(checks: HealthCheck[]): HealthStatus {
  if (checks.some((check) => check.status === "critical")) return "critical";
  if (checks.some((check) => check.status === "warning")) return "warning";
  if (checks.some((check) => check.status === "unknown")) return "unknown";
  return "healthy";
}

function workflowStatus(run: any): HealthStatus {
  if (!run) return "unknown";
  if (run.status !== "completed") return "warning";
  return run.conclusion === "success" ? "healthy" : "critical";
}

Deno.serve(async (req: Request) => {
  const origin = requestOrigin(req);
  if (!isAllowedOrigin(origin)) return respond(req, { error: true, message: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: true, message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = bearer(req);

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return respond(req, { error: true, message: "System health service is not configured." }, 500);
  }
  if (!token) return respond(req, { error: true, message: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData?.user || null;
  if (userError || !user) return respond(req, { error: true, message: "Authentication required." }, 401);

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return respond(req, { error: true, message: "Could not verify admin access." }, 500);
  if (profile?.role !== "admin") return respond(req, { error: true, message: "Admin access required." }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  if (body.action && body.action !== "snapshot") {
    return respond(req, { error: true, message: "Unsupported health action." }, 400);
  }

  const checkedAt = new Date().toISOString();
  const now = Date.now();
  const checks: HealthCheck[] = [];
  const incidents: Array<Record<string, unknown>> = [];

  const settingsResult = await service
    .from("store_settings")
    .select("payment_mode,test_inventory_workflow,maintenance_settings,updated_at")
    .eq("id", 1)
    .maybeSingle();
  const settings = settingsResult.data || null;

  checks.push({
    key: "database",
    category: "Supabase",
    label: "Database",
    status: settingsResult.error ? "critical" : "healthy",
    summary: settingsResult.error ? "Database health query failed." : "Database is responding normally.",
    details: settingsResult.error?.message || "Store settings and operational tables are reachable.",
    updatedAt: settings?.updated_at || checkedAt,
  });

  const maintenanceEnabled = Boolean(settings?.maintenance_settings?.enabled);
  checks.push({
    key: "maintenance",
    category: "Website",
    label: "Maintenance mode",
    status: maintenanceEnabled ? "warning" : "healthy",
    summary: maintenanceEnabled ? "Storefront maintenance mode is ON." : "Storefront is open to customers.",
    details: maintenanceEnabled
      ? "Intentional maintenance is treated as a warning, not a production outage."
      : "Customers can browse and use the storefront normally.",
    metric: maintenanceEnabled ? "ON" : "OFF",
    updatedAt: settings?.updated_at || checkedAt,
  });

  const [apex, www, pagesOrigin] = await Promise.all([
    timedFetch("https://gdpclothing.ca/", { redirect: "manual" }),
    timedFetch("https://www.gdpclothing.ca/", { redirect: "manual" }),
    timedFetch("https://gdp-clothing.pages.dev/", { redirect: "manual" }),
  ]);

  checks.push({
    key: "storefront",
    category: "Website",
    label: "gdpclothing.ca",
    status: apex.status >= 200 && apex.status < 400 ? "healthy" : "critical",
    summary: apex.status >= 200 && apex.status < 400
      ? `Storefront responded in ${apex.latencyMs} ms.`
      : `Storefront returned HTTP ${apex.status || "network error"}.`,
    details: apex.error || "Primary customer domain is reachable through Cloudflare.",
    metric: apex.status || "ERR",
    updatedAt: checkedAt,
  });

  const wwwLocation = www.response?.headers.get("location") || "";
  const wwwRedirectOk = [301, 302, 307, 308].includes(www.status)
    && /^https?:\/\/gdpclothing\.ca(?:\/|$)/i.test(wwwLocation);
  checks.push({
    key: "www-redirect",
    category: "Website",
    label: "WWW redirect",
    status: wwwRedirectOk ? "healthy" : "critical",
    summary: wwwRedirectOk
      ? "www.gdpclothing.ca redirects to the canonical domain."
      : `WWW returned HTTP ${www.status || "network error"} instead of the expected redirect.`,
    details: wwwRedirectOk ? wwwLocation : (www.error || "Check Cloudflare DNS proxy and Redirect Rules."),
    metric: www.status || "ERR",
    updatedAt: checkedAt,
  });

  checks.push({
    key: "pages-origin",
    category: "Deployment",
    label: "Cloudflare Pages origin",
    status: pagesOrigin.status >= 200 && pagesOrigin.status < 400 ? "healthy" : "warning",
    summary: pagesOrigin.status >= 200 && pagesOrigin.status < 400
      ? `Pages origin responded in ${pagesOrigin.latencyMs} ms.`
      : `Pages origin returned HTTP ${pagesOrigin.status || "network error"}.`,
    details: pagesOrigin.error || "Cloudflare Pages deployment origin is reachable.",
    metric: pagesOrigin.status || "ERR",
    updatedAt: checkedAt,
  });

  const paymentMode = settings?.payment_mode === "test" ? "test" : "live";
  const stripeSecretName = paymentMode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY";
  const stripePublishableName = paymentMode === "test" ? "STRIPE_TEST_PUBLISHABLE_KEY" : "STRIPE_PUBLISHABLE_KEY";
  const stripeSecret = Deno.env.get(stripeSecretName) || "";
  const stripePublishable = Deno.env.get(stripePublishableName) || "";

  if (!stripeSecret || !stripePublishable) {
    checks.push({
      key: "stripe",
      category: "Payments",
      label: "Stripe",
      status: "critical",
      summary: `Stripe ${paymentMode} credentials are incomplete.`,
      details: `Missing ${!stripeSecret ? stripeSecretName : stripePublishableName}.`,
      metric: paymentMode.toUpperCase(),
      updatedAt: checkedAt,
    });
  } else {
    const stripe = await timedFetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${stripeSecret}` },
    });
    let account: any = null;
    if (stripe.response) {
      try { account = await stripe.response.json(); } catch { account = null; }
    }
    const connected = stripe.ok && !account?.error;
    const chargesEnabled = account?.charges_enabled !== false;
    checks.push({
      key: "stripe",
      category: "Payments",
      label: "Stripe",
      status: connected && (paymentMode === "test" || chargesEnabled) ? "healthy" : connected ? "warning" : "critical",
      summary: connected
        ? `Stripe ${paymentMode} mode is connected${chargesEnabled ? " and charges are enabled" : ""}.`
        : `Stripe ${paymentMode} API connectivity failed.`,
      details: account?.error?.message || stripe.error || "Credentials remain server-side and are never returned to the browser.",
      metric: paymentMode.toUpperCase(),
      updatedAt: checkedAt,
    });
  }

  const [checkoutResult, reservationResult, designResult, incidentResult] = await Promise.all([
    service.from("checkout_sessions").select("status,expires_at,processing_started_at,last_activity_at"),
    service.from("order_inventory_reservations").select("status,expires_at,quantity,created_at"),
    service.from("custom_designs").select("render_status,status,updated_at"),
    service.from("security_incidents")
      .select("id,title,severity,status,detected_at,affected_systems")
      .order("detected_at", { ascending: false })
      .limit(20),
  ]);

  if (checkoutResult.error) {
    checks.push({ key: "checkout", category: "Commerce", label: "Checkout sessions", status: "critical", summary: "Checkout health query failed.", details: checkoutResult.error.message, updatedAt: checkedAt });
  } else {
    const rows = checkoutResult.data || [];
    const stuck = rows.filter((row: any) => row.status === "processing" && row.processing_started_at && now - new Date(row.processing_started_at).getTime() > 15 * 60 * 1000).length;
    const overdue = rows.filter((row: any) => ["active", "processing"].includes(row.status) && row.expires_at && new Date(row.expires_at).getTime() < now).length;
    checks.push({
      key: "checkout",
      category: "Commerce",
      label: "Checkout sessions",
      status: stuck ? "critical" : overdue ? "warning" : "healthy",
      summary: stuck
        ? `${stuck} checkout session(s) appear stuck in processing.`
        : overdue
          ? `${overdue} active checkout session(s) are past expiry.`
          : "No stuck or overdue checkout sessions detected.",
      details: `${rows.length} tracked sessions · stuck ${stuck} · overdue ${overdue}`,
      metric: stuck || overdue || 0,
      updatedAt: checkedAt,
    });
  }

  if (reservationResult.error) {
    checks.push({ key: "inventory", category: "Commerce", label: "Inventory reservations", status: "critical", summary: "Inventory reservation health query failed.", details: reservationResult.error.message, updatedAt: checkedAt });
  } else {
    const rows = reservationResult.data || [];
    const active = rows.filter((row: any) => row.status === "active");
    const expiredActive = active.filter((row: any) => row.expires_at && new Date(row.expires_at).getTime() < now);
    const reservedUnits = active.reduce((sum: number, row: any) => sum + Number(row.quantity || 0), 0);
    checks.push({
      key: "inventory",
      category: "Commerce",
      label: "Inventory reservations",
      status: expiredActive.length ? "warning" : "healthy",
      summary: expiredActive.length
        ? `${expiredActive.length} expired reservation(s) are still marked active.`
        : "Inventory reservations are within their active windows.",
      details: `${active.length} active reservation(s) holding ${reservedUnits} unit(s). Inventory availability is intentionally reduced when stock is committed.`,
      metric: expiredActive.length,
      updatedAt: checkedAt,
    });
  }

  if (designResult.error) {
    checks.push({ key: "custom-studio", category: "Custom Studio", label: "Render pipeline", status: "warning", summary: "Custom Studio health query failed.", details: designResult.error.message, updatedAt: checkedAt });
  } else {
    const rows = designResult.data || [];
    const failed = rows.filter((row: any) => row.render_status === "failed").length;
    const stale = rows.filter((row: any) => row.render_status === "rendering" && row.updated_at && now - new Date(row.updated_at).getTime() > 20 * 60 * 1000).length;
    checks.push({
      key: "custom-studio",
      category: "Custom Studio",
      label: "Render pipeline",
      status: failed || stale ? "warning" : "healthy",
      summary: failed || stale
        ? `${failed} failed render(s), ${stale} stale rendering job(s).`
        : "No failed or stale Custom Studio renders detected.",
      details: `${rows.length} saved custom designs checked.`,
      metric: failed + stale,
      updatedAt: checkedAt,
    });
  }

  const activeIncidents = (incidentResult.data || []).filter((row: any) => !["resolved", "closed"].includes(row.status));
  const severeIncidents = activeIncidents.filter((row: any) => ["critical", "high"].includes(row.severity));
  const mediumIncidents = activeIncidents.filter((row: any) => row.severity === "medium");
  checks.push({
    key: "security-incidents",
    category: "Security",
    label: "Open incidents",
    status: incidentResult.error ? "unknown" : severeIncidents.length ? "critical" : mediumIncidents.length ? "warning" : "healthy",
    summary: incidentResult.error
      ? "Could not read security incident status."
      : activeIncidents.length
        ? `${activeIncidents.length} open security incident(s).`
        : "No open security incidents recorded.",
    details: incidentResult.error?.message || `${severeIncidents.length} high/critical · ${mediumIncidents.length} medium`,
    metric: activeIncidents.length,
    updatedAt: activeIncidents[0]?.detected_at || checkedAt,
  });

  for (const row of activeIncidents.slice(0, 5)) {
    incidents.push({
      type: "security",
      title: row.title,
      severity: row.severity,
      status: row.status,
      detectedAt: row.detected_at,
      affectedSystems: row.affected_systems || [],
    });
  }

  const github = await timedFetch(
    "https://api.github.com/repos/gdpclothings-collab/gdp-clothing/actions/runs?branch=main&per_page=30",
    { headers: { Accept: "application/vnd.github+json" } },
  );
  let workflowRuns: any[] = [];
  if (github.response) {
    try {
      const payload = await github.response.json();
      workflowRuns = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
    } catch { workflowRuns = []; }
  }

  const names = [
    "GDP Clothing Build Verification",
    "GDP Clothing Security Scan",
    "GDP Clothing Quality Audit",
    "GDP Clothing Production Smoke Bot",
  ];
  const latest = names.map((name) => workflowRuns.find((run: any) => run.name === name) || null);
  const states = latest.map(workflowStatus);
  const ciStatus: HealthStatus = !github.ok
    ? "unknown"
    : states.includes("critical")
      ? "critical"
      : states.includes("warning") || states.includes("unknown")
        ? "warning"
        : "healthy";

  checks.push({
    key: "github-ci",
    category: "Deployment",
    label: "GitHub production checks",
    status: ciStatus,
    summary: !github.ok
      ? "GitHub Actions status is temporarily unavailable."
      : ciStatus === "healthy"
        ? "Build, security, quality and production smoke checks are passing."
        : ciStatus === "critical"
          ? "One or more production checks failed."
          : "One or more production checks are running or unavailable.",
    details: github.error || latest.map((run, i) => `${names[i].replace("GDP Clothing ", "")}: ${run?.conclusion || run?.status || "unknown"}`).join(" · "),
    metric: ciStatus === "healthy" ? "PASS" : ciStatus.toUpperCase(),
    updatedAt: latest.find(Boolean)?.updated_at || checkedAt,
  });

  for (const run of latest) {
    if (run?.status === "completed" && run?.conclusion && run.conclusion !== "success") {
      incidents.push({
        type: "ci",
        title: `${run.name} ${run.conclusion}`,
        severity: "high",
        status: run.conclusion,
        detectedAt: run.updated_at,
        url: run.html_url,
      });
    }
  }

  return respond(req, {
    data: {
      checkedAt,
      score: scoreFor(checks),
      status: overallFor(checks),
      maintenanceEnabled,
      paymentMode,
      checks,
      incidents: incidents
        .sort((a: any, b: any) => new Date(b.detectedAt || 0).getTime() - new Date(a.detectedAt || 0).getTime())
        .slice(0, 10),
      meta: { source: "live", adminOnly: true, refreshRecommendedSeconds: 60 },
    },
  });
});
