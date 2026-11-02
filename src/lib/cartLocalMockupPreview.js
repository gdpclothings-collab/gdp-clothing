// Optional browser-only copy of an approved garment *mockup*, never the print master.
// 320x400 JPEG thumbnails normally require tens of KB rather than storing 300-DPI art.
const WIDTH = 320;
const HEIGHT = 400;
const MAX_LENGTH = 90_000;
const DATA_URL = /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function safeCartLocalMockup(value) {
  const url = String(value || '');
  return url.length <= MAX_LENGTH && DATA_URL.test(url) ? url : '';
}

export async function createCartLocalMockup(blob) {
  if (!blob || typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return '';
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read approved garment preview'));
      img.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.fillStyle = '#f8f7f4';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    // The approved customer mockup is already 4:5; contain it without cropping.
    const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width || 1));
    const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height || 1));
    const scale = Math.min(WIDTH / sourceWidth, HEIGHT / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    context.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
    return safeCartLocalMockup(canvas.toDataURL('image/jpeg', 0.68));
  } catch {
    // Signed mockup URL remains available; never block or change an approved design.
    return '';
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Cart-local thumbnails are optional. Persist the order/cart record even when
// Safari/Chrome localStorage quotas reject the thumbnail-heavy payload.
// In-memory previews are retained for this session; only the on-disk fallback
// removes the optional localPreview bytes. No network/storage API is invoked.
function withoutLocalPreview(item) {
  if (!item || !item.isCustom || !item.customerMockups) return item;
  return {
    ...item,
    customerMockups: Object.fromEntries(Object.entries(item.customerMockups).map(([side, mockup]) => {
      if (!mockup || typeof mockup !== 'object') return [side, mockup];
      const { localPreview: _discard, ...rest } = mockup;
      return [side, rest];
    })),
  };
}

export function writeCartPreviewsWithFallback(key, items, explicitStorage = null) {
  try {
    const storage = explicitStorage || (typeof window !== 'undefined' ? window.localStorage : null);
    if (!storage || !key) return false;
    try {
      storage.setItem(key, JSON.stringify(items));
      return true;
    } catch (error) {
      // A SecurityError or unsupported storage is not evidence of available
      // capacity; retry only on documented browser quota errors.
      const quotaExceeded = error?.name === 'QuotaExceededError'
        || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        || error?.code === 22 || error?.code === 1014;
      if (!quotaExceeded) return false;
    }
    storage.setItem(key, JSON.stringify(items.map(withoutLocalPreview)));
    return true;
  } catch {
    // Preserve any previously saved data; keep the current cart in memory.
    return false;
  }
}
