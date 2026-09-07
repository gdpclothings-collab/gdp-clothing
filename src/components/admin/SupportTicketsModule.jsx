import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Inbox,
  Mail,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { adminSupportTicketsApi } from "@/lib/adminSupportTicketsApi";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

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

function categoryLabel(value) {
  const labels = {
    order_support: "Order support",
    custom_order: "Custom design / custom order",
    product_question: "Product or sizing question",
    return_exchange: "Return or exchange",
    shipping: "Shipping or delivery",
    general: "General question",
  };
  return labels[value] || value || "General";
}

function statusClass(value) {
  if (value === "open") return "bg-amber-100 text-amber-900";
  if (value === "in_progress") return "bg-blue-100 text-blue-900";
  if (value === "resolved") return "bg-emerald-100 text-emerald-900";
  return "bg-[#ededed] text-[#555]";
}

function priorityClass(value) {
  if (value === "urgent") return "bg-red-100 text-red-800";
  if (value === "high") return "bg-orange-100 text-orange-800";
  if (value === "low") return "bg-[#f1f1f1] text-[#666]";
  return "bg-blue-50 text-blue-800";
}

function Metric({ label, value, helper }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="text-xs text-[#777]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-[11px] text-[#999]">{helper}</div>
    </div>
  );
}

