import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgePercent,
  Boxes,
  CircleDollarSign,
  FileWarning,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Trash2,
  Truck,
  WalletCards,
} from "lucide-react";
import { adminFinanceApi } from "@/lib/adminFinanceApi";
import { Link } from "react-router-dom";
import StripeFinancePanel from "@/components/admin/StripeFinancePanel";

const RANGE_OPTIONS = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["year", "This year"],
  ["all", "All time"],
];

const EXPENSE_CATEGORIES = [
  ["garments", "Garments"],
  ["dtf_transfers", "DTF transfers"],
  ["ink", "Ink"],
  ["packaging", "Packaging"],
  ["shipping", "Shipping"],
  ["local_delivery", "Local delivery"],
  ["advertising", "Advertising"],
  ["website_hosting", "Website / hosting"],
  ["domain", "Domain"],
  ["software", "Software"],
  ["equipment", "Equipment"],
  ["supplies", "Supplies"],
  ["merchant_fees", "Merchant fees"],
  ["miscellaneous", "Miscellaneous"],
];

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

function localDateInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

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

function categoryLabel(value) {
  return EXPENSE_CATEGORIES.find(([id]) => id === value)?.[1]
    || String(value || "Miscellaneous").replaceAll("_", " ");
}

export default function FinanceModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("month");
  const [tab, setTab] = useState("overview");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingCostId, setSavingCostId] = useState("");
  const [expenseForm, setExpenseForm] = useState({
    occurredOn: localDateInputValue(),
    vendor: "",
    category: "garments",
    description: "",
    amount: "",
    tax: "0",
    paymentMethod: "",
    notes: "",
  });

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminFinanceApi.load({ ...rangeDates(selectedRange), limit: 500 }));
    } catch (err) {
      console.error("Finance module load failed:", err);
      setError(err?.message || "Could not load finance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // Range is the only trigger; load is intentionally called with the explicit value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const metrics = data?.metrics || {};
  const recordedRefunds = Number(metrics.recordedRefunds || 0);
  const netCollected = Number(metrics.paidRevenue || 0) - recordedRefunds;
  const cogsTotalItems = Number(metrics.cogsTotalItems || 0);
  const cogsConfiguredItems = Number(metrics.cogsConfiguredItems || 0);
  const cogsComplete = cogsTotalItems === cogsConfiguredItems;
  const grossProfitAvailable = metrics.grossProfit !== null && metrics.grossProfit !== undefined;
  const stripeExpectedOrders = Number(metrics.stripeFeeExpectedOrders || 0);
  const stripeCapturedOrders = Number(metrics.stripeFeeCapturedOrders || 0);
  const stripeFeesComplete = stripeExpectedOrders === stripeCapturedOrders;
  const netProfitAvailable = grossProfitAvailable && stripeFeesComplete;
  const netProfit = netProfitAvailable
    ? Number(metrics.grossProfit || 0)
      + Number(metrics.shippingCollected || 0)
      - recordedRefunds
      - Number(metrics.expenses || 0)
      - Number(metrics.processorFees || 0)
    : null;
  const netProfitRevenueBase = Number(metrics.grossSales || 0)
    - Number(metrics.discounts || 0)
    + Number(metrics.shippingCollected || 0);
  const netMarginPercent = netProfitAvailable && netProfitRevenueBase > 0
    ? (Number(netProfit || 0) / netProfitRevenueBase) * 100
    : null;

  const saveExpense = async (event) => {
    event.preventDefault();
    setSavingExpense(true);
    setError("");
    try {
      await adminFinanceApi.createExpense(expenseForm);
      setExpenseForm((current) => ({
        ...current,
        occurredOn: localDateInputValue(),
        vendor: "",
        description: "",
        amount: "",
        tax: "0",
        paymentMethod: "",
        notes: "",
      }));
      setShowExpenseForm(false);
      setTab("expenses");
      await load();
    } catch (err) {
      setError(err?.message || "Could not save expense.");
    } finally {
      setSavingExpense(false);
    }
  };

  const saveCogs = async (orderItemId, values) => {
    setSavingCostId(orderItemId);
    setError("");
    try {
      await adminFinanceApi.updateCogs(orderItemId, values);
      await load();
    } catch (err) {
      setError(err?.message || "Could not save COGS.");
    } finally {
      setSavingCostId("");
    }
  };

  const removeExpense = async (expense) => {
    if (!window.confirm(`Delete expense “${expense.description}”?`)) return;
    setError("");
    try {
      await adminFinanceApi.deleteExpense(expense.id);
      await load();
    } catch (err) {
      setError(err?.message || "Could not delete expense.");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#282828]">Live-mode financial reporting</div>
          <div className="mt-1 text-xs text-[#777]">
            Stripe test payments are excluded. Actual Stripe fees and payouts sync from Stripe; Net Profit appears only when COGS and processor-fee coverage are complete.
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center justify-start gap-2 2xl:w-auto 2xl:shrink-0">
          <div className="flex max-w-full flex-wrap rounded-lg border border-[#d9d9d9] bg-white p-1">
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
          <button type="button" onClick={() => load()} className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#d5d5d5] bg-white px-3 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/admin/finance/tax" className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#d5d5d5] bg-white px-3 text-sm font-semibold hover:bg-[#f7f7f8]"><ReceiptText size={15} /> Tax Center</Link>
          <button type="button" onClick={() => setShowExpenseForm((value) => !value)} className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#171717] px-3 text-sm font-semibold text-white">
            <Plus size={15} /> Expense
          </button>
        </div>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {data?.stripeSync?.ok === false && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div><span className="font-semibold">Stripe settlement sync unavailable:</span> {data.stripeSync.message || "Stored settlement data is being shown."} Checkout and payment processing are unaffected.</div>
        </div>
      )}

      {Number(metrics.testPaidOrdersExcluded || 0) > 0 && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Test sales excluded:</span>{" "}
            {metrics.testPaidOrdersExcluded} paid test order{Number(metrics.testPaidOrdersExcluded) === 1 ? "" : "s"} totaling {money(metrics.testPaidRevenueExcluded)} are not counted as GDP live revenue.
          </div>
        </div>
      )}

      {!loading && cogsTotalItems > 0 && !cogsComplete && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">COGS incomplete:</span>{" "}
            {cogsConfiguredItems} of {cogsTotalItems} sold line items are costed ({Number(metrics.cogsCoveragePercent || 0).toFixed(1)}%). Open the COGS tab to complete the missing item costs.
          </div>
        </div>
      )}

      {!loading && stripeExpectedOrders > stripeCapturedOrders && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Stripe fee coverage incomplete:</span>{" "}
            {stripeCapturedOrders} of {stripeExpectedOrders} paid live order{stripeExpectedOrders === 1 ? "" : "s"} have captured processor fees. Refresh Finance to resync Stripe before relying on Net Profit.
          </div>
        </div>
      )}

      {showExpenseForm && (
        <ExpenseForm
          value={expenseForm}
          onChange={setExpenseForm}
          onSubmit={saveExpense}
          onCancel={() => setShowExpenseForm(false)}
          saving={savingExpense}
        />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard label="Gross sales" value={loading ? "—" : money(metrics.grossSales)} icon={WalletCards} />
        <MetricCard label="Discounts" value={loading ? "—" : money(metrics.discounts)} icon={BadgePercent} />
        <MetricCard label="COGS" value={loading ? "—" : money(metrics.cogs)} icon={Boxes} sub={`${Number(metrics.cogsCoveragePercent || 0).toFixed(1)}% coverage`} warning={!cogsComplete && cogsTotalItems > 0} />
        <MetricCard label="Gross profit" value={loading ? "—" : grossProfitAvailable ? money(metrics.grossProfit) : "—"} icon={CircleDollarSign} sub={grossProfitAvailable ? `${Number(metrics.grossMarginPercent || 0).toFixed(1)}% merchandise margin` : "Complete COGS first"} warning={!grossProfitAvailable && cogsTotalItems > 0} />
        <MetricCard label="Stripe fees" value={loading ? "—" : money(metrics.processorFees)} icon={ReceiptText} sub={`${Number(metrics.stripeFeeCoveragePercent || 0).toFixed(1)}% fee coverage`} warning={!stripeFeesComplete && stripeExpectedOrders > 0} />
        <MetricCard label="Net profit" value={loading ? "—" : netProfitAvailable ? money(netProfit) : "—"} icon={CircleDollarSign} sub={netProfitAvailable ? `${Number(netMarginPercent || 0).toFixed(1)}% margin · before income tax` : "Complete COGS + Stripe fees"} warning={!netProfitAvailable && (cogsTotalItems > 0 || stripeExpectedOrders > 0)} />
        <MetricCard label="Paid collected" value={loading ? "—" : money(metrics.paidRevenue)} icon={CircleDollarSign} sub={`${metrics.paidOrders || 0} paid live orders`} />
        <MetricCard label="Recorded refunds" value={loading ? "—" : money(recordedRefunds)} icon={RotateCcw} sub={Number(metrics.pendingRefunds || 0) > 0 ? `${money(metrics.pendingRefunds)} pending` : "No pending amount"} />
        <MetricCard label="Net collected" value={loading ? "—" : money(netCollected)} icon={CircleDollarSign} sub="Paid collected − processed refunds" />
        <MetricCard label="Tax collected" value={loading ? "—" : money(metrics.taxCollected)} icon={ReceiptText} />
        <MetricCard label="Shipping revenue" value={loading ? "—" : money(metrics.shippingCollected)} icon={Truck} />
        <MetricCard label="Recorded expenses" value={loading ? "—" : money(metrics.expenses)} icon={ReceiptText} sub="Amount + expense tax" />
        <MetricCard label="Stripe payouts" value={loading ? "—" : money(metrics.paidPayoutAmount)} icon={WalletCards} sub={`${metrics.paidPayoutCount || 0} paid payout(s) · cash transfer`} />
        <MetricCard label="Open disputes" value={loading ? "—" : String(metrics.openDisputeCount || 0)} icon={FileWarning} sub={money(metrics.openDisputeAmount)} warning={Number(metrics.openDisputeCount || 0) > 0} />
        <MetricCard label="Refunded orders" value={loading ? "—" : String(metrics.refundOrders || 0)} icon={RotateCcw} />
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-[#dedede]">
        {[
          ["overview", "Overview"],
          ["transactions", "Transactions"],
          ["cogs", "COGS"],
          ["stripe", "Stripe fees & payouts"],
          ["expenses", "Expenses"],
          ["refunds", "Refunds & disputes"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === id ? "border-[#171717] text-[#171717]" : "border-transparent text-[#777] hover:text-[#333]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-4 pt-5">
          <SummaryCard title="Sales flow">
            <SummaryRow label="Gross merchandise sales" value={money(metrics.grossSales)} />
            <SummaryRow label="Discounts" value={`−${money(metrics.discounts)}`} />
            <SummaryRow label="COGS" value={`−${money(metrics.cogs)}`} />
            <SummaryRow label="Gross profit before refunds" value={grossProfitAvailable ? money(metrics.grossProfit) : "Incomplete COGS"} strong />
            <SummaryRow label="Shipping charged" value={money(metrics.shippingCollected)} />
            <SummaryRow label="Processed refunds recorded" value={`−${money(recordedRefunds)}`} />
            <SummaryRow label="Recorded expenses" value={`−${money(metrics.expenses)}`} />
            <SummaryRow label="Actual Stripe fees" value={`−${money(metrics.processorFees)}`} />
            <SummaryRow label="Net profit before income tax" value={netProfitAvailable ? money(netProfit) : "Incomplete COGS / Stripe fees"} strong />
            <SummaryRow label="Tax collected (excluded from profit)" value={money(metrics.taxCollected)} />
            <SummaryRow label="Net collected cash" value={money(netCollected)} />
          </SummaryCard>
          <SummaryCard title="Accounting completeness">
            <CompletenessRow ok label="Live/test payment separation" text="Test-mode paid orders are excluded from financial totals." />
            <CompletenessRow ok label="Refund records" text="Existing GDP refund records are included without creating duplicates." />
            <CompletenessRow ok label="Stripe disputes" text="Existing secured dispute records are surfaced through an admin-only snapshot." />
            <CompletenessRow ok label="Operating expenses" text="Manual business expenses can be recorded securely." />
            <CompletenessRow ok={cogsComplete} label="COGS / item cost snapshots" text={cogsTotalItems ? `${cogsConfiguredItems} of ${cogsTotalItems} sold line items configured. Historical snapshots do not change when catalog costs change.` : "COGS snapshot system is active; no sold line items are in this period."} />
            <CompletenessRow ok={stripeFeesComplete} label="Actual Stripe fees" text={stripeExpectedOrders ? `${stripeCapturedOrders} of ${stripeExpectedOrders} paid live orders have processor-fee capture from Stripe's balance ledger.` : "Stripe processor-fee capture is active; no paid live orders require matching in this period."} />
            <CompletenessRow ok label="Stripe payouts" text="Payouts are synchronized for bank reconciliation and are not subtracted from profit because they are cash transfers." />
          </SummaryCard>
        </div>
      )}

      {tab === "transactions" && <TransactionTable loading={loading} transactions={data?.transactions || []} />}
      {tab === "cogs" && <CogsTable loading={loading} items={data?.costItems || []} savingCostId={savingCostId} onSave={saveCogs} />}
      {tab === "stripe" && <StripeFinancePanel loading={loading} balanceTransactions={data?.balanceTransactions || []} payouts={data?.payouts || []} sync={data?.stripeSync || {}} metrics={metrics} />}
      {tab === "expenses" && <ExpenseTable loading={loading} expenses={data?.expenses || []} onDelete={removeExpense} />}
      {tab === "refunds" && <RefundDisputeTables loading={loading} refunds={data?.refunds || []} disputes={data?.disputes || []} />}
    </div>
  );
}

function ExpenseForm({ value, onChange, onSubmit, onCancel, saving }) {
  const update = (key, next) => onChange((current) => ({ ...current, [key]: next }));
  return (
    <form onSubmit={onSubmit} className="mb-5 rounded-xl border border-[#dcdcdc] bg-white p-4 md:p-5">
      <div className="mb-4">
        <div className="font-semibold">Record an expense</div>
        <div className="text-xs text-[#777] mt-1">For GDP operating costs. Sales totals remain automatic from orders.</div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Field label="Date"><input type="date" required value={value.occurredOn} onChange={(e) => update("occurredOn", e.target.value)} className="h-10 w-full rounded-lg border border-[#d8d8d8] px-3 text-sm" /></Field>
        <Field label="Category"><select value={value.category} onChange={(e) => update("category", e.target.value)} className="h-10 w-full rounded-lg border border-[#d8d8d8] px-3 text-sm bg-white">{EXPENSE_CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
        <Field label="Vendor"><input value={value.vendor} onChange={(e) => update("vendor", e.target.value)} placeholder="Supplier or store" className="h-10 w-full rounded-lg border border-[#d8d8d8] px-3 text-sm" /></Field>
        <Field label="Description"><input required value={value.description} onChange={(e) => update("description", e.target.value)} placeholder="What was purchased?" className="h-10 w-full rounded-lg border border-[#d8d8d8] px-3 text-sm" /></Field>
        <Field label="Amount before tax"><input type="number" required min="0.01" step="0.01" value={value.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0.00" className="h-10 w-full rounded-lg border border-[#d8d8d8] px-3 text-sm" /></Field>
        <Field label="Tax"><input type="number" min="0" step="0.01" value={value.tax} onChange={(e) => update("tax", e.target.value)} placeholder="0.00" className="h-10 w-full rounded-lg border border-[#d8d8d8] px-3 text-sm" /></Field>
        <Field label="Payment method"><input value={value.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)} placeholder="Card, cash, bank…" className="h-10 w-full rounded-lg border border-[#d8d8d8] px-3 text-sm" /></Field>
        <Field label="Notes"><input value={value.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Optional" className="h-10 w-full rounded-lg border border-[#d8d8d8] px-3 text-sm" /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 px-4 rounded-lg border border-[#d8d8d8] text-sm font-medium">Cancel</button>
        <button disabled={saving} type="submit" className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save expense"}</button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="block text-xs font-medium text-[#666] mb-1.5">{label}</span>{children}</label>;
}

function MetricCard({ label, value, icon: Icon, sub = "", warning = false }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${warning ? "border-amber-300" : "border-[#dedede]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">{label}</div>
        <Icon size={16} className={warning ? "text-amber-600" : "text-[#777]"} />
      </div>
      <div className="text-xl font-semibold mt-2">{value}</div>
      {sub && <div className="text-[11px] text-[#777] mt-1">{sub}</div>}
    </div>
  );
}

function SummaryCard({ title, children }) {
  return <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#ededed] text-sm font-semibold">{title}</div><div className="p-4 space-y-3">{children}</div></section>;
}

function SummaryRow({ label, value, strong = false }) {
  return <div className={`flex items-center justify-between gap-4 text-sm ${strong ? "pt-3 border-t border-[#ededed] font-semibold" : ""}`}><span className="text-[#666]">{label}</span><span>{value}</span></div>;
}

function CompletenessRow({ ok = false, label, text }) {
  return <div className="flex gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-400"}`} /><div><div className="text-sm font-medium">{label}</div><div className="text-xs text-[#777] mt-0.5">{text}</div></div></div>;
}

function TransactionTable({ loading, transactions }) {
  return (
    <TableShell title="Transactions" subtitle="Live-mode GDP orders only; test-mode orders are excluded.">
      <table className="w-full min-w-[1400px] text-sm">
        <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order</Th><Th>Customer</Th><Th>Payment</Th><Th right>Subtotal</Th><Th right>Discount</Th><Th right>COGS</Th><Th right>Gross profit</Th><Th right>Stripe fee</Th><Th right>Shipping</Th><Th right>Tax</Th><Th right>Total</Th><Th>Date</Th></tr></thead>
        <tbody>
          {loading ? <EmptyRow cols={12}>Loading transactions…</EmptyRow> : transactions.length ? transactions.map((order) => {
            const itemCount = Number(order.cogs_item_count || 0);
            const configuredCount = Number(order.cogs_configured_item_count || 0);
            const orderCogsComplete = itemCount > 0 && itemCount === configuredCount;
            return (
              <tr key={order.id} className="border-t border-[#eeeeee]">
                <Td><span className="font-semibold">{order.order_number}</span></Td>
                <Td><div>{order.customer_name || "Guest"}</div><div className="text-[11px] text-[#777]">{order.customer_email}</div></Td>
                <Td><Status value={order.payment_status} /></Td>
                <Td right>{money(order.subtotal)}</Td><Td right>{money(order.discount)}</Td>
                <Td right>{orderCogsComplete ? money(order.cogs) : <span className="text-amber-700">Incomplete</span>}</Td>
                <Td right>{order.gross_profit !== null && order.gross_profit !== undefined ? <span className="font-semibold">{money(order.gross_profit)}</span> : "—"}</Td>
                <Td right>{order.stripe_fee_captured ? money(order.stripe_fee) : order.stripe_payment_intent_id ? <span className="text-amber-700">Pending</span> : "—"}</Td>
                <Td right>{money(order.shipping)}</Td><Td right>{money(order.tax)}</Td>
                <Td right><span className="font-semibold">{money(order.total)}</span></Td><Td>{formatDate(order.created_at)}</Td>
              </tr>
            );
          }) : <EmptyRow cols={12}>No live-mode transactions in this period.</EmptyRow>}
        </tbody>
      </table>
    </TableShell>
  );
}

function CogsTable({ loading, items, savingCostId, onSave }) {
  return (
    <TableShell title="Cost of goods sold (COGS)" subtitle="Product/variant Cost per item auto-seeds garment cost when an order item is created. Add DTF/print, packaging, or other production cost here; historical snapshots stay frozen unless you edit this row.">
      <table className="w-full min-w-[1500px] text-sm">
        <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order / item</Th><Th>Variant</Th><Th right>Qty</Th><Th right>Sale / unit</Th><Th right>Garment</Th><Th right>DTF / print</Th><Th right>Packaging</Th><Th right>Other</Th><Th right>Total COGS</Th><Th>Source</Th><Th /></tr></thead>
        <tbody>
          {loading ? <EmptyRow cols={11}>Loading COGS…</EmptyRow> : items.length ? items.map((item) => (
            <CogsRow key={item.order_item_id} item={item} saving={savingCostId === item.order_item_id} onSave={onSave} />
          )) : <EmptyRow cols={11}>No sold live-mode items in this period.</EmptyRow>}
        </tbody>
      </table>
    </TableShell>
  );
}

function CogsRow({ item, saving, onSave }) {
  const [costs, setCosts] = useState({
    garmentUnitCost: String(item.garment_unit_cost ?? 0),
    printUnitCost: String(item.print_unit_cost ?? 0),
    packagingUnitCost: String(item.packaging_unit_cost ?? 0),
    otherUnitCost: String(item.other_unit_cost ?? 0),
  });

  useEffect(() => {
    setCosts({
      garmentUnitCost: String(item.garment_unit_cost ?? 0),
      printUnitCost: String(item.print_unit_cost ?? 0),
      packagingUnitCost: String(item.packaging_unit_cost ?? 0),
      otherUnitCost: String(item.other_unit_cost ?? 0),
    });
  }, [item.garment_unit_cost, item.print_unit_cost, item.packaging_unit_cost, item.other_unit_cost]);

  const quantity = Number(item.quantity_snapshot || item.quantity || 1);
  const unitCogs = Number(costs.garmentUnitCost || 0) + Number(costs.printUnitCost || 0) + Number(costs.packagingUnitCost || 0) + Number(costs.otherUnitCost || 0);
  const totalCogs = unitCogs * quantity;
  const inputClass = "h-8 w-24 rounded-md border border-[#d8d8d8] px-2 text-right text-xs outline-none focus:ring-2 focus:ring-black/10";
  const update = (key, value) => setCosts((current) => ({ ...current, [key]: value }));

  return (
    <tr className={`border-t border-[#eeeeee] ${item.is_configured ? "" : "bg-amber-50/40"}`}>
      <Td><div className="font-semibold">{item.order_number}</div><div className="text-xs mt-0.5">{item.name}</div><div className="text-[11px] text-[#777] mt-0.5">{formatDate(item.order_created_at)}</div></Td>
      <Td><div>{item.variant || [item.color, item.size].filter(Boolean).join(" / ") || "—"}</div>{item.is_custom && <div className="text-[11px] text-[#777] mt-0.5">Custom Studio</div>}</Td>
      <Td right>{quantity}</Td>
      <Td right>{money(item.unit_price, item.currency || "CAD")}</Td>
      <Td right><input aria-label={`Garment cost for ${item.name}`} type="number" min="0" step="0.01" value={costs.garmentUnitCost} onChange={(event) => update("garmentUnitCost", event.target.value)} className={inputClass} /></Td>
      <Td right><input aria-label={`DTF or print cost for ${item.name}`} type="number" min="0" step="0.01" value={costs.printUnitCost} onChange={(event) => update("printUnitCost", event.target.value)} className={inputClass} /></Td>
      <Td right><input aria-label={`Packaging cost for ${item.name}`} type="number" min="0" step="0.01" value={costs.packagingUnitCost} onChange={(event) => update("packagingUnitCost", event.target.value)} className={inputClass} /></Td>
      <Td right><input aria-label={`Other cost for ${item.name}`} type="number" min="0" step="0.01" value={costs.otherUnitCost} onChange={(event) => update("otherUnitCost", event.target.value)} className={inputClass} /></Td>
      <Td right><span className="font-semibold">{money(totalCogs, item.currency || "CAD")}</span></Td>
      <Td><div className="capitalize">{String(item.cost_source || "unconfigured").replaceAll("_", " ")}</div><div className={`text-[11px] mt-0.5 ${item.is_configured ? "text-emerald-700" : "text-amber-700"}`}>{item.is_configured ? "Configured" : "Needs cost"}</div></Td>
      <Td right><button type="button" disabled={saving} onClick={() => onSave(item.order_item_id, costs)} className="h-8 px-3 rounded-md bg-[#171717] text-white text-xs font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save"}</button></Td>
    </tr>
  );
}

function ExpenseTable({ loading, expenses, onDelete }) {
  return (
    <TableShell title="Expenses" subtitle="Admin-recorded GDP operating expenses for the selected period.">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Category</Th><Th>Vendor</Th><Th>Description</Th><Th right>Amount</Th><Th right>Tax</Th><Th right>Total</Th><Th /></tr></thead>
        <tbody>
          {loading ? <EmptyRow cols={8}>Loading expenses…</EmptyRow> : expenses.length ? expenses.map((expense) => (
            <tr key={expense.id} className="border-t border-[#eeeeee]">
              <Td>{formatDate(`${expense.occurred_on}T12:00:00`, false)}</Td><Td>{categoryLabel(expense.category)}</Td><Td>{expense.vendor || "—"}</Td>
              <Td><div className="font-medium">{expense.description}</div>{expense.notes && <div className="text-[11px] text-[#777] mt-0.5">{expense.notes}</div>}</Td>
              <Td right>{money(expense.amount, expense.currency)}</Td><Td right>{money(expense.tax, expense.currency)}</Td>
              <Td right><span className="font-semibold">{money(Number(expense.amount || 0) + Number(expense.tax || 0), expense.currency)}</span></Td>
              <Td right><button type="button" onClick={() => onDelete(expense)} className="h-8 w-8 inline-grid place-items-center rounded-lg border border-[#e1e1e1] text-[#777] hover:text-red-600" aria-label={`Delete ${expense.description}`}><Trash2 size={14} /></button></Td>
            </tr>
          )) : <EmptyRow cols={8}>No expenses recorded in this period.</EmptyRow>}
        </tbody>
      </table>
    </TableShell>
  );
}

function RefundDisputeTables({ loading, refunds, disputes }) {
  return (
    <div className="space-y-5 pt-5">
      <TableShell title="Refund records" subtitle="Pending refunds are separate from processed refund totals.">
        <table className="w-full min-w-[800px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order</Th><Th>Status</Th><Th>Reason</Th><Th right>Amount</Th><Th>Date</Th></tr></thead><tbody>
          {loading ? <EmptyRow cols={5}>Loading refunds…</EmptyRow> : refunds.length ? refunds.map((refund) => <tr key={refund.id} className="border-t border-[#eeeeee]"><Td><span className="font-semibold">{refund.order_number || "—"}</span></Td><Td><Status value={refund.status} /></Td><Td>{refund.reason || "—"}</Td><Td right>{money(refund.amount)}</Td><Td>{formatDate(refund.processed_at || refund.created_at)}</Td></tr>) : <EmptyRow cols={5}>No refund records in this period.</EmptyRow>}
        </tbody></table>
      </TableShell>
      <TableShell title="Stripe disputes" subtitle="Live-mode charge disputes from the protected Stripe dispute ledger.">
        <table className="w-full min-w-[900px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order</Th><Th>Status</Th><Th>Reason</Th><Th right>Amount</Th><Th>Evidence due</Th><Th>Updated</Th></tr></thead><tbody>
          {loading ? <EmptyRow cols={6}>Loading disputes…</EmptyRow> : disputes.length ? disputes.map((dispute) => <tr key={dispute.stripe_dispute_id} className="border-t border-[#eeeeee]"><Td><span className="font-semibold">{dispute.order_number || "Unmatched"}</span></Td><Td><Status value={dispute.status} /></Td><Td><span className="capitalize">{String(dispute.reason || "—").replaceAll("_", " ")}</span></Td><Td right>{money(dispute.amount, dispute.currency || "CAD")}</Td><Td>{dispute.evidence_due_by ? formatDate(dispute.evidence_due_by) : "—"}{dispute.evidence_past_due && <div className="text-[11px] text-red-600 font-semibold">Past due</div>}</Td><Td>{formatDate(dispute.updated_at)}</Td></tr>) : <EmptyRow cols={6}>No live Stripe disputes in this period.</EmptyRow>}
        </tbody></table>
      </TableShell>
    </div>
  );
}

function TableShell({ title, subtitle, children }) {
  return <section className="mt-5 rounded-xl border border-[#dedede] bg-white overflow-hidden"><div className="px-4 py-3 border-b border-[#e8e8e8]"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-[#777] mt-0.5">{subtitle}</div></div><div className="overflow-x-auto">{children}</div></section>;
}

function Status({ value }) {
  const normalized = String(value || "pending").toLowerCase();
  const good = ["paid", "won", "completed", "processed", "succeeded"].includes(normalized);
  const bad = ["failed", "lost"].includes(normalized);
  const cls = good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${cls}`}>{normalized.replaceAll("_", " ")}</span>;
}

function EmptyRow({ cols, children }) {
  return <tr><td colSpan={cols} className="py-12 text-center text-[#777]">{children}</td></tr>;
}

function Th({ children = null, right = false }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children = null, right = false }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}