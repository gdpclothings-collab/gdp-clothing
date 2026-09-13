import React, { useEffect, useRef } from "react";
import CustomStudio from "@/pages/CustomStudio";

const DESKTOP_BREAKPOINT = 1280;

const desktopStyles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-v4 {
    --gdp-studio-rail: 190px;
    --gdp-studio-gap: 14px;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) {
    display: grid !important;
    grid-template-columns: var(--gdp-studio-rail) minmax(0, 1fr) !important;
    grid-template-areas:
      "hero hero"
      "rail work" !important;
    column-gap: var(--gdp-studio-gap) !important;
    row-gap: 10px !important;
    width: 100% !important;
    max-width: 1840px !important;
    padding: 10px 18px 16px !important;
    position: relative;
  }

  /* Compact Custom Studio hero so the workspace gets the screen height. */
  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > :first-child {
    grid-area: hero;
    margin: 0 !important;
    border-radius: 18px !important;
    padding: 10px 16px !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > :first-child > div {
    gap: 10px !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > :first-child h1 {
    margin-top: 2px !important;
    font-size: clamp(1.7rem, 2vw, 2.25rem) !important;
    line-height: .95 !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > :first-child p {
    margin-top: 3px !important;
    max-width: 62rem !important;
    font-size: 11px !important;
    line-height: 1.35 !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > :first-child > div > div:last-child {
    padding: 5px 9px !important;
    font-size: 9px !important;
  }

  /* Left desktop step rail. */
  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) {
    grid-area: rail;
    position: sticky;
    top: 68px;
    z-index: 45;
    align-self: start;
    display: flex !important;
    flex-direction: column !important;
    gap: 9px !important;
    max-height: calc(100dvh - 82px);
    margin: 0 !important;
    overflow: visible !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :first-child {
    display: none !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0 !important;
    overflow: visible !important;
    border-radius: 16px !important;
    padding: 7px !important;
    background: rgba(255,255,255,.95) !important;
    box-shadow: 0 10px 28px rgba(23,50,77,.06) !important;
    backdrop-filter: blur(14px);
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > button {
    width: 100% !important;
    min-height: 42px !important;
    justify-content: flex-start !important;
    padding: 7px 9px !important;
    white-space: normal !important;
    text-align: left !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > button > span:last-child {
    font-size: 9px !important;
    line-height: 1.15 !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > div {
    width: 1px !important;
    min-width: 0 !important;
    height: 7px !important;
    flex: 0 0 7px !important;
    margin-left: 19px !important;
  }

  /* Compact contextual guide; opening it no longer covers the whole studio. */
  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) {
    position: relative !important;
    margin: 0 !important;
    overflow: visible !important;
    border-radius: 15px !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > button {
    min-height: 44px !important;
    padding: 8px 10px !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > button > span:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div {
    position: absolute !important;
    top: 0 !important;
    left: calc(100% + 10px) !important;
    z-index: 120 !important;
    width: min(440px, calc(100vw - 260px)) !important;
    max-height: min(560px, calc(100dvh - 94px)) !important;
    overflow: auto !important;
    border: 1px solid #DCE3EA !important;
    border-radius: 17px !important;
    background: rgba(255,255,255,.99) !important;
    box-shadow: 0 24px 70px rgba(15,23,42,.22) !important;
    backdrop-filter: blur(18px);
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div > div:first-child > div {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div button {
    min-width: 0 !important;
    padding: 11px !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(4) {
    margin: 0 !important;
  }

  .gdp-custom-studio-v4 [data-gdp-step-nav="desktop"] {
    border-radius: 15px !important;
    padding: 7px !important;
    background: rgba(255,255,255,.95) !important;
    box-shadow: 0 10px 28px rgba(23,50,77,.06) !important;
    backdrop-filter: blur(14px);
  }

  .gdp-custom-studio-v4 [data-gdp-step-nav="desktop"] > div:first-child {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }

  .gdp-custom-studio-v4 [data-gdp-step-nav="desktop"] > div:first-child > button {
    width: 100% !important;
    justify-content: center !important;
    padding-left: 9px !important;
    padding-right: 9px !important;
  }

  /* Main studio: controls left, large live garment preview middle-right. */
  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) {
    grid-area: work;
    display: grid !important;
    grid-template-columns: minmax(500px, .78fr) minmax(600px, 1.22fr) !important;
    grid-template-rows: minmax(0,1fr) !important;
    gap: 14px !important;
    align-items: stretch !important;
    width: 100% !important;
    min-width: 0 !important;
    height: calc(100dvh - 190px) !important;
    min-height: 560px !important;
    max-height: calc(100dvh - 190px) !important;
    overflow: hidden !important;
  }

  .gdp-custom-studio-v4 #custom-studio-workspace {
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
    padding: 16px !important;
    scrollbar-width: thin;
    scrollbar-color: #BCC7D2 transparent;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside {
    grid-column: 2 !important;
    grid-row: 1 !important;
    position: relative !important;
    top: auto !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow: hidden !important;
    padding: 0 !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside > .lg\\:hidden {
    display: none !important;
  }

  .gdp-custom-studio-v4 aside > [data-gdp-design-path] {
    position: relative !important;
    top: auto !important;
    z-index: 2 !important;
    display: flex !important;
    flex: 1 1 auto !important;
    flex-direction: column !important;
    width: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    height: 100% !important;
    margin: 0 !important;
    overflow: hidden !important;
    border-radius: 20px !important;
  }

  .gdp-custom-studio-v4 aside > [data-gdp-design-path] > :first-child {
    flex: 0 0 auto !important;
    padding: 10px 12px !important;
  }

  .gdp-custom-studio-v4 aside > [data-gdp-design-path] > :nth-child(2) {
    flex: 1 1 auto !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
  }

  /* Keep the large dark order summary out of the working canvas. It returns on Review only. */
  .gdp-custom-studio-v4:not([data-gdp-active-step="5"]) aside > [data-gdp-design-path] + div {
    display: none !important;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="5"] aside > [data-gdp-design-path] {
    flex: 1 1 auto !important;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="5"] aside > [data-gdp-design-path] + div {
    display: block !important;
    flex: 0 0 auto !important;
    width: 100% !important;
    max-height: 185px !important;
    overflow: auto !important;
    margin: 0 !important;
    border-radius: 17px !important;
    padding: 12px 14px !important;
    scrollbar-width: thin;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="5"] aside > [data-gdp-design-path] + div .font-display {
    margin-top: 3px !important;
    font-size: 1.25rem !important;
    line-height: 1 !important;
  }

  /* Customize owns the full studio width: editor left, preview right. */
  .gdp-custom-studio-v4[data-gdp-active-step="3"] > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) {
    grid-template-columns: minmax(0,1fr) !important;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="3"] #custom-studio-workspace {
    display: none !important;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="3"] > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside {
    grid-column: 1 !important;
    display: block !important;
    overflow: hidden !important;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="3"] aside > [data-gdp-design-path] {
    display: grid !important;
    grid-template-columns: minmax(360px,.70fr) minmax(620px,1.30fr) !important;
    grid-template-rows: auto minmax(0,1fr) !important;
    height: 100% !important;
    min-height: 0 !important;
    overflow: hidden !important;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :first-child {
    grid-column: 1 / -1 !important;
    grid-row: 1 !important;
    min-height: 0 !important;
    padding: 9px 12px !important;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(2) {
    grid-column: 2 !important;
    grid-row: 2 !important;
    height: 100% !important;
    min-height: 0 !important;
    border-left: 1px solid #E5EAF0 !important;
  }

  .gdp-custom-studio-v4[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(3) {
    grid-column: 1 !important;
    grid-row: 2 !important;
    min-width: 0 !important;
    min-height: 0 !important;
    height: 100% !important;
    overflow-x: clip !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    border-top: 0 !important;
    border-right: 1px solid #E5EAF0 !important;
    padding: 12px !important;
    scrollbar-width: thin;
    scrollbar-color: #BCC7D2 transparent;
  }

  .gdp-custom-studio-v4 #custom-studio-workspace::-webkit-scrollbar,
  .gdp-custom-studio-v4[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(3)::-webkit-scrollbar,
  .gdp-custom-studio-v4[data-gdp-active-step="5"] aside > [data-gdp-design-path] + div::-webkit-scrollbar {
    width: 8px;
  }

  .gdp-custom-studio-v4 #custom-studio-workspace::-webkit-scrollbar-thumb,
  .gdp-custom-studio-v4[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(3)::-webkit-scrollbar-thumb,
  .gdp-custom-studio-v4[data-gdp-active-step="5"] aside > [data-gdp-design-path] + div::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: #BCC7D2;
    background-clip: padding-box;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-height: 780px) {
  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > :first-child p {
    display: none !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > :first-child {
    padding-top: 8px !important;
    padding-bottom: 8px !important;
  }

  .gdp-custom-studio-v4 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) {
    height: calc(100dvh - 158px) !important;
    min-height: 500px !important;
    max-height: calc(100dvh - 158px) !important;
  }
}
`;

function activeStepNumber(stepper) {
  if (!stepper) return 1;
  const buttons = Array.from(stepper.children).filter((node) => node?.tagName === "BUTTON");
  const index = buttons.findIndex((button) => String(button.className || "").includes("bg-[#17324D]"));
  return index >= 0 ? index + 1 : 1;
}

export default function CustomStudioDesktopWorkspaceV4() {
  const shellRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof window === "undefined" || !window.MutationObserver) return undefined;

    const actionNav = shell.querySelector('[data-gdp-step-nav="desktop"]');
    const navBlock = actionNav?.parentElement?.parentElement;
    const stepper = navBlock?.children?.[1];
    if (!stepper) return undefined;

    let previousStep = activeStepNumber(stepper);

    const applyStep = (step, reset = false) => {
      shell.dataset.gdpActiveStep = String(step);
      if (!reset) return;
      window.requestAnimationFrame(() => {
        shell.querySelector("#custom-studio-workspace")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
        const aside = shell.querySelector("#custom-studio-workspace")?.parentElement?.querySelector(":scope > aside");
        aside?.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
        aside?.querySelector('[data-gdp-design-path] > :nth-child(3)')?.scrollTo?.({ top: 0, left: 0, behavior: "instant" });
      });
    };

    applyStep(previousStep, false);

    const observer = new MutationObserver(() => {
      const nextStep = activeStepNumber(stepper);
      if (nextStep === previousStep) return;
      previousStep = nextStep;
      applyStep(nextStep, true);
    });

    observer.observe(stepper, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shellRef} className="gdp-custom-studio-v4" data-gdp-active-step="1">
      <style>{desktopStyles}</style>
      <CustomStudio />
    </div>
  );
}
