// Customer garment mockups are intentionally separate from 300-DPI production artwork.
// Older saved cart items only contain `image`; keep those previews working as-is.
export function cartPreviewSides(item = {}) {
  if (!item.isCustom || item.isDtf) return [];
  const printedSides = item.placement === 'front_back'
    ? ['front', 'back']
    : [item.placement === 'back' ? 'back' : 'front'];
  const primarySide = printedSides[0];
  return printedSides.flatMap((side) => {
    const mockup = item.customerMockups?.[side];
    const url = mockup?.url || (side === primarySide ? item.image : '');
    return url ? [{ side, url }] : [];
  });
}
