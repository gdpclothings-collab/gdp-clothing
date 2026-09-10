import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import StoreNav from "./StoreNav";
import StoreFooter from "./StoreFooter";
import AIAssistant from "./AIAssistant";
import CookiePreferences from "./CookiePreferences";
import "./customStudioMobile.css";

export default function Layout() {
  const location = useLocation();
  const studioActive = ["/custom-studio", "/design"].some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
  );

  return (
    <div className={`gdp-storefront min-h-screen flex flex-col bg-background${studioActive ? " gdp-studio-active" : ""}`}>
      <StoreNav />
      <main className="flex-1">
        <Outlet />
      </main>
      {!studioActive && <StoreFooter />}
      <AIAssistant />
      <CookiePreferences />
    </div>
  );
}
