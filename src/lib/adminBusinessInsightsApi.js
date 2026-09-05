import { supabase } from "@/lib/supabaseClient";

export const adminBusinessInsightsApi = {
  async load() {
    const [
      productsResult,
      variantsResult,
      discountsResult,
      reviewsResult,
      settingsResult,
      ordersResult,
    ] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, slug, status, featured, best_seller, new_arrival, custom_designable, images, category, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("product_variants")
        .select("id, product_id, stock, active")
        .eq("active", true)
        .limit(2000),
      supabase
        .from("discounts")
        .select("id, code, type, value, active, starts_at, ends_at, usage_count")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("reviews")
        .select("id, product_id, product_name, rating, status, images, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("orders")
        .select("id, total, payment_status, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    for (const result of [
      productsResult,
      variantsResult,
      discountsResult,
      reviewsResult,
      settingsResult,
      ordersResult,
    ]) {
      if (result.error) throw result.error;
    }

    const products = productsResult.data || [];
    const variants = variantsResult.data || [];
    const discounts = discountsResult.data || [];
    const reviews = reviewsResult.data || [];
    const orders = ordersResult.data || [];
    const settings = settingsResult.data || null;
    const threshold = Number(settings?.low_stock_threshold ?? 5);

    const productVariantMap = new Map();
    for (const variant of variants) {
      if (!productVariantMap.has(variant.product_id)) productVariantMap.set(variant.product_id, []);
      productVariantMap.get(variant.product_id).push(variant);
    }

    const media = products.flatMap((product) =>
      (product.images || []).map((url, index) => ({
        id: `${product.id}-${index}`,
        productId: product.id,
        productName: product.name,
        url,
        primary: index === 0,
        category: product.category || "",
      }))
    );

    const paidOrders = orders.filter((order) => order.payment_status === "paid");

    return {
      products,
      variants,
      discounts,
      reviews,
      orders,
      settings,
      media,
      metrics: {
        activeProducts: products.filter((product) => product.status === "active").length,
        productsWithoutMedia: products.filter((product) => !(product.images || []).length).length,
        productsWithoutVariants: products.filter((product) => !(productVariantMap.get(product.id) || []).length).length,
        lowStockVariants: variants.filter((variant) => Number(variant.stock || 0) <= threshold).length,
        featuredProducts: products.filter((product) => product.featured).length,
        bestSellers: products.filter((product) => product.best_seller).length,
        newArrivals: products.filter((product) => product.new_arrival).length,
        customProducts: products.filter((product) => product.custom_designable).length,
        activeDiscounts: discounts.filter((discount) => discount.active).length,
        pendingReviews: reviews.filter((review) => review.status === "pending").length,
        approvedReviews: reviews.filter((review) => review.status === "approved").length,
        paidRevenue: paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        paidOrders: paidOrders.length,
      },
    };
  },
};
