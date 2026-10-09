import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import StoreNav from "./StoreNav";
import StoreFooter from "./StoreFooter";
import AIAssistant from "./AIAssistant";
import CookiePreferences from "./CookiePreferences";
import ProductPageEnhancements from "./ProductPageEnhancements";
import SeasonalMobileReviewEnhancer from "./SeasonalMobileReviewEnhancer";
import SeasonalStudioRuntimeGuard from "./SeasonalStudioRuntimeGuard";
import CustomStudioShellEnhancer from "./CustomStudioShellEnhancer";
import CustomStudioNavigationDock from "./CustomStudioNavigationDock";
import CustomStudioVariantAccessibilityGuard from "./CustomStudioVariantAccessibilityGuard";
import "./storeNavGlow.css";
import "./customStudioMobile.css";
import "./customStudioDesktop.css";
import "./seasonalStudioMobile.css";
import "./seasonalStudioDesktopRefinement.css";
import "./customStudioShell.css";
import "./seasonalStudioWorkspaceFix.css";
import "./customStudioMobileRegressionFix.css";

export default function Layout() {
  const location = useLocation();
  const studioActive = ["/custom-studio", "/design"].some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
  const cartActive = location.pathname === "/cart" || location.pathname.startsWith("/cart/");
  const gangSheetActive = ["/dtf-gang-sheet", "/products/dtf-gang-sheet"].includes(location.pathname.replace(/\/+$/, ""));
  const dynamicProductRoute = /^\/products\/[^/]+\/?$/.test(location.pathname) || /^\/product\/[^/]+\/?$/.test(location.pathname);
  const productActive = dynamicProductRoute && location.pathname.replace(/\/+$/, "") !== "/products/dtf-gang-sheet";

  useEffect(() => {
    if (!studioActive) return;
    document.title = "Custom Studio | GDP Clothing";
  }, [studioActive]);

  return (
    <div className={`gdp-storefront min-h-screen flex flex-col bg-background${studioActive ? " gdp-studio-active" : ""}`}>
      <StoreNav />
      <main className="flex-1">
        <Outlet />
        {productActive && <ProductPageEnhancements />}
      </main>
      {studioActive && <SeasonalMobileReviewEnhancer />}
      {studioActive && <SeasonalStudioRuntimeGuard />}
      {studioActive && <CustomStudioShellEnhancer />}
      {studioActive && <CustomStudioVariantAccessibilityGuard />}
      {studioActive && <CustomStudioNavigationDock />}
      {studioActive ? (
        <div className="mt-8 sm:mt-10" data-gdp-studio-footer="true">
          <StoreFooter />
        </div>
      ) : (
        <StoreFooter />
      )}
      {!cartActive && !gangSheetActive && <AIAssistant />}
      <CookiePreferences />
    </div>
  );
}
