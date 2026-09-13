const STYLES = `
#custom-studio-workspace button,
.gdp-studio-step-nav button {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

@media (max-width: 767px) {
  .gdp-studio-step-nav[data-gdp-step-nav="desktop"] {
    display: none !important;
  }

  .gdp-studio-step-nav[data-gdp-step-nav="mobile"] {
    position: fixed !important;
    left: 12px;
    right: 12px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 10px);
    z-index: 110;
    width: auto;
    max-width: 430px;
    margin: 0 auto !important;
    border-color: rgba(220, 227, 234, .92) !important;
    border-radius: 16px !important;
    background: rgba(255, 255, 255, .96) !important;
    padding: 8px !important;
    box-shadow: 0 18px 44px rgba(15, 23, 42, .18) !important;
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .gdp-studio-step-nav[data-gdp-step-nav="mobile"] > div:first-child {
    gap: 8px;
  }

  .gdp-studio-step-nav[data-gdp-step-nav="mobile"] button {
    min-height: 46px !important;
    flex: 1 1 0;
    justify-content: center;
    padding-inline: 12px !important;
  }

  .gdp-studio-step-nav[data-gdp-step-nav="mobile"] p {
    margin-top: 5px !important;
    text-align: center;
    font-size: 10px;
    line-height: 1.3;
  }

  .gdp-studio-active main {
    padding-bottom: calc(6.75rem + env(safe-area-inset-bottom, 0px));
  }

  .gdp-studio-active main .fixed.inset-x-3.bottom-3 {
    display: none !important;
  }
}
`;

export default function DesktopGarmentSelectionFocus() {
  // Presentation-only helper. Garment and Studio buttons are intentionally not
  // intercepted here; React remains the single owner of all click behavior.
  return <style>{STYLES}</style>;
}
