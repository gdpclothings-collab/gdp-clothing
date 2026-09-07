export function calculateCartQuantityDiscount(items = []) {
  const eligible = items.filter((item) => !item.discountExempt);
  const exempt = items.filter((item) => item.discountExempt);

  const eligibleSubtotal = eligible.reduce(
    (sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
    0
  );
  const exemptSubtotal = exempt.reduce(
    (sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
    0
  );
  const eligibleCount = eligible.reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity || 1)),
    0
  );

  const factor = eligibleCount >= 3 ? 0.75 : eligibleCount >= 2 ? 0.8 : 1;
  const eligibleAfterDiscount = eligibleSubtotal * factor;
  const subtotal = eligibleSubtotal + exemptSubtotal;
  const afterDiscount = eligibleAfterDiscount + exemptSubtotal;
  const discount = subtotal - afterDiscount;

  return {
    subtotal,
    afterDiscount,
    discount,
    eligibleSubtotal,
    exemptSubtotal,
    eligibleCount,
    factor,
  };
}
