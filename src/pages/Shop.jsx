import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProducts } from "@/lib/useProducts";
import ProductCard from "@/components/storefront/ProductCard";
import { SlidersHorizontal } from "lucide-react";

const CATEGORIES = ["All", "T-Shirt", "Hoodie", "Sweatshirt", "Crewneck", "Sweater", "DTF Transfer", "Custom"];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { products, loading } = useProducts({ status: "active" });

  const category = params.get("category") || "All";
  const filter = params.get("filter");
  const q = params.get("q") || "";

  const filtered = useMemo(() => {
    let list = products;
    if (category !== "All") list = list.filter((product) => product.type === category);
    if (filter === "best") list = list.filter((product) => product.bestSeller);
    if (filter === "new") list = list.filter((product) => product.newArrival);
    if (q) {
      const search = q.toLowerCase();
      list = list.filter((product) => (
        product.name + " " + (product.description || "") + " " + (product.tags || []).join(" ")
      ).toLowerCase().includes(search));
    }
    return list;
  }, [products, category, filter, q]);

  const setCategory = (nextCategory) => {
    const next = new URLSearchParams(params);
    if (nextCategory === "All") next.delete("category");
    else next.set("category", nextCategory);
    setParams(next);
  };

  const title = filter === "best"
    ? "BEST SELLERS"
    : filter === "new"
      ? "LATEST DROP"
      : q
        ? "SEARCH / " + q.toUpperCase()
        : "SHOP ALL";

  return (
    <div className="bg-[#f7f6f1] text-black">
      <section className="border-b border-black/10 bg-black text-white">
        <div className="gdp-editorial-grid mx-auto max-w-[1500px] px-4 py-11 sm:px-5 sm:py-14 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/38">GDP / catalog / 2026</div>
              <h1 className="mt-2 font-display text-7xl leading-[0.82] tracking-wide sm:text-8xl md:text-9xl">{title}</h1>
            </div>
            <div className="border-l border-[#e11d2e] pl-4 text-sm leading-6 text-white/52">
              Original GDP pieces, customizable apparel and limited drops. Browse the catalog or start with your own story.
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-[98px] z-30 border-b border-black/10 bg-[#f7f6f1]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-5 lg:px-8">
          <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={"shrink-0 border px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.13em] transition sm:text-[10px] " + (
                  category === item
                    ? "border-black bg-black text-white"
                    : "border-black/15 bg-transparent text-black/55 hover:border-black hover:text-black"
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="hidden shrink-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-black/42 sm:flex">
            <SlidersHorizontal size={14} />
            {filtered.length} pieces
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-5 lg:px-8 lg:py-10">
        <div className="mb-6 flex items-center justify-between border-b border-black/15 pb-4 sm:hidden">
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">Catalog result</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.15em]">{filtered.length} pieces</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 lg:grid-cols-4 lg:gap-x-4">
            {[0,1,2,3,4,5,6,7].map((item) => (
              <div key={item}>
                <div className="aspect-[3/4] animate-pulse bg-black/8" />
                <div className="mt-3 h-3 w-2/3 animate-pulse bg-black/8" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-y border-black/15 py-24 text-center">
            <div className="font-display text-5xl tracking-wide">NO PIECES FOUND</div>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/50">
              No products match this search yet. Try another category or check back for the next GDP drop.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-11">
            {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </section>
    </div>
  );
}
