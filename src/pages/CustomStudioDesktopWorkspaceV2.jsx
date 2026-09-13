import React, { useEffect, useRef } from "react";
import CustomStudio from "@/pages/CustomStudio";

const DESKTOP_BREAKPOINT = 1280;

const desktopWorkspaceStyles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-shell-v2 {
    --gdp-studio-rail: 196px;
    --gdp-studio-gap: 14px;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) {
    display: grid !important;
    grid-template-columns: var(--gdp-studio-rail) minmax(0, 1fr) !important;
    grid-template-areas:
      "hero hero"
      "rail work";
    column-gap: var(--gdp-studio-gap) !important;
    row-gap: 12px !important;
    max-width: 1760px !important;
    padding: 12px 18px 18px !important;
    position: relative;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > :first-child {
    grid-area: hero;
    margin-bottom: 0 !important;
    border-radius: 18px !important;
    padding: 12px 16px !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > :first-child h1 {
    margin-top: 3px !important;
    font-size: clamp(1.75rem, 2.2vw, 2.55rem) !important;
    line-height: 0.96 !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > :first-child p {
    margin-top: 4px !important;
    max-width: 60rem !important;
    font-size: 12px !important;
    line-height: 1.4 !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > :first-child > div > div:last-child {
    padding: 5px 9px !important;
    font-size: 9.5px !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) {
    grid-area: rail;
    position: sticky;
    top: 72px;
    z-index: 35;
    align-self: start;
    display: flex;
    max-height: calc(100dvh - 88px);
    flex-direction: column;
    gap: 9px;
    margin-bottom: 0 !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :first-child {
    display: none !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0 !important;
    overflow: visible !important;
    border-radius: 16px !important;
    padding: 7px !important;
    background: rgba(255,255,255,0.92) !important;
    backdrop-filter: blur(14px);
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > button {
    width: 100%;
    min-height: 44px;
    justify-content: flex-start !important;
    padding: 8px 9px !important;
    white-space: normal !important;
    text-align: left;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > button > span:last-child {
    font-size: 9.5px !important;
    line-height: 1.15 !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > div {
    width: 1px !important;
    min-width: 0 !important;
    height: 8px !important;
    flex: 0 0 8px !important;
    margin-left: 19px;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) {
    position: relative;
    margin-top: 0 !important;
    overflow: visible !important;
    border-radius: 15px !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > button {
    min-height: 42px;
    padding: 8px 10px !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > button > span:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div {
    position: absolute;
    top: 0;
    left: calc(100% + 10px);
    z-index: 90;
    width: min(720px, calc(100vw - 270px));
    max-height: calc(100dvh - 106px);
    overflow: auto;
    border: 1px solid #DCE3EA !important;
    border-radius: 17px;
    background: rgba(255,255,255,0.98);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.2);
    backdrop-filter: blur(18px);
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div > div:first-child > div {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(4) {
    margin-top: 0 !important;
  }

  .gdp-custom-studio-shell-v2 [data-gdp-step-nav="desktop"] {
    border-radius: 15px !important;
    padding: 7px !important;
    background: rgba(255,255,255,0.94) !important;
    backdrop-filter: blur(14px);
  }

  .gdp-custom-studio-shell-v2 [data-gdp-step-nav="desktop"] > div:first-child {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }

  .gdp-custom-studio-shell-v2 [data-gdp-step-nav="desktop"] > div:first-child > button {
    width: 100%;
    justify-content: center !important;
    padding-left: 9px !important;
    padding-right: 9px !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) {
    grid-area: work;
    display: grid !important;
    grid-template-columns: minmax(0, 1.06fr) minmax(520px, 0.94fr) !important;
    gap: 16px !important;
    align-items: stretch !important;
    width: 100%;
    min-width: 0;
    height: calc(100dvh - 154px);
    min-height: 570px;
    max-height: calc(100dvh - 154px);
  }

  .gdp-custom-studio-shell-v2 #custom-studio-workspace {
    height: 100%;
    min-height: 0 !important;
    max-height: 100%;
    overflow-x: clip !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    border-radius: 20px !important;
    padding: 18px !important;
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: #BCC7D2 transparent;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside {
    position: relative !important;
    top: auto !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow-x: clip;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: #BCC7D2 transparent;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside > [data-gdp-design-path] {
    position: sticky;
    top: 0;
    z-index: 3;
    background: white;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside > [data-gdp-design-path] > :nth-child(2) {
    height: clamp(390px, 51dvh, 540px) !important;
  }

  .gdp-custom-studio-shell-v2 #custom-studio-workspace::-webkit-scrollbar,
  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside::-webkit-scrollbar,
  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(3)::-webkit-scrollbar {
    width: 8px;
  }

  .gdp-custom-studio-shell-v2 #custom-studio-workspace::-webkit-scrollbar-thumb,
  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside::-webkit-scrollbar-thumb,
  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(3)::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: #BCC7D2;
    background-clip: padding-box;
  }

  .gdp-custom-studio-shell-v2 #custom-studio-workspace::-webkit-scrollbar-track,
  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside::-webkit-scrollbar-track,
  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(3)::-webkit-scrollbar-track {
    background: transparent;
  }

  /* Customize: use the full workspace. Editor stays on the left and the garment
     preview remains continuously visible in the middle-right instead of being
     pushed into a narrow, scrollable sidebar. */
  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] #custom-studio-workspace {
    display: none !important;
  }

  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside {
    display: block !important;
    overflow: hidden !important;
    padding-right: 0 !important;
  }

  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] aside > [data-gdp-design-path] {
    position: relative !important;
    top: auto !important;
    z-index: 1 !important;
    display: grid !important;
    grid-template-columns: minmax(350px, 0.72fr) minmax(560px, 1.28fr) !important;
    grid-template-rows: auto minmax(0, 1fr) !important;
    height: 100% !important;
    min-height: 0 !important;
    overflow: hidden !important;
    border-radius: 20px !important;
  }

  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :first-child {
    grid-column: 1 / -1;
    grid-row: 1;
    min-height: 0;
    padding: 10px 12px !important;
  }

  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(2) {
    grid-column: 2;
    grid-row: 2;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    border-left: 1px solid #E5EAF0;
  }

  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] aside > [data-gdp-design-path] > :nth-child(3) {
    grid-column: 1;
    grid-row: 2;
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow-x: clip;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-top: 0 !important;
    border-right: 1px solid #E5EAF0;
    padding: 12px !important;
    scrollbar-width: thin;
    scrollbar-color: #BCC7D2 transparent;
  }

  .gdp-custom-studio-shell-v2[data-gdp-active-step="3"] aside > [data-gdp-design-path] + div {
    display: none !important;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-height: 780px) {
  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > :first-child p {
    display: none;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > :first-child {
    padding-top: 9px !important;
    padding-bottom: 9px !important;
  }

  .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) {
    height: calc(100dvh - 124px);
    max-height: calc(100dvh - 124px);
    min-height: 500px;
  }

  .gdp-custom-studio-shell-v2:not([data-gdp-active-step="3"]) > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside > [data-gdp-design-path] > :nth-child(2) {
    height: clamp(330px, 46dvh, 430px) !important;
  }
}
`;

function activeStepNumber(stepper) {
  if (!stepper) return 1;
  const buttons = Array.from(stepper.children).filter((node) => node?.tagName === "BUTTON");
  const index = buttons.findIndex((button) => String(button.className || "").includes("bg-[#17324D]"));
  return index >= 0 ? index + 1 : 1;
}

export default function CustomStudioDesktopWorkspaceV2() {
  const shellRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof window === "undefined" || !window.MutationObserver) return undefined;

    const media = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const actionNav = shell.querySelector('[data-gdp-step-nav="desktop"]');
    const navBlock = actionNav?.parentElement?.parentElement;
    const stepper = navBlock?.children?.[1];
    if (!stepper) return undefined;

    const applyStepState = (nextStep, resetScroll = false) => {
      shell.dataset.gdpActiveStep = String(nextStep);
      if (!resetScroll || !media.matches) return;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          shell.querySelector("#custom-studio-workspace")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
          const aside = shell.querySelector("#custom-studio-workspace")?.parentElement?.querySelector("aside");
          aside?.scrollTo({ top: 0, left: 0, behavior: "instant" });
          aside?.querySelector('[data-gdp-design-path] > :nth-child(3)')?.scrollTo({ top: 0, left: 0, behavior: "instant" });
        });
      });
    };

    let previousStep = activeStepNumber(stepper);
    applyStepState(previousStep, false);

    const observer = new MutationObserver(() => {
      const nextStep = activeStepNumber(stepper);
      if (nextStep === previousStep) return;
      previousStep = nextStep;
      applyStepState(nextStep, true);
    });

    observer.observe(stepper, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shellRef} className="gdp-custom-studio-shell-v2" data-gdp-active-step="1">
      <style>{desktopWorkspaceStyles}</style>
      <CustomStudio />
    </div>
  );
}
