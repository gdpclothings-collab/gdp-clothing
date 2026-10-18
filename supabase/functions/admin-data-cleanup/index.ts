import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import {
  CLEANUP_BUCKETS, MAX_BATCH, allowAccount, allowFile, allowOrder,
  isReferencedByText, selectedTargets, validStoragePath,
} from "./policy.mjs";

const origins = new Set([
  "https://gdpclothing.ca", "https://www.gdpclothing.ca",
  "https://gdp-clothing.pages.dev",
]);
const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const referenceTables = [
  "orders", "order_items", "custom_designs", "design_proofs", "products",
  "product_variants", "artwork_library", "content_pages", "store_settings",
  "gdp_invoices",
];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = origins.has(origin) || localOrigin.test(origin);
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function reply(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors(req) });
}
function getBearer(req: Request) {
  return (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
}
function tokenClaims(token: string): Record<string, unknown> {
  try {
    const s = token.split(".")[1] || "";
    return JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return {}; }
}
function required<T>(result: { data: T; error: any }): T {
  if (result.error) throw new Error("Protected data read failed.");
  return result.data;
}
async function logAction(service: any, actor: string, operation: string, target: string, outcome: string, detail = "") {
  const { error } = await service.from("admin_cleanup_audit_log").insert({
    actor_user_id: actor, operation, target_ref: target.slice(0, 900),
    outcome, detail: detail.slice(0, 180),
  });
  if (error) throw new Error("Audit writing failed. Cleanup halted.");
}

// Always enumerate through the Storage API, not DELETE on storage.objects.
// Folder depth, total number of entries, and pagination are bounded.
async function listBucket(service: any, bucket: string) {
  const results: any[] = [];
  let folders = [""];
  let visited = 0;
  while (folders.length) {
    const folder = folders.shift()!;
    if (++visited > 80) throw new Error("Too many storage folders. Narrow the cleanup scope.");
    for (let offset = 0; offset < 2000; offset += 1000) {
      const { data, error } = await service.storage.from(bucket).list(folder, {
        limit: 1000, offset, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error("Storage listing unavailable.");
      const rows = data || [];
      for (const file of rows) {
        const path = folder ? folder + "/" + file.name : file.name;
        if (!validStoragePath(path)) continue;
        if (file.id && file.metadata) {
          results.push({
            path, created_at: file.created_at, updated_at: file.updated_at,
            bytes: Number(file.metadata?.size || 0),
          });
        } else {
          folders.push(path);
        }
        if (results.length > 2000) throw new Error("Too many files. Use the Supabase Storage management page.");
      }
      if (rows.length < 1000) break;
      if (offset >= 1000) throw new Error("Too many files in a single folder.");
    }
  }
  return results;
}

async function referencedData(service: any) {
  const pieces: string[] = [];
  for (const table of referenceTables) {
    for (let from = 0; from < 5000; from += 1000) {
      const rows = required<any[]>(await service.from(table).select("*").range(from, from + 999));
      pieces.push(JSON.stringify(rows || []));
      if (!rows || rows.length < 1000) break;
      if (from >= 4000) throw new Error("Reference scan exceeded safety limit.");
    }
  }
  return pieces.join("\n");
}

async function listAccounts(service: any, actorId: string) {
  const users: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error("Account directory unavailable.");
    users.push(...(data?.users || []));
    if ((data?.users || []).length < 100) break;
    if (page === 10) throw new Error("Account list exceeded safety limit.");
  }
  const ids = users.map((u) => u.id);
  const { data: profiles, error: profileError } = ids.length
    ? await service.from("profiles").select("id, role").in("id", ids)
    : { data: [], error: null };
  if (profileError) throw new Error("Account roles could not be checked.");
  const roles = new Map((profiles || []).map((r: any) => [r.id, r.role]));
  return users.map((u) => ({
    id: u.id, email: u.email || "", role: roles.get(u.id) || "unknown",
    created_at: u.created_at,
    eligible: allowAccount(u, roles.get(u.id), actorId),
  }));
}

async function accountDependencies(service: any, user: any) {
  const owned = Number(required(await service.rpc("admin_cleanup_owned_storage_count", { p_user_id: user.id })) || 0);
  let linked = 0;
  for (const table of ["orders", "checkout_sessions", "custom_designs", "dtf_export_audit_log", "ai_credit_ledger"]) {
    const { count, error } = await service.from(table).select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if (error) throw new Error("Account dependency check failed.");
    linked += count || 0;
  }
  if (user.email) {
    for (const table of ["orders", "checkout_sessions"]) {
      const { count, error } = await service.from(table).select("id", { count: "exact", head: true }).ilike("customer_email", user.email);
      if (error) throw new Error("Account commerce check failed.");
      linked += count || 0;
    }
  }
  return { owned, linked };
}

async function assertAdmin(service: any, url: string, anon: string, token: string) {
  if (!token) throw new Error("AUTH_REQUIRED");
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData?.user) throw new Error("AUTH_REQUIRED");
  // Token is verified by getUser; AAL2 is additionally checked by DB RPC.
  if (tokenClaims(token).aal !== "aal2") throw new Error("MFA_REQUIRED");
  const { data: stepUp, error: stepError } = await userClient.rpc("is_admin_step_up_authorized");
  if (stepError || stepUp !== true) throw new Error("MFA_REQUIRED");
  const profile = required<any>(await service.from("profiles").select("role").eq("id", authData.user.id).maybeSingle());
  if (profile?.role !== "admin") throw new Error("ADMIN_REQUIRED");
  return authData.user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !origins.has(origin) && !localOrigin.test(origin)) return reply(req, { error: "Origin blocked" }, 403);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !anon || !key) return reply(req, { error: "Service unavailable" }, 503);
  const service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let actor;
  try { actor = await assertAdmin(service, url, anon, getBearer(req)); }
  catch (error) {
    const reason = error instanceof Error ? error.message : "";
    return reply(req, { error: "Authenticated admin with verified MFA required" },
      reason === "AUTH_REQUIRED" ? 401 : 403);
  }
  try {
    const raw = await req.text();
    if (raw.length > 12000) return reply(req, { error: "Request too large" }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(req, { error: "Invalid request" }, 400);
    const action = String(body.action || "");
    if (action === "preview_files") {
      const bucket = String(body.bucket || "");
      if (!CLEANUP_BUCKETS.includes(bucket)) return reply(req, { error: "Bucket is protected" }, 400);
      const [all, linked] = await Promise.all([listBucket(service, bucket), referencedData(service)]);
      return reply(req, { data: {
        bucket, total: all.length,
        files: all.map((f) => ({
          ...f,
          eligible: allowFile(bucket, f.path, f.created_at) && !isReferencedByText(f.path, linked),
          reason: !allowFile(bucket, f.path, f.created_at) ? "Recent or invalid path" :
            isReferencedByText(f.path, linked) ? "Referenced by store data" : "",
        })),
      } });
    }
    if (action === "preview_orders") {
      const orders = required<any[]>(await service.from("orders")
        .select("id,order_number,payment_mode,payment_status,status,fulfillment_status,stripe_payment_intent_id,stripe_checkout_session_id,created_at")
        .order("created_at", { ascending: false }).limit(300));
      return reply(req, { data: { orders: orders.map((o) => ({
        id: o.id, order_number: o.order_number, payment_mode: o.payment_mode,
        status: o.status, payment_status: o.payment_status, created_at: o.created_at,
        eligible: allowOrder(o),
      })) } });
    }
    if (action === "preview_accounts") {
      const accounts = await listAccounts(service, actor.id);
      const decorated = await Promise.all(accounts.map(async (u) => ({
        ...u, ...(u.eligible ? await accountDependencies(service, u) : { owned: 0, linked: 0 }),
      })));
      return reply(req, { data: { accounts: decorated } });
    }
    if (action === "history") {
      const events = required<any[]>(await service.from("admin_cleanup_audit_log")
        .select("id,operation,target_ref,outcome,detail,created_at")
        .order("created_at", { ascending: false }).limit(50));
      return reply(req, { data: { events } });
    }
    if (action === "delete_files") {
      const bucket = String(body.bucket || "");
      const paths = selectedTargets(body.paths);
      if (!paths || !CLEANUP_BUCKETS.includes(bucket) || body.confirm !== "DELETE FILES" ||
          !paths.every(validStoragePath)) return reply(req, { error: "Invalid file deletion request" }, 400);
      const [all, linked] = await Promise.all([listBucket(service, bucket), referencedData(service)]);
      for (const path of paths) {
        const file = all.find((f) => f.path === path);
        if (!file || !allowFile(bucket, path, file.created_at) || isReferencedByText(path, linked)) {
          return reply(req, { error: "One or more files are protected or no longer eligible. Refresh preview." }, 409);
        }
      }
      const deleted: string[] = [];
      for (const path of paths) {
        // Storage SDK removal prevents orphaned storage objects.
        const result = await service.storage.from(bucket).remove([path]);
        if (result.error) {
          await logAction(service, actor.id, "file_delete", bucket + "/" + path, "failed", "Storage API rejected deletion");
          return reply(req, { error: "File cleanup partly completed. Refresh before continuing.", data: { deleted } }, 409);
        }
        await logAction(service, actor.id, "file_delete", bucket + "/" + path, "success");
        deleted.push(path);
      }
      return reply(req, { data: { deleted } });
    }
    if (action === "delete_orders") {
      const ids = selectedTargets(body.ids);
      if (!ids || body.confirm !== "DELETE ORDERS" || !ids.every((id) => uuidPattern.test(id)))
        return reply(req, { error: "Invalid order deletion request" }, 400);
      const orders = required<any[]>(await service.from("orders")
        .select("id,payment_mode,payment_status,status,fulfillment_status,stripe_payment_intent_id,stripe_checkout_session_id")
        .in("id", ids));
      if (orders.length !== ids.length || orders.some((o) => !allowOrder(o)))
        return reply(req, { error: "A protected or missing order was selected. Refresh preview." }, 409);
      const deleted: string[] = [];
      for (const id of ids) {
        const result = await service.rpc("admin_cleanup_delete_test_order", { p_order_id: id });
        if (result.error) {
          await logAction(service, actor.id, "order_delete", id, "failed", "Transactional guard rejected deletion");
          return reply(req, { error: "Order cleanup partly completed. Refresh before continuing.", data: { deleted } }, 409);
        }
        await logAction(service, actor.id, "order_delete", id, "success");
        deleted.push(id);
      }
      return reply(req, { data: { deleted } });
    }
    if (action === "delete_account") {
      const id = String(body.id || "");
      if (!uuidPattern.test(id) || body.confirm !== "DELETE ACCOUNT") return reply(req, { error: "Invalid account deletion request" }, 400);
      const users = await listAccounts(service, actor.id);
      const user = users.find((u) => u.id === id);
      if (!user || !user.eligible || body.email !== user.email)
        return reply(req, { error: "Protected account. Admin accounts cannot be deleted here." }, 409);
      const dependency = await accountDependencies(service, user);
      if (dependency.owned || dependency.linked)
        return reply(req, { error: "Account still owns files or linked records. Remove those safely first." }, 409);
      const { error } = await service.auth.admin.deleteUser(id);
      if (error) {
        await logAction(service, actor.id, "account_delete", id, "failed", "Auth API rejected deletion");
        return reply(req, { error: "Auth account deletion rejected; check user dependencies." }, 409);
      }
      await logAction(service, actor.id, "account_delete", id, "success");
      return reply(req, { data: { deleted: [id] } });
    }
    return reply(req, { error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("admin-data-cleanup:", error instanceof Error ? error.message : "unexpected error");
    return reply(req, { error: "Cleanup request failed safely. Refresh the preview and retry." }, 500);
  }
});