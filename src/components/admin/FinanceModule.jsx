import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgePercent,
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

const RANGE_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
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

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "month") start.setDate(1);
  if (range === "year") {
    start.setMonth(0, 1);
  }

  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

function categoryLabel(value) {
  return EXPENSE_CATEGORIES.find(([id]) => id === value)?.[1] || String(value || "Miscellaneous").replaceAll("_", " ");
}

export default function FinanceModule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("month");
  const [tab, setTab] = useState("overview");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
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

  const dates = useMemo(() => rangeDates(range), [range]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminFinanceApi.load({ ...dates, limit: 500 }));
    } catch (err) {
      console.error("Finance module load failed:", err);
      setError(err?.message || "Could not load finance data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // dates is memoized from the selected range and intentionally reloads the snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.from, dates.to]);

  const metrics = data?.metrics || {};
  const recordedRefunds = Number(metrics.recordedRefunds || 0);
  const netCollected = Number(metrics.paidRevenue || 0) - recordedRefunds;

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
      await load();
      setTab("expenses");
    } catch (err) {
      setError(err?.message || "Could not save expense.");
    } finally {
      setSavingExpense(false);
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
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#282828]">Live-mode financial reporting</div>
          <div className="mt-1 text-xs text-[#777]">
            Stripe test payments are excluded. Profit stays unlabelled until COGS and actual processor-fee capture are complete.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-lg border border-[#d9d9d9] bg-white p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setRange(option.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${range === option.id ? "bg-[#171717] text-white" : "text-[#666] hover:bg-[#f2f2f2]"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" onClick={() => setShowExpenseForm((value) => !value)} className="h-9 px-3 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center gap-2">
            <Plus size={15} /> Expense
          </button>
        </div>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {Number(metrics.testPaidOrdersExcluded || 0) > 0 && (
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Test sales excluded:</span>{" "}
            {metrics.testPaidOrdersExcluded} paid test order{Number(metrics.testPaidOrdersExcluded) === 1 ? "" : "s"} totaling {money(metrics.testPaidRevenueExcluded)} are not counted as GDP live revenue.
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <MetricCard label="Gross sales" value={loading ? "—" : money(metrics.grossSales)} icon={WalletCards} />
        <MetricCard label="Discounts" value={loading ? "—" : money(metrics.discounts)} icon={BadgePercent} />
        <MetricCard label="Paid collected" value={loading ? "—" : money(metrics.paidRevenue)} icon={CircleDollarSign} sub={`${metrics.paidOrders || 0} paid live orders`} />
        <MetricCard label="Recorded refunds" value={loading ? "—" : money(recordedRefunds)} icon={RotateCcw} sub={Number(metrics.pendingRefunds || 0) > 0 ? `${money(metrics.pendingRefunds)} pending` : "No pending amount"} />
        <MetricCard label="Net collected" value={loading ? "—" : money(netCollected)} icon={CircleDollarSign} sub="Paid collected − processed refunds" />
        <MetricCard label="Tax collected" value={loading ? "—" : money(metrics.taxCollected)} icon={ReceiptText} />
        <MetricCard label="Shipping revenue" value={loading ? "—" : money(metrics.shippingCollected)} icon={Truck} />
        <MetricCard label="Recorded expenses" value={loading ? "—" : money(metrics.expenses)} icon={ReceiptText} sub="Amount + expense tax" />
        <MetricCard label="Open disputes" value={loading ? "—" : String(metrics.openDisputeCount || 0)} icon={FileWarning} sub={money(metrics.openDisputeAmount)} warning={Number(metrics.openDisputeCount || 0) > 0} />
        <MetricCard label="Refunded orders" value={loading ? "—" : String(metrics.refundOrders || 0)} icon={RotateCcw} />
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-[#dedede]">
        {[
          ["overview", "Overview"],
          ["transactions", "Transactions"],
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
            <SummaryRow label="Shipping charged" value={money(metrics.shippingCollected)} />
            <SummaryRow label="Tax collected" value={money(metrics.taxCollected)} />
            <SummaryRow label="Processed refunds recorded" value={`−${money(recordedRefunds)}`} />
            <SummaryRow label="Net collected" value={money(netCollected)} strong />
          </SummaryCard>
          <SummaryCard title="Accounting completeness">
            <CompletenessRow ok label="Live/test payment separation" text="Test-mode paid orders are excluded from financial totals." />
            <CompletenessRow ok label="Refund records" text="Existing GDP refund records are included without creating duplicates." />
            <CompletenessRow ok label="Stripe disputes" text="Existing secured dispute records are surfaced through an admin-only snapshot." />
            <CompletenessRow ok label="Operating expenses" text="Manual business expenses can now be recorded securely." />
            <CompletenessRow label="COGS / item cost snapshots" text="Not included yet; profit is intentionally not shown." />
            <CompletenessRow label="Actual Stripe fees / payouts" text="Not included yet; these need processor-led settlement capture." />
          </SummaryCard>
        </div>
      )}

      {tab === "transactions" && (
        <TransactionTable loading={loading} transactions={data?.transactions || []} />
      )}

      {tab === "expenses" && (
        <ExpenseTable loading={loading} expenses={data?.expenses || []} onDelete={removeExpense} />
      )}

      {tab === "refunds" && (
        <RefundDisputeTables loading={loading} refunds={data?.refunds || []} disputes={data?.disputes || []} />
      )}
    </div>
  );
}

function ExpenseForm({ value, onChange, onSubmit, onCancel, saving }) {
  const update = (key, next) => onChange((current) => ({ ...current, [key]: next }));
  return (
    <form onSubmit={onSubmit} className="mb-5 rounded-xl border border-[#dcdcdc] bg-white p-4 md:p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-semibold">Record an expense</div>
          <div className="text-xs text-[#777] mt-1">For GDP operating costs. Sales totals remain automatic from orders.</div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Field label="Date"><input type="date" required value={value.occurredOn} onChange={(e) => update("occurredOn", e.target.value)} className="input" /></Field>
        <Field label="Category"><select value={value.category} onChange={(e) => update("category", e.target.value)} className="input">{EXPENSE_CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
        <Field label="Vendor"><input value={value.vendor} onChange={(e) => update("vendor", e.target.value)} placeholder="Supplier or store" className="input" /></Field>
        <Field label="Description"><input required value={value.description} onChange={(e) => update("description", e.target.value)} placeholder="What was purchased?" className="input" /></Field>
        <Field label="Amount before tax"><input type="number" required min="0.01" step="0.01" value={value.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0.00" className="input" /></Field>
        <Field label="Tax"><input type="number" min="0" step="0.01" value={value.tax} onChange={(e) => update("tax", e.target.value)} placeholder="0.00" className="input" /></Field>
        <Field label="Payment method"><input value={value.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)} placeholder="Card, cash, bank…" className="input" /></Field>
        <Field label="Notes"><input value={value.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Optional" className="input" /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 px-4 rounded-lg border border-[#d8d8d8] text-sm font-medium">Cancel</button>
        <button disabled={saving} type="submit" className="h-9 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save expense"}</button>
      </div>
      <style>{`.gdp-admin .input{width:100%;height:38px;border:1px solid #d8d8d8;border-radius:8px;padding:0 10px;background:#fff;font-size:14px;outline:none}.gdp-admin .input:focus{border-color:#8b8b8b;box-shadow:0 0 0 2px rgba(0,0,0,.05)}`}</style>
    </form>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="block text-xs font-medium text-[#666] mb-1.5">{label}</span>{children}</label>;
}

function MetricCard({ label, value, icon: Icon, sub, warning = false }) {
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
    <section className="mt-5 rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <TableHeader title="Transactions" subtitle="Live-mode GDP orders only; test-mode orders are excluded." />
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order</Th><Th>Customer</Th><Th>Payment</Th><Th right>Subtotal</Th><Th right>Discount</Th><Th right>Shipping</Th><Th right>Tax</Th><Th right>Total</Th><Th>Date</Th></tr></thead><tbody>
        {loading ? <EmptyRow cols={9}>Loading transactions…</EmptyRow> : transactions.length ? transactions.map((order) => <tr key={order.id} className="border-t border-[#eeeeee]"><Td><span className="font-semibold">{order.order_number}</span></Td><Td><div>{order.customer_name || "Guest"}</div><div className="text-[11px] text-[#777]">{order.customer_email}</div></Td><Td><Status value={order.payment_status} /></Td><Td right>{money(order.subtotal)}</Td><Td right>{money(order.discount)}</Td><Td right>{money(order.shipping)}</Td><Td right>{money(order.tax)}</Td><Td right><span className="font-semibold">{money(order.total)}</span></Td><Td>{formatDate(order.created_at)}</Td></tr>) : <EmptyRow cols={9}>No live-mode transactions in this period.</EmptyRow>}
      </tbody></table></div>
    </section>
  );
}

function ExpenseTable({ loading, expenses, onDelete }) {
  return (
    <section className="mt-5 rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <TableHeader title="Expenses" subtitle="Admin-recorded GDP operating expenses for the selected period." />
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Category</Th><Th>Vendor</Th><Th>Description</Th><Th right>Amount</Th><Th right>Tax</Th><Th right>Total</Th><Th /></tr></thead><tbody>
        {loading ? <EmptyRow cols={8}>Loading expenses…</EmptyRow> : expenses.length ? expenses.map((expense) => <tr key={expense.id} className="border-t border-[#eeeeee]"><Td>{formatDate(`${expense.occurred_on}T12:00:00`, false)}</Td><Td><span className="capitalize">{categoryLabel(expense.category)}</span></Td><Td>{expense.vendor || "—"}</Td><Td><div className="font-medium">{expense.description}</div>{expense.notes && <div className="text-[11px] text-[#777] mt-0.5">{expense.notes}</div>}</Td><Td right>{money(expense.amount, expense.currency)}</Td><Td right>{money(expense.tax, expense.currency)}</Td><Td right><span className="font-semibold">{money(Number(expense.amount || 0) + Number(expense.tax || 0), expense.currency)}</span></Td><Td right><button type="button" onClick={() => onDelete(expense)} className="h-8 w-8 inline-grid place-items-center rounded-lg border border-[#e1e1e1] text-[#777] hover:text-red-600 hover:border-red-200" aria-label={`Delete ${expense.description}`}><Trash2 size={14} /></button></Td></tr>) : <EmptyRow cols={8}>No expenses recorded in this period.</EmptyRow>}
      </tbody></table></div>
    </section>
  );
}

function RefundDisputeTables({ loading, refunds, disputes }) {
  return <div className="space-y-5 pt-5">
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><TableHeader title="Refund records" subtitle="GDP refund ledger. Pending refunds are shown separately from processed refund totals." /><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order</Th><Th>Status</Th><Th>Reason</Th><Th right>Amount</Th><Th>Date</Th></tr></thead><tbody>{loading ? <EmptyRow cols={5}>Loading refunds…</EmptyRow> : refunds.length ? refunds.map((refund) => <tr key={refund.id} className="border-t border-[#eeeeee]"><Td><span className="font-semibold">{refund.order_number || "—"}</span></Td><Td><Status value={refund.status} /></Td><Td>{refund.reason || "—"}</Td><Td right>{money(refund.amount)}</Td><Td>{formatDate(refund.processed_at || refund.created_at)}</Td></tr>) : <EmptyRow cols={5}>No refund records in this period.</EmptyRow>}</tbody></table></div></section>
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden"><TableHeader title="Stripe disputes" subtitle="Live-mode charge disputes from the protected Stripe dispute ledger." /><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Order</Th><Th>Status</Th><Th>Reason</Th><Th right>Amount</Th><Th>Evidence due</Th><Th>Updated</Th></tr></thead><tbody>{loading ? <EmptyRow cols={6}>Loading disputes…</EmptyRow> : disputes.length ? disputes.map((dispute) => <tr key={dispute.stripe_dispute_id} className="border-t border-[#eeeeee]"><Td><span className="font-semibold">{dispute.order_number || "Unmatched"}</span></Td><Td><Status value={dispute.status} /></Td><Td><span className="capitalize">{String(dispute.reason || "—").replaceAll("_", " ")}</span></Td><Td right>{money(dispute.amount, dispute.currency || "CAD")}</Td><Td>{dispute.evidence_due_by ? formatDate(dispute.evidence_due_by) : "—"}{dispute.evidence_past_due && <div className="text-[11px] text-red-600 font-semibold">Past due</div>}</Td><Td>{formatDate(dispute.updated_at)}</Td></tr>) : <EmptyRow cols={6}>No live Stripe disputes in this period.</EmptyRow>}</tbody></table></div></section>
  </div>;
}

function TableHeader({ title, subtitle }) {
  return <div className="px-4 py-3 border-b border-[#e8e8e8]"><div className="text-sm font-semibold">{title}</div><div className="text-xs text-[#777] mt-0.5">{subtitle}</div></div>;
}

function Status({ value }) {
  const normalized = String(value || "pending").toLowerCase();
  const cls = normalized === "paid" || normalized === "won" || normalized === "completed" || normalized === "processed" || normalized === "succeeded" ? "bg-emerald-100 text-emerald-800" : normalized.includes("refund") || normalized === "pending" || normalized === "needs_response" || normalized === "under_review" ? "bg-amber-100 text-amber-800" : normalized === "failed" || normalized === "lost" ? "bg-red-100 text-red-700" : "bg-[#eeeeee] text-[#555]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${cls}`}>{normalized.replaceAll("_", " ")}</span>;
}

function EmptyRow({ cols, children }) {
  return <tr><td colSpan={cols} className="py-12 text-center text-[#777]">{children}</td></tr>;
}

function Th({ children, right = false }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right = false }) {
  return <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>{children}</td>;
}
