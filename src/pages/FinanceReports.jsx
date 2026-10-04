import React, { useEffect, useState } from "react";
import { ArrowLeft, Banknote, BarChart3, LockKeyhole, ReceiptText, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import FinanceReportsPanel from "@/components/admin/FinanceReportsPanel";
import { adminFinanceApi } from "@/lib/adminFinanceApi";

const RANGE_OPTIONS = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["year", "This year"],
  ["all", "All time"],
];

function rangeDates(range) {
  if (range === "all") return { from: null, to: null };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "month") start.setDate(1);
  if (range === "year") start.setMonth(0, 1);

  const end = new Date();
  end.setHours(24, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

function previousRangeDates(current) {
  if (!current.from || !current.to) return { previousFrom: null, previousTo: null };
  const start = new Date(current.from).getTime();
  const end = new Date(current.to).getTime();
  const span = Math.max(86_400_000, end - start);
  return {
    previousFrom: new Date(start - span).toISOString(),
    previousTo: new Date(start).toISOString(),
  };
}

function reportSyncDates(months = 12) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(1);
  start.setMonth(start.getMonth() - (months - 1));

  const end = new Date();
  end.setHours(24, 0, 0, 0);
  return { syncFrom: start.toISOString(), syncTo: end.toISOString() };
}

export default function FinanceReports() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError("");
    try {
      const current = rangeDates(selectedRange);
      const report = await adminFinanceApi.loadReport({
        ...current,
        ...previousRangeDates(current),
        ...reportSyncDates(12),
        months: 12,
      });
      setData(report);
    } catch (err) {
      console.error("Finance reports load failed:", err);
      setError(err?.message || "Could not load finance reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // Range is the only trigger; load receives the explicit current value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const rangeLabel = RANGE_OPTIONS.find(([id]) => id === range)?.[1] || "Selected period";

  return (
    <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
        <div className="h-full px-3 md:px-5 flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs shadow-sm shadow-black/30">GDP</div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-none">GDP Clothing</div>
              <div className="text-xs text-white/70 mt-1">Commerce Admin</div>
            </div>
          </Link>
          <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><BarChart3 size={16} /> Finance Reports</div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/admin/finance/cash-flow" className="hidden md:flex h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 items-center gap-2 text-sm font-semibold"><Banknote size={15} /> Cash Flow</Link>
            <Link to="/admin/finance/period-close" className="hidden sm:flex h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 items-center gap-2 text-sm font-semibold"><LockKeyhole size={15} /> Period Close</Link>
            <Link to="/admin/finance/tax" className="h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ReceiptText size={15} /> Tax Center</Link>
            <Link to="/admin/finance" className="h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15} /> Finance</Link>
          </div>
        </div>
      </header>

      <div className="border-b border-[#dedfe3] bg-white">
        <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
          <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">GDP Commerce Admin</div>
          <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Finance Reports</h1>
              <p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Profit &amp; loss, period comparison, expenses, operational tax visibility and CSV exports using the same secured Finance ledger.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap rounded-lg border border-[#d9d9d9] bg-white p-1">
                {RANGE_OPTIONS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRange(id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${range === id ? "bg-[#171717] text-white" : "text-[#666] hover:bg-[#f2f2f2]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => load()} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
        {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <FinanceReportsPanel data={data} loading={loading} rangeLabel={rangeLabel} />
      </main>
    </div>
  );
}
