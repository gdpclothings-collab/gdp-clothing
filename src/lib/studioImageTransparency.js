// Keep transparent customer artwork untouched; never send it for background removal.
// A small client-side alpha sample avoids the remote service for PNG/WebP cutouts.
const ALPHA_IMAGE_TYPES = new Set(['image/png', 'image/webp']);
const MAX_ALPHA_SAMPLE_EDGE = 256;

export async function imageHasTransparency(file) {
  if (!ALPHA_IMAGE_TYPES.has(String(file?.type || '').toLowerCase())) return false;
  if (typeof document === 'undefined') return false;

  let bitmap = null;
  let objectUrl = '';
  try {
    let source = null;
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file, {
          resizeWidth: MAX_ALPHA_SAMPLE_EDGE,
          resizeHeight: MAX_ALPHA_SAMPLE_EDGE,
          resizeQuality: 'medium',
        });
        source = bitmap;
      } catch {
        // Some browsers cannot resize during decode. Use the image element fallback.
      }
    }
    if (!source) {
      if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
      objectUrl = URL.createObjectURL(file);
      source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Image transparency inspection failed.'));
        image.src = objectUrl;
      });
    }

    const sourceWidth = Number(source.width || source.naturalWidth || 0);
    const sourceHeight = Number(source.height || source.naturalHeight || 0);
    if (!sourceWidth || !sourceHeight) return false;

    const ratio = Math.min(1, MAX_ALPHA_SAMPLE_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;

    context.drawImage(source, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) return true;
    }
    return false;
  } catch {
    // An unreadable image keeps the existing non-destructive cleanup/fallback path.
    return false;
  } finally {
    bitmap?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
