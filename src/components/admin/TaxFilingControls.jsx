import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, LockKeyhole, RefreshCw, RotateCcw, Save } from "lucide-react";
import { adminTaxApi } from "@/lib/adminTaxApi";

const TAX_LABELS = {
  gst_hst: "GST/HST",
  pst: "Saskatchewan PST",
};

const FREQUENCIES = [
  ["unconfigured", "Select frequency"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["annual", "Annual"],
  ["other", "Other"],
];

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function formatDate(value) {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return raw;
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric" })
    .format(new Date(year, month - 1, day, 12));
}

function registrationForm(row, taxType) {
  return {
    taxType,
    registered: Boolean(row?.registered),
    accountNumber: "",
    filingFrequency: row?.filingFrequency || "unconfigured",
    effectiveFrom: row?.effectiveFrom || "",
    notes: row?.notes || "",
  };
}

export default function TaxFilingControls() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingRegistration, setSavingRegistration] = useState("");
  const [periodAction, setPeriodAction] = useState("");
  const [registrations, setRegistrations] = useState({
    gst_hst: registrationForm(null, "gst_hst"),
    pst: registrationForm(null, "pst"),
  });
  const [newPeriod, setNewPeriod] = useState({ taxType: "gst_hst", periodStart: "", periodEnd: "", dueDate: "", notes: "" });
  const [estimateConfirm, setEstimateConfirm] = useState({});
  const [filingReferences, setFilingReferences] = useState({});
  const [reopenReasons, setReopenReasons] = useState({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminTaxApi.loadFilingControls(36);
      setData(next);
      const rows = Array.isArray(next?.registrations) ? next.registrations : [];
      const byType = new Map(rows.map((row) => [row.taxType, row]));
      setRegistrations({
        gst_hst: registrationForm(byType.get("gst_hst"), "gst_hst"),
        pst: registrationForm(byType.get("pst"), "pst"),
      });
    } catch (err) {
      setError(err?.message || "Could not load tax filing controls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const registrationRows = Array.isArray(data?.registrations) ? data.registrations : [];
  const periods = Array.isArray(data?.periods) ? data.periods : [];
  const registrationByType = useMemo(() => new Map(registrationRows.map((row) => [row.taxType, row])), [registrationRows]);

  const patchRegistration = (taxType, key, value) => {
    setRegistrations((current) => ({ ...current, [taxType]: { ...current[taxType], [key]: value } }));
    setNotice("");
  };

  const saveRegistration = async (taxType) => {
    setSavingRegistration(taxType);
    setError("");
    setNotice("");
    try {
      await adminTaxApi.saveRegistration(registrations[taxType]);
      setNotice(`${TAX_LABELS[taxType]} registration settings saved.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not save tax registration settings.");
    } finally {
      setSavingRegistration("");
    }
  };

  const createPeriod = async () => {
    setPeriodAction("create");
    setError("");
    setNotice("");
    try {
      await adminTaxApi.createFilingPeriod(newPeriod);
      setNewPeriod((current) => ({ ...current, periodStart: "", periodEnd: "", dueDate: "", notes: "" }));
      setNotice(`${TAX_LABELS[newPeriod.taxType]} filing period prepared.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not prepare the filing period.");
    } finally {
      setPeriodAction("");
    }
  };

  const closePeriod = async (period) => {
    setPeriodAction(period.id);
    setError("");
    setNotice("");
    try {
      await adminTaxApi.closeFilingPeriod(period.id, Boolean(estimateConfirm[period.id]));
      setNotice(`${TAX_LABELS[period.tax_type]} period closed and snapshot locked for filing review.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not close the filing period.");
    } finally {
      setPeriodAction("");
    }
  };

  const reopenPeriod = async (period) => {
    setPeriodAction(period.id);
    setError("");
    setNotice("");
    try {
      await adminTaxApi.reopenFilingPeriod(period.id, reopenReasons[period.id]);
      setReopenReasons((current) => ({ ...current, [period.id]: "" }));
      setNotice(`${TAX_LABELS[period.tax_type]} period reopened for corrections.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not reopen the filing period.");
    } finally {
      setPeriodAction("");
    }
  };

  const markFiled = async (period) => {
    setPeriodAction(period.id);
    setError("");
    setNotice("");
    try {
      await adminTaxApi.markFilingPeriodFiled(period.id, filingReferences[period.id]);
      setFilingReferences((current) => ({ ...current, [period.id]: "" }));
      setNotice(`${TAX_LABELS[period.tax_type]} period recorded as filed externally.`);
      await load();
    } catch (err) {
      setError(err?.message || "Could not mark the filing period as filed.");
    } finally {
      setPeriodAction("");
    }
  };

  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#ededed] flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2"><FileCheck2 size={16} /> Registration &amp; filing controls</div>
          <div className="text-xs text-[#777] mt-0.5">Prepare and lock tax-period snapshots after review. GDP does not submit returns to CRA or Saskatchewan.</div>
        </div>
        <button type="button" onClick={load} disabled={loading} className="h-8 px-3 rounded-md border border-[#d5d5d5] bg-white text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh controls
        </button>
      </div>

      <div className="p-4 space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-950 flex gap-2">
          <LockKeyhole size={15} className="shrink-0 mt-0.5" />
          <div><span className="font-semibold">Account numbers stay masked after save.</span> Leaving the account-number field blank on a later edit keeps the saved number. “Mark filed” only records a filing completed outside GDP.</div>
        </div>

        <div className="grid xl:grid-cols-2 gap-4">
          {["gst_hst", "pst"].map((type) => (
            <RegistrationCard
              key={type}
              taxType={type}
              current={registrationByType.get(type)}
              form={registrations[type]}
              onChange={(key, value) => patchRegistration(type, key, value)}
              onSave={() => saveRegistration(type)}
              saving={savingRegistration === type}
              loading={loading}
            />
          ))}
        </div>

        <div className="border-t border-[#ededed] pt-5">
          <div className="text-sm font-semibold">Prepare a filing period</div>
          <div className="text-xs text-[#777] mt-0.5">A prepared period snapshots the current Tax Center estimate. Closing refreshes and validates it again before locking.</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3">
            <Field label="Tax type">
              <select value={newPeriod.taxType} onChange={(e) => setNewPeriod((v) => ({ ...v, taxType: e.target.value }))} className="input-control">
                <option value="gst_hst">GST/HST</option>
                <option value="pst">Saskatchewan PST</option>
              </select>
            </Field>
            <Field label="Period start"><input type="date" value={newPeriod.periodStart} onChange={(e) => setNewPeriod((v) => ({ ...v, periodStart: e.target.value }))} className="input-control" /></Field>
            <Field label="Period end"><input type="date" value={newPeriod.periodEnd} onChange={(e) => setNewPeriod((v) => ({ ...v, periodEnd: e.target.value }))} className="input-control" /></Field>
            <Field label="Due date (optional)"><input type="date" value={newPeriod.dueDate} onChange={(e) => setNewPeriod((v) => ({ ...v, dueDate: e.target.value }))} className="input-control" /></Field>
            <div className="flex items-end"><button type="button" onClick={createPeriod} disabled={periodAction === "create" || loading} className="h-9 w-full rounded-md bg-[#171717] text-white text-xs font-semibold disabled:opacity-60">{periodAction === "create" ? "Preparing…" : "Prepare period"}</button></div>
          </div>
          <div className="mt-3"><Field label="Period notes (optional)"><input value={newPeriod.notes} onChange={(e) => setNewPeriod((v) => ({ ...v, notes: e.target.value }))} placeholder="Internal bookkeeping note" className="input-control" /></Field></div>
        </div>

        <div className="border-t border-[#ededed] pt-5">
          <div className="text-sm font-semibold">Filing periods</div>
          <div className="text-xs text-[#777] mt-0.5">Closed periods are filing-ready only after classification and estimated-refund checks pass. Filed periods remain recorded as historical snapshots.</div>
          <div className="overflow-x-auto mt-3 rounded-lg border border-[#e5e5e5]">
            <table className="w-full min-w-[1260px] text-sm">
              <thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Tax</Th><Th>Period</Th><Th>Due</Th><Th right>Collected</Th><Th right>Refunded</Th><Th right>Credits</Th><Th right>Net due</Th><Th>Status</Th><Th>Review</Th><Th>Action</Th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={10} className="p-8 text-center text-[#777]">Loading filing controls…</td></tr> : periods.length ? periods.map((period) => (
                  <PeriodRow
                    key={period.id}
                    period={period}
                    busy={periodAction === period.id}
                    estimateConfirmed={Boolean(estimateConfirm[period.id])}
                    onEstimateChange={(value) => setEstimateConfirm((current) => ({ ...current, [period.id]: value }))}
                    filingReference={filingReferences[period.id] || ""}
                    onFilingReferenceChange={(value) => setFilingReferences((current) => ({ ...current, [period.id]: value }))}
                    reopenReason={reopenReasons[period.id] || ""}
                    onReopenReasonChange={(value) => setReopenReasons((current) => ({ ...current, [period.id]: value }))}
                    onClose={() => closePeriod(period)}
                    onReopen={() => reopenPeriod(period)}
                    onMarkFiled={() => markFiled(period)}
                  />
                )) : <tr><td colSpan={10} className="p-8 text-center text-[#777]">No filing periods prepared yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`.input-control{height:2.25rem;width:100%;border:1px solid #d8d8d8;border-radius:.375rem;padding:0 .625rem;background:white;font-size:.75rem}.input-control:focus{outline:2px solid #11121422;outline-offset:1px}`}</style>
    </section>
  );
}

function RegistrationCard({ taxType, current, form, onChange, onSave, saving, loading }) {
  const configured = Boolean(current?.ready);
  const statusLabel = configured ? "Configured" : current?.registered ? "Needs setup" : "Not registered";
  const statusClass = configured ? "bg-emerald-100 text-emerald-800" : current?.registered ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-lg border border-[#e2e2e2] p-4">
      <div className="flex items-start justify-between gap-3">
        <div><div className="font-semibold text-sm">{TAX_LABELS[taxType]}</div><div className="text-xs text-[#777] mt-0.5">{current?.hasAccountNumber ? `Saved account: ${current.accountNumberMasked}` : "No account number saved"}</div></div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass}`}>{statusLabel}</span>
      </div>
      <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={form.registered} onChange={(e) => onChange("registered", e.target.checked)} /> Registered</label>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <Field label="Account number"><input value={form.accountNumber} onChange={(e) => onChange("accountNumber", e.target.value)} disabled={!form.registered} placeholder={current?.hasAccountNumber ? `${current.accountNumberMasked} · leave blank to keep` : "Enter account number"} className="input-control disabled:bg-[#f5f5f5]" autoComplete="off" /></Field>
        <Field label="Filing frequency"><select value={form.filingFrequency} onChange={(e) => onChange("filingFrequency", e.target.value)} disabled={!form.registered} className="input-control disabled:bg-[#f5f5f5]">{FREQUENCIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Effective from"><input type="date" value={form.effectiveFrom} onChange={(e) => onChange("effectiveFrom", e.target.value)} disabled={!form.registered} className="input-control disabled:bg-[#f5f5f5]" /></Field>
        <Field label="Notes"><input value={form.notes} onChange={(e) => onChange("notes", e.target.value)} placeholder="Optional internal note" className="input-control" /></Field>
      </div>
      <button type="button" onClick={onSave} disabled={saving || loading} className="mt-3 h-9 px-3 rounded-md bg-[#171717] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"><Save size={12} /> {saving ? "Saving…" : "Save registration"}</button>
    </div>
  );
}

function PeriodRow(props) {
  const { period, busy, estimateConfirmed, onEstimateChange, filingReference, onFilingReferenceChange, reopenReason, onReopenReasonChange, onClose, onReopen, onMarkFiled } = props;
  const hasUnclassified = Number(period.unclassified_tax || 0) > 0;
  const hasEstimates = Number(period.estimated_refund_allocations || 0) > 0;
  const statusClass = period.status === "filed" ? "bg-emerald-100 text-emerald-800" : period.status === "closed" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800";
  return (
    <tr className="border-t border-[#eeeeee] align-top">
      <Td strong>{TAX_LABELS[period.tax_type] || period.tax_type}</Td>
      <Td>{formatDate(period.period_start)} – {formatDate(period.period_end)}</Td>
      <Td>{formatDate(period.due_date)}</Td>
      <Td right>{money(period.tax_collected)}</Td>
      <Td right>{money(period.tax_refunded)}</Td>
      <Td right>{money(period.tax_credits)}</Td>
      <Td right><span className="font-semibold">{money(period.net_tax_due)}</span></Td>
      <Td><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${statusClass}`}>{period.status}</span>{period.filing_ready && <div className="mt-1 text-[11px] text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={11} /> filing-ready snapshot</div>}</Td>
      <Td>
        {hasUnclassified && <div className="text-[11px] text-amber-800 flex gap-1"><AlertTriangle size={11} className="shrink-0 mt-0.5" /> {money(period.unclassified_tax)} unclassified</div>}
        {hasEstimates && <div className="mt-1 text-[11px] text-amber-800">{period.estimated_refund_allocations} estimated refund allocation(s)</div>}
        {!hasUnclassified && !hasEstimates && <span className="text-[11px] text-emerald-700">No review blockers</span>}
      </Td>
      <Td>
        {period.status === "open" && <div className="min-w-[210px] space-y-2">
          {hasEstimates && <label className="flex gap-2 text-[11px] text-[#555]"><input type="checkbox" checked={estimateConfirmed} onChange={(e) => onEstimateChange(e.target.checked)} /> I reviewed the estimated refund tax allocation(s).</label>}
          <button type="button" onClick={onClose} disabled={busy || hasUnclassified || (hasEstimates && !estimateConfirmed)} className="h-8 px-3 rounded-md bg-[#171717] text-white text-xs font-semibold disabled:opacity-45">{busy ? "Working…" : "Close period"}</button>
        </div>}
        {period.status === "closed" && <div className="min-w-[280px] grid gap-2">
          <div className="flex gap-2"><input value={filingReference} onChange={(e) => onFilingReferenceChange(e.target.value)} placeholder="External filing reference" className="input-control" /><button type="button" onClick={onMarkFiled} disabled={busy || !filingReference.trim()} className="h-9 px-3 rounded-md bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-45">{busy ? "Working…" : "Mark filed"}</button></div>
          <div className="flex gap-2"><input value={reopenReason} onChange={(e) => onReopenReasonChange(e.target.value)} placeholder="Reason to reopen" className="input-control" /><button type="button" onClick={onReopen} disabled={busy || !reopenReason.trim()} className="h-9 px-3 rounded-md border border-[#ccc] bg-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-45"><RotateCcw size={11} /> Reopen</button></div>
        </div>}
        {period.status === "filed" && <div className="min-w-[180px] text-xs"><div className="font-medium">Recorded filed</div><div className="text-[#777] mt-0.5">{formatDate(period.filed_at)}</div><div className="text-[#777] break-all">Ref: {period.filing_reference || "—"}</div></div>}
      </Td>
    </tr>
  );
}

function Field({ label, children }) { return <label className="block"><span className="block text-[11px] font-medium text-[#666] mb-1">{label}</span>{children}</label>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 ${right ? "text-right tabular-nums" : "text-left"} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
