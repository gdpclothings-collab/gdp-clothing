import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Package,
  CheckCircle2,
  FileEdit,
  Archive,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  Trash2,
  Image as ImageIcon,
  Tags,
  Boxes,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { adminProductsApi } from "@/lib/adminProductsApi";

const PAGE_SIZE = 25;

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const splitComma = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const splitLines = (value) =>
  String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

function money(value, currency = "CAD") {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency,
  });
}

export default function ProductsModule() {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [collections, setCollections] = useState([]);
  const [settings, setSettings] = useState({ low_stock_threshold: 5, currency: "CAD" });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadReference = async () => {
    try {
      const [collectionRows, settingsRow] = await Promise.all([
        adminProductsApi.collections(),
        adminProductsApi.settings(),
      ]);
      setCollections(collectionRows);
      setSettings(settingsRow);
      setSummary(await adminProductsApi.summary(settingsRow.low_stock_threshold));
    } catch (err) {
      console.error("Product reference data failed:", err);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminProductsApi.list({
        page,
        pageSize: PAGE_SIZE,
        search,
        status,
      });
      setProducts(result.products);
      setTotal(result.total);
    } catch (err) {
      console.error("Product module load failed:", err);
      setError(err?.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReference();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const afterSave = async (message) => {
    setEditor(null);
    showNotice(message);
    await Promise.all([loadProducts(), loadReference()]);
  };

  const setProductStatus = async (product, nextStatus) => {
    try {
      await adminProductsApi.setStatus(product.id, nextStatus);
      showNotice(`${product.name} is now ${nextStatus}.`);
      await Promise.all([loadProducts(), loadReference()]);
    } catch (err) {
      console.error("Product status change failed:", err);
      showNotice(err?.message || "Product update failed.");
    }
  };

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <SummaryCard label="All products" value={summary?.all ?? "—"} icon={Package} />
        <SummaryCard label="Active" value={summary?.active ?? "—"} icon={CheckCircle2} />
        <SummaryCard label="Draft" value={summary?.draft ?? "—"} icon={FileEdit} />
        <SummaryCard label="Archived" value={summary?.archived ?? "—"} icon={Archive} />
        <SummaryCard label="Low stock variants" value={summary?.lowStock ?? "—"} icon={AlertTriangle} />
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search product, handle, category or vendor"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] outline-none focus:ring-2 focus:ring-black/10 text-sm"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-[#d5d5d5] px-3 bg-white text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          <button
            type="button"
            onClick={() => {
              loadProducts();
              loadReference();
            }}
            className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center justify-center gap-2 hover:bg-[#fafafa]"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            type="button"
            onClick={() => setEditor({ mode: "create", product: null })}
            className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Plus size={15} /> Add product
          </button>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Product</Th>
                <Th>Status</Th>
                <Th>Inventory</Th>
                <Th>Category</Th>
                <Th>Vendor</Th>
                <Th right>Price</Th>
                <Th>Updated</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-[#777]">
                    Loading products…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <Package size={22} className="mx-auto text-[#aaa]" />
                    <div className="font-medium mt-3">No matching products</div>
                    <div className="text-xs text-[#777] mt-1">Create a product or change your filters.</div>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const stock = (product.variants || []).reduce(
                    (sum, variant) => sum + Number(variant.stock || 0),
                    0
                  );
                  const low = product.trackInventory && (product.variants || []).some(
                    (variant) => Number(variant.stock || 0) <= Number(settings.low_stock_threshold || 0)
                  );

                  return (
                    <tr key={product.id} className="border-t border-[#eeeeee] hover:bg-[#fafafa]">
                      <Td>
                        <button
                          type="button"
                          onClick={() => setEditor({ mode: "edit", product })}
                          className="flex items-center gap-3 text-left"
                        >
                          <div className="w-11 h-11 rounded-lg bg-[#f2f2f2] border border-[#e5e5e5] overflow-hidden grid place-items-center shrink-0">
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={17} className="text-[#aaa]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold max-w-[300px] truncate">{product.name}</div>
                            <div className="text-[11px] text-[#808080] mt-0.5">/{product.slug}</div>
                            {product.customDesignable && (
                              <span className="inline-flex mt-1 rounded-full bg-violet-100 text-violet-700 text-[9px] font-semibold px-2 py-0.5">
                                CUSTOM STUDIO
                              </span>
                            )}
                          </div>
                        </button>
                      </Td>
                      <Td><StatusPill value={product.status} /></Td>
                      <Td>
                        <div className="font-medium">{stock} units</div>
                        <div className="text-[11px] text-[#777] mt-0.5">
                          {product.variants?.length || 0} variant{product.variants?.length === 1 ? "" : "s"}
                        </div>
                        {low && (
                          <div className="text-[10px] text-amber-700 mt-1">Low stock</div>
                        )}
                      </Td>
                      <Td>{product.category || "—"}</Td>
                      <Td>{product.vendor || "GDP Clothing"}</Td>
                      <Td right>{money(product.price, settings.currency)}</Td>
                      <Td>{product.updatedAt ? new Date(product.updatedAt).toLocaleDateString("en-CA") : "—"}</Td>
                      <Td right>
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditor({ mode: "edit", product })}
                            className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] text-xs hover:bg-white"
                          >
                            Edit
                          </button>
                          {product.status === "archived" ? (
                            <button
                              onClick={() => setProductStatus(product, "draft")}
                              className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] text-xs hover:bg-white"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => setProductStatus(product, "archived")}
                              className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] text-xs hover:bg-white"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#e7e7e7] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-[#777]">
            {total === 0
              ? "0 products"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} products`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs inline-flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs text-[#777] px-2">Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs inline-flex items-center gap-1 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {editor && (
        <ProductEditor
          product={editor.product}
          collections={collections}
          onClose={() => setEditor(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  );
}

function ProductEditor({ product, collections, onClose, onSaved }) {
  const isEdit = Boolean(product?.id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    status: product?.status || "draft",
    type: product?.type || "",
    category: product?.category || "",
    vendor: product?.vendor || "GDP Clothing",
    images: (product?.images || []).join("\n"),
    price: product?.price ?? "",
    compareAtPrice: product?.compareAtPrice ?? "",
    costPerItem: product?.costPerItem ?? "",
    sizes: (product?.sizes || []).join(", "),
    colors: (product?.colors || []).join(", "),
    tags: (product?.tags || []).join(", "),
    barcode: product?.barcode || "",
    material: product?.material || "",
    trackInventory: product?.trackInventory !== false,
    requiresShipping: product?.requiresShipping !== false,
    taxable: product?.taxable !== false,
    fulfillmentMode: product?.fulfillmentMode || "in_house",
    podProvider: product?.podProvider || "",
    featured: Boolean(product?.featured),
    bestSeller: Boolean(product?.bestSeller),
    newArrival: Boolean(product?.newArrival),
    customDesignable: Boolean(product?.customDesignable),
    collectionIds: product?.collectionIds || [],
    seoTitle: product?.seo?.title || "",
    seoDescription: product?.seo?.description || "",
  }));
  const [variants, setVariants] = useState(() =>
    product?.variants?.length
      ? product.variants.map((variant) => ({ ...variant }))
      : [{ name: "Default", sku: "", podSku: "", stock: 0, price: null, color: "", size: "" }]
  );

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const toggleCollection = (collectionId) => {
    setForm((current) => ({
      ...current,
      collectionIds: current.collectionIds.includes(collectionId)
        ? current.collectionIds.filter((id) => id !== collectionId)
        : [...current.collectionIds, collectionId],
    }));
  };

  const updateVariant = (index, key, value) => {
    setVariants((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [key]: value } : variant
      )
    );
  };

  const addVariant = () => {
    setVariants((current) => [
      ...current,
      { name: "Variant", sku: "", podSku: "", stock: 0, price: null, color: "", size: "" },
    ]);
  };

  const removeVariant = (index) => {
    setVariants((current) => current.filter((_, variantIndex) => variantIndex !== index));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: slugify(form.slug || form.name),
        description: form.description,
        status: form.status,
        type: form.type,
        category: form.category,
        vendor: form.vendor || "GDP Clothing",
        images: splitLines(form.images),
        price: Number(form.price || 0),
        compareAtPrice: form.compareAtPrice === "" ? null : Number(form.compareAtPrice),
        costPerItem: form.costPerItem === "" ? null : Number(form.costPerItem),
        sizes: splitComma(form.sizes),
        colors: splitComma(form.colors),
        tags: splitComma(form.tags),
        barcode: form.barcode || null,
        material: form.material || null,
        trackInventory: form.trackInventory,
        requiresShipping: form.requiresShipping,
        taxable: form.taxable,
        fulfillmentMode: form.fulfillmentMode,
        podProvider: form.podProvider || null,
        featured: form.featured,
        bestSeller: form.bestSeller,
        newArrival: form.newArrival,
        customDesignable: form.customDesignable,
        customization: product?.customization || {},
        collectionIds: form.collectionIds,
        seo: {
          ...(product?.seo || {}),
          title: form.seoTitle || null,
          description: form.seoDescription || null,
        },
        variants: variants.map((variant, index) => ({
          id: variant.id || null,
          name: variant.name || `Variant ${index + 1}`,
          sku: variant.sku || null,
          podSku: variant.podSku || null,
          stock: Math.max(0, Number(variant.stock || 0)),
          price: variant.price === "" || variant.price === null ? null : Number(variant.price),
          color: variant.color || null,
          size: variant.size || null,
        })),
      };

      await adminProductsApi.save(product?.id || null, payload);
      await onSaved(isEdit ? "Product updated." : "Product created.");
    } catch (err) {
      console.error("Product save failed:", err);
      window.alert(err?.message || "Product save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Close product editor"
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[760px] bg-[#f6f6f6] shadow-2xl overflow-y-auto">
        <form onSubmit={submit}>
          <div className="sticky top-0 z-20 h-16 px-5 border-b border-[#dedede] bg-white flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">{isEdit ? "Edit product" : "Add product"}</div>
              <div className="text-xs text-[#777]">
                {isEdit ? product.name : "Create a new GDP Clothing product"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]">
                <X size={18} />
              </button>
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40"
              >
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="p-4 md:p-5 space-y-4">
            <EditorSection title="Product details" icon={Package}>
              <Field label="Title">
                <input
                  value={form.name}
                  onChange={(event) => {
                    set("name", event.target.value);
                    if (!isEdit && !form.slug) set("slug", slugify(event.target.value));
                  }}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(event) => set("description", event.target.value)}
                  className={textareaClass}
                  rows={5}
                />
              </Field>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Status">
                  <select value={form.status} onChange={(event) => set("status", event.target.value)} className={inputClass}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Category">
                  <input value={form.category} onChange={(event) => set("category", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Vendor">
                  <input value={form.vendor} onChange={(event) => set("vendor", event.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Product type">
                <input value={form.type} onChange={(event) => set("type", event.target.value)} className={inputClass} />
              </Field>
            </EditorSection>

            <EditorSection title="Media" icon={ImageIcon}>
              <Field label="Image URLs" helper="One image URL per line. First image becomes the primary image.">
                <textarea
                  value={form.images}
                  onChange={(event) => set("images", event.target.value)}
                  className={textareaClass}
                  rows={4}
                  placeholder="https://..."
                />
              </Field>
            </EditorSection>

            <EditorSection title="Pricing">
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Price">
                  <input type="number" min="0" step="0.01" value={form.price} onChange={(event) => set("price", event.target.value)} className={inputClass} required />
                </Field>
                <Field label="Compare-at price">
                  <input type="number" min="0" step="0.01" value={form.compareAtPrice} onChange={(event) => set("compareAtPrice", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Cost per item">
                  <input type="number" min="0" step="0.01" value={form.costPerItem} onChange={(event) => set("costPerItem", event.target.value)} className={inputClass} />
                </Field>
              </div>
              <Toggle checked={form.taxable} onChange={(value) => set("taxable", value)} label="Charge tax on this product" />
            </EditorSection>

            <EditorSection title="Variants & inventory" icon={Boxes}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Sizes" helper="Comma separated">
                  <input value={form.sizes} onChange={(event) => set("sizes", event.target.value)} className={inputClass} placeholder="S, M, L, XL" />
                </Field>
                <Field label="Colors" helper="Comma separated">
                  <input value={form.colors} onChange={(event) => set("colors", event.target.value)} className={inputClass} placeholder="Black, White" />
                </Field>
              </div>
              <Field label="Barcode">
                <input value={form.barcode} onChange={(event) => set("barcode", event.target.value)} className={inputClass} />
              </Field>
              <Toggle checked={form.trackInventory} onChange={(value) => set("trackInventory", value)} label="Track inventory" />

              <div className="mt-4 border border-[#dedede] rounded-xl overflow-hidden">
                <div className="px-3 py-2.5 bg-[#fafafa] border-b border-[#e8e8e8] flex items-center justify-between">
                  <div className="text-sm font-semibold">Variants</div>
                  <button type="button" onClick={addVariant} className="text-xs font-medium inline-flex items-center gap-1">
                    <Plus size={13} /> Add variant
                  </button>
                </div>
                <div className="divide-y divide-[#eeeeee]">
                  {variants.length === 0 && (
                    <div className="p-4 text-sm text-[#777]">No variants. Add one before saving if inventory is tracked.</div>
                  )}
                  {variants.map((variant, index) => (
                    <div key={index} className="p-3 bg-white">
                      <div className="grid md:grid-cols-[1.2fr_1fr_.8fr_.8fr_.7fr_.8fr_auto] gap-2 items-end">
                        <TinyField label="Name">
                          <input value={variant.name} onChange={(event) => updateVariant(index, "name", event.target.value)} className={tinyInputClass} />
                        </TinyField>
                        <TinyField label="SKU">
                          <input value={variant.sku || ""} onChange={(event) => updateVariant(index, "sku", event.target.value)} className={tinyInputClass} />
                        </TinyField>
                        <TinyField label="Color">
                          <input value={variant.color || ""} onChange={(event) => updateVariant(index, "color", event.target.value)} className={tinyInputClass} />
                        </TinyField>
                        <TinyField label="Size">
                          <input value={variant.size || ""} onChange={(event) => updateVariant(index, "size", event.target.value)} className={tinyInputClass} />
                        </TinyField>
                        <TinyField label="Stock">
                          <input type="number" min="0" value={variant.stock ?? 0} onChange={(event) => updateVariant(index, "stock", event.target.value)} className={tinyInputClass} />
                        </TinyField>
                        <TinyField label="Price">
                          <input type="number" min="0" step="0.01" value={variant.price ?? ""} onChange={(event) => updateVariant(index, "price", event.target.value)} className={tinyInputClass} />
                        </TinyField>
                        <button type="button" onClick={() => removeVariant(index)} className="h-9 w-9 rounded-lg border border-[#ddd] grid place-items-center hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </EditorSection>

            <EditorSection title="Fulfillment">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Fulfillment mode">
                  <select value={form.fulfillmentMode} onChange={(event) => set("fulfillmentMode", event.target.value)} className={inputClass}>
                    <option value="in_house">In house</option>
                    <option value="pod">Print on demand</option>
                    <option value="dropship">Dropship</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="manual">Manual</option>
                  </select>
                </Field>
                {["pod", "hybrid"].includes(form.fulfillmentMode) && (
                  <Field label="POD provider">
                    <input value={form.podProvider} onChange={(event) => set("podProvider", event.target.value)} className={inputClass} placeholder="Printful, Printify…" />
                  </Field>
                )}
              </div>
              <Toggle checked={form.requiresShipping} onChange={(value) => set("requiresShipping", value)} label="This is a physical product" />
            </EditorSection>

            <EditorSection title="Collections & merchandising" icon={Tags}>
              {collections.length ? (
                <div className="grid sm:grid-cols-2 gap-2 mb-4">
                  {collections.map((collection) => (
                    <label key={collection.id} className="flex items-center gap-2 rounded-lg border border-[#dedede] bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.collectionIds.includes(collection.id)}
                        onChange={() => toggleCollection(collection.id)}
                      />
                      <span>{collection.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#777] mb-4">No active collections yet.</div>
              )}

              <Field label="Tags" helper="Comma separated">
                <input value={form.tags} onChange={(event) => set("tags", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Material">
                <input value={form.material} onChange={(event) => set("material", event.target.value)} className={inputClass} />
              </Field>

              <div className="grid sm:grid-cols-2 gap-2">
                <Toggle checked={form.featured} onChange={(value) => set("featured", value)} label="Featured" />
                <Toggle checked={form.bestSeller} onChange={(value) => set("bestSeller", value)} label="Best seller" />
                <Toggle checked={form.newArrival} onChange={(value) => set("newArrival", value)} label="New arrival" />
                <Toggle checked={form.customDesignable} onChange={(value) => set("customDesignable", value)} label="Custom Studio enabled" />
              </div>

              {form.customDesignable && (
                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-800 flex gap-2">
                  <Sparkles size={15} className="shrink-0 mt-0.5" />
                  This product can enter GDP Custom Studio. Existing customization rules are preserved.
                </div>
              )}
            </EditorSection>

            <EditorSection title="Search engine listing">
              <Field label="URL handle">
                <input value={form.slug} onChange={(event) => set("slug", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Page title">
                <input value={form.seoTitle} onChange={(event) => set("seoTitle", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Meta description">
                <textarea value={form.seoDescription} onChange={(event) => set("seoDescription", event.target.value)} className={textareaClass} rows={3} />
              </Field>
            </EditorSection>
          </div>
        </form>
      </aside>
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

function EditorSection({ title, icon: Icon = null, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#eaeaea] flex items-center gap-2">
        {Icon && <Icon size={15} className="text-[#777]" />}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, helper = null, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      {helper && <span className="text-[10px] text-[#888] ml-2">{helper}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TinyField({ label, children }) {
  return (
    <label>
      <span className="text-[9px] uppercase tracking-wide text-[#888]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 rounded-lg border border-[#e3e3e3] bg-[#fafafa] px-3 py-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function StatusPill({ value }) {
  const normalized = String(value || "draft");
  const color =
    normalized === "active"
      ? "bg-emerald-100 text-emerald-800"
      : normalized === "archived"
        ? "bg-[#eaeaea] text-[#555]"
        : "bg-amber-100 text-amber-800";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${color}`}>
      {normalized}
    </span>
  );
}

function Th({ children, right = false }) {
  return (
    <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, right = false }) {
  return (
    <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}

const inputClass =
  "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textareaClass =
  "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
const tinyInputClass =
  "w-full h-9 rounded-lg border border-[#d8d8d8] bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-black/10";
