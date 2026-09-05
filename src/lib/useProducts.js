import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeProduct } from "@/lib/supabaseMappers";

const FIELD_MAP = {
  bestSeller: "best_seller",
  newArrival: "new_arrival",
  customDesignable: "custom_designable",
  fulfillmentMode: "fulfillment_mode",
};

export function useProducts(filter = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      /** @type {any} */
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      for (const [key, value] of Object.entries(filter)) {
        if (value === undefined || value === null || value === "") continue;
        query = query.eq(FIELD_MAP[key] || key, value);
      }

      const { data, error: queryError } = await query;

      if (!active) return;
      if (queryError) {
        setError(queryError);
        setProducts([]);
      } else {
        setProducts((data || []).map(normalizeProduct));
      }
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [JSON.stringify(filter)]);

  return { products, loading, error };
}
