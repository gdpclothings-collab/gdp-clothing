import React, { useLayoutEffect, useRef } from "react";
import CustomStudioDesktopWorkspaceV8 from "@/pages/CustomStudioDesktopWorkspaceV8";

const DESKTOP_BREAKPOINT = 1280;

function garmentCards(grid) {
  if (!grid) return [];
  return Array.from(grid.children || []).filter((node) =>
    node instanceof HTMLButtonElement && Boolean(node.querySelector(".font-bold.leading-tight"))
  );
}

function garmentCardImage(card) {
  const image = card?.querySelector?.(":scope > div:first-child img");
  return image instanceof HTMLImageElement ? image : null;
}

function rememberOriginalCardImage(card) {
  const image = garmentCardImage(card);
  if (!image) return null;
  if (!image.dataset.gdpOriginalSrc) {
    image.dataset.gdpOriginalSrc = image.getAttribute("src") || image.currentSrc || image.src || "";
  }
  return image;
}

function restoreExpandedGarmentImages(grid) {
  if (!grid) return;
  const collapsed = grid.dataset.gdpCollapsed === "true";
  const selected = garmentCards(grid).find((card) => card.classList.contains("border-accent")) || null;

  garmentCards(grid).forEach((card) => {
    const image = rememberOriginalCardImage(card);
    if (!image) return;

    // V8 may temporarily replace the selected summary thumbnail with the live
    // colour-specific mockup. That is useful only while the chooser is collapsed.
    // Restore catalog assets as soon as the full chooser opens so a previous
    // selection can never leak a zoomed/cropped live-preview image into a card.
    if (!collapsed || card !== selected) {
      const original = image.dataset.gdpOriginalSrc || "";
      if (original && image.getAttribute("src") !== original) {
        image.setAttribute("src", original);
      }
    }
  });
}

export default function CustomStudioDesktopWorkspaceV9() {
  const hostRef = useRef(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof MutationObserver === "undefined") return undefined;
    const host = hostRef.current;
    if (!host) return undefined;

    const desktop = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    let frame = 0;
    let stopped = false;

    const refine = () => {
      frame = 0;
      if (stopped || !desktop.matches) return;
      const grid = host.querySelector('.gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid]');
      restoreExpandedGarmentImages(grid);
    };

    const schedule = () => {
      if (stopped || frame) return;
      frame = window.requestAnimationFrame(refine);
    };

    // Layout effect runs before V8 passive effects, allowing us to snapshot each
    // React-rendered catalog image before V8 can substitute a live preview source.
    refine();
    const observer = new MutationObserver(schedule);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "class", "data-gdp-collapsed"],
    });
    window.addEventListener("resize", schedule);

    return () => {
      stopped = true;
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={hostRef} className="gdp-custom-studio-v9">
      <CustomStudioDesktopWorkspaceV8 />
    </div>
  );
}
