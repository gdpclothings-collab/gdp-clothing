/**
 * Phase E: subject/face-first STORM composition.
 * Uses the original 750 × 1000 transparent artwork ratio and keeps all 1–5
 * uploaded photos. The upper-center area of each subject has a protected
 * face-priority region that later layers must not cover.
 *
 * This is geometry, NOT automatic face recognition: the original image must
 * contain a visible face and the customer reviews the resulting preview.
 */
export const QUICK_DESIGN_PHASE_C_REFERENCE = Object.freeze({
  nameAtTop: true,
  subjectCentered: true,
  backgroundAnchoredBottom: true,
  transparentArtworkEdge: true,
});

const HERO = Object.freeze({ x: .285, y: .27, w: .43, h: .52, angle: 0, z: 1, role: 'hero' });
const LEFT = Object.freeze({ x: .005, y: .42, w: .345, h: .40, angle: -.018, z: 2, role: 'support' });
const RIGHT = Object.freeze({ x: .65, y: .42, w: .345, h: .40, angle: .018, z: 2, role: 'support' });
const LOW_LEFT = Object.freeze({ x: .055, y: .70, w: .36, h: .26, angle: -.012, z: 3, role: 'foreground' });
const LOW_RIGHT = Object.freeze({ x: .585, y: .70, w: .36, h: .26, angle: .012, z: 3, role: 'foreground' });

export function getQuickDesignPhaseCLayout(photoCount = 5) {
  const count = Math.max(0, Math.min(5, Number(photoCount) || 0));
  if (!count) return [];
  if (count === 1) return [{ ...HERO, x: .13, y: .25, w: .74, h: .69 }];
  if (count === 2) return [
    { ...HERO, x: .36, y: .26, w: .55, h: .58 },
    { ...LEFT, x: .025, y: .44, w: .42, h: .48 },
  ];
  return [HERO, LEFT, RIGHT, LOW_LEFT, LOW_RIGHT].slice(0, count).map(slot => ({ ...slot }));
}

/**
 * The upper-middle portrait region is reserved for each subject's face.
 * Later-rendered layers may overlap torsos/paws, but not these regions.
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
