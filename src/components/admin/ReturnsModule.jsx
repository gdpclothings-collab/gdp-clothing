import React, { useEffect, useMemo, useState } from "react";
import {
  RotateCcw,
  Search,
  Plus,
  CheckCircle2,
  RefreshCw,
  X,
  PackageCheck,
  AlertTriangle,
  ReceiptText,
} from "lucide-react";
import { adminOrderOperationsApi } from "@/lib/adminOrderOperationsApi";

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function prettify(value) {
  return String(value || "—").replaceAll("_", " ");
}

export default function ReturnsModule() {
  const [returns, setReturns] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [returnRows, refundRows] = await Promise.all([
        adminOrderOperationsApi.listReturns(),
        adminOrderOperationsApi.listRefunds(),
      ]);
      setReturns(returnRows);
      setRefunds(refundRows);
      if (selected) {
        const refreshed = returnRows.find((row) => row.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err) {
      console.error("Returns module load failed:", err);
      setError(err?.message || "Could not load returns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const stats = useMemo(
    () => ({
      open: returns.filter((row) =>
        ["requested", "approved", "in_transit", "received"].includes(row.status)
      ).length,
      completed: returns.filter((row) => row.status === "completed").length,
      requestedRefunds: refunds.filter((row) => row.status === "pending").length,
      refundValue: refunds.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    }),
    [returns, refunds]
  );

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Metric label="Open returns" value={stats.open} icon={RotateCcw} />
        <Metric label="Completed returns" value={stats.completed} icon={PackageCheck} />
        <Metric label="Pending refund records" value={stats.requestedRefunds} icon={ReceiptText} />
        <Metric label="Refund records value" value={money(stats.refundValue)} icon={ReceiptText} />
      </div>

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-2">
          <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-900">Refund records are workflow records, not Stripe refund execution.</div>
            <div className="text-xs text-amber-800 mt-1 leading-5">
              This protects against accidental money movement from the browser. A server-side Stripe refund action can be connected after the return workflow is certified.
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Returns</div>
            <div className="text-xs text-[#777] mt-0.5">Request → approval → transit → received → resolution</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2"
            >
              <Plus size={15} /> Create return
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Return</Th>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Resolution</Th>
                <Th right>Refund target</Th>
                <Th>Status</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="py-14 text-center text-[#777]">Loading returns…</td></tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-14 text-center">
                    <RotateCcw size={24} className="mx-auto text-[#aaa]" />
                    <div className="font-medium mt-3">No returns yet</div>
                    <div className="text-xs text-[#777] mt-1">Create a return from an eligible fulfilled order.</div>
                  </td>
                </tr>
              ) : (
                returns.map((row) => {
                  const itemCount = (row.return_items || []).reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0
                  );
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className="border-t border-[#eeeeee] hover:bg-[#fafafa] cursor-pointer"
                    >
                      <Td><span className="font-semibold">{row.return_number}</span></Td>
                      <Td>{row.orders?.order_number || "—"}</Td>
                      <Td>
                        <div>{row.orders?.customer_name || "Customer"}</div>
                        <div className="text-[11px] text-[#777]">{row.orders?.customer_email}</div>
                      </Td>
                      <Td>{itemCount}</Td>
                      <Td><span className="capitalize">{prettify(row.resolution)}</span></Td>
                      <Td right>{money(row.refund_amount)}</Td>
                      <Td><StatusPill value={row.status} /></Td>
                      <Td>{formatDate(row.requested_at)}</Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <ReturnDrawer
          returnRow={selected}
          onClose={() => setSelected(null)}
          onChanged={async (message) => {
            showNotice(message);
            await load();
          }}
        />
      )}

      {createOpen && (
        <CreateReturnModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            showNotice("Return created.");
            await load();
          }}
        />
      )}
    </div>
  );
}

