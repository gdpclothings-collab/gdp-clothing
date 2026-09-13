import React, { useEffect, useRef } from "react";
import CustomStudio from "@/pages/CustomStudio";

const DESKTOP_BREAKPOINT = 1180;

const desktopWorkspaceStyles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-shell {
    --gdp-studio-rail: 212px;
    --gdp-studio-gap: 16px;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) {
    display: grid !important;
    grid-template-columns: var(--gdp-studio-rail) minmax(0, 1fr) !important;
    grid-template-areas:
      "hero hero"
      "rail work";
    column-gap: var(--gdp-studio-gap) !important;
    row-gap: 14px !important;
    max-width: 1760px !important;
    padding: 14px 20px 20px !important;
    position: relative;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > :first-child {
    grid-area: hero;
    margin-bottom: 0 !important;
    border-radius: 20px !important;
    padding: 14px 18px !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > :first-child h1 {
    margin-top: 4px !important;
    font-size: clamp(1.85rem, 2.5vw, 2.8rem) !important;
    line-height: 0.96 !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > :first-child p {
    margin-top: 5px !important;
    max-width: 58rem !important;
    font-size: 12.5px !important;
    line-height: 1.45 !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > :first-child > div > div:last-child {
    padding: 6px 10px !important;
    font-size: 10px !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) {
    grid-area: rail;
    position: sticky;
    top: 76px;
    z-index: 35;
    align-self: start;
    display: flex;
    max-height: calc(100dvh - 94px);
    flex-direction: column;
    gap: 10px;
    margin-bottom: 0 !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :first-child {
    display: none !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0 !important;
    overflow: visible !important;
    border-radius: 18px !important;
    padding: 8px !important;
    background: rgba(255,255,255,0.9) !important;
    backdrop-filter: blur(14px);
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > button {
    width: 100%;
    min-height: 48px;
    justify-content: flex-start !important;
    padding: 10px 11px !important;
    white-space: normal !important;
    text-align: left;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > button > span:last-child {
    font-size: 10px !important;
    line-height: 1.2 !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(2) > div {
    width: 1px !important;
    min-width: 0 !important;
    height: 10px !important;
    flex: 0 0 10px !important;
    margin-left: 20px;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) {
    position: relative;
    margin-top: 0 !important;
    overflow: visible !important;
    border-radius: 16px !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > button {
    min-height: 44px;
    padding: 9px 11px !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > button > span:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div {
    position: absolute;
    top: 0;
    left: calc(100% + 12px);
    z-index: 90;
    width: min(720px, calc(100vw - 292px));
    max-height: calc(100dvh - 112px);
    overflow: auto;
    border: 1px solid #DCE3EA !important;
    border-radius: 18px;
    background: rgba(255,255,255,0.98);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.2);
    backdrop-filter: blur(18px);
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div > div:first-child > div {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(4) {
    margin-top: 0 !important;
  }

  .gdp-custom-studio-shell [data-gdp-step-nav="desktop"] {
    border-radius: 16px !important;
    padding: 8px !important;
    background: rgba(255,255,255,0.92) !important;
    backdrop-filter: blur(14px);
  }

  .gdp-custom-studio-shell [data-gdp-step-nav="desktop"] > div:first-child {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 7px !important;
  }

  .gdp-custom-studio-shell [data-gdp-step-nav="desktop"] > div:first-child > button {
    width: 100%;
    justify-content: center !important;
    padding-left: 10px !important;
    padding-right: 10px !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) {
    grid-area: work;
    display: grid !important;
    grid-template-columns: minmax(0, 1.48fr) minmax(320px, 0.52fr) !important;
    gap: 14px !important;
    align-items: stretch !important;
    width: 100%;
    min-width: 0;
    height: calc(100dvh - 164px);
    min-height: 560px;
    max-height: calc(100dvh - 164px);
  }

  .gdp-custom-studio-shell #custom-studio-workspace {
    height: 100%;
    min-height: 0 !important;
    max-height: 100%;
    overflow-x: clip !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    border-radius: 20px !important;
    padding: 20px !important;
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: #BCC7D2 transparent;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside {
    position: relative !important;
    top: auto !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow-x: clip;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: #BCC7D2 transparent;
  }

  .gdp-custom-studio-shell #custom-studio-workspace::-webkit-scrollbar,
  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside::-webkit-scrollbar {
    width: 8px;
  }

  .gdp-custom-studio-shell #custom-studio-workspace::-webkit-scrollbar-thumb,
  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: #BCC7D2;
    background-clip: padding-box;
  }

  .gdp-custom-studio-shell #custom-studio-workspace::-webkit-scrollbar-track,
  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) > aside::-webkit-scrollbar-track {
    background: transparent;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-height: 760px) {
  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > :first-child p {
    display: none;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > :first-child {
    padding-top: 10px !important;
    padding-bottom: 10px !important;
  }

  .gdp-custom-studio-shell > div > div:has(> div > #custom-studio-workspace) > div:has(> #custom-studio-workspace) {
    height: calc(100dvh - 132px);
    max-height: calc(100dvh - 132px);
    min-height: 500px;
  }
}
`;

function activeStepLabel(stepper) {
  if (!stepper) return "";
  const buttons = Array.from(stepper.children).filter((node) => node?.tagName === "BUTTON");
  const active = buttons.find((button) => String(button.className || "").includes("bg-[#17324D]"));
  return active?.textContent?.trim() || "";
}

export default function CustomStudioDesktopWorkspace() {
  const shellRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof window === "undefined" || !window.MutationObserver) return undefined;

    const media = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const actionNav = shell.querySelector('[data-gdp-step-nav="desktop"]');
    const navBlock = actionNav?.parentElement?.parentElement;
    const stepper = navBlock?.children?.[1];
    if (!stepper) return undefined;

    let previousStep = activeStepLabel(stepper);
    const resetWorkspaceScroll = () => {
      if (!media.matches) return;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          shell.querySelector("#custom-studio-workspace")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
          shell.querySelector("#custom-studio-workspace")?.parentElement?.querySelector("aside")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
        });
      });
    };

    const observer = new MutationObserver(() => {
      const nextStep = activeStepLabel(stepper);
      if (!nextStep || nextStep === previousStep) return;
      previousStep = nextStep;
      resetWorkspaceScroll();
    });

    observer.observe(stepper, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shellRef} className="gdp-custom-studio-shell">
      <style>{desktopWorkspaceStyles}</style>
      <CustomStudio />
    </div>
  );
}
