import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, ArrowLeft, ExternalLink, HeartPulse } from "lucide-react";
import AdminV2 from "@/pages/AdminV2";
import SystemHealthModule from "@/components/admin/SystemHealthModule";

function SystemHealthPage() {
  return (
    <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
      <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm">
        <div className="h-full px-3 md:px-5 flex items-center gap-3">
          <Link to="/admin" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs shadow-sm shadow-black/30">
              GDP
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-none">GDP Clothing</div>
              <div className="text-xs text-white/70 mt-1">Commerce Admin</div>
            </div>
          </Link>

          <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75">
            <HeartPulse size={16} /> System Health
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/admin"
              className="h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"
            >
              <ArrowLeft size={15} /> Admin
            </Link>
            <Link
              to="/"
              className="hidden sm:flex h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 items-center gap-2 text-sm font-semibold"
            >
              <ExternalLink size={15} /> Storefront
            </Link>
          </div>
        </div>
      </header>

      <div className="border-b border-[#dedfe3] bg-white">
        <div className="max-w-[1600px] mx-auto px-4 md:px-7 lg:px-10 py-6 md:py-7 flex flex-col md:flex-row md:items-center gap-4 md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">GDP Commerce Admin</div>
            <h1 className="text-[28px] md:text-[32px] font-bold tracking-tight mt-1">System Health</h1>
            <p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">
              Live production health for the website, Cloudflare delivery, Supabase, Stripe, checkout, inventory, Custom Studio and GitHub deployment checks.
            </p>
          </div>
        </div>
      </div>

      <SystemHealthModule />
    </div>
  );
}

function HealthShortcut() {
  return (
    <Link
      to="/admin/system-health"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8] focus:outline-none focus:ring-2 focus:ring-[#d7193f]/30"
      aria-label="Open System Health"
    >
      <Activity size={17} />
      System Health
    </Link>
  );
}

export default function AdminV3() {
  const location = useLocation();

  if (location.pathname === "/admin/system-health") {
    return <SystemHealthPage />;
  }

  return (
    <>
      <AdminV2 />
      <HealthShortcut />
    </>
  );
}