export default function SupportTicketsModule() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [updating, setUpdating] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setTickets(await adminSupportTicketsApi.list());
    } catch (error) {
      console.error("Support tickets load failed:", error);
      setLoadError(error?.message || "Could not load support tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === "open").length;
    const inProgress = tickets.filter(
      (ticket) => ticket.status === "in_progress"
    ).length;
    const urgent = tickets.filter(
      (ticket) =>
        ["open", "in_progress"].includes(ticket.status) &&
        ["high", "urgent"].includes(ticket.priority)
    ).length;
    const resolved = tickets.filter(
      (ticket) => ticket.status === "resolved"
    ).length;
    return { open, inProgress, urgent, resolved };
  }, [tickets]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus =
        status === "all"
          ? true
          : status === "active"
            ? ["open", "in_progress"].includes(ticket.status)
            : ticket.status === status;

      const matchesPriority =
        priority === "all" ? true : ticket.priority === priority;

      const haystack = [
        ticket.subject,
        ticket.customer_name,
        ticket.customer_email,
        ticket.customer_phone,
        ticket.order_number,
        ticket.category,
        ticket.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesPriority &&
        (!term || haystack.includes(term))
      );
    });
  }, [tickets, search, status, priority]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) || null;

  const updateTicket = async (ticket, patch) => {
    if (!ticket?.id) return;
    setUpdating(ticket.id);
    try {
      const updated = await adminSupportTicketsApi.update(ticket.id, patch);
      setTickets((current) =>
        current.map((item) => (item.id === ticket.id ? updated : item))
      );
    } catch (error) {
      console.error("Support ticket update failed:", error);
      window.alert(error?.message || "Could not update this ticket.");
    } finally {
      setUpdating("");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Metric label="Open" value={metrics.open} helper="New requests" />
        <Metric
          label="In progress"
          value={metrics.inProgress}
          helper="Being handled"
        />
        <Metric
          label="High priority"
          value={metrics.urgent}
          helper="Active high / urgent"
        />
        <Metric
          label="Resolved"
          value={metrics.resolved}
          helper="Completed requests"
        />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e8e8e8] flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, order number or message"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2 xl:ml-auto">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-9 rounded-lg border border-[#d5d5d5] bg-white px-3 text-sm"
            >
              <option value="active">Active tickets</option>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="h-9 rounded-lg border border-[#d5d5d5] bg-white px-3 text-sm"
            >
              <option value="all">All priorities</option>
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={load}
              className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Customer</th>
                <th className="px-4 py-2.5 text-left font-medium">Request</th>
                <th className="px-4 py-2.5 text-left font-medium">Order</th>
                <th className="px-4 py-2.5 text-left font-medium">Priority</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Received</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-14 text-center text-sm text-[#777]"
                  >
                    Loading support tickets…
                  </td>
                </tr>
              ) : visible.length ? (
                visible.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-[#eeeeee]">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">
                        {ticket.customer_name || "Customer"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#777]">
                        {ticket.customer_email}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top max-w-[360px]">
                      <button
                        type="button"
                        onClick={() => setSelectedId(ticket.id)}
                        className="text-left"
                      >
                        <div className="font-medium line-clamp-1">
                          {ticket.subject}
                        </div>
                        <div className="mt-1 text-[11px] text-[#777]">
                          {categoryLabel(ticket.category)}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {ticket.order_number || "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${priorityClass(
                          ticket.priority
                        )}`}
                      >
                        {ticket.priority || "normal"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClass(
                          ticket.status
                        )}`}
                      >
                        {STATUS_OPTIONS.find(
                          (item) => item.value === ticket.status
                        )?.label || ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[#666]">
                      {formatDate(ticket.created_at)}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(ticket.id)}
                        className="h-8 px-3 rounded-lg border border-[#d5d5d5] bg-white text-xs font-medium"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="py-14 text-center text-sm text-[#777]"
                  >
                    No support tickets match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[80] bg-black/40 p-3 sm:p-8 flex items-start justify-center overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="px-5 py-4 border-b border-[#e5e5e5] flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#f1f1f1] grid place-items-center shrink-0">
                <Inbox size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[#777]">
                  Ticket {String(selected.id).slice(0, 8).toUpperCase()}
                </div>
                <div className="mt-1 font-semibold text-lg">
                  {selected.subject}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-2 rounded-lg hover:bg-[#f2f2f2]"
                aria-label="Close ticket"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 grid md:grid-cols-[1fr_240px] gap-6">
              <div>
                <div className="rounded-xl border border-[#e5e5e5] p-4">
                  <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#888]">
                    Customer message
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#333]">
                    {selected.message}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#e5e5e5] p-4">
                  <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#888]">
                    Customer
                  </div>
                  <div className="mt-3 text-sm font-medium">
                    {selected.customer_name || "Customer"}
                  </div>
                  <a
                    href={`mailto:${selected.customer_email}`}
                    className="mt-1 text-sm inline-flex items-center gap-2 hover:underline"
                  >
                    <Mail size={14} /> {selected.customer_email}
                  </a>
                  {selected.customer_phone ? (
                    <div className="mt-2 text-sm text-[#555]">
                      {selected.customer_phone}
                    </div>
                  ) : null}
                  {selected.order_number ? (
                    <div className="mt-3 pt-3 border-t border-[#eeeeee] text-sm">
                      <span className="text-[#777]">Order number:</span>{" "}
                      <strong>{selected.order_number}</strong>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#666]">Status</label>
                  <select
                    value={selected.status}
                    disabled={updating === selected.id}
                    onChange={(event) =>
                      updateTicket(selected, { status: event.target.value })
                    }
                    className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] bg-white px-3 text-sm disabled:opacity-60"
                  >
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#666]">
                    Priority
                  </label>
                  <select
                    value={selected.priority || "normal"}
                    disabled={updating === selected.id}
                    onChange={(event) =>
                      updateTicket(selected, { priority: event.target.value })
                    }
                    className="mt-1 w-full h-10 rounded-lg border border-[#d5d5d5] bg-white px-3 text-sm disabled:opacity-60"
                  >
                    {PRIORITY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg bg-[#f6f6f6] p-3 text-xs leading-5 text-[#666]">
                  <div className="flex gap-2">
                    <Clock3 size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-[#333]">Received</div>
                      {formatDate(selected.created_at)}
                    </div>
                  </div>
                </div>

                <a
                  href={`mailto:${selected.customer_email}?subject=${encodeURIComponent(
                    `Re: ${selected.subject}`
                  )}`}
                  className="w-full h-10 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  Reply by email <ExternalLink size={14} />
                </a>

                {selected.status !== "resolved" ? (
                  <button
                    type="button"
                    disabled={updating === selected.id}
                    onClick={() =>
                      updateTicket(selected, { status: "resolved" })
                    }
                    className="w-full h-10 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <CheckCircle2 size={15} /> Mark resolved
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
