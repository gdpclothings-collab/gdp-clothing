import React, { useEffect, useMemo, useState } from "react";
import {
  FileEdit,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  X,
  Save,
  Trash2,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { adminDraftOrdersApi } from "@/lib/adminDraftOrdersApi";

function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DraftOrdersModule() {
  const [drafts, setDrafts] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [draftRows, catalogRows] = await Promise.all([
        adminDraftOrdersApi.list(),
        adminDraftOrdersApi.catalog(),
      ]);
      setDrafts(draftRows);
      setCatalog(catalogRows);
    } catch (err) {
      console.error("Draft orders load failed:", err);
      setError(err?.message || "Could not load draft orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drafts;
    return drafts.filter((draft) =>
      [
        draft.order_number,
        draft.customer_name,
        draft.customer_email,
        draft.customer_phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [drafts, search]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const convert = async (draft) => {
    if (
      !window.confirm(
        `Move ${draft.order_number} from draft to pending payment? This does not charge the customer.`
      )
    ) {
      return;
    }

    try {
      await adminDraftOrdersApi.convertToPendingPayment(draft.id);
      showNotice(`${draft.order_number} moved to pending payment.`);
      await load();
    } catch (err) {
      console.error("Draft conversion failed:", err);
      window.alert(err?.message || "Could not convert draft order.");
    }
  };

  const remove = async (draft) => {
    if (
      !window.confirm(
        `Delete draft ${draft.order_number}? This only deletes an order while it is still a draft.`
      )
    ) {
      return;
    }

    try {
      await adminDraftOrdersApi.deleteDraft(draft.id);
      showNotice("Draft order deleted.");
      await load();
    } catch (err) {
      console.error("Draft delete failed:", err);
      window.alert(err?.message || "Could not delete draft.");
    }
  };

  const totalValue = drafts.reduce(
    (sum, draft) => sum + Number(draft.total || 0),
    0
  );

  return (
    <div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pb-12">
      {notice && (
        <div className="fixed z-[80] right-4 top-20 rounded-lg bg-[#202020] text-white px-4 py-3 shadow-xl text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Metric label="Draft orders" value={drafts.length} icon={FileEdit} />
        <Metric label="Draft value" value={money(totalValue)} icon={ShoppingBag} />
        <Metric
          label="With customer email"
          value={drafts.filter((draft) => draft.customer_email).length}
          icon={CheckCircle2}
        />
      </div>

      <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm font-semibold text-blue-950">
          Draft orders do not reserve inventory or charge customers.
        </div>
        <div className="text-xs text-blue-800 mt-1 leading-5">
          Use them for phone orders, quotes and manual order preparation. Moving a
          draft to pending payment makes it an active order but still does not
          execute a payment.
        </div>
      </div>

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search draft number or customer"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>
          <button
            onClick={load}
            className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setEditor({ draft: null })}
            className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Plus size={14} /> Create draft
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
                <Th>Draft</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th right>Total</Th>
                <Th>Priority</Th>
                <Th>Updated</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-14 text-center text-[#777]">
                    Loading draft orders…
                  </td>
                </tr>
              ) : visible.length ? (
                visible.map((draft) => (
                  <tr
                    key={draft.id}
                    className="border-t border-[#eeeeee] hover:bg-[#fafafa]"
                  >
                    <Td>
                      <button
                        onClick={() => setEditor({ draft })}
                        className="text-left"
                      >
                        <div className="font-semibold">{draft.order_number}</div>
                        <div className="text-[11px] text-[#777]">
                          Created {formatDate(draft.created_at)}
                        </div>
                      </button>
                    </Td>
                    <Td>
                      <div>{draft.customer_name || "Customer"}</div>
                      <div className="text-[11px] text-[#777]">
                        {draft.customer_email}
                      </div>
                    </Td>
                    <Td>
                      {(draft.order_items || []).reduce(
                        (sum, item) => sum + Number(item.quantity || 0),
                        0
                      )}
                    </Td>
                    <Td right>
                      <span className="font-semibold">{money(draft.total)}</span>
                    </Td>
                    <Td>
                      <span className="capitalize">
                        {String(draft.priority || "standard").replaceAll("_", " ")}
                      </span>
                    </Td>
                    <Td>{formatDate(draft.updated_at)}</Td>
                    <Td right>
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setEditor({ draft })}
                          className={secondaryButton}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => convert(draft)}
                          className="h-8 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          Activate <ArrowRight size={12} />
                        </button>
                        <button
                          onClick={() => remove(draft)}
                          className="h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-700 grid place-items-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-14 text-center text-[#777]">
                    No draft orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editor && (
        <DraftEditor
          draft={editor.draft}
          catalog={catalog}
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

function DraftEditor({ draft, catalog, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [form, setForm] = useState({
    customerEmail: draft?.customer_email || "",
    customerName: draft?.customer_name || "",
    customerPhone: draft?.customer_phone || "",
    discount: draft?.discount || 0,
    shipping: draft?.shipping || 0,
    tax: draft?.tax || 0,
    shippingMethod: draft?.shipping_method || "standard",
    notes: draft?.notes || "",
    needByDate: draft?.need_by_date || "",
    priority: draft?.priority || "standard",
    shippingAddress: {
      address: draft?.shipping_address?.address || "",
      city: draft?.shipping_address?.city || "",
      province: draft?.shipping_address?.province || "Saskatchewan",
      postalCode: draft?.shipping_address?.postalCode || "",
      country: draft?.shipping_address?.country || "Canada",
    },
    items: (draft?.order_items || []).map((item) => ({
      productId: item.product_id,
      variantId: item.variant_id,
      name: item.name,
      image: item.image,
      variant: item.variant,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price || 0),
      fulfillmentMode: item.fulfillment_mode || "in_house",
    })),
  });

  const visibleCatalog = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return catalog.slice(0, 80);
    return catalog
      .filter((product) =>
        [product.name, ...(product.product_variants || []).map((v) => v.sku)]
          .join(" ")
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 80);
  }, [catalog, productSearch]);

  const subtotal = form.items.reduce(
    (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
    0
  );
  const total = Math.max(
    0,
    subtotal -
      Number(form.discount || 0) +
      Number(form.shipping || 0) +
      Number(form.tax || 0)
  );

  const addVariant = (product, variant) => {
    const variantPrice =
      variant?.price == null ? Number(product.price || 0) : Number(variant.price);
    const existingIndex = form.items.findIndex(
      (item) =>
        item.productId === product.id &&
        (item.variantId || null) === (variant?.id || null)
    );

    if (existingIndex >= 0) {
      setForm((current) => ({
        ...current,
        items: current.items.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: Number(item.quantity || 0) + 1 }
            : item
        ),
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          productId: product.id,
          variantId: variant?.id || null,
          name: product.name,
          image: product.images?.[0] || null,
          variant: variant?.name || "Default",
          size: variant?.size || "",
          color: variant?.color || "",
          quantity: 1,
          unitPrice: variantPrice,
          fulfillmentMode: product.fulfillment_mode || "in_house",
        },
      ],
    }));
  };

  const updateItem = (index, patch) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));

  const removeItem = (index) =>
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));

  const save = async () => {
    setSaving(true);
    try {
      await adminDraftOrdersApi.saveDraft(draft?.id || null, form);
      await onSaved(draft?.id ? "Draft order updated." : "Draft order created.");
    } catch (err) {
      console.error("Draft order save failed:", err);
      window.alert(err?.message || "Could not save draft order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Close draft order"
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-[900px] bg-[#f6f6f6] shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-20 h-16 px-5 border-b border-[#dedede] bg-white flex items-center justify-between gap-4">
          <div>
            <div className="font-semibold">
              {draft ? "Edit draft order" : "Create draft order"}
            </div>
            <div className="text-xs text-[#777]">
              {draft?.order_number || "Manual GDP order preparation"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#f2f2f2]">
              <X size={18} />
            </button>
            <button
              onClick={save}
              disabled={saving || !form.customerEmail || !form.items.length}
              className="h-9 px-3 rounded-lg bg-[#222] text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-40"
            >
              <Save size={14} /> {saving ? "Saving…" : "Save draft"}
            </button>
          </div>
        </div>

        <div className="p-5 grid xl:grid-cols-[1fr_330px] gap-5">
          <div className="space-y-4">
            <Section title="Customer">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Email">
                  <input
                    type="email"
                    value={form.customerEmail}
                    onChange={(event) =>
                      setForm({ ...form, customerEmail: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Name">
                  <input
                    value={form.customerName}
                    onChange={(event) =>
                      setForm({ ...form, customerName: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={form.customerPhone}
                    onChange={(event) =>
                      setForm({ ...form, customerPhone: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Priority">
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({ ...form, priority: event.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="standard">Standard</option>
                    <option value="rush">Rush</option>
                    <option value="due_soon">Due soon</option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section title="Shipping">
              <Field label="Address">
                <input
                  value={form.shippingAddress.address}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      shippingAddress: {
                        ...form.shippingAddress,
                        address: event.target.value,
                      },
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="City">
                  <input
                    value={form.shippingAddress.city}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        shippingAddress: {
                          ...form.shippingAddress,
                          city: event.target.value,
                        },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Province">
                  <input
                    value={form.shippingAddress.province}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        shippingAddress: {
                          ...form.shippingAddress,
                          province: event.target.value,
                        },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Postal code">
                  <input
                    value={form.shippingAddress.postalCode}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        shippingAddress: {
                          ...form.shippingAddress,
                          postalCode: event.target.value,
                        },
                      })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Shipping method">
                  <input
                    value={form.shippingMethod}
                    onChange={(event) =>
                      setForm({ ...form, shippingMethod: event.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Products">
              <div className="relative mb-3">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]"
                />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Search products or SKU"
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#d5d5d5] text-sm"
                />
              </div>

              <div className="max-h-[260px] overflow-y-auto border border-[#e2e2e2] rounded-lg divide-y divide-[#eeeeee]">
                {visibleCatalog.map((product) => {
                  const variants = (product.product_variants || []).filter(
                    (variant) => variant.active !== false
                  );
                  const options = variants.length ? variants : [null];

                  return (
                    <div key={product.id} className="p-3">
                      <div className="font-semibold text-sm">{product.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {options.map((variant, index) => (
                          <button
                            key={variant?.id || index}
                            onClick={() => addVariant(product, variant)}
                            className="rounded-lg border border-[#d5d5d5] px-2.5 py-2 text-left text-xs hover:bg-[#fafafa]"
                          >
                            <div className="font-medium">
                              {variant
                                ? [variant.color, variant.size, variant.name]
                                    .filter(Boolean)
                                    .join(" · ")
                                : "Default"}
                            </div>
                            <div className="text-[10px] text-[#777] mt-0.5">
                              {money(
                                variant?.price == null
                                  ? product.price
                                  : variant.price
                              )}
                              {variant?.sku ? ` · ${variant.sku}` : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2">
                {form.items.map((item, index) => (
                  <div
                    key={`${item.productId}-${item.variantId || index}-${index}`}
                    className="rounded-lg border border-[#e2e2e2] bg-white p-3 grid md:grid-cols-[1fr_90px_120px_auto] gap-2 items-end"
                  >
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-[11px] text-[#777]">
                        {[item.color, item.size, item.variant]
                          .filter(Boolean)
                          .join(" · ") || "Default"}
                      </div>
                    </div>
                    <Field label="Qty">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, {
                            quantity: Math.max(
                              1,
                              Number(event.target.value || 1)
                            ),
                          })
                        }
                        className={smallInputClass}
                      />
                    </Field>
                    <Field label="Unit price">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(index, {
                            unitPrice: Math.max(
                              0,
                              Number(event.target.value || 0)
                            ),
                          })
                        }
                        className={smallInputClass}
                      />
                    </Field>
                    <button
                      onClick={() => removeItem(index)}
                      className="h-9 w-9 rounded-lg border border-red-200 bg-red-50 text-red-700 grid place-items-center"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {!form.items.length && (
                  <div className="text-xs text-[#777] py-4 text-center">
                    Add products from the catalog above.
                  </div>
                )}
              </div>
            </Section>
          </div>

          <div className="space-y-4">
            <Section title="Totals">
              <Amount label="Subtotal" value={subtotal} />
              <Field label="Discount">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      discount: Math.max(0, Number(event.target.value || 0)),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Shipping">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.shipping}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      shipping: Math.max(0, Number(event.target.value || 0)),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Tax">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      tax: Math.max(0, Number(event.target.value || 0)),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </Section>

            <Section title="Order details">
              <Field label="Need by date">
                <input
                  type="date"
                  value={form.needByDate}
                  onChange={(event) =>
                    setForm({ ...form, needByDate: event.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  className={textareaClass}
                  rows="6"
                />
              </Field>
            </Section>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-[#eaeaea] text-sm font-semibold">
        {title}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-[#777]">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Amount({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#777]">{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function Metric({ label, value, icon: Icon }) {
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

function Th({ children, right }) {
  return (
    <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, right }) {
  return (
    <td className={`px-4 py-3 align-top ${right ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}

const inputClass =
  "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const smallInputClass =
  "w-full h-9 rounded-lg border border-[#d4d4d4] bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-black/10";
const textareaClass =
  "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
const secondaryButton =
  "h-8 px-2.5 rounded-lg border border-[#d5d5d5] bg-white text-xs inline-flex items-center justify-center gap-1.5";
