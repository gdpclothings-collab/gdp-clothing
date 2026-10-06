const SITE_ORIGIN = "https://gdpclothing.ca";

const STATIC_ROUTES = [
  ["/", "weekly", "1.0"],
  ["/shop", "weekly", "0.9"],
  ["/custom-studio", "weekly", "0.9"],
  ["/custom-orders", "monthly", "0.8"],
  ["/dtf", "monthly", "0.7"],
  ["/products/dtf-gang-sheet", "monthly", "0.7"],
  ["/faq", "monthly", "0.6"],
  ["/pages/about", "monthly", "0.6"],
  ["/pages/contact", "monthly", "0.6"],
  ["/pages/shipping-delivery", "monthly", "0.4"],
  ["/pages/returns-refunds", "monthly", "0.4"],
  ["/pages/privacy", "yearly", "0.2"],
  ["/pages/terms", "yearly", "0.2"],
];

function xmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function isPublicProduct(product) {
  if (!product?.slug) return false;
  if (product.slug === "dtf-gang-sheet") return false;
  const tags = Array.isArray(product.tags) ? product.tags.map((tag) => String(tag).toLowerCase()) : [];
  if (tags.includes("custom-studio-only")) return false;
  const channels = product.sales_channels;
  if (Array.isArray(channels) && channels.length > 0 && !channels.includes("online_store")) return false;
  return true;
}

export function buildSitemapXml(products = []) {
  const rows = STATIC_ROUTES.map(([path, changefreq, priority]) => (
    `  <url><loc>${xmlEscape(SITE_ORIGIN + path)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
  ));

  for (const product of products.filter(isPublicProduct)) {
    const lastmod = product.updated_at ? new Date(product.updated_at) : null;
    const validLastmod = lastmod && Number.isFinite(lastmod.getTime())
      ? `<lastmod>${lastmod.toISOString()}</lastmod>`
      : "";
    rows.push(
      `  <url><loc>${xmlEscape(SITE_ORIGIN + "/products/" + encodeURIComponent(product.slug))}</loc>${validLastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

async function fetchActiveProducts(env) {
  const baseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "");
  if (!baseUrl || !key) return [];

  const response = await fetch(
    baseUrl + "/rest/v1/products?status=eq.active&slug=not.is.null&select=slug,updated_at,tags,sales_channels&limit=1000",
    {
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function onRequestGet(context) {
  const products = await fetchActiveProducts(context.env);
  return new Response(buildSitemapXml(products), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
