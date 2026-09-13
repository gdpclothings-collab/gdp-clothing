import React, { useEffect, useRef } from "react";
import CustomStudioDesktopWorkspaceV7 from "@/pages/CustomStudioDesktopWorkspaceV7";

const DESKTOP_BREAKPOINT = 1280;
const FALLBACK_DELAY_MS = 90;
const MAX_POINTER_TRAVEL_PX = 14;

const interactionStyles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] #custom-studio-workspace {
    position: relative !important;
    z-index: 80 !important;
    isolation: isolate;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] {
    position: relative !important;
    z-index: 81 !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button {
    position: relative !important;
    z-index: 82 !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-aside] {
    position: relative !important;
    z-index: 1 !important;
  }
}
`;

function isVisibleButton(node) {
  if (!(node instanceof HTMLButtonElement)) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

function garmentGrid(root) {
  const annotated = root?.querySelector("[data-garment-grid]");
  if (annotated) return annotated;

  const workspace = root?.querySelector("#custom-studio-workspace");
  const stepRoot = workspace?.firstElementChild;
  if (!stepRoot) return null;

  return Array.from(stepRoot.children || []).find((node) => {
    if (!(node instanceof HTMLElement) || !node.classList.contains("grid")) return false;
    return Array.from(node.children || []).some((child) => {
      return child instanceof HTMLButtonElement && Boolean(child.querySelector(".font-bold.leading-tight"));
    });
  }) || null;
}

function garmentCards(grid) {
  if (!grid) return [];
  return Array.from(grid.children || []).filter((node) => {
    return node instanceof HTMLButtonElement && Boolean(node.querySelector(".font-bold.leading-tight"));
  });
}

function cardAtPoint(grid, clientX, clientY) {
  return garmentCards(grid).find((button) => {
    if (!isVisibleButton(button)) return false;
    const rect = button.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }) || null;
}

function isSelected(card) {
  return Boolean(card?.classList?.contains("border-accent"));
}

export default function CustomStudioDesktopWorkspaceV8() {
  const hostRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const host = hostRef.current;
    if (!host) return undefined;

    const desktop = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    let pendingPointer = null;
    let fallbackTimer = 0;

    const currentShell = () => host.querySelector(".gdp-custom-studio-v7");

    const onPointerDown = (event) => {
      if (!desktop.matches || event.button !== 0) return;
      const shell = currentShell();
      if (!shell || shell.dataset.step !== "1") return;

      const grid = garmentGrid(shell);
      const card = cardAtPoint(grid, event.clientX, event.clientY);
      if (!card) return;

      pendingPointer = {
        pointerId: event.pointerId,
        card,
        grid,
        x: event.clientX,
        y: event.clientY,
        selectedBefore: isSelected(card),
        collapsedBefore: grid?.dataset?.gdpCollapsed === "true",
      };
    };

    const onPointerUp = (event) => {
      const pending = pendingPointer;
      pendingPointer = null;
      if (!pending || pending.pointerId !== event.pointerId) return;

      const distance = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
      if (distance > MAX_POINTER_TRAVEL_PX) return;

      const releaseCard = cardAtPoint(pending.grid, event.clientX, event.clientY);
      if (releaseCard !== pending.card) return;

      window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(() => {
        const shell = currentShell();
        if (!shell || shell.dataset.step !== "1" || !pending.card.isConnected) return;

        // Normal React onClick remains the primary path. Only recover when the
        // pointer completed over a garment card but the selected state did not
        // change after the browser had time to dispatch the native click.
        if (!pending.selectedBefore && !isSelected(pending.card)) {
          pending.card.click();
          return;
        }

        // A selected/collapsed card should reopen the garment choices when the
        // customer clicks it. Recover that presentation action if a covering
        // layer swallowed the native click before V7 could expand the grid.
        if (
          pending.selectedBefore &&
          pending.collapsedBefore &&
          pending.grid.isConnected &&
          pending.grid.dataset.gdpCollapsed === "true"
        ) {
          pending.grid.dataset.gdpUserExpanded = "true";
          pending.grid.dataset.gdpCollapsed = "false";
        }
      }, FALLBACK_DELAY_MS);
    };

    const clearPending = () => {
      pendingPointer = null;
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", clearPending, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", clearPending, true);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <div ref={hostRef} className="gdp-custom-studio-v8">
      <style>{interactionStyles}</style>
      <CustomStudioDesktopWorkspaceV7 />
    </div>
  );
}
