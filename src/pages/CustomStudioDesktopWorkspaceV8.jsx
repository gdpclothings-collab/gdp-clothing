import React, { useEffect, useRef, useState } from "react";
import CustomStudioDesktopWorkspaceV7 from "@/pages/CustomStudioDesktopWorkspaceV7";

const DESKTOP_BREAKPOINT = 1280;
const FALLBACK_DELAY_MS = 90;
const MAX_POINTER_TRAVEL_PX = 14;
const STUDIO_STEPS = ["Garment", "Choose Design", "Customize", "Timing & Approval", "Review"];

const interactionStyles = `
.gdp-custom-studio-v8,
.gdp-custom-studio-v8 .gdp-v8-content {
  min-width: 0;
  width: 100%;
}

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

  /* Selected garment becomes a compact summary card instead of a small card
     floating in a large empty workspace. The existing React state stays intact. */
  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] {
    grid-template-columns: minmax(0, 1fr) !important;
    justify-content: stretch !important;
    justify-items: stretch !important;
    gap: 0 !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent {
    display: grid !important;
    grid-template-columns: 154px minmax(0, 1fr) !important;
    align-items: stretch !important;
    width: 100% !important;
    max-width: none !important;
    min-height: 142px !important;
    margin: 0 !important;
    border-color: #17324D !important;
    background: linear-gradient(135deg, #FFFFFF 0%, #F7FAFC 100%) !important;
    box-shadow: 0 12px 30px rgba(23, 50, 77, .09) !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :first-child {
    width: 154px !important;
    height: 142px !important;
    min-height: 142px !important;
    border-right: 1px solid #E4EAF0 !important;
    background: #F1F5F8 !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :last-child {
    display: flex !important;
    min-width: 0 !important;
    flex-direction: column !important;
    justify-content: center !important;
    padding: 18px 16px !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent::after {
    top: 10px !important;
    right: 10px !important;
    min-height: 24px !important;
    padding: 5px 8px !important;
    background: #17324D !important;
    font-size: 7.5px !important;
  }

  .gdp-custom-studio-v8 [data-gdp-selected-summary] {
    margin-top: 9px;
    padding-top: 9px;
    border-top: 1px solid #E4EAF0;
    color: #52616F;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: .025em;
    text-transform: none;
  }

  /* Keep Step 1 configuration visually grouped and reduce unnecessary vertical travel. */
  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-step1-color] {
    margin-top: 13px !important;
    padding-top: 13px !important;
    border-top: 1px solid #EDF1F4;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-step1-color] button {
    min-height: 38px !important;
    padding: 7px 10px !important;
    text-transform: capitalize;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-step1-size-quantity] {
    margin-top: 13px !important;
    gap: 12px !important;
    grid-template-columns: minmax(0, 1fr) minmax(142px, .38fr) !important;
    padding: 12px !important;
    border: 1px solid #E4EAF0;
    border-radius: 15px;
    background: #FAFCFD;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-step1-size] button.border-accent {
    border-color: #17324D !important;
    background: #17324D !important;
    color: #FFFFFF !important;
    box-shadow: 0 5px 14px rgba(23, 50, 77, .14) !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-step1-quantity] > div {
    min-height: 40px !important;
    border-color: #CFD8E1 !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-step1-group] {
    margin-top: 13px !important;
    padding-top: 13px !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-step1-group] button {
    color: #17324D !important;
  }

  /* The order guide remains available, but starts collapsed on desktop and
     reads as contextual help instead of permanent navigation duplication. */
  .gdp-custom-studio-v8 .gdp-custom-studio-v7 [data-guide] > button {
    min-height: 40px !important;
    border-color: #DCE3EA !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7 [data-guide] > button > span:first-child > span:last-child {
    display: inline !important;
    font-size: 10px !important;
    line-height: 1.2 !important;
    color: #607080 !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7 [data-guide] p,
  .gdp-custom-studio-v8 .gdp-custom-studio-v7 [data-guide] li {
    font-size: 10.5px !important;
    line-height: 1.4 !important;
  }

  /* Seasonal Design Lab keeps the global Custom Studio context instead of
     becoming a disconnected full-page experience. */
  .gdp-custom-studio-v8[data-seasonal-active="true"] {
    display: grid;
    grid-template-columns: 204px minmax(0, 1fr);
    align-items: start;
    gap: 14px;
    width: 100%;
    max-width: 1920px;
    margin: 0 auto;
    padding: 10px 18px 14px;
    background: linear-gradient(180deg, #F4F7FA 0%, #EDF2F6 45%, #F8FAFC 100%);
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] > .gdp-seasonal-shell-rail {
    grid-column: 1;
    position: sticky;
    top: 66px;
    z-index: 50;
    display: flex;
    max-height: calc(100dvh - 82px);
    flex-direction: column;
    gap: 8px;
    overflow: auto;
    border: 1px solid #DCE3EA;
    border-radius: 18px;
    background: rgba(255, 255, 255, .98);
    padding: 9px;
    box-shadow: 0 14px 36px rgba(23, 50, 77, .08);
    scrollbar-width: thin;
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] > .gdp-v8-content {
    grid-column: 2;
    min-width: 0;
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] .gdp-custom-studio-v7 > main {
    min-height: calc(100dvh - 82px) !important;
    padding: 0 !important;
    background: transparent !important;
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] .gdp-custom-studio-v7 > main > div {
    max-width: none !important;
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] .gdp-custom-studio-v7 > main > div > header {
    margin-bottom: 8px !important;
    border-radius: 18px !important;
    padding: 10px 14px !important;
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] .gdp-custom-studio-v7 > main > div > header h1 {
    margin-top: 2px !important;
    font-size: clamp(1.65rem, 2vw, 2.25rem) !important;
    line-height: 1 !important;
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] .gdp-custom-studio-v7 > main > div > header p:not(.font-mono),
  .gdp-custom-studio-v8[data-seasonal-active="true"] .gdp-custom-studio-v7 > main > div > header .rounded-full {
    display: none !important;
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] .gdp-custom-studio-v7 > main > div > .mb-6.grid.grid-cols-3 {
    margin-bottom: 9px !important;
    border-radius: 14px !important;
  }

  .gdp-custom-studio-v8[data-seasonal-active="true"] .gdp-custom-studio-v7 > main > div > .mb-6.grid.grid-cols-3 > div {
    padding-top: 7px !important;
    padding-bottom: 7px !important;
  }

  .gdp-seasonal-shell-rail__brand {
    padding: 8px 8px 10px;
    border-bottom: 1px solid #E7EDF2;
  }

  .gdp-seasonal-shell-rail__eyebrow {
    color: #A66331;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .16em;
    text-transform: uppercase;
  }

  .gdp-seasonal-shell-rail__title {
    margin-top: 4px;
    color: #17324D;
    font-size: 13px;
    font-weight: 900;
  }

  .gdp-seasonal-shell-step {
    display: flex;
    width: 100%;
    min-height: 43px;
    align-items: center;
    gap: 8px;
    border: 0;
    border-radius: 12px;
    padding: 8px 9px;
    background: transparent;
    color: #667788;
    text-align: left;
  }

  button.gdp-seasonal-shell-step:not(:disabled) {
    cursor: pointer;
  }

  button.gdp-seasonal-shell-step:not(:disabled):hover {
    background: #F4F7FA;
    color: #17324D;
  }

  .gdp-seasonal-shell-step[data-active="true"] {
    background: #17324D;
    color: #FFFFFF;
    box-shadow: 0 8px 18px rgba(23, 50, 77, .14);
  }

  .gdp-seasonal-shell-step[data-complete="true"] {
    color: #17324D;
  }

  .gdp-seasonal-shell-step__number {
    display: grid;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    place-items: center;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 900;
    opacity: .88;
  }

  .gdp-seasonal-shell-step__label {
    font-size: 9px;
    font-weight: 850;
    line-height: 1.15;
    letter-spacing: .035em;
    text-transform: uppercase;
  }

  .gdp-seasonal-shell-rail__note {
    margin-top: 3px;
    border-radius: 12px;
    background: #F5F8FA;
    padding: 9px;
    color: #607080;
    font-size: 9.5px;
    line-height: 1.4;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1500px) {
  .gdp-custom-studio-v8[data-seasonal-active="true"] {
    grid-template-columns: 188px minmax(0, 1fr);
    gap: 12px;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent {
    grid-template-columns: 138px minmax(0, 1fr) !important;
  }

  .gdp-custom-studio-v8 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :first-child {
    width: 138px !important;
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

function exactLabel(root, text) {
  return Array.from(root?.querySelectorAll("label") || []).find((label) => String(label.textContent || "").trim() === text) || null;
}

function selectedSize(sizeSection) {
  const selected = Array.from(sizeSection?.querySelectorAll("button") || []).find((button) => button.classList.contains("border-accent"));
  return String(selected?.textContent || "").trim();
}

function selectedQuantity(quantitySection) {
  const value = Array.from(quantitySection?.querySelectorAll("span") || []).find((span) => span.classList.contains("font-mono"));
  return String(value?.textContent || "").trim();
}

function findButtonByText(root, text) {
  return Array.from(root?.querySelectorAll("button") || []).find((button) => String(button.textContent || "").trim().includes(text)) || null;
}

export default function CustomStudioDesktopWorkspaceV8() {
  const hostRef = useRef(null);
  const [seasonalActive, setSeasonalActive] = useState(false);

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

        if (!pending.selectedBefore && !isSelected(pending.card)) {
          pending.card.click();
          return;
        }

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const host = hostRef.current;
    if (!host) return undefined;

    const desktop = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    let frame = 0;
    let cancelled = false;

    const schedule = () => {
      if (cancelled || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        refine();
      });
    };

    const refineStepOne = (shell) => {
      if (!desktop.matches || shell?.dataset?.step !== "1") return;
      const workspace = shell.querySelector("[data-workspace]") || shell.querySelector("#custom-studio-workspace");
      if (!workspace) return;

      const colorLabel = exactLabel(workspace, "Color");
      const sizeLabel = exactLabel(workspace, "Size");
      const quantityLabel = exactLabel(workspace, "Quantity");
      const colorSection = colorLabel?.parentElement?.parentElement || null;
      const sizeSection = sizeLabel?.parentElement || null;
      const quantitySection = quantityLabel?.parentElement || null;
      const sizeQuantityRow = sizeSection?.parentElement || null;

      colorSection?.setAttribute("data-step1-color", "true");
      sizeSection?.setAttribute("data-step1-size", "true");
      quantitySection?.setAttribute("data-step1-quantity", "true");
      if (sizeQuantityRow && quantitySection?.parentElement === sizeQuantityRow) {
        sizeQuantityRow.setAttribute("data-step1-size-quantity", "true");
      }

      const grid = garmentGrid(shell);
      const selected = garmentCards(grid).find(isSelected);
      if (!selected) return;

      const colorValue = String(colorLabel?.parentElement?.querySelector("span")?.textContent || "").trim();
      const sizeValue = selectedSize(sizeSection);
      const quantityValue = selectedQuantity(quantitySection);
      const body = selected.lastElementChild;
      if (body) {
        let summary = body.querySelector("[data-gdp-selected-summary]");
        if (!summary) {
          summary = document.createElement("div");
          summary.setAttribute("data-gdp-selected-summary", "true");
          body.appendChild(summary);
        }
        const nextText = [colorValue, sizeValue || "Choose size", quantityValue ? `Qty ${quantityValue}` : ""].filter(Boolean).join(" · ");
        if (summary.textContent !== nextText) summary.textContent = nextText;
      }

      // Keep the selected summary thumbnail synchronized with the live garment
      // preview whenever a color-specific mockup is available.
      const previewImage = shell.querySelector('[data-preview-card] img[alt*="mockup"]');
      const cardImage = selected.querySelector(":scope > div:first-child img");
      if (previewImage instanceof HTMLImageElement && cardImage instanceof HTMLImageElement && previewImage.currentSrc) {
        const nextSrc = previewImage.currentSrc || previewImage.src;
        if (nextSrc && cardImage.src !== nextSrc) cardImage.src = nextSrc;
      }
    };

    const refineGuide = (shell) => {
      if (!desktop.matches) return;
      const guide = shell?.querySelector("[data-guide]");
      const button = guide?.querySelector(":scope > button");
      if (!guide || !(button instanceof HTMLButtonElement)) return;
      if (guide.dataset.gdpDesktopInitialized === "true") return;
      guide.dataset.gdpDesktopInitialized = "true";
      if (button.getAttribute("aria-expanded") === "true") button.click();
    };

    const refineSeasonal = (shell) => {
      const seasonalHeading = Array.from(shell?.querySelectorAll("h1") || []).find((heading) => String(heading.textContent || "").trim() === "SEASONAL DESIGN LAB");
      const active = Boolean(desktop.matches && seasonalHeading);
      host.dataset.seasonalActive = active ? "true" : "false";
      setSeasonalActive((current) => current === active ? current : active);

      if (!active) {
        delete host.dataset.seasonalFitApplied;
        return;
      }

      // Default the seasonal garment to Fit when the editor is still on its
      // legacy 118% default. User-selected or restored zoom values are preserved.
      if (host.dataset.seasonalFitApplied !== "true") {
        const zoomText = Array.from(shell.querySelectorAll("span")).find((span) => String(span.textContent || "").trim() === "118%");
        const fitButton = Array.from(shell.querySelectorAll("button")).find((button) => String(button.textContent || "").trim() === "Fit");
        if (zoomText && fitButton instanceof HTMLButtonElement) {
          host.dataset.seasonalFitApplied = "true";
          fitButton.click();
        }
      }
    };

    const refine = () => {
      if (cancelled) return;
      const shell = host.querySelector(".gdp-custom-studio-v7");
      if (!shell) return;
      refineStepOne(shell);
      refineGuide(shell);
      refineSeasonal(shell);
    };

    refine();
    const observer = new MutationObserver(schedule);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "src", "aria-expanded", "data-step", "data-gdp-collapsed"],
    });
    window.addEventListener("resize", schedule);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const leaveSeasonalForStep = (targetStep) => {
    const host = hostRef.current;
    if (!host) return;
    const shell = host.querySelector(".gdp-custom-studio-v7");
    const backButton = findButtonByText(shell, "Design options");
    if (!(backButton instanceof HTMLButtonElement)) return;
    backButton.click();

    if (targetStep !== 2) return;
    let attempts = 0;
    const advance = () => {
      attempts += 1;
      const continueButton = findButtonByText(host, "Continue to Choose Design");
      if (continueButton instanceof HTMLButtonElement && !continueButton.disabled) {
        continueButton.click();
        return;
      }
      if (attempts < 18) window.setTimeout(advance, 25);
    };
    window.requestAnimationFrame(advance);
  };

  return (
    <div ref={hostRef} className="gdp-custom-studio-v8" data-seasonal-active={seasonalActive ? "true" : "false"}>
      <style>{interactionStyles}</style>
      {seasonalActive && (
        <aside className="gdp-seasonal-shell-rail" aria-label="Custom Studio steps">
          <div className="gdp-seasonal-shell-rail__brand">
            <div className="gdp-seasonal-shell-rail__eyebrow">GDP Custom Studio</div>
            <div className="gdp-seasonal-shell-rail__title">Seasonal Design</div>
          </div>
          {STUDIO_STEPS.map((label, index) => {
            const step = index + 1;
            const active = step === 3;
            const complete = step < 3;
            const enabled = step < 3;
            return (
              <button
                key={label}
                type="button"
                className="gdp-seasonal-shell-step"
                data-active={active ? "true" : "false"}
                data-complete={complete ? "true" : "false"}
                disabled={!enabled}
                aria-current={active ? "step" : undefined}
                onClick={() => enabled && leaveSeasonalForStep(step)}
              >
                <span className="gdp-seasonal-shell-step__number">{complete ? "✓" : step}</span>
                <span className="gdp-seasonal-shell-step__label">{label}</span>
              </button>
            );
          })}
          <div className="gdp-seasonal-shell-rail__note">
            <strong>Customize is active.</strong><br />Browse artwork, edit layers and review inside this workspace. Use Garment or Choose Design above to go back without losing the selected blank.
          </div>
        </aside>
      )}
      <div className="gdp-v8-content">
        <CustomStudioDesktopWorkspaceV7 />
      </div>
    </div>
  );
}
