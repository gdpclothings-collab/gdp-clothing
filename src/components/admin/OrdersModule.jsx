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
  MoreHorizontal,
  Copy,
  Ban,
  RotateCcw,
  Clock3,
  Save,
} from "lucide-react";
import { adminOrdersApi } from "@/lib/adminOrdersApi";
import { useUnsavedChangesGuard } from "@/lib/UnsavedChangesContext";

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

const FULFILLMENT_OPTIONS = [
  "unfulfilled",
  "on_hold",
  "ready_for_pickup",
  "partially_fulfilled",
  "fulfilled",
  "shipped",
  "out_for_delivery",
  "delivered",
  "picked_up",
  "cancelled",
];

const DESIGN_STATUS_OPTIONS = [
  "not_required",
  "artwork_needed",
  "design_in_progress",
  "proof_ready",
  "awaiting_approval",
  "revision_requested",
  "approved",
];

const PRODUCTION_STATUS_OPTIONS = [
  "not_started",
  "queued",
  "printing",
  "quality_control",
  "packing",
  "ready",
  "completed",
];

const PAYMENT_STATUS_OPTIONS = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "custom", label: "Custom" },
  { id: "production", label: "Production" },
  { id: "attention", label: "Needs attention" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "refunded", label: "Refunded" },
];

const EMPTY_ADVANCED_FILTERS = {
  paymentStatus: "all",
  fulfillmentStatus: "all",
  designStatus: "all",
  productionStatus: "all",
  customerType: "all",
  dateFrom: "",
  dateTo: "",
  attentionOnly: false,
};

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

