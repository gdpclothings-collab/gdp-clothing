import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import CustomStudioDesktopWorkspaceV9 from "@/pages/CustomStudioDesktopWorkspaceV9";
import { useNotifications } from "@/lib/NotificationContext";

const DESKTOP_BREAKPOINT = 1280;
const STUDIO_DRAFT_KEY = "gdp.custom-studio.draft.v2";
const STEP_ONE_VALIDATION = "Choose an available size before continuing.";

const styles = `
.gdp-custom-studio-v10 {
  width: 100%;
  min-width: 0;
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  /* Step 1 is one focused configurator. The live editor preview is intentionally
     hidden here; it returns unchanged for the design/customize steps. */
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-studio-row] {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) auto !important;
    gap: 10px !important;
    overflow: hidden !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-workspace] {
    grid-column: 1 !important;
    grid-row: 1 !important;
    width: 100% !important;
    max-width: none !important;
    min-height: 0 !important;
    height: 100% !important;
    max-height: none !important;
    overflow-x: clip !important;
    overflow-y: auto !important;
    padding: 18px 20px 22px !important;
    scroll-padding-bottom: 24px;
    scrollbar-gutter: stable;
    overscroll-behavior: contain;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-aside] {
    display: none !important;
  }

  /* The tested desktop navigation stays mounted as the source of truth, while
     V10 mirrors its actions into the bottom dock. */
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-actions] {
    display: none !important;
  }

  .gdp-step1-bottom-dock {
    grid-column: 1 !important;
    grid-row: 2 !important;
    position: relative;
    z-index: 120;
    display: grid;
    grid-template-columns: minmax(150px, .6fr) minmax(220px, 1fr) minmax(180px, .7fr);
    align-items: center;
    gap: 12px;
    min-height: 68px;
    border: 1px solid #D8E0E7;
    border-radius: 17px;
    background: rgba(255, 255, 255, .98);
    padding: 9px 11px;
    box-shadow: 0 16px 42px rgba(23, 50, 77, .12);
    backdrop-filter: blur(14px);
  }

  .gdp-step1-bottom-dock__button {
    display: inline-flex;
    min-height: 46px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 13px;
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: .035em;
    text-transform: uppercase;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .gdp-step1-bottom-dock__button:hover {
    transform: translateY(-1px);
  }

  .gdp-step1-bottom-dock__button--back {
    border: 1px solid #D5DEE6;
    background: #FFFFFF;
    color: #17324D;
  }

  .gdp-step1-bottom-dock__button--back:hover {
    border-color: #9CAEBE;
    background: #F8FAFC;
  }

  .gdp-step1-bottom-dock__button--continue {
    border: 1px solid #17324D;
    background: #17324D;
    color: #FFFFFF;
    box-shadow: 0 8px 18px rgba(23, 50, 77, .16);
  }

  .gdp-step1-bottom-dock__button--continue[data-ready="false"] {
    border-color: #A9B7C3;
    background: #617487;
    box-shadow: none;
  }

  .gdp-step1-bottom-dock__status {
    min-width: 0;
    text-align: center;
  }

  .gdp-step1-bottom-dock__eyebrow {
    color: #7A8996;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .13em;
    text-transform: uppercase;
  }

  .gdp-step1-bottom-dock__message {
    margin-top: 3px;
    overflow: hidden;
    color: #17324D;
    font-size: 11px;
    font-weight: 750;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gdp-step1-bottom-dock__message[data-error="true"] {
    color: #A45B19;
  }

  /* Garment gallery: always show the entire silhouette instead of a collar crop. */
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    align-items: stretch !important;
    gap: 14px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button {
    min-height: 318px !important;
    overflow: hidden !important;
    border-color: #D8D1C7 !important;
    border-radius: 18px !important;
    background: #FFFFFF !important;
    box-shadow: 0 8px 22px rgba(23, 50, 77, .045) !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button:hover {
    border-color: #8095A8 !important;
    box-shadow: 0 14px 30px rgba(23, 50, 77, .09) !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button.border-accent {
    border: 2px solid #17324D !important;
    background: #F8FAFC !important;
    box-shadow: 0 12px 28px rgba(23, 50, 77, .10) !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :first-child {
    display: grid !important;
    width: 100% !important;
    height: 244px !important;
    min-height: 244px !important;
    place-items: center !important;
    overflow: hidden !important;
    border-bottom: 1px solid #E8E2D9;
    background: linear-gradient(145deg, #F4F1EB 0%, #ECE8E1 100%) !important;
    padding: 13px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :first-child img {
    display: block !important;
    width: auto !important;
    height: 94% !important;
    max-width: 94% !important;
    max-height: 94% !important;
    object-fit: contain !important;
    object-position: center center !important;
    transform: none !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button:hover > :first-child img {
    transform: scale(1.015) !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :last-child {
    padding: 12px 13px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :last-child .font-bold {
    color: #1B2A38 !important;
    font-size: 13px !important;
    line-height: 1.2 !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button.border-accent > :last-child .bg-accent {
    background: #17324D !important;
  }

  /* Once chosen, the garment becomes one large centered summary—not a small
     thumbnail parked against the left edge. */
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] {
    grid-template-columns: minmax(0, 820px) !important;
    justify-content: center !important;
    justify-items: center !important;
    gap: 0 !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent {
    display: grid !important;
    grid-template-columns: minmax(260px, 310px) minmax(0, 1fr) !important;
    width: min(100%, 820px) !important;
    max-width: 820px !important;
    min-height: 278px !important;
    margin: 0 auto !important;
    border: 2px solid #17324D !important;
    border-radius: 20px !important;
    background: linear-gradient(135deg, #FFFFFF 0%, #F7FAFC 100%) !important;
    box-shadow: 0 18px 42px rgba(23, 50, 77, .11) !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :first-child {
    width: 100% !important;
    height: 278px !important;
    min-height: 278px !important;
    border-right: 1px solid #E2E8EE !important;
    border-bottom: 0 !important;
    background: #EEF3F6 !important;
    padding: 18px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :first-child img {
    width: auto !important;
    height: 94% !important;
    max-width: 94% !important;
    max-height: 94% !important;
    object-fit: contain !important;
    object-position: center !important;
    transform: none !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :last-child {
    display: flex !important;
    min-width: 0 !important;
    flex-direction: column !important;
    justify-content: center !important;
    padding: 26px 28px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent::after {
    content: "Change garment" !important;
    top: 14px !important;
    right: 14px !important;
    min-height: 28px !important;
    padding: 6px 10px !important;
    border: 1px solid #D6E0E8;
    background: #FFFFFF !important;
    color: #17324D !important;
    box-shadow: 0 6px 16px rgba(23, 50, 77, .08) !important;
    font-size: 8px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-gdp-selected-summary] {
    margin-top: 13px !important;
    border-top-color: #E0E7ED !important;
    padding-top: 12px !important;
    font-size: 11px !important;
  }

  /* Configuration reads as one centered control group below the garment. */
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-step1-color],
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-step1-size-quantity],
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-step1-group],
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-step1-validation-message] {
    width: min(100%, 980px) !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-step1-color] {
    margin-top: 18px !important;
    padding-top: 16px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-step1-size-quantity] {
    margin-top: 14px !important;
    grid-template-columns: minmax(0, 1fr) minmax(170px, .32fr) !important;
    gap: 16px !important;
    border-radius: 17px !important;
    padding: 14px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-step1-group] {
    margin-top: 14px !important;
    padding-top: 14px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-step1-group] > div:first-child {
    align-items: center !important;
  }

  .gdp-custom-studio-v10[data-step1-validation="false"] [data-step1-validation-message] {
    display: none !important;
  }

  .gdp-custom-studio-v10[data-step1-validation="true"] [data-step1-validation-message] {
    display: block !important;
  }

  /* Keep the rail useful without giving it another permanent scrollbar. */
  .gdp-custom-studio-v10 .gdp-custom-studio-v7 [data-studio-rail] {
    overflow: visible !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7 [data-guide] {
    position: relative !important;
    overflow: visible !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7 [data-guide] > button > span:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7 [data-guide] > div {
    position: absolute !important;
    top: 0 !important;
    left: calc(100% + 10px) !important;
    z-index: 180 !important;
    width: 340px !important;
    max-width: min(340px, calc(100vw - 280px)) !important;
    max-height: min(72vh, 620px) !important;
    margin: 0 !important;
    overflow: auto !important;
    border: 1px solid #D7E0E7 !important;
    border-radius: 16px !important;
    background: #FFFFFF !important;
    box-shadow: 0 20px 54px rgba(23, 50, 77, .16) !important;
  }

  .gdp-step1-rail-tools {
    display: grid;
    gap: 7px;
    margin-top: 1px;
  }

  .gdp-step1-start-fresh {
    display: inline-flex;
    min-height: 40px;
    width: 100%;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    border: 1px solid #DCE3EA;
    border-radius: 12px;
    background: #FFFFFF;
    padding: 8px 10px;
    color: #566879;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
  }

  .gdp-step1-start-fresh:hover {
    border-color: #AEBBC6;
    background: #F7F9FB;
    color: #17324D;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1599px) {
  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button > :first-child {
    height: 224px !important;
    min-height: 224px !important;
  }

  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid] > button {
    min-height: 298px !important;
  }
}
`;

