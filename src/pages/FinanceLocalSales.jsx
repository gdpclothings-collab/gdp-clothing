import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Banknote, Ban, Plus, RefreshCw, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { adminManualSalesApi } from "@/lib/adminManualSalesApi";

const RANGE_OPTIONS = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["year", "This year"],
  ["all", "All time"],
];

const PAYMENT_METHODS = [
  ["cash", "Cash"],
  ["e_transfer", "e-Transfer"],
  ["debit", "Debit"],
  ["credit_card", "Credit card"],
  ["cheque", "Cheque"],
  ["other", "Other"],
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

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function blankForm() {
  return {
    occurredOn: localDateValue(),
    customerName: "",
    reference: "",
    paymentMethod: "cash",
    subtotal: "",
    discount: "0",
    shipping: "0",
    gstHstTax: "0",
    pstTax: "0",
    cogs: "",
    notes: "",
  };
}

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function date(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function paymentLabel(value) {
  return PAYMENT_METHODS.find(([id]) => id === value)?.[1] || String(value || "—").replaceAll("_", " ");
}

export default function FinanceLocalSales() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState({ metrics: {}, sales: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voidingId, setVoidingId] = useState("");
  const [voidReasons, setVoidReasons] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(blankForm);

  const load = async (selectedRange = range) => {
    setLoading(true);
    setError("");
    try {
      setData(await adminManualSalesApi.load({ ...rangeDates(selectedRange), limit: 500 }));
    } catch (err) {
      console.error("Manual sales load failed:", err);
      setError(err?.message || "Could not load local sales.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const total = useMemo(() => (
    Math.max(0, amount(form.subtotal) - amount(form.discount))
      + amount(form.shipping)
      + amount(form.gstHstTax)
      + amount(form.pstTax)
  ), [form]);

  const grossProfit = useMemo(() => (
    Math.max(0, amount(form.subtotal) - amount(form.discount)) - amount(form.cogs)
  ), [form]);

  const patch = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setNotice("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!form.occurredOn) throw new Error("Sale date is required.");
      if (form.subtotal === "") throw new Error("Subtotal is required.");
      if (form.cogs === "") throw new Error("COGS is required. Enter 0 only when the sale truly has no product/production cost.");

      await adminManualSalesApi.createSale({
        occurredAt: `${form.occurredOn}T12:00:00-06:00`,
        customerName: form.customerName,
        reference: form.reference,
        paymentMethod: form.paymentMethod,
        subtotal: form.subtotal,
        discount: form.discount,
        shipping: form.shipping,
        gstHstTax: form.gstHstTax,
        pstTax: form.pstTax,
        cogs: form.cogs,
        notes: form.notes,
      });

      setForm(blankForm());
      setNotice("Local sale recorded. Finance, profit reports and tax totals now include it.");
      await load();
    } catch (err) {
      setError(err?.message || "Could not record the local sale.");
    } finally {
      setSaving(false);
    }
  };

  const voidSale = async (id) => {
    setVoidingId(id);
    setError("");
    setNotice("");
    try {
      await adminManualSalesApi.voidSale(id, voidReasons[id]);
      setVoidReasons((current) => ({ ...current, [id]: "" }));
      setNotice("Local sale voided. The original entry remains in history for audit purposes.");
      await load();
    } catch (err) {
      setError(err?.message || "Could not void the local sale.");
    } finally {
      setVoidingId("");
    }
  };

  const metrics = data?.metrics || {};
  const sales = Array.isArray(data?.sales) ? data.sales : [];

  return (
    <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
        <div className="h-full px-3 md:px-5 flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div>
            <div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div>
          </Link>
          <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><Banknote size={16} /> Local Sales</div>
          <Link to="/admin/finance" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15} /> Finance</Link>
        </div>
      </header>

      <div className="border-b border-[#dedfe3] bg-white">
        <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
          <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">GDP Commerce Admin</div>
          <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Local &amp; Manual Sales</h1>
              <p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Record cash, e-Transfer, debit, card-terminal, cheque or other offline sales so Finance, COGS, gross profit and tax reporting stay complete.</p>
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
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <div className="font-semibold">Bookkeeping entry only</div>
          <div className="mt-1 text-xs">Recording a local sale does not create a storefront order, reserve inventory, charge Stripe, trigger shipping, or send a customer notification. Enter GST/HST and PST only if those amounts were actually collected. Payment-terminal fees can be recorded separately as a Merchant Fees expense.</div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric label="Recorded local sales" value={loading ? "—" : Number(metrics.paidSales || 0).toLocaleString("en-CA")} />
          <Metric label="Local revenue" value={loading ? "—" : money(metrics.paidRevenue)} strong />
          <Metric label="Cash" value={loading ? "—" : money(metrics.cashRevenue)} />
          <Metric label="e-Transfer" value={loading ? "—" : money(metrics.eTransferRevenue)} />
          <Metric label="Local gross profit" value={loading ? "—" : money(metrics.grossProfit)} sub={`${money(metrics.cogs)} COGS`} />
        </div>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed] flex items-center gap-2">
            <Plus size={16} />
            <div><div className="text-sm font-semibold">Record a local sale</div><div className="text-xs text-[#777] mt-0.5">COGS is required so gross-profit reporting cannot silently understate cost.</div></div>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Sale date"><input type="date" value={form.occurredOn} onChange={(e) => patch("occurredOn", e.target.value)} className="input-control" /></Field>
              <Field label="Payment method"><select value={form.paymentMethod} onChange={(e) => patch("paymentMethod", e.target.value)} className="input-control">{PAYMENT_METHODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
              <Field label="Customer (optional)"><input value={form.customerName} onChange={(e) => patch("customerName", e.target.value)} maxLength={160} placeholder="Customer name" className="input-control" /></Field>
              <Field label="Reference (optional)"><input value={form.reference} onChange={(e) => patch("reference", e.target.value)} maxLength={100} placeholder="Receipt / invoice / note" className="input-control" /></Field>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <MoneyField label="Subtotal" value={form.subtotal} onChange={(v) => patch("subtotal", v)} required />
              <MoneyField label="Discount" value={form.discount} onChange={(v) => patch("discount", v)} />
              <MoneyField label="Shipping" value={form.shipping} onChange={(v) => patch("shipping", v)} />
              <MoneyField label="GST/HST collected" value={form.gstHstTax} onChange={(v) => patch("gstHstTax", v)} />
              <MoneyField label="PST collected" value={form.pstTax} onChange={(v) => patch("pstTax", v)} />
              <MoneyField label="COGS" value={form.cogs} onChange={(v) => patch("cogs", v)} required />
            </div>

            <Field label="Internal note (optional)"><input value={form.notes} onChange={(e) => patch("notes", e.target.value)} maxLength={1000} placeholder="What was sold, pickup details, or bookkeeping note" className="input-control" /></Field>

            <div className="rounded-lg border border-[#e4e4e4] bg-[#fafafa] p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="text-[#666]">Customer total</div><div className="font-semibold text-right">{money(total)}</div>
                <div className="text-[#666]">Gross profit before expenses</div><div className="font-semibold text-right">{money(grossProfit)}</div>
              </div>
              <button type="button" onClick={save} disabled={saving} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"><Save size={14} /> {saving ? "Recording…" : "Record sale"}</button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Local sales history</div><div className="text-xs text-[#777] mt-0.5">Entries cannot be deleted. Void an incorrect sale with a reason so the original bookkeeping trail remains visible.</div></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm">
              <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Reference / customer</Th><Th>Payment</Th><Th right>Subtotal</Th><Th right>Discount</Th><Th right>Tax</Th><Th right>Total</Th><Th right>COGS</Th><Th right>Gross profit</Th><Th>Status / action</Th></tr></thead>
              <tbody>
                {loading ? <Empty cols={10}>Loading local sales…</Empty> : sales.length ? sales.map((row) => {
                  const netMerch = Number(row.subtotal || 0) - Number(row.discount || 0);
                  const gp = netMerch - Number(row.cogs || 0);
                  const isVoid = row.status === "void";
                  return <tr key={row.id} className={`border-t border-[#eeeeee] ${isVoid ? "bg-[#fafafa] text-[#777]" : ""}`}>
                    <Td>{date(row.occurred_at)}</Td>
                    <Td><div className="font-medium">{row.reference || `LOCAL-${String(row.id).slice(0, 8).toUpperCase()}`}</div><div className="text-xs text-[#777]">{row.customer_name || "No customer name"}{row.notes ? ` · ${row.notes}` : ""}</div></Td>
                    <Td>{paymentLabel(row.payment_method)}</Td>
                    <Td right>{money(row.subtotal)}</Td>
                    <Td right>{money(row.discount)}</Td>
                    <Td right>{money(Number(row.gst_hst_tax || 0) + Number(row.pst_tax || 0))}<div className="text-[11px] text-[#888]">GST {money(row.gst_hst_tax)} · PST {money(row.pst_tax)}</div></Td>
                    <Td right>{money(row.total)}</Td>
                    <Td right>{money(row.cogs)}</Td>
                    <Td right>{isVoid ? "—" : money(gp)}</Td>
                    <Td>{isVoid ? <div><Badge>Voided</Badge><div className="mt-1 max-w-[260px] text-xs">{row.void_reason}</div></div> : <div className="flex items-center gap-2"><input aria-label={`Void reason for ${row.reference || row.id}`} value={voidReasons[row.id] || ""} onChange={(e) => setVoidReasons((current) => ({ ...current, [row.id]: e.target.value }))} maxLength={500} placeholder="Reason to void" className="h-8 w-44 rounded-md border border-[#d8d8d8] px-2 text-xs" /><button type="button" onClick={() => voidSale(row.id)} disabled={voidingId === row.id || !String(voidReasons[row.id] || "").trim()} className="h-8 px-2.5 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Ban size={12} /> {voidingId === row.id ? "Voiding…" : "Void"}</button></div>}</Td>
                  </tr>;
                }) : <Empty cols={10}>No local sales in this period.</Empty>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><div className="text-xs font-medium text-[#555] mb-1.5">{label}</div>{children}</label>;
}

function MoneyField({ label, value, onChange, required = false }) {
  return <Field label={`${label}${required ? " *" : ""}`}><input type="number" min="0" step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="input-control text-right" /></Field>;
}

function Metric({ label, value, sub, strong = false }) {
  return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div>{sub && <div className="mt-1 text-xs text-[#888]">{sub}</div>}</div>;
}

function Badge({ children }) {
  return <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{children}</span>;
}

function Th({ children, right = false }) {
  return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right = false }) {
  return <td className={`px-3 py-3 align-top ${right ? "text-right tabular-nums" : ""}`}>{children}</td>;
}

function Empty({ cols, children }) {
  return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>;
}
