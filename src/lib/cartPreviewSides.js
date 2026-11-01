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

// Signing runs after local cart hydration and may finish after someone edits,
// removes, or saves an item. Merge URL changes into the *current* collection;
// never replace it with an obsolete copy captured before the request started.
export function mergeRefreshedCartPreviews(currentItems, originalItems, refreshedItems) {
  return currentItems.map((current) => {
    const index = originalItems.findIndex((original) =>
      original === current || (current.key && original.key === current.key)
    );
    if (index < 0 || !current.isCustom || current.isDtf) return current;

    const original = originalItems[index];
    const refreshed = refreshedItems[index];
    if (!refreshed || current.placement !== original.placement || current.imagePath !== original.imagePath) {
      return current;
    }
    for (const side of ['front', 'back']) {
      if ((current.customerMockups?.[side]?.path || '') !== (original.customerMockups?.[side]?.path || '')) {
        return current;
      }
    }

    const customerMockups = current.customerMockups && Object.fromEntries(
      Object.entries(current.customerMockups).map(([side, mockup]) => [
        side,
        { ...mockup, url: refreshed.customerMockups?.[side]?.url || mockup.url },
      ])
    );
    return {
      ...current,
      image: refreshed.image,
      ...(customerMockups ? { customerMockups } : {}),
    };
  });
}
