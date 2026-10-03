import React from "react";

function money(value, currency = "CAD") {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  });
}

function formatDate(value, includeTime = true) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function Status({ value }) {
  const normalized = String(value || "pending").toLowerCase();
  const good = ["paid", "completed", "succeeded"].includes(normalized);
  const bad = ["failed", "canceled"].includes(normalized);
  const cls = good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${cls}`}>{normalized.replaceAll("_", " ")}</span>;
}

function Shell({ title, subtitle, children }) {
  return <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#e8e8e8]"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-[#777] mt-0.5">{subtitle}</div></div><div className="overflow-x-auto">{children}</div></section>;
}

function Th({ children, right = false }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right = false }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}

function Empty({ cols, children }) {
  return <tr><td colSpan={cols} className="py-12 text-center text-[#777]">{children}</td></tr>;
}

export default function StripeFinancePanel({ loading, balanceTransactions = [], payouts = [], sync = {}, metrics = {} }) {
  return (
    <div className="pt-5 space-y-5">
      <div className={`rounded-xl border px-4 py-3 text-sm ${sync.ok === false ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
        <div className="font-semibold">{sync.ok === false ? "Stripe sync needs attention" : "Stripe settlement sync active"}</div>
        <div className="text-xs mt-1">
          {sync.ok === false
            ? `${sync.message || "Stored Stripe settlement data is being shown."} No checkout or payment flow is affected.`
            : `${sync.syncedAt ? `Last refreshed ${formatDate(sync.syncedAt)}.` : "Live settlement sync is ready."} Actual Stripe fees come from the Stripe balance ledger.`}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Processor fees" value={money(metrics.processorFees)} sub={`${Number(metrics.stripeFeeCoveragePercent || 0).toFixed(1)}% order fee coverage`} />
        <Stat label="Stripe net settlement" value={money(metrics.stripeNet)} sub={`${metrics.stripeBalanceTransactions || 0} balance transaction(s)`} />
        <Stat label="Paid payouts" value={money(metrics.paidPayoutAmount)} sub={`${metrics.paidPayoutCount || 0} payout(s)`} />
        <Stat label="Payout attention" value={String(Number(metrics.pendingPayoutCount || 0) + Number(metrics.failedPayoutCount || 0))} sub={`${metrics.pendingPayoutCount || 0} pending · ${metrics.failedPayoutCount || 0} failed/canceled`} />
      </div>

      <Shell title="Stripe balance transactions" subtitle="Actual Stripe ledger amounts. Fees are processor fees; payout transfers are not treated as business expenses.">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Type</Th><Th>Order link</Th><Th right>Gross</Th><Th right>Stripe fee</Th><Th right>Net</Th><Th>Available</Th></tr></thead>
          <tbody>
            {loading ? <Empty cols={7}>Loading Stripe ledger…</Empty> : balanceTransactions.length ? balanceTransactions.map((row) => (
              <tr key={row.stripe_balance_transaction_id} className="border-t border-[#eeeeee]">
                <Td>{formatDate(row.stripe_created_at)}</Td>
                <Td><div className="capitalize">{String(row.reporting_category || row.transaction_type || "—").replaceAll("_", " ")}</div><div className="text-[11px] text-[#777]">{row.stripe_balance_transaction_id}</div></Td>
                <Td>{row.order_id ? <span className="text-emerald-700 font-medium">Matched</span> : <span className="text-[#777]">Not order-linked</span>}</Td>
                <Td right>{money(row.amount, row.currency)}</Td>
                <Td right>{money(row.fee, row.currency)}</Td>
                <Td right><span className="font-semibold">{money(row.net, row.currency)}</span></Td>
                <Td>{formatDate(row.available_on)}</Td>
              </tr>
            )) : <Empty cols={7}>No live Stripe balance transactions in this period.</Empty>}
          </tbody>
        </table>
      </Shell>

      <Shell title="Stripe payouts" subtitle="Payouts reconcile Stripe cash moving to the bank. They do not reduce profit because they are transfers of already-earned funds.">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Created</Th><Th>Status</Th><Th>Method</Th><Th right>Amount</Th><Th>Arrival</Th><Th>Failure code</Th></tr></thead>
          <tbody>
            {loading ? <Empty cols={6}>Loading payouts…</Empty> : payouts.length ? payouts.map((row) => (
              <tr key={row.stripe_payout_id} className="border-t border-[#eeeeee]">
                <Td>{formatDate(row.stripe_created_at)}</Td>
                <Td><Status value={row.status} /></Td>
                <Td><span className="capitalize">{String(row.method || row.payout_type || "—").replaceAll("_", " ")}</span>{row.automatic && <div className="text-[11px] text-[#777]">Automatic</div>}</Td>
                <Td right><span className="font-semibold">{money(row.amount, row.currency)}</span></Td>
                <Td>{row.arrival_date ? formatDate(`${row.arrival_date}T12:00:00`, false) : "—"}</Td>
                <Td>{row.failure_code || "—"}</Td>
              </tr>
            )) : <Empty cols={6}>No live Stripe payouts in this period.</Empty>}
          </tbody>
        </table>
      </Shell>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs text-[#777]">{label}</div><div className="text-xl font-semibold mt-2">{value}</div><div className="text-[11px] text-[#777] mt-1">{sub}</div></div>;
}