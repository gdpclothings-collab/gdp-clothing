import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { adminBankImportApi } from "@/lib/adminBankImportApi";
import { adminBankReconciliationApi } from "@/lib/adminBankReconciliationApi";
import { buildBankImportRows, guessBankCsvMapping, parseBankCsv, sha256File } from "@/lib/bankStatementCsv";

const SOURCE_OPTIONS = [
  ["other", "Other bank activity"],
  ["cash_deposit", "Cash deposit"],
  ["e_transfer", "e-Transfer deposit"],
  ["terminal_deposit", "Debit / card terminal deposit"],
  ["cheque", "Cheque"],
  ["expense", "Expense / withdrawal"],
  ["stripe_payout", "Stripe payout"],
];

const DATE_FORMATS = [
  ["auto", "Auto (ISO first, otherwise MM/DD/YYYY)"],
  ["mdy", "MM/DD/YYYY"],
  ["dmy", "DD/MM/YYYY"],
];

const money = (value) => Number(value || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const shortHash = (value) => value ? `${String(value).slice(0, 10)}…${String(value).slice(-6)}` : "—";

function rowReady(row) {
  if (!row?.valid || row?.duplicate) return false;
  if (row.sourceType === "stripe_payout" && !row.sourceReference) return false;
  return true;
}

export default function FinanceBankImport() {
  const [fileInfo, setFileInfo] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({ date: "", description: "", reference: "", mode: "signed", amount: "", debit: "", credit: "" });
  const [dateFormat, setDateFormat] = useState("auto");
  const [positiveDirection, setPositiveDirection] = useState("credit");
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadServerData = async () => {
    setLoading(true);
    setError("");
    try {
      const [historyData, bankData] = await Promise.all([
        adminBankImportApi.history(50),
        adminBankReconciliationApi.load({ from: null, to: null, limit: 1000 }),
      ]);
      setHistory(Array.isArray(historyData?.batches) ? historyData.batches : []);
      setPayouts(Array.isArray(bankData?.unmatchedStripePayouts) ? bankData.unmatchedStripePayouts : []);
    } catch (err) {
      console.error("Bank CSV import load failed:", err);
      setError(err?.message || "Could not load bank import controls.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServerData();
  }, []);

  const resetFile = () => {
    setFileInfo(null);
    setParsed(null);
    setRows([]);
    setMapping({ date: "", description: "", reference: "", mode: "signed", amount: "", debit: "", credit: "" });
    setNotice("");
    setError("");
  };

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    setRows([]);
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv bank statement file.");
      if (file.size > 5 * 1024 * 1024) throw new Error("CSV files must be 5 MB or smaller.");
      const [text, hash] = await Promise.all([file.text(), sha256File(file)]);
      const nextParsed = parseBankCsv(text);
      if (nextParsed.rows.length > 500) throw new Error("Phase 12 supports up to 500 transaction rows per CSV import.");
      setParsed(nextParsed);
      setMapping(guessBankCsvMapping(nextParsed.headers));
      setFileInfo({ name: file.name, size: file.size, sha256: hash, rowCount: nextParsed.rows.length });
      setNotice("CSV loaded locally. Confirm the column mapping, then build the preview.");
    } catch (err) {
      resetFile();
      setError(err?.message || "Could not read this CSV file.");
    }
  };

  const buildPreview = async () => {
    if (!parsed || !fileInfo) return;
    setAnalyzing(true);
    setError("");
    setNotice("");
    try {
      if (!mapping.date || !mapping.description) throw new Error("Map the Date and Description columns first.");
      if (mapping.mode === "signed" && !mapping.amount) throw new Error("Map the Amount column first.");
      if (mapping.mode === "split" && (!mapping.debit || !mapping.credit)) throw new Error("Map both Debit and Credit columns first.");
      const mapped = buildBankImportRows({ parsed, mapping, dateFormat, positiveDirection });
      const valid = mapped.filter((row) => row.valid);
      let duplicateInfo = [];
      if (valid.length) duplicateInfo = await adminBankImportApi.preview(valid);
      const duplicateMap = new Map(duplicateInfo.map((item) => [item.clientKey, item]));
      const analyzed = mapped.map((row) => {
        const match = duplicateMap.get(row.clientKey);
        const duplicate = Boolean(match?.duplicate);
        return { ...row, duplicate, fingerprint: match?.fingerprint || "", selected: row.valid && !duplicate };
      });
      setRows(analyzed);
      const duplicateCount = analyzed.filter((row) => row.duplicate).length;
      const invalidCount = analyzed.filter((row) => !row.valid).length;
      setNotice(`Preview ready: ${analyzed.length - duplicateCount - invalidCount} ready, ${duplicateCount} duplicate, ${invalidCount} invalid.`);
    } catch (err) {
      setError(err?.message || "Could not build the bank statement preview.");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateRow = (clientKey, patch) => {
    setRows((current) => current.map((row) => row.clientKey === clientKey ? { ...row, ...patch } : row));
  };

  const setSourceType = (row, sourceType) => {
    if (sourceType === "stripe_payout") {
      updateRow(row.clientKey, { sourceType, sourceReference: "", expectedAmount: "", direction: "credit", selected: false });
      return;
    }
    updateRow(row.clientKey, { sourceType, sourceReference: "", expectedAmount: "", selected: row.valid && !row.duplicate });
  };

  const setStripePayout = (row, payoutId) => {
    const payout = payouts.find((item) => item.stripe_payout_id === payoutId);
    updateRow(row.clientKey, {
      sourceReference: payoutId,
      expectedAmount: payout ? String(payout.amount) : "",
      selected: Boolean(payoutId) && row.valid && !row.duplicate,
    });
  };

  const usedPayoutIds = useMemo(() => new Set(rows.filter((row) => row.sourceType === "stripe_payout" && row.sourceReference).map((row) => row.sourceReference)), [rows]);
  const selectedRows = rows.filter((row) => row.selected && rowReady(row));
  const readyCount = rows.filter(rowReady).length;
  const duplicateCount = rows.filter((row) => row.duplicate).length;
  const invalidCount = rows.filter((row) => !row.valid).length;
  const selectedTotal = selectedRows.reduce((sum, row) => sum + (row.direction === "credit" ? Number(row.amount || 0) : -Number(row.amount || 0)), 0);

  const selectReady = () => setRows((current) => current.map((row) => ({ ...row, selected: rowReady(row) })));
  const clearSelection = () => setRows((current) => current.map((row) => ({ ...row, selected: false })));

  const importRows = async () => {
    if (!fileInfo) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!selectedRows.length) throw new Error("Select at least one ready row to import.");
      const result = await adminBankImportApi.importStatement({
        filename: fileInfo.name,
        fileSha256: fileInfo.sha256,
        sourceRowCount: fileInfo.rowCount,
        rows: selectedRows,
      });
      setNotice(`Import complete: ${result?.importedRows || 0} bank entries added; ${result?.duplicateRows || 0} duplicates skipped by the server.`);
      setRows([]);
      setParsed(null);
      setFileInfo(null);
      await loadServerData();
    } catch (err) {
      setError(err?.message || "Bank statement import failed.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
        <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75"><FileSpreadsheet size={16} /> Bank Statement Import</div>
        <Link to="/admin/finance/bank-reconciliation" className="ml-auto h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15} /> Bank Reconciliation</Link>
      </div>
    </header>

    <div className="border-b border-[#dedfe3] bg-white">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-7">
        <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">Finance Phase 12</div>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight">Bank Statement CSV Import</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">Upload a CSV exported from your business bank, map its transaction columns, preview the normalized entries, and import only what you approve. Duplicate statement rows are blocked server-side.</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={loadServerData} disabled={loading} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm inline-flex items-center gap-2 disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Refresh</button>{fileInfo && <button type="button" onClick={resetFile} className="h-9 px-3 rounded-lg border border-[#d5d5d5] bg-white text-sm">Clear file</button>}</div>
        </div>
      </div>
    </div>

    <main className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 pb-12 space-y-5">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex gap-3"><ShieldCheck size={18} className="shrink-0 mt-0.5"/><div><div className="font-semibold">Privacy-first import</div><div className="mt-1 text-xs">The CSV is read in your browser. GDP sends only the columns you map into the preview—not extra statement columns such as balance or account-number fields. No bank login, password, routing information, or live banking connection is used.</div></div></div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed] flex items-center gap-2"><Upload size={16}/><div><div className="text-sm font-semibold">1. Choose bank CSV</div><div className="text-xs text-[#777] mt-0.5">Maximum 5 MB and 500 transaction rows per import.</div></div></div>
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white"><Upload size={15}/> Choose CSV<input type="file" accept=".csv,text/csv" onChange={chooseFile} className="hidden"/></label>
          {fileInfo ? <div className="text-sm"><div className="font-semibold">{fileInfo.name}</div><div className="text-xs text-[#777] mt-0.5">{fileInfo.rowCount} rows · {(fileInfo.size / 1024).toFixed(1)} KB · SHA-256 {shortHash(fileInfo.sha256)}</div></div> : <div className="text-sm text-[#777]">No CSV selected.</div>}
        </div>
      </section>

      {parsed && <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">2. Map statement columns</div><div className="text-xs text-[#777] mt-0.5">Auto-detection is only a starting point. Confirm the mapping before preview.</div></div>
        <div className="p-4 space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SelectField label="Date column" value={mapping.date} onChange={(value) => setMapping((current) => ({ ...current, date: value }))} headers={parsed.headers}/>
            <SelectField label="Description column" value={mapping.description} onChange={(value) => setMapping((current) => ({ ...current, description: value }))} headers={parsed.headers}/>
            <SelectField label="Reference column (optional)" value={mapping.reference} onChange={(value) => setMapping((current) => ({ ...current, reference: value }))} headers={parsed.headers} optional/>
            <Field label="Date format"><select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className="input-control">{DATE_FORMATS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Amount layout"><select value={mapping.mode} onChange={(e) => setMapping((current) => ({ ...current, mode: e.target.value }))} className="input-control"><option value="signed">One signed Amount column</option><option value="split">Separate Debit and Credit columns</option></select></Field>
            {mapping.mode === "signed" ? <><SelectField label="Amount column" value={mapping.amount} onChange={(value) => setMapping((current) => ({ ...current, amount: value }))} headers={parsed.headers}/><Field label="Positive amount means"><select value={positiveDirection} onChange={(e) => setPositiveDirection(e.target.value)} className="input-control"><option value="credit">Money in / credit</option><option value="debit">Money out / debit</option></select></Field><div/></> : <><SelectField label="Debit column" value={mapping.debit} onChange={(value) => setMapping((current) => ({ ...current, debit: value }))} headers={parsed.headers}/><SelectField label="Credit column" value={mapping.credit} onChange={(value) => setMapping((current) => ({ ...current, credit: value }))} headers={parsed.headers}/><div/></>}
          </div>

          <div className="flex justify-end"><button type="button" onClick={buildPreview} disabled={analyzing} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-60">{analyzing ? "Analyzing duplicates…" : "Build secure preview"}</button></div>
        </div>
      </section>}

      {rows.length > 0 && <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Metric label="Ready rows" value={String(readyCount)} />
          <Metric label="Selected" value={String(selectedRows.length)} strong />
          <Metric label="Duplicate" value={String(duplicateCount)} />
          <Metric label="Invalid" value={String(invalidCount)} />
          <Metric label="Selected net movement" value={money(selectedTotal)} />
        </div>

        <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#ededed] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><div className="text-sm font-semibold">3. Review and classify</div><div className="text-xs text-[#777] mt-0.5">Duplicates are automatically unselected. Stripe payout classification is available only for credit rows and requires choosing an unmatched payout.</div></div><div className="flex gap-2"><button type="button" onClick={selectReady} className="h-8 px-3 rounded-md border border-[#d5d5d5] bg-white text-xs font-semibold">Select ready</button><button type="button" onClick={clearSelection} className="h-8 px-3 rounded-md border border-[#d5d5d5] bg-white text-xs font-semibold">Clear</button></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Select</Th><Th>CSV row</Th><Th>Date</Th><Th>Direction</Th><Th>Description</Th><Th right>Amount</Th><Th>Reference</Th><Th>Classification</Th><Th>Status</Th></tr></thead><tbody>
            {rows.map((row) => {
              const availablePayouts = payouts.filter((payout) => payout.stripe_payout_id === row.sourceReference || !usedPayoutIds.has(payout.stripe_payout_id));
              return <tr key={row.clientKey} className={`border-t border-[#eeeeee] ${row.duplicate || !row.valid ? "bg-[#fafafa] text-[#777]" : ""}`}>
                <Td><input type="checkbox" checked={Boolean(row.selected)} disabled={!rowReady(row)} onChange={(e) => updateRow(row.clientKey, { selected: e.target.checked })}/></Td>
                <Td>{row.sourceRowNumber}</Td>
                <Td>{row.occurredOn || "—"}</Td>
                <Td><Badge tone={row.direction === "credit" ? "green" : "neutral"}>{row.direction === "credit" ? "Credit" : "Debit"}</Badge></Td>
                <Td><div className="max-w-[320px] font-medium">{row.description || "—"}</div></Td>
                <Td right strong>{row.amount ? money(row.amount) : "—"}</Td>
                <Td>{row.reference || "—"}</Td>
                <Td><div className="min-w-[250px] space-y-2"><select value={row.sourceType} disabled={!row.valid || row.duplicate} onChange={(e) => setSourceType(row, e.target.value)} className="h-8 w-full rounded-md border border-[#d8d8d8] bg-white px-2 text-xs">{SOURCE_OPTIONS.filter(([id]) => row.direction === "credit" || id !== "stripe_payout").map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>{row.sourceType === "stripe_payout" && <select value={row.sourceReference} onChange={(e) => setStripePayout(row, e.target.value)} className="h-8 w-full rounded-md border border-[#d8d8d8] bg-white px-2 text-xs"><option value="">Choose unmatched payout</option>{availablePayouts.map((payout) => <option key={payout.stripe_payout_id} value={payout.stripe_payout_id}>{payout.stripe_payout_id} · {money(payout.amount)}</option>)}</select>}</div></Td>
                <Td>{row.duplicate ? <Badge tone="amber">Duplicate</Badge> : !row.valid ? <span className="inline-flex items-start gap-1 text-xs text-red-700"><AlertTriangle size={13} className="mt-0.5 shrink-0"/>{row.error || "Invalid"}</span> : row.sourceType === "stripe_payout" && !row.sourceReference ? <Badge tone="amber">Choose payout</Badge> : <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold"><CheckCircle2 size={13}/>Ready</span>}</Td>
              </tr>;
            })}
          </tbody></table></div>
          <div className="px-4 py-4 border-t border-[#ededed] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div className="text-xs text-[#777]">The server re-checks duplicates during import, so a race cannot silently create a second copy.</div><button type="button" onClick={importRows} disabled={saving || selectedRows.length === 0} className="h-10 px-4 rounded-lg bg-[#171717] text-white text-sm font-semibold disabled:opacity-50">{saving ? "Importing…" : `Import ${selectedRows.length} selected row${selectedRows.length === 1 ? "" : "s"}`}</button></div>
        </section>
      </>}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-[#ededed]"><div className="text-sm font-semibold">Import history</div><div className="text-xs text-[#777] mt-0.5">Audit record of CSV batches. The file itself is not uploaded or stored.</div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#fafafa] text-[#707070] text-xs"><tr><Th>Date</Th><Th>Filename</Th><Th right>Source rows</Th><Th right>Submitted</Th><Th right>Imported</Th><Th right>Duplicates</Th><Th>File fingerprint</Th></tr></thead><tbody>{loading ? <Empty cols={7}>Loading import history…</Empty> : history.length ? history.map((batch) => <tr key={batch.id} className="border-t border-[#eeeeee]"><Td>{batch.created_at ? new Date(batch.created_at).toLocaleString("en-CA") : "—"}</Td><Td strong>{batch.filename}</Td><Td right>{batch.source_row_count}</Td><Td right>{batch.submitted_row_count}</Td><Td right strong>{batch.imported_row_count}</Td><Td right>{batch.duplicate_row_count}</Td><Td><code className="text-xs">{shortHash(batch.file_sha256)}</code></Td></tr>) : <Empty cols={7}>No CSV bank statement imports yet.</Empty>}</tbody></table></div>
      </section>
    </main>
  </div>;
}

function Field({ label, children }) { return <label className="block"><div className="text-xs font-medium text-[#555] mb-1.5">{label}</div>{children}</label>; }
function SelectField({ label, value, onChange, headers, optional = false }) { return <Field label={label}><select value={value} onChange={(e) => onChange(e.target.value)} className="input-control"><option value="">{optional ? "Not mapped" : "Choose column"}</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></Field>; }
function Metric({ label, value, strong = false }) { return <div className="rounded-xl border border-[#dedede] bg-white p-4"><div className="text-xs font-medium text-[#777]">{label}</div><div className={`mt-1 text-xl tabular-nums ${strong ? "font-bold" : "font-semibold"}`}>{value}</div></div>; }
function Badge({ children, tone = "neutral" }) { const cls = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-[#d8d8d8] bg-[#f7f7f7] text-[#555]"; return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>; }
function Th({ children, right = false }) { return <th className={`px-3 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>; }
function Td({ children, right = false, strong = false }) { return <td className={`px-3 py-3 align-top ${right ? "text-right tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{children}</td>; }
function Empty({ cols, children }) { return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#777]">{children}</td></tr>; }
