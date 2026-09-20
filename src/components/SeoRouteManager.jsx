import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_ORIGIN = "https://gdpclothing.ca";

const CANONICAL_ALIASES = new Map([
  ["/design", "/custom-studio"],
  ["/custom-studio-v2", "/custom-studio"],
  ["/custom-studio-legacy", "/custom-studio"],
  ["/bulk-orders", "/custom-orders"],
  ["/dtf-gang-sheet", "/products/dtf-gang-sheet"],
]);

const PRIVATE_OR_UTILITY_PREFIXES = [
  "/login",
  "/register",
  "/auth/complete",
  "/forgot-password",
  "/reset-password",
  "/account",
  "/cart",
  "/checkout",
  "/order/",
  "/admin",
];

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/shop",
  "/dtf",
  "/products/dtf-gang-sheet",
  "/dtf-gang-sheet",
  "/custom-orders",
  "/bulk-orders",
  "/custom-studio",
  "/design",
  "/custom-studio-v2",
  "/custom-studio-legacy",
  "/faq",
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

function ensureCanonical(href) {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", href);
}

function ensureRobots(content) {
  let robots = document.head.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement("meta");
    robots.setAttribute("name", "robots");
    document.head.appendChild(robots);
  }
  robots.setAttribute("content", content);
}

export default function SeoRouteManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = normalizePath(pathname);
    const canonicalPath = CANONICAL_ALIASES.get(normalizedPath) || normalizedPath;
    ensureCanonical(`${SITE_ORIGIN}${canonicalPath}`);

    const shouldNoIndex =
      isPrivateOrUtilityRoute(normalizedPath) ||
      normalizedPath === "/custom-studio-legacy" ||
      !isKnownPublicRoute(normalizedPath);

    ensureRobots(shouldNoIndex ? "noindex,follow" : "index,follow");
  }, [pathname]);

  return null;
}
