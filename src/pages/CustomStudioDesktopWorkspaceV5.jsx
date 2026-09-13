import React, { useEffect, useRef } from "react";
import CustomStudio from "@/pages/CustomStudio";

const DESKTOP_BREAKPOINT = 1280;

const styles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-v5 {
    --rail: 188px;
    --center: 540px;
    --gap: 14px;
  }

  .gdp-custom-studio-v5 [data-studio-container] {
    display: grid !important;
    grid-template-columns: var(--rail) minmax(0,1fr) !important;
    grid-template-areas: "hero hero" "rail work" !important;
    column-gap: var(--gap) !important;
    row-gap: 9px !important;
    width: 100% !important;
    max-width: 1920px !important;
    margin: 0 auto !important;
    padding: 9px 18px 14px !important;
  }

  .gdp-custom-studio-v5 [data-studio-hero] {
    grid-area: hero !important;
    min-height: 50px !important;
    margin: 0 !important;
    padding: 8px 14px !important;
    border-radius: 16px !important;
  }

  .gdp-custom-studio-v5 [data-studio-hero] h1 {
    margin-top: 1px !important;
    font-size: clamp(1.35rem,1.7vw,1.8rem) !important;
    line-height: 1 !important;
  }

  .gdp-custom-studio-v5 [data-studio-hero] p {
    margin-top: 2px !important;
    font-size: 10px !important;
    line-height: 1.3 !important;
  }

  .gdp-custom-studio-v5[data-step="1"] [data-studio-hero] p,
  .gdp-custom-studio-v5[data-step="1"] [data-studio-hero] > div > div:last-child {
    display: none !important;
  }

  .gdp-custom-studio-v5 [data-studio-rail] {
    grid-area: rail !important;
    position: sticky !important;
    top: 66px !important;
    z-index: 40 !important;
    align-self: stretch !important;
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

  .gdp-custom-studio-v5 [data-mobile-progress] { display: none !important; }

  .gdp-custom-studio-v5 [data-stepper] {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0 !important;
    overflow: visible !important;
    padding: 7px !important;
    border-radius: 16px !important;
    background: rgba(255,255,255,.96) !important;
    box-shadow: 0 10px 28px rgba(23,50,77,.06) !important;
  }

  .gdp-custom-studio-v5 [data-stepper] > button {
    width: 100% !important;
    min-height: 44px !important;
    justify-content: flex-start !important;
    padding: 8px 9px !important;
    white-space: normal !important;
    text-align: left !important;
  }

  .gdp-custom-studio-v5 [data-stepper] > button > span:last-child {
    font-size: 9.5px !important;
    line-height: 1.15 !important;
  }

  .gdp-custom-studio-v5 [data-stepper] > div {
    width: 1px !important;
    min-width: 0 !important;
    height: 7px !important;
    flex: 0 0 7px !important;
    margin-left: 19px !important;
  }

  .gdp-custom-studio-v5 [data-guide] {
    position: relative !important;
    margin-top: auto !important;
    overflow: visible !important;
  }

  .gdp-custom-studio-v5 [data-guide] > button > span:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-v5 [data-guide] > div {
    position: absolute !important;
    left: calc(100% + 10px) !important;
    bottom: 0 !important;
    top: auto !important;
    z-index: 130 !important;
    width: min(450px,calc(100vw - 260px)) !important;
    max-height: min(540px,calc(100dvh - 100px)) !important;
    overflow: auto !important;
    border-radius: 17px !important;
    background: rgba(255,255,255,.99) !important;
    box-shadow: 0 24px 70px rgba(15,23,42,.22) !important;
  }

  .gdp-custom-studio-v5 [data-guide] > div > div:first-child > div {
    grid-template-columns: 1fr !important;
  }

  .gdp-custom-studio-v5 [data-actions] { margin: 0 !important; }
  .gdp-custom-studio-v5 [data-actions] [data-gdp-step-nav="desktop"] {
    padding: 7px !important;
    border-radius: 15px !important;
    background: rgba(255,255,255,.96) !important;
    box-shadow: 0 10px 28px rgba(23,50,77,.06) !important;
  }
  .gdp-custom-studio-v5 [data-actions] [data-gdp-step-nav="desktop"] > div:first-child {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }
  .gdp-custom-studio-v5 [data-actions] [data-gdp-step-nav="desktop"] > div:first-child > button {
    width: 100% !important;
    justify-content: center !important;
  }

  .gdp-custom-studio-v5 [data-studio-row] {
    grid-area: work !important;
    display: grid !important;
    grid-template-columns: var(--center) minmax(0,1fr) !important;
    grid-template-rows: minmax(0,1fr) !important;
    gap: var(--gap) !important;
    width: 100% !important;
    min-width: 0 !important;
    height: calc(100dvh - 151px) !important;
    min-height: 560px !important;
    max-height: calc(100dvh - 151px) !important;
    overflow: hidden !important;
  }

  .gdp-custom-studio-v5 [data-workspace] {
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
    padding: 16px !important;
    border-radius: 20px !important;
    scrollbar-width: thin;
  }

  .gdp-custom-studio-v5 [data-aside] {
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

  .gdp-custom-studio-v5 [data-aside] > .lg\\:hidden { display: none !important; }

  .gdp-custom-studio-v5 [data-preview-card] {
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
    box-shadow: 0 20px 56px rgba(23,50,77,.10) !important;
  }

  .gdp-custom-studio-v5 [data-preview-card] > :first-child {
    flex: 0 0 auto !important;
    padding: 10px 12px !important;
  }

  .gdp-custom-studio-v5 [data-preview-card] > :nth-child(2) {
    flex: 1 1 auto !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
  }

  .gdp-custom-studio-v5:not([data-step="5"]) [data-order-card] { display: none !important; }

  /* Step 1 is intentionally simple: navigation, garment controls, live preview. */
  .gdp-custom-studio-v5[data-step="1"] { --center: 548px; }

  .gdp-custom-studio-v5[data-step="1"] [data-garment-grid] {
    display: grid !important;
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    gap: 12px !important;
  }

  .gdp-custom-studio-v5[data-step="1"] [data-garment-grid] > button {
    min-width: 0 !important;
    border-radius: 17px !important;
  }

  .gdp-custom-studio-v5[data-step="1"] [data-garment-grid] > button > :first-child {
    min-height: 142px !important;
    aspect-ratio: 16 / 10 !important;
  }

  .gdp-custom-studio-v5[data-step="1"] [data-preview-card] > :nth-child(2) {
    min-height: 500px !important;
  }

  /* Customize keeps editor controls left and garment canvas right. */
  .gdp-custom-studio-v5[data-step="3"] [data-studio-row] {
    grid-template-columns: minmax(0,1fr) !important;
  }
  .gdp-custom-studio-v5[data-step="3"] [data-workspace] { display: none !important; }
  .gdp-custom-studio-v5[data-step="3"] [data-aside] { grid-column: 1 !important; display: block !important; }
  .gdp-custom-studio-v5[data-step="3"] [data-preview-card] {
    display: grid !important;
    grid-template-columns: minmax(360px,.70fr) minmax(620px,1.30fr) !important;
    grid-template-rows: auto minmax(0,1fr) !important;
    height: 100% !important;
  }
  .gdp-custom-studio-v5[data-step="3"] [data-preview-card] > :first-child { grid-column: 1 / -1 !important; grid-row: 1 !important; }
  .gdp-custom-studio-v5[data-step="3"] [data-preview-card] > :nth-child(2) { grid-column: 2 !important; grid-row: 2 !important; height: 100% !important; border-left: 1px solid #E5EAF0 !important; }
  .gdp-custom-studio-v5[data-step="3"] [data-preview-card] > :nth-child(3) {
    grid-column: 1 !important;
    grid-row: 2 !important;
    min-height: 0 !important;
    height: 100% !important;
    overflow-y: auto !important;
    border-top: 0 !important;
    border-right: 1px solid #E5EAF0 !important;
    padding: 12px !important;
  }

  .gdp-custom-studio-v5[data-step="5"] [data-aside] { gap: 10px !important; }
  .gdp-custom-studio-v5[data-step="5"] [data-order-card] {
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
  .gdp-custom-studio-v5 { --rail: 176px; --center: 500px; --gap: 12px; }
  .gdp-custom-studio-v5[data-step="1"] { --center: 510px; }
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

export default function CustomStudioDesktopWorkspaceV5() {
  const shellRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof window === "undefined") return undefined;

    let frame = 0;
    let previousStep = 1;

    const annotate = () => {
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
      const step = getStep(stepper);

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
      shell.dataset.step = String(step);

      shell.querySelector('[data-garment-grid="true"]')?.removeAttribute("data-garment-grid");
      if (step === 1 && workspace?.firstElementChild) {
        const garmentGrid = Array.from(workspace.firstElementChild.children || []).find((node) => node?.classList?.contains("grid"));
        mark(garmentGrid, "data-garment-grid");
      }

      if (step !== previousStep) {
        workspace?.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
        aside?.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
      }
      previousStep = step;
    };

    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(annotate);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(shell, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });

    const handleResize = () => schedule();
    window.addEventListener("resize", handleResize);
    schedule();

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div ref={shellRef} className="gdp-custom-studio-v5" data-step="1">
      <style>{styles}</style>
      <CustomStudio />
    </div>
  );
}
