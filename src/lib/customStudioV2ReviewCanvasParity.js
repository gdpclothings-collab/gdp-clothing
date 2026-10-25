/**
 * DOM cloning/serialization does not include pixels painted into a canvas.
 * Freeze those pixels as inert PNG images for the read-only Final Review card.
 * Keep this separate from editor state and the canonical 300-DPI export.
 */
export function rasterizeReviewPreviewCanvases(sourceSection, clonedSection) {
  const liveCanvases = sourceSection.querySelectorAll('canvas');
  const clonedCanvases = clonedSection.querySelectorAll('canvas');

  liveCanvases.forEach((liveCanvas, index) => {
    const cloneCanvas = clonedCanvases[index];
    if (!cloneCanvas || !liveCanvas.width || !liveCanvas.height) return;

    let png;
    try {
      png = liveCanvas.toDataURL('image/png');
    } catch (error) {
      // A cross-origin/tainted canvas cannot be serialized. Do not change
      // its source or interfere with production rendering.
      console.warn('[GDP Final Review] Canvas artwork snapshot failed', error);
      return;
    }
    if (!png.startsWith('data:image/png')) return;

    const image = clonedSection.ownerDocument.createElement('img');
    image.src = png;
    image.className = cloneCanvas.className;
    image.style.cssText = cloneCanvas.style.cssText;
    image.style.pointerEvents = 'none';
    image.width = liveCanvas.width;
    image.height = liveCanvas.height;
    image.alt = liveCanvas.getAttribute('aria-label') || 'Approved artwork';
    image.draggable = false;
    image.setAttribute('data-gdp-final-review-canvas-bitmap', 'true');
    cloneCanvas.replaceWith(image);
  });
}
