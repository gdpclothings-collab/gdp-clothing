import React, { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Search,
  Clock3,
  CheckCircle2,
  RefreshCw,
  Mail,
  XCircle,
  RotateCcw,
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

export default function AbandonedCheckoutsModule() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("abandoned");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await adminOrderOperationsApi.listCheckoutSessions({ status, search }));
    } catch (err) {
      console.error("Abandoned checkout load failed:", err);
      setError(err?.message || "Could not load checkout sessions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const stats = useMemo(
    () => ({
      visible: rows.length,
      value: rows
        .filter((row) => ["abandoned", "active"].includes(row.status))
        .reduce((sum, row) => sum + Number(row.total || 0), 0),
      knownEmail: rows.filter((row) => Boolean(row.customer_email)).length,
      converted: rows.filter((row) => row.status === "converted").length,
    }),
    [rows]
  );

  const setLifecycle = async (row, nextStatus) => {
    try {
      await adminOrderOperationsApi.setCheckoutStatus(row.id, nextStatus);
      setNotice(
        nextStatus === "recovered"
          ? "Checkout marked recovered."
          : nextStatus === "expired"
            ? "Checkout closed as expired."
            : "Checkout status updated."
      );
      window.setTimeout(() => setNotice(""), 2200);
      await load();
    } catch (err) {
      console.error("Checkout lifecycle update failed:", err);
      setNotice(err?.message || "Could not update checkout.");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Metric label="Visible sessions" value={stats.visible} icon={ShoppingCart} />
        <Metric label="Recoverable value" value={money(stats.value)} icon={RotateCcw} />
        <Metric label="Known email" value={stats.knownEmail} icon={Mail} />
        <Metric label="Converted" value={stats.converted} icon={CheckCircle2} />
      </div>

      <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm font-semibold text-blue-950">Checkout tracking is active.</div>
        <div className="text-xs text-blue-800 mt-1 leading-5">
          A checkout is classified as abandoned after 30 minutes without activity. Payment-prepared orders move into Orders instead of remaining in this list.
        </div>
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer name or email"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {["abandoned", "active", "converted", "recovered", "expired", "all"].map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={`h-8 px-3 rounded-full text-xs font-medium border capitalize whitespace-nowrap ${
                  status === item
                    ? "bg-[#222] text-white border-[#222]"
                    : "bg-white border-[#d5d5d5]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center justify-center gap-2"
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
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Customer</Th>
                <Th>Cart</Th>
                <Th>Status</Th>
                <Th right>Total</Th>
                <Th>Last activity</Th>
                <Th>Recovery</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-14 text-center text-[#777]">
                    Loading checkout sessions…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-14 text-center">
                    <ShoppingCart size={23} className="mx-auto text-[#aaa]" />
                    <div className="font-medium mt-3">No matching checkout sessions</div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cart = Array.isArray(row.cart) ? row.cart : [];
                  const itemCount = cart.reduce(
                    (sum, item) => sum + Number(item.quantity || 1),
                    0
                  );

                  return (
                    <tr key={row.id} className="border-t border-[#eeeeee] hover:bg-[#fafafa]">
                      <Td>
                        <div className="font-semibold">{row.customer_name || "Anonymous checkout"}</div>
                        <div className="text-[11px] text-[#777]">{row.customer_email || "Email not entered"}</div>
                      </Td>
                      <Td>
                        <div>{itemCount} item{itemCount === 1 ? "" : "s"}</div>
                        <div className="text-[11px] text-[#777] mt-0.5">
                          {cart.slice(0, 2).map((item) => item.name).filter(Boolean).join(", ") || "Cart details captured"}
                        </div>
                      </Td>
                      <Td><StatusPill value={row.status} /></Td>
                      <Td right><span className="font-semibold">{money(row.total)}</span></Td>
                      <Td>
                        <div>{formatDate(row.last_activity_at)}</div>
                        <div className="text-[11px] text-[#888] mt-0.5">
                          <Clock3 size={11} className="inline mr-1" />
                          {formatDate(row.created_at)}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          {row.customer_email && ["abandoned", "active"].includes(row.status) && (
                            <button
                              onClick={() => setLifecycle(row, "recovered")}
                              className="h-8 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold"
                            >
                              Mark recovered
                            </button>
                          )}
                          {["abandoned", "active"].includes(row.status) && (
                            <button
                              onClick={() => setLifecycle(row, "expired")}
                              className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] text-xs"
                              title="Close this checkout"
                            >
                              <XCircle size={13} />
                            </button>
                          )}
                          {row.status === "converted" && row.converted_order_id && (
                            <span className="text-[11px] text-[#777]">Order created</span>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
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

function StatusPill({ value }) {
  const classes = {
    abandoned: "bg-amber-100 text-amber-800",
    active: "bg-blue-100 text-blue-800",
    converted: "bg-emerald-100 text-emerald-800",
    recovered: "bg-violet-100 text-violet-800",
    expired: "bg-[#eeeeee] text-[#555]",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${classes[value] || "bg-[#eee] text-[#555]"}`}>
      {value}
    </span>
  );
}

function Th({ children, right }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}
