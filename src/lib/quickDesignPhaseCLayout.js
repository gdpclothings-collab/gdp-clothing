/**
 * Phase F connected STORM-style bootleg collage.
 *
 * Deliberate torso overlaps connect the subjects while protecting the
 * upper-center face region of every earlier-painted portrait from later
 * painted cutouts. Dimensions use fractions of the 750x1000 artwork.
 *
 * This is predictable geometry, not AI face detection: original uploaded
 * photos must contain visible faces, and customers visually review results.
 */
export const QUICK_DESIGN_PHASE_C_REFERENCE = Object.freeze({
  nameAtTop: true,
  subjectCentered: true,
  backgroundAnchoredBottom: true,
  transparentArtworkEdge: true,
});

const HERO = Object.freeze({ x: .27, y: .24, w: .46, h: .60, angle: 0, z: 1, role: 'hero' });
const LEFT = Object.freeze({ x: .04, y: .55, w: .45, h: .42, angle: -.014, z: 2, role: 'support' });
const RIGHT = Object.freeze({ x: .51, y: .55, w: .45, h: .42, angle: .014, z: 2, role: 'support' });
const LOW_CENTER = Object.freeze({ x: .29, y: .80, w: .42, h: .19, angle: 0, z: 3, role: 'foreground' });
const LOW_LEFT = Object.freeze({ x: .12, y: .80, w: .40, h: .19, angle: -.008, z: 3, role: 'foreground' });
const LOW_RIGHT = Object.freeze({ x: .48, y: .80, w: .40, h: .19, angle: .008, z: 4, role: 'foreground' });

export function getQuickDesignPhaseCLayout(photoCount = 5) {
  const count = Math.max(0, Math.min(5, Number(photoCount) || 0));
  if (count === 0) return [];
  if (count === 1) return [{ ...HERO, x: .13, y: .25, w: .74, h: .69 }];
  if (count === 2) return [
    { ...HERO, x: .06, y: .26, w: .58, h: .64 },
    { ...RIGHT, x: .47, y: .59, w: .48, h: .39 },
  ];
  if (count === 3) return [HERO, LEFT, RIGHT].map(slot => ({ ...slot }));
  if (count === 4) return [HERO, LEFT, RIGHT, LOW_CENTER].map(slot => ({ ...slot }));
  return [HERO, LEFT, RIGHT, LOW_LEFT, LOW_RIGHT].map(slot => ({ ...slot }));
}

/**
 * Reserve the top/middle part of each photo slot where a face should appear.
 * Later photo boxes may overlap shoulders or the lower body, never this zone.
 */
export function getQuickDesignFacePriorityRegion(slot) {
  return {
    x: slot.x + slot.w * .25,
    y: slot.y + slot.h * .10,
    w: slot.w * .50,
    h: slot.h * .40,
  };
}

export function getQuickDesignPhaseCRenderOrder(photoCount) {
  return getQuickDesignPhaseCLayout(photoCount)
    .map((slot, photoIndex) => ({ ...slot, photoIndex }))
    .sort((a, b) => a.z - b.z);
}

/** Conservative, geometry-only estimate of how closely photo slots connect. */
export function getQuickDesignCollageConnections(photoCount) {
  const slots = getQuickDesignPhaseCLayout(photoCount);
  const touches = (a, b) => {
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return overlapX > .012 && overlapY > .025;
  };
  return slots.map((slot, i) => ({
    photoIndex: i,
    connectsTo: slots.flatMap((other, j) => i !== j && touches(slot, other) ? [j] : []),
  }));
}
