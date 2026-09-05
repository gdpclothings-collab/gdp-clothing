import React from "react";
import { Outlet } from "react-router-dom";
import StoreNav from "./StoreNav";
import StoreFooter from "./StoreFooter";
import AIAssistant from "./AIAssistant";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <StoreNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <StoreFooter />
      <AIAssistant />
    </div>
  );
}