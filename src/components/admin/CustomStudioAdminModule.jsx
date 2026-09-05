import React, { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Image as ImageIcon,
  Clock3,
  CheckCircle2,
  RefreshCw,
  Upload,
  X,
  Factory,
  PencilRuler,
  AlertTriangle,
} from "lucide-react";
import { adminCustomStudioApi } from "@/lib/adminCustomStudioApi";

function prettify(value) {
  return String(value || "—").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function CustomStudioAdminModule() {
  const [data, setData] = useState({ orders: [], designs: [], proofs: [] });
  const [selectedProof, setSelectedProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminCustomStudioApi.load());
    } catch (err) {
      console.error("Custom Studio admin load failed:", err);
      setError(err?.message || "Could not load Custom Studio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const rows = useMemo(() => {
    return data.orders.map((order) => {
      const designId =
        order.items.find((item) => item.isCustom)?.customDesignId || null;
      const design = data.designs.find((item) => item.id === designId);
      const proof =
        data.proofs.find((item) => item.orderId === order.id) ||
        data.proofs.find((item) => item.customDesignId === designId);

      return { order, design, proof };
    });
  }, [data]);

  const summary = useMemo(() => ({
    orders: rows.length,
    artwork: rows.filter(({ order }) =>
      ["artwork_needed", "design_in_progress"].includes(order.status)
    ).length,
    approval: rows.filter(({ order, proof }) =>
      ["proof_ready", "awaiting_approval", "revision_requested"].includes(order.status) ||
      ["ready", "sent", "awaiting_approval", "revision_requested"].includes(proof?.status)
    ).length,
    approved: rows.filter(({ order, proof }) =>
      order.status === "approved" || proof?.status === "approved"
    ).length,
  }), [rows]);

  const startArtwork = async (order, proof) => {
    try {
      await adminCustomStudioApi.startArtwork(order, proof);
      showNotice(`${order.orderNumber} moved to design in progress.`);
      await load();
    } catch (err) {
      console.error("Start artwork failed:", err);
      showNotice(err?.message || "Could not start artwork.");
    }
  };

  const releaseProduction = async (order) => {
    try {
      await adminCustomStudioApi.releaseApprovedOrder(order.id);
      showNotice(`${order.orderNumber} released to production.`);
      await load();
    } catch (err) {
      console.error("Release production failed:", err);
      showNotice(err?.message || "Could not release order.");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Custom orders" value={loading ? "—" : summary.orders} icon={Sparkles} />
        <SummaryCard label="Artwork" value={loading ? "—" : summary.artwork} icon={PencilRuler} />
        <SummaryCard label="Awaiting approval" value={loading ? "—" : summary.approval} icon={Clock3} />
        <SummaryCard label="Approved" value={loading ? "—" : summary.approved} icon={CheckCircle2} />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Custom order pipeline</div>
            <div className="text-xs text-[#777] mt-0.5">Customer upload → artwork → proof → approval → production</div>
          </div>
          <button onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-[#777]">Loading Custom Studio…</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <Sparkles size={24} className="mx-auto text-[#aaa]" />
              <div className="font-medium mt-3">No custom orders yet</div>
            </div>
          ) : (
            rows.map(({ order, design, proof }) => (
              <div key={order.id} className="rounded-xl border border-[#e2e2e2] overflow-hidden">
                <div className="p-4 bg-[#fafafa] border-b border-[#e8e8e8] flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
                  <div>
                    <div className="font-semibold">{order.orderNumber} · {order.customerName || "Customer"}</div>
                    <div className="text-xs text-[#777] mt-1">{order.customerEmail}</div>
                    {order.needByDate && <div className="text-xs text-amber-700 mt-1">Need by {order.needByDate}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill value={order.status} />
                    {order.status === "artwork_needed" && (
                      <button
                        onClick={() => startArtwork(order, proof)}
                        className="h-8 px-3 rounded-lg bg-[#222] text-white text-xs font-medium"
                      >
                        Start artwork
                      </button>
                    )}
                    {proof && (
                      <button
                        onClick={() => setSelectedProof({ proof, order, design })}
                        className="h-8 px-3 rounded-lg border border-[#d5d5d5] bg-white text-xs font-medium"
                      >
                        Open proof
                      </button>
                    )}
                    {(order.status === "approved" || proof?.status === "approved") && (
                      <button
                        onClick={() => releaseProduction(order)}
                        className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-medium inline-flex items-center gap-1.5"
                      >
                        <Factory size={13} /> Release
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 grid lg:grid-cols-[190px_1fr_240px] gap-4">
                  <PhotoGrid design={design} />

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-violet-700">
                      {design?.occasion || "Custom design"} · {design?.designStyle || "GDP style"}
                    </div>
                    <div className="font-semibold mt-1">{design?.productName || order.items?.find((item) => item.isCustom)?.name}</div>
                    <div className="text-sm text-[#707070] mt-1">
                      {[design?.color, design?.size].filter(Boolean).join(" · ") || "Garment details pending"}
                    </div>

                    {design?.personalization?.name && (
                      <div className="mt-3 text-sm">
                        <span className="text-[#777]">Headline:</span> {design.personalization.name}
                      </div>
                    )}

                    {design?.story && (
                      <div className="mt-3 rounded-lg bg-[#f7f7f7] p-3">
                        <div className="text-[10px] uppercase tracking-wide text-[#888]">Customer story</div>
                        <div className="text-sm mt-1 leading-6">{design.story}</div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#e2e2e2] p-3 h-fit">
                    <div className="text-[10px] uppercase tracking-wide text-[#888]">Proof workspace</div>
                    <div className="font-semibold mt-1">
                      {proof ? `v${proof.currentVersion || 0} · ${prettify(proof.status)}` : "No proof record"}
                    </div>
                    {proof && (
                      <>
                        <div className="text-xs text-[#777] mt-1">
                          Revisions {proof.revisionCount || 0}/{proof.maxRevisions || 0}
                        </div>
                        <div className="text-xs text-[#777] mt-1">
                          {proof.approvedAt ? `Approved ${formatDate(proof.approvedAt)}` : "Approval pending"}
                        </div>
                      </>
                    )}
                    {!proof && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 flex gap-2">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                        Proof workspace not created yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {selectedProof && (
        <ProofDrawer
          {...selectedProof}
          onClose={() => setSelectedProof(null)}
          onChanged={async (message) => {
            setSelectedProof(null);
            showNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ProofDrawer({ proof, order, design, onClose, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const current =
    proof.versions?.find((version) => Number(version.version) === Number(proof.currentVersion)) ||
    proof.versions?.[proof.versions.length - 1];

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await adminCustomStudioApi.uploadProof(proof, file);
      await onChanged("New proof version uploaded and sent for approval.");
    } catch (err) {
      console.error("Proof upload failed:", err);
      window.alert(err?.message || "Proof upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75]">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Close proof" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[680px] bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 h-16 px-5 border-b border-[#e3e3e3] bg-white flex items-center justify-between">
          <div>
            <div className="font-semibold">Proof · {order.orderNumber}</div>
            <div className="text-xs text-[#777]">Version {proof.currentVersion || 0} · {prettify(proof.status)}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <section className="rounded-xl border border-[#e2e2e2] overflow-hidden">
            <div className="aspect-[4/3] bg-[#f4f4f4] grid place-items-center">
              {current?.url ? (
                <img src={current.url} alt="Current design proof" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon size={28} className="text-[#aaa]" />
              )}
            </div>
            <div className="p-3 border-t border-[#e8e8e8] flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Current proof</div>
                <div className="text-xs text-[#777]">v{proof.currentVersion || 0}</div>
              </div>
              <label className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer">
                <Upload size={14} />
                {uploading ? "Uploading…" : "Upload revision"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => upload(event.target.files?.[0])}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-[#e2e2e2] p-4">
            <div className="text-sm font-semibold">Design brief</div>
            <div className="text-xs text-[#777] mt-2">
              {design?.designStyle || "GDP style"} · {design?.occasion || "Custom order"}
            </div>
            {design?.story && <div className="text-sm mt-3 leading-6">{design.story}</div>}
          </section>

          <section className="rounded-xl border border-[#e2e2e2] p-4">
            <div className="text-sm font-semibold">Proof history</div>
            <div className="mt-3 space-y-2">
              {(proof.versions || []).slice().reverse().map((version) => (
                <div key={version.id} className="rounded-lg bg-[#f7f7f7] p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Version {version.version}</div>
                    <div className="text-[11px] text-[#777]">{version.note || "Design proof"}</div>
                  </div>
                  <div className="text-xs text-[#777]">{formatDate(version.createdAt)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function PhotoGrid({ design }) {
  const photos =
    design?.photoAssets?.length
      ? design.photoAssets
      : (design?.photos || []).map((url) => ({ url }));

  if (!photos.length && !design?.previewUrl) {
    return (
      <div className="aspect-square rounded-lg bg-[#f2f2f2] grid place-items-center">
        <ImageIcon size={24} className="text-[#aaa]" />
      </div>
    );
  }

  const visible = photos.slice(0, 6);
  if (!visible.length && design?.previewUrl) {
    return <img src={design.previewUrl} alt="" className="aspect-square w-full object-cover rounded-lg bg-[#f2f2f2]" />;
  }

  return (
    <div className="grid grid-cols-3 gap-1 h-fit">
      {visible.map((photo, index) => (
        <img
          key={index}
          src={photo.url || photo}
          alt=""
          className="aspect-square w-full object-cover bg-[#f2f2f2] rounded"
        />
      ))}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#777]">{label}</div>
        <Icon size={16} className="text-[#777]" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function StatusPill({ value }) {
  const normalized = String(value || "unknown");
  const good = ["approved", "completed", "delivered"].includes(normalized);
  const warning = ["awaiting_approval", "revision_requested", "proof_ready"].includes(normalized);
  const cls = good
    ? "bg-emerald-100 text-emerald-800"
    : warning
      ? "bg-amber-100 text-amber-800"
      : "bg-[#eeeeee] text-[#555]";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${cls}`}>
      {prettify(normalized)}
    </span>
  );
}