function ReturnDrawer({ returnRow, onClose, onChanged }) {
  const [status, setStatus] = useState(returnRow.status);
  const [resolution, setResolution] = useState(returnRow.resolution);
  const [refundAmount, setRefundAmount] = useState(returnRow.refund_amount || 0);
  const [adminNotes, setAdminNotes] = useState(returnRow.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const [recordingRefund, setRecordingRefund] = useState(false);

  useEffect(() => {
    setStatus(returnRow.status);
    setResolution(returnRow.resolution);
    setRefundAmount(returnRow.refund_amount || 0);
    setAdminNotes(returnRow.admin_notes || "");
  }, [returnRow.id, returnRow.status, returnRow.resolution, returnRow.refund_amount, returnRow.admin_notes]);

  const save = async () => {
    setSaving(true);
    try {
      await adminOrderOperationsApi.updateReturn(returnRow.id, {
        status,
        resolution,
        refundAmount,
        adminNotes,
        restock: returnRow.restock,
      });
      await onChanged("Return updated.");
    } finally {
      setSaving(false);
    }
  };

  const recordRefund = async () => {
    if (Number(refundAmount || 0) <= 0) {
      window.alert("Enter a refund amount greater than zero first.");
      return;
    }
    setRecordingRefund(true);
    try {
      await adminOrderOperationsApi.createRefundRecord({
        orderId: returnRow.order_id,
        returnId: returnRow.id,
        amount: refundAmount,
        reason: returnRow.reason || "Return refund",
      });
      await onChanged("Pending refund record created.");
    } finally {
      setRecordingRefund(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Close return" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[660px] bg-[#f6f6f6] shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 h-16 px-5 border-b border-[#e3e3e3] bg-white flex items-center justify-between">
          <div>
            <div className="font-semibold">{returnRow.return_number}</div>
            <div className="text-xs text-[#777]">{returnRow.orders?.order_number} · {returnRow.orders?.customer_name}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <Section title="Return workflow">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Status">
                <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
                  {["requested", "approved", "in_transit", "received", "completed", "rejected", "cancelled"].map((option) => (
                    <option key={option} value={option}>{prettify(option)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Resolution">
                <select value={resolution} onChange={(event) => setResolution(event.target.value)} className={inputClass}>
                  <option value="refund">Refund</option>
                  <option value="exchange">Exchange</option>
                  <option value="store_credit">Store credit</option>
                  <option value="no_refund">No refund</option>
                </select>
              </Field>
            </div>
            <Field label="Refund target">
              <input
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Admin notes">
              <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} className={textareaClass} rows="3" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save return"}
              </button>
              {resolution === "refund" && (
                <button
                  onClick={recordRefund}
                  disabled={recordingRefund}
                  className="h-9 px-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium disabled:opacity-40"
                >
                  {recordingRefund ? "Recording…" : "Create pending refund record"}
                </button>
              )}
            </div>
          </Section>

          <Section title="Items">
            <div className="space-y-2">
              {(returnRow.return_items || []).map((item) => (
                <div key={item.id} className="rounded-lg border border-[#e5e5e5] bg-white p-3 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-[#f2f2f2] overflow-hidden grid place-items-center shrink-0">
                    {item.order_items?.image ? (
                      <img src={item.order_items.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PackageCheck size={16} className="text-[#aaa]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{item.order_items?.name || "Order item"}</div>
                    <div className="text-[11px] text-[#777]">
                      {[item.order_items?.color, item.order_items?.size, item.order_items?.variant].filter(Boolean).join(" · ") || "Default"}
                    </div>
                    <div className="text-[11px] text-[#777] mt-1">
                      {item.reason || returnRow.reason || "No reason"}{item.item_condition ? ` · ${prettify(item.item_condition)}` : ""}
                    </div>
                  </div>
                  <div className="font-semibold text-sm">×{item.quantity}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Request details">
            <Info label="Reason" value={returnRow.reason || "—"} />
            <Info label="Customer notes" value={returnRow.customer_notes || "—"} />
            <Info label="Requested" value={formatDate(returnRow.requested_at)} />
            <Info label="Order total" value={money(returnRow.orders?.total)} />
          </Section>
        </div>
      </aside>
    </div>
  );
}

function CreateReturnModal({ onClose, onCreated }) {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("refund");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const findOrders = async () => {
    setLoading(true);
    try {
      setOrders(await adminOrderOperationsApi.eligibleOrders(search));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    findOrders();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(findOrders, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const selectOrder = (order) => {
    setSelectedOrder(order);
    const initial = {};
    for (const item of order.order_items || []) {
      initial[item.id] = {
        quantity: 0,
        max: item.quantity,
        itemCondition: "",
        restock: true,
      };
    }
    setItems(initial);
  };

  const create = async () => {
    if (!selectedOrder) return;
    const selectedItems = Object.entries(items)
      .filter(([, value]) => Number(value.quantity || 0) > 0)
      .map(([orderItemId, value]) => ({
        orderItemId,
        quantity: Number(value.quantity),
        itemCondition: value.itemCondition || null,
        restock: value.restock,
      }));

    if (!selectedItems.length) {
      window.alert("Select at least one item and quantity.");
      return;
    }

    setCreating(true);
    try {
      await adminOrderOperationsApi.createReturn({
        orderId: selectedOrder.id,
        reason,
        resolution,
        notes,
        items: selectedItems,
      });
      await onCreated();
    } catch (err) {
      console.error("Create return failed:", err);
      window.alert(err?.message || "Could not create return.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-8 flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6">
        <div className="h-16 px-5 border-b border-[#e3e3e3] flex items-center justify-between">
          <div>
            <div className="font-semibold">Create return</div>
            <div className="text-xs text-[#777]">Choose a fulfilled order and the items being returned</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {!selectedOrder ? (
            <section>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search order number, customer or email"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm"
                />
              </div>
              <div className="mt-3 max-h-[420px] overflow-y-auto border border-[#e2e2e2] rounded-lg divide-y divide-[#eeeeee]">
                {loading ? (
                  <div className="p-6 text-center text-sm text-[#777]">Searching orders…</div>
                ) : orders.length ? (
                  orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => selectOrder(order)}
                      className="w-full px-4 py-3 text-left hover:bg-[#fafafa] flex items-center gap-3"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{order.order_number}</div>
                        <div className="text-xs text-[#777]">{order.customer_name} · {order.customer_email}</div>
                      </div>
                      <div className="text-sm font-semibold">{money(order.total)}</div>
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center text-sm text-[#777]">No eligible fulfilled orders found.</div>
                )}
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-xl border border-[#dedede] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{selectedOrder.order_number}</div>
                    <div className="text-xs text-[#777] mt-1">{selectedOrder.customer_name} · {selectedOrder.customer_email}</div>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-xs font-semibold">Change order</button>
                </div>
              </section>

              <Section title="Return items">
                <div className="space-y-3">
                  {(selectedOrder.order_items || []).map((item) => {
                    const state = items[item.id] || { quantity: 0, max: item.quantity, itemCondition: "", restock: true };
                    return (
                      <div key={item.id} className="rounded-lg border border-[#e5e5e5] p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-[#f2f2f2] overflow-hidden grid place-items-center">
                            {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <PackageCheck size={14} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{item.name}</div>
                            <div className="text-[11px] text-[#777]">{[item.color, item.size, item.variant].filter(Boolean).join(" · ") || "Default"}</div>
                          </div>
                          <div className="text-xs text-[#777]">Purchased ×{item.quantity}</div>
                        </div>

                        <div className="mt-3 grid sm:grid-cols-3 gap-2">
                          <Field label="Return quantity">
                            <input
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={state.quantity}
                              onChange={(event) =>
                                setItems((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...state,
                                    quantity: Math.min(item.quantity, Math.max(0, Number(event.target.value || 0))),
                                  },
                                }))
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field label="Condition">
                            <select
                              value={state.itemCondition}
                              onChange={(event) =>
                                setItems((current) => ({
                                  ...current,
                                  [item.id]: { ...state, itemCondition: event.target.value },
                                }))
                              }
                              className={inputClass}
                            >
                              <option value="">Not specified</option>
                              <option value="unopened">Unopened</option>
                              <option value="new">New</option>
                              <option value="worn">Worn</option>
                              <option value="damaged">Damaged</option>
                              <option value="defective">Defective</option>
                              <option value="other">Other</option>
                            </select>
                          </Field>
                          <label className="flex items-end pb-2 gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={state.restock}
                              onChange={(event) =>
                                setItems((current) => ({
                                  ...current,
                                  [item.id]: { ...state, restock: event.target.checked },
                                }))
                              }
                            />
                            Restock if accepted
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title="Return reason & resolution">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Reason">
                    <input value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass} placeholder="Sizing, defect, changed mind…" />
                  </Field>
                  <Field label="Resolution">
                    <select value={resolution} onChange={(event) => setResolution(event.target.value)} className={inputClass}>
                      <option value="refund">Refund</option>
                      <option value="exchange">Exchange</option>
                      <option value="store_credit">Store credit</option>
                      <option value="no_refund">No refund</option>
                    </select>
                  </Field>
                </div>
                <Field label="Customer notes">
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className={textareaClass} rows="3" />
                </Field>
              </Section>

              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="h-9 px-4 rounded-lg border border-[#d5d5d5] text-sm">Cancel</button>
                <button
                  onClick={create}
                  disabled={creating}
                  className="h-9 px-4 rounded-lg bg-[#222] text-white text-sm font-medium disabled:opacity-40"
                >
                  {creating ? "Creating…" : "Create return"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
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

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#eaeaea] text-sm font-semibold">{title}</div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div className="py-2 flex items-start justify-between gap-4 text-sm border-b last:border-b-0 border-[#eeeeee]">
      <span className="text-[#777]">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function StatusPill({ value }) {
  const classes = {
    requested: "bg-amber-100 text-amber-800",
    approved: "bg-blue-100 text-blue-800",
    in_transit: "bg-blue-100 text-blue-800",
    received: "bg-violet-100 text-violet-800",
    completed: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-700",
    cancelled: "bg-[#eeeeee] text-[#555]",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${classes[value] || "bg-[#eee] text-[#555]"}`}>
      {prettify(value)}
    </span>
  );
}

function Th({ children, right }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textareaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
