import React, { useEffect, useRef } from "react";
import CustomStudio from "@/pages/CustomStudio";

const DESKTOP_BREAKPOINT = 1280;

const styles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-v7 {
    --gdp-rail: 204px;
    --gdp-config: 462px;
    --gdp-gap: 14px;
  }

  .gdp-custom-studio-v7 [data-studio-container] {
    display: grid !important;
    grid-template-columns: var(--gdp-rail) minmax(0, 1fr) !important;
    grid-template-areas: "hero hero" "rail work" !important;
    column-gap: var(--gdp-gap) !important;
    row-gap: 9px !important;
    width: 100% !important;
    max-width: 1920px !important;
    margin: 0 auto !important;
    padding: 9px 18px 14px !important;
  }

  .gdp-custom-studio-v7 [data-studio-hero] {
    grid-area: hero !important;
    min-height: 46px !important;
    margin: 0 !important;
    padding: 8px 14px !important;
    border-radius: 16px !important;
  }

  .gdp-custom-studio-v7 [data-studio-hero] h1 {
    margin-top: 1px !important;
    font-size: clamp(1.3rem, 1.6vw, 1.72rem) !important;
    line-height: 1 !important;
  }

  .gdp-custom-studio-v7 [data-studio-hero] p,
  .gdp-custom-studio-v7[data-step="1"] [data-studio-hero] > div > div:last-child {
    display: none !important;
  }

  .gdp-custom-studio-v7 [data-studio-rail] {
    grid-area: rail !important;
    position: sticky !important;
    top: 66px !important;
    z-index: 40 !important;
    align-self: stretch !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    height: calc(100dvh - 142px) !important;
    min-height: 540px !important;
    max-height: calc(100dvh - 142px) !important;
    margin: 0 !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    scrollbar-width: thin;
  }

  .gdp-custom-studio-v7 [data-mobile-progress] {
    display: none !important;
  }

  .gdp-custom-studio-v7 [data-stepper] {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0 !important;
    flex: 0 0 auto !important;
    overflow: visible !important;
    padding: 7px !important;
    border-radius: 16px !important;
    background: rgba(255, 255, 255, .98) !important;
    box-shadow: 0 10px 28px rgba(23, 50, 77, .06) !important;
  }

  .gdp-custom-studio-v7 [data-stepper] > button {
    width: 100% !important;
    min-height: 43px !important;
    justify-content: flex-start !important;
    padding: 8px 9px !important;
    white-space: normal !important;
    text-align: left !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v7 [data-stepper] > button > span:last-child {
    font-size: 9.5px !important;
    line-height: 1.15 !important;
  }

  .gdp-custom-studio-v7 [data-stepper] > div {
    width: 1px !important;
    min-width: 0 !important;
    height: 7px !important;
    flex: 0 0 7px !important;
    margin-left: 19px !important;
  }

  /* The order guide is an inline rail accordion on desktop. It never floats over controls. */
  .gdp-custom-studio-v7 [data-guide] {
    position: relative !important;
    flex: 0 0 auto !important;
    margin: 2px 0 0 !important;
    overflow: visible !important;
  }

  .gdp-custom-studio-v7 [data-guide] > button {
    width: 100% !important;
    min-height: 42px !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v7 [data-guide] > button > span:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-v7 [data-guide] > div {
    position: static !important;
    inset: auto !important;
    z-index: auto !important;
    width: 100% !important;
    max-width: 100% !important;
    max-height: 290px !important;
    margin-top: 7px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    border: 1px solid #DCE3EA !important;
    border-radius: 14px !important;
    background: #FFFFFF !important;
    box-shadow: none !important;
    transform: none !important;
  }

  .gdp-custom-studio-v7 [data-guide] > div > div:first-child > div {
    grid-template-columns: 1fr !important;
  }

  .gdp-custom-studio-v7 [data-guide] h2,
  .gdp-custom-studio-v7 [data-guide] h3 {
    font-size: 11px !important;
    line-height: 1.25 !important;
  }

  .gdp-custom-studio-v7 [data-guide] p,
  .gdp-custom-studio-v7 [data-guide] li {
    font-size: 9.5px !important;
    line-height: 1.35 !important;
  }

  .gdp-custom-studio-v7 [data-actions] {
    position: relative !important;
    z-index: 45 !important;
    flex: 0 0 auto !important;
    margin: 0 !important;
  }

  .gdp-custom-studio-v7 [data-actions] [data-gdp-step-nav="desktop"] {
    padding: 7px !important;
    border-radius: 15px !important;
    background: rgba(255, 255, 255, .99) !important;
    box-shadow: 0 10px 28px rgba(23, 50, 77, .06) !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v7 [data-actions] [data-gdp-step-nav="desktop"] > div:first-child {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }

  .gdp-custom-studio-v7 [data-actions] [data-gdp-step-nav="desktop"] button {
    width: 100% !important;
    justify-content: center !important;
    pointer-events: auto !important;
    position: relative !important;
    z-index: 2 !important;
  }

  .gdp-custom-studio-v7 [data-actions] [data-gdp-step-nav="desktop"] > p {
    margin-top: 6px !important;
    border-radius: 9px !important;
    background: #FFF7ED !important;
    padding: 7px 8px !important;
    text-align: left !important;
    line-height: 1.3 !important;
  }

  .gdp-custom-studio-v7 [data-studio-row] {
    grid-area: work !important;
    display: grid !important;
    grid-template-columns: var(--gdp-config) minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) !important;
    gap: var(--gdp-gap) !important;
    width: 100% !important;
    min-width: 0 !important;
    height: calc(100dvh - 142px) !important;
    min-height: 540px !important;
    max-height: calc(100dvh - 142px) !important;
    overflow: hidden !important;
  }

  .gdp-custom-studio-v7 [data-workspace] {
    grid-column: 1 !important;
    grid-row: 1 !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow-x: clip !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    padding: 15px !important;
    border-radius: 20px !important;
    scrollbar-width: thin;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v7 [data-aside] {
    grid-column: 2 !important;
    grid-row: 1 !important;
    position: relative !important;
    top: auto !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow: hidden !important;
    padding: 0 !important;
    gap: 0 !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v7 [data-aside] > .lg\\:hidden {
    display: none !important;
  }

  .gdp-custom-studio-v7 [data-preview-card] {
    position: relative !important;
    top: auto !important;
    display: flex !important;
    flex: 1 1 auto !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    border-radius: 22px !important;
    box-shadow: 0 20px 56px rgba(23, 50, 77, .10) !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v7 [data-preview-card] > :first-child {
    position: relative !important;
    z-index: 30 !important;
    flex: 0 0 auto !important;
    padding: 9px 12px !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v7 [data-preview-card] > :first-child button {
    position: relative !important;
    z-index: 35 !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v7 [data-preview-card] > :nth-child(2) {
    flex: 1 1 auto !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
  }

  .gdp-custom-studio-v7:not([data-step="5"]) [data-order-card] {
    display: none !important;
  }

  /* STEP 1: compact choices, stable center card, full live preview. */
  .gdp-custom-studio-v7[data-step="1"] [data-workspace] > div > :first-child {
    margin-bottom: 14px !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-workspace] > div > :first-child h2 {
    font-size: 1.75rem !important;
    line-height: 1.05 !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
    align-items: start !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button {
    min-width: 0 !important;
    width: 100% !important;
    border-radius: 14px !important;
    transform: none !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :first-child {
    height: 116px !important;
    min-height: 116px !important;
    aspect-ratio: auto !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :last-child {
    padding: 9px 10px !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :last-child .font-bold {
    font-size: 12px !important;
    line-height: 1.15 !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] {
    grid-template-columns: minmax(0, 216px) !important;
    justify-content: center !important;
    justify-items: center !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button:not(.border-accent) {
    display: none !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent {
    width: 216px !important;
    max-width: 216px !important;
    margin-inline: auto !important;
    transform: none !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent::after {
    content: "Selected · Click to change";
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 6;
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 5px 7px;
    border-radius: 999px;
    background: rgba(23, 50, 77, .94);
    color: #fff;
    box-shadow: 0 6px 16px rgba(15, 23, 42, .12);
    font-size: 8px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: .035em;
    text-transform: uppercase;
    pointer-events: none;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-step1-group] {
    margin-top: 16px !important;
    padding-top: 12px !important;
    border-top: 1px solid #E7EBEF !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-step1-group] > p {
    display: none !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-step1-group] .font-bold {
    font-size: 12px !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-step1-group] button {
    min-height: 38px !important;
    pointer-events: auto !important;
  }

  /* There is one Continue path on desktop: the persistent rail action. */
  .gdp-custom-studio-v7[data-step="1"] [data-step1-complete] {
    display: none !important;
  }

  /* Keep the live garment centered and comfortably large; never shrink it after selection. */
  .gdp-custom-studio-v7[data-step="1"] [data-preview-card] > :nth-child(2) {
    min-height: 440px !important;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-preview-card] > :nth-child(2) > div.absolute.inset-0.grid.place-items-center > div.relative {
    height: 84% !important;
    max-width: 84% !important;
    margin: auto !important;
  }

  .gdp-custom-studio-v7 [data-empty-pending="true"] {
    visibility: hidden !important;
  }

  /* Preserve the existing Customize editor layout without touching editor state. */
  .gdp-custom-studio-v7[data-step="3"] [data-studio-row] {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .gdp-custom-studio-v7[data-step="3"] [data-workspace] {
    display: none !important;
  }

  .gdp-custom-studio-v7[data-step="3"] [data-aside] {
    grid-column: 1 !important;
    display: block !important;
  }

  .gdp-custom-studio-v7[data-step="3"] [data-preview-card] {
    display: grid !important;
    grid-template-columns: minmax(360px, .70fr) minmax(620px, 1.30fr) !important;
    grid-template-rows: auto minmax(0, 1fr) !important;
    height: 100% !important;
  }

  .gdp-custom-studio-v7[data-step="3"] [data-preview-card] > :first-child {
    grid-column: 1 / -1 !important;
    grid-row: 1 !important;
  }

  .gdp-custom-studio-v7[data-step="3"] [data-preview-card] > :nth-child(2) {
    grid-column: 2 !important;
    grid-row: 2 !important;
    height: 100% !important;
    border-left: 1px solid #E5EAF0 !important;
  }

  .gdp-custom-studio-v7[data-step="3"] [data-preview-card] > :nth-child(3) {
    grid-column: 1 !important;
    grid-row: 2 !important;
    min-height: 0 !important;
    height: 100% !important;
    overflow-y: auto !important;
    border-top: 0 !important;
    border-right: 1px solid #E5EAF0 !important;
    padding: 12px !important;
  }

  .gdp-custom-studio-v7[data-step="5"] [data-aside] {
    gap: 10px !important;
  }

  .gdp-custom-studio-v7[data-step="5"] [data-order-card] {
    display: block !important;
    flex: 0 0 auto !important;
    max-height: 180px !important;
    overflow: auto !important;
    margin: 0 !important;
    padding: 12px 14px !important;
    border-radius: 17px !important;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1500px) {
  .gdp-custom-studio-v7 {
    --gdp-rail: 188px;
    --gdp-config: 438px;
    --gdp-gap: 12px;
  }

  .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :first-child {
    height: 108px !important;
    min-height: 108px !important;
  }
}
`;

function getStep(stepper) {
  if (!stepper) return 1;
  const buttons = Array.from(stepper.children).filter((node) => node?.tagName === "BUTTON");
  const index = buttons.findIndex((button) => String(button.className || "").includes("bg-[#17324D]"));
  return index >= 0 ? index + 1 : 1;
}

function mark(node, attribute) {
  if (node) node.setAttribute(attribute, "true");
}

function directChildContaining(root, text) {
  if (!root) return null;
  return Array.from(root.children || []).find((node) => String(node?.textContent || "").includes(text)) || null;
}

function descendantContaining(root, text) {
  if (!root) return null;
  return Array.from(root.querySelectorAll("div,section,p")).find((node) => String(node?.textContent || "").trim() === text) || null;
}

function garmentButtons(grid) {
  if (!grid) return [];
  return Array.from(grid.children || []).filter((node) => node?.tagName === "BUTTON");
}

function selectedGarmentButton(grid) {
  return garmentButtons(grid).find((button) => button.classList.contains("border-accent")) || null;
}

export default function CustomStudioDesktopWorkspaceV7() {
  const shellRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof window === "undefined") return undefined;

    let cancelled = false;
    let frame = 0;
    let observer = null;
    let emptyTimer = 0;
    let stepper = null;
    let workspace = null;
    let garmentGrid = null;

    const schedule = () => {
      if (cancelled || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        annotate();
      });
    };

    const annotate = () => {
      if (cancelled) return;

      workspace = shell.querySelector("#custom-studio-workspace");
      const row = workspace?.parentElement;
      const container = row?.parentElement;
      const aside = row?.querySelector(":scope > aside");
      const previewCard = aside?.querySelector(":scope > [data-gdp-design-path]");
      const orderCard = previewCard?.nextElementSibling;
      const actionNav = shell.querySelector('[data-gdp-step-nav="desktop"]');
      const actions = actionNav?.parentElement;
      const rail = actions?.parentElement;
      const mobileProgress = rail?.children?.[0];
      stepper = rail?.children?.[1];
      const guide = rail?.children?.[2];
      const hero = container?.firstElementChild;

      if (!workspace || !row || !container || !aside || !stepper) {
        schedule();
        return;
      }

      mark(container, "data-studio-container");
      mark(hero, "data-studio-hero");
      mark(rail, "data-studio-rail");
      mark(mobileProgress, "data-mobile-progress");
      mark(stepper, "data-stepper");
      mark(guide, "data-guide");
      mark(actions, "data-actions");
      mark(row, "data-studio-row");
      mark(workspace, "data-workspace");
      mark(aside, "data-aside");
      mark(previewCard, "data-preview-card");
      mark(orderCard, "data-order-card");

      const step = getStep(stepper);
      shell.dataset.step = String(step);

      shell.querySelectorAll("[data-garment-grid],[data-step1-group],[data-step1-complete]").forEach((node) => {
        node.removeAttribute("data-garment-grid");
        node.removeAttribute("data-step1-group");
        node.removeAttribute("data-step1-complete");
      });

      if (step === 1 && workspace.firstElementChild) {
        const stepRoot = workspace.firstElementChild;
        garmentGrid = Array.from(stepRoot.children || []).find((node) => node?.classList?.contains("grid")) || null;
        mark(garmentGrid, "data-garment-grid");
        mark(directChildContaining(stepRoot, "Same design, different sizes or colors"), "data-step1-group");
        mark(directChildContaining(stepRoot, "Garment selection complete"), "data-step1-complete");

        const selected = selectedGarmentButton(garmentGrid);
        if (!selected) {
          garmentGrid?.removeAttribute("data-gdp-collapsed");
          garmentGrid?.removeAttribute("data-gdp-user-expanded");
        } else if (garmentGrid?.dataset.gdpUserExpanded === "true") {
          garmentGrid.dataset.gdpCollapsed = "false";
        } else if (garmentGrid) {
          garmentGrid.dataset.gdpCollapsed = "true";
        }

        const emptyState = descendantContaining(workspace, "No Custom Studio garments are currently published.");
        if (emptyState && emptyState.dataset.gdpEmptyHandled !== "true") {
          emptyState.dataset.gdpEmptyHandled = "true";
          emptyState.dataset.emptyPending = "true";
          window.clearTimeout(emptyTimer);
          emptyTimer = window.setTimeout(() => {
            if (!emptyState.isConnected) return;
            emptyState.removeAttribute("data-empty-pending");
          }, 500);
        }
      }
    };

    const onShellClick = (event) => {
      if (shell.dataset.step !== "1") return;
      const grid = shell.querySelector("[data-garment-grid]");
      if (!grid) return;
      const clicked = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(clicked instanceof HTMLButtonElement) || clicked.parentElement !== grid) return;

      const clickedWasSelected = clicked.classList.contains("border-accent");
      if (grid.dataset.gdpCollapsed === "true" && clickedWasSelected) {
        grid.dataset.gdpUserExpanded = "true";
        grid.dataset.gdpCollapsed = "false";
        return;
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!grid.isConnected) return;
          const selected = selectedGarmentButton(grid);
          if (!selected) return;
          grid.dataset.gdpUserExpanded = "false";
          grid.dataset.gdpCollapsed = "true";
        });
      });
    };

    annotate();
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "childList" || (mutation.type === "attributes" && mutation.attributeName === "class"))) {
        schedule();
      }
    });
    observer.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    shell.addEventListener("click", onShellClick, false);

    const onResize = () => schedule();
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      observer?.disconnect();
      shell.removeEventListener("click", onShellClick, false);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(emptyTimer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={shellRef} className="gdp-custom-studio-v7" data-step="1">
      <style>{styles}</style>
      <CustomStudio />
    </div>
  );
}
