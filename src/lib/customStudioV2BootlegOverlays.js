// Print-area overlays are deterministic and rendered from the same function in
// the editor preview and the 300-DPI production PNG. No external assets needed.
export const BOOTLEG_OVERLAY_PRESETS = Object.freeze([
  { id: 'none', label: 'None' },
  { id: 'grunge', label: 'Grunge' },
  { id: 'smoke', label: 'Smoke' },
  { id: 'light', label: 'Light leaks' },
  { id: 'grain', label: 'Film grain' },
  { id: 'scratches', label: 'Scratches' },
  { id: 'halftone', label: 'Halftone' },
  { id: 'tint', label: 'Color tint' },
]);

export const DEFAULT_BOOTLEG_OVERLAY = Object.freeze({
  id: 'none',
  enabled: true,
  opacity: 42,
  scale: 100,
  rotation: 0,
  x: 50,
  y: 50,
  color: '#f43f5e',
});

const clamp = (number, low, high) => Math.min(high, Math.max(low, Number.isFinite(Number(number)) ? Number(number) : low));
const validHex = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? value : '#f43f5e';

export function normalizeBootlegOverlay(input = {}) {
  const value = /** @type {Record<string, any>} */ (input && typeof input === 'object' ? input : {});
  return {
    id: BOOTLEG_OVERLAY_PRESETS.some((preset) => preset.id === value.id) ? value.id : 'none',
    enabled: value.enabled !== false,
    opacity: clamp(value.opacity ?? 42, 0, 100),
    scale: clamp(value.scale ?? 100, 25, 250),
    rotation: clamp(value.rotation ?? 0, -180, 180),
    x: clamp(value.x ?? 50, 0, 100),
    y: clamp(value.y ?? 50, 0, 100),
    color: validHex(value.color),
  };
}

// LCG gives repeatable grains/scratches, not a different random effect on every render.
function randomGenerator(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function radialGlow(context, x, y, radius, rgb, alpha = 1) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
  gradient.addColorStop(0.35, 'rgba(' + rgb + ',' + (alpha * 0.5) + ')');
  gradient.addColorStop(1, 'rgba(' + rgb + ',0)');
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/**
 * Paint a non-destructive effect clipped to the garment's actual print rectangle.
 * Coordinates are normalized to the print area, never the shirt/mockup.
 * @returns {boolean} Whether an effect was painted.
 */
export function paintBootlegOverlay(context, width, height, input = {}) {
  const effect = normalizeBootlegOverlay(input);
  const w = Number(width);
  const h = Number(height);
  if (!context || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 ||
      effect.id === 'none' || !effect.enabled || effect.opacity === 0) return false;

  context.save();
  try {
    // Clip before translating/rotating/scaling, so no pixel can leave the
    // destination print area, including after aggressive transforms.
    context.beginPath();
    context.rect(0, 0, w, h);
    context.clip();
    context.globalAlpha = effect.opacity / 100;
    context.translate(w * effect.x / 100, h * effect.y / 100);
    context.rotate(effect.rotation * Math.PI / 180);
    context.scale(effect.scale / 100, effect.scale / 100);
    context.translate(-w / 2, -h / 2);
    context.scale(w / 1000, h / 1000);

    const rand = randomGenerator(0x59c38f21);
    if (effect.id === 'grunge') {
      context.fillStyle = '#121212';
      for (let index = 0; index < 560; index += 1) {
        const x = rand() * 1100 - 50;
        const y = rand() * 1100 - 50;
        const length = 1 + Math.pow(rand(), 3) * 45;
        context.fillRect(x, y, length, 0.7 + rand() * 5);
      }
      context.strokeStyle = '#0f172a';
      context.lineWidth = 1.5;
      for (let index = 0; index < 30; index += 1) {
        const x = rand() * 1100 - 50;
        const y = rand() * 1100 - 50;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + rand() * 140, y - rand() * 65);
        context.stroke();
      }
    } else if (effect.id === 'grain' || effect.id === 'scratches') {
      const count = effect.id === 'grain' ? 2100 : 300;
      for (let index = 0; index < count; index += 1) {
        context.fillStyle = rand() > 0.5 ? '#fafafa' : '#111827';
        const size = effect.id === 'grain' ? (1 + rand() * 3) : (1 + rand() * 2);
        context.fillRect(rand() * 1000, rand() * 1000, size, size);
      }
      if (effect.id === 'scratches') {
        context.strokeStyle = '#f8fafc';
        context.lineWidth = 1.5;
        for (let index = 0; index < 34; index += 1) {
          const x = rand() * 1000;
          const y = rand() * 1000;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + (rand() - 0.5) * 30, y + 35 + rand() * 250);
          context.stroke();
        }
      }
    } else if (effect.id === 'halftone') {
      context.fillStyle = '#111827';
      for (let y = 14; y < 1000; y += 32) {
        for (let x = 14; x < 1000; x += 32) {
          const r = 2 + 9 * (0.5 + 0.5 * Math.sin(x / 92 + y / 153));
          context.beginPath();
          context.arc(x, y, r, 0, Math.PI * 2);
          context.fill();
        }
      }
    } else if (effect.id === 'smoke') {
      for (let index = 0; index < 19; index += 1) {
        const x = 90 + rand() * 820;
        const y = 120 + rand() * 760;
        radialGlow(context, x, y, 130 + rand() * 300, '236,241,246', 0.17 + rand() * 0.26);
      }
    } else if (effect.id === 'light') {
      radialGlow(context, 100, 160, 650, '255,132,50', 0.92);
      radialGlow(context, 960, 780, 540, '236,55,135', 0.9);
      radialGlow(context, 330, 50, 390, '255,246,196', 0.53);
    } else if (effect.id === 'tint') {
      context.fillStyle = effect.color;
      context.fillRect(0, 0, 1000, 1000);
    }
  } finally {
    context.restore();
  }
  return true;
}
