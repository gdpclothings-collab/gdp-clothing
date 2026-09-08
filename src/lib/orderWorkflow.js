export const TERMINAL_ORDER_STATUSES = ["completed", "cancelled", "refunded"];

export const isPickupOrder = (order = {}) => {
  const method = String(order.shippingMethod || order.shipping_method || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
  return ["pickup", "local_pickup", "store_pickup"].includes(method);
};

export const getWorkflowValues = (order = {}) => ({
  status: order.status || "pending_payment",
  paymentStatus: order.paymentStatus || order.payment_status || "pending",
  designStatus: order.designStatus || order.design_status || "not_required",
  productionStatus: order.productionStatus || order.production_status || "not_started",
  fulfillmentStatus: order.fulfillmentStatus || order.fulfillment_status || "unfulfilled",
  trackingNumber: order.trackingNumber || order.tracking_number || "",
  carrier: order.carrier || "",
  shippingMethod: order.shippingMethod || order.shipping_method || "",
  isCustom: Boolean(
    order.isCustom ||
    order.is_custom ||
    order.items?.some((item) => item.isCustom || item.is_custom) ||
    order.order_items?.some((item) => item.isCustom || item.is_custom)
  ),
});

export function getWorkflowIssues(order) {
  const state = getWorkflowValues(order);
  const issues = [];
  const productionStarted = state.productionStatus !== "not_started";
  const fulfillmentStarted = [
    "partially_fulfilled", "fulfilled", "ready_for_pickup", "shipped",
    "out_for_delivery", "delivered", "picked_up",
  ].includes(state.fulfillmentStatus);

  if (productionStarted && !["paid", "partially_refunded"].includes(state.paymentStatus)) {
    issues.push("Production cannot start until payment is confirmed.");
  }
  if (productionStarted && state.isCustom && state.designStatus !== "approved") {
    issues.push("Approve the customer artwork before starting production.");
  }
  if (fulfillmentStarted && state.productionStatus !== "completed") {
    issues.push("Complete production and quality control before fulfillment.");
  }
  if (["shipped", "out_for_delivery", "delivered"].includes(state.fulfillmentStatus)) {
    if (!state.carrier.trim() || !state.trackingNumber.trim()) {
      issues.push("Add both the carrier and tracking number before shipping.");
    }
    if (isPickupOrder(state)) issues.push("Pickup orders cannot be marked as shipped.");
  }
  if (["ready_for_pickup", "picked_up"].includes(state.fulfillmentStatus) && !isPickupOrder(state)) {
    issues.push("Pickup stages are only available for pickup orders.");
  }
  if (state.status === "completed") {
    if (state.productionStatus !== "completed") {
      issues.push("Production must be completed before closing the order.");
    }
    if (!["delivered", "picked_up"].includes(state.fulfillmentStatus)) {
      issues.push("The order can only be completed after delivery or pickup.");
    }
  }
  return [...new Set(issues)];
}

export function canCompleteOrder(order) {
  return getWorkflowIssues({ ...order, status: "completed" }).length === 0;
}

export function getFulfillmentOptions(order) {
  const pickup = isPickupOrder(order);
  const base = ["unfulfilled", "on_hold", "partially_fulfilled"];
  return pickup
    ? [...base, "ready_for_pickup", "picked_up", "cancelled"]
    : [...base, "shipped", "out_for_delivery", "delivered", "cancelled"];
}

export function getCustomerWorkflow(order) {
  const state = getWorkflowValues(order);
  const pickup = isPickupOrder(state);
  const steps = state.isCustom
    ? [
        ["artwork", "Artwork", ["artwork_needed", "design_in_progress", "proof_ready", "awaiting_approval", "revision_requested", "approved"]],
        ["approval", "Approved", ["approved"]],
        ["production", "Production", ["queued", "printing", "quality_control", "packing", "ready", "completed"]],
        ["quality", "Quality check", ["quality_control", "packing", "ready", "completed"]],
        ["fulfillment", pickup ? "Ready for pickup" : "Shipped", pickup ? ["ready_for_pickup", "picked_up"] : ["shipped", "out_for_delivery", "delivered"]],
        ["complete", pickup ? "Picked up" : "Delivered", pickup ? ["picked_up"] : ["delivered"]],
      ]
    : [
        ["confirmed", "Confirmed", ["paid"]],
        ["production", "Production", ["queued", "printing", "quality_control", "packing", "ready", "completed"]],
        ["quality", "Quality check", ["quality_control", "packing", "ready", "completed"]],
        ["fulfillment", pickup ? "Ready for pickup" : "Shipped", pickup ? ["ready_for_pickup", "picked_up"] : ["shipped", "out_for_delivery", "delivered"]],
        ["complete", pickup ? "Picked up" : "Delivered", pickup ? ["picked_up"] : ["delivered"]],
      ];

  let completedThrough = state.paymentStatus === "paid" ? 0 : -1;
  if (state.isCustom) {
    if (["artwork_needed", "design_in_progress", "proof_ready", "awaiting_approval", "revision_requested", "approved"].includes(state.designStatus)) completedThrough = 0;
    if (state.designStatus === "approved") completedThrough = 1;
  }
  if (["queued", "printing", "quality_control", "packing", "ready", "completed"].includes(state.productionStatus)) completedThrough = Math.max(completedThrough, state.isCustom ? 2 : 1);
  if (["quality_control", "packing", "ready", "completed"].includes(state.productionStatus)) completedThrough = Math.max(completedThrough, state.isCustom ? 3 : 2);
  if (["ready_for_pickup", "shipped", "out_for_delivery", "delivered", "picked_up"].includes(state.fulfillmentStatus)) completedThrough = Math.max(completedThrough, steps.length - 2);
  if (["delivered", "picked_up"].includes(state.fulfillmentStatus)) completedThrough = steps.length - 1;

  return steps.map(([id, label], index) => ({ id, label, complete: index <= completedThrough }));
}
