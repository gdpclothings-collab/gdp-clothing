import React, { useEffect, useMemo, useState } from "react";
import {
  Tags,
  Plus,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Save,
  Archive,
  RefreshCw,
  Search,
} from "lucide-react";
import { adminCollectionsApi } from "@/lib/adminCollectionsApi";

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function CollectionsModule() {
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [collectionRows, productRows] = await Promise.all([
        adminCollectionsApi.list(),
        adminCollectionsApi.products(),
      ]);
      setCollections(collectionRows);
      setProducts(productRows);
    } catch (err) {
      console.error("Collections module load failed:", err);
      setError(err?.message || "Could not load collections.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2500);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return collections;
    return collections.filter((collection) =>
      [collection.name, collection.slug, collection.description, collection.tagline]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [collections, search]);

  const setStatus = async (collection, status) => {
    try {
      await adminCollectionsApi.setStatus(collection.id, status);
      showNotice(`${collection.name} is now ${status}.`);
      await load();
    } catch (err) {
      console.error("Collection status update failed:", err);
      showNotice(err?.message || "Collection update failed.");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Summary label="Collections" value={collections.length} />
        <Summary label="Active" value={collections.filter((item) => item.status === "active").length} />
        <Summary label="Seasonal" value={collections.filter((item) => item.seasonal).length} />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search collections"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <button onClick={load} className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center justify-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setEditor({ collection: null })} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2">
            <Plus size={15} /> Create collection
          </button>
        </div>

        {error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="p-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-[#777]">Loading collections…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Tags size={24} className="mx-auto text-[#aaa]" />
              <div className="font-medium mt-3">No collections found</div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((collection) => (
                <div key={collection.id} className="rounded-xl border border-[#e2e2e2] overflow-hidden">
                  <button
                    onClick={() => setEditor({ collection })}
                    className="w-full aspect-[16/8] bg-[#f2f2f2] overflow-hidden grid place-items-center"
                  >
                    {collection.image ? (
                      <img src={collection.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={24} className="text-[#aaa]" />
                    )}
                  </button>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <button onClick={() => setEditor({ collection })} className="font-semibold text-left">
                          {collection.name}
                        </button>
                        <div className="text-[11px] text-[#777] mt-1">/{collection.slug}</div>
                      </div>
                      <StatusPill value={collection.status} />
                    </div>
                    <div className="text-xs text-[#777] mt-3 line-clamp-2">
                      {collection.description || "No description yet."}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span>{collection.products.length} product{collection.products.length === 1 ? "" : "s"}</span>
                      <span className="text-[#777] capitalize">{collection.sortOrder.replaceAll("_", " ")}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={() => setEditor({ collection })} className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs">
                        Edit
                      </button>
                      {collection.status === "active" ? (
                        <button onClick={() => setStatus(collection, "archived")} className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs inline-flex items-center gap-1.5">
                          <Archive size={12} /> Archive
                        </button>
                      ) : (
                        <button onClick={() => setStatus(collection, "active")} className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs">
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {editor && (
        <CollectionEditor
          collection={editor.collection}
          products={products}
          onClose={() => setEditor(null)}
          onSaved={async (message) => {
            setEditor(null);
            showNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function CollectionEditor({ collection, products, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [form, setForm] = useState({
    name: collection?.name || "",
    slug: collection?.slug || "",
    description: collection?.description || "",
    image: collection?.image || "",
    tagline: collection?.tagline || "",
    seasonal: Boolean(collection?.seasonal),
    status: collection?.status || "active",
    sortOrder: collection?.sortOrder || "manual",
    productIds: (collection?.products || []).map((product) => product.id),
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products.slice(0, 100);
    return products
      .filter((product) => [product.name, product.slug].join(" ").toLowerCase().includes(term))
      .slice(0, 100);
  }, [products, productSearch]);

  const toggleProduct = (productId) => {
    setForm((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((id) => id !== productId)
        : [...current.productIds, productId],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminCollectionsApi.save(collection?.id || null, {
        ...form,
        slug: slugify(form.slug || form.name),
      });
      await onSaved(collection?.id ? "Collection updated." : "Collection created.");
    } catch (err) {
      console.error("Collection save failed:", err);
      window.alert(err?.message || "Collection save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Close collection editor" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[700px] bg-[#f6f6f6] shadow-2xl overflow-y-auto">
        <form onSubmit={submit}>
          <div className="sticky top-0 z-20 h-16 px-5 border-b border-[#dedede] bg-white flex items-center justify-between">
            <div>
              <div className="font-semibold">{collection?.id ? "Edit collection" : "Create collection"}</div>
              <div className="text-xs text-[#777]">Organize GDP Clothing products for storefront browsing</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]"><X size={18} /></button>
              <button type="submit" disabled={saving || !form.name.trim()} className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40">
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <Section title="Collection details">
              <Field label="Title">
                <input
                  value={form.name}
                  onChange={(event) => {
                    set("name", event.target.value);
                    if (!collection?.id && !form.slug) set("slug", slugify(event.target.value));
                  }}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={(event) => set("description", event.target.value)} className={textareaClass} rows={4} />
              </Field>
              <Field label="Tagline">
                <input value={form.tagline} onChange={(event) => set("tagline", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Image URL">
                <input value={form.image} onChange={(event) => set("image", event.target.value)} className={inputClass} />
              </Field>
              <Field label="URL handle">
                <input value={form.slug} onChange={(event) => set("slug", event.target.value)} className={inputClass} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Status">
                  <select value={form.status} onChange={(event) => set("status", event.target.value)} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Sort order">
                  <select value={form.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} className={inputClass}>
                    <option value="manual">Manual</option>
                    <option value="best_selling">Best selling</option>
                    <option value="alpha_asc">A–Z</option>
                    <option value="alpha_desc">Z–A</option>
                    <option value="price_asc">Lowest price</option>
                    <option value="price_desc">Highest price</option>
                    <option value="newest">Newest</option>
                  </select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.seasonal} onChange={(event) => set("seasonal", event.target.checked)} />
                Seasonal collection
              </label>
            </Section>

            <Section title={`Products (${form.productIds.length})`}>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
                <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products" className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d4d4d4] text-sm" />
              </div>
              <div className="mt-3 max-h-[360px] overflow-y-auto border border-[#e2e2e2] rounded-lg divide-y divide-[#eeeeee]">
                {visibleProducts.map((product) => (
                  <label key={product.id} className="px-3 py-2.5 bg-white flex items-center gap-3 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} />
                    <div className="w-8 h-8 rounded bg-[#f2f2f2] overflow-hidden grid place-items-center">
                      {product.images?.[0] ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={13} className="text-[#aaa]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{product.name}</div>
                      <div className="text-[10px] text-[#888]">/{product.slug}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Section>
          </div>
        </form>
      </aside>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-xl border border-[#dedede] bg-white p-4">
      <div className="text-xs text-[#777]">{label}</div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#eaeaea] text-sm font-semibold">{title}</div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function StatusPill({ value }) {
  const active = value === "active";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${active ? "bg-emerald-100 text-emerald-800" : "bg-[#eeeeee] text-[#555]"}`}>
      {active ? "Active" : "Archived"}
    </span>
  );
}

const inputClass = "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textareaClass = "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
