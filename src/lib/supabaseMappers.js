export function normalizeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    compareAtPrice: row.compare_at_price,
    costPerItem: row.cost_per_item,
    trackInventory: row.track_inventory,
    requiresShipping: row.requires_shipping,
    weightUnit: row.weight_unit,
    fulfillmentMode: row.fulfillment_mode,
    podProvider: row.pod_provider,
    bestSeller: row.best_seller,
    newArrival: row.new_arrival,
    customDesignable: row.custom_designable,
    createdDate: row.created_at,
    updatedDate: row.updated_at,
  };
}

export function normalizeReview(row) {
  if (!row) return null;
  return {
    ...row,
    productId: row.product_id,
    productName: row.product_name,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
  };
}
