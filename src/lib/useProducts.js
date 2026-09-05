import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

export function useProducts(filter = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    base44.entities.Product.filter(filter, "-created_date", 100)
      .then(res => { if (active) setProducts(Array.isArray(res) ? res : (res?.items || [])); })
      .catch(e => { if (active) setError(e); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [JSON.stringify(filter)]);

  return { products, loading, error };
}