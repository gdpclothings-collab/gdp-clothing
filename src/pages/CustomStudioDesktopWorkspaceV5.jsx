import React, { useEffect, useRef } from "react";
import CustomStudio from "@/pages/CustomStudio";

const DESKTOP_BREAKPOINT = 1280;

const styles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-v5 {
    --gdp-rail: 188px;
    --gdp-center: 540px;
    --gdp-gap: 14px;
  }

  .gdp-custom-studio-v5 > div {
    min-height: 0 !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-container="true"] {
    display: grid !important;
    grid-template-columns: var(--gdp-rail) minmax(0, 1fr) !important;
    grid-template-areas:
      "hero hero"
      "rail work" !important;
    column-gap: var(--gdp-gap) !important;
    row-gap: 9px !important;
    width: 100% !important;
    max-width: 1920px !important;
    margin: 0 auto !important;
    padding: 9px 18px 14px !important;
  }

  /* Compact studio title instead of a large marketing hero inside the editor. */
  .gdp-custom-studio-v5 [data-gdp-studio-hero="true"] {
    grid-area: hero !important;
    margin: 0 !important;
    min-height: 54px !important;
    border-radius: 16px !important;
    padding: 9px 14px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-hero="true"] > div {
    gap: 8px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-hero="true"] h1 {
    margin-top: 1px !important;
    font-size: clamp(1.35rem, 1.7vw, 1.8rem) !important;
    line-height: 1 !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-hero="true"] p {
    margin-top: 2px !important;
    font-size: 10px !important;
    line-height: 1.3 !important;
    max-width: 58rem !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-studio-hero="true"] p,
  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-studio-hero="true"] > div > div:last-child {
    display: none !important;
  }

  /* Left navigation is a true rail, not part of the center workspace. */
  .gdp-custom-studio-v5 [data-gdp-studio-rail="true"] {
    grid-area: rail !important;
    position: sticky !important;
    top: 66px !important;
    align-self: stretch !important;
    z-index: 40 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    width: 100% !important;
    height: calc(100dvh - 151px) !important;
    min-height: 560px !important;
    max-height: calc(100dvh - 151px) !important;
    margin: 0 !important;
    overflow: visible !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-mobile-progress="true"] {
    display: none !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-stepper="true"] {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0 !important;
    overflow: visible !important;
    border: 1px solid #DCE3EA !important;
    border-radius: 16px !important;
    padding: 7px !important;
    background: rgba(255,255,255,.96) !important;
    box-shadow: 0 10px 28px rgba(23,50,77,.06) !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-stepper="true"] > button {
    width: 100% !important;
    min-height: 44px !important;
    justify-content: flex-start !important;
    padding: 8px 9px !important;
    white-space: normal !important;
    text-align: left !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-stepper="true"] > button > span:last-child {
    font-size: 9.5px !important;
    line-height: 1.15 !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-stepper="true"] > div {
    width: 1px !important;
    min-width: 0 !important;
    height: 7px !important;
    flex: 0 0 7px !important;
    margin-left: 19px !important;
  }

  /* How it works becomes contextual help at the bottom of the rail. */
  .gdp-custom-studio-v5 [data-gdp-studio-guide="true"] {
    position: relative !important;
    margin-top: auto !important;
    overflow: visible !important;
    border-radius: 15px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-guide="true"] > button {
    min-height: 42px !important;
    padding: 8px 10px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-guide="true"] > button > span:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-guide="true"] > div {
    position: absolute !important;
    left: calc(100% + 10px) !important;
    bottom: 0 !important;
    top: auto !important;
    z-index: 130 !important;
    width: min(450px, calc(100vw - 260px)) !important;
    max-height: min(540px, calc(100dvh - 100px)) !important;
    overflow: auto !important;
    border: 1px solid #DCE3EA !important;
    border-radius: 17px !important;
    background: rgba(255,255,255,.99) !important;
    box-shadow: 0 24px 70px rgba(15,23,42,.22) !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-guide="true"] > div > div:first-child > div {
    grid-template-columns: 1fr !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-actions="true"] {
    margin: 0 !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-actions="true"] [data-gdp-step-nav="desktop"] {
    border-radius: 15px !important;
    padding: 7px !important;
    background: rgba(255,255,255,.96) !important;
    box-shadow: 0 10px 28px rgba(23,50,77,.06) !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-actions="true"] [data-gdp-step-nav="desktop"] > div:first-child {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-actions="true"] [data-gdp-step-nav="desktop"] > div:first-child > button {
    width: 100% !important;
    justify-content: center !important;
  }

  /* Explicitly anchored real workspace row. This replaces the brittle :has() placement. */
  .gdp-custom-studio-v5 [data-gdp-studio-row="true"] {
    grid-area: work !important;
    display: grid !important;
    grid-template-columns: var(--gdp-center) minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) !important;
    gap: var(--gdp-gap) !important;
    align-items: stretch !important;
    width: 100% !important;
    min-width: 0 !important;
    height: calc(100dvh - 151px) !important;
    min-height: 560px !important;
    max-height: calc(100dvh - 151px) !important;
    overflow: hidden !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-workspace="true"] {
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
    border-radius: 20px !important;
    padding: 18px !important;
    scrollbar-width: thin;
    scrollbar-color: #BCC7D2 transparent;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-aside="true"] {
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
  }

  .gdp-custom-studio-v5 [data-gdp-studio-aside="true"] > .lg\\:hidden {
    display: none !important;
  }

  .gdp-custom-studio-v5 [data-gdp-preview-card="true"] {
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
    border-radius: 20px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-preview-card="true"] > :first-child {
    flex: 0 0 auto !important;
    padding: 10px 12px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-preview-card="true"] > :nth-child(2) {
    flex: 1 1 auto !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
  }

  .gdp-custom-studio-v5:not([data-gdp-active-step="5"]) [data-gdp-order-card="true"] {
    display: none !important;
  }

  /* STEP 1: dedicated garment configurator. */
  .gdp-custom-studio-v5[data-gdp-active-step="1"] {
    --gdp-center: 548px;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-studio-workspace="true"] {
    padding: 16px 16px 18px !important;
    background: #FFFFFF !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-garment-panel="true"] {
    min-width: 0 !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-garment-panel="true"] > :first-child {
    margin-bottom: 12px !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-garment-panel="true"] h2,
  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-garment-panel="true"] .font-display {
    line-height: 1 !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-garment-grid="true"] {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 12px !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-garment-grid="true"] > button {
    min-width: 0 !important;
    border-radius: 17px !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-garment-grid="true"] > button > :first-child {
    min-height: 142px !important;
    aspect-ratio: 16 / 10 !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-garment-grid="true"] > button img {
    max-height: 100% !important;
    object-fit: contain !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-preview-card="true"] {
    border-radius: 22px !important;
    box-shadow: 0 20px 56px rgba(23,50,77,.10) !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] [data-gdp-preview-card="true"] > :nth-child(2) {
    min-height: 500px !important;
  }

  /* Review may show a compact summary under the preview. */
  .gdp-custom-studio-v5[data-gdp-active-step="5"] [data-gdp-studio-aside="true"] {
    gap: 10px !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="5"] [data-gdp-preview-card="true"] {
    min-height: 0 !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="5"] [data-gdp-order-card="true"] {
    display: block !important;
    flex: 0 0 auto !important;
    max-height: 180px !important;
    overflow: auto !important;
    margin: 0 !important;
    border-radius: 17px !important;
    padding: 12px 14px !important;
  }

  /* Customize keeps editor controls left and the garment canvas permanently right. */
  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-studio-row="true"] {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-studio-workspace="true"] {
    display: none !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-studio-aside="true"] {
    grid-column: 1 !important;
    display: block !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-preview-card="true"] {
    display: grid !important;
    grid-template-columns: minmax(360px, .70fr) minmax(620px, 1.30fr) !important;
    grid-template-rows: auto minmax(0, 1fr) !important;
    height: 100% !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-preview-card="true"] > :first-child {
    grid-column: 1 / -1 !important;
    grid-row: 1 !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-preview-card="true"] > :nth-child(2) {
    grid-column: 2 !important;
    grid-row: 2 !important;
    height: 100% !important;
    border-left: 1px solid #E5EAF0 !important;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-preview-card="true"] > :nth-child(3) {
    grid-column: 1 !important;
    grid-row: 2 !important;
    min-width: 0 !important;
    min-height: 0 !important;
    height: 100% !important;
    overflow-x: clip !important;
    overflow-y: auto !important;
    border-top: 0 !important;
    border-right: 1px solid #E5EAF0 !important;
    padding: 12px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-workspace="true"]::-webkit-scrollbar,
  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-preview-card="true"] > :nth-child(3)::-webkit-scrollbar,
  .gdp-custom-studio-v5[data-gdp-active-step="5"] [data-gdp-order-card="true"]::-webkit-scrollbar {
    width: 8px;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-workspace="true"]::-webkit-scrollbar-thumb,
  .gdp-custom-studio-v5[data-gdp-active-step="3"] [data-gdp-preview-card="true"] > :nth-child(3)::-webkit-scrollbar-thumb,
  .gdp-custom-studio-v5[data-gdp-active-step="5"] [data-gdp-order-card="true"]::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: #BCC7D2;
    background-clip: padding-box;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1500px) {
  .gdp-custom-studio-v5 {
    --gdp-rail: 176px;
    --gdp-center: 500px;
    --gdp-gap: 12px;
  }

  .gdp-custom-studio-v5[data-gdp-active-step="1"] {
    --gdp-center: 510px;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-height: 780px) {
  .gdp-custom-studio-v5 [data-gdp-studio-row="true"],
  .gdp-custom-studio-v5 [data-gdp-studio-rail="true"] {
    height: calc(100dvh - 132px) !important;
    min-height: 500px !important;
    max-height: calc(100dvh - 132px) !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-hero="true"] {
    min-height: 44px !important;
    padding-top: 7px !important;
    padding-bottom: 7px !important;
  }

  .gdp-custom-studio-v5 [data-gdp-studio-hero="true"] p {
    display: none !important;
  }
}
`;

function detectStep(stepper) {
  if (!stepper) return 1;
  const buttons = Array.from(stepper.children).filter((node) => node?.tagName === "BUTTON");
  const activeIndex = buttons.findIndex((button) => String(button.className || "").includes("bg-[#17324D]"));
  return activeIndex >= 0 ? activeIndex + 1 : 1;
}

function setFlag(node, name, value = "true") {
  if (node) node.setAttribute(name, value);
}

export default function CustomStudioDesktopWorkspaceV5() {
  const shellRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof window === "undefined") return undefined;

    let frame = 0;
    let previousStep = 1;

    const annotate = (resetScroll = false) => {
      frame = 0;
      const workspace = shell.querySelector("#custom-studio-workspace");
      const row = workspace?.parentElement;
      const container = row?.parentElement;
      const aside = row?.querySelector(":scope > aside");
      const previewCard = aside?.querySelector(":scope > [data-gdp-design-path]");
      const orderCard = previewCard?.nextElementSibling;
      const actionNav = shell.querySelector('[data-gdp-step-nav="desktop"]');
      const actions = actionNav?.parentElement;
      const rail = actions?.parentElement;
      const mobileProgress = rail?.children?.[0];
      const stepper = rail?.children?.[1];
      const guide = rail?.children?.[2];
      const hero = container?.firstElementChild;
      const step = detectStep(stepper);

      setFlag(container, "data-gdp-studio-container");
      setFlag(hero, "data-gdp-studio-hero");
      setFlag(rail, "data-gdp-studio-rail");
      setFlag(mobileProgress, "data-gdp-studio-mobile-progress");
      setFlag(stepper, "data-gdp-studio-stepper");
      setFlag(guide, "data-gdp-studio-guide");
      setFlag(actions, "data-gdp-studio-actions");
      setFlag(row, "data-gdp-studio-row");
      setFlag(workspace, "data-gdp-studio-workspace");
      setFlag(aside, "data-gdp-studio-aside");
      setFlag(previewCard, "data-gdp-preview-card");
      setFlag(orderCard, "data-gdp-order-card");

      shell.dataset.gdpActiveStep = String(step);

      const oldGarmentPanel = shell.querySelector('[data-gdp-garment-panel="true"]');
      const oldGarmentGrid = shell.querySelector('[data-gdp-garment-grid="true"]');
      oldGarmentPanel?.removeAttribute("data-gdp-garment-panel");
      oldGarmentGrid?.removeAttribute("data-gdp-garment-grid");

      if (step === 1 && workspace?.firstElementChild) {
        const garmentPanel = workspace.firstElementChild;
        setFlag(garmentPanel, "data-gdp-garment-panel");
        const garmentGrid = Array.from(garmentPanel.children || []).find((node) => node?.classList?.contains("grid"));
        setFlag(garmentGrid, "data-gdp-garment-grid");
      }

      if (resetScroll || step !== previousStep) {
        workspace?.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
        aside?.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
      }
      previousStep = step;
    };

    const scheduleAnnotate = (reset = false) => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => annotate(reset));
    };

    const observer = new MutationObserver((mutations) => {
      const reset = mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "class");
      scheduleAnnotate(reset);
    });

    observer.observe(shell, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    scheduleAnnotate(false);
    window.addEventListener("resize", scheduleAnnotate);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleAnnotate);
    };
  }, []);

  return (
    <div ref={shellRef} className="gdp-custom-studio-v5" data-gdp-active-step="1">
      <style>{styles}</style>
      <CustomStudio />
    </div>
  );
}
