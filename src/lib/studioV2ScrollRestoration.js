/**
 * Align an active Studio panel underneath the actual sticky storefront header.
 * Browser history entries keep garment/artwork state separately; this helper
 * changes scroll positioning only.
 *
 * Clamping matters on short pages: the footer may prevent the panel from
 * reaching the nominal anchor even when navigation is working correctly.
 */
export function studioV2ScrollTop({
  scrollY = 0,
  panelTop = 0,
  headerHeight = 70,
  viewportHeight = 0,
  documentHeight = 0,
  gap = 14,
} = {}) {
  const maxTop = Math.max(0, documentHeight - viewportHeight);
  const desiredTop = Math.max(0, scrollY + panelTop - headerHeight - gap);
  return Math.round(Math.min(maxTop, desiredTop));
}

export function studioV2StickyHeaderHeight(documentRoot) {
  const header = documentRoot?.querySelector?.('.gdp-storefront > header');
  const measured = header?.getBoundingClientRect?.().height;
  return Number.isFinite(measured) && measured > 0 ? measured : 70;
}
