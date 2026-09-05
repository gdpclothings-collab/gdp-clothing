import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useProducts } from "@/lib/useProducts";
import ProductCard from "@/components/storefront/ProductCard";
import { SlidersHorizontal } from "lucide-react";\nimport Seo from "@/components/Seo";

const CATEGORIES = ["All", "T-Shirt", "Hoodie", "Sweatshirt", "Crewneck", "Sweater", "DTF Transfer", "Custom"];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { products, loading } = useProducts({ status: "active" });

  const category = params.get("category") || "All";
  const filter = params.get("filter");
  const q = params.get("q") || "";

  const filtered = useMemo(() => {
    let list = products;
    if (category !== "All") list = list.filter(p => p.type === category);
    if (filter === "best") list = list.filter(p => p.bestSeller);
    if (filter === "new") list = list.filter(p => p.newArrival);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(p => (p.name + " " + (p.description || "") + " " + (p.tags || []).join(" ")).toLowerCase().includes(s));
    }
    return list;
  }, [products, category, filter, q]);

  const setCategory = (c) => {
    const next = new URLSearchParams(params);
    if (c === "All") next.delete("category"); else next.set("category", c);
    setParams(next);
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-8">\n      <Seo title="Shop Custom Apparel" description="Shop GDP Clothing custom apparel, personalized tees, hoodies, crewnecks and streetwear in Canadian dollars." path="/shop" />
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Catalog</span>
          <h1 className="font-display text-5xl md:text-6xl leading-none mt-1">
            {filter === "best" ? "BEST SELLERS" : filter === "new" ? "NEW ARRIVALS" : q ? `SEARCH: "${q.toUpperCase()}"` : "SHOP ALL"}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SlidersHorizontal size={16} />
          <span className="font-mono">{filtered.length} ITEMS</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 -mx-4 px-4 lg:mx-0 lg:px-0">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wide border transition-colors ${
              category === c ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-accent"
            }`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground py-20 text-center">Loading products…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground py-20 text-center">No products match your search yet. Check back soon — GDP drops new designs regularly.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}