/**
 * GDP Quick Design: zero-network transparency preflight.
 *
 * This detects an ALREADY TRANSPARENT image (an alpha cutout) so it can be
 * reused byte-for-byte without consuming a remove.bg call.
 *
 * It does not claim to distinguish a white/solid background from a subject:
 * opaque JPGs/PNGs/WebPs require segmentation to decide what to remove.
 * Unreadable inputs fail closed; no third-party upload is attempted.
 */
const ALPHA_SAMPLE_SIDE = 96;

function cornersAreTransparent(data, width, height) {
  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
  ];
  return corners.filter(([x, y]) => data[(y * width + x) * 4 + 3] < 240).length;
}

/**
 * @param {File} file JPG, PNG or WebP, already size/MIME validated at upload
 * @returns {Promise<'already-transparent'|'needs-removal'|'unreadable'>}
 */
export async function detectQuickDesignBackground(file) {
  if (!file || !file.size) return 'unreadable';
  // JPEG has no transparent-alpha channel.
  if (file.type === 'image/jpeg') return 'needs-removal';
  if (file.type !== 'image/png' && file.type !== 'image/webp') return 'unreadable';

  let bitmap = null;
  let previewUrl = '';
  let image = null;
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
    } else {
      previewUrl = URL.createObjectURL(file);
      image = new Image();
      image.src = previewUrl;
      await image.decode();
    }
    const source = bitmap || image;
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    if (!width || !height) return 'unreadable';

    const canvas = document.createElement('canvas');
    canvas.width = ALPHA_SAMPLE_SIDE;
    canvas.height = ALPHA_SAMPLE_SIDE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'unreadable';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let alphaPixels = 0;
    let visiblePixels = 0;
    for (let offset = 3; offset < rgba.length; offset += 4) {
      const a = rgba[offset];
      if (a < 240) alphaPixels += 1;
      if (a > 40) visiblePixels += 1;
    }

    // Completely transparent PNGs are already transparent, too.
    if (!visiblePixels) return 'already-transparent';

    // Require meaningful alpha + transparent corners, not merely a tiny
    // anti-aliased edge or a translucent overlay inside an opaque rectangle.
    const share = alphaPixels / (canvas.width * canvas.height);
    if (share >= 0.015 && cornersAreTransparent(rgba, canvas.width, canvas.height) >= 2) {
      return 'already-transparent';
    }
    return 'needs-removal';
  } catch {
    return 'unreadable';
  } finally {
    if (bitmap?.close) bitmap.close();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }
}
