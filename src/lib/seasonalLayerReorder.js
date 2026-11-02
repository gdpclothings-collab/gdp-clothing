// Seasonal layer arrays are saved bottom-to-top and consumed in that order
// by both preview and the protected production renderer. The UI lists them
// top-to-bottom, so reorder only the array; never rewrite artwork metadata.
export function reorderSeasonalArtworkLayers(layers, fromTopIndex, toTopIndex) {
  if (!Array.isArray(layers)) return layers;
  const count = layers.length;
  if (!Number.isInteger(fromTopIndex) || !Number.isInteger(toTopIndex)
    || fromTopIndex < 0 || toTopIndex < 0
    || fromTopIndex >= count || toTopIndex >= count
    || fromTopIndex === toTopIndex) return layers;
  const topToBottom = [...layers].reverse();
  const [moving] = topToBottom.splice(fromTopIndex, 1);
  topToBottom.splice(toTopIndex, 0, moving);
  return topToBottom.reverse();
}
