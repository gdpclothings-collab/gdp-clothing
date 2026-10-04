import React, { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useProducts } from "@/lib/useProducts";
import { isProductOutOfStock } from "@/lib/productVariants";
import ProductCard from "@/components/storefront/ProductCard";

const SITE_ORIGIN = "https://gdpclothing.ca";
const DEFAULT_IMAGE = `${SITE_ORIGIN}/images/gdp-hero-approved.webp`;
const PRODUCT_SCHEMA_ID = "gdp-product-structured-data";

function routeProductKey(pathname) {
  const normalized = String(pathname || "").replace(/\/+$/, "");
  const slugMatch = normalized.match(/^\/products\/([^/]+)$/);
  if (slugMatch) {
    const slug = decodeURIComponent(slugMatch[1]);
    return slug === "dtf-gang-sheet" ? null : { kind: "slug", value: slug };
  }
  const idMatch = normalized.match(/^\/product\/([^/]+)$/);
  if (idMatch) return { kind: "id", value: decodeURIComponent(idMatch[1]) };
  return null;
}

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
}

function ensureCanonical(href) {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
}

function ensureProductSchema(payload) {
  let script = document.getElementById(PRODUCT_SCHEMA_ID);
  if (!script) {
    script = document.createElement("script");
    script.id = PRODUCT_SCHEMA_ID;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(payload);
}

function removeProductSchema() {
  document.getElementById(PRODUCT_SCHEMA_ID)?.remove();
}

function sameText(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

export default function ProductPageEnhancements() {
  const location = useLocation();
  const productKey = useMemo(() => routeProductKey(location.pathname), [location.pathname]);
  const { products, loading } = useProducts({ status: "active" });

  const currentProduct = useMemo(() => {
    if (!productKey) return null;
    return products.find((product) => (
      productKey.kind === "slug"
        ? sameText(product.slug, productKey.value)
        : String(product.id || "") === productKey.value
    )) || null;
  }, [productKey, products]);

  const recommendations = useMemo(() => {
    if (!currentProduct) return [];
    const candidates = products.filter((product) => (
      product.id !== currentProduct.id &&
      product.slug !== "dtf-gang-sheet"
    ));

    return [...candidates]
      .sort((left, right) => {
        const leftScore =
          (sameText(left.category, currentProduct.category) ? 4 : 0) +
          (sameText(left.type, currentProduct.type) ? 2 : 0) +
          (left.bestSeller ? 1 : 0) +
          (left.newArrival ? 0.5 : 0);
        const rightScore =
          (sameText(right.category, currentProduct.category) ? 4 : 0) +
          (sameText(right.type, currentProduct.type) ? 2 : 0) +
          (right.bestSeller ? 1 : 0) +
          (right.newArrival ? 0.5 : 0);
        return rightScore - leftScore;
      })
      .slice(0, 4);
  }, [currentProduct, products]);

  useEffect(() => {
    if (!currentProduct) {
      removeProductSchema();
      return undefined;
    }

    const canonicalUrl = currentProduct.slug
      ? `${SITE_ORIGIN}/products/${encodeURIComponent(currentProduct.slug)}`
      : `${SITE_ORIGIN}/product/${encodeURIComponent(currentProduct.id)}`;
    const title = String(currentProduct.seo?.title || "").trim() || `${currentProduct.name} | GDP Clothing`;
    const description = String(currentProduct.seo?.description || "").trim()
      || String(currentProduct.description || "").trim()
      || `Shop ${currentProduct.name} from GDP Clothing in Saskatoon, Saskatchewan.`;
    const image = currentProduct.images?.[0] || DEFAULT_IMAGE;
    const price = Math.max(0, Number(currentProduct.price || 0));
    const availability = isProductOutOfStock(currentProduct)
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

    document.title = title;
    ensureCanonical(canonicalUrl);
    ensureMeta('meta[name="description"]', { name: "description", content: description });
    ensureMeta('meta[property="og:title"]', { property: "og:title", content: title });
    ensureMeta('meta[property="og:description"]', { property: "og:description", content: description });
    ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    ensureMeta('meta[property="og:type"]', { property: "og:type", content: "product" });
    ensureMeta('meta[property="og:image"]', { property: "og:image", content: image });
    ensureMeta('meta[property="product:price:amount"]', { property: "product:price:amount", content: price.toFixed(2) });
    ensureMeta('meta[property="product:price:currency"]', { property: "product:price:currency", content: "CAD" });
    ensureMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    ensureMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });

    ensureProductSchema({
      "@context": "https://schema.org",
      "@type": "Product",
      name: currentProduct.name,
      description,
      image: (currentProduct.images || []).filter(Boolean),
      brand: { "@type": "Brand", name: "GDP Clothing" },
      category: currentProduct.category || currentProduct.type || undefined,
      url: canonicalUrl,
      offers: {
        "@type": "Offer",
        priceCurrency: "CAD",
        price: price.toFixed(2),
        availability,
        itemCondition: "https://schema.org/NewCondition",
        url: canonicalUrl,
      },
    });

    return removeProductSchema;
  }, [currentProduct]);

  if (!productKey || loading || !currentProduct || !recommendations.length) return null;

  return (
    <section className="border-t border-black/10 bg-[#f7f6f1] text-black" aria-labelledby="gdp-related-products-title">
      <div className="mx-auto max-w-[1500px] px-4 py-10 sm:px-5 sm:py-12 lg:px-8 lg:py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-black/15 pb-5">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-black/42">GDP / keep exploring</div>
            <h2 id="gdp-related-products-title" className="mt-2 font-display text-5xl leading-none tracking-wide sm:text-6xl">YOU MAY ALSO LIKE</h2>
          </div>
          <Link to="/shop" className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.13em] text-black/55 transition hover:text-[#e11d2e]">
            Shop all <ArrowRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-4">
          {recommendations.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </div>
    </section>
  );
}
