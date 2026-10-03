import React from "react";
import { Download, Minus, TrendingDown, TrendingUp } from "lucide-react";

const CATEGORY_LABELS = {
  garments: "Garments",
  dtf_transfers: "DTF transfers",
  ink: "Ink",
  packaging: "Packaging",
  shipping: "Shipping",
  local_delivery: "Local delivery",
  advertising: "Advertising",
  website_hosting: "Website / hosting",
  domain: "Domain",
  software: "Software",
  equipment: "Equipment",
  supplies: "Supplies",
  merchant_fees: "Merchant fees",
  miscellaneous: "Miscellaneous",
};

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function formatMonth(value) {
  if (!value) return "—";
  const [year, month] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short" })
    .format(new Date(year || 2000, Math.max(0, (month || 1) - 1), 1));
}

function changePercent(current, previous) {
  const now = Number(current || 0);
  const before = Number(previous || 0);
  if (before === 0) return now === 0 ? 0 : null;
  return ((now - before) / Math.abs(before)) * 100;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsv(report, rangeLabel) {
  const lines = [];
  const row = (values) => lines.push(values.map(csvCell).join(","));
  const current = report?.current || {};
  const previous = report?.previous || null;

  row(["GDP Clothing Finance Report"]);
  row(["Selected range", rangeLabel]);
  row(["Generated", report?.generatedAt || ""]);
  row([]);
  row(["P&L summary", "Current", "Previous"]);
  [
    ["Gross sales", "grossSales"],
    ["Discounts", "discounts"],
    ["Net merchandise sales", "netMerchandiseSales"],
    ["Shipping revenue", "shippingCollected"],
    ["COGS", "cogs"],
    ["Gross profit", "grossProfit"],
    ["Refunds", "recordedRefunds"],
    ["Operating expenses", "expenses"],
    ["Stripe fees", "processorFees"],
    ["Net profit before income tax", "netProfit"],
    ["Sales tax collected", "taxCollected"],
  ].forEach(([label, key]) => row([label, current?.[key] ?? "", previous?.[key] ?? ""]));

  row([]);
  row(["Monthly P&L"]);
  row(["Month", "Orders", "Gross sales", "Discounts", "Net merchandise sales", "Shipping", "COGS", "Gross profit", "Refunds", "Expenses", "Stripe fees", "Net profit", "Net margin %", "Complete"]);
  (report?.monthlyPnl || []).forEach((item) => row([
    item.month,
    item.paidOrders,
    item.grossSales,
    item.discounts,
    item.netMerchandiseSales,
    item.shippingCollected,
    item.cogs,
    item.grossProfit ?? "",
    item.recordedRefunds,
    item.expenses,
    item.processorFees,
    item.netProfit ?? "",
    item.netMarginPercent ?? "",
    item.complete ? "Yes" : "No",
  ]));

  row([]);
  row(["Expense breakdown"]);
  row(["Category", "Entries", "Amount before tax", "Tax", "Total"]);
  (report?.expenseBreakdown || []).forEach((item) => row([
    CATEGORY_LABELS[item.category] || item.category,
    item.entries,
    item.amount,
    item.tax,
    item.total,
  ]));

  row([]);
  row(["Operational tax summary"]);
  row(["Sales tax collected", report?.taxSummary?.salesTaxCollected ?? 0]);
  row(["Expense tax recorded", report?.taxSummary?.expenseTaxRecorded ?? 0]);
  row(["Difference - informational only", report?.taxSummary?.differenceInformational ?? 0]);
  row(["Filing ready", "No - combined tax ledger does not separate GST/PST"]);

  return lines.join("\r\n");
}

function downloadReport(report, rangeLabel) {
  const csv = buildCsv(report, rangeLabel);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `gdp-finance-report-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function FinanceReportsPanel(props) {
  const { data, loading, rangeLabel } = props;
  const current = data?.current || null;
  const previous = data?.previous || null;
  const monthly = Array.isArray(data?.monthlyPnl) ? data.monthlyPnl : [];
  const expenses = Array.isArray(data?.expenseBreakdown) ? data.expenseBreakdown : [];
  const tax = data?.taxSummary || null;
  const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.total || 0), 0);

  if (loading) {
    return <div className="py-12 text-center text-sm text-[#777]">Loading financial reports…</div>;
  }

  if (!current) {
    return <div className="py-12 text-center text-sm text-[#777]">No report data is available.</div>;
  }

  return (
    <div className="pt-5 space-y-5">
      {data?.stripeSync?.ok === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold">Stripe report sync needs attention</div>
          <div className="text-xs mt-1">{data.stripeSync.message || "Stored processor-fee data is being used."} Sales and checkout are unaffected.</div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-base font-semibold">Financial reports</div>
          <div className="mt-1 text-xs text-[#777]">{rangeLabel} summary plus a trailing 12-month P&amp;L. All values are live-mode only.</div>
        </div>
        <button
          type="button"
          onClick={() => downloadReport(data, rangeLabel)}
          className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm font-medium inline-flex items-center justify-center gap-2"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed]">
          <div className="text-sm font-semibold">Period comparison</div>
          <div className="text-xs text-[#777] mt-0.5">Selected period compared with the immediately preceding period of equal length.</div>
        </div>
        {previous ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
            <CompareCard label="Net merchandise sales" current={current.netMerchandiseSales} previous={previous.netMerchandiseSales} moneyValue />
            <CompareCard label="Gross profit" current={current.grossProfit} previous={previous.grossProfit} moneyValue unavailable={!current.cogsComplete || !previous.cogsComplete} />
            <CompareCard label="Net profit" current={current.netProfit} previous={previous.netProfit} moneyValue unavailable={!current.complete || !previous.complete} />
            <CompareCard label="Paid orders" current={current.paidOrders} previous={previous.paidOrders} />
          </div>
        ) : (
          <div className="p-5 text-sm text-[#777]">Previous-period comparison is unavailable for All time.</div>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed]">
            <div className="text-sm font-semibold">Profit &amp; loss — {rangeLabel}</div>
            <div className="text-xs text-[#777] mt-0.5">Operational P&amp;L before income tax. Sales tax collected is excluded from profit.</div>
          </div>
          <div className="p-4 space-y-3">
            <ReportRow label="Gross merchandise sales" value={money(current.grossSales)} />
            <ReportRow label="Discounts" value={`−${money(current.discounts)}`} />
            <ReportRow label="Net merchandise sales" value={money(current.netMerchandiseSales)} strong />
            <ReportRow label="COGS" value={`−${money(current.cogs)}`} />
            <ReportRow label="Gross profit" value={current.cogsComplete ? money(current.grossProfit) : "Incomplete COGS"} strong />
            <ReportRow label="Shipping revenue" value={money(current.shippingCollected)} />
            <ReportRow label="Processed refunds" value={`−${money(current.recordedRefunds)}`} />
            <ReportRow label="Operating expenses" value={`−${money(current.expenses)}`} />
            <ReportRow label="Actual Stripe fees" value={`−${money(current.processorFees)}`} />
            <ReportRow
              label="Net profit before income tax"
              value={current.complete ? money(current.netProfit) : "Complete COGS + Stripe fees"}
              strong
            />
            <ReportRow label="Net margin" value={current.complete && current.netMarginPercent !== null ? `${Number(current.netMarginPercent).toFixed(1)}%` : "—"} />
          </div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed]">
            <div className="text-sm font-semibold">Operational tax summary</div>
            <div className="text-xs text-[#777] mt-0.5">Visibility for bookkeeping only; not a GST/PST filing calculation.</div>
          </div>
          <div className="p-4 grid sm:grid-cols-2 gap-3">
            <TaxCard label="Sales tax collected" value={money(tax?.salesTaxCollected)} />
            <TaxCard label="Expense tax recorded" value={money(tax?.expenseTaxRecorded)} />
            <TaxCard label="Difference" value={money(tax?.differenceInformational)} sub="Informational only" />
            <TaxCard label="Filing status" value="Not filing-ready" sub="Current ledger combines tax and does not separate GST/PST." warning />
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed]">
          <div className="text-sm font-semibold">12-month profit &amp; loss</div>
          <div className="text-xs text-[#777] mt-0.5">Monthly operational performance. A dash means COGS or Stripe fee coverage for that month is incomplete.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr><Th>Month</Th><Th right>Orders</Th><Th right>Net sales</Th><Th right>Shipping</Th><Th right>COGS</Th><Th right>Gross profit</Th><Th right>Refunds</Th><Th right>Expenses</Th><Th right>Stripe fees</Th><Th right>Net profit</Th><Th right>Margin</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {monthly.length ? monthly.map((item) => (
                <tr key={item.month} className="border-t border-[#eeeeee]">
                  <Td><span className="font-semibold">{formatMonth(item.month)}</span></Td>
                  <Td right>{item.paidOrders || 0}</Td>
                  <Td right>{money(item.netMerchandiseSales)}</Td>
                  <Td right>{money(item.shippingCollected)}</Td>
                  <Td right>{money(item.cogs)}</Td>
                  <Td right>{item.cogsComplete ? money(item.grossProfit) : "—"}</Td>
                  <Td right>{money(item.recordedRefunds)}</Td>
                  <Td right>{money(item.expenses)}</Td>
                  <Td right>{money(item.processorFees)}</Td>
                  <Td right>{item.complete ? <span className="font-semibold">{money(item.netProfit)}</span> : "—"}</Td>
                  <Td right>{item.complete && item.netMarginPercent !== null ? `${Number(item.netMarginPercent).toFixed(1)}%` : "—"}</Td>
                  <Td><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${item.complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{item.complete ? "Complete" : "Needs data"}</span></Td>
                </tr>
              )) : <tr><td colSpan={12} className="py-12 text-center text-[#777]">No monthly report rows.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed]">
          <div className="text-sm font-semibold">Expense breakdown — {rangeLabel}</div>
          <div className="text-xs text-[#777] mt-0.5">Admin-recorded operating expenses grouped by category.</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Category</Th><Th right>Entries</Th><Th right>Before tax</Th><Th right>Tax</Th><Th right>Total</Th><Th right>Share</Th></tr></thead>
            <tbody>
              {expenses.length ? expenses.map((item) => {
                const share = expenseTotal > 0 ? (Number(item.total || 0) / expenseTotal) * 100 : 0;
                return (
                  <tr key={item.category} className="border-t border-[#eeeeee]">
                    <Td><span className="font-medium">{CATEGORY_LABELS[item.category] || String(item.category || "Miscellaneous").replaceAll("_", " ")}</span></Td>
                    <Td right>{item.entries || 0}</Td>
                    <Td right>{money(item.amount)}</Td>
                    <Td right>{money(item.tax)}</Td>
                    <Td right><span className="font-semibold">{money(item.total)}</span></Td>
                    <Td right>{share.toFixed(1)}%</Td>
                  </tr>
                );
              }) : <tr><td colSpan={6} className="py-12 text-center text-[#777]">No operating expenses recorded in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CompareCard(props) {
  const { label, current, previous, moneyValue = false, unavailable = false } = props;
  const change = unavailable ? null : changePercent(current, previous);
  const Icon = change === null || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const formatted = unavailable ? "—" : moneyValue ? money(current) : String(Number(current || 0));
  const changeText = unavailable ? "Incomplete data" : change === null ? "New vs zero" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;

  return (
    <div className="rounded-xl border border-[#e2e2e2] p-4">
      <div className="text-xs text-[#777]">{label}</div>
      <div className="mt-2 text-xl font-semibold">{formatted}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#777]"><Icon size={12} /> {changeText}</div>
    </div>
  );
}

function ReportRow(props) {
  const { label, value, strong = false } = props;
  return <div className={`flex items-center justify-between gap-4 text-sm ${strong ? "pt-3 border-t border-[#ededed] font-semibold" : ""}`}><span className="text-[#666]">{label}</span><span>{value}</span></div>;
}

function TaxCard(props) {
  const { label, value, sub = "", warning = false } = props;
  return <div className={`rounded-xl border p-4 ${warning ? "border-amber-200 bg-amber-50" : "border-[#e2e2e2]"}`}><div className="text-xs text-[#777]">{label}</div><div className="mt-2 text-lg font-semibold">{value}</div>{sub && <div className="mt-1 text-[11px] text-[#777]">{sub}</div>}</div>;
}

function Th(props) {
  const { children, right = false } = props;
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td(props) {
  const { children, right = false } = props;
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}
