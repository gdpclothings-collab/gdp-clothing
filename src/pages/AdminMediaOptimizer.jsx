import { requestConfirmation } from "@/lib/NotificationContext";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ImageDown,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  optimizeLegacyProductImages,
  restoreOriginalProductImages,
  scanLegacyProductImages,
} from "@/lib/legacyProductImageOptimizer";

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function AdminMediaOptimizer() {
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);

  const loadScan = async () => {
    setScanning(true);
    setError("");
    try {
      setScan(await scanLegacyProductImages());
    } catch (err) {
      console.error("Product image scan failed:", err);
      setError(err?.message || "Could not scan product images.");
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadScan();
  }, []);

  const progressPercent = useMemo(() => {
    if (!progress?.total) return 0;
    return Math.min(100, Math.round((Number(progress.processed || 0) / progress.total) * 100));
  }, [progress]);

  const startOptimization = async () => {
    if (!scan?.candidates || running) return;
    const confirmed = await requestConfirmation(
      `Optimize ${scan.candidates} referenced product image${scan.candidates === 1 ? "" : "s"}? ` +
      `GDP will create ${scan.maxDimension}px WebP storefront copies, keep the originals, and switch only the product references.`
    );
    if (!confirmed) return;

    setRunning(true);
    setResult(null);
    setRestoreResult(null);
    setError("");
    setProgress({ processed: 0, total: scan.candidates, phase: "starting" });

    try {
      const nextResult = await optimizeLegacyProductImages({
        onProgress: (nextProgress) => setProgress(nextProgress),
      });
      setResult(nextResult);
      await loadScan();
    } catch (err) {
      console.error("Product image optimization failed:", err);
      setError(err?.message || "Product image optimization failed.");
    } finally {
      setRunning(false);
    }
  };

  const startRestore = async () => {
    if (restoring || running) return;
    const confirmed = await requestConfirmation(
      "Restore product references to their original images? Optimized copies will remain stored, but the storefront will return to the original URLs."
    );
    if (!confirmed) return;

    setRestoring(true);
    setRestoreResult(null);
    setError("");
    try {
      const nextResult = await restoreOriginalProductImages({
        onProgress: (nextProgress) => setProgress(nextProgress),
      });
      setRestoreResult(nextResult);
      await loadScan();
    } catch (err) {
      console.error("Product image rollback failed:", err);
      setError(err?.message || "Could not restore the original product image references.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#171717]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#444] hover:text-black"
          >
            <ArrowLeft size={16} /> Back to products
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <ShieldCheck size={14} /> Admin-only migration
          </div>
        </div>

        <div className="rounded-2xl border border-[#dedede] bg-white overflow-hidden shadow-sm">
          <div className="p-6 md:p-8 border-b border-[#e7e7e7]">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 shrink-0 rounded-xl bg-black text-white flex items-center justify-center">
                <ImageDown size={22} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#777] mb-1">GDP media optimization</div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Downsize legacy product images</h1>
                <p className="mt-2 max-w-3xl text-sm md:text-base leading-6 text-[#5d5d5d]">
                  Create lightweight storefront copies of the product images already in Supabase. Originals stay untouched for archive or production use, while product pages switch to the smaller files to reduce Cached Egress.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-7">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Metric label="Recommended max" value={`${scan?.maxDimension || 1400}px`} />
              <Metric label="Format" value="WebP" />
              <Metric label="Quality" value={`${Math.round((scan?.quality || 0.82) * 100)}%`} />
              <Metric label="Originals" value="Preserved" />
            </div>

            <div className="rounded-xl border border-[#e1e1e1] bg-[#fafafa] p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Current product media scan</div>
                  <div className="text-sm text-[#666] mt-1">
                    {scanning
                      ? "Scanning product references…"
                      : `${scan?.candidates || 0} image${scan?.candidates === 1 ? "" : "s"} can be checked for downsizing.`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadScan}
                  disabled={scanning || running || restoring}
                  className="h-9 px-3 rounded-lg border border-[#d3d3d3] bg-white text-sm font-medium disabled:opacity-50"
                >
                  {scanning ? "Scanning…" : "Scan again"}
                </button>
              </div>

              {!scanning && scan && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  <MiniMetric label="Products" value={scan.productCount} />
                  <MiniMetric label="Image references" value={scan.totalImages} />
                  <MiniMetric label="Already optimized" value={scan.alreadyOptimized} />
                  <MiniMetric label="Local/external skipped" value={scan.localOrExternal} />
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {(running || restoring || progress) && (
              <div className="rounded-xl border border-[#dedede] p-4 md:p-5">
                <div className="flex items-center justify-between gap-3 text-sm mb-2">
                  <div className="font-medium">
                    {restoring ? "Restoring originals" : running ? "Optimizing images" : "Last operation"}
                  </div>
                  <div className="text-[#666]">
                    {progress?.processed || 0}{progress?.total ? ` / ${progress.total}` : ""}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[#ececec] overflow-hidden">
                  <div
                    className="h-full bg-black transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {progress?.productName && (
                  <div className="mt-2 text-xs text-[#777] truncate">{progress.productName}</div>
                )}
                {(running || restoring) && (
                  <div className="mt-3 text-xs text-amber-700 flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    Keep this admin tab open until the process finishes.
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 md:p-5">
                <div className="flex items-center gap-2 font-semibold text-emerald-900">
                  <CheckCircle2 size={18} /> Optimization complete
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                  <ResultMetric label="Images switched" value={result.optimized} />
                  <ResultMetric label="Already efficient" value={result.skipped} />
                  <ResultMetric label="Before" value={formatBytes(result.originalBytes)} />
                  <ResultMetric label="After" value={formatBytes(result.optimizedBytes)} />
                </div>
                <div className="mt-4 text-sm text-emerald-900">
                  Estimated file-size reduction for switched images: <strong>{result.savedPercent}%</strong> ({formatBytes(result.savedBytes)} saved).
                </div>
                {result.errors?.length > 0 && (
                  <div className="mt-3 text-sm text-amber-800">
                    {result.errors.length} item{result.errors.length === 1 ? "" : "s"} need review. Successful images were still kept and applied safely.
                  </div>
                )}
              </div>
            )}

            {restoreResult && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Restored {restoreResult.restored} image reference{restoreResult.restored === 1 ? "" : "s"}. {restoreResult.skipped ? `${restoreResult.skipped} changed references were left untouched.` : ""}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={startOptimization}
                disabled={running || restoring || scanning || !scan?.candidates}
                className="h-11 px-5 rounded-xl bg-black text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {running ? <Loader2 size={17} className="animate-spin" /> : <ImageDown size={17} />}
                {running ? "Optimizing…" : `Optimize ${scan?.candidates || 0} existing images`}
              </button>

              <button
                type="button"
                onClick={startRestore}
                disabled={running || restoring || scanning}
                className="h-11 px-5 rounded-xl border border-[#d6d6d6] bg-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {restoring ? <Loader2 size={17} className="animate-spin" /> : <RotateCcw size={17} />}
                {restoring ? "Restoring…" : "Rollback to originals"}
              </button>
            </div>

            <div className="text-xs leading-5 text-[#707070] border-t border-[#ececec] pt-5">
              The optimizer never deletes or overwrites original product files. It uploads versioned WebP copies with long-lived caching and changes only the product image references. A rollback record is stored for every switched image.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-[#e2e2e2] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#777]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div>
      <div className="text-[#777] text-xs">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function ResultMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-white/80 border border-emerald-100 p-3">
      <div className="text-xs text-emerald-800">{label}</div>
      <div className="font-semibold text-emerald-950 mt-0.5">{value}</div>
    </div>
  );
}