function itemCount(order) {
  return (order.order_items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState(EMPTY_ADVANCED_FILTERS);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkFulfillment, setBulkFulfillment] = useState("");
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const effectiveAttentionOnly = advanced.attentionOnly || filter === "attention";
  const effectiveStatus = filter === "attention" ? "all" : filter;

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminOrdersApi.list({
        page,
        pageSize: PAGE_SIZE,
        search,
        status: effectiveStatus,
        paymentStatus: advanced.paymentStatus,
        fulfillmentStatus: advanced.fulfillmentStatus,
        designStatus: advanced.designStatus,
        productionStatus: advanced.productionStatus,
        customerType: advanced.customerType,
        dateFrom: advanced.dateFrom,
        dateTo: advanced.dateTo,
        attentionOnly: effectiveAttentionOnly,
      });
      setOrders(result.orders);
      setTotal(result.total);
      setSelectedIds((current) => {
        const visibleIds = new Set(result.orders.map((order) => order.id));
        return new Set([...current].filter((id) => visibleIds.has(id)));
      });
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
  }, [
    page,
    filter,
    search,
    advanced.paymentStatus,
    advanced.fulfillmentStatus,
    advanced.designStatus,
    advanced.productionStatus,
    advanced.customerType,
    advanced.dateFrom,
    advanced.dateTo,
    advanced.attentionOnly,
  ]);

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

  const markBusy = (orderId, busy) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  };

  const refreshAfterMutation = async () => {
    await Promise.all([loadOrders(), loadSummary()]);
  };

  const updateStatus = async (order, status) => {
    if (!status || status === order.status) return true;
    markBusy(order.id, true);
    try {
      await adminOrdersApi.updateStatus(order.id, status);
      showNotice(order.order_number + " moved to " + prettify(status) + ".");
      await refreshAfterMutation();
      return true;
    } catch (err) {
      console.error("Order status update failed:", err);
      showNotice(err?.message || "Order update failed.");
      return false;
    } finally {
      markBusy(order.id, false);
    }
  };

  const updateFulfillment = async (order, fulfillmentStatus) => {
    if (!fulfillmentStatus || fulfillmentStatus === order.fulfillment_status) return true;
    markBusy(order.id, true);
    try {
      await adminOrdersApi.updateFulfillment(order.id, fulfillmentStatus);
      showNotice(order.order_number + " fulfillment changed to " + prettify(fulfillmentStatus) + ".");
      await refreshAfterMutation();
      return true;
    } catch (err) {
      console.error("Fulfillment update failed:", err);
      showNotice(err?.message || "Fulfillment update failed.");
      return false;
    } finally {
      markBusy(order.id, false);
    }
  };

  const saveOrder = async (order, values) => {
    markBusy(order.id, true);
    try {
      if (values.status !== order.status) {
        await adminOrdersApi.updateStatus(order.id, values.status);
      }
      if (values.designStatus !== (order.design_status || "not_required")) {
        await adminOrdersApi.updateDesignStatus(order.id, values.designStatus);
      }
      if (values.productionStatus !== (order.production_status || "not_started")) {
        await adminOrdersApi.updateProductionStatus(order.id, values.productionStatus);
      }
      if (values.fulfillmentStatus !== (order.fulfillment_status || "unfulfilled")) {
        await adminOrdersApi.updateFulfillment(order.id, values.fulfillmentStatus);
      }
      if (
        values.trackingNumber !== (order.tracking_number || "") ||
        values.carrier !== (order.carrier || "")
      ) {
        await adminOrdersApi.updateTracking(order.id, {
          trackingNumber: values.trackingNumber,
          carrier: values.carrier,
        });
      }
      if (values.notes !== (order.notes || "")) {
        await adminOrdersApi.updateNotes(order.id, values.notes);
      }

      showNotice(order.order_number + " saved.");
      await refreshAfterMutation();
      return true;
    } catch (err) {
      console.error("Order save failed:", err);
      showNotice(err?.message || "Order save failed.");
      return false;
    } finally {
      markBusy(order.id, false);
    }
  };

  const applyBulkStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      await adminOrdersApi.bulkUpdateStatus([...selectedIds], bulkStatus);
      showNotice(selectedIds.size + " order(s) moved to " + prettify(bulkStatus) + ".");
      setSelectedIds(new Set());
      setBulkStatus("");
      await refreshAfterMutation();
    } catch (err) {
      console.error("Bulk status update failed:", err);
      showNotice(err?.message || "Bulk status update failed.");
    } finally {
      setBulkSaving(false);
    }
  };

  const applyBulkFulfillment = async () => {
    if (!bulkFulfillment || selectedIds.size === 0) return;
    setBulkSaving(true);
    try {
      await adminOrdersApi.bulkUpdateFulfillment([...selectedIds], bulkFulfillment);
      showNotice(selectedIds.size + " order(s) fulfillment updated.");
      setSelectedIds(new Set());
      setBulkFulfillment("");
      await refreshAfterMutation();
    } catch (err) {
      console.error("Bulk fulfillment update failed:", err);
      showNotice(err?.message || "Bulk fulfillment update failed.");
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleSelected = (orderId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const allVisibleSelected =
    orders.length > 0 && orders.every((order) => selectedIds.has(order.id));

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        orders.forEach((order) => next.delete(order.id));
      } else {
        orders.forEach((order) => next.add(order.id));
      }
      return next;
    });
  };

  const applySummary = (id) => {
    setPage(1);
    setFilter(id);
    if (id !== "attention" && advanced.attentionOnly) {
      setAdvanced((current) => ({ ...current, attentionOnly: false }));
    }
  };

  const clearAdvanced = () => {
    setAdvanced(EMPTY_ADVANCED_FILTERS);
    setPage(1);
  };

  const activeAdvancedCount = useMemo(() => {
    return Object.entries(advanced).filter(([key, value]) => {
      if (key === "attentionOnly") return Boolean(value);
      return value && value !== "all";
    }).length;
  }, [advanced]);

  const copyOrderNumber = async (order) => {
    try {
      await navigator.clipboard.writeText(order.order_number);
      showNotice("Order number copied.");
    } catch {
      showNotice("Could not copy order number.");
    }
  };

  const cancelOrder = async (order) => {
    if (!window.confirm("Cancel " + order.order_number + "? This changes the order lifecycle status only and does not issue a refund.")) {
      return;
    }
    await updateStatus(order, "cancelled");
  };

  return (
    <div className="max-w-[1550px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <SummaryCard
          label="All orders"
          value={summaryLoading ? "—" : summary?.all ?? 0}
          icon={ShoppingBag}
          active={filter === "all"}
          onClick={() => applySummary("all")}
        />
        <SummaryCard
          label="Open"
          value={summaryLoading ? "—" : summary?.open ?? 0}
          icon={AlertCircle}
          active={filter === "open"}
          onClick={() => applySummary("open")}
        />
        <SummaryCard
          label="Custom"
          value={summaryLoading ? "—" : summary?.custom ?? 0}
          icon={Sparkles}
          active={filter === "custom"}
          onClick={() => applySummary("custom")}
        />
        <SummaryCard
          label="Production"
          value={summaryLoading ? "—" : summary?.production ?? 0}
          icon={Factory}
          active={filter === "production"}
          onClick={() => applySummary("production")}
        />
        <SummaryCard
          label="Needs attention"
          value={summaryLoading ? "—" : summary?.attention ?? 0}
          icon={Clock3}
          active={filter === "attention"}
          onClick={() => applySummary("attention")}
        />
        <SummaryCard
          label="Completed"
          value={summaryLoading ? "—" : summary?.completed ?? 0}
          icon={CheckCircle2}
          active={filter === "completed"}
          onClick={() => applySummary("completed")}
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

          <button
            type="button"
            onClick={() => setAdvancedOpen((value) => !value)}
            className={
              "h-9 px-3 rounded-lg border text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap " +
              (advancedOpen || activeAdvancedCount
                ? "border-[#222] bg-[#222] text-white"
                : "border-[#d5d5d5] hover:bg-[#fafafa]")
            }
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeAdvancedCount > 0 && (
              <span className="rounded-full bg-white text-black min-w-5 h-5 px-1 grid place-items-center text-[10px] font-semibold">
                {activeAdvancedCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 overflow-x-auto xl:max-w-[620px]">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applySummary(item.id)}
                className={
                  "h-8 px-3 rounded-full text-xs font-medium border whitespace-nowrap " +
                  (filter === item.id
                    ? "bg-[#222] text-white border-[#222]"
                    : "bg-white border-[#d8d8d8] hover:bg-[#f7f7f7]")
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={refreshAfterMutation}
            className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center justify-center gap-2 hover:bg-[#fafafa]"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {advancedOpen && (
          <AdvancedFilters
            value={advanced}
            onChange={(patch) => {
              setPage(1);
              setAdvanced((current) => ({ ...current, ...patch }));
            }}
            onClear={clearAdvanced}
          />
        )}

        {selectedIds.size > 0 && (
          <div className="px-4 py-3 border-b border-[#e7e7e7] bg-[#f7f7f7] flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="text-sm font-semibold min-w-fit">
              {selectedIds.size} selected
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="flex gap-2">
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value)}
                  className="h-9 min-w-[190px] rounded-lg border border-[#d5d5d5] px-3 text-sm bg-white"
                >
                  <option value="">Change order status…</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>{prettify(option)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyBulkStatus}
                  disabled={!bulkStatus || bulkSaving}
                  className="h-9 px-3 rounded-lg bg-[#222] text-white text-xs font-medium disabled:opacity-40"
                >
                  Apply
                </button>
              </div>

              <div className="flex gap-2">
                <select
                  value={bulkFulfillment}
                  onChange={(event) => setBulkFulfillment(event.target.value)}
                  className="h-9 min-w-[190px] rounded-lg border border-[#d5d5d5] px-3 text-sm bg-white"
                >
                  <option value="">Change fulfillment…</option>
                  {FULFILLMENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{prettify(option)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyBulkFulfillment}
                  disabled={!bulkFulfillment || bulkSaving}
                  className="h-9 px-3 rounded-lg border border-[#d0d0d0] bg-white text-xs font-medium disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-[#666] hover:text-black"
            >
              Clear selection
            </button>
          </div>
        )}

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1260px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select all orders on this page"
                  />
                </Th>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Order status</Th>
                <Th>Payment</Th>
                <Th>Fulfillment</Th>
                <Th right>Total</Th>
                <Th right>Date</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-[#777]">
                    Loading orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <ShoppingBag size={22} className="mx-auto text-[#aaa]" />
                    <div className="font-medium mt-3">No matching orders</div>
                    <div className="text-xs text-[#777] mt-1">
                      Try another status, filter or search term.
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const busy = busyIds.has(order.id);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelected(order)}
                      className="border-t border-[#eeeeee] hover:bg-[#fafafa] cursor-pointer"
                    >
                      <Td>
                        <div onClick={(event) => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelected(order.id)}
                            aria-label={"Select " + order.order_number}
                          />
                        </div>
                      </Td>
                      <Td>
                        <div className="font-semibold">{order.order_number}</div>
                        {order.priority && order.priority !== "standard" && (
                          <div className="text-[10px] uppercase tracking-wide text-amber-700 mt-1">
                            {prettify(order.priority)}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.customer_name || "Guest"}</span>
                          {order.is_guest && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-800">Guest</span>}
                        </div>
                        <div className="text-[11px] text-[#808080]">{order.customer_email}</div>
                      </Td>
                      <Td>{itemCount(order)}</Td>
                      <Td>
                        <QuickSelect
                          value={order.status}
                          options={STATUS_OPTIONS}
                          disabled={busy}
                          onChange={(value) => updateStatus(order, value)}
                          ariaLabel={"Change status for " + order.order_number}
                        />
                        <div className="mt-1 flex flex-wrap gap-1">
                          {order.design_status && order.design_status !== "not_required" && (
                            <StatusPill value={order.design_status} compact />
                          )}
                          {order.production_status && order.production_status !== "not_started" && (
                            <StatusPill value={order.production_status} compact />
                          )}
                        </div>
                      </Td>
                      <Td><StatusPill value={order.payment_status} compact /></Td>
                      <Td>
                        <QuickSelect
                          value={order.fulfillment_status || "unfulfilled"}
                          options={FULFILLMENT_OPTIONS}
                          disabled={busy}
                          onChange={(value) => updateFulfillment(order, value)}
                          ariaLabel={"Change fulfillment for " + order.order_number}
                        />
                        {order.tracking_number && (
                          <div className="text-[11px] text-[#777] mt-1">
                            {order.carrier ? order.carrier + " · " : ""}{order.tracking_number}
                          </div>
                        )}
                      </Td>
                      <Td right><span className="font-semibold">{money(order.total)}</span></Td>
                      <Td right><span className="text-[#6f6f6f]">{dateTime(order.created_at)}</span></Td>
                      <Td right>
                        <OrderActions
                          order={order}
                          busy={busy}
                          onView={() => setSelected(order)}
                          onCopy={() => copyOrderNumber(order)}
                          onComplete={() => updateStatus(order, "completed")}
                          onCancel={() => cancelOrder(order)}
                        />
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#e7e7e7] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[#777]">
            {total === 0
              ? "0 orders"
              : ((page - 1) * PAGE_SIZE + 1) + "–" + Math.min(page * PAGE_SIZE, total) + " of " + total + " orders"}
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
          saving={busyIds.has(selected.id)}
          onClose={() => setSelected(null)}
          onSave={saveOrder}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-xl border bg-white p-4 text-left transition " +
        (active
          ? "border-[#222] ring-1 ring-[#222]"
          : "border-[#dedede] hover:border-[#bdbdbd] hover:bg-[#fcfcfc]")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#666]">{label}</div>
        <Icon size={16} className="text-[#666]" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </button>
  );
}

function AdvancedFilters({ value, onChange, onClear }) {
  return (
    <div className="border-b border-[#e7e7e7] bg-[#fbfbfb] p-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <FilterField label="Customer">
          <select
            value={value.customerType}
            onChange={(event) => onChange({ customerType: event.target.value })}
            className="filter-control"
          >
            <option value="all">All customers</option>
            <option value="guest">Guest checkout</option>
            <option value="account">Customer account</option>
          </select>
        </FilterField>

        <FilterField label="Payment">
          <select
            value={value.paymentStatus}
            onChange={(event) => onChange({ paymentStatus: event.target.value })}
            className="filter-control"
          >
            <option value="all">All payments</option>
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{prettify(option)}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Fulfillment">
          <select
            value={value.fulfillmentStatus}
            onChange={(event) => onChange({ fulfillmentStatus: event.target.value })}
            className="filter-control"
          >
            <option value="all">All fulfillment</option>
            {FULFILLMENT_OPTIONS.map((option) => (
              <option key={option} value={option}>{prettify(option)}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Design">
          <select
            value={value.designStatus}
            onChange={(event) => onChange({ designStatus: event.target.value })}
            className="filter-control"
          >
            <option value="all">All design stages</option>
            {DESIGN_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{prettify(option)}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Production">
          <select
            value={value.productionStatus}
            onChange={(event) => onChange({ productionStatus: event.target.value })}
            className="filter-control"
          >
            <option value="all">All production</option>
            {PRODUCTION_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{prettify(option)}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="From">
          <input
            type="date"
            value={value.dateFrom}
            onChange={(event) => onChange({ dateFrom: event.target.value })}
            className="filter-control"
          />
        </FilterField>

        <FilterField label="To">
          <input
            type="date"
            value={value.dateTo}
            onChange={(event) => onChange({ dateTo: event.target.value })}
            className="filter-control"
          />
        </FilterField>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-[#555]">
          <input
            type="checkbox"
            checked={value.attentionOnly}
            onChange={(event) => onChange({ attentionOnly: event.target.checked })}
          />
          Show only orders needing attention
        </label>
        <button
          type="button"
          onClick={onClear}
          className="h-8 px-3 rounded-lg border border-[#d5d5d5] bg-white text-xs font-medium hover:bg-[#f7f7f7]"
        >
          Clear filters
        </button>
      </div>

      <style>{".filter-control{margin-top:.25rem;height:2.25rem;width:100%;border-radius:.5rem;border:1px solid #d5d5d5;background:white;padding:0 .65rem;font-size:.8rem;outline:none}.filter-control:focus{box-shadow:0 0 0 2px rgba(0,0,0,.08)}"}</style>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label>
      <span className="text-[10px] uppercase tracking-wide text-[#777]">{label}</span>
      {children}
    </label>
  );
}

function QuickSelect({ value, options, onChange, disabled, ariaLabel }) {
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="h-8 max-w-[190px] rounded-lg border border-[#d5d5d5] bg-white px-2 text-xs font-medium capitalize disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option} value={option}>{prettify(option)}</option>
        ))}
      </select>
    </div>
  );
}

function OrderActions({ order, busy, onView, onCopy, onComplete, onCancel }) {
  return (
    <div onClick={(event) => event.stopPropagation()} className="inline-flex">
      <details className="relative">
        <summary
          className={
            "list-none h-8 w-8 rounded-lg border border-[#d5d5d5] inline-grid place-items-center hover:bg-[#f5f5f5] " +
            (busy ? "pointer-events-none opacity-40" : "cursor-pointer")
          }
          aria-label={"Actions for " + order.order_number}
        >
          <MoreHorizontal size={16} />
        </summary>
        <div className="absolute right-0 z-50 mt-1 min-w-[210px] rounded-lg border border-[#dedede] bg-white p-1 shadow-xl text-left">
          <ActionMenuButton onClick={onView}>
            <ShoppingBag size={14} /> View order
          </ActionMenuButton>
          <ActionMenuButton onClick={onCopy}>
            <Copy size={14} /> Copy order number
          </ActionMenuButton>
          <div className="my-1 h-px bg-[#ececec]" />
          <ActionMenuButton
            disabled={order.status === "completed"}
            onClick={onComplete}
          >
            <CheckCircle2 size={14} /> Mark completed
          </ActionMenuButton>
          <ActionMenuButton onClick={() => window.location.assign("/admin/returns")}>
            <RotateCcw size={14} /> Returns & refunds
          </ActionMenuButton>
          <div className="my-1 h-px bg-[#ececec]" />
          <ActionMenuButton
            disabled={order.status === "cancelled"}
            onClick={onCancel}
            danger
          >
            <Ban size={14} /> Cancel order
          </ActionMenuButton>
        </div>
      </details>
    </div>
  );
}

function ActionMenuButton({ children, onClick, disabled = false, danger = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
        const details = event.currentTarget.closest("details");
        if (details) details.open = false;
      }}
      className={
        "w-full rounded-md px-2 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none " +
        (danger ? "text-red-600 hover:bg-red-50" : "text-[#333] hover:bg-[#f5f5f5]")
      }
    >
      {children}
    </button>
  );
}

function OrderDrawer({ order, saving, onClose, onSave }) {
  const initialValues = () => ({
    status: order.status || "pending_payment",
    designStatus: order.design_status || "not_required",
    productionStatus: order.production_status || "not_started",
    fulfillmentStatus: order.fulfillment_status || "unfulfilled",
    trackingNumber: order.tracking_number || "",
    carrier: order.carrier || "",
    notes: order.notes || "",
  });

  const [values, setValues] = useState(initialValues);
  const [savedValues, setSavedValues] = useState(initialValues);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    const next = initialValues();
    setValues(next);
    setSavedValues(next);
  }, [
    order.id,
    order.status,
    order.design_status,
    order.production_status,
    order.fulfillment_status,
    order.tracking_number,
    order.carrier,
    order.notes,
  ]);

  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      setActivity(await adminOrdersApi.activity(order.id));
    } catch (err) {
      console.error("Order activity load failed:", err);
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [order.id]);

  const hasUnsavedChanges = Object.keys(values).some(
    (key) => values[key] !== savedValues[key]
  );

  const saveAll = async () => {
    if (!hasUnsavedChanges) return true;
    const ok = await onSave(order, values);
    if (ok !== false) {
      setSavedValues(values);
      await loadActivity();
      return true;
    }
    return false;
  };

  const { requestAction: requestOrderAction } = useUnsavedChangesGuard({
    isDirty: hasUnsavedChanges,
    onSave: saveAll,
    label: "Order: " + order.order_number,
  });

  const requestClose = () =>
    requestOrderAction(onClose, {
      title: "Unsaved order changes",
      description: "Save the order changes before closing, discard them, or keep editing.",
    });

  const setField = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        onClick={requestClose}
        aria-label="Close order details"
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[680px] bg-white shadow-2xl flex flex-col">
        <div className="shrink-0 h-16 px-5 border-b border-[#e3e3e3] bg-white flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">{order.order_number}</div>
            <div className="text-xs text-[#777]">{dateTime(order.created_at)}</div>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="h-9 px-3 rounded-lg bg-[#222] text-white text-xs font-medium inline-flex items-center gap-2 disabled:opacity-40"
              >
                <Save size={14} />
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
            <button onClick={requestClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Total" value={money(order.total)} />
            <MiniStat label="Items" value={itemCount(order)} />
            <MiniStat label="Payment" value={prettify(order.payment_status)} />
            <MiniStat label="Priority" value={prettify(order.priority || "standard")} />
          </div>

          <Section title="Workflow controls">
            <div className="grid sm:grid-cols-2 gap-3">
              <WorkflowSelect
                label="Order status"
                value={values.status}
                options={STATUS_OPTIONS}
                onChange={(value) => setField("status", value)}
              />
              <WorkflowSelect
                label="Fulfillment"
                value={values.fulfillmentStatus}
                options={FULFILLMENT_OPTIONS}
                onChange={(value) => setField("fulfillmentStatus", value)}
              />
              <WorkflowSelect
                label="Design"
                value={values.designStatus}
                options={DESIGN_STATUS_OPTIONS}
                onChange={(value) => setField("designStatus", value)}
              />
              <WorkflowSelect
                label="Production"
                value={values.productionStatus}
                options={PRODUCTION_STATUS_OPTIONS}
                onChange={(value) => setField("productionStatus", value)}
              />
            </div>
            <div className="mt-3 rounded-lg bg-[#f7f7f7] p-3 text-xs leading-5 text-[#666]">
              Payment is controlled separately by Stripe. Design, production and fulfillment can now move independently without overwriting each other.
            </div>
          </Section>

          <Section title="Customer">
            <InfoGrid
              rows={[
                ["Checkout type", order.is_guest ? "Guest checkout" : "Customer account"],
                ["Name", order.customer_name || "Guest"],
                ["Email", order.customer_email],
                ["Phone", order.customer_phone || "—"],
                ["Shipping method", order.shipping_method || "—"],
              ]}
            />
          </Section>

          <Section title={"Items (" + itemCount(order) + ")"}>
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
                  value={values.carrier}
                  onChange={(event) => setField("carrier", event.target.value)}
                  placeholder="Canada Post, UPS…"
                  className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-medium text-[#666]">Tracking number</span>
                <input
                  value={values.trackingNumber}
                  onChange={(event) => setField("trackingNumber", event.target.value)}
                  placeholder="Tracking number"
                  className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 text-xs text-[#666] inline-flex items-center gap-2">
              <Truck size={14} />
              Tracking changes are recorded in the order activity history.
            </div>
          </Section>

          <Section title="Internal notes">
            <textarea
              value={values.notes}
              onChange={(event) => setField("notes", event.target.value)}
              rows={4}
              placeholder="Production notes, customer follow-up, special handling…"
              className="w-full rounded-lg border border-[#d5d5d5] px-3 py-2 text-sm resize-y"
            />
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

          <Section title="Activity">
            <ActivityTimeline events={activity} loading={activityLoading} />
          </Section>
        </div>
      </aside>
    </div>
  );
}

function WorkflowSelect({ label, value, options, onChange }) {
  return (
    <label>
      <span className="text-[10px] uppercase tracking-wide text-[#777]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm bg-white capitalize"
      >
        {options.map((option) => (
          <option key={option} value={option}>{prettify(option)}</option>
        ))}
      </select>
    </label>
  );
}

function ActivityTimeline({ events, loading }) {
  if (loading) {
    return <div className="text-sm text-[#777]">Loading activity…</div>;
  }

  if (!events.length) {
    return (
      <div className="text-sm text-[#777]">
        No recorded workflow changes yet. New changes will appear here automatically.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="relative pl-5">
          <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#555]" />
          <div className="text-sm font-medium capitalize">
            {prettify(event.activity_type)}
          </div>
          <div className="text-xs text-[#666] mt-1">
            {event.from_value || "—"} → {event.to_value || "—"}
          </div>
          <div className="text-[11px] text-[#999] mt-1">{dateTime(event.created_at)}</div>
        </div>
      ))}
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

function StatusPill({ value, compact = false }) {
  const normalized = String(value || "unknown");
  const label = prettify(normalized);
  const good = ["paid", "approved", "delivered", "completed", "fulfilled", "picked_up"].includes(normalized);
  const danger = ["payment_failed", "failed", "cancelled", "refunded"].includes(normalized);
  const warning = ["pending_payment", "pending", "revision_requested", "awaiting_approval", "due_soon"].includes(normalized);
  const color = good
    ? "bg-emerald-100 text-emerald-800"
    : danger
      ? "bg-red-100 text-red-700"
      : warning
        ? "bg-amber-100 text-amber-800"
        : "bg-[#eeeeee] text-[#555]";

  return (
    <span className={"inline-flex rounded-full font-medium capitalize " + color + " " + (compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]")}>
      {label}
    </span>
  );
}

function Th({ children, right = false }) {
  return (
    <th className={"px-4 py-2.5 font-medium " + (right ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}

function Td({ children, right = false }) {
  return (
    <td className={"px-4 py-3 align-top " + (right ? "text-right" : "text-left")}>
      {children}
    </td>
  );
}
