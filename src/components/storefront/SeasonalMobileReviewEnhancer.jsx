import { useEffect } from "react";

const REVIEW_SELECTOR = 'section[aria-label="Review seasonal design"]';
const CANVAS_SELECTOR = `${REVIEW_SELECTOR} .gdp-seasonal-preview-frame`;

function distanceBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default function SeasonalMobileReviewEnhancer() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const mobile = window.matchMedia("(max-width: 767px)");
    const pointers = new Map();
    let startDistance = 0;
    let appliedStep = 0;

    const resetPinch = () => {
      startDistance = 0;
      appliedStep = 0;
    };

    const canvasForTarget = (target) => {
      if (!(target instanceof Element)) return null;
      return target.closest(CANVAS_SELECTOR);
    };

    const onPointerDown = (event) => {
      if (!mobile.matches) return;
      const canvas = canvasForTarget(event.target);
      if (!canvas) return;

      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, canvas });
      if (pointers.size === 2) {
        const points = [...pointers.values()];
        if (points[0].canvas !== points[1].canvas) return;
        startDistance = Math.max(1, distanceBetween(points[0], points[1]));
        appliedStep = 0;
      }
    };

    const onPointerMove = (event) => {
      const current = pointers.get(event.pointerId);
      if (!current || !mobile.matches) return;

      pointers.set(event.pointerId, {
        ...current,
        x: event.clientX,
        y: event.clientY,
      });

      if (pointers.size < 2) return;
      const points = [...pointers.values()];
      if (points[0].canvas !== points[1].canvas) return;

      event.preventDefault();
      const nextDistance = Math.max(1, distanceBetween(points[0], points[1]));
      if (!startDistance) startDistance = nextDistance;

      // One zoom step per ~18px of two-finger movement keeps the gesture smooth
      // while reusing React's existing zoom buttons/state as the source of truth.
      const nextStep = Math.trunc((nextDistance - startDistance) / 18);
      const delta = nextStep - appliedStep;
      if (!delta) return;

      const review = points[0].canvas.closest(REVIEW_SELECTOR);
      const selector = delta > 0
        ? 'button[aria-label="Zoom review garment in"]'
        : 'button[aria-label="Zoom review garment out"]';
      const button = review?.querySelector(selector);
      if (!button) return;

      const count = Math.min(4, Math.abs(delta));
      for (let index = 0; index < count; index += 1) button.click();
      appliedStep += Math.sign(delta) * count;
    };

    const onPointerEnd = (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) resetPinch();
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerEnd, { passive: true });
    document.addEventListener("pointercancel", onPointerEnd, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerEnd);
      document.removeEventListener("pointercancel", onPointerEnd);
    };
  }, []);

  return null;
}
