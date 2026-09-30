import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { requestConfirmation, requestNotification } from "@/lib/NotificationContext";

export default function ProductDeleteManager() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [orderCounts, setOrderCounts] = useState({});

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, status, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Product delete manager load failed:", error);
      requestNotification(error?.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadProducts();
  }, [open]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.slug, product.status].some((value) =>
        String(value || "").toLowerCase().includes(term)
      )
    );
  }, [products, search]);

  const getOrderCount = async (productId) => {
    if (Object.prototype.hasOwnProperty.call(orderCounts, productId)) {
      return orderCounts[productId];
    }
    const { count, error } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if (error) throw error;
    const safeCount = Number(count || 0);
    setOrderCounts((current) => ({ ...current, [productId]: safeCount }));
    return safeCount;
  };

  const archiveProduct = async (product) => {
    setBusyId(product.id);
    try {
      const confirmed = await requestConfirmation(
        `Archive “${product.name}”? It will be removed from the storefront but kept in Admin and order history.`
      );
      if (!confirmed) return;
      const { error } = await supabase
        .from("products")
        .update({ status: "archived" })
        .eq("id", product.id);
      if (error) throw error;
      requestNotification(`${product.name} archived.`);
      await loadProducts();
    } catch (error) {
      console.error("Product archive failed:", error);
      requestNotification(error?.message || "Could not archive product.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteProduct = async (product) => {
    setBusyId(product.id);
    try {
      if (product.status === "active") {
        requestNotification("Archive this active product before permanently deleting it.");
        return;
      }

      const orderCount = await getOrderCount(product.id);
      if (orderCount > 0) {
        requestNotification(
          `${product.name} is linked to ${orderCount} order item${orderCount === 1 ? "" : "s"}. Archive it instead so order history stays intact.`
        );
        return;
      }

      const confirmed = await requestConfirmation(
        `Permanently delete “${product.name}”? This cannot be undone. Variants, collection links, reviews and wishlist references may also be removed.`
      );
      if (!confirmed) return;

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);
      if (error) throw error;

      requestNotification(`${product.name} permanently deleted.`);
      setOrderCounts((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      await loadProducts();
    } catch (error) {
      console.error("Product delete failed:", error);
      requestNotification(error?.message || "Could not delete product.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[20rem] right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-red-700 shadow-lg shadow-black/10 hover:bg-red-50"
        aria-label="Manage product deletion"
      >
        <Trash2 size={17} />
        <span>Delete product</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/45 p-3 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#dedede] flex flex-col">
            <div className="px-4 md:px-5 py-4 border-b border-[#e7e7e7] flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.14em] font-bold text-red-700">Danger zone</div>
                <h2 className="text-xl font-bold mt-1">Delete product</h2>
                <p className="text-sm text-[#666] mt-1">Active products must be archived first. Products used in orders cannot be permanently deleted.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="h-9 w-9 rounded-lg grid place-items-center hover:bg-[#f3f3f3]" aria-label="Close delete manager">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 border-b border-[#e7e7e7]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] outline-none focus:ring-2 focus:ring-black/10 text-sm"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-3 md:p-4 space-y-2">
              {loading ? (
                <div className="py-10 text-center text-sm text-[#777]">Loading products…</div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#777]">No matching products.</div>
              ) : filtered.map((product) => {
                const active = product.status === "active";
                const busy = busyId === product.id;
                return (
                  <div key={product.id} className="rounded-xl border border-[#e2e2e2] p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{product.name}</div>
                      <div className="text-xs text-[#777] mt-0.5">/{product.slug} · <span className="capitalize">{product.status}</span></div>
                      {active && (
                        <div className="mt-1 text-[11px] text-amber-700 inline-flex items-center gap-1"><AlertTriangle size={12}/> Archive before delete</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {active && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => archiveProduct(product)}
                          className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#fafafa] disabled:opacity-50"
                        >
                          <Archive size={14}/> Archive
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy || active}
                        onClick={() => deleteProduct(product)}
                        className="h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14}/> {busy ? "Checking…" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