function exactTextElement(root, selector, text) {
  if (!root) return null;
  return Array.from(root.querySelectorAll(selector)).find((node) => String(node.textContent || "").trim() === text) || null;
}

function desktopNav(shell) {
  return shell?.querySelector?.('[data-gdp-step-nav="desktop"]') || null;
}

function navButtons(nav) {
  if (!nav) return [];
  return Array.from(nav.querySelectorAll("button")).filter((button) => button instanceof HTMLButtonElement);
}

export default function CustomStudioDesktopWorkspaceV10() {
  const hostRef = useRef(null);
  const { confirmAction } = useNotifications();
  const [stepOneActive, setStepOneActive] = useState(true);
  const [rowTarget, setRowTarget] = useState(null);
  const [railTarget, setRailTarget] = useState(null);
  const [validationVisible, setValidationVisible] = useState(false);
  const [navState, setNavState] = useState({ ready: false, hint: "Choose a garment, color and size to continue." });
  const selectedIdentityRef = useRef("");

  const sync = useCallback(() => {
    const host = hostRef.current;
    if (!host || typeof window === "undefined") return;
    const desktop = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;
    const shell = host.querySelector(".gdp-custom-studio-v7");
    const active = Boolean(desktop && shell?.dataset?.step === "1");
    setStepOneActive(active);

    const nextRow = active ? shell?.querySelector("[data-studio-row]") || null : null;
    const nextRail = active ? shell?.querySelector("[data-studio-rail]") || null : null;
    setRowTarget((current) => current === nextRow ? current : nextRow);
    setRailTarget((current) => current === nextRail ? current : nextRail);

    if (!active) return;

    const workspace = shell.querySelector("[data-workspace]") || shell.querySelector("#custom-studio-workspace");
    const validation = exactTextElement(workspace, "div", STEP_ONE_VALIDATION);
    if (validation) validation.setAttribute("data-step1-validation-message", "true");

    const selected = shell.querySelector('[data-garment-grid] > button.border-accent');
    const identity = String(selected?.querySelector(".font-bold")?.textContent || "").trim();
    if (identity !== selectedIdentityRef.current) {
      selectedIdentityRef.current = identity;
      setValidationVisible(false);
    }

    const nav = desktopNav(shell);
    const buttons = navButtons(nav);
    const primary = buttons.at(-1) || null;
    const hint = String(nav?.querySelector("p")?.textContent || "").trim();
    const ready = Boolean(primary && !primary.disabled);
    setNavState((current) => {
      const next = { ready, hint: hint || "Choose a garment, color and size to continue." };
      return current.ready === next.ready && current.hint === next.hint ? current : next;
    });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === "undefined" || typeof MutationObserver === "undefined") return undefined;

    let frame = 0;
    let stopped = false;
    const schedule = () => {
      if (stopped || frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "disabled", "data-step", "data-gdp-collapsed", "aria-expanded"],
    });
    window.addEventListener("resize", schedule);

    return () => {
      stopped = true;
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sync]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.dataset.step1Validation = validationVisible ? "true" : "false";
  }, [validationVisible]);

  const originalButtons = () => {
    const shell = hostRef.current?.querySelector(".gdp-custom-studio-v7");
    return navButtons(desktopNav(shell));
  };

  const handleBack = () => {
    const buttons = originalButtons();
    buttons[0]?.click();
  };

  const handleContinue = () => {
    const buttons = originalButtons();
    const primary = buttons.at(-1);
    if (!(primary instanceof HTMLButtonElement)) return;

    if (primary.disabled) {
      setValidationVisible(true);
      const shell = hostRef.current?.querySelector(".gdp-custom-studio-v7");
      const workspace = shell?.querySelector("[data-workspace]") || shell?.querySelector("#custom-studio-workspace");
      const sizeLabel = exactTextElement(workspace, "label", "Size");
      const target = sizeLabel?.parentElement || workspace;
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target?.animate?.(
        [
          { boxShadow: "0 0 0 0 rgba(23,50,77,0)" },
          { boxShadow: "0 0 0 4px rgba(23,50,77,.16)" },
          { boxShadow: "0 0 0 0 rgba(23,50,77,0)" },
        ],
        { duration: 760, easing: "ease-out" }
      );
      return;
    }

    setValidationVisible(false);
    primary.click();
  };

  const handleStartFresh = async () => {
    const confirmed = await confirmAction({
      eyebrow: "GDP Custom Studio",
      title: "Start a new design?",
      description: "This clears the current Custom Studio draft, garment, colors, sizes, artwork, photos, personalization and approval choices, then returns to Step 1. Your account and unrelated cart items are not affected.",
      confirmLabel: "Start fresh",
      cancelLabel: "Keep current design",
      tone: "warning",
    });
    if (!confirmed) return;

    try {
      window.localStorage.removeItem(STUDIO_DRAFT_KEY);
    } catch {
      // A true page reset still clears all live React state when storage is unavailable.
    }

    // A full route replacement is deliberate: it guarantees every in-memory editor
    // state returns to its initial value instead of attempting a partial state reset.
    window.location.replace("/custom-studio");
  };

  const statusMessage = validationVisible && !navState.ready
    ? navState.hint
    : navState.ready
      ? "Garment setup complete · ready to choose your design"
      : "Choose your garment, color and size";

  return (
    <div ref={hostRef} className="gdp-custom-studio-v10" data-step1-validation={validationVisible ? "true" : "false"}>
      <style>{styles}</style>
      <CustomStudioDesktopWorkspaceV9 />

      {stepOneActive && railTarget && createPortal(
        <div className="gdp-step1-rail-tools">
          <button type="button" className="gdp-step1-start-fresh" onClick={handleStartFresh}>
            <RotateCcw size={14} aria-hidden="true" />
            Start fresh
          </button>
        </div>,
        railTarget
      )}

      {stepOneActive && rowTarget && createPortal(
        <div className="gdp-step1-bottom-dock" aria-label="Step 1 navigation">
          <button type="button" className="gdp-step1-bottom-dock__button gdp-step1-bottom-dock__button--back" onClick={handleBack}>
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <div className="gdp-step1-bottom-dock__status" aria-live="polite">
            <div className="gdp-step1-bottom-dock__eyebrow">Step 1 of 5 · Garment</div>
            <div className="gdp-step1-bottom-dock__message" data-error={validationVisible && !navState.ready ? "true" : "false"}>{statusMessage}</div>
          </div>
          <button
            type="button"
            className="gdp-step1-bottom-dock__button gdp-step1-bottom-dock__button--continue"
            data-ready={navState.ready ? "true" : "false"}
            aria-disabled={!navState.ready}
            onClick={handleContinue}
          >
            Continue <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>,
        rowTarget
      )}
    </div>
  );
}
