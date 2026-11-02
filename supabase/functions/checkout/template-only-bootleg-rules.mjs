// Permit a photo-free GDP Photo Bootleg template on either garment side
// only when the full approved 300-DPI v2 package is present. This is NOT a
// general exception for empty uploads, Memorial Tribute, or unapproved drafts.
export function allowsTemplateOnlyBootleg({ designPath, renderSnapshot, expectedSides, productionFiles, isLockedRender }) {
  if (designPath !== 'bootleg' || isLockedRender !== true
    || renderSnapshot?.studio !== 'v2'
    || renderSnapshot?.designPath !== 'bootleg'
    || renderSnapshot?.version !== 7) return false;
  if (!Array.isArray(expectedSides) || expectedSides.length < 1 || expectedSides.length > 2
    || new Set(expectedSides).size !== expectedSides.length
    || expectedSides.some((side) => !['front', 'back'].includes(side))) return false;
  const snapshots = renderSnapshot.sides;
  if (!snapshots || typeof snapshots !== 'object' || Array.isArray(snapshots)
    || Object.keys(snapshots).length !== expectedSides.length) return false;
  return expectedSides.every((side) => {
    const printed = snapshots[side];
    const file = productionFiles?.[side];
    return printed?.side === side
      && printed?.designPath === 'bootleg'
      && typeof printed.templateId === 'string'
      && printed.templateId.trim().length > 0
      && Array.isArray(printed.photos)
      && printed.photos.length === 0
      && typeof file?.path === 'string'
      && file.path.length > 0
      && file.dpi === 300
      && Number(file.width_px) >= 600
      && Number(file.height_px) >= 600;
  });
}
