import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw, ReceiptText, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { adminTaxApi } from "@/lib/adminTaxApi";
import TaxFilingControls from "@/components/admin/TaxFilingControls";

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

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function date(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export default function FinanceTax() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminTaxApi.load({ ...rangeDates(selectedRange), limit: 500 }));
    } catch (err) {
      console.error("Tax center load failed:", err);
      setError(err?.message || "Could not load tax records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const saveExpenseTax = async (expenseId, values) => {
    setSavingId(expenseId);
    setError("");
    try {
      await adminTaxApi.updateExpenseTax(expenseId, values);
      await load();
    } catch (err) {
      setError(err?.message || "Could not update expense tax classification.");
    } finally {
      setSavingId("");
    }
  };

  const summary = data?.summary || {};
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
  const refunds = Array.isArray(data?.refunds) ? data.refunds : [];
  const unclassified = Number(summary.unclassifiedSalesTax || 0) + Number(summary.unclassifiedExpenseTax || 0) + Number(summary.unclassifiedRefundTax || 0);

  return (
    <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
        <div className="h-full px-3 md:px-5 flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div>
            <div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div>
          </Link>
          <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><ReceiptText size={16} /> Tax Center</div>
          <Link to="/admin/finance/reports" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15} /> Reports</Link>
        </div>
      </header>

      <div className="border-b border-[#dedfe3] bg-white">
        <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
          <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">GDP Commerce Admin</div>
          <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">GST/HST &amp; PST Tax Center</h1>
              <p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Separate sales-tax ledgers, refund allocations and GST/HST input-tax-credit review for GDP Clothing.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap rounded-lg border border-[#d9d9d9] bg-white p-1">
                {RANGE_OPTIONS.map(([id, label]) => <button key={id} type="button" onClick={() => setRange(id)} className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${range === id ? "bg-[#171717] text-white" : "text-[#666] hover:bg-[#f2f2f2]"}`}>{label}</button>)}
              </div>
              <button type="button" onClick={() => load()} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh</button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div className="font-semibold">Operational bookkeeping aid — not a filed tax return</div>
          <div className="mt-1 text-xs">GST/HST ITCs are deducted from the estimate only when you explicitly mark an expense ITC eligible. Saskatchewan PST paid on business expenses is shown separately and is not treated as an ITC. Registration and filing-period controls are available below; GDP records filing status but does not submit returns to CRA or Saskatchewan.</div>
        </div>

        <TaxFilingControls />

        {unclassified > 0 && !loading && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3"><AlertTriangle size={18} className="shrink-0 mt-0.5" /><div><span className="font-semibold">Tax classification incomplete:</span> {money(unclassified)} is still combined/unclassified. Review the affected records before relying on a filing estimate.</div></div>}
        {Number(summary.estimatedRefundAllocations || 0) > 0 && !loading && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><span className="font-semibold">Refund review:</span> {summary.estimatedRefundAllocations} partial refund tax allocation(s) use a proportional estimate and should be reviewed against the actual credit/refund document.</div>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="GST/HST collected" value={loading ? "—" : money(summary.gstHstCollected)} />
          <Metric label="GST/HST refunded" value={loading ? "—" : money(summary.gstHstRefunded)} />
          <Metric label="Potential GST/HST ITCs" value={loading ? "—" : money(summary.gstHstPotentialItc)} sub="Only explicitly marked eligible expenses" />
          <Metric label="GST/HST estimate" value={loading ? "—" : money(summary.gstHstEstimateBeforeAdjustments)} sub="Before filing adjustments" strong />
          <Metric label="PST collected" value={loading ? "—" : money(summary.pstCollected)} />
          <Metric label="PST refunded" value={loading ? "—" : money(summary.pstRefunded)} />
          <Metric label="PST net collected" value={loading ? "—" : money(summary.pstNetCollected)} strong />
          <Metric label="PST paid on expenses" value={loading ? "—" : money(summary.pstExpensePaid)} sub="Tracked as cost, not an ITC" />
        </div>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Saskatchewan checkout rule</div><div className="text-xs text-[#777] mt-0.5">Effective October 3, 2026 for GDP's Saskatchewan-origin checkout calculation.</div></div>
          <div className="grid md:grid-cols-3 gap-4 p-4 text-sm">
            <Rule title="GST" value="5%" text="Applied to taxable merchandise and separately stated domestic shipping." />
            <Rule title="Saskatchewan PST" value="6%" text="Applied to taxable merchandise. Separately stated reasonable Saskatchewan-origin delivery is excluded." />
            <Rule title="Combined merchandise rate" value="11%" text="The two taxes remain separate in the ledger rather than being stored only as one combined amount." />
          </div>
        </section>

        <TableShell title="Sales tax ledger" subtitle="Paid live orders only. No customer personal information is exposed here.">
          <table className="w-full min-w-[980px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order</Th><Th>Date</Th><Th>Jurisdiction</Th><Th right>Shipping</Th><Th right>Total tax</Th><Th right>GST/HST</Th><Th right>PST</Th><Th>Status</Th></tr></thead><tbody>
            {loading ? <Empty cols={8}>Loading sales tax…</Empty> : sales.length ? sales.map((row) => { const classified = Math.abs(Number(row.tax || 0) - Number(row.gst_hst_tax || 0) - Number(row.pst_tax || 0)) < 0.011; return <tr key={row.id} className="border-t border-[#eeeeee]"><Td strong>{row.order_number}</Td><Td>{date(row.created_at)}</Td><Td>{row.tax_jurisdiction || "—"}</Td><Td right>{money(row.shipping)}</Td><Td right>{money(row.tax)}</Td><Td right>{money(row.gst_hst_tax)}</Td><Td right>{money(row.pst_tax)}</Td><Td><Badge ok={classified}>{classified ? "Split" : "Review"}</Badge></Td></tr>; }) : <Empty cols={8}>No paid live sales in this period.</Empty>}
          </tbody></table>
        </TableShell>

        <TableShell title="Expense tax review" subtitle="Classify receipt tax and mark GST/HST as ITC eligible only when supported by your business records and registration status.">
          <table className="w-full min-w-[1180px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Vendor / expense</Th><Th right>Before tax</Th><Th right>Recorded tax</Th><Th right>GST/HST</Th><Th right>PST</Th><Th>GST/HST ITC</Th><Th /></tr></thead><tbody>
            {loading ? <Empty cols={8}>Loading expenses…</Empty> : expenses.length ? expenses.map((row) => <ExpenseTaxRow key={row.id} row={row} saving={savingId === row.id} onSave={saveExpenseTax} />) : <Empty cols={8}>No expenses in this period.</Empty>}
          </tbody></table>
        </TableShell>

        <TableShell title="Refund tax allocations" subtitle="Full refunds inherit the order split. Partial refunds are proportionally estimated unless an explicit tax allocation is recorded.">
          <table className="w-full min-w-[900px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order</Th><Th>Date</Th><Th>Status</Th><Th right>Refund</Th><Th right>GST/HST</Th><Th right>PST</Th><Th>Allocation</Th></tr></thead><tbody>
            {loading ? <Empty cols={7}>Loading refunds…</Empty> : refunds.length ? refunds.map((row) => <tr key={row.id} className="border-t border-[#eeeeee]"><Td strong>{row.order_number}</Td><Td>{date(row.refund_date)}</Td><Td>{row.status}</Td><Td right>{money(row.amount)}</Td><Td right>{money(row.gst_hst_tax)}</Td><Td right>{money(row.pst_tax)}</Td><Td><Badge ok={row.tax_allocation_method !== "proportional_estimate"}>{String(row.tax_allocation_method || "unclassified").replaceAll("_", " ")}</Badge></Td></tr>) : <Empty cols={7}>No refunds in this period.</Empty>}
          </tbody></table>
        </TableShell>
      </main>
    </div>
  );
}

function ExpenseTaxRow({ row, saving, onSave }) {
  const [gst, setGst] = useState(String(row.gst_hst_tax ?? 0));
  const [pst, setPst] = useState(String(row.pst_tax ?? 0));
  const [itc, setItc] = useState(Boolean(row.gst_hst_itc_eligible));
  useEffect(() => { setGst(String(row.gst_hst_tax ?? 0)); setPst(String(row.pst_tax ?? 0)); setItc(Boolean(row.gst_hst_itc_eligible)); }, [row.gst_hst_tax, row.pst_tax, row.gst_hst_itc_eligible]);
  const input = "h-8 w-24 rounded-md border border-[#d8d8d8] px-2 text-right text-xs";
  return <tr className="border-t border-[#eeeeee]"><Td>{date(`${row.occurred_on}T12:00:00`)}</Td><Td><div className="font-medium">{row.vendor || "—"}</div><div className="text-xs text-[#777]">{row.description}</div></Td><Td right>{money(row.amount)}</Td><Td right>{money(row.tax)}</Td><Td right><input aria-label={`GST/HST for ${row.description}`} type="number" min="0" step="0.01" value={gst} onChange={(e) => setGst(e.target.value)} className={input} /></Td><Td right><input aria-label={`PST for ${row.description}`} type="number" min="0" step="0.01" value={pst} onChange={(e) => setPst(e.target.value)} className={input} /></Td><Td><label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={itc} onChange={(e) => setItc(e.target.checked)} /> ITC eligible</label></Td><Td right><button type="button" disabled={saving} onClick={() => onSave(row.id, { gstHstTax: gst, pstTax: pst, itcEligible: itc })} className="h-8 px-3 rounded-md bg-[#171717] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"><Save size={12} /> {saving ? "Saving…" : "Save"}</button></Td></tr>;
}

function Metric({ label, value, sub = "", strong = false }) { return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs text-[#777]">{label}</div><div className={`mt-2 text-xl ${strong ? "font-bold" : "font-semibold"}`}>{value}</div>{sub && <div className="mt-1 text-[11px] text-[#777]">{sub}</div>}</div>; }
function Rule({ title, value, text }) { return <div className="rounded-lg bg-[#f7f7f8] p-4"><div className="text-xs text-[#777]">{title}</div><div className="text-2xl font-bold mt-1">{value}</div><div className="text-xs text-[#666] mt-2 leading-5">{text}</div></div>; }
function Badge({ ok, children }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{children}</span>; }
function TableShell({ title, subtitle, children }) { return <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-[#777] mt-0.5">{subtitle}</div></div><div className="overflow-x-auto">{children}</div></section>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="py-12 text-center text-[#777]">{children}</td></tr>; }
function Th({ children = null, right = false }) { return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
