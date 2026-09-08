import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import StoreNav from "./StoreNav";
import StoreFooter from "./StoreFooter";
import AIAssistant from "./AIAssistant";
import CookiePreferences from "./CookiePreferences";

export default function Layout() {
  const location = useLocation();
  const studioActive = location.pathname.startsWith("/custom-studio");

  return (
    <div className="gdp-storefront min-h-screen flex flex-col bg-background">
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
