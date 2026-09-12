import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { normalizeProduct } from "@/lib/supabaseMappers";

const FIELD_MAP = {
  bestSeller: "best_seller",
  newArrival: "new_arrival",
  customDesignable: "custom_designable",
  fulfillmentMode: "fulfillment_mode",
};

// Keep this widened to `string` so Supabase's type-level select parser does not
// recursively instantiate the full nested relationship at build time.
/** @type {string} */
const STOREFRONT_PRODUCT_FIELDS = `
  id,
  name,
  slug,
  description,
  type,
  category,
  price,
  compare_at_price,
  images,
  colors,
  tags,
  status,
  best_seller,
  new_arrival,
  custom_designable,
  selling_mode,
  fulfillment_mode,
  track_inventory,
  sell_when_out_of_stock,
  created_at,
  updated_at,
  product_variants(id, stock, price, color, size, active)
`;

function stableFilter(filter = {}) {
  return Object.fromEntries(
    Object.entries(filter)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

async function fetchProducts(filter) {
  // Filters use runtime field names, so keeping the builder shallow avoids
  // exploding Supabase's recursive generic types while preserving runtime safety.
  /** @type {any} */
  let query = supabase
    .from("products")
    .select(STOREFRONT_PRODUCT_FIELDS)
    .order("created_at", { ascending: false })
    .limit(100);

  for (const [key, value] of Object.entries(filter)) {
    query = query.eq(FIELD_MAP[key] || key, value);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || [])
    .map(normalizeProduct)
    .filter((product) =>
      !(product.tags || []).some(
        (tag) => String(tag).toLowerCase() === "custom-studio-only"
      )
    );
}

export function useProducts(filter = {}) {
  const normalizedFilter = stableFilter(filter);
  const query = useQuery({
    queryKey: ["storefront-products", normalizedFilter],
    queryFn: () => fetchProducts(normalizedFilter),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    products: query.data || [],
    loading: query.isLoading,
    error: query.error || null,
  };
}
