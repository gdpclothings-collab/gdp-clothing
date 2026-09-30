import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { adminProductsApi } from "@/lib/adminProductsApi";
import { supabase } from "@/lib/supabaseClient";
import { requestConfirmation, requestNotification } from "@/lib/NotificationContext";

const ACTION_MENU_WIDTH = 232;

function findButtonByText(root, label) {
  return Array.from(root?.querySelectorAll?.("button") || []).find(
    (button) => button.textContent.trim() === label
  ) || null;
}

function storefrontPath(product) {
  return product?.slug ? `/products/${product.slug}` : "";
}

function editorHasUnsavedChanges(root) {
  return Boolean(root?.textContent?.includes("Unsaved changes"));
}

async function deleteProductSafely(product) {
  if (!product?.id) return false;

  if (product.status === "active") {
    requestNotification("Archive this active product before permanently deleting it.");
    return false;
  }

  const { count, error } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product.id);

  if (error) throw error;

  const safeCount = Number(count || 0);
  if (safeCount > 0) {
    requestNotification(
      `${product.name} is linked to ${safeCount} order item${safeCount === 1 ? "" : "s"}. Archive it instead so order history stays intact.`
    );
    return false;
  }

  const confirmed = await requestConfirmation(
    `Permanently delete “${product.name}”? This cannot be undone. Variants, collection links, reviews and wishlist references may also be removed.`
  );
  if (!confirmed) return false;

  const { error: deleteError } = await supabase
    .from("products")
    .delete()
    .eq("id", product.id);

  if (deleteError) throw deleteError;

  requestNotification(`${product.name} permanently deleted.`);
  return true;
}

