import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, ArrowLeft, Bot, ExternalLink, HeartPulse, UsersRound } from "lucide-react";
import AdminV2 from "@/pages/AdminV2";
import SalesLeads from "@/pages/SalesLeads";
import SystemHealthModule from "@/components/admin/SystemHealthModule";
import AiBusinessManagerModule from "@/components/admin/AiBusinessManagerModule";
import { systemHealthApi } from "@/lib/systemHealthApi";

function AdminShell({ title, subtitle, icon, children }) {
  return <div className="gdp-admin min-h-screen bg-[#f4f5f7] text-[#171717]">
    <header className="sticky top-0 z-40 h-16 bg-[#111214] text-white border-b border-white/10 shadow-sm"><div className="h-full px-3 md:px-5 flex items-center gap-3">
      <Link to="/admin" className="flex items-center gap-2 shrink-0"><div className="w-8 h-8 rounded-lg bg-[#d7193f] text-white grid place-items-center font-black text-xs shadow-sm shadow-black/30">GDP</div><div className="hidden sm:block"><div className="text-sm font-semibold leading-none">GDP Clothing</div><div className="text-xs text-white/70 mt-1">Commerce Admin</div></div></Link>
      <div className="mx-auto hidden md:flex items-center gap-2 text-sm text-white/75">{icon} {title}</div>
      <div className="ml-auto flex items-center gap-2"><Link to="/admin" className="h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15}/> Admin</Link><Link to="/" className="hidden sm:flex h-9 px-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 items-center gap-2 text-sm font-semibold"><ExternalLink size={15}/> Storefront</Link></div>
    </div></header>
    <div className="border-b border-[#dedfe3] bg-white"><div className="max-w-[1600px] mx-auto px-4 md:px-7 lg:px-10 py-6 md:py-7"><div className="text-xs uppercase tracking-[0.14em] font-bold text-[#a70f2d]">GDP Commerce Admin</div><h1 className="text-[28px] md:text-[32px] font-bold tracking-tight mt-1">{title}</h1><p className="text-base leading-6 text-[#555961] mt-1 max-w-3xl">{subtitle}</p></div></div>
    {children}
  </div>;
}

function SystemHealthPage() { return <AdminShell title="System Health" subtitle="Live production health for the website, Cloudflare delivery, Supabase, Stripe, checkout, inventory, Custom Studio and GitHub deployment checks." icon={<HeartPulse size={16}/>}><SystemHealthModule/></AdminShell>; }
function BusinessManagerPage() { return <AdminShell title="AI Business Manager" subtitle="A safety-first, read-only operating summary that highlights business signals without changing production data." icon={<Bot size={16}/>}><AiBusinessManagerModule/></AdminShell>; }

function HealthShortcut() {
  const [health, setHealth] = useState(null);
  useEffect(() => { let active=true; const load=async()=>{try{const snapshot=await systemHealthApi.loadSnapshot();if(active)setHealth(snapshot);}catch{if(active)setHealth(null);}}; load(); const timer=window.setInterval(load,60000); return()=>{active=false;window.clearInterval(timer);}; },[]);
  const status=health?.status||"unknown"; const dotClass=status==="healthy"?"bg-emerald-500":status==="critical"?"bg-red-500":status==="warning"?"bg-amber-500":"bg-slate-400"; const scoreLabel=Number.isFinite(Number(health?.score))?`${health.score}%`:"Check";
  return <Link to="/admin/system-health" className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open System Health"><span className="relative grid place-items-center"><Activity size={17}/><span className={`absolute -right-1 -top-1 w-2 h-2 rounded-full ring-2 ring-white ${dotClass}`}/></span><span>System Health</span><span className="rounded-md bg-[#f0f1f3] px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{scoreLabel}</span></Link>;
}
function SalesShortcut(){return <Link to="/admin/sales-leads" className="fixed bottom-20 right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]"><UsersRound size={17}/><span>Sales Leads</span></Link>;}
function AiShortcut(){return <Link to="/admin/ai-manager" className="fixed bottom-[8.75rem] right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]"><Bot size={17}/><span>AI Manager</span></Link>;}

export default function AdminV3(){
  const location=useLocation();
  if(location.pathname==="/admin/system-health") return <SystemHealthPage/>;
  if(location.pathname==="/admin/sales-leads") return <SalesLeads/>;
  if(location.pathname==="/admin/ai-manager") return <BusinessManagerPage/>;
  return <><AdminV2/><AiShortcut/><SalesShortcut/><HealthShortcut/></>;
}
