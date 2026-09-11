import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import StoreNav from "./StoreNav";
import StoreFooter from "./StoreFooter";
import AIAssistant from "./AIAssistant";
import CookiePreferences from "./CookiePreferences";
import SeasonalMobileReviewEnhancer from "./SeasonalMobileReviewEnhancer";
import CustomStudioShellEnhancer from "./CustomStudioShellEnhancer";
import "./customStudioMobile.css";
import "./customStudioDesktop.css";
import "./seasonalStudioMobile.css";
import "./customStudioShell.css";

export default function Layout() {
  const location = useLocation();
  const studioActive = ["/custom-studio", "/design"].some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
  );
  const cartActive = location.pathname === "/cart" || location.pathname.startsWith("/cart/");

  return (
    <div className={`gdp-storefront min-h-screen flex flex-col bg-background${studioActive ? " gdp-studio-active" : ""}`}>
      <StoreNav />
      <main className="flex-1">
        <Outlet />
      </main>
      {studioActive && <SeasonalMobileReviewEnhancer />}
      {studioActive && <CustomStudioShellEnhancer />}
      {!studioActive && <StoreFooter />}
      {!cartActive && <AIAssistant />}
      <CookiePreferences />
    </div>
  );
}
