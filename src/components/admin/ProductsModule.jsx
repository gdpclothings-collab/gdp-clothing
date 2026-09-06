import React, { useEffect, useState } from "react";
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
  Boxes,
  Sparkles,
  RefreshCw,
  Upload,
  GripVertical,
} from "lucide-react";
import { adminProductsApi } from "@/lib/adminProductsApi";

const PAGE_SIZE = 25;

const PRODUCT_CATEGORIES = [
  "Adult T-Shirt",
  "Adult Long Sleeve",
  "Youth T-Shirt",
  "Toddler T-Shirt",
  "Baby Bodysuit",
  "Hoodie",
  "Crewneck",
  "Sweater",
  "DTF Transfer",
  "Custom Product",
  "Accessories",
  "Other",
];

const APPAREL_SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

const RESERVED_PRODUCT_METAFIELDS = new Set([
  "short_description",
  "garment_brand",
  "garment_model",
  "fabric_blend",
  "fabric_weight",
  "fit",
  "audience",
  "sleeve_type",
  "neck_style",
]);

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
          settings={settings}
          onClose={() => setEditor(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  );
}

function ProductEditor({ product, collections, settings, onClose, onSaved }) {
  const [savedProductId, setSavedProductId] = useState(product?.id || null);
  const [savedVariants, setSavedVariants] = useState(() =>
    product?.variants?.length ? product.variants.map((variant) => ({ ...variant })) : []
  );
  const isEdit = Boolean(savedProductId);
  const shipping = product?.shippingPackage || {};
  const unitPrice = product?.unitPrice || {};
  const productMetafields = product?.metafields || {};
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [draggedImageIndex, setDraggedImageIndex] = useState(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState(null);
  const [form, setForm] = useState(() => ({
    name: product?.name || "",
    slug: product?.slug || "",
    shortDescription: productMetafields.short_description || "",
    description: product?.description || "",
    garmentBrand: productMetafields.garment_brand || "",
    garmentModel: productMetafields.garment_model || "",
    fabricBlend: productMetafields.fabric_blend || "",
    fabricWeight: productMetafields.fabric_weight || "",
    fit: productMetafields.fit || "",
    audience: productMetafields.audience || "",
    sleeveType: productMetafields.sleeve_type || "",
    neckStyle: productMetafields.neck_style || "",
    status: product?.status || "draft",
    type: product?.type || "",
    category: product?.category || "",
    vendor: product?.vendor || "GDP Clothing",
    images: product?.images || [],
    price: product?.price ?? "",
    compareAtPrice: product?.compareAtPrice ?? "",
    costPerItem: product?.costPerItem ?? "",
    unitPriceAmount: unitPrice.amount ?? "",
    unitPriceMeasure: unitPrice.measure ?? "",
    unitPriceUnit: unitPrice.unit || "each",
    sizes: (product?.sizes || []).join(", "),
    colors: (product?.colors || []).join(", "),
    tags: (product?.tags || []).join(", "),
    barcode: product?.barcode || product?.variants?.[0]?.barcode || "",
    material: product?.material || "",
    trackInventory: product?.trackInventory !== false,
    sellWhenOutOfStock: Boolean(product?.sellWhenOutOfStock),
    requiresShipping: product?.requiresShipping !== false,
    taxable: product?.taxable !== false,
    weight: product?.weight ?? "",
    weightUnit: product?.weightUnit || "g",
    packageName: shipping.name || "Standard apparel parcel",
    packageLength: shipping.length ?? "",
    packageWidth: shipping.width ?? "",
    packageHeight: shipping.height ?? "",
    packageUnit: shipping.dimensionUnit || "cm",
    countryOfOrigin: product?.countryOfOrigin || "",
    hsCode: product?.hsCode || "",
    fulfillmentMode: product?.fulfillmentMode || "in_house",
    podProvider: product?.podProvider || "",
    featured: Boolean(product?.featured),
    bestSeller: Boolean(product?.bestSeller),
    newArrival: Boolean(product?.newArrival),
    customDesignable: Boolean(product?.customDesignable),
    customization: product?.customization || {},
    collectionIds: product?.collectionIds || [],
    salesChannels: product?.salesChannels?.length ? product.salesChannels : ["online_store"],
    themeTemplate: product?.themeTemplate || "default",
    seoTitle: product?.seo?.title || "",
    seoDescription: product?.seo?.description || "",
  }));
  const [variants, setVariants] = useState(() =>
    product?.variants?.length
      ? product.variants.map((variant) => ({ ...variant }))
      : [{ name: "Default", sku: "", barcode: "", podSku: "", stock: 0, price: null, color: "", size: "" }]
  );
  const [metafields, setMetafields] = useState(() => {
    const entries = Object.entries(product?.metafields || {}).filter(
      ([key]) => !RESERVED_PRODUCT_METAFIELDS.has(key)
    );
    return entries.length
      ? entries.map(([key, value]) => ({ key, value: String(value ?? "") }))
      : [];
  });
  const [baselineSnapshot, setBaselineSnapshot] = useState(null);
  const [saveState, setSaveState] = useState(isEdit ? "saved" : "unsaved");
  const [mediaFilters, setMediaFilters] = useState({
    search: "",
    view: "all",
    color: "all",
    assignment: "all",
    groupBy: "color",
    sortBy: "display_order",
  });
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [mediaBulkView, setMediaBulkView] = useState("");
  const [mediaBulkColor, setMediaBulkColor] = useState("");
  const [variantFilters, setVariantFilters] = useState({
    search: "",
    color: "all",
    size: "all",
    stock: "all",
    pricing: "all",
    groupBy: "color",
    sortBy: "color_size",
  });
  const [selectedVariantKeys, setSelectedVariantKeys] = useState([]);
  const [variantBulkStock, setVariantBulkStock] = useState("");
  const [variantBulkPrice, setVariantBulkPrice] = useState("");
  const [variantBulkAdjustment, setVariantBulkAdjustment] = useState("");

  useEffect(() => {
    const snapshot = JSON.stringify({ form, variants, metafields });
    if (baselineSnapshot === null) {
      setBaselineSnapshot(snapshot);
      return;
    }
    if (!saving) {
      setSaveState(isEdit && snapshot === baselineSnapshot ? "saved" : "unsaved");
    }
  }, [form, variants, metafields, baselineSnapshot, isEdit, saving]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const setPreviewConfig = (key, value) => {
    setForm((current) => ({
      ...current,
      customization: {
        ...(current.customization || {}),
        preview: {
          ...(current.customization?.preview || {}),
          [key]: value,
        },
      },
    }));
  };

  const updateMediaAssignments = (urls, patchOrFactory, { clear = false } = {}) => {
    const selectedUrls = Array.from(new Set((urls || []).filter(Boolean)));
    if (!selectedUrls.length) return;

    setForm((current) => {
      const selectedSet = new Set(selectedUrls);
      const media = { ...(current.customization?.media || {}) };
      const existingPreview = current.customization?.preview || {};
      const colorMockups = Object.fromEntries(
        Object.entries(existingPreview.colorMockups || {}).map(([color, value]) => [
          color,
          { ...(value || {}) },
        ])
      );

      let frontMockupUrl = existingPreview.frontMockupUrl || "";
      let backMockupUrl = existingPreview.backMockupUrl || "";

      if (selectedSet.has(frontMockupUrl)) frontMockupUrl = "";
      if (selectedSet.has(backMockupUrl)) backMockupUrl = "";

      for (const [color, mockups] of Object.entries(colorMockups)) {
        if (selectedSet.has(mockups.frontUrl)) delete mockups.frontUrl;
        if (selectedSet.has(mockups.backUrl)) delete mockups.backUrl;
        if (!mockups.frontUrl && !mockups.backUrl) delete colorMockups[color];
      }

      for (const url of selectedUrls) {
        const previousMeta = media[url] || {};
        if (clear) {
          delete media[url];
          continue;
        }

        const patch =
          typeof patchOrFactory === "function"
            ? patchOrFactory(previousMeta, url)
            : patchOrFactory || {};
        const nextMeta = { ...previousMeta, ...patch };
        media[url] = nextMeta;

        if (["front", "back"].includes(nextMeta.view)) {
          if (nextMeta.color) {
            colorMockups[nextMeta.color] = {
              ...(colorMockups[nextMeta.color] || {}),
              [nextMeta.view === "front" ? "frontUrl" : "backUrl"]: url,
            };
          } else if (nextMeta.view === "front") {
            frontMockupUrl = url;
          } else {
            backMockupUrl = url;
          }
        }
      }

      return {
        ...current,
        customization: {
          ...(current.customization || {}),
          media,
          preview: {
            ...existingPreview,
            frontMockupUrl,
            backMockupUrl,
            colorMockups,
          },
        },
      };
    });
  };

  const setMediaMeta = (url, key, value) => {
    updateMediaAssignments([url], { [key]: value });
  };

  const setColorPreviewValue = (color, key, value) => {
    setForm((current) => ({
      ...current,
      customization: {
        ...(current.customization || {}),
        preview: {
          ...(current.customization?.preview || {}),
          colorMockups: {
            ...(current.customization?.preview?.colorMockups || {}),
            [color]: {
              ...(current.customization?.preview?.colorMockups?.[color] || {}),
              [key]: value,
            },
          },
        },
      },
    }));
  };

  const setColorSwatch = (color, value) => {
    setForm((current) => ({
      ...current,
      customization: {
        ...(current.customization || {}),
        preview: {
          ...(current.customization?.preview || {}),
          colorSwatches: {
            ...(current.customization?.preview?.colorSwatches || {}),
            [color]: value,
          },
        },
      },
    }));
  };

  const setPrintAreaValue = (side, key, value) => {
    setForm((current) => ({
      ...current,
      customization: {
        ...(current.customization || {}),
        preview: {
          ...(current.customization?.preview || {}),
          printArea: {
            ...(current.customization?.preview?.printArea || {}),
            [side]: {
              ...(current.customization?.preview?.printArea?.[side] || {}),
              [key]: value === "" ? "" : Number(value),
            },
          },
        },
      },
    }));
  };

  const toggleCollection = (collectionId) => {
    setForm((current) => ({
      ...current,
      collectionIds: current.collectionIds.includes(collectionId)
        ? current.collectionIds.filter((id) => id !== collectionId)
        : [...current.collectionIds, collectionId],
    }));
  };

  const toggleMediaSelection = (url) => {
    setSelectedMedia((current) =>
      current.includes(url) ? current.filter((item) => item !== url) : [...current, url]
    );
  };

  const generateMediaAltText = (urls) => {
    updateMediaAssignments(urls, (meta) => ({
      alt: [form.name || "Product", meta.color, meta.view]
        .filter(Boolean)
        .map((part) => {
          const value = String(part);
          return value.charAt(0).toUpperCase() + value.slice(1);
        })
        .join(" - "),
    }));
  };

  const clearSelectedMediaAssignments = () => {
    if (!selectedMedia.length) return;
    if (!window.confirm(`Clear view, color and alt-text assignments for ${selectedMedia.length} selected media item${selectedMedia.length === 1 ? "" : "s"}?`)) {
      return;
    }
    updateMediaAssignments(selectedMedia, {}, { clear: true });
  };

  const updateVariant = (index, key, value) => {
    setVariants((current) =>
      current.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [key]: value } : variant
      )
    );
  };

  const updatePrimaryVariant = (key, value) => {
    setVariants((current) => {
      const next = current.length
        ? current.map((variant, index) => (index === 0 ? { ...variant, [key]: value } : variant))
        : [{ name: "Default", sku: "", barcode: "", podSku: "", stock: 0, price: null, color: "", size: "", [key]: value }];
      return next;
    });
  };

  const variantKey = (variant, index) => variant?.id ? `id:${variant.id}` : `new:${index}`;

  const toggleVariantSelection = (variant, index) => {
    const key = variantKey(variant, index);
    setSelectedVariantKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  const updateSelectedVariants = (updater) => {
    if (!selectedVariantKeys.length) return;
    const selected = new Set(selectedVariantKeys);
    setVariants((current) =>
      current.map((variant, index) =>
        selected.has(variantKey(variant, index)) ? updater(variant, index) : variant
      )
    );
  };

  const retireSelectedVariants = () => {
    if (!selectedVariantKeys.length) return;
    if (selectedVariantKeys.length >= variants.length) {
      window.alert("Keep at least one variant. Create a replacement variant before retiring the entire set.");
      return;
    }
    const selected = new Set(selectedVariantKeys);
    const selectedRows = variants.filter((variant, index) => selected.has(variantKey(variant, index)));
    const stock = selectedRows.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
    const message = stock > 0
      ? `Retire ${selectedRows.length} selected variants? They currently contain ${stock} unit(s) of inventory, which will be set to 0 after save.`
      : `Retire ${selectedRows.length} selected variant${selectedRows.length === 1 ? "" : "s"}?`;
    if (!window.confirm(message)) return;
    setVariants((current) =>
      current.filter((variant, index) => !selected.has(variantKey(variant, index)))
    );
    setSelectedVariantKeys([]);
  };

  const toggleSizePreset = (size) => {
    const current = splitComma(form.sizes);
    const exists = current.some((item) => item.toLowerCase() === size.toLowerCase());
    set("sizes", (exists ? current.filter((item) => item.toLowerCase() !== size.toLowerCase()) : [...current, size]).join(", "));
  };

  const createVariantSku = (variant, index) => {
    const productCode = (slugify(form.name) || "product")
      .split("-")
      .filter(Boolean)
      .map((part) => part.slice(0, 3))
      .join("")
      .toUpperCase()
      .slice(0, 12) || "PRODUCT";
    const colorCode = slugify(variant.color || "default").replace(/-/g, "").toUpperCase().slice(0, 5) || "DEF";
    const sizeCode = slugify(variant.size || String(index + 1)).replace(/-/g, "").toUpperCase().slice(0, 5) || String(index + 1);
    return `GDP-${productCode}-${colorCode}-${sizeCode}`;
  };

  const autoFillSkus = (selectedOnly = false) => {
    const selected = new Set(selectedVariantKeys);
    setVariants((current) => current.map((variant, index) => {
      if (selectedOnly && !selected.has(variantKey(variant, index))) return variant;
      if (String(variant.sku || "").trim()) return variant;
      return { ...variant, sku: createVariantSku(variant, index) };
    }));
  };

  const addVariant = () => {
    setVariants((current) => [
      ...current,
      { name: "Variant", sku: "", barcode: "", podSku: "", stock: 0, price: null, color: "", size: "" },
    ]);
  };

  const generateVariantMatrix = () => {
    const colors = splitComma(form.colors);
    const sizes = splitComma(form.sizes);
    if (!colors.length || !sizes.length) {
      window.alert("Add at least one color and one size first.");
      return;
    }

    const targetKeys = new Set(
      colors.flatMap((variantColor) =>
        sizes.map((variantSize) => `${variantColor.trim().toLowerCase()}::${variantSize.trim().toLowerCase()}`)
      )
    );
    const removedWithStock = variants.filter((variant) => {
      const key = `${String(variant.color || "").trim().toLowerCase()}::${String(variant.size || "").trim().toLowerCase()}`;
      return !targetKeys.has(key) && Number(variant.stock || 0) > 0;
    });

    if (
      removedWithStock.length > 0 &&
      !window.confirm(
        `Generating this matrix will retire ${removedWithStock.length} existing variant${removedWithStock.length === 1 ? "" : "s"} that currently contain inventory. Continue?`
      )
    ) {
      return;
    }

    setSelectedVariantKeys([]);
    setVariants((current) => colors.flatMap((variantColor) =>
      sizes.map((variantSize) => {
        const existing = current.find((variant) =>
          String(variant.color || "").trim().toLowerCase() === variantColor.toLowerCase() &&
          String(variant.size || "").trim().toLowerCase() === variantSize.toLowerCase()
        );

        return {
          ...(existing || {}),
          name: `${variantColor} / ${variantSize}`,
          sku: existing?.sku || "",
          barcode: existing?.barcode || "",
          podSku: existing?.podSku || "",
          stock: Number(existing?.stock || 0),
          price: existing?.price ?? null,
          color: variantColor,
          size: variantSize,
        };
      })
    ));
  };

  const removeVariant = (index) => {
    const target = variants[index];
    if (
      Number(target?.stock || 0) > 0 &&
      !window.confirm(
        `${target?.name || "This variant"} currently has ${Number(target?.stock || 0)} unit(s) in stock. Removing it will retire the variant and set its inventory to 0 after save. Continue?`
      )
    ) {
      return;
    }
    const removedKey = variantKey(target, index);
    setVariants((current) => current.filter((_, variantIndex) => variantIndex !== index));
    setSelectedVariantKeys((current) => current.filter((key) => key !== removedKey));
  };

  const addImageUrl = () => {
    const url = imageUrlDraft.trim();
    if (!url) return;
    setForm((current) => ({
      ...current,
      images: current.images.includes(url) ? current.images : [...current.images, url],
    }));
    setImageUrlDraft("");
  };

  const removeImage = (index) => {
    setForm((current) => {
      const removedUrl = current.images[index];
      const nextMedia = { ...(current.customization?.media || {}) };
      if (removedUrl) delete nextMedia[removedUrl];
      return {
        ...current,
        images: current.images.filter((_, imageIndex) => imageIndex !== index),
        customization: {
          ...(current.customization || {}),
          media: nextMedia,
        },
      };
    });
    const removedUrl = form.images[index];
    if (removedUrl) {
      setSelectedMedia((current) => current.filter((url) => url !== removedUrl));
    }
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const reorderImage = (fromIndex, toIndex) => {
    if (
      fromIndex === null ||
      toIndex === null ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0
    ) {
      return;
    }

    setForm((current) => {
      if (fromIndex >= current.images.length || toIndex >= current.images.length) {
        return current;
      }

      const images = [...current.images];
      const [movedImage] = images.splice(fromIndex, 1);
      images.splice(toIndex, 0, movedImage);
      return { ...current, images };
    });
  };

  const moveImage = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.images.length) return;
    reorderImage(index, nextIndex);
  };

  const handleImageDragStart = (event, index) => {
    setDraggedImageIndex(index);
    setDragOverImageIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleImageDragOver = (event, index) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverImageIndex !== index) {
      setDragOverImageIndex(index);
    }
  };

  const handleImageDrop = (event, index) => {
    event.preventDefault();
    const transferredIndex = Number(event.dataTransfer.getData("text/plain"));
    const fromIndex = draggedImageIndex ?? (Number.isNaN(transferredIndex) ? null : transferredIndex);
    reorderImage(fromIndex, index);
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const uploadMedia = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        urls.push(await adminProductsApi.uploadMedia(file));
      }
      setForm((current) => ({
        ...current,
        images: [...current.images, ...urls.filter((url) => !current.images.includes(url))],
      }));
    } catch (err) {
      console.error("Product media upload failed:", err);
      window.alert(err?.message || "Product image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const addMetafield = () => {
    setMetafields((current) => [...current, { key: "", value: "" }]);
  };

  const updateMetafield = (index, key, value) => {
    setMetafields((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row))
    );
  };

  const removeMetafield = (index) => {
    setMetafields((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const submit = async (event) => {
    event.preventDefault();

    const submittedExistingIds = new Set(variants.map((variant) => variant.id).filter(Boolean));
    const retiringWithStock = savedVariants.filter(
      (variant) => variant.id && !submittedExistingIds.has(variant.id) && Number(variant.stock || 0) > 0
    );
    if (
      retiringWithStock.length > 0 &&
      !window.confirm(
        `Saving will retire ${retiringWithStock.length} variant${retiringWithStock.length === 1 ? "" : "s"} that still contain inventory. Continue?`
      )
    ) {
      return;
    }

    setSaving(true);
    setSaveState("saving");
    try {
      const safeVariants = variants.length
        ? variants
        : [{ name: "Default", sku: "", barcode: "", podSku: "", stock: 0, price: null, color: "", size: "" }];

      const metafieldObject = {};
      for (const row of metafields) {
        const key = String(row.key || "").trim();
        if (key) metafieldObject[key] = row.value ?? "";
      }
      const structuredMetafields = {
        short_description: form.shortDescription,
        garment_brand: form.garmentBrand,
        garment_model: form.garmentModel,
        fabric_blend: form.fabricBlend,
        fabric_weight: form.fabricWeight,
        fit: form.fit,
        audience: form.audience,
        sleeve_type: form.sleeveType,
        neck_style: form.neckStyle,
      };
      for (const [key, value] of Object.entries(structuredMetafields)) {
        const cleanValue = String(value || "").trim();
        if (cleanValue) metafieldObject[key] = cleanValue;
      }

      const payload = {
        name: form.name.trim(),
        slug: slugify(form.slug || form.name),
        description: form.description,
        status: form.status,
        type: form.type,
        category: form.category,
        vendor: form.vendor || "GDP Clothing",
        images: form.images,
        price: Number(form.price || 0),
        compareAtPrice: form.compareAtPrice === "" ? null : Number(form.compareAtPrice),
        costPerItem: form.costPerItem === "" ? null : Number(form.costPerItem),
        unitPrice: form.unitPriceAmount === "" && form.unitPriceMeasure === ""
          ? {}
          : {
              amount: form.unitPriceAmount === "" ? null : Number(form.unitPriceAmount),
              measure: form.unitPriceMeasure === "" ? null : Number(form.unitPriceMeasure),
              unit: form.unitPriceUnit || "each",
            },
        sizes: splitComma(form.sizes),
        colors: splitComma(form.colors),
        tags: splitComma(form.tags),
        barcode: form.barcode || safeVariants[0]?.barcode || null,
        material: form.material || null,
        trackInventory: form.trackInventory,
        sellWhenOutOfStock: form.sellWhenOutOfStock,
        requiresShipping: form.requiresShipping,
        taxable: form.taxable,
        weight: form.weight === "" ? null : Number(form.weight),
        weightUnit: form.weightUnit || "g",
        shippingPackage: {
          name: form.packageName || null,
          length: form.packageLength === "" ? null : Number(form.packageLength),
          width: form.packageWidth === "" ? null : Number(form.packageWidth),
          height: form.packageHeight === "" ? null : Number(form.packageHeight),
          dimensionUnit: form.packageUnit || "cm",
        },
        countryOfOrigin: form.countryOfOrigin || null,
        hsCode: form.hsCode || null,
        fulfillmentMode: form.fulfillmentMode,
        podProvider: form.podProvider || null,
        featured: form.featured,
        bestSeller: form.bestSeller,
        newArrival: form.newArrival,
        customDesignable: form.customDesignable,
        customization: form.customization || {},
        collectionIds: form.collectionIds,
        salesChannels: form.salesChannels,
        themeTemplate: form.themeTemplate || "default",
        metafields: metafieldObject,
        seo: {
          ...(product?.seo || {}),
          title: form.seoTitle || null,
          description: form.seoDescription || null,
        },
        variants: safeVariants.map((variant, index) => ({
          id: variant.id || null,
          name: variant.name || `Variant ${index + 1}`,
          sku: variant.sku || null,
          barcode: variant.barcode || null,
          podSku: variant.podSku || null,
          stock: Math.max(0, Number(variant.stock || 0)),
          price: variant.price === "" || variant.price === null ? null : Number(variant.price),
          color: variant.color || null,
          size: variant.size || null,
        })),
      };

      const wasExistingProduct = Boolean(savedProductId);
      const savedProduct = await adminProductsApi.save(savedProductId, payload);
      const persistedVariants = (savedProduct?.variants || []).map((variant) => ({ ...variant }));

      setSavedProductId(savedProduct.id);
      setSavedVariants(persistedVariants);
      setVariants(persistedVariants);

      const persistedSnapshot = JSON.stringify({
        form,
        variants: persistedVariants,
        metafields,
      });
      setBaselineSnapshot(persistedSnapshot);
      setSaveState("saved");

      await onSaved(wasExistingProduct ? "Product updated." : "Product created. You can keep editing.");
    } catch (err) {
      console.error("Product save failed:", err);
      setSaveState("unsaved");
      window.alert(err?.message || "Product save failed.");
    } finally {
      setSaving(false);
    }
  };

  const primaryVariant = variants[0] || {
    sku: "",
    barcode: "",
    stock: 0,
  };
  const customStudioColors = Array.from(new Set([
    ...splitComma(form.colors),
    ...variants.map((variant) => String(variant.color || "").trim()).filter(Boolean),
  ]));

  const mediaRows = form.images.map((image, index) => {
    const meta = form.customization?.media?.[image] || {};
    const view = String(meta.view || "").trim();
    const color = String(meta.color || "").trim();
    const alt = String(meta.alt || "").trim();
    const fullyAssigned = Boolean(view && color && alt);
    return {
      image,
      index,
      view,
      color,
      alt,
      fullyAssigned,
      missingView: !view,
      missingColor: !color,
      missingAlt: !alt,
      unassigned: !view && !color && !alt,
      studioMapped: ["front", "back"].includes(view),
    };
  });
  const mediaColors = Array.from(new Set([
    ...splitComma(form.colors),
    ...mediaRows.map((row) => row.color).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));
  const mediaSummary = {
    total: mediaRows.length,
    complete: mediaRows.filter((row) => row.fullyAssigned).length,
    missingColor: mediaRows.filter((row) => row.missingColor).length,
    missingView: mediaRows.filter((row) => row.missingView).length,
    missingAlt: mediaRows.filter((row) => row.missingAlt).length,
  };
  const mediaSearch = mediaFilters.search.trim().toLowerCase();
  const visibleMediaRows = mediaRows
    .filter((row) => {
      if (
        mediaSearch &&
        ![row.color, row.view, row.alt, row.image].some((value) =>
          String(value || "").toLowerCase().includes(mediaSearch)
        )
      ) return false;
      if (mediaFilters.view !== "all") {
        if (mediaFilters.view === "unassigned" ? row.view : row.view !== mediaFilters.view) return false;
      }
      if (mediaFilters.color !== "all") {
        if (mediaFilters.color === "unassigned" ? row.color : row.color !== mediaFilters.color) return false;
      }
      if (mediaFilters.assignment !== "all") {
        const matches = {
          fully_assigned: row.fullyAssigned,
          needs_attention: !row.fullyAssigned,
          missing_color: row.missingColor,
          missing_view: row.missingView,
          missing_alt: row.missingAlt,
          unassigned: row.unassigned,
          studio_mapped: row.studioMapped,
        }[mediaFilters.assignment];
        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const groupValue = (row) =>
        mediaFilters.groupBy === "color"
          ? row.color || "zzzz-unassigned"
          : mediaFilters.groupBy === "view"
            ? row.view || "zzzz-unassigned"
            : "";
      if (mediaFilters.groupBy !== "none") {
        const groupCompare = groupValue(a).localeCompare(groupValue(b));
        if (groupCompare !== 0) return groupCompare;
      }
      if (mediaFilters.sortBy === "color") return (a.color || "zzzz").localeCompare(b.color || "zzzz") || a.index - b.index;
      if (mediaFilters.sortBy === "view") return (a.view || "zzzz").localeCompare(b.view || "zzzz") || a.index - b.index;
      if (mediaFilters.sortBy === "recent") return b.index - a.index;
      return a.index - b.index;
    });

  const lowStockThreshold = Number(settings?.low_stock_threshold ?? 5);
  const sizeRank = (size) => {
    const index = APPAREL_SIZE_PRESETS.findIndex((item) => item.toLowerCase() === String(size || "").toLowerCase());
    return index === -1 ? APPAREL_SIZE_PRESETS.length + 1 : index;
  };
  const variantRows = variants.map((variant, index) => {
    const stock = Number(variant.stock || 0);
    const priceOverride = variant.price !== null && variant.price !== undefined && variant.price !== "";
    const effectivePrice = priceOverride ? Number(variant.price || 0) : Number(form.price || 0);
    const stockStatus = stock <= 0 ? "out" : stock <= lowStockThreshold ? "low" : "in";
    return {
      variant,
      index,
      key: variantKey(variant, index),
      stock,
      stockStatus,
      priceOverride,
      effectivePrice,
      color: String(variant.color || "").trim(),
      size: String(variant.size || "").trim(),
    };
  });
  const variantColors = Array.from(new Set(variantRows.map((row) => row.color).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const variantSizes = Array.from(new Set(variantRows.map((row) => row.size).filter(Boolean))).sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));
  const variantSummary = {
    total: variantRows.length,
    inStock: variantRows.filter((row) => row.stockStatus === "in").length,
    low: variantRows.filter((row) => row.stockStatus === "low").length,
    out: variantRows.filter((row) => row.stockStatus === "out").length,
  };
  const variantSearch = variantFilters.search.trim().toLowerCase();
  const visibleVariantRows = variantRows
    .filter((row) => {
      const variant = row.variant;
      if (
        variantSearch &&
        ![variant.name, variant.sku, variant.barcode, row.color, row.size].some((value) =>
          String(value || "").toLowerCase().includes(variantSearch)
        )
      ) return false;
      if (variantFilters.color !== "all" && row.color !== variantFilters.color) return false;
      if (variantFilters.size !== "all" && row.size !== variantFilters.size) return false;
      if (variantFilters.stock !== "all" && row.stockStatus !== variantFilters.stock) return false;
      if (variantFilters.pricing === "base" && row.priceOverride) return false;
      if (variantFilters.pricing === "override" && !row.priceOverride) return false;
      if (variantFilters.pricing === "missing" && row.effectivePrice > 0) return false;
      return true;
    })
    .sort((a, b) => {
      const groupValue = (row) =>
        variantFilters.groupBy === "color"
          ? row.color || "zzzz-unassigned"
          : variantFilters.groupBy === "size"
            ? String(sizeRank(row.size)).padStart(3, "0") + "-" + (row.size || "zzzz")
            : "";
      if (variantFilters.groupBy !== "none") {
        const groupCompare = groupValue(a).localeCompare(groupValue(b));
        if (groupCompare !== 0) return groupCompare;
      }
      if (variantFilters.sortBy === "size_color") return sizeRank(a.size) - sizeRank(b.size) || (a.color || "zzzz").localeCompare(b.color || "zzzz");
      if (variantFilters.sortBy === "sku") return String(a.variant.sku || "zzzz").localeCompare(String(b.variant.sku || "zzzz"));
      if (variantFilters.sortBy === "stock_asc") return a.stock - b.stock;
      if (variantFilters.sortBy === "stock_desc") return b.stock - a.stock;
      if (variantFilters.sortBy === "price_asc") return a.effectivePrice - b.effectivePrice;
      if (variantFilters.sortBy === "price_desc") return b.effectivePrice - a.effectivePrice;
      return (a.color || "zzzz").localeCompare(b.color || "zzzz") || sizeRank(a.size) - sizeRank(b.size) || a.index - b.index;
    });

  const allVisibleMediaSelected =
    visibleMediaRows.length > 0 && visibleMediaRows.every((row) => selectedMedia.includes(row.image));
  const allVisibleVariantsSelected =
    visibleVariantRows.length > 0 && visibleVariantRows.every((row) => selectedVariantKeys.includes(row.key));

  const clearMediaFilters = () => setMediaFilters({
    search: "",
    view: "all",
    color: "all",
    assignment: "all",
    groupBy: "color",
    sortBy: "display_order",
  });
  const clearVariantFilters = () => setVariantFilters({
    search: "",
    color: "all",
    size: "all",
    stock: "all",
    pricing: "all",
    groupBy: "color",
    sortBy: "color_size",
  });

  return (
    <div className="fixed inset-0 z-[70] bg-[#f4f4f4] overflow-y-auto">
      <form onSubmit={submit} className="min-h-full">
        <div className="sticky top-0 z-30 border-b border-[#dcdcdc] bg-[#111] text-white shadow-sm">
          <div className="max-w-[1240px] mx-auto min-h-16 px-4 md:px-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] text-white/55 uppercase tracking-[0.16em]">
                Products / {isEdit ? "Edit" : "Add product"}
              </div>
              <div className="font-semibold truncate">
                {form.name.trim() || (isEdit ? product?.name : "Unsaved product")}
              </div>
              <div className="mt-0.5 text-[10px] text-white/55">
                {saveState === "saving" ? "Saving changes…" : saveState === "saved" ? "Saved" : "Unsaved changes"}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isEdit && form.status === "active" && (
                <button
                  type="button"
                  onClick={() => window.open(`/product/${savedProductId}`, "_blank", "noopener,noreferrer")}
                  className="hidden sm:inline-flex h-9 px-3 rounded-lg border border-white/20 text-sm hover:bg-white/10 items-center"
                >
                  Preview
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3 rounded-lg border border-white/20 text-sm hover:bg-white/10"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="h-9 px-4 rounded-lg bg-white text-black text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40"
              >
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 rounded-lg grid place-items-center hover:bg-white/10"
                aria-label="Close product editor"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-5 md:py-7">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_310px] gap-5 items-start">
            <div className="space-y-4">
              <EditorSection title="Product details" icon={Package}>
                <Field label="Title">
                  <input
                    value={form.name}
                    onChange={(event) => {
                      const value = event.target.value;
                      set("name", value);
                      if (!isEdit && (!form.slug || form.slug === slugify(form.name))) {
                        set("slug", slugify(value));
                      }
                    }}
                    className={inputClass}
                    placeholder="Short sleeve t-shirt"
                    required
                  />
                </Field>

                <Field label="Short description" helper="One or two lines for product cards and quick customer scanning.">
                  <textarea
                    value={form.shortDescription}
                    onChange={(event) => set("shortDescription", event.target.value)}
                    className={textareaClass}
                    rows={2}
                    maxLength={220}
                    placeholder="Classic heavyweight cotton tee made for custom printing."
                  />
                </Field>

                <Field label="Full description" helper="Describe the product, fit, fabric, print and care instructions.">
                  <textarea
                    value={form.description}
                    onChange={(event) => set("description", event.target.value)}
                    className={textareaClass}
                    rows={7}
                    placeholder="Tell customers what makes this piece special…"
                  />
                </Field>
              </EditorSection>

              <EditorSection title="Media" icon={ImageIcon}>
                <div className="rounded-xl border-2 border-dashed border-[#d6d6d6] bg-[#fafafa] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Product images</div>
                      <div className="text-xs text-[#777] mt-0.5">
                        Upload images, then drag them into display order. The first image is always the primary product photo.
                      </div>
                    </div>
                    <label className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer">
                      <Upload size={14} />
                      {uploading ? "Uploading…" : "Upload new"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploading}
                        onChange={uploadMedia}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {form.images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
                      {form.images.map((image, index) => (
                        <div
                          key={`${image}-${index}`}
                          draggable
                          onDragStart={(event) => handleImageDragStart(event, index)}
                          onDragOver={(event) => handleImageDragOver(event, index)}
                          onDrop={(event) => handleImageDrop(event, index)}
                          onDragEnd={handleImageDragEnd}
                          className={`relative aspect-square rounded-xl overflow-hidden border bg-white group select-none transition-all cursor-grab active:cursor-grabbing ${
                            draggedImageIndex === index
                              ? "opacity-55 scale-[0.98] border-[#9b9b9b]"
                              : dragOverImageIndex === index
                                ? "border-black ring-2 ring-black/10"
                                : "border-[#dedede]"
                          }`}
                          aria-label={`Product image ${index + 1}. Drag to reorder.`}
                        >
                          <img src={image} alt="" draggable="false" className="w-full h-full object-contain pointer-events-none" />
                          <div className="absolute left-2 bottom-2 h-7 px-2 rounded-full bg-black/70 text-white text-[10px] font-medium inline-flex items-center gap-1 pointer-events-none">
                            <GripVertical size={12} />
                            <span>{index + 1}</span>
                          </div>
                          {index === 0 && (
                            <span className="absolute left-2 top-2 rounded-full bg-black/80 text-white text-[9px] font-semibold px-2 py-1">
                              PRIMARY
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            onMouseDown={(event) => event.stopPropagation()}
                            className="absolute right-2 top-2 h-7 w-7 rounded-full bg-white/95 shadow grid place-items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            aria-label="Remove image"
                          >
                            <X size={13} />
                          </button>
                          <div className="absolute right-2 bottom-2 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => moveImage(index, -1)}
                              disabled={index === 0}
                              className="h-7 w-7 rounded-full bg-white/95 shadow grid place-items-center disabled:opacity-35"
                              aria-label={`Move image ${index + 1} left`}
                            >
                              <ChevronLeft size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(index, 1)}
                              disabled={index === form.images.length - 1}
                              className="h-7 w-7 rounded-full bg-white/95 shadow grid place-items-center disabled:opacity-35"
                              aria-label={`Move image ${index + 1} right`}
                            >
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {form.images.length > 0 && (
                    <div className="mt-4 rounded-xl border border-[#dedede] bg-white overflow-hidden">
                      <div className="px-3 py-3 border-b border-[#e8e8e8] bg-[#fafafa]">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold">Media assignments</div>
                            <div className="text-[10px] text-[#777] mt-0.5">
                              Filter, group and bulk-edit garment media. Front/back + color assignments automatically wire the matching Custom Studio preview.
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, assignment: "all" }))} className="rounded-full border border-[#ddd] bg-white px-2.5 py-1">
                              {mediaSummary.total} media
                            </button>
                            <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, assignment: "fully_assigned" }))} className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 px-2.5 py-1">
                              {mediaSummary.complete} complete
                            </button>
                            {mediaSummary.missingColor > 0 && (
                              <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, assignment: "missing_color" }))} className="rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-2.5 py-1">
                                {mediaSummary.missingColor} missing color
                              </button>
                            )}
                            {mediaSummary.missingView > 0 && (
                              <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, assignment: "missing_view" }))} className="rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-2.5 py-1">
                                {mediaSummary.missingView} missing view
                              </button>
                            )}
                            {mediaSummary.missingAlt > 0 && (
                              <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, assignment: "missing_alt" }))} className="rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-2.5 py-1">
                                {mediaSummary.missingAlt} missing alt
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-[1.5fr_.75fr_.85fr_1fr_.8fr_.8fr_auto] gap-2">
                          <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]" />
                            <input
                              value={mediaFilters.search}
                              onChange={(event) => setMediaFilters((current) => ({ ...current, search: event.target.value }))}
                              className={`${tinyInputClass} pl-8`}
                              placeholder="Search media, color or alt text"
                            />
                          </div>
                          <select value={mediaFilters.view} onChange={(event) => setMediaFilters((current) => ({ ...current, view: event.target.value }))} className={tinyInputClass}>
                            <option value="all">All views</option>
                            <option value="front">Front</option>
                            <option value="back">Back</option>
                            <option value="side">Side</option>
                            <option value="lifestyle">Lifestyle</option>
                            <option value="detail">Detail</option>
                            <option value="unassigned">Unassigned view</option>
                          </select>
                          <select value={mediaFilters.color} onChange={(event) => setMediaFilters((current) => ({ ...current, color: event.target.value }))} className={tinyInputClass}>
                            <option value="all">All colors</option>
                            {mediaColors.map((color) => <option key={color} value={color}>{color}</option>)}
                            <option value="unassigned">Unassigned color</option>
                          </select>
                          <select value={mediaFilters.assignment} onChange={(event) => setMediaFilters((current) => ({ ...current, assignment: event.target.value }))} className={tinyInputClass}>
                            <option value="all">All assignments</option>
                            <option value="fully_assigned">Fully assigned</option>
                            <option value="needs_attention">Needs attention</option>
                            <option value="missing_color">Missing color</option>
                            <option value="missing_view">Missing view</option>
                            <option value="missing_alt">Missing alt text</option>
                            <option value="unassigned">Unassigned</option>
                            <option value="studio_mapped">Custom Studio mapped</option>
                          </select>
                          <select value={mediaFilters.groupBy} onChange={(event) => setMediaFilters((current) => ({ ...current, groupBy: event.target.value }))} className={tinyInputClass}>
                            <option value="color">Group: Color</option>
                            <option value="view">Group: View</option>
                            <option value="none">No grouping</option>
                          </select>
                          <select value={mediaFilters.sortBy} onChange={(event) => setMediaFilters((current) => ({ ...current, sortBy: event.target.value }))} className={tinyInputClass}>
                            <option value="display_order">Display order</option>
                            <option value="color">Color A-Z</option>
                            <option value="view">View</option>
                            <option value="recent">Recently added</option>
                          </select>
                          <button type="button" onClick={clearMediaFilters} className="h-9 rounded-lg border border-[#d5d5d5] bg-white px-3 text-[10px] font-semibold">
                            Clear
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {mediaFilters.search && <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, search: "" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">Search: {mediaFilters.search} ×</button>}
                          {mediaFilters.view !== "all" && <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, view: "all" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">View: {mediaFilters.view} ×</button>}
                          {mediaFilters.color !== "all" && <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, color: "all" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">Color: {mediaFilters.color} ×</button>}
                          {mediaFilters.assignment !== "all" && <button type="button" onClick={() => setMediaFilters((current) => ({ ...current, assignment: "all" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">Assignment: {mediaFilters.assignment.replaceAll("_", " ")} ×</button>}
                        </div>

                        <div className="mt-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2 rounded-lg border border-[#e3e3e3] bg-white p-2.5">
                          <label className="flex items-center gap-2 text-[10px] font-semibold">
                            <input
                              type="checkbox"
                              checked={allVisibleMediaSelected}
                              onChange={(event) => {
                                const visibleUrls = visibleMediaRows.map((row) => row.image);
                                setSelectedMedia((current) => event.target.checked
                                  ? Array.from(new Set([...current, ...visibleUrls]))
                                  : current.filter((url) => !visibleUrls.includes(url))
                                );
                              }}
                            />
                            Select visible ({visibleMediaRows.length})
                          </label>
                          <div className="text-[10px] text-[#777]">{selectedMedia.length} selected</div>
                          {selectedMedia.length > 0 && (
                            <div className="flex flex-wrap gap-2 xl:justify-end">
                              <select value={mediaBulkView} onChange={(event) => setMediaBulkView(event.target.value)} className="h-8 rounded-lg border border-[#d5d5d5] bg-white px-2 text-[10px]">
                                <option value="">Set view…</option>
                                <option value="front">Front</option>
                                <option value="back">Back</option>
                                <option value="side">Side</option>
                                <option value="lifestyle">Lifestyle</option>
                                <option value="detail">Detail</option>
                              </select>
                              <button type="button" disabled={!mediaBulkView} onClick={() => updateMediaAssignments(selectedMedia, { view: mediaBulkView })} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold disabled:opacity-40">
                                Apply view
                              </button>
                              <input value={mediaBulkColor} onChange={(event) => setMediaBulkColor(event.target.value)} list="gdp-product-colors" placeholder="Set color…" className="h-8 w-28 rounded-lg border border-[#d5d5d5] px-2 text-[10px]" />
                              <button type="button" disabled={!mediaBulkColor.trim()} onClick={() => updateMediaAssignments(selectedMedia, { color: mediaBulkColor.trim() })} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold disabled:opacity-40">
                                Apply color
                              </button>
                              <button type="button" onClick={() => generateMediaAltText(selectedMedia)} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold">
                                Generate alt text
                              </button>
                              <button type="button" onClick={clearSelectedMediaAssignments} className="h-8 rounded-lg border border-red-200 text-red-700 px-2.5 text-[10px] font-semibold">
                                Clear assignments
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        {visibleMediaRows.length === 0 ? (
                          <div className="p-6 text-center text-xs text-[#777]">No media matches the current filters.</div>
                        ) : visibleMediaRows.map((row, visibleIndex) => {
                          const meta = form.customization?.media?.[row.image] || {};
                          const groupLabel = mediaFilters.groupBy === "color"
                            ? row.color || "Unassigned color"
                            : mediaFilters.groupBy === "view"
                              ? row.view ? row.view.charAt(0).toUpperCase() + row.view.slice(1) : "Unassigned view"
                              : "";
                          const previous = visibleMediaRows[visibleIndex - 1];
                          const previousGroup = previous
                            ? mediaFilters.groupBy === "color"
                              ? previous.color || "Unassigned color"
                              : mediaFilters.groupBy === "view"
                                ? previous.view ? previous.view.charAt(0).toUpperCase() + previous.view.slice(1) : "Unassigned view"
                                : ""
                            : null;
                          const showGroup = mediaFilters.groupBy !== "none" && groupLabel !== previousGroup;
                          return (
                            <React.Fragment key={`media-meta-${row.image}-${row.index}`}>
                              {showGroup && (
                                <div className="border-t border-[#e9e9e9] bg-[#f7f7f7] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#666]">
                                  {groupLabel} · {visibleMediaRows.filter((item) => (
                                    mediaFilters.groupBy === "color"
                                      ? (item.color || "Unassigned color") === groupLabel
                                      : (item.view ? item.view.charAt(0).toUpperCase() + item.view.slice(1) : "Unassigned view") === groupLabel
                                  )).length} media
                                </div>
                              )}
                              <div className="border-t border-[#eeeeee] p-3 grid md:grid-cols-[28px_54px_.75fr_.9fr_1.3fr_auto] gap-2 items-end">
                                <div className="h-9 flex items-center">
                                  <input type="checkbox" checked={selectedMedia.includes(row.image)} onChange={() => toggleMediaSelection(row.image)} aria-label={`Select media ${row.index + 1}`} />
                                </div>
                                <div className="h-12 w-12 rounded-lg border border-[#e1e1e1] bg-[#fafafa] overflow-hidden grid place-items-center">
                                  <img src={row.image} alt="" className="h-full w-full object-contain" />
                                </div>
                                <TinyField label="View">
                                  <select value={meta.view || ""} onChange={(event) => setMediaMeta(row.image, "view", event.target.value)} className={tinyInputClass}>
                                    <option value="">Unassigned</option>
                                    <option value="front">Front</option>
                                    <option value="back">Back</option>
                                    <option value="side">Side</option>
                                    <option value="lifestyle">Lifestyle</option>
                                    <option value="detail">Detail</option>
                                  </select>
                                </TinyField>
                                <TinyField label="Color">
                                  <input value={meta.color || ""} onChange={(event) => setMediaMeta(row.image, "color", event.target.value)} className={tinyInputClass} placeholder="Black" list="gdp-product-colors" />
                                </TinyField>
                                <TinyField label="Alt text">
                                  <input value={meta.alt || ""} onChange={(event) => setMediaMeta(row.image, "alt", event.target.value)} className={tinyInputClass} placeholder={`${form.name || "Product"} ${meta.view || "image"}`} />
                                </TinyField>
                                <button type="button" disabled={row.index === 0} onClick={() => reorderImage(row.index, 0)} className="h-9 px-2.5 rounded-lg border border-[#d5d5d5] text-[10px] font-semibold disabled:opacity-40">
                                  {row.index === 0 ? "Cover" : "Set cover"}
                                </button>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <datalist id="gdp-product-colors">
                    {splitComma(form.colors).map((color) => <option key={color} value={color} />)}
                  </datalist>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <input
                      value={imageUrlDraft}
                      onChange={(event) => setImageUrlDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addImageUrl();
                        }
                      }}
                      className={inputClass}
                      placeholder="Or paste an image URL"
                    />
                    <button
                      type="button"
                      onClick={addImageUrl}
                      disabled={!imageUrlDraft.trim()}
                      className="h-10 px-4 rounded-lg border border-[#d4d4d4] bg-white text-sm font-medium disabled:opacity-40"
                    >
                      Add URL
                    </button>
                  </div>
                </div>
              </EditorSection>

              <EditorSection title="Classification">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Product category" helper="Controls storefront filtering and garment behavior.">
                    <select value={form.category} onChange={(event) => set("category", event.target.value)} className={inputClass}>
                      <option value="">Choose category</option>
                      {PRODUCT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </Field>
                  <Field label="Product type">
                    <select value={form.type} onChange={(event) => set("type", event.target.value)} className={inputClass}>
                      <option value="">Choose type</option>
                      <option value="Blank Garment">Blank Garment</option>
                      <option value="Customizable Garment">Customizable Garment</option>
                      <option value="Finished Product">Finished Product</option>
                      <option value="DTF Service">DTF Service</option>
                      <option value="Accessory">Accessory</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                </div>
              </EditorSection>

              <EditorSection title="Garment specifications" icon={Package}>
                <div className="text-xs text-[#777]">
                  Structured apparel details are stored with the product and can be reused by storefront filters, product copy and Custom Studio.
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Garment brand">
                    <input value={form.garmentBrand} onChange={(event) => set("garmentBrand", event.target.value)} className={inputClass} placeholder="Gildan" />
                  </Field>
                  <Field label="Model">
                    <input value={form.garmentModel} onChange={(event) => set("garmentModel", event.target.value)} className={inputClass} placeholder="5000" />
                  </Field>
                  <Field label="Material">
                    <input value={form.material} onChange={(event) => set("material", event.target.value)} className={inputClass} placeholder="100% cotton" />
                  </Field>
                  <Field label="Fabric blend">
                    <input value={form.fabricBlend} onChange={(event) => set("fabricBlend", event.target.value)} className={inputClass} placeholder="100% ring-spun cotton" />
                  </Field>
                  <Field label="Fabric weight">
                    <input value={form.fabricWeight} onChange={(event) => set("fabricWeight", event.target.value)} className={inputClass} placeholder="180 gsm / 5.3 oz" />
                  </Field>
                  <Field label="Fit">
                    <select value={form.fit} onChange={(event) => set("fit", event.target.value)} className={inputClass}>
                      <option value="">Not specified</option>
                      <option value="Regular">Regular</option>
                      <option value="Classic">Classic</option>
                      <option value="Relaxed">Relaxed</option>
                      <option value="Oversized">Oversized</option>
                      <option value="Slim">Slim</option>
                    </select>
                  </Field>
                  <Field label="Audience">
                    <select value={form.audience} onChange={(event) => set("audience", event.target.value)} className={inputClass}>
                      <option value="">Not specified</option>
                      <option value="Unisex">Unisex</option>
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                      <option value="Youth">Youth</option>
                      <option value="Toddler">Toddler</option>
                      <option value="Baby">Baby</option>
                    </select>
                  </Field>
                  <Field label="Sleeve type">
                    <select value={form.sleeveType} onChange={(event) => set("sleeveType", event.target.value)} className={inputClass}>
                      <option value="">Not specified</option>
                      <option value="Short Sleeve">Short Sleeve</option>
                      <option value="Long Sleeve">Long Sleeve</option>
                      <option value="Sleeveless">Sleeveless</option>
                    </select>
                  </Field>
                  <Field label="Neck style">
                    <select value={form.neckStyle} onChange={(event) => set("neckStyle", event.target.value)} className={inputClass}>
                      <option value="">Not specified</option>
                      <option value="Crew Neck">Crew Neck</option>
                      <option value="V-Neck">V-Neck</option>
                      <option value="Hooded">Hooded</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>
                </div>
              </EditorSection>

              <EditorSection title="Pricing">
                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Price">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#777]">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.price}
                        onChange={(event) => set("price", event.target.value)}
                        className={`${inputClass} pl-7`}
                        required
                      />
                    </div>
                  </Field>
                  <Field label="Compare-at price">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#777]">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.compareAtPrice}
                        onChange={(event) => set("compareAtPrice", event.target.value)}
                        className={`${inputClass} pl-7`}
                      />
                    </div>
                  </Field>
                  <Field label="Cost per item">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#777]">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.costPerItem}
                        onChange={(event) => set("costPerItem", event.target.value)}
                        className={`${inputClass} pl-7`}
                      />
                    </div>
                  </Field>
                </div>

                <div className="grid sm:grid-cols-3 gap-2 rounded-lg border border-[#e4e4e4] bg-[#fafafa] p-3">
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-[#888]">Profit / item</div>
                    <div className="mt-1 text-sm font-semibold">{money(Math.max(0, Number(form.price || 0) - Number(form.costPerItem || 0)), settings?.currency || "CAD")}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-[#888]">Margin</div>
                    <div className="mt-1 text-sm font-semibold">
                      {Number(form.price || 0) > 0 ? `${Math.max(0, ((Number(form.price || 0) - Number(form.costPerItem || 0)) / Number(form.price || 0)) * 100).toFixed(1)}%` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-[#888]">Variant pricing</div>
                    <div className="mt-1 text-xs text-[#555]">Blank variant price = base price</div>
                  </div>
                </div>

                <Toggle
                  checked={form.taxable}
                  onChange={(value) => set("taxable", value)}
                  label="Charge tax on this product"
                />

                <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <div className="text-xs font-semibold text-[#555] mb-2">Unit price (optional)</div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <TinyField label="Price per unit">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.unitPriceAmount}
                        onChange={(event) => set("unitPriceAmount", event.target.value)}
                        className={tinyInputClass}
                        placeholder="0.00"
                      />
                    </TinyField>
                    <TinyField label="Reference measure">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.unitPriceMeasure}
                        onChange={(event) => set("unitPriceMeasure", event.target.value)}
                        className={tinyInputClass}
                        placeholder="1"
                      />
                    </TinyField>
                    <TinyField label="Unit">
                      <select
                        value={form.unitPriceUnit}
                        onChange={(event) => set("unitPriceUnit", event.target.value)}
                        className={tinyInputClass}
                      >
                        <option value="each">Each</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="oz">oz</option>
                        <option value="lb">lb</option>
                        <option value="m">m</option>
                        <option value="cm">cm</option>
                      </select>
                    </TinyField>
                  </div>
                </div>
              </EditorSection>

              <EditorSection title="Inventory" icon={Boxes}>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e3e3e3] bg-[#fafafa] px-3 py-2.5">
                  <div>
                    <div className="text-sm font-medium">Inventory tracked</div>
                    <div className="text-[11px] text-[#777]">Track available quantity for this product.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.trackInventory}
                    onChange={(event) => set("trackInventory", event.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <Field label="Shop quantity">
                    <input
                      type="number"
                      min="0"
                      value={primaryVariant.stock ?? 0}
                      onChange={(event) => updatePrimaryVariant("stock", event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="SKU">
                    <input
                      value={primaryVariant.sku || ""}
                      onChange={(event) => updatePrimaryVariant("sku", event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Barcode">
                    <input
                      value={primaryVariant.barcode || form.barcode}
                      onChange={(event) => {
                        updatePrimaryVariant("barcode", event.target.value);
                        set("barcode", event.target.value);
                      }}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Toggle
                  checked={form.sellWhenOutOfStock}
                  onChange={(value) => set("sellWhenOutOfStock", value)}
                  label="Continue selling when out of stock"
                />
                <div className="text-[10px] text-[#777]">
                  Global low-stock warning: {Number(settings?.low_stock_threshold ?? 5)} units or fewer. Change the global threshold in store settings.
                </div>
              </EditorSection>

              <EditorSection title="Shipping" icon={Package}>
                <Toggle
                  checked={form.requiresShipping}
                  onChange={(value) => set("requiresShipping", value)}
                  label="This is a physical product"
                />

                {form.requiresShipping && (
                  <>
                    <div className="grid sm:grid-cols-[1.4fr_.6fr] gap-3">
                      <Field label="Package">
                        <input
                          value={form.packageName}
                          onChange={(event) => set("packageName", event.target.value)}
                          className={inputClass}
                          placeholder="Standard apparel parcel"
                        />
                      </Field>
                      <Field label="Product weight">
                        <div className="grid grid-cols-[1fr_78px] gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={form.weight}
                            onChange={(event) => set("weight", event.target.value)}
                            className={inputClass}
                          />
                          <select
                            value={form.weightUnit}
                            onChange={(event) => set("weightUnit", event.target.value)}
                            className={inputClass}
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="oz">oz</option>
                            <option value="lb">lb</option>
                          </select>
                        </div>
                      </Field>
                    </div>

                    <div className="grid sm:grid-cols-4 gap-2">
                      <TinyField label="Length">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.packageLength}
                          onChange={(event) => set("packageLength", event.target.value)}
                          className={tinyInputClass}
                        />
                      </TinyField>
                      <TinyField label="Width">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.packageWidth}
                          onChange={(event) => set("packageWidth", event.target.value)}
                          className={tinyInputClass}
                        />
                      </TinyField>
                      <TinyField label="Height">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.packageHeight}
                          onChange={(event) => set("packageHeight", event.target.value)}
                          className={tinyInputClass}
                        />
                      </TinyField>
                      <TinyField label="Dimension unit">
                        <select
                          value={form.packageUnit}
                          onChange={(event) => set("packageUnit", event.target.value)}
                          className={tinyInputClass}
                        >
                          <option value="cm">cm</option>
                          <option value="in">in</option>
                        </select>
                      </TinyField>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Country of origin">
                        <input
                          value={form.countryOfOrigin}
                          onChange={(event) => set("countryOfOrigin", event.target.value)}
                          className={inputClass}
                          placeholder="Canada"
                        />
                      </Field>
                      <Field label="HS code">
                        <input
                          value={form.hsCode}
                          onChange={(event) => set("hsCode", event.target.value)}
                          className={inputClass}
                          placeholder="6109.10"
                        />
                      </Field>
                    </div>
                  </>
                )}
              </EditorSection>

              <EditorSection title="Variants" icon={Boxes}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Size options" helper="Comma separated">
                    <input
                      value={form.sizes}
                      onChange={(event) => set("sizes", event.target.value)}
                      className={inputClass}
                      placeholder="S, M, L, XL, 2XL"
                    />
                  </Field>
                  <Field label="Color options" helper="Comma separated">
                    <input
                      value={form.colors}
                      onChange={(event) => set("colors", event.target.value)}
                      className={inputClass}
                      placeholder="Black, White, Vintage Wash"
                    />
                  </Field>
                </div>

                <div className="rounded-lg border border-[#e3e3e3] bg-[#fafafa] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#777]">Quick sizes</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {APPAREL_SIZE_PRESETS.map((size) => {
                      const selected = splitComma(form.sizes).some((item) => item.toLowerCase() === size.toLowerCase());
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => toggleSizePreset(size)}
                          className={`h-8 min-w-10 rounded-lg border px-2 text-xs font-semibold ${selected ? "border-[#222] bg-[#222] text-white" : "border-[#d5d5d5] bg-white"}`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-[#dedede] rounded-xl overflow-hidden">
                  <div className="px-3 py-3 bg-[#fafafa] border-b border-[#e8e8e8]">
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Variant inventory</div>
                        <div className="text-[10px] text-[#777]">Filter, group and bulk-edit SKU, barcode, stock and optional price overrides without losing unsaved changes.</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, stock: "all" }))} className="rounded-full border border-[#ddd] bg-white px-2.5 py-1">
                          {variantSummary.total} variants
                        </button>
                        <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, stock: "in" }))} className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 px-2.5 py-1">
                          {variantSummary.inStock} in stock
                        </button>
                        <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, stock: "low" }))} className="rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-2.5 py-1">
                          {variantSummary.low} low
                        </button>
                        <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, stock: "out" }))} className="rounded-full border border-red-200 bg-red-50 text-red-700 px-2.5 py-1">
                          {variantSummary.out} out
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-[1.45fr_.8fr_.7fr_.8fr_.85fr_.85fr_.95fr_auto] gap-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]" />
                        <input value={variantFilters.search} onChange={(event) => setVariantFilters((current) => ({ ...current, search: event.target.value }))} className={`${tinyInputClass} pl-8`} placeholder="Search SKU, barcode, color or size" />
                      </div>
                      <select value={variantFilters.color} onChange={(event) => setVariantFilters((current) => ({ ...current, color: event.target.value }))} className={tinyInputClass}>
                        <option value="all">All colors</option>
                        {variantColors.map((color) => <option key={color} value={color}>{color}</option>)}
                      </select>
                      <select value={variantFilters.size} onChange={(event) => setVariantFilters((current) => ({ ...current, size: event.target.value }))} className={tinyInputClass}>
                        <option value="all">All sizes</option>
                        {variantSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                      <select value={variantFilters.stock} onChange={(event) => setVariantFilters((current) => ({ ...current, stock: event.target.value }))} className={tinyInputClass}>
                        <option value="all">All stock</option>
                        <option value="in">In stock</option>
                        <option value="low">Low stock</option>
                        <option value="out">Out of stock</option>
                      </select>
                      <select value={variantFilters.pricing} onChange={(event) => setVariantFilters((current) => ({ ...current, pricing: event.target.value }))} className={tinyInputClass}>
                        <option value="all">All pricing</option>
                        <option value="base">Base price</option>
                        <option value="override">Price override</option>
                        <option value="missing">Missing price</option>
                      </select>
                      <select value={variantFilters.groupBy} onChange={(event) => setVariantFilters((current) => ({ ...current, groupBy: event.target.value }))} className={tinyInputClass}>
                        <option value="color">Group: Color</option>
                        <option value="size">Group: Size</option>
                        <option value="none">No grouping</option>
                      </select>
                      <select value={variantFilters.sortBy} onChange={(event) => setVariantFilters((current) => ({ ...current, sortBy: event.target.value }))} className={tinyInputClass}>
                        <option value="color_size">Color → Size</option>
                        <option value="size_color">Size → Color</option>
                        <option value="sku">SKU</option>
                        <option value="stock_asc">Stock low → high</option>
                        <option value="stock_desc">Stock high → low</option>
                        <option value="price_asc">Price low → high</option>
                        <option value="price_desc">Price high → low</option>
                      </select>
                      <button type="button" onClick={clearVariantFilters} className="h-9 rounded-lg border border-[#d5d5d5] bg-white px-3 text-[10px] font-semibold">Clear</button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {variantFilters.search && <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, search: "" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">Search: {variantFilters.search} ×</button>}
                      {variantFilters.color !== "all" && <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, color: "all" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">Color: {variantFilters.color} ×</button>}
                      {variantFilters.size !== "all" && <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, size: "all" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">Size: {variantFilters.size} ×</button>}
                      {variantFilters.stock !== "all" && <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, stock: "all" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">Stock: {variantFilters.stock} ×</button>}
                      {variantFilters.pricing !== "all" && <button type="button" onClick={() => setVariantFilters((current) => ({ ...current, pricing: "all" }))} className="rounded-full bg-[#ededed] px-2.5 py-1 text-[9px]">Pricing: {variantFilters.pricing} ×</button>}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#e2e2e2] bg-white p-2.5">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                        <label className="flex items-center gap-2 text-[10px] font-semibold">
                          <input
                            type="checkbox"
                            checked={allVisibleVariantsSelected}
                            onChange={(event) => {
                              const visibleKeys = visibleVariantRows.map((row) => row.key);
                              setSelectedVariantKeys((current) => event.target.checked
                                ? Array.from(new Set([...current, ...visibleKeys]))
                                : current.filter((key) => !visibleKeys.includes(key))
                              );
                            }}
                          />
                          Select visible ({visibleVariantRows.length})
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-[#777]">{selectedVariantKeys.length} selected</span>
                          <button type="button" onClick={generateVariantMatrix} className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] bg-white text-[10px] font-semibold">Generate matrix</button>
                          <button type="button" onClick={() => autoFillSkus(false)} className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] bg-white text-[10px] font-semibold">Auto-fill all SKUs</button>
                          <button type="button" onClick={addVariant} className="h-8 px-2.5 rounded-lg border border-[#d5d5d5] bg-white text-[10px] font-semibold inline-flex items-center gap-1"><Plus size={12} /> Add variant</button>
                        </div>
                      </div>

                      {selectedVariantKeys.length > 0 && (
                        <div className="border-t border-[#eeeeee] pt-2 flex flex-wrap items-center gap-2">
                          <input type="number" min="0" value={variantBulkStock} onChange={(event) => setVariantBulkStock(event.target.value)} placeholder="Stock" className="h-8 w-20 rounded-lg border border-[#d5d5d5] px-2 text-[10px]" />
                          <button type="button" disabled={variantBulkStock === ""} onClick={() => updateSelectedVariants((variant) => ({ ...variant, stock: Math.max(0, Number(variantBulkStock || 0)) }))} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold disabled:opacity-40">Set stock</button>
                          <input type="number" value={variantBulkAdjustment} onChange={(event) => setVariantBulkAdjustment(event.target.value)} placeholder="+/- stock" className="h-8 w-24 rounded-lg border border-[#d5d5d5] px-2 text-[10px]" />
                          <button type="button" disabled={variantBulkAdjustment === ""} onClick={() => updateSelectedVariants((variant) => ({ ...variant, stock: Math.max(0, Number(variant.stock || 0) + Number(variantBulkAdjustment || 0)) }))} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold disabled:opacity-40">Adjust stock</button>
                          <input type="number" min="0" step="0.01" value={variantBulkPrice} onChange={(event) => setVariantBulkPrice(event.target.value)} placeholder="Price" className="h-8 w-20 rounded-lg border border-[#d5d5d5] px-2 text-[10px]" />
                          <button type="button" disabled={variantBulkPrice === ""} onClick={() => updateSelectedVariants((variant) => ({ ...variant, price: Number(variantBulkPrice || 0) }))} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold disabled:opacity-40">Set price</button>
                          <button type="button" onClick={() => updateSelectedVariants((variant) => ({ ...variant, price: null }))} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold">Use base price</button>
                          <button type="button" disabled={variantBulkPrice === ""} onClick={() => updateSelectedVariants((variant) => ({ ...variant, price: Math.max(0, Number(form.price || 0) + Number(variantBulkPrice || 0)) }))} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold disabled:opacity-40">Base + adjustment</button>
                          <button type="button" onClick={() => autoFillSkus(true)} className="h-8 rounded-lg border border-[#d5d5d5] px-2.5 text-[10px] font-semibold">Fill selected SKUs</button>
                          <button type="button" onClick={retireSelectedVariants} className="h-8 rounded-lg border border-red-200 text-red-700 px-2.5 text-[10px] font-semibold">Retire selected</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {visibleVariantRows.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#777]">No variants match the current filters.</div>
                    ) : visibleVariantRows.map((row, visibleIndex) => {
                      const variant = row.variant;
                      const groupLabel = variantFilters.groupBy === "color"
                        ? row.color || "Unassigned color"
                        : variantFilters.groupBy === "size"
                          ? row.size || "Unassigned size"
                          : "";
                      const previous = visibleVariantRows[visibleIndex - 1];
                      const previousGroup = previous
                        ? variantFilters.groupBy === "color"
                          ? previous.color || "Unassigned color"
                          : variantFilters.groupBy === "size"
                            ? previous.size || "Unassigned size"
                            : ""
                        : null;
                      const showGroup = variantFilters.groupBy !== "none" && groupLabel !== previousGroup;
                      return (
                        <React.Fragment key={row.key}>
                          {showGroup && (
                            <div className="border-t border-[#e9e9e9] bg-[#f7f7f7] px-3 py-2 flex items-center justify-between gap-2">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-[#666]">
                                {groupLabel} · {visibleVariantRows.filter((item) => (
                                  variantFilters.groupBy === "color"
                                    ? (item.color || "Unassigned color") === groupLabel
                                    : (item.size || "Unassigned size") === groupLabel
                                )).length} variants
                              </div>
                              {variantFilters.groupBy === "color" && row.color && (
                                <div className="text-[9px] text-[#888]">Grouped for faster color-by-color editing</div>
                              )}
                            </div>
                          )}
                          <div className="border-t border-[#eeeeee] p-3 bg-white">
                            <div className="grid md:grid-cols-2 xl:grid-cols-[28px_1.1fr_.9fr_.9fr_.75fr_.75fr_.65fr_.75fr_auto] gap-2 items-end">
                              <div className="h-9 flex items-center">
                                <input type="checkbox" checked={selectedVariantKeys.includes(row.key)} onChange={() => toggleVariantSelection(variant, row.index)} aria-label={`Select ${variant.name || "variant"}`} />
                              </div>
                              <TinyField label="Name">
                                <input value={variant.name || ""} onChange={(event) => updateVariant(row.index, "name", event.target.value)} className={tinyInputClass} />
                              </TinyField>
                              <TinyField label="SKU">
                                <input value={variant.sku || ""} onChange={(event) => updateVariant(row.index, "sku", event.target.value)} className={tinyInputClass} />
                              </TinyField>
                              <TinyField label="Barcode">
                                <input value={variant.barcode || ""} onChange={(event) => updateVariant(row.index, "barcode", event.target.value)} className={tinyInputClass} />
                              </TinyField>
                              <TinyField label="Color">
                                <input value={variant.color || ""} onChange={(event) => updateVariant(row.index, "color", event.target.value)} className={tinyInputClass} />
                              </TinyField>
                              <TinyField label="Size">
                                <input value={variant.size || ""} onChange={(event) => updateVariant(row.index, "size", event.target.value)} className={tinyInputClass} />
                              </TinyField>
                              <TinyField label="Stock">
                                <div>
                                  <input type="number" min="0" value={variant.stock ?? 0} onChange={(event) => updateVariant(row.index, "stock", event.target.value)} className={tinyInputClass} />
                                  <div className={`mt-1 text-[8px] font-semibold uppercase ${row.stockStatus === "out" ? "text-red-600" : row.stockStatus === "low" ? "text-amber-700" : "text-emerald-700"}`}>
                                    {row.stockStatus === "out" ? "Out" : row.stockStatus === "low" ? "Low" : "In stock"}
                                  </div>
                                </div>
                              </TinyField>
                              <TinyField label="Price">
                                <div>
                                  <input type="number" min="0" step="0.01" value={variant.price ?? ""} onChange={(event) => updateVariant(row.index, "price", event.target.value)} className={tinyInputClass} placeholder={`Base ${money(form.price, settings?.currency || "CAD")}`} />
                                  <div className="mt-1 text-[8px] uppercase text-[#888]">{row.priceOverride ? "Override" : "Base price"}</div>
                                </div>
                              </TinyField>
                              <button type="button" onClick={() => removeVariant(row.index)} disabled={variants.length === 1} className="h-9 w-9 rounded-lg border border-[#ddd] grid place-items-center hover:bg-red-50 hover:text-red-600 disabled:opacity-35" aria-label="Remove variant">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </EditorSection>

              <EditorSection title="Fulfillment">
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Fulfillment mode">
                    <select
                      value={form.fulfillmentMode}
                      onChange={(event) => set("fulfillmentMode", event.target.value)}
                      className={inputClass}
                    >
                      <option value="in_house">In house</option>
                      <option value="pod">Print on demand</option>
                      <option value="dropship">Dropship</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="manual">Manual</option>
                    </select>
                  </Field>
                  {["pod", "hybrid"].includes(form.fulfillmentMode) && (
                    <Field label="POD provider">
                      <input
                        value={form.podProvider}
                        onChange={(event) => set("podProvider", event.target.value)}
                        className={inputClass}
                        placeholder="Printful, Printify…"
                      />
                    </Field>
                  )}
                </div>
              </EditorSection>

              {form.customDesignable && (
                <EditorSection title="Custom Studio integration" icon={Sparkles}>
                  <div className="text-[11px] leading-5 text-[#777]">
                    Use the generated garment silhouette, or select an uploaded product image as the front/back mockup. Print-area values are percentages of the mockup canvas.
                  </div>
                   <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] leading-5 text-blue-800">
                    Global Custom Studio behavior, print-side visibility and print-side pricing are managed from <strong>Admin → Custom Studio → Settings</strong>. This product section only controls garment-specific preview media and print-area mapping.
                  </div>
                   <Field label="Front mockup" helper="Optional">
                    <select
                      value={form.customization?.preview?.frontMockupUrl || ""}
                      onChange={(event) => setPreviewConfig("frontMockupUrl", event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Generated garment silhouette</option>
                      {(form.images || []).map((url, index) => (
                        <option key={"front-" + url} value={url}>Product media {index + 1}</option>
                      ))}
                    </select>
                  </Field>
                   <Field label="Back mockup" helper="Optional">
                    <select
                      value={form.customization?.preview?.backMockupUrl || ""}
                      onChange={(event) => setPreviewConfig("backMockupUrl", event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Generated garment silhouette</option>
                      {(form.images || []).map((url, index) => (
                        <option key={"back-" + url} value={url}>Product media {index + 1}</option>
                      ))}
                    </select>
                  </Field>
                   {customStudioColors.length > 0 && (
                    <div className="rounded-lg border border-[#e2e2e2] bg-white overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-[#eeeeee] bg-[#fafafa]">
                        <div className="text-xs font-semibold">Color-specific preview media</div>
                        <div className="text-[10px] text-[#777] mt-0.5">Optional. A color can override the general front/back mockup and swatch shown in Custom Studio.</div>
                      </div>
                      <div className="divide-y divide-[#eeeeee]">
                        {customStudioColors.map((studioColor) => {
                          const colorPreview = form.customization?.preview?.colorMockups?.[studioColor] || {};
                          const swatch = form.customization?.preview?.colorSwatches?.[studioColor] || "#888888";
                          return (
                            <div key={studioColor} className="p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="color"
                                  value={/^#[0-9a-f]{6}$/i.test(swatch) ? swatch : "#888888"}
                                  onChange={(event) => setColorSwatch(studioColor, event.target.value)}
                                  className="h-8 w-10 rounded border border-[#d5d5d5] bg-white p-1"
                                  aria-label={studioColor + " swatch"}
                                />
                                <div className="text-xs font-semibold">{studioColor}</div>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-2">
                                <select
                                  value={colorPreview.frontUrl || ""}
                                  onChange={(event) => setColorPreviewValue(studioColor, "frontUrl", event.target.value)}
                                  className={inputClass}
                                >
                                  <option value="">Use general front mockup</option>
                                  {(form.images || []).map((url, index) => (
                                    <option key={studioColor + "-front-" + url} value={url}>Product media {index + 1}</option>
                                  ))}
                                </select>
                                <select
                                  value={colorPreview.backUrl || ""}
                                  onChange={(event) => setColorPreviewValue(studioColor, "backUrl", event.target.value)}
                                  className={inputClass}
                                >
                                  <option value="">Use general back mockup</option>
                                  {(form.images || []).map((url, index) => (
                                    <option key={studioColor + "-back-" + url} value={url}>Product media {index + 1}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                   <div className="rounded-lg border border-[#e2e2e2] bg-[#fafafa] p-3">
                    <div className="text-xs font-semibold">Front printable area</div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Field label="Top %">
                        <input type="number" min="5" max="80" step="1" value={form.customization?.preview?.printArea?.front?.top ?? 29} onChange={(event) => setPrintAreaValue("front", "top", event.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Width %">
                        <input type="number" min="10" max="80" step="1" value={form.customization?.preview?.printArea?.front?.width ?? 36} onChange={(event) => setPrintAreaValue("front", "width", event.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Height %">
                        <input type="number" min="10" max="80" step="1" value={form.customization?.preview?.printArea?.front?.height ?? 38} onChange={(event) => setPrintAreaValue("front", "height", event.target.value)} className={inputClass} />
                      </Field>
                    </div>
                  </div>
                   <div className="rounded-lg border border-[#e2e2e2] bg-[#fafafa] p-3">
                    <div className="text-xs font-semibold">Back printable area</div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Field label="Top %">
                        <input type="number" min="5" max="80" step="1" value={form.customization?.preview?.printArea?.back?.top ?? 29} onChange={(event) => setPrintAreaValue("back", "top", event.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Width %">
                        <input type="number" min="10" max="80" step="1" value={form.customization?.preview?.printArea?.back?.width ?? 36} onChange={(event) => setPrintAreaValue("back", "width", event.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Height %">
                        <input type="number" min="10" max="80" step="1" value={form.customization?.preview?.printArea?.back?.height ?? 38} onChange={(event) => setPrintAreaValue("back", "height", event.target.value)} className={inputClass} />
                      </Field>
                    </div>
                  </div>
                   <div className="text-[10px] leading-4 text-[#888]">
                    Tip: keep the guide inside the real printable chest/back area. Customers can move and scale artwork within this zone, while the original uploaded files remain preserved for production.
                  </div>
                </EditorSection>
              )}



              <EditorSection title="Advanced metafields">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-[#777]">
                    Store extra product information such as fit, blank brand, print method or care notes.
                  </div>
                  <button
                    type="button"
                    onClick={addMetafield}
                    className="h-8 px-3 rounded-lg border border-[#d5d5d5] text-xs font-medium shrink-0"
                  >
                    Add definition
                  </button>
                </div>
                {metafields.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#ddd] bg-[#fafafa] p-4 text-sm text-[#777]">
                    No metafields yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {metafields.map((row, index) => (
                      <div key={index} className="grid sm:grid-cols-[.8fr_1.4fr_auto] gap-2 items-end">
                        <TinyField label="Key">
                          <input
                            value={row.key}
                            onChange={(event) => updateMetafield(index, "key", event.target.value)}
                            className={tinyInputClass}
                            placeholder="print_method"
                          />
                        </TinyField>
                        <TinyField label="Value">
                          <input
                            value={row.value}
                            onChange={(event) => updateMetafield(index, "value", event.target.value)}
                            className={tinyInputClass}
                            placeholder="DTF"
                          />
                        </TinyField>
                        <button
                          type="button"
                          onClick={() => removeMetafield(index)}
                          className="h-9 w-9 rounded-lg border border-[#ddd] grid place-items-center hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove metafield"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </EditorSection>

              <EditorSection title="Search engine listing">
                <div className="rounded-lg border border-[#e4e4e4] bg-[#fafafa] p-3">
                  <div className="text-xs text-[#777]">Search preview</div>
                  <div className="text-sm font-semibold mt-1 text-[#1f4d8f]">
                    {form.seoTitle || form.name || "Product page title"}
                  </div>
                  <div className="text-[11px] text-[#2e7d32] mt-0.5">
                    /products/{slugify(form.slug || form.name) || "product-handle"}
                  </div>
                  <div className="text-xs text-[#555] mt-1 line-clamp-2">
                    {form.seoDescription || form.description || "Add a description to control how this product appears in search."}
                  </div>
                </div>

                <Field label="URL handle">
                  <input value={form.slug} onChange={(event) => set("slug", slugify(event.target.value))} className={inputClass} />
                </Field>
                <Field label="Page title">
                  <input value={form.seoTitle} onChange={(event) => set("seoTitle", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Meta description">
                  <textarea
                    value={form.seoDescription}
                    onChange={(event) => set("seoDescription", event.target.value)}
                    className={textareaClass}
                    rows={3}
                  />
                </Field>
              </EditorSection>
            </div>

            <div className="space-y-4 lg:sticky lg:top-[84px]">
              <SideCard title="Status">
                <select
                  value={form.status}
                  onChange={(event) => set("status", event.target.value)}
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
                <div className="text-[11px] text-[#777]">
                  Active products can appear on the storefront. Draft and archived products stay hidden from normal catalog views.
                </div>
              </SideCard>

              <SideCard title="Publishing">
                <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                  <div className="text-sm font-medium">Online store</div>
                  <div className="text-[11px] text-[#777] mt-0.5">
                    Published when the product status is Active.
                  </div>
                </div>
                {form.customDesignable && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                    <div className="text-sm font-medium text-violet-800">GDP Custom Studio</div>
                    <div className="text-[11px] text-violet-700 mt-0.5">
                      This product is available as a customizable garment.
                    </div>
                  </div>
                )}
              </SideCard>

              <SideCard title="Product organization">
                <Field label="Vendor">
                  <input value={form.vendor} onChange={(event) => set("vendor", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Collections">
                  {collections.length ? (
                    <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-[#dedede] p-2">
                      {collections.map((collection) => (
                        <label key={collection.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-[#f7f7f7]">
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
                    <div className="text-xs text-[#777] rounded-lg border border-[#dedede] p-3">
                      No active collections yet.
                    </div>
                  )}
                </Field>
                <Field label="Tags" helper="Comma separated">
                  <input
                    value={form.tags}
                    onChange={(event) => set("tags", event.target.value)}
                    className={inputClass}
                    placeholder="vintage, graphic, memorial"
                  />
                </Field>
              </SideCard>

              <SideCard title="Merchandising">
                <Toggle checked={form.featured} onChange={(value) => set("featured", value)} label="Featured" />
                <Toggle checked={form.bestSeller} onChange={(value) => set("bestSeller", value)} label="Best seller" />
                <Toggle checked={form.newArrival} onChange={(value) => set("newArrival", value)} label="New arrival" />
                <Toggle
                  checked={form.customDesignable}
                  onChange={(value) => set("customDesignable", value)}
                  label="Custom Studio enabled"
                />
                {form.customDesignable && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-800 flex gap-2">
                    <Sparkles size={15} className="shrink-0 mt-0.5" />
                    Live preview settings are editable below.
                  </div>
                )}
              </SideCard>

              <SideCard title="Theme template">
                <select
                  value={form.themeTemplate}
                  onChange={(event) => set("themeTemplate", event.target.value)}
                  className={inputClass}
                >
                  <option value="default">Default product</option>
                  <option value="custom-studio">Custom Studio product</option>
                  <option value="limited-drop">Limited drop</option>
                  <option value="essentials">Essentials</option>
                </select>
              </SideCard>
            </div>
          </div>

          <div className="mt-5 pb-20 lg:pb-0 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg border border-[#d5d5d5] bg-white text-sm"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="h-10 px-5 rounded-lg bg-[#222] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40"
            >
              <Save size={14} /> {saving ? "Saving…" : "Save product"}
            </button>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#d8d8d8] bg-white/95 backdrop-blur px-4 py-3 lg:hidden">
          <div className="mx-auto flex max-w-[1240px] items-center gap-2">
            <button type="button" onClick={onClose} className="h-10 flex-1 rounded-lg border border-[#d5d5d5] text-sm font-medium">
              Discard
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="h-10 flex-[1.35] rounded-lg bg-[#222] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Save size={14} /> {saving ? "Saving…" : saveState === "saved" ? "Saved" : "Save product"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function SideCard({ title, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#eaeaea]">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
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
