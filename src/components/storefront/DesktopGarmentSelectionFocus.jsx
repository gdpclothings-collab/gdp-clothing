import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const DESKTOP_QUERY = "(min-width: 1024px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const GARMENT_GRID_SELECTOR = '#custom-studio-workspace div[class~="sm:grid-cols-2"][class~="xl:grid-cols-3"]';
const FADE_MS = 420;
const MOVE_MS = 320;

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

const DESKTOP_GARMENT_FOCUS_STYLES = `
@media (min-width: 1024px) {
  .gdp-garment-choice-grid > button {
    transform-origin: center;
    transition:
      opacity 420ms cubic-bezier(.22,.8,.24,1),
      transform 420ms cubic-bezier(.22,.8,.24,1),
      filter 420ms cubic-bezier(.22,.8,.24,1),
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
    box-shadow: 0 14px 34px rgba(25, 22, 18, .10);
  }

  .gdp-garment-choice-grid[data-gdp-mode="focused"] > button[data-gdp-selected="true"]::after {
    content: "Selected · Change garment";
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 4;
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    max-width: calc(100% - 24px);
    padding: 7px 10px;
    border: 1px solid rgba(255, 255, 255, .75);
    border-radius: 999px;
    background: rgba(23, 50, 77, .94);
    color: white;
    box-shadow: 0 8px 22px rgba(15, 23, 42, .18);
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: .045em;
    text-transform: uppercase;
    white-space: nowrap;
    backdrop-filter: blur(8px);
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

    const desktopMedia = window.matchMedia(DESKTOP_QUERY);
    const reducedMotionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    let currentGrid = null;
    let settleTimer = 0;

    const moveDuration = () => (reducedMotionMedia.matches ? 1 : MOVE_MS);
    const fadeDuration = () => (reducedMotionMedia.matches ? 1 : FADE_MS);

    const cancelSettle = () => {
      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = 0;
    };

    const prepareGrid = (grid) => {
      if (!grid || grid === currentGrid) return;
      if (currentGrid) clearEnhancement(currentGrid);
      cancelSettle();
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
        }
        return;
      }
      prepareGrid(nextGrid);
    };

    const focusSelection = (grid, selectedButton) => {
      if (!grid || !selectedButton || !desktopMedia.matches) return;
      cancelSettle();
      markSelected(grid, selectedButton);
      grid.dataset.gdpMode = "focused";
      grid.dataset.gdpSettled = "false";

      settleTimer = window.setTimeout(() => {
        if (!grid.isConnected || grid.dataset.gdpMode !== "focused") return;
        const selected = garmentButtons(grid).find((button) => button.dataset.gdpSelected === "true");
        if (!selected) return;
        const before = selected.getBoundingClientRect();
        grid.dataset.gdpSettled = "true";
        window.requestAnimationFrame(() => animateMove(selected, before, moveDuration()));
      }, fadeDuration());
    };

    const expandChoices = (grid, selectedButton) => {
      if (!grid) return;
      cancelSettle();
      const selected = selectedButton || garmentButtons(grid).find((button) => button.dataset.gdpSelected === "true");
      const before = selected?.getBoundingClientRect?.() || null;

      // First restore the original grid slots while the other cards are still transparent.
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
      if (!grid || !desktopMedia.matches) return;

      const clicked = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(clicked instanceof HTMLButtonElement) || clicked.parentElement !== grid) return;

      const isSelected = clicked.dataset.gdpSelected === "true" || clicked.classList.contains("border-accent");
      if (grid.dataset.gdpMode === "focused" && isSelected) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        expandChoices(grid, clicked);
        return;
      }

      // Let Custom Studio run its existing product/variant logic first. Then only
      // change the desktop presentation state around the product React selected.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!grid.isConnected || !desktopMedia.matches) return;
          const active = activeGarmentButton(grid) || clicked;
          focusSelection(grid, active);
        });
      });
    };

    const handleViewportChange = () => {
      if (!currentGrid) return;
      cancelSettle();
      currentGrid.dataset.gdpMode = "expanded";
      currentGrid.dataset.gdpSettled = "false";
      if (!desktopMedia.matches) {
        garmentButtons(currentGrid).forEach((button) => restoreTitle(button));
      }
    };

    discoverGrid();
    const observer = new MutationObserver(discoverGrid);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleGridClick, true);
    desktopMedia.addEventListener?.("change", handleViewportChange);

    return () => {
      cancelSettle();
      observer.disconnect();
      document.removeEventListener("click", handleGridClick, true);
      desktopMedia.removeEventListener?.("change", handleViewportChange);
      if (currentGrid) clearEnhancement(currentGrid);
    };
  }, [location.pathname]);

  return <style>{DESKTOP_GARMENT_FOCUS_STYLES}</style>;
}
