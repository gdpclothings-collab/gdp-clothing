import React from "react";
import CustomStudioDesktopWorkspaceV10 from "@/pages/CustomStudioDesktopWorkspaceV10";

const DESKTOP_BREAKPOINT = 1280;

const styles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  /* V10 intentionally opens the order guide to the right of the navigation rail.
     The Step 1 workspace has its own higher stacking layer, so without lifting the
     rail the expanded guide is rendered behind the white workspace. */
  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-studio-rail] {
    z-index: 260 !important;
    overflow: visible !important;
  }

  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] {
    position: relative !important;
    overflow: visible !important;
  }

  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > button {
    min-height: 54px !important;
    width: 100% !important;
    max-width: 100% !important;
    align-items: center !important;
    gap: 8px !important;
    overflow: visible !important;
    border: 1px solid #D8E0E7 !important;
    border-radius: 13px !important;
    background: #FFFFFF !important;
    padding: 9px 10px !important;
    color: #17324D !important;
    text-align: left !important;
    cursor: pointer !important;
    box-shadow: 0 8px 20px rgba(23, 50, 77, .055) !important;
  }

  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > button:hover {
    border-color: #9CAEBE !important;
    background: #F8FAFC !important;
  }

  /* Restore the helper copy and the expansion affordance that V10 compressed. */
  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > button > span:first-child > span:last-child {
    display: block !important;
    margin-top: 2px !important;
    color: #667788 !important;
    font-size: 8.5px !important;
    font-weight: 650 !important;
    line-height: 1.3 !important;
  }

  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > button > span:last-child {
    display: inline-flex !important;
    flex: 0 0 auto !important;
  }

  /* Expanded How Custom Orders Work panel. Keep it next to the rail but above
     the configurator so all instructions remain readable and clickable. */
  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > div {
    position: absolute !important;
    top: 0 !important;
    left: calc(100% + 12px) !important;
    z-index: 999 !important;
    width: min(440px, calc(100vw - 280px)) !important;
    max-width: 440px !important;
    max-height: calc(100dvh - 96px) !important;
    margin: 0 !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    border: 1px solid #CDD8E1 !important;
    border-radius: 18px !important;
    background: #FFFFFF !important;
    padding: 4px !important;
    box-shadow: 0 24px 64px rgba(23, 50, 77, .22) !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > div h2,
  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > div h3 {
    font-size: 13px !important;
    line-height: 1.3 !important;
  }

  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > div p,
  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > div li {
    font-size: 11px !important;
    line-height: 1.5 !important;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1500px) {
  .gdp-custom-studio-v11 .gdp-custom-studio-v7 [data-guide] > div {
    width: min(390px, calc(100vw - 250px)) !important;
    max-width: 390px !important;
  }
}
`;

export default function CustomStudioDesktopWorkspaceV11() {
  return (
    <div className="gdp-custom-studio-v11">
      <style>{styles}</style>
      <CustomStudioDesktopWorkspaceV10 />
    </div>
  );
}
