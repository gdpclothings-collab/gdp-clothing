import React, { useEffect, useState } from "react";
import {
  Search,
  Users,
  UserCheck,
  Repeat2,
  CircleDollarSign,
  ChevronLeft,
  ChevronRight,
  X,
  ShoppingBag,
  Mail,
  Phone,
} from "lucide-react";
import { adminCustomersApi } from "@/lib/adminCustomersApi";

const PAGE_SIZE = 25;

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
  }).format(new Date(value));
}

function prettify(value) {
  return String(value || "—").replaceAll("_", " ");
}

export default function CustomersModule() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminCustomersApi.list({
        search,
        page,
        pageSize: PAGE_SIZE,
      });
      setCustomers(result.customers);
      setTotal(result.total);
      setSummary(result.summary);
    } catch (err) {
      console.error("Customers module load failed:", err);
      setError(err?.message || "Could not load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Customers" value={summary?.customers ?? "—"} icon={Users} />
        <SummaryCard label="Repeat customers" value={summary?.repeatCustomers ?? "—"} icon={Repeat2} />
        <SummaryCard label="Registered" value={summary?.registeredCustomers ?? "—"} icon={UserCheck} />
        <SummaryCard label="Paid customer revenue" value={summary ? money(summary.totalCustomerRevenue) : "—"} icon={CircleDollarSign} />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7]">
          <div className="relative max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer name, email or phone"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] outline-none focus:ring-2 focus:ring-black/10 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Customer</Th>
                <Th>Orders</Th>
                <Th>Paid orders</Th>
                <Th right>Total spent</Th>
                <Th right>Average order</Th>
                <Th>Last order</Th>
                <Th>Account</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-14 text-center text-[#777]">Loading customers…</td></tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Users size={22} className="mx-auto text-[#aaa]" />
                    <div className="font-medium mt-3">No matching customers</div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelected(customer)}
                    className="border-t border-[#eeeeee] hover:bg-[#fafafa] cursor-pointer"
                  >
                    <Td>
                      <div className="font-semibold">{customer.name}</div>
                      <div className="text-[11px] text-[#777]">{customer.email}</div>
                      {customer.phone && <div className="text-[11px] text-[#999]">{customer.phone}</div>}
                    </Td>
                    <Td>{customer.orders}</Td>
                    <Td>{customer.paidOrders}</Td>
                    <Td right><span className="font-semibold">{money(customer.totalSpent)}</span></Td>
                    <Td right>{money(customer.averageOrderValue)}</Td>
                    <Td>{formatDate(customer.lastOrderAt)}</Td>
                    <Td>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        customer.userId ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]"
                      }`}>
                        {customer.userId ? "Registered" : "Guest"}
                      </span>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#e7e7e7] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[#777]">
            {total === 0
              ? "0 customers"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} customers`}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs inline-flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs text-[#777] px-2">Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs inline-flex items-center gap-1 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CustomerDrawer({ customer, onClose }) {
  return (
    <div className="fixed inset-0 z-[70]">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Close customer details" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[580px] bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 h-16 px-5 border-b border-[#e3e3e3] bg-white flex items-center justify-between">
          <div>
            <div className="font-semibold">{customer.name}</div>
            <div className="text-xs text-[#777]">{customer.email}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniStat label="Orders" value={customer.orders} />
            <MiniStat label="Paid" value={customer.paidOrders} />
            <MiniStat label="Spent" value={money(customer.totalSpent)} />
            <MiniStat label="AOV" value={money(customer.averageOrderValue)} />
          </div>

          <Section title="Contact">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><Mail size={15} className="text-[#777]" /> {customer.email}</div>
              <div className="flex items-center gap-2"><Phone size={15} className="text-[#777]" /> {customer.phone || "No phone on file"}</div>
              <div className="text-xs text-[#777]">
                First order {formatDate(customer.firstOrderAt)} · Last order {formatDate(customer.lastOrderAt)}
              </div>
            </div>
          </Section>

          <Section title="Order history">
            <div className="space-y-2">
              {customer.orderRows.map((order) => (
                <div key={order.id} className="rounded-lg border border-[#e6e6e6] p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#f2f2f2] grid place-items-center">
                    <ShoppingBag size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{order.order_number}</div>
                    <div className="text-[11px] text-[#777] capitalize">
                      {prettify(order.status)} · {formatDate(order.created_at)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{money(order.total)}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </aside>
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

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-[#f7f7f7] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[#777]">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
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

function Th({ children, right = false }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right = false }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}
