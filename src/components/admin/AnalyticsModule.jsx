import React, { useEffect, useState } from "react";
import {
  BarChart3,
  CircleDollarSign,
  ShoppingBag,
  Users,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { adminAnalyticsApi } from "@/lib/adminAnalyticsApi";

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function shortMoney(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `$${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `$${(number / 1000).toFixed(1)}K`;
  return `$${Math.round(number)}`;
}

export default function AnalyticsModule() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminAnalyticsApi.load(days));
    } catch (err) {
      console.error("Analytics load failed:", err);
      setError(err?.message || "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  const metrics = data?.metrics || {};

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs text-[#777]">
          Commerce performance based on GDP order and product data.
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="h-9 rounded-lg border border-[#d5d5d5] bg-white px-3 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
          <button onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <MetricCard label="Revenue" value={loading ? "—" : money(metrics.revenue)} icon={CircleDollarSign} />
        <MetricCard label="Orders" value={loading ? "—" : metrics.orders ?? 0} icon={ShoppingBag} />
        <MetricCard label="Average order" value={loading ? "—" : money(metrics.averageOrderValue)} icon={BarChart3} />
        <MetricCard label="Customers" value={loading ? "—" : metrics.customers ?? 0} icon={Users} />
        <MetricCard label="Custom order share" value={loading ? "—" : `${Number(metrics.customOrderShare || 0).toFixed(1)}%`} icon={Sparkles} />
      </div>

      <div className="mt-6 grid xl:grid-cols-[1.7fr_1fr] gap-6">
        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e8e8e8]">
            <div className="text-sm font-semibold">Revenue trend</div>
            <div className="text-xs text-[#777] mt-0.5">Paid order revenue by day</div>
          </div>
          <div className="h-[330px] p-3">
            {loading ? (
              <div className="h-full grid place-items-center text-sm text-[#777]">Loading chart…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.series || []} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    minTickGap={28}
                    tickFormatter={(value) => value.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={shortMoney} width={48} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "revenue" ? [money(value), "Revenue"] : [value, name]
                    }
                    labelFormatter={(value) => new Date(`${value}T12:00:00`).toLocaleDateString("en-CA")}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="currentColor" fill="currentColor" fillOpacity={0.08} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e8e8e8]">
            <div className="text-sm font-semibold">Order status mix</div>
            <div className="text-xs text-[#777] mt-0.5">Current period</div>
          </div>
          <div className="divide-y divide-[#eeeeee]">
            {(data?.statuses || []).slice(0, 9).map((row) => (
              <div key={row.status} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 text-sm capitalize">{String(row.status).replaceAll("_", " ")}</div>
                <div className="text-sm font-semibold">{row.count}</div>
              </div>
            ))}
            {!loading && !(data?.statuses || []).length && (
              <div className="py-10 text-center text-sm text-[#777]">No order data for this period.</div>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e8e8e8]">
          <div className="text-sm font-semibold">Top products</div>
          <div className="text-xs text-[#777] mt-0.5">Paid line-item revenue</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Product</Th>
                <Th right>Units</Th>
                <Th right>Custom units</Th>
                <Th right>Revenue</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center text-[#777]">Loading products…</td></tr>
              ) : (data?.topProducts || []).length ? (
                data.topProducts.map((row) => (
                  <tr key={row.name} className="border-t border-[#eeeeee]">
                    <Td><span className="font-medium">{row.name}</span></Td>
                    <Td right>{row.units}</Td>
                    <Td right>{row.customUnits}</Td>
                    <Td right><span className="font-semibold">{money(row.revenue)}</span></Td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="py-12 text-center text-[#777]">No paid product sales in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }) {
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

function Th({ children, right = false }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right = false }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}
