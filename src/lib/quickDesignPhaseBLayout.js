/**
 * Phase B -- HENRY-inspired deterministic portrait hierarchy.
 * Source-of-truth artwork backgrounds remain the ORIGINAL GDP bitmaps.
 * Every slot describes subject placement, not an image-generation prompt.
 * All fractions are measured against a 750×1000 12:16 canvas.
 */
const LAYOUTS = Object.freeze({
  A: Object.freeze([
    // hero, near the top-center: dominant but not a full-screen sticker
    { x: .28, y: .245, w: .56, h: .46, angle: -0.035, z: 3, role: 'hero' },
    // supporting photos frame the hero, rather than being independent cards
    { x: .015, y: .340, w: .44, h: .355, angle: -.075, z: 2, role: 'support' },
    { x: .245, y: .565, w: .64, h: .315, angle: .035, z: 4, role: 'support' },
    { x: .015, y: .682, w: .395, h: .23, angle: -.06, z: 5, role: 'support' },
    { x: .615, y: .680, w: .37, h: .23, angle: .065, z: 6, role: 'support' },
  ]),
  B: Object.freeze([
    { x: .16, y: .285, w: .66, h: .51, angle: .025, z: 3, role: 'hero' },
    { x: .58, y: .262, w: .40, h: .35, angle: .075, z: 2, role: 'support' },
    { x: .00, y: .462, w: .43, h: .35, angle: -.09, z: 4, role: 'support' },
    { x: .45, y: .652, w: .535, h: .28, angle: .06, z: 6, role: 'support' },
    { x: .015, y: .715, w: .38, h: .21, angle: -.08, z: 5, role: 'support' },
  ]),
});

export const QUICK_DESIGN_PHASE_B_NAMES = Object.freeze({
  A: 'Layered Classic',
  B: 'Dramatic Stack',
});

export function getQuickDesignPhaseBLayout(variant = 'A', photoCount = 5) {
  const layout = LAYOUTS[variant === 'B' ? 'B' : 'A'];
  const count = Math.max(0, Math.min(5, Number(photoCount) || 0));
  if (!count) return [];
  // One photo gets the full hero treatment rather than five duplicates.
  if (count === 1) return [{ ...layout[0], x: .12, y: .275, w: .76, h: .61, z: 1 }];
  // With only two subjects, retain a strong but visibly supporting second.
  if (count === 2) return [
    { ...layout[0], x: .14, y: .26, w: .71, h: .525, z: 2 },
    { ...layout[1], x: variant === 'B' ? .495 : .035, y: .585, w: .49, h: .33, z: 3 },
  ];
  return layout.slice(0, count).map((slot) => ({ ...slot }));
}

export function getQuickDesignPhaseBRenderOrder(variant, photoCount) {
  return getQuickDesignPhaseBLayout(variant, photoCount)
    .map((slot, photoIndex) => ({ ...slot, photoIndex }))
    .sort((a, b) => a.z - b.z);
}
