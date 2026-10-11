import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

// Read-only, server-to-server lead export. Never receives payment data.
// Fail closed until GDP_GROWTH_SYNC_SECRET is configured on the Supabase project.
function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function matchesSecret(provided: string, expected: string): boolean {
  // Fixed-work comparison for equally-sized strings; short values are rejected.
  if (expected.length < 32 || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("GDP_GROWTH_SYNC_SECRET") || "";
  if (!secret || secret.length < 32) return response({ error: "Integration not configured" }, 503);
  if (!matchesSecret(req.headers.get("x-gdp-growth-secret") || "", secret)) {
    return response({ error: "Unauthorized" }, 401);
  }

  let payload: { since?: string; offset?: number; limit?: number };
  try { payload = await req.json(); }
  catch { return response({ error: "Invalid JSON" }, 400); }
  const since = typeof payload?.since === "string" ? payload.since : "";
  const sinceDate = new Date(since);
  if (!since || Number.isNaN(sinceDate.getTime()) || sinceDate.toISOString() !== since) {
    return response({ error: "Invalid since timestamp" }, 400);
  }
  const offset = Number(payload.offset ?? 0);
  const limit = Number(payload.limit ?? 100);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000 ||
      !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return response({ error: "Invalid pagination" }, 400);
  }
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return response({ error: "Server not configured" }, 503);
  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await db
      .from("sales_leads")
      .select("id,customer_name,customer_email,customer_phone,business_name,order_type,garment_type,quantity,artwork_ready,deadline,budget_range,preferred_contact,notes,source,utm_source,utm_medium,utm_campaign,referrer,lead_score,priority,status,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return response({ leads: data || [], count: (data || []).length, has_more: (data || []).length === limit });
  } catch (_error) {
    // Never echo internal database errors or customer fields.
    return response({ error: "Export unavailable" }, 503);
  }
});