function ActionMenu({ anchorRect, onClose, items }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 322);
  const left = Math.max(
    8,
    Math.min(anchorRect.right - ACTION_MENU_WIDTH, window.innerWidth - ACTION_MENU_WIDTH - 8)
  );

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[108] cursor-default"
        aria-label="Close product actions"
        onClick={onClose}
      />
      <div
        role="menu"
        className="fixed z-[109] w-[232px] overflow-hidden rounded-xl border border-[#dedede] bg-white py-1.5 text-left shadow-2xl shadow-black/15"
        style={{ top, left }}
      >
        {items.map((item, index) => {
          if (item.separator) {
            return <div key={`separator-${index}`} className="my-1 border-t border-[#eeeeee]" />;
          }
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={async () => {
                onClose();
                await item.onClick?.();
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                item.danger ? "text-red-700 hover:bg-red-50" : "text-[#252525] hover:bg-[#f7f7f7]"
              }`}
            >
              {Icon && <Icon size={15} className="shrink-0" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>,
    document.body
  );
}

function ActionsButton({ label = "Actions", onOpen, className = "" }) {
  return (
    <button
      type="button"
      onClick={(event) => onOpen(event.currentTarget.getBoundingClientRect())}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border text-xs font-medium ${className}`}
      aria-haspopup="menu"
      aria-label={`${label} menu`}
    >
      <MoreHorizontal size={16} />
      <span>{label}</span>
    </button>
  );
}

export default function ProductActionsUX() {
  const [products, setProducts] = useState([]);
  const [rowTargets, setRowTargets] = useState([]);
  const [editorUi, setEditorUi] = useState(null);
  const [menu, setMenu] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const productsBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products]
  );

  const loadProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, slug, status, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    setProducts(data || []);
  }, []);

  const refreshBase = useCallback(() => {
    const refreshButton = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "Refresh" && !button.closest("[data-editor-scroll-root]")
    );
    refreshButton?.click();
  }, []);

  useEffect(() => {
    loadProducts().catch((error) => {
      console.error("Product actions index load failed:", error);
      requestNotification(error?.message || "Could not load product actions.");
    });
  }, [loadProducts]);

  useEffect(() => {
    let frame = 0;

    const scan = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextRows = [];
        for (const row of document.querySelectorAll("table tbody tr")) {
          const slugNode = Array.from(row.querySelectorAll("div")).find((node) =>
            node.children.length === 0 && /^\/[a-z0-9][a-z0-9-]*$/i.test(node.textContent.trim())
          );
          const slug = slugNode?.textContent.trim().slice(1);
          const product = slug ? productsBySlug.get(slug) : null;
          if (!product) continue;

          const actionHost = row.querySelector("td:last-child > div");
          if (!actionHost) continue;

          let target = actionHost.querySelector("[data-gdp-row-actions-host]");
          if (!target) {
            target = document.createElement("span");
            target.setAttribute("data-gdp-row-actions-host", product.id);
            target.className = "inline-flex";
            actionHost.appendChild(target);
          }

          nextRows.push({
            product,
            target,
            editButton: findButtonByText(actionHost, "Edit"),
            statusButton: findButtonByText(actionHost, product.status === "archived" ? "Restore" : "Archive"),
          });
        }

        setRowTargets((current) => {
          const currentSignature = current.map((entry) => `${entry.product.id}:${entry.target.isConnected}`).join("|");
          const nextSignature = nextRows.map((entry) => `${entry.product.id}:${entry.target.isConnected}`).join("|");
          return currentSignature === nextSignature ? current : nextRows;
        });

        const root = document.querySelector("[data-editor-scroll-root]");
        if (!root) {
          setEditorUi((current) => (current ? null : current));
          return;
        }

        const productLink = Array.from(root.querySelectorAll('a[href^="/products/"]')).find((link) => {
          const href = link.getAttribute("href") || "";
          return href.split("/").filter(Boolean).length === 2;
        });
        const editorSlug = productLink?.getAttribute("href")?.split("/products/")[1]?.split(/[?#]/)[0] || "";
        const editorProduct = productsBySlug.get(editorSlug);
        if (!editorProduct) return;

        const stickyHeader = root.querySelector("form > div.sticky");
        const headerActions = Array.from(stickyHeader?.querySelectorAll("div") || []).find((node) => {
          const className = String(node.className || "");
          return className.includes("flex") && className.includes("items-center") && className.includes("shrink-0");
        });

        let headerTarget = stickyHeader?.querySelector("[data-gdp-editor-actions-host]") || null;
        if (!headerTarget && headerActions) {
          headerTarget = document.createElement("span");
          headerTarget.setAttribute("data-gdp-editor-actions-host", editorProduct.id);
          headerTarget.className = "hidden sm:inline-flex";
          headerActions.insertBefore(headerTarget, headerActions.firstChild);
        }

        const form = root.querySelector("form");
        const content = Array.from(form?.children || []).find((node) => {
          const className = String(node.className || "");
          return className.includes("max-w-[1240px]") && className.includes("py-5");
        });
        let dangerTarget = root.querySelector("[data-gdp-product-danger-zone]");
        if (!dangerTarget && content) {
          dangerTarget = document.createElement("div");
          dangerTarget.setAttribute("data-gdp-product-danger-zone", editorProduct.id);
          dangerTarget.className = "mt-5";
          const bottomActions = Array.from(content.children).find((node) => {
            const className = String(node.className || "");
            return className.includes("justify-end") && className.includes("pb-20");
          });
          content.insertBefore(dangerTarget, bottomActions || null);
        }

        if (headerTarget && dangerTarget) {
          setEditorUi((current) => {
            if (
              current?.product?.id === editorProduct.id &&
              current.headerTarget === headerTarget &&
              current.dangerTarget === dangerTarget &&
              current.root === root
            ) {
              return current;
            }
            return { root, product: editorProduct, headerTarget, dangerTarget };
          });
        }
      });
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", scan);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scan);
    };
  }, [productsBySlug]);

  const viewStorefront = useCallback((product) => {
    if (product.status !== "active") {
      requestNotification("Only active products are visible on the storefront. Restore or publish this product first.");
      return;
    }
    window.open(storefrontPath(product), "_blank", "noopener,noreferrer");
  }, []);

  const duplicateProduct = useCallback(async (product) => {
    setBusyId(product.id);
    try {
      const source = await adminProductsApi.get(product.id);
      const { id, createdAt, updatedAt, ...copyable } = source;
      const baseSlug = String(source.slug || source.name || "product")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "product";
      const suffix = Date.now().toString(36);

      await adminProductsApi.save(null, {
        ...copyable,
        name: `${source.name} Copy`,
        slug: `${baseSlug}-copy-${suffix}`,
        status: "draft",
        featured: false,
        bestSeller: false,
        newArrival: false,
        barcode: "",
        variants: (source.variants || []).map((variant) => ({
          ...variant,
          id: null,
          sku: "",
          barcode: "",
          podSku: "",
          stock: 0,
        })),
      });

      requestNotification("Draft duplicate created. Inventory, SKU and barcode values were reset for safety.");
      await loadProducts();
      refreshBase();
    } catch (error) {
      console.error("Product duplicate failed:", error);
      requestNotification(error?.message || "Could not duplicate product.");
    } finally {
      setBusyId(null);
    }
  }, [loadProducts, refreshBase]);

  const archiveFromEditor = useCallback(async (product, root) => {
    if (editorHasUnsavedChanges(root)) {
      requestNotification("Save or discard your current product changes before changing product status.");
      return;
    }

    setBusyId(product.id);
    try {
      if (product.status === "archived") {
        await adminProductsApi.setStatus(product.id, "draft");
        requestNotification(`${product.name} restored as draft.`);
      } else {
        const confirmed = await requestConfirmation(
          `Archive “${product.name}”? It will be removed from the storefront but kept in Admin and order history.`
        );
        if (!confirmed) return;
        await adminProductsApi.setStatus(product.id, "archived");
        requestNotification(`${product.name} archived.`);
      }

      root.querySelector('button[aria-label="Close product editor"]')?.click();
      await loadProducts();
      refreshBase();
    } catch (error) {
      console.error("Product status action failed:", error);
      requestNotification(error?.message || "Could not update product status.");
    } finally {
      setBusyId(null);
    }
  }, [loadProducts, refreshBase]);

  const deleteFromEditor = useCallback(async (product, root) => {
    if (editorHasUnsavedChanges(root)) {
      requestNotification("Save or discard your current product changes before permanently deleting this product.");
      return;
    }

    setBusyId(product.id);
    try {
      const deleted = await deleteProductSafely(product);
      if (!deleted) return;
      root.querySelector('button[aria-label="Close product editor"]')?.click();
      await loadProducts();
      refreshBase();
    } catch (error) {
      console.error("Product delete failed:", error);
      requestNotification(error?.message || "Could not delete product.");
    } finally {
      setBusyId(null);
    }
  }, [loadProducts, refreshBase]);

  const openRowMenu = useCallback((entry, anchorRect) => {
    const { product, editButton, statusButton } = entry;
    setMenu({
      anchorRect,
      key: `row-${product.id}`,
      items: [
        { label: "Edit product", icon: Pencil, onClick: () => editButton?.click() },
        { label: "View storefront", icon: ExternalLink, onClick: () => viewStorefront(product) },
        { label: busyId === product.id ? "Duplicating…" : "Duplicate", icon: Copy, disabled: busyId === product.id, onClick: () => duplicateProduct(product) },
        { separator: true },
        {
          label: product.status === "archived" ? "Restore as draft" : "Archive product",
          icon: product.status === "archived" ? RotateCcw : Archive,
          onClick: () => statusButton?.click(),
        },
        {
          label: "Delete permanently",
          icon: Trash2,
          danger: true,
          onClick: async () => {
            setBusyId(product.id);
            try {
              const deleted = await deleteProductSafely(product);
              if (deleted) {
                await loadProducts();
                refreshBase();
              }
            } catch (error) {
              console.error("Product delete failed:", error);
              requestNotification(error?.message || "Could not delete product.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    });
  }, [busyId, duplicateProduct, loadProducts, refreshBase, viewStorefront]);

  const openEditorMenu = useCallback((anchorRect) => {
    if (!editorUi) return;
    const { product, root } = editorUi;
    setMenu({
      anchorRect,
      key: `editor-${product.id}`,
      items: [
        { label: "View storefront", icon: ExternalLink, onClick: () => viewStorefront(product) },
        {
          label: product.status === "archived" ? "Restore as draft" : "Archive product",
          icon: product.status === "archived" ? RotateCcw : Archive,
          onClick: () => archiveFromEditor(product, root),
        },
        { separator: true },
        { label: "Delete permanently", icon: Trash2, danger: true, onClick: () => deleteFromEditor(product, root) },
      ],
    });
  }, [archiveFromEditor, deleteFromEditor, editorUi, viewStorefront]);

  return (
    <>
      {rowTargets.map((entry) => createPortal(
        <ActionsButton
          key={`row-button-${entry.product.id}`}
          onOpen={(anchorRect) => openRowMenu(entry, anchorRect)}
          className="h-8 px-2.5 border-[#d5d5d5] bg-white hover:bg-[#f7f7f7]"
        />,
        entry.target,
        `row-actions-${entry.product.id}`
      ))}

      {editorUi?.headerTarget && createPortal(
        <ActionsButton
          onOpen={openEditorMenu}
          className="h-9 px-3 border-white/20 text-white hover:bg-white/10"
        />,
        editorUi.headerTarget
      )}

      {editorUi?.dangerTarget && createPortal(
        <section className="overflow-hidden rounded-xl border border-red-200 bg-white">
          <div className="flex items-start gap-3 border-b border-red-100 bg-red-50 px-4 py-3">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-red-700" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Danger Zone</h3>
              <p className="mt-0.5 text-[11px] leading-5 text-red-700">
                Archive removes this product from the storefront while preserving its data. Permanent deletion stays blocked for active products and products referenced by existing orders.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">Product lifecycle actions</div>
              <div className="mt-0.5 text-[11px] text-[#777]">Save or discard unsaved edits before using these actions.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === editorUi.product.id}
                onClick={() => archiveFromEditor(editorUi.product, editorUi.root)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d5d5d5] bg-white px-3 text-xs font-semibold hover:bg-[#fafafa] disabled:opacity-40"
              >
                {editorUi.product.status === "archived" ? <RotateCcw size={14} /> : <Archive size={14} />}
                {editorUi.product.status === "archived" ? "Restore as draft" : "Archive product"}
              </button>
              <button
                type="button"
                disabled={busyId === editorUi.product.id}
                onClick={() => deleteFromEditor(editorUi.product, editorUi.root)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
              >
                <Trash2 size={14} /> Delete permanently
              </button>
            </div>
          </div>
        </section>,
        editorUi.dangerTarget
      )}

      {menu && (
        <ActionMenu
          key={menu.key}
          anchorRect={menu.anchorRect}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
