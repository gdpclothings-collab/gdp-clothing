import React, { useEffect, useRef } from "react";
import CustomStudioDesktopWorkspaceV2 from "@/pages/CustomStudioDesktopWorkspaceV2";

const DESKTOP_BREAKPOINT = 1280;

const refinementStyles = `
@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-v3 .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) {
    max-width: 1840px !important;
  }

  .gdp-custom-studio-v3 .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div {
    left: calc(100% + 10px) !important;
    width: min(470px, calc(100vw - 270px)) !important;
    max-height: min(520px, calc(100dvh - 112px)) !important;
  }

  .gdp-custom-studio-v3 .gdp-custom-studio-shell-v2 > div > div:has(> div > #custom-studio-workspace) > div:has(> div > [data-gdp-step-nav="desktop"]) > :nth-child(3) > div > div:first-child > div {
    grid-template-columns: 1fr !important;
  }

  .gdp-custom-studio-v3 .gdp-custom-studio-shell-v2:not([data-gdp-active-step="3"]) aside > [data-gdp-design-path] {
    position: sticky !important;
    top: 0 !important;
    z-index: 4 !important;
    width: 100% !important;
    margin: 0 !important;
  }

  .gdp-custom-studio-v3 .gdp-custom-studio-shell-v2:not([data-gdp-active-step="3"]) aside > [data-gdp-design-path] > :nth-child(2) {
    height: clamp(430px, 56dvh, 610px) !important;
  }

  .gdp-custom-studio-v3 .gdp-custom-studio-shell-v2:not([data-gdp-active-step="3"]) aside > [data-gdp-design-path] + div {
    margin-top: 12px !important;
    border-radius: 18px !important;
    padding: 16px !important;
  }

  .gdp-custom-studio-v3 .gdp-custom-studio-shell-v2:not([data-gdp-active-step="3"]) aside [data-gdp-studio-preview="live"] {
    min-height: 430px !important;
  }

  .gdp-custom-studio-v3 .gdp-custom-studio-shell-v2:not([data-gdp-active-step="3"]) aside > [data-gdp-design-path] + div .font-display {
    font-size: 1.6rem !important;
    line-height: 1 !important;
  }
}
`;

function clearInlineLayout(node) {
  if (!node) return;
  [
    "display", "gridTemplateColumns", "gridTemplateRows", "gridColumn", "gridRow",
    "width", "height", "minHeight", "maxHeight", "overflow", "overflowX", "overflowY",
    "position", "top", "alignSelf", "paddingRight"
  ].forEach((key) => {
    node.style[key] = "";
  });
}

export default function CustomStudioDesktopWorkspaceV3() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return undefined;

    const media = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    let resizeObserver = null;

    const applyLayout = () => {
      const shell = root.querySelector(".gdp-custom-studio-shell-v2");
      const workspace = shell?.querySelector("#custom-studio-workspace");
      const row = workspace?.parentElement;
      const aside = row?.querySelector(":scope > aside");
      const previewCard = aside?.querySelector(":scope > [data-gdp-design-path]");
      const orderCard = previewCard?.nextElementSibling;
      const step = Number(shell?.dataset?.gdpActiveStep || 1);

      if (!shell || !workspace || !row || !aside || !previewCard) return;

      if (!media.matches) {
        [row, workspace, aside, previewCard, orderCard].forEach(clearInlineLayout);
        return;
      }

      if (step === 3) {
        [row, workspace, aside, previewCard, orderCard].forEach(clearInlineLayout);
        return;
      }

      row.style.display = "grid";
      row.style.gridTemplateColumns = "minmax(0, 1fr) minmax(520px, 0.92fr)";
      row.style.gridTemplateRows = "minmax(0, 1fr)";
      row.style.width = "100%";
      row.style.height = "calc(100dvh - 154px)";
      row.style.minHeight = "570px";
      row.style.maxHeight = "calc(100dvh - 154px)";
      row.style.overflow = "hidden";

      workspace.style.gridColumn = "1";
      workspace.style.gridRow = "1";
      workspace.style.width = "100%";
      workspace.style.height = "100%";
      workspace.style.minHeight = "0";
      workspace.style.maxHeight = "100%";
      workspace.style.overflowY = "auto";
      workspace.style.overflowX = "clip";

      aside.style.gridColumn = "2";
      aside.style.gridRow = "1";
      aside.style.width = "100%";
      aside.style.height = "100%";
      aside.style.minHeight = "0";
      aside.style.maxHeight = "100%";
      aside.style.overflowY = "auto";
      aside.style.overflowX = "clip";
      aside.style.paddingRight = "4px";
      aside.style.alignSelf = "stretch";

      previewCard.style.display = "block";
      previewCard.style.position = "sticky";
      previewCard.style.top = "0px";
      previewCard.style.width = "100%";

      if (orderCard) {
        orderCard.style.display = "block";
        orderCard.style.width = "100%";
      }
    };

    const shell = root.querySelector(".gdp-custom-studio-shell-v2");
    const mutationObserver = new MutationObserver(applyLayout);
    if (shell) {
      mutationObserver.observe(shell, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-gdp-active-step", "class"]
      });
    }

    const onResize = () => window.requestAnimationFrame(applyLayout);
    window.addEventListener("resize", onResize);
    media.addEventListener?.("change", onResize);

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(onResize);
      if (shell) resizeObserver.observe(shell);
    }

    window.requestAnimationFrame(() => window.requestAnimationFrame(applyLayout));

    return () => {
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      media.removeEventListener?.("change", onResize);
    };
  }, []);

  return (
    <div ref={rootRef} className="gdp-custom-studio-v3">
      <style>{refinementStyles}</style>
      <CustomStudioDesktopWorkspaceV2 />
    </div>
  );
}
