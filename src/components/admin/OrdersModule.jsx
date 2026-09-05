import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Factory,
  CheckCircle2,
  X,
  PackageCheck,
  Truck,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { adminOrdersApi } from "@/lib/adminOrdersApi";

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  "draft",
  "pending_payment",
  "paid",
  "payment_failed",
  "artwork_needed",
  "design_in_progress",
  "proof_ready",
  "awaiting_approval",
  "revision_requested",
  "approved",
  "production_queue",
  "printing",
  "quality_control",
  "packing",
  "ready_for_pickup",
  "shipped",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
  "partially_refunded",
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "custom", label: "Custom" },
  { id: "production", label: "Production" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded", label: "Refunded" },
];

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function dateTime(value) {
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

export default function OrdersModule() {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminOrdersApi.list({
        page,
        pageSize: PAGE_SIZE,
        search,
        status: filter,
      });
      setOrders(result.orders);
      setTotal(result.total);
      if (selected) {
        const refreshed = result.orders.find((order) => order.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err) {
      console.error("Orders module load failed:", err);
      setError(err?.message || "Could not load orders.");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      setSummary(await adminOrdersApi.summary());
    } catch (err) {
      console.error("Orders summary load failed:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, filter, search]);

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const updateStatus = async (order, status) => {
    try {
      await adminOrdersApi.updateStatus(order.id, status);
      showNotice(`${order.order_number} moved to ${prettify(status)}.`);
      await Promise.all([loadOrders(), loadSummary()]);
    } catch (err) {
      console.error("Order status update failed:", err);
      showNotice(err?.message || "Order update failed.");
    }
  };

  const updateTracking = async (order, tracking) => {
    try {
      await adminOrdersApi.updateTracking(order.id, tracking);
      showNotice(`${order.order_number} tracking updated.`);
      await loadOrders();
    } catch (err) {
      console.error("Tracking update failed:", err);
      showNotice(err?.message || "Tracking update failed.");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <SummaryCard
          label="All orders"
          value={summaryLoading ? "—" : summary?.all ?? 0}
          icon={ShoppingBag}
        />
        <SummaryCard
          label="Open"
          value={summaryLoading ? "—" : summary?.open ?? 0}
          icon={AlertCircle}
        />
        <SummaryCard
          label="Custom"
          value={summaryLoading ? "—" : summary?.custom ?? 0}
          icon={Sparkles}
        />
        <SummaryCard
          label="Production"
          value={summaryLoading ? "—" : summary?.production ?? 0}
          icon={Factory}
        />
        <SummaryCard
          label="Completed"
          value={summaryLoading ? "—" : summary?.completed ?? 0}
          icon={CheckCircle2}
        />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search order, customer, email or tracking"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] outline-none focus:ring-2 focus:ring-black/10 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <SlidersHorizontal size={15} className="text-[#777] shrink-0" />
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFilter(item.id);
                  setPage(1);
                }}
                className={`h-8 px-3 rounded-full text-xs font-medium border whitespace-nowrap ${
                  filter === item.id
                    ? "bg-[#222] text-white border-[#222]"
                    : "bg-white border-[#d8d8d8] hover:bg-[#f7f7f7]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              loadOrders();
              loadSummary();
            }}
            className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center justify-center gap-2 hover:bg-[#fafafa]"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Fulfillment</Th>
                <Th right>Total</Th>
                <Th right>Date</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-14 text-center text-[#777]">
                    Loading orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-14 text-center">
                    <ShoppingBag size={22} className="mx-auto text-[#aaa]" />
                    <div className="font-medium mt-3">No matching orders</div>
                    <div className="text-xs text-[#777] mt-1">Try another status or search term.</div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelected(order)}
                    className="border-t border-[#eeeeee] hover:bg-[#fafafa] cursor-pointer"
                  >
                    <Td>
                      <div className="font-semibold">{order.order_number}</div>
                      {order.priority && order.priority !== "standard" && (
                        <div className="text-[10px] uppercase tracking-wide text-amber-700 mt-1">
                          {prettify(order.priority)}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="font-medium">{order.customer_name || "Guest"}</div>
                      <div className="text-[11px] text-[#808080]">{order.customer_email}</div>
                    </Td>
                    <Td>{(order.order_items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</Td>
                    <Td><StatusPill value={order.status} /></Td>
                    <Td><StatusPill value={order.payment_status} compact /></Td>
                    <Td>
                      <div>{prettify(order.fulfillment_status || order.status)}</div>
                      {order.tracking_number && (
                        <div className="text-[11px] text-[#777] mt-1">{order.tracking_number}</div>
                      )}
                    </Td>
                    <Td right><span className="font-semibold">{money(order.total)}</span></Td>
                    <Td right><span className="text-[#6f6f6f]">{dateTime(order.created_at)}</span></Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#e7e7e7] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[#777]">
            {total === 0
              ? "0 orders"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} orders`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs inline-flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs text-[#777] px-2">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs inline-flex items-center gap-1 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {selected && (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onStatus={updateStatus}
          onTracking={updateTracking}
        />
      )}
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

function OrderDrawer({ order, onClose, onStatus, onTracking }) {
  const [status, setStatus] = useState(order.status || "pending_payment");
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number || "");
  const [carrier, setCarrier] = useState(order.carrier || "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);

  useEffect(() => {
    setStatus(order.status || "pending_payment");
    setTrackingNumber(order.tracking_number || "");
    setCarrier(order.carrier || "");
  }, [order.id, order.status, order.tracking_number, order.carrier]);

  const saveStatus = async () => {
    if (status === order.status) return;
    setSavingStatus(true);
    try {
      await onStatus(order, status);
    } finally {
      setSavingStatus(false);
    }
  };

  const saveTracking = async () => {
    setSavingTracking(true);
    try {
      await onTracking(order, { trackingNumber, carrier });
    } finally {
      setSavingTracking(false);
    }
  };

  const itemCount = (order.order_items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Close order details"
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[620px] bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 h-16 px-5 border-b border-[#e3e3e3] bg-white flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">{order.order_number}</div>
            <div className="text-xs text-[#777]">{dateTime(order.created_at)}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Total" value={money(order.total)} />
            <MiniStat label="Items" value={itemCount} />
            <MiniStat label="Payment" value={prettify(order.payment_status)} />
            <MiniStat label="Priority" value={prettify(order.priority || "standard")} />
          </div>

          <Section title="Order status">
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 flex-1 rounded-lg border border-[#d5d5d5] px-3 text-sm bg-white"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {prettify(option)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={saveStatus}
                disabled={savingStatus || status === order.status}
                className="h-10 px-4 rounded-lg bg-[#222] text-white text-sm font-medium disabled:opacity-40"
              >
                {savingStatus ? "Saving…" : "Update status"}
              </button>
            </div>
          </Section>

          <Section title="Customer">
            <InfoGrid
              rows={[
                ["Name", order.customer_name || "Guest"],
                ["Email", order.customer_email],
                ["Phone", order.customer_phone || "—"],
                ["Shipping method", order.shipping_method || "—"],
              ]}
            />
          </Section>

          <Section title={`Items (${itemCount})`}>
            <div className="space-y-3">
              {(order.order_items || []).map((item) => (
                <div key={item.id} className="flex gap-3 rounded-lg border border-[#e5e5e5] p-3">
                  <div className="w-14 h-14 bg-[#f2f2f2] rounded-lg overflow-hidden shrink-0 grid place-items-center">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PackageCheck size={18} className="text-[#aaa]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-[#777] mt-1">
                      {[item.variant, item.color, item.size].filter(Boolean).join(" · ") || "Default"}
                    </div>
                    <div className="text-xs mt-2">
                      {item.quantity} × {money(item.unit_price)}
                    </div>
                  </div>
                  {item.is_custom && (
                    <span className="h-fit rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold px-2 py-1">
                      CUSTOM
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tracking">
            <div className="grid sm:grid-cols-2 gap-3">
              <label>
                <span className="text-xs font-medium text-[#666]">Carrier</span>
                <input
                  value={carrier}
                  onChange={(event) => setCarrier(event.target.value)}
                  placeholder="Canada Post, UPS…"
                  className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-medium text-[#666]">Tracking number</span>
                <input
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="Tracking number"
                  className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={saveTracking}
              disabled={savingTracking}
              className="mt-3 h-9 px-3 rounded-lg border border-[#d0d0d0] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#fafafa]"
            >
              <Truck size={14} />
              {savingTracking ? "Saving…" : "Save tracking"}
            </button>
          </Section>

          <Section title="Order totals">
            <div className="space-y-2 text-sm">
              <AmountRow label="Subtotal" value={order.subtotal} />
              <AmountRow label="Discount" value={-Number(order.discount || 0)} />
              <AmountRow label="Shipping" value={order.shipping} />
              <AmountRow label="Tax" value={order.tax} />
              <div className="pt-2 border-t border-[#e5e5e5] flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{money(order.total)}</span>
              </div>
            </div>
          </Section>
        </div>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f7f7f7] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[#777]">{label}</div>
      <div className="text-sm font-semibold mt-1 capitalize">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-[#e1e1e1] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#eeeeee] bg-[#fafafa] text-sm font-semibold">{title}</div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function InfoGrid({ rows }) {
  return (
    <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="text-[10px] uppercase tracking-wide text-[#888]">{label}</div>
          <div className="text-sm mt-1 break-words">{value}</div>
        </div>
      ))}
    </div>
  );
}

function AmountRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-[#555]">
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function StatusPill({ value, compact }) {
  const normalized = String(value || "unknown");
  const label = prettify(normalized);
  const good = ["paid", "approved", "delivered", "completed"].includes(normalized);
  const danger = ["payment_failed", "cancelled", "refunded"].includes(normalized);
  const warning = ["pending_payment", "revision_requested", "awaiting_approval"].includes(normalized);
  const color = good
    ? "bg-emerald-100 text-emerald-800"
    : danger
      ? "bg-red-100 text-red-700"
      : warning
        ? "bg-amber-100 text-amber-800"
        : "bg-[#eeeeee] text-[#555]";

  return (
    <span className={`inline-flex rounded-full font-medium capitalize ${color} ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}>
      {label}
    </span>
  );
}

function Th({ children, right }) {
  return (
    <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, right }) {
  return (
    <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}
