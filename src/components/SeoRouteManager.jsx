import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_ORIGIN = "https://gdpclothing.ca";
const DEFAULT_IMAGE = `${SITE_ORIGIN}/images/gdp-hero-approved.webp`;

const CANONICAL_ALIASES = new Map([
  ["/design", "/custom-studio"],
  ["/custom-studio-v2", "/custom-studio"],
  ["/custom-studio-legacy", "/custom-studio"],
  ["/bulk-orders", "/custom-orders"],
  ["/dtf-gang-sheet", "/products/dtf-gang-sheet"],
]);

const ROUTE_META = {
  "/": {
    title: "GDP Clothing | Custom Clothing & Apparel in Saskatoon",
    description: "Create custom T-shirts, hoodies and personalized apparel with GDP Clothing in Saskatoon, Saskatchewan. Design your own clothing or shop GDP originals.",
  },
  "/shop": {
    title: "Shop Clothing & Custom Apparel | GDP Clothing Saskatoon",
    description: "Shop GDP Clothing originals and custom apparel from Saskatoon, Saskatchewan. Explore T-shirts, hoodies and clothing made to stand out.",
  },
  "/custom-studio": {
    title: "Design Your Own Custom Shirt & Hoodie | GDP Clothing",
    description: "Design your own custom T-shirt, hoodie or personalized apparel online with GDP Clothing's Custom Studio in Saskatoon, Saskatchewan.",
  },
  "/custom-orders": {
    title: "Custom Clothing & Bulk Apparel Orders | GDP Clothing",
    description: "Order custom clothing and bulk apparel for teams, businesses, events and groups with GDP Clothing in Saskatoon, Saskatchewan.",
  },
  "/dtf": {
    title: "DTF Printing in Saskatoon | GDP Clothing",
    description: "Order professional DTF printing and custom transfers from GDP Clothing in Saskatoon, Saskatchewan for apparel projects and custom garments.",
  },
  "/products/dtf-gang-sheet": {
    title: "DTF Gang Sheet Printing in Saskatoon | GDP Clothing",
    description: "Build and order custom DTF gang sheets from GDP Clothing in Saskatoon, Saskatchewan with flexible artwork placement for apparel printing.",
  },
  "/faq": {
    title: "Frequently Asked Questions | GDP Clothing",
    description: "Find answers about GDP Clothing custom apparel, ordering, customization, shipping, returns and services in Saskatoon, Saskatchewan.",
  },
  "/pages/about": {
    title: "About GDP Clothing | Custom Apparel in Saskatoon",
    description: "Learn about GDP Clothing, a Saskatoon custom apparel brand creating personalized clothing, original designs and custom garment experiences.",
  },
  "/pages/contact": {
    title: "Contact GDP Clothing | Saskatoon, Saskatchewan",
    description: "Contact GDP Clothing in Saskatoon for questions about custom clothing, orders, apparel customization and customer support.",
  },
  "/pages/shipping-delivery": {
    title: "Shipping & Delivery | GDP Clothing",
    description: "Review shipping and delivery information for GDP Clothing orders and custom apparel.",
  },
  "/pages/returns-refunds": {
    title: "Returns & Refunds | GDP Clothing",
    description: "Review GDP Clothing's returns and refunds information for apparel and custom orders.",
  },
};

const PRIVATE_OR_UTILITY_PREFIXES = [
  "/login", "/register", "/auth/complete", "/forgot-password", "/reset-password",
  "/account", "/cart", "/checkout", "/order/", "/admin",
];

const PUBLIC_EXACT_PATHS = new Set([
  "/", "/shop", "/dtf", "/products/dtf-gang-sheet", "/dtf-gang-sheet",
  "/custom-orders", "/bulk-orders", "/custom-studio", "/design", "/custom-studio-v2",
  "/custom-studio-legacy", "/faq",
]);

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function isKnownPublicRoute(pathname) {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  if (/^\/products\/[^/]+$/.test(pathname)) return true;
  if (/^\/product\/[^/]+$/.test(pathname)) return true;
  if (/^\/pages\/[^/]+$/.test(pathname)) return true;
  return false;
}

function isPrivateOrUtilityRoute(pathname) {
  return PRIVATE_OR_UTILITY_PREFIXES.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
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

export default function SeoRouteManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = normalizePath(pathname);
    const canonicalPath = CANONICAL_ALIASES.get(normalizedPath) || normalizedPath;
    const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
    const metadata = ROUTE_META[canonicalPath];

    ensureCanonical(canonicalUrl);

    const shouldNoIndex =
      isPrivateOrUtilityRoute(normalizedPath) ||
      normalizedPath === "/custom-studio-legacy" ||
      !isKnownPublicRoute(normalizedPath);

    ensureMeta('meta[name="robots"]', { name: "robots", content: shouldNoIndex ? "noindex,follow" : "index,follow" });

    if (metadata) {
      document.title = metadata.title;
      ensureMeta('meta[name="description"]', { name: "description", content: metadata.description });
      ensureMeta('meta[property="og:title"]', { property: "og:title", content: metadata.title });
      ensureMeta('meta[property="og:description"]', { property: "og:description", content: metadata.description });
      ensureMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
      ensureMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
      ensureMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "GDP Clothing" });
      ensureMeta('meta[property="og:locale"]', { property: "og:locale", content: "en_CA" });
      ensureMeta('meta[property="og:image"]', { property: "og:image", content: DEFAULT_IMAGE });
      ensureMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
      ensureMeta('meta[name="twitter:title"]', { name: "twitter:title", content: metadata.title });
      ensureMeta('meta[name="twitter:description"]', { name: "twitter:description", content: metadata.description });
      ensureMeta('meta[name="twitter:image"]', { name: "twitter:image", content: DEFAULT_IMAGE });
    }
  }, [pathname]);

  return null;
}
