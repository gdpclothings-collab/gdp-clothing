import React, { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Database, FileImage, RefreshCw, ShieldCheck, Trash2, Users, History } from "lucide-react";
import { adminDataCleanupApi } from "@/lib/adminDataCleanupApi";

const TABS = [
  { id: "files", title: "Uploads", icon: FileImage },
  { id: "orders", title: "Test orders", icon: Database },
  { id: "accounts", title: "Accounts", icon: Users },
  { id: "history", title: "History", icon: History },
];
const PAGE_SIZE = 20;

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-CA");
}
function bytes(size) {
  if (size == null) return "—";
  return (Number(size) / 1024 / 1024).toFixed(2) + " MB";
}
function fileLabel(path) {
  return path?.split("/").pop() || path;
}

export default function AdminDataCleanupModule() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("files");
  const [bucket, setBucket] = useState("customer-uploads");
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [accountConfirm, setAccountConfirm] = useState({});
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextTab = tab, nextBucket = bucket) => {
    setLoading(true);
    setPreview(null);
    setSelected([]);
    setConfirmText("");
    setError("");
    try {
      const result = nextTab === "files" ? await adminDataCleanupApi.previewFiles(nextBucket)
        : nextTab === "orders" ? await adminDataCleanupApi.previewOrders()
          : nextTab === "accounts" ? await adminDataCleanupApi.previewAccounts()
            : await adminDataCleanupApi.history();
      setPreview(result);
      setPage(1);
    } catch (err) {
      setError(err?.message || "Could not load cleanup preview.");
    } finally {
      setLoading(false);
    }
  }, [tab, bucket]);

  const switchTab = (value) => {
    setTab(value); setPreview(null); setSelected([]); setConfirmText("");
    setAccountConfirm({}); setPage(1); setError(""); setNotice("");
    void load(value, bucket);
  };
  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !preview) void load();
  };
  const changeBucket = (value) => {
    setBucket(value);
    setPreview(null); setSelected([]); setConfirmText("");
    void load("files", value);
  };
  const toggle = (id) => setSelected((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : current.length >= 10 ? current : [...current, id]);

  const perform = async () => {
    const isFile = tab === "files";
    const phrase = isFile ? "DELETE FILES" : "DELETE ORDERS";
    if (!selected.length || confirmText !== phrase || deleting) return;
    if (!window.confirm("Permanently delete " + selected.length + " selected " + (isFile ? "upload(s)" : "test order(s)") + "? This cannot be undone.")) return;
    setDeleting(true); setError(""); setNotice("");
    try {
      const result = isFile
        ? await adminDataCleanupApi.deleteFiles(bucket, selected)
        : await adminDataCleanupApi.deleteOrders(selected);
      setNotice((result?.deleted?.length || 0) + " record(s) deleted. Audit history updated.");
      await load();
    } catch (err) {
      setError(err?.message || "Cleanup failed safely.");
      await load().catch(() => {});
    } finally {
      setDeleting(false);
    }
  };

  const deleteAccount = async (item) => {
    if (accountConfirm[item.id] !== item.email || deleting) return;
    if (!window.confirm("Permanently delete registration " + item.email + "? Only the selected customer account is affected.")) return;
    setDeleting(true); setError(""); setNotice("");
    try {
      await adminDataCleanupApi.deleteAccount(item.id, item.email);
      setNotice("Customer registration removed. Other admin accounts were unchanged.");
      await load("accounts");
    } catch (err) {
      setError(err?.message || "Account deletion was safely rejected.");
    } finally {
      setDeleting(false);
      setAccountConfirm({});
    }
  };

  const files = preview?.files || [];
  const orders = preview?.orders || [];
  const accounts = preview?.accounts || [];
  const events = preview?.events || [];
  const rows = tab === "files" ? files : tab === "orders" ? orders : tab === "accounts" ? accounts : events;
  const displayed = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const candidates = tab === "files" ? files.filter((x) => x.eligible).length
    : tab === "orders" ? orders.filter((x) => x.eligible).length
      : tab === "accounts" ? accounts.filter((x) => x.eligible && !x.owned && !x.linked).length : 0;
  const phrase = tab === "files" ? "DELETE FILES" : "DELETE ORDERS";

  return (
    <section className="mb-6 min-w-0 overflow-hidden rounded-2xl border border-[#d7d7dc] bg-white shadow-sm" aria-label="Admin data cleanup">
      <button type="button" onClick={toggleOpen}
        aria-expanded={open} aria-controls="gdp-admin-data-cleanup-panel"
        className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-[#fafafa] sm:px-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><ShieldCheck size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#252525]">Data Cleanup</span>
          <span className="block text-xs leading-5 text-[#686868]">Preview and safely remove test orders, unused uploads or test registrations</span>
        </span>
        <span className="hidden rounded-full border bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 sm:inline-flex">Admin + MFA</span>
        <ChevronDown size={18} className={"shrink-0 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div id="gdp-admin-data-cleanup-panel" className="border-t p-3 sm:p-5">
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div><strong>Permanent deletion.</strong> No automatic cleanup runs when this page opens.
              Paid, refunded and completed orders, both admin accounts, catalog images and approved artwork are protected.
              Stripe historical transactions remain in Stripe. Every successful deletion is audited.</div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Cleanup categories">
            {TABS.map((item) => (
              <button type="button" role="tab" aria-selected={tab === item.id} key={item.id}
                onClick={() => switchTab(item.id)}
                className={"inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors " +
                (tab === item.id ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>
                <item.icon size={15}/>{item.title}
              </button>
            ))}
          </div>
          {tab === "files" && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="text-xs font-medium text-[#565656]" htmlFor="gdp-cleanup-bucket">Upload bucket</label>
              <select id="gdp-cleanup-bucket" value={bucket} onChange={(event) => changeBucket(event.target.value)}
                className="min-w-0 rounded-lg border border-[#d3d5da] bg-white px-3 py-2 text-sm">
                <option value="customer-uploads">Customer uploads</option>
                <option value="dtf-artwork">DTF artwork</option>
              </select>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-xs text-[#626262]">
              {loading ? "Checking access and dependencies…" : preview
                ? tab === "history" ? events.length + " recent audit entries"
                  : rows.length + " record(s) · " + candidates + " eligible"
                : "No preview available"}
            </div>
            <button type="button" onClick={() => load()} disabled={loading || deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""}/> Refresh preview
            </button>
          </div>
          {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
          {notice && <p role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><CheckCircle2 size={15}/>{notice}</p>}
          <div className="space-y-2" role="tabpanel">
            {!loading && preview && displayed.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-[#777]">No records in this category.</div>
            )}
            {tab === "files" && displayed.map((item) => (
              <label key={item.path} className={"flex min-w-0 items-start gap-3 rounded-xl border p-3 text-sm " +
                (item.eligible ? "hover:bg-slate-50" : "bg-slate-50 opacity-70")}>
                <input type="checkbox" className="mt-1 size-4 shrink-0 accent-slate-900"
                  aria-label={"Select " + item.path}
                  checked={selected.includes(item.path)} disabled={!item.eligible || deleting || (selected.length >= 10 && !selected.includes(item.path))}
                  onChange={() => toggle(item.path)} />
                <span className="min-w-0 flex-1">
                  <span className="block break-all font-semibold text-[#292929]">{fileLabel(item.path)}</span>
                  <span className="block break-all text-[11px] text-[#777]">{item.path}</span>
                  <span className="block text-[11px] text-[#777]">{bytes(item.bytes)} · {formatDate(item.created_at)}</span>
                  {!item.eligible && <span className="text-[11px] font-medium text-amber-700">{item.reason || "Protected"}</span>}
                </span>
              </label>
            ))}
            {tab === "orders" && displayed.map((item) => (
              <label key={item.id} className={"flex items-start gap-3 rounded-xl border p-3 text-sm " +
                (item.eligible ? "" : "bg-slate-50 opacity-70")}>
                <input type="checkbox" className="mt-1 size-4 shrink-0 accent-slate-900"
                  aria-label={"Select order " + item.order_number}
                  checked={selected.includes(item.id)} disabled={!item.eligible || deleting || (selected.length >= 10 && !selected.includes(item.id))}
                  onChange={() => toggle(item.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{item.order_number}</span>
                  <span className="text-xs text-[#777]">{item.payment_mode} · {item.status} · payment {item.payment_status} · {formatDate(item.created_at)}</span>
                  {!item.eligible && <span className="block text-xs text-amber-700">Protected: paid, linked, fulfilled or unverifiable order</span>}
                </span>
              </label>
            ))}
            {tab === "accounts" && displayed.map((item) => (
              <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-sm">
                  <div className="break-all font-semibold">{item.email}</div>
                  <div className="mt-0.5 text-xs text-[#777]">{item.role} · joined {formatDate(item.created_at)}</div>
                  {!item.eligible && <div className="text-xs font-medium text-amber-700">Protected account — deletion disabled</div>}
                  {item.eligible && (item.owned > 0 || item.linked > 0) && (
                    <div className="text-xs text-amber-700">Blocked by {item.owned} owned file(s) and {item.linked} linked record(s). Clean dependencies first.</div>
                  )}
                </div>
                {item.eligible && !item.owned && !item.linked && (
                  <div className="flex w-full flex-col gap-2 sm:w-[240px]">
                    <label htmlFor={"cleanup-account-" + item.id} className="text-[11px] text-[#666]">Type full email to enable deletion</label>
                    <input id={"cleanup-account-" + item.id} value={accountConfirm[item.id] || ""} autoComplete="off"
                      onChange={(event) => setAccountConfirm((s) => ({...s, [item.id]: event.target.value}))}
                      placeholder={item.email} className="min-w-0 w-full rounded-lg border px-2.5 py-2 text-xs"/>
                    <button type="button" disabled={deleting || accountConfirm[item.id] !== item.email}
                      onClick={() => deleteAccount(item)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-40">
                      <Trash2 size={13}/>Delete registration
                    </button>
                  </div>
                )}
              </div>
            ))}
            {tab === "history" && displayed.map((item) => (
              <div key={item.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                  <span>{item.operation.replaceAll("_", " ")}</span>
                  <span className={item.outcome === "success" ? "text-emerald-700" : "text-red-700"}>{item.outcome}</span>
                </div>
                <div className="mt-1 break-all text-xs text-[#555]">{item.target_ref}</div>
                <div className="mt-1 text-[11px] text-[#888]">{formatDate(item.created_at)} {item.detail || ""}</div>
              </div>
            ))}
          </div>
          {preview && rows.length > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-[#666]">Page {page} of {pages}</span>
              <div className="flex gap-2">
                <button aria-label="Previous cleanup page" type="button" disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft size={16}/></button>
                <button aria-label="Next cleanup page" type="button" disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight size={16}/></button>
              </div>
            </div>
          )}
          {(tab === "files" || tab === "orders") && selected.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="mb-2 text-xs font-semibold text-red-900">{selected.length} selected (maximum 10 per operation)</div>
              <label htmlFor="cleanup-confirm" className="mb-1 block text-xs text-red-800">
                Type <strong>{phrase}</strong> to unlock permanent deletion
              </label>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <input id="cleanup-confirm" autoComplete="off" value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm" />
                <button type="button" onClick={perform} disabled={confirmText !== phrase || deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-800 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
                  <Trash2 size={14}/> {deleting ? "Deleting…" : "Delete selected"}
                </button>
              </div>
            </div>
          )}
          <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[#777]">
            <ShieldCheck size={14} className="mt-0.5 shrink-0"/>
            All deletion requests are rechecked by the server after verified admin MFA. No bulk delete of products, production artwork or admin users is available.
          </div>
        </div>
      )}
    </section>
  );
}