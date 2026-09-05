import { useEffect } from "react";

const SITE_URL = "https://gdp-clothing.pages.dev";
const DEFAULT_IMAGE = `${SITE_URL}/images/gdp-hero-approved.webp`;

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    for (const [name, value] of Object.entries(attributes)) {
      element.setAttribute(name, value);
    }
    document.head.appendChild(element);
  }
  return element;
}

export default function Seo({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
}) {
  useEffect(() => {
    const pageTitle = title?.includes("GDP Clothing")
      ? title
      : `${title || "GDP Clothing"} | GDP Clothing`;
    const canonicalPath =
      path || (typeof window !== "undefined" ? window.location.pathname : "/");
    const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();
    const resolvedImage = new URL(image || DEFAULT_IMAGE, SITE_URL).toString();

    document.title = pageTitle;

    const descriptionMeta = ensureMeta('meta[name="description"]', {
      name: "description",
    });
    descriptionMeta.setAttribute("content", description || "");

    const robotsMeta = ensureMeta('meta[name="robots"]', { name: "robots" });
    robotsMeta.setAttribute(
      "content",
      noIndex ? "noindex,nofollow" : "index,follow,max-image-preview:large"
    );

    const values = [
      ['meta[property="og:title"]', "property", "og:title", pageTitle],
      ['meta[property="og:description"]', "property", "og:description", description || ""],
      ['meta[property="og:type"]', "property", "og:type", type],
      ['meta[property="og:url"]', "property", "og:url", canonicalUrl],
      ['meta[property="og:image"]', "property", "og:image", resolvedImage],
      ['meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image"],
      ['meta[name="twitter:title"]', "name", "twitter:title", pageTitle],
      ['meta[name="twitter:description"]', "name", "twitter:description", description || ""],
      ['meta[name="twitter:image"]', "name", "twitter:image", resolvedImage],
    ];

    for (const [selector, key, name, value] of values) {
      const meta = ensureMeta(selector, { [key]: name });
      meta.setAttribute("content", value);
    }

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);
  }, [title, description, path, image, type, noIndex]);

  return null;
}
