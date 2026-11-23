/**
 * Phase C — one STORM-reference composition, not A/B variants.
 * Fractions are relative to the 750x1000 (12x16) transparent preview.
 * Main subject at center, supporting cutouts overlap below and on both sides.
 * All 1-5 uploaded photos appear once; user photo features are untouched.
 */
export const QUICK_DESIGN_PHASE_C_REFERENCE = Object.freeze({
  nameAtTop: true,
  subjectCentered: true,
  backgroundAnchoredBottom: true,
  transparentArtworkEdge: true,
});

const CENTER = { x: .21, y: .24, w: .58, h: .47, angle: 0, z: 3, role: 'hero' };
const LEFT = { x: .005, y: .39, w: .41, h: .40, angle: -.035, z: 2, role: 'support' };
const RIGHT = { x: .595, y: .39, w: .40, h: .40, angle: .035, z: 2, role: 'support' };
const LOW_LEFT = { x: .07, y: .64, w: .44, h: .34, angle: -.025, z: 5, role: 'foreground' };
const LOW_RIGHT = { x: .49, y: .64, w: .44, h: .34, angle: .025, z: 5, role: 'foreground' };

export function getQuickDesignPhaseCLayout(photoCount = 5) {
  const count = Math.max(0, Math.min(5, Number(photoCount) || 0));
  if (!count) return [];
  if (count === 1) return [{ ...CENTER, x: .10, y: .27, w: .80, h: .68, z: 1 }];
  if (count === 2) return [
    { ...CENTER, x: .26, y: .27, w: .68, h: .59, z: 2 },
    { ...LEFT, x: .03, y: .48, w: .49, h: .47, z: 3 },
  ];
  const layout = [CENTER, LEFT, RIGHT, LOW_LEFT, LOW_RIGHT];
  if (count === 3) {
    layout[0] = { ...CENTER, x: .22, y: .32, w: .56, h: .62 };
    layout[1] = { ...LEFT, y: .46, h: .46 };
    layout[2] = { ...RIGHT, y: .46, h: .46 };
  }
  return layout.slice(0, count).map((slot) => ({ ...slot }));
}

export function getQuickDesignPhaseCRenderOrder(photoCount) {
  return getQuickDesignPhaseCLayout(photoCount)
    .map((slot, photoIndex) => ({ ...slot, photoIndex }))
    .sort((a, b) => a.z - b.z);
}
