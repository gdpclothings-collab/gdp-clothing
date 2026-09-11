import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const GARMENT_GRID_SELECTOR = '#custom-studio-workspace div[class~="sm:grid-cols-2"][class~="xl:grid-cols-3"]';
const FRONT_MOCKUP_SELECTOR = 'img[alt$=" front mockup"]';
const COLOR_PREVIEW_CLASS = "gdp-garment-color-preview";
const COLOR_PREVIEW_HOST_CLASS = "gdp-garment-color-preview-host";
const FADE_MS = 300;
const MOVE_MS = 260;
const COLOR_SWAP_MS = 260;

function garmentButtons(grid) {
  if (!grid) return [];
  return Array.from(grid.children).filter(
    (child) => child instanceof HTMLButtonElement && child.type === "button"
  );
}

function activeGarmentButton(grid) {
  return garmentButtons(grid).find((button) => button.classList.contains("border-accent")) || null;
}

function findGarmentGrid() {
  const candidate = document.querySelector(GARMENT_GRID_SELECTOR);
  if (!(candidate instanceof HTMLElement)) return null;
  return garmentButtons(candidate).length ? candidate : null;
}

function cardMediaHost(button) {
  const host = button?.firstElementChild;
  return host instanceof HTMLElement ? host : null;
}

function clearColorPreview(button) {
  const host = cardMediaHost(button);
  if (!host) return;
  host.querySelectorAll(`:scope > .${COLOR_PREVIEW_CLASS}`).forEach((node) => node.remove());
  host.classList.remove(COLOR_PREVIEW_HOST_CLASS);
}

function liveFrontMockupImage() {
  const images = Array.from(document.querySelectorAll(FRONT_MOCKUP_SELECTOR)).filter(
    (node) => node instanceof HTMLImageElement
  );

  // Prefer the currently visible storefront preview. This keeps the color-sync
  // source correct on both the stacked mobile layout and desktop sidebar while
  // excluding the hidden production-render mockups used for exports.
  const visible = images.find(
    (image) => image.offsetParent !== null && !image.closest('[aria-hidden="true"]')
  );
  if (visible) return visible;

  const storefront = images.find(
    (image) => image.closest("aside") && !image.closest('[aria-hidden="true"]')
  );
  if (storefront) return storefront;

  return images.find((image) => !image.closest('[aria-hidden="true"]')) || null;
}

