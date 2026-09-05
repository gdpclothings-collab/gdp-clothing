import React, { useEffect, useState } from "react";
import {
  Search,
  Boxes,
  AlertTriangle,
  PackageX,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Minus,
  Plus,
  Save,
} from "lucide-react";
import { adminInventoryApi } from "@/lib/adminInventoryApi";

const PAGE_SIZE = 50;

export default function InventoryModule() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [threshold, setThreshold] = useState(5);
  const [stockFilter, setStockFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState({});

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [listResult, summaryResult] = await Promise.all([
        adminInventoryApi.list({
          page,
          pageSize: PAGE_SIZE,
          search,
          stock: stockFilter,
        }),
        adminInventoryApi.summary(),
      ]);
      setRows(listResult.rows);
      setTotal(listResult.total);
      setThreshold(listResult.threshold);
      setSummary(summaryResult);
      setEditing({});
    } catch (err) {
      console.error("Inventory module load failed:", err);
      setError(err?.message || "Could not load inventory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, stockFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const setDraft = (id, value) => {
    setEditing((current) => ({ ...current, [id]: Math.max(0, Number(value || 0)) }));
  };

  const saveStock = async (row) => {
    const value = editing[row.id];
    if (value === undefined || Number(value) === Number(row.stock)) return;
    try {
      await adminInventoryApi.setStock(row.id, value);
      showNotice(`${row.products?.name || row.sku || "Variant"} stock updated.`);
      await load();
    } catch (err) {
      console.error("Stock update failed:", err);
      showNotice(err?.message || "Stock update failed.");
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
        <SummaryCard label="Inventory units" value={summary?.totalUnits ?? "—"} icon={Boxes} />
        <SummaryCard label="Active variants" value={summary?.variants ?? "—"} icon={PackageCheck} />
        <SummaryCard label="Low stock" value={summary?.lowStock ?? "—"} icon={AlertTriangle} />
        <SummaryCard label="Out of stock" value={summary?.outOfStock ?? "—"} icon={PackageX} />
        <SummaryCard label="Products missing variants" value={summary?.missingVariants ?? "—"} icon={AlertTriangle} />
      </div>

      {summary?.missingVariants > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">
            {summary.missingVariants} product{summary.missingVariants === 1 ? "" : "s"} do not have inventory variants yet.
          </div>
          <div className="text-xs text-amber-800 mt-1">
            Open Products and add at least one variant before stock can be tracked for those products.
          </div>
        </div>
      )}

      <section className="rounded-xl border border-[#dedede] bg-white overflow-hidden">
        <div className="p-3 border-b border-[#e7e7e7] flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search SKU, variant, color or size"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#d5d5d5] outline-none focus:ring-2 focus:ring-black/10 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              ["all", "All"],
              ["healthy", "Healthy"],
              ["low", "Low stock"],
              ["out", "Out of stock"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setStockFilter(id);
                  setPage(1);
                }}
                className={`h-8 px-3 rounded-full text-xs font-medium border whitespace-nowrap ${
                  stockFilter === id
                    ? "bg-[#222] text-white border-[#222]"
                    : "bg-white border-[#d8d8d8] hover:bg-[#f7f7f7]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="text-xs text-[#777] whitespace-nowrap">
            Low stock ≤ {threshold}
          </div>

          <button
            type="button"
            onClick={load}
            className="h-9 px-3 rounded-lg border border-[#d5d5d5] text-sm inline-flex items-center justify-center gap-2 hover:bg-[#fafafa]"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead className="bg-[#fafafa] text-[#707070] text-xs">
              <tr>
                <Th>Product / variant</Th>
                <Th>SKU</Th>
                <Th>Color</Th>
                <Th>Size</Th>
                <Th>Status</Th>
                <Th>Stock</Th>
                <Th right>Adjust</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-14 text-center text-[#777]">Loading inventory…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-14 text-center">
                    <Boxes size={22} className="mx-auto text-[#aaa]" />
                    <div className="font-medium mt-3">No inventory variants found</div>
                    <div className="text-xs text-[#777] mt-1">
                      Add variants from Products or change the current filter.
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const product = row.products || {};
                  const stock = Number(row.stock || 0);
                  const state = stock === 0 ? "out" : stock <= threshold ? "low" : "healthy";
                  const draft = editing[row.id] ?? stock;

                  return (
                    <tr key={row.id} className="border-t border-[#eeeeee] hover:bg-[#fafafa]">
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#f2f2f2] border border-[#e5e5e5] overflow-hidden grid place-items-center shrink-0">
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Boxes size={16} className="text-[#aaa]" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold">{product.name || "Product"}</div>
                            <div className="text-[11px] text-[#777] mt-0.5">{row.name || "Default"}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>{row.sku || "—"}</Td>
                      <Td>{row.color || "—"}</Td>
                      <Td>{row.size || "—"}</Td>
                      <Td><StockPill state={state} /></Td>
                      <Td><span className="font-semibold">{stock}</span></Td>
                      <Td right>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDraft(row.id, Number(draft) - 1)}
                            className="w-8 h-8 rounded-lg border border-[#d5d5d5] grid place-items-center"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={draft}
                            onChange={(event) => setDraft(row.id, event.target.value)}
                            className="w-20 h-8 rounded-lg border border-[#d5d5d5] text-center text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setDraft(row.id, Number(draft) + 1)}
                            className="w-8 h-8 rounded-lg border border-[#d5d5d5] grid place-items-center"
                          >
                            <Plus size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={Number(draft) === stock}
                            onClick={() => saveStock(row)}
                            className="ml-1 h-8 px-2.5 rounded-lg bg-[#222] text-white text-xs inline-flex items-center gap-1.5 disabled:opacity-30"
                          >
                            <Save size={12} /> Save
                          </button>
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
              ? "0 variants"
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total} variants`}
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

function StockPill({ state }) {
  const map = {
    healthy: "bg-emerald-100 text-emerald-800",
    low: "bg-amber-100 text-amber-800",
    out: "bg-red-100 text-red-700",
  };
  const label = state === "healthy" ? "In stock" : state === "low" ? "Low stock" : "Out of stock";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${map[state]}`}>
      {label}
    </span>
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
