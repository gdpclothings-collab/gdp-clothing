import React, { useEffect, useMemo, useState } from "react";
import {
  Factory,
  Printer,
  ShieldCheck,
  PackageCheck,
  Truck,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  adminProductionApi,
  PRODUCTION_CHECKS,
  PRODUCTION_STATUSES,
} from "@/lib/adminProductionApi";

function prettify(value) {
  return String(value || "—").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

const statusMeta = {
  production_queue: { label: "Queue", icon: Factory },
  printing: { label: "Printing", icon: Printer },
  quality_control: { label: "Quality control", icon: ShieldCheck },
  packing: { label: "Packing", icon: PackageCheck },
  ready_for_pickup: { label: "Ready", icon: CheckCircle2 },
  shipped: { label: "Shipped", icon: Truck },
  out_for_delivery: { label: "Out for delivery", icon: Truck },
  delivered: { label: "Delivered", icon: CheckCircle2 },
  completed: { label: "Completed", icon: CheckCircle2 },
};

export default function ProductionModule() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await adminProductionApi.list();
      setOrders(rows);
      if (selected) {
        const refreshed = rows.find((row) => row.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err) {
      console.error("Production module load failed:", err);
      setError(err?.message || "Could not load production queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };

  const grouped = useMemo(() => {
    const groups = {};
    for (const status of PRODUCTION_STATUSES) groups[status] = [];
    for (const order of orders) {
      if (!groups[order.status]) groups[order.status] = [];
      groups[order.status].push(order);
    }
    return groups;
  }, [orders]);

  const activeStatuses = [
    "production_queue",
    "printing",
    "quality_control",
    "packing",
    "ready_for_pickup",
  ];

  const summary = {
    active: orders.filter((order) => activeStatuses.includes(order.status)).length,
    queue: grouped.production_queue?.length || 0,
    printing: grouped.printing?.length || 0,
    qc: grouped.quality_control?.length || 0,
    packing: grouped.packing?.length || 0,
  };

  const setStatus = async (order, status) => {
    try {
      await adminProductionApi.setStatus(order.id, status);
      showNotice(`${order.order_number} moved to ${prettify(status)}.`);
      await load();
    } catch (err) {
      console.error("Production status update failed:", err);
      showNotice(err?.message || "Could not update production status.");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <SummaryCard label="Active production" value={loading ? "—" : summary.active} icon={Factory} />
        <SummaryCard label="Queue" value={loading ? "—" : summary.queue} icon={Factory} />
        <SummaryCard label="Printing" value={loading ? "—" : summary.printing} icon={Printer} />
        <SummaryCard label="Quality control" value={loading ? "—" : summary.qc} icon={ShieldCheck} />
        <SummaryCard label="Packing" value={loading ? "—" : summary.packing} icon={PackageCheck} />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Production board</div>
            <div className="text-xs text-[#777] mt-0.5">Approved work through print, QC, packing and fulfillment</div>
          </div>
          <button onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="p-4 overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-[#777]">Loading production…</div>
          ) : (
            <div className="grid grid-flow-col auto-cols-[285px] gap-4 min-w-max">
              {activeStatuses.map((status) => {
                const meta = statusMeta[status];
                const Icon = meta.icon;
                const items = grouped[status] || [];

                return (
                  <div key={status} className="rounded-xl border border-[#e2e2e2] bg-[#f8f8f8] overflow-hidden">
                    <div className="px-3 py-3 border-b border-[#e3e3e3] bg-white flex items-center gap-2">
                      <Icon size={15} />
                      <div className="text-sm font-semibold">{meta.label}</div>
                      <span className="ml-auto rounded-full bg-[#eeeeee] px-2 py-0.5 text-[10px] font-semibold">{items.length}</span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[350px]">
                      {items.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#999]">No orders</div>
                      ) : (
                        items.map((order) => (
                          <button
                            key={order.id}
                            onClick={() => setSelected(order)}
                            className="w-full rounded-lg border border-[#dedede] bg-white p-3 text-left hover:border-[#bcbcbc] hover:shadow-sm transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-sm">{order.order_number}</div>
                              {order.priority && order.priority !== "standard" && (
                                <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[9px] font-semibold uppercase">
                                  {order.priority}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#777] mt-1">{order.customer_name || "Customer"}</div>
                            <div className="text-[11px] text-[#888] mt-2">{formatDate(order.need_by_date)}</div>
                            <ChecklistProgress checklist={order.production_checklist || {}} />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selected && (
        <ProductionDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onChanged={async (message) => {
            showNotice(message);
            await load();
          }}
          onStatus={setStatus}
        />
      )}
    </div>
  );
}

function ProductionDrawer({ order, onClose, onChanged, onStatus }) {
  const [checklist, setChecklist] = useState(order.production_checklist || {});
  const [savingCheck, setSavingCheck] = useState("");
  const [status, setStatus] = useState(order.status);

  useEffect(() => {
    setChecklist(order.production_checklist || {});
    setStatus(order.status);
  }, [order.id, order.status, order.production_checklist]);

  const toggleCheck = async (key, checked) => {
    const next = { ...checklist, [key]: checked };
    setChecklist(next);
    setSavingCheck(key);
    try {
      await adminProductionApi.updateChecklist(order.id, next);
      await onChanged("Production checklist saved.");
    } catch (err) {
      console.error("Checklist update failed:", err);
      window.alert(err?.message || "Could not save checklist.");
      setChecklist(order.production_checklist || {});
    } finally {
      setSavingCheck("");
    }
  };

  const readyForProduction = PRODUCTION_CHECKS.every(([key]) => checklist[key]);

  const saveStatus = async () => {
    if (status === order.status) return;
    if (status === "printing" && !readyForProduction) {
      window.alert("Complete every production check before moving this order to printing.");
      return;
    }
    await onStatus(order, status);
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Close production order" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[650px] bg-[#f6f6f6] shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 h-16 px-5 border-b border-[#e3e3e3] bg-white flex items-center justify-between">
          <div>
            <div className="font-semibold">{order.order_number}</div>
            <div className="text-xs text-[#777]">{order.customer_name || "Customer"} · {prettify(order.status)}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaeaea] text-sm font-semibold">Production status</div>
            <div className="p-4 flex gap-2">
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="flex-1 h-10 rounded-lg border border-[#d4d4d4] px-3 text-sm bg-white">
                {PRODUCTION_STATUSES.map((option) => <option key={option} value={option}>{prettify(option)}</option>)}
              </select>
              <button
                onClick={saveStatus}
                disabled={status === order.status}
                className="h-10 px-4 rounded-lg bg-[#222] text-white text-sm font-medium disabled:opacity-40"
              >
                Update
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaeaea] flex items-center justify-between">
              <div className="text-sm font-semibold">Pre-production checklist</div>
              <div className="text-xs text-[#777]">
                {PRODUCTION_CHECKS.filter(([key]) => checklist[key]).length}/{PRODUCTION_CHECKS.length}
              </div>
            </div>
            <div className="divide-y divide-[#eeeeee]">
              {PRODUCTION_CHECKS.map(([key, label]) => (
                <label key={key} className="px-4 py-3 flex items-center gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(checklist[key])}
                    disabled={savingCheck === key}
                    onChange={(event) => toggleCheck(key, event.target.checked)}
                  />
                  <span className="flex-1">{label}</span>
                  {checklist[key] && <CheckCircle2 size={15} className="text-emerald-600" />}
                </label>
              ))}
            </div>
            {!readyForProduction && (
              <div className="p-3 border-t border-amber-200 bg-amber-50 text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                Complete all checks before the order moves into printing.
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#eaeaea] text-sm font-semibold">Items</div>
            <div className="p-4 space-y-2">
              {(order.order_items || []).map((item) => (
                <div key={item.id} className="rounded-lg border border-[#e5e5e5] p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#f2f2f2] overflow-hidden grid place-items-center">
                    {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <Factory size={15} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-[11px] text-[#777]">{[item.color, item.size, item.variant].filter(Boolean).join(" · ") || "Default"}</div>
                  </div>
                  <div className="text-sm font-semibold">×{item.quantity}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function ChecklistProgress({ checklist }) {
  const completed = PRODUCTION_CHECKS.filter(([key]) => checklist[key]).length;
  const percent = Math.round((completed / PRODUCTION_CHECKS.length) * 100);

  return (
    <div className="mt-3">
      <div className="h-1.5 rounded-full bg-[#e5e5e5] overflow-hidden">
        <div className="h-full bg-[#222]" style={{ width: `${percent}%` }} />
      </div>
      <div className="text-[10px] text-[#888] mt-1">{completed}/{PRODUCTION_CHECKS.length} checks</div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">{label}</div>
        <Icon size={16} className="text-[#777]" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}
