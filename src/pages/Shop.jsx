import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useProducts } from "@/lib/useProducts";
import { storefrontDiscoveryApi } from "@/lib/storefrontDiscoveryApi";
import ProductCard from "@/components/storefront/ProductCard";
import { ArrowRight, Layers3, SlidersHorizontal } from "lucide-react";

const CATEGORIES = ["All", "T-Shirt", "Hoodie", "Sweatshirt", "Crewneck", "Sweater", "DTF Transfer Film", "Custom"];
const CATALOG_PAGE_SIZE = 8;

function CollectionCard({ collection }) {
  const image = collection.image || collection.products?.[0]?.images?.[0] || "/images/gdp-sold-categories.webp";
  return (
    <Link
      to={"/shop?view=collections&collection=" + encodeURIComponent(collection.slug)}
      className="group relative min-h-[310px] overflow-hidden bg-black text-white sm:min-h-[380px]"
    >
      <img
        src={image}
        alt={collection.name}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
        {collection.seasonal && <div className="font-mono text-[8px] font-black uppercase tracking-[0.16em] text-white/55">Seasonal collection</div>}
        <h2 className="mt-1 font-display text-5xl uppercase leading-[0.88] tracking-wide sm:text-6xl">{collection.name}</h2>
        <p className="mt-2 max-w-sm text-xs leading-5 text-white/70">{collection.tagline || collection.description || "Explore this GDP collection."}</p>
        <div className="mt-5 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em]">
          View collection <ArrowRight size={13} />
        </div>
      </div>
    </Link>
  );
}

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { products, loading } = useProducts({ status: "active" });
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CATALOG_PAGE_SIZE);

  const category = params.get("category") || "All";
  const filter = params.get("filter");
  const q = params.get("q") || "";
  const view = params.get("view") || "";
  const collectionSlug = params.get("collection") || "";
  const collectionMode = view === "collections";

  useEffect(() => {
    if (!collectionMode) return;
    let active = true;
    setCollectionsLoading(true);
    storefrontDiscoveryApi
      .getCollections()
      .then((data) => { if (active) setCollections(data); })
      .catch((error) => console.error("Collections load failed:", error))
      .finally(() => { if (active) setCollectionsLoading(false); });
    return () => { active = false; };
  }, [collectionMode]);

  useEffect(() => {
    setVisibleCount(CATALOG_PAGE_SIZE);
  }, [category, filter, q, collectionMode, collectionSlug]);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.slug === collectionSlug) || null,
    [collections, collectionSlug]
  );

  const filtered = useMemo(() => {
    if (collectionMode && selectedCollection) return selectedCollection.products || [];

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
  }, [products, category, filter, q, collectionMode, selectedCollection]);

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );
  const hasMoreProducts = visibleProducts.length < filtered.length;

  const setCategory = (nextCategory) => {
    const next = new URLSearchParams(params);
    next.delete("view");
    next.delete("collection");
    if (nextCategory === "All") next.delete("category");
    else next.set("category", nextCategory);
    setParams(next);
  };

  const title = collectionMode
    ? selectedCollection?.name?.toUpperCase() || "COLLECTIONS"
    : filter === "best"
      ? "BEST SELLERS"
      : filter === "new"
        ? "LATEST DROP"
        : q
          ? "SEARCH / " + q.toUpperCase()
          : "SHOP ALL";

  const subtitle = collectionMode
    ? selectedCollection?.tagline || selectedCollection?.description || "Curated GDP collections."
    : "Original GDP pieces, customizable apparel and limited drops. Browse the catalog or start with your own story.";

  return (
    <div className="bg-[#f7f6f1] text-black">
      <section className="border-b border-black/10 bg-black text-white">
        <div className="gdp-editorial-grid mx-auto max-w-[1500px] px-4 py-11 sm:px-5 sm:py-14 lg:px-8 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/38">
                GDP / {collectionMode ? "collections" : "catalog"} / 2026
              </div>
              <h1 className="mt-2 font-display text-7xl leading-[0.82] tracking-wide sm:text-8xl md:text-9xl">{title}</h1>
            </div>
            <div className="border-l border-[#e11d2e] pl-4 text-sm leading-6 text-white/52">{subtitle}</div>
          </div>
          {selectedCollection && (
            <div className="mt-7">
              <Link to="/shop?view=collections" className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em] text-white/60 hover:text-white">
                <Layers3 size={13} /> All collections
              </Link>
            </div>
          )}
        </div>
      </section>

      {!collectionMode && (
        <div className="sticky top-[70px] z-30 border-b border-black/10 bg-[#f7f6f1]/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-5 lg:px-8">
            <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={"shrink-0 border px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.13em] transition sm:text-[10px] " + (
                    category === item ? "border-black bg-black text-white" : "border-black/15 bg-transparent text-black/55 hover:border-black hover:text-black"
                  )}
                >
                  {item}
                </button>
              ))}
              <Link to="/shop?view=collections" className="shrink-0 border border-black/15 px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-black/55 transition hover:border-black hover:text-black sm:text-[10px]">
                Collections
              </Link>
            </div>
            <div className="hidden shrink-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-black/42 sm:flex">
              <SlidersHorizontal size={14} /> {filtered.length} pieces
            </div>
          </div>
        </div>
      )}

      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-5 lg:px-8 lg:py-10">
        {collectionMode && !collectionSlug ? (
          collectionsLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[0,1,2].map((item) => <div key={item} className="min-h-[340px] animate-pulse bg-black/10" />)}
            </div>
          ) : collections.length ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}
            </div>
          ) : (
            <div className="border-y border-black/15 py-24 text-center">
              <div className="font-display text-5xl tracking-wide">COLLECTIONS ARE BEING CURATED</div>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/50">Shop the full GDP catalog while new collections are being organized.</p>
              <Link to="/shop" className="mt-6 inline-flex items-center gap-2 bg-black px-5 py-3 text-[9px] font-black uppercase tracking-[0.13em] text-white">
                Shop all <ArrowRight size={13} />
              </Link>
            </div>
          )
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between border-b border-black/15 pb-4 sm:hidden">
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">{collectionMode ? "Collection result" : "Catalog result"}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.15em]">{filtered.length} pieces</span>
            </div>

            {(loading || (collectionMode && collectionsLoading)) ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-7 lg:grid-cols-4 lg:gap-x-4">
                {[0,1,2,3,4,5,6,7].map((item) => <div key={item}><div className="aspect-[3/4] animate-pulse bg-black/10" /><div className="mt-3 h-3 w-2/3 animate-pulse bg-black/10" /></div>)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="border-y border-black/15 py-24 text-center">
                <div className="font-display text-5xl tracking-wide">NO PIECES FOUND</div>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/50">No products match this view yet. Try another category or collection.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-11">
                  {visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
                {hasMoreProducts && (
                  <div className="mt-10 flex justify-center border-t border-black/10 pt-8">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((count) => count + CATALOG_PAGE_SIZE)}
                      className="inline-flex min-h-11 items-center justify-center border border-black bg-black px-7 text-[10px] font-black uppercase tracking-[0.13em] text-white transition hover:bg-[#e11d2e]"
                    >
                      Load {Math.min(CATALOG_PAGE_SIZE, filtered.length - visibleProducts.length)} more
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