function syncSelectedColorPreview(grid, reducedMotion = false) {
  if (!grid || grid.dataset.gdpMode !== "focused") return;
  const selected = garmentButtons(grid).find((button) => button.dataset.gdpSelected === "true");
  if (!selected) return;

  const sourceImage = liveFrontMockupImage();
  const nextSrc = sourceImage?.currentSrc || sourceImage?.src || "";
  if (!nextSrc) {
    clearColorPreview(selected);
    return;
  }

  const host = cardMediaHost(selected);
  if (!host) return;
  host.classList.add(COLOR_PREVIEW_HOST_CLASS);

  let overlay = host.querySelector(`:scope > .${COLOR_PREVIEW_CLASS}`);
  if (!(overlay instanceof HTMLImageElement)) {
    overlay = document.createElement("img");
    overlay.className = COLOR_PREVIEW_CLASS;
    overlay.alt = "";
    overlay.setAttribute("aria-hidden", "true");
    overlay.draggable = false;
    host.appendChild(overlay);
  }

  if (overlay.dataset.gdpSource === nextSrc) return;

  const applySource = () => {
    if (!overlay.isConnected || !grid.isConnected || grid.dataset.gdpMode !== "focused") return;
    overlay.dataset.gdpSource = nextSrc;
    overlay.src = nextSrc;
    if (!reducedMotion && typeof overlay.animate === "function") {
      overlay.animate(
        [
          { opacity: 0.38, transform: "scale(.992)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: COLOR_SWAP_MS, easing: "cubic-bezier(.22,.8,.24,1)" }
      );
    }
  };

  const preload = new Image();
  preload.decoding = "async";
  preload.onload = applySource;
  preload.src = nextSrc;
  if (preload.complete && preload.naturalWidth > 0) applySource();
}

function saveTitle(button) {
  if (!button || button.dataset.gdpTitleSaved === "true") return;
  button.dataset.gdpTitleSaved = "true";
  button.dataset.gdpOriginalTitle = button.getAttribute("title") || "";
}

function restoreTitle(button) {
  if (!button || button.dataset.gdpTitleSaved !== "true") return;
  const originalTitle = button.dataset.gdpOriginalTitle || "";
  if (originalTitle) button.setAttribute("title", originalTitle);
  else button.removeAttribute("title");
  delete button.dataset.gdpTitleSaved;
  delete button.dataset.gdpOriginalTitle;
}

function markSelected(grid, selectedButton) {
  garmentButtons(grid).forEach((button) => {
    const selected = button === selectedButton;
    if (selected) {
      button.dataset.gdpSelected = "true";
      saveTitle(button);
      button.setAttribute("title", "Selected garment — click to change garment");
    } else {
      delete button.dataset.gdpSelected;
      clearColorPreview(button);
      restoreTitle(button);
    }
  });
}

function clearEnhancement(grid) {
  if (!grid) return;
  delete grid.dataset.gdpMode;
  delete grid.dataset.gdpSettled;
  grid.classList.remove("gdp-garment-choice-grid");
  garmentButtons(grid).forEach((button) => {
    delete button.dataset.gdpSelected;
    clearColorPreview(button);
    restoreTitle(button);
  });
}

function animateMove(button, before, duration) {
  if (!button || !before || duration <= 1 || typeof button.animate !== "function") return;
  const after = button.getBoundingClientRect();
  const deltaX = before.left - after.left;
  const deltaY = before.top - after.top;
  if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

  button.animate(
    [
      { transform: `translate(${deltaX}px, ${deltaY}px)` },
      { transform: "translate(0, 0)" },
    ],
    { duration, easing: "cubic-bezier(.22,.8,.24,1)" }
  );
}

const GARMENT_FOCUS_STYLES = `
.gdp-garment-choice-grid > button {
  transform-origin: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition:
    opacity 300ms cubic-bezier(.22,.8,.24,1),
    transform 300ms cubic-bezier(.22,.8,.24,1),
    filter 300ms cubic-bezier(.22,.8,.24,1),
    border-color 180ms ease,
    box-shadow 180ms ease;
  will-change: opacity, transform;
}

.gdp-garment-choice-grid[data-gdp-mode="focused"] > button:not([data-gdp-selected="true"]) {
  opacity: 0;
  transform: translateY(4px) scale(.965);
  filter: saturate(.86);
  pointer-events: none;
}

.gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] > button:not([data-gdp-selected="true"]) {
  display: none;
}

.gdp-garment-choice-grid[data-gdp-mode="focused"] > button[data-gdp-selected="true"] {
  position: relative;
  z-index: 2;
  cursor: pointer;
  border-color: hsl(var(--accent));
  box-shadow: 0 12px 28px rgba(25, 22, 18, .10);
}

.${COLOR_PREVIEW_HOST_CLASS} {
  position: relative;
}

.${COLOR_PREVIEW_CLASS} {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #f1ede6;
  pointer-events: none;
  transform-origin: center;
}

.gdp-garment-choice-grid[data-gdp-mode="focused"] > button[data-gdp-selected="true"]::after {
  content: "Selected · Change garment";
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  max-width: calc(100% - 16px);
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, .75);
  border-radius: 999px;
  background: rgba(23, 50, 77, .94);
  color: white;
  box-shadow: 0 8px 22px rgba(15, 23, 42, .18);
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: .04em;
  text-transform: uppercase;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}

@media (max-width: 767px) {
  .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] {
    display: block !important;
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 0 !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    align-items: start !important;
  }

  .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] > button[data-gdp-selected="true"] {
    display: grid !important;
    grid-template-columns: 88px minmax(0, 1fr) !important;
    width: 100% !important;
    max-width: none !important;
    min-height: 88px !important;
    align-items: stretch !important;
    box-shadow: 0 10px 24px rgba(25, 22, 18, .08);
  }

  .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] > button[data-gdp-selected="true"] > div:first-child {
    width: 88px !important;
    height: 88px !important;
    min-height: 88px !important;
    aspect-ratio: auto !important;
  }

  .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] > button[data-gdp-selected="true"] > div:first-child img {
    padding: 3px !important;
  }

  .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] > button[data-gdp-selected="true"] > div:nth-child(2) {
    min-width: 0;
    justify-content: center;
    padding: 10px 12px !important;
  }

  .gdp-garment-choice-grid[data-gdp-mode="focused"] > button[data-gdp-selected="true"]::after {
    content: "Change garment";
    top: 7px;
    right: 7px;
    min-height: 26px;
    max-width: calc(100% - 102px);
    padding: 5px 7px;
    border-color: rgba(23, 50, 77, .14);
    background: rgba(255, 255, 255, .94);
    color: #17324D;
    box-shadow: 0 6px 16px rgba(15, 23, 42, .10);
    font-size: 8px;
    letter-spacing: .035em;
  }

  .gdp-garment-choice-grid[data-gdp-mode="focused"][data-gdp-settled="true"] + div {
    margin-top: 18px !important;
  }

  #custom-studio-workspace .gdp-garment-choice-grid + div button,
  #custom-studio-workspace .gdp-garment-choice-grid ~ div.grid button {
    min-height: 44px;
  }

  .gdp-studio-step-nav[data-gdp-step-nav="desktop"] {
    display: none !important;
  }

  .gdp-studio-step-nav[data-gdp-step-nav="mobile"] {
    position: fixed !important;
    left: 12px;
    right: 12px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
    z-index: 110;
    width: auto;
    max-width: 430px;
    margin: 0 auto !important;
    border-color: rgba(220, 227, 234, .92) !important;
    border-radius: 16px !important;
    background: rgba(255, 255, 255, .96) !important;
    padding: 8px !important;
    box-shadow: 0 18px 44px rgba(15, 23, 42, .18) !important;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .gdp-studio-step-nav[data-gdp-step-nav="mobile"] > div:first-child {
    gap: 8px;
  }

  .gdp-studio-step-nav[data-gdp-step-nav="mobile"] button {
    min-height: 46px !important;
    flex: 1 1 0;
    justify-content: center;
    padding-inline: 12px !important;
  }

  .gdp-studio-step-nav[data-gdp-step-nav="mobile"] p {
    margin-top: 5px !important;
    text-align: center;
    font-size: 10px;
    line-height: 1.3;
  }

  .gdp-studio-active main {
    padding-bottom: calc(6.75rem + env(safe-area-inset-bottom, 0px));
  }

  .gdp-studio-active main .fixed.inset-x-3.bottom-3 {
    display: none !important;
  }
}

@media (min-width: 1024px) {
  .gdp-garment-choice-grid[data-gdp-mode="focused"] > button[data-gdp-selected="true"] {
    box-shadow: 0 14px 34px rgba(25, 22, 18, .10);
  }

  .gdp-garment-choice-grid[data-gdp-mode="focused"] > button[data-gdp-selected="true"]::after {
    top: 12px;
    right: 12px;
    min-height: 30px;
    max-width: calc(100% - 24px);
    padding: 7px 10px;
    font-size: 10px;
    letter-spacing: .045em;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gdp-garment-choice-grid > button {
    transition-duration: 1ms !important;
  }
}
`;

export default function DesktopGarmentSelectionFocus() {
  const location = useLocation();

  useEffect(() => {
    const isStudioRoute = location.pathname === "/custom-studio" || location.pathname === "/design";
    if (!isStudioRoute || typeof window === "undefined" || typeof document === "undefined") return undefined;

    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    let currentGrid = null;
    let settleTimer = 0;
    let syncFrame = 0;

    const moveDuration = () => (reducedMotionMedia.matches ? 1 : MOVE_MS);
    const fadeDuration = () => (reducedMotionMedia.matches ? 1 : FADE_MS);

    const cancelSettle = () => {
      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = 0;
    };

    const cancelSync = () => {
      if (syncFrame) window.cancelAnimationFrame(syncFrame);
      syncFrame = 0;
    };

    const scheduleColorSync = () => {
      cancelSync();
      syncFrame = window.requestAnimationFrame(() => {
        syncFrame = window.requestAnimationFrame(() => {
          syncFrame = 0;
          if (!currentGrid?.isConnected) return;
          syncSelectedColorPreview(currentGrid, reducedMotionMedia.matches);
        });
      });
    };

    const prepareGrid = (grid) => {
      if (!grid || grid === currentGrid) return;
      if (currentGrid) clearEnhancement(currentGrid);
      cancelSettle();
      cancelSync();
      currentGrid = grid;
      currentGrid.classList.add("gdp-garment-choice-grid");
      currentGrid.dataset.gdpMode = "expanded";
      currentGrid.dataset.gdpSettled = "false";

      const active = activeGarmentButton(currentGrid);
      if (active) markSelected(currentGrid, active);
    };

    const discoverGrid = () => {
      const nextGrid = findGarmentGrid();
      if (!nextGrid) {
        if (currentGrid && !currentGrid.isConnected) {
          clearEnhancement(currentGrid);
          currentGrid = null;
          cancelSettle();
          cancelSync();
        }
        return;
      }
      prepareGrid(nextGrid);
    };

    const focusSelection = (grid, selectedButton) => {
      if (!grid || !selectedButton) return;
      cancelSettle();
      markSelected(grid, selectedButton);
      grid.dataset.gdpMode = "focused";
      grid.dataset.gdpSettled = "false";
      scheduleColorSync();

      settleTimer = window.setTimeout(() => {
        if (!grid.isConnected || grid.dataset.gdpMode !== "focused") return;
        const selected = garmentButtons(grid).find((button) => button.dataset.gdpSelected === "true");
        if (!selected) return;
        const before = selected.getBoundingClientRect();
        grid.dataset.gdpSettled = "true";
        window.requestAnimationFrame(() => animateMove(selected, before, moveDuration()));
        scheduleColorSync();
      }, fadeDuration());
    };

    const expandChoices = (grid, selectedButton) => {
      if (!grid) return;
      cancelSettle();
      cancelSync();
      const selected = selectedButton || garmentButtons(grid).find((button) => button.dataset.gdpSelected === "true");
      const before = selected?.getBoundingClientRect?.() || null;
      if (selected) clearColorPreview(selected);

      // Restore the original grid slots while the other cards are still
      // transparent, then fade them back in. This preserves exact React order.
      grid.dataset.gdpSettled = "false";
      window.requestAnimationFrame(() => {
        if (selected && before) animateMove(selected, before, moveDuration());
        window.requestAnimationFrame(() => {
          if (!grid.isConnected) return;
          grid.dataset.gdpMode = "expanded";
          if (selected) {
            restoreTitle(selected);
            saveTitle(selected);
            selected.setAttribute("title", "Select this garment");
          }
        });
      });
    };

    const handleGridClick = (event) => {
      discoverGrid();
      const grid = currentGrid;
      if (!grid) return;

      const clicked = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(clicked instanceof HTMLButtonElement) || clicked.parentElement !== grid) {
        if (grid.dataset.gdpMode === "focused") scheduleColorSync();
        return;
      }

      const isSelected = clicked.dataset.gdpSelected === "true" || clicked.classList.contains("border-accent");
      if (grid.dataset.gdpMode === "focused" && isSelected) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        expandChoices(grid, clicked);
        return;
      }

      // Let Custom Studio run its existing garment/variant state logic first.
      // This enhancer only changes presentation after React has selected it.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!grid.isConnected) return;
          const active = activeGarmentButton(grid) || clicked;
          focusSelection(grid, active);
        });
      });
    };

    discoverGrid();
    const observer = new MutationObserver((mutations) => {
      discoverGrid();
      if (
        currentGrid?.dataset.gdpMode === "focused" &&
        mutations.some((mutation) => mutation.type === "childList" || (mutation.type === "attributes" && mutation.attributeName === "src"))
      ) {
        scheduleColorSync();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    document.addEventListener("click", handleGridClick, true);

    return () => {
      cancelSettle();
      cancelSync();
      observer.disconnect();
      document.removeEventListener("click", handleGridClick, true);
      if (currentGrid) clearEnhancement(currentGrid);
    };
  }, [location.pathname]);

  return <style>{GARMENT_FOCUS_STYLES}</style>;
}
