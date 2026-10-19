import { useEffect, useRef, useState } from 'react';

/**
 * Floating mirror follows the edit inspector on phones, never the catalog.
 * Return to the full-size garment automatically hides the mirror.
 */
export default function useStudioMobileFloatingPreview() {
  const garmentRef = useRef(null);
  const inspectorRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver !== 'function') return undefined;
    const mobile = window.matchMedia('(max-width: 639px)');
    let mainInView = true;
    let inspectorInView = false;
    const update = () => setVisible(mobile.matches && inspectorInView && !mainInView);
    const garmentObserver = new IntersectionObserver(([entry]) => {
      mainInView = entry.isIntersecting;
      if (mainInView) setMinimized(false);
      update();
    }, { rootMargin: '-78px 0px 0px 0px', threshold: 0 });
    const inspectorObserver = new IntersectionObserver(([entry]) => {
      inspectorInView = entry.isIntersecting;
      update();
    }, { rootMargin: '-78px 0px 0px 0px', threshold: 0 });

    if (garmentRef.current) garmentObserver.observe(garmentRef.current);
    if (inspectorRef.current) inspectorObserver.observe(inspectorRef.current);
    mobile.addEventListener?.('change', update);
    return () => {
      garmentObserver.disconnect();
      inspectorObserver.disconnect();
      mobile.removeEventListener?.('change', update);
    };
  }, []);

  return { garmentRef, inspectorRef, visible, minimized, setMinimized };
}
