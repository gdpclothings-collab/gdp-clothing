import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CustomStudioDesktopWorkspaceV11 from "@/pages/CustomStudioDesktopWorkspaceV11";

const DESKTOP_BREAKPOINT = 1280;

const styles = `
.gdp-custom-studio-v12 {
  --gdp-guide-drawer-width: 420px;
  width: 100%;
  min-width: 0;
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  /* The guide stays attached to the left rail, but Step 1 yields the same amount
     of horizontal space while it is open so the garment choices remain visible. */
  .gdp-custom-studio-v12[data-guide-open="true"] .gdp-custom-studio-v7[data-step="1"] [data-studio-row] {
    width: calc(100% - var(--gdp-guide-drawer-width) - 16px) !important;
    transform: translateX(calc(var(--gdp-guide-drawer-width) + 16px));
    transition: width 180ms ease, transform 180ms ease;
  }

  .gdp-custom-studio-v12[data-guide-open="false"] .gdp-custom-studio-v7[data-step="1"] [data-studio-row] {
    transform: translateX(0);
    transition: width 180ms ease, transform 180ms ease;
  }

  .gdp-custom-studio-v12 .gdp-custom-studio-v7 [data-guide] > div {
    width: var(--gdp-guide-drawer-width) !important;
    max-width: var(--gdp-guide-drawer-width) !important;
    max-height: calc(100dvh - 94px) !important;
    padding: 12px 12px 16px !important;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .gdp-custom-studio-v12 .gdp-custom-studio-v7 [data-guide] > div > :first-child {
    padding-top: 28px !important;
  }

  .gdp-custom-guide-close {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1002;
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    border: 1px solid #D5DEE6;
    border-radius: 999px;
    background: #FFFFFF;
    color: #17324D;
    font-size: 19px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(23, 50, 77, .10);
    transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
  }

  .gdp-custom-guide-close:hover {
    transform: scale(1.04);
    border-color: #9EAFBE;
    background: #F7FAFC;
  }

  .gdp-custom-guide-close:focus-visible {
    outline: 2px solid #17324D;
    outline-offset: 2px;
  }

  .gdp-custom-guide-backdrop {
    position: fixed;
    inset: 0;
    z-index: 245;
    border: 0;
    background: rgba(15, 23, 42, .10);
    padding: 0;
    cursor: default;
    backdrop-filter: blur(1px);
  }

  /* The rail and drawer stay above the subtle dismissal layer. */
  .gdp-custom-studio-v12 .gdp-custom-studio-v7 [data-studio-rail] {
    z-index: 260 !important;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1500px) {
  .gdp-custom-studio-v12 {
    --gdp-guide-drawer-width: 372px;
  }
}
`;

function isDesktop() {
  return typeof window !== "undefined" && window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;
}

export default function CustomStudioDesktopWorkspaceV12() {
  const hostRef = useRef(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guidePanel, setGuidePanel] = useState(null);
  const guideButtonRef = useRef(null);

  const syncGuideState = useCallback(() => {
    const host = hostRef.current;
    if (!host || !isDesktop()) {
      setGuideOpen(false);
      setGuidePanel(null);
      guideButtonRef.current = null;
      return;
    }

    const guide = host.querySelector(".gdp-custom-studio-v7 [data-guide]");
    const button = guide?.querySelector(":scope > button") || null;
    const panel = guide?.querySelector(":scope > div") || null;
    const open = Boolean(button && button.getAttribute("aria-expanded") === "true" && panel);

    guideButtonRef.current = button instanceof HTMLButtonElement ? button : null;
    setGuideOpen((current) => current === open ? current : open);
    setGuidePanel((current) => current === panel ? current : panel);
  }, []);

  const closeGuide = useCallback((restoreFocus = true) => {
    const button = guideButtonRef.current;
    if (button && button.getAttribute("aria-expanded") === "true") {
      button.click();
      if (restoreFocus) {
        window.requestAnimationFrame(() => button.focus({ preventScroll: true }));
      }
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof MutationObserver === "undefined") return undefined;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncGuideState();
      });
    };

    syncGuideState();
    const observer = new MutationObserver(schedule);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded", "data-step", "class"],
    });
    window.addEventListener("resize", schedule);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [syncGuideState]);

  useEffect(() => {
    if (!guideOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeGuide(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeGuide, guideOpen]);

  return (
    <div
      ref={hostRef}
      className="gdp-custom-studio-v12"
      data-guide-open={guideOpen ? "true" : "false"}
    >
      <style>{styles}</style>
      <CustomStudioDesktopWorkspaceV11 />

      {guideOpen && typeof document !== "undefined" && createPortal(
        <button
          type="button"
          className="gdp-custom-guide-backdrop"
          aria-label="Close How Custom Orders Work"
          onClick={() => closeGuide(true)}
        />,
        document.body
      )}

      {guideOpen && guidePanel && createPortal(
        <button
          type="button"
          className="gdp-custom-guide-close"
          aria-label="Close How Custom Orders Work"
          title="Close"
          onClick={() => closeGuide(true)}
        >
          ×
        </button>,
        guidePanel
      )}
    </div>
  );
}
