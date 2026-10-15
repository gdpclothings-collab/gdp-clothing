import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const previousRouteRef = useRef({ pathname, hash });

  useEffect(() => {
    const previous = previousRouteRef.current;
    previousRouteRef.current = { pathname, hash };

    // Studio history (including garment-gallery/focused views) changes the
    // navigation type and query string, but not the actual page. Let the
    // Studio position its own panel instead of resetting the entire page.
    if (previous.pathname === pathname && previous.hash === hash) return;
    if (navigationType === "POP") return;

    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => window.clearTimeout(timer);
    }

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navigationType]);

  return null;
}