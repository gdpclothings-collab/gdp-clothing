import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Ruler, Save, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { adminProductsApi } from "@/lib/adminProductsApi";

const EMPTY_FORM = {
  fit: "",
  audience: "",
  sleeveType: "",
  sizeGuideNote: "",
  sizeGuideRows: "",
};

const normalizeRows = (value) => String(value || "").replace(/\r\n/g, "\n").trim();

function validateMeasurementRows(value) {
  const source = normalizeRows(value);
  if (!source) return "";
  const rows = source.split(/\n|;/).map((row) => row.trim()).filter(Boolean);
  if (rows.length < 2) return "Add a header row and at least one size row, or leave the chart blank.";
  const columnCounts = rows.map((row) => row.split("|").length);
  if (columnCounts.some((count) => count < 2)) return "Each measurement row needs at least two columns separated by |.";
  if (new Set(columnCounts).size > 1) return "Every measurement row must use the same number of columns.";
  return "";
}

export default function AdminProductFit() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    adminProductsApi.list({ page: 1, pageSize: 100 })
      .then((result) => {
        if (!active) return;
        setProducts(result.products || []);
      })
      .catch((err) => active && setError(err?.message || "Could not load products."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setProduct(null);
      setForm(EMPTY_FORM);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    adminProductsApi.get(selectedId)
      .then((nextProduct) => {
        if (!active) return;
        const meta = nextProduct?.metafields || {};
        setProduct(nextProduct);
        setForm({
          fit: meta.fit || "",
          audience: meta.audience || "",
          sleeveType: meta.sleeve_type || "",
          sizeGuideNote: meta.size_guide_note || "",
          sizeGuideRows: meta.size_guide_rows || "",
        });
      })
      .catch((err) => active && setError(err?.message || "Could not load this product."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selectedId]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((item) => [item.name, item.slug, item.category, item.type]
      .some((value) => String(value || "").toLowerCase().includes(term)));
  }, [products, search]);

  const measurementError = validateMeasurementRows(form.sizeGuideRows);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    if (!product || measurementError || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const existing = product.metafields || {};
      const nextMetafields = { ...existing };
      const assignments = {
        fit: form.fit,
        audience: form.audience,
        sleeve_type: form.sleeveType,
        size_guide_note: form.sizeGuideNote,
        size_guide_rows: normalizeRows(form.sizeGuideRows),
      };
      Object.entries(assignments).forEach(([key, value]) => {
        const clean = String(value || "").trim();
        if (clean) nextMetafields[key] = clean;
        else delete nextMetafields[key];
      });

      const saved = await adminProductsApi.save(product.id, {
        ...product,
        metafields: nextMetafields,
      });
      setProduct(saved);
      setNotice("Fit & Size settings saved. The product page will use these values immediately after the storefront refreshes.");
    } catch (err) {
      setError(err?.message || "Could not save Fit & Size settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#111214] text-white">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 md:px-7">
          <Link to="/admin/products" className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/15"><ArrowLeft size={15} /> Products</Link>
          <div className="ml-auto flex items-center gap-2 text-sm font-semibold"><Ruler size={17} /> Fit & Size</div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6 md:px-7 md:py-8">
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#a70f2d]">GDP Commerce Admin</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Product Fit & Size</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5b5f66]">Manage the fit information and optional garment measurement chart used by the customer-facing Product Detail Page. Measurements are never generated automatically.</p>
        </div>

        {notice && <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={16} /> {notice}</div>}
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="rounded-xl border border-[#dedfe3] bg-white p-4 lg:sticky lg:top-20 lg:self-start">
            <div className="text-sm font-semibold">Choose product</div>
            <div className="relative mt-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="h-10 w-full rounded-lg border border-[#d5d5d5] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-black/10" />
            </div>
            <div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
              {loading && !products.length ? <div className="py-6 text-center text-sm text-[#777]">Loading products…</div> : filteredProducts.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${selectedId === item.id ? "border-black bg-black text-white" : "border-transparent hover:border-[#ddd] hover:bg-[#fafafa]"}`}>
                  <div className="truncate text-sm font-semibold">{item.name}</div>
                  <div className={`mt-0.5 truncate text-[10px] ${selectedId === item.id ? "text-white/60" : "text-[#888]"}`}>{item.category || item.type || "Product"} · {item.status}</div>
                </button>
              ))}
            </div>
          </section>

          <form onSubmit={save} className="rounded-xl border border-[#dedfe3] bg-white p-5 md:p-6">
            {!product ? (
              <div className="grid min-h-[360px] place-items-center text-center"><div><Ruler size={28} className="mx-auto text-[#999]" /><div className="mt-3 font-semibold">Select a product</div><div className="mt-1 text-sm text-[#777]">Its current Fit & Size settings will appear here.</div></div></div>
            ) : (
              <div className="space-y-6">
                <div className="border-b border-[#e6e6e6] pb-4"><div className="text-xs uppercase tracking-[0.12em] text-[#777]">Editing</div><h2 className="mt-1 text-xl font-bold">{product.name}</h2><div className="mt-1 text-xs text-[#777]">Available sizes: {(product.sizes || []).join(", ") || "None configured"}</div></div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="mb-1.5 block text-sm font-medium">Fit</span><select value={form.fit} onChange={(event) => set("fit", event.target.value)} className="h-10 w-full rounded-lg border border-[#c9cccf] bg-white px-3 text-sm"><option value="">Not specified</option><option>Regular</option><option>Classic</option><option>Relaxed</option><option>Oversized</option><option>Slim</option></select></label>
                  <label className="block"><span className="mb-1.5 block text-sm font-medium">Audience</span><input value={form.audience} onChange={(event) => set("audience", event.target.value)} className="h-10 w-full rounded-lg border border-[#c9cccf] px-3 text-sm" placeholder="Unisex adult" /></label>
                  <label className="block"><span className="mb-1.5 block text-sm font-medium">Sleeve type</span><input value={form.sleeveType} onChange={(event) => set("sleeveType", event.target.value)} className="h-10 w-full rounded-lg border border-[#c9cccf] px-3 text-sm" placeholder="Short sleeve" /></label>
                </div>

                <label className="block"><span className="mb-1.5 block text-sm font-medium">Customer size-guide note</span><textarea value={form.sizeGuideNote} onChange={(event) => set("sizeGuideNote", event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-[#c9cccf] px-3 py-2 text-sm" placeholder="Example: Classic unisex fit. For a roomier fit, size up." /><span className="mt-1 block text-xs text-[#888]">Optional. This note appears in the PDP Size Guide and Fit + Size details.</span></label>

                <label className="block"><span className="mb-1.5 block text-sm font-medium">Garment measurement chart</span><textarea value={form.sizeGuideRows} onChange={(event) => set("sizeGuideRows", event.target.value)} rows={9} className={`w-full resize-y rounded-lg border px-3 py-2 font-mono text-sm ${measurementError ? "border-red-400 bg-red-50" : "border-[#c9cccf]"}`} placeholder={"Size|Chest|Length\nS|18 in|27 in\nM|20 in|28 in\nL|22 in|29 in"} /><span className={`mt-1 block text-xs ${measurementError ? "text-red-600" : "text-[#888]"}`}>{measurementError || "Use one row per size. Separate columns with |. The first row is the table header. Leave blank if the manufacturer has not supplied real measurements."}</span></label>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><strong>Accuracy rule:</strong> enter only measurements supplied or verified for the actual blank garment. The storefront will show a truthful “measurements not published” fallback when this chart is blank.</div>

                <div className="flex justify-end"><button type="submit" disabled={saving || Boolean(measurementError)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#202223] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Save size={15} /> {saving ? "Saving…" : "Save Fit & Size"}</button></div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
