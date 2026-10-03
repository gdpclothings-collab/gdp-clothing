import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, ArrowLeft, Banknote, BarChart3, Bot, DollarSign, ExternalLink, FileText, HeartPulse, LockKeyhole, Truck, UsersRound } from "lucide-react";
import AdminV2 from "@/pages/AdminV2";
import SalesLeads from "@/pages/SalesLeads";
import AdminShipping from "@/pages/AdminShipping";
import AdminPricing from "@/pages/AdminPricing";
import FinanceReports from "@/pages/FinanceReports";
import FinanceTax from "@/pages/FinanceTax";
import FinanceLocalSales from "@/pages/FinanceLocalSales";
import FinanceCashReconciliation from "@/pages/FinanceCashReconciliation";
import FinanceBankReconciliation from "@/pages/FinanceBankReconciliation";
import FinanceBankImport from "@/pages/FinanceBankImport";
import FinanceBankStatements from "@/pages/FinanceBankStatements";
import FinanceExpenses from "@/pages/FinanceExpenses";
import SystemHealthModule from "@/components/admin/SystemHealthModule";
import PaymentPreflightCard from "@/components/admin/PaymentPreflightCard";
import AiBusinessManagerModule from "@/components/admin/AiBusinessManagerModule";
import ProductActionsUX from "@/components/admin/ProductActionsUX";
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

function SystemHealthPage() { return <AdminShell title="System Health" subtitle="Live production health for the website, Cloudflare delivery, Supabase, Stripe, checkout, inventory, Custom Studio and GitHub deployment checks." icon={<HeartPulse size={16}/>}><div className="max-w-[1450px] mx-auto px-4 md:px-6 lg:px-8 pt-6"><PaymentPreflightCard/></div><SystemHealthModule/></AdminShell>; }
function BusinessManagerPage() { return <AdminShell title="AI Business Manager" subtitle="A safety-first, read-only operating summary that highlights business signals without changing production data." icon={<Bot size={16}/>}><AiBusinessManagerModule/></AdminShell>; }
function HealthShortcut({expanded=false}) { const [health,setHealth]=useState(null); useEffect(()=>{let active=true;const load=async()=>{try{const snapshot=await systemHealthApi.loadSnapshot();if(active)setHealth(snapshot);}catch{if(active)setHealth(null);}};load();const timer=window.setInterval(load,60000);return()=>{active=false;window.clearInterval(timer);};},[]);const status=health?.status||"unknown";const dotClass=status==="healthy"?"bg-emerald-500":status==="critical"?"bg-red-500":status==="warning"?"bg-amber-500":"bg-slate-400";const scoreLabel=Number.isFinite(Number(health?.score))?`${health.score}%`:"Check";const statusLabel=status==="healthy"?"Healthy":status==="critical"?"Critical":status==="warning"?"Warning":"Checking";const paymentCheck=Array.isArray(health?.checks)?health.checks.find((check)=>check?.key==="payment-preflight"):null;const paymentLabel=paymentCheck?.status==="healthy"?"Payments ready":paymentCheck?.status==="critical"?"Payments need attention":paymentCheck?.status==="warning"?"Payments checking":"Payments checking";return <Link data-gdp-admin-home-health={expanded?"true":undefined} to="/admin/system-health" className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8] ${expanded?"max-w-[calc(100vw-2.5rem)]":""}`} aria-label="Open System Health"><span className="relative grid place-items-center"><Activity size={17}/><span className={`absolute -right-1 -top-1 w-2 h-2 rounded-full ring-2 ring-white ${dotClass}`}/></span><span className={expanded?"flex min-w-0 flex-col leading-tight":""}><span>System Health</span>{expanded&&<span className="mt-0.5 truncate text-[11px] font-medium text-[#6b6f76]">{statusLabel} · {paymentLabel}</span>}</span><span className="rounded-md bg-[#f0f1f3] px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{scoreLabel}</span></Link>;}
function SalesShortcut(){return <Link to="/admin/sales-leads" className="fixed bottom-20 right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]"><UsersRound size={17}/><span>Sales Leads</span></Link>;}
function AiShortcut(){return <Link to="/admin/ai-manager" className="fixed bottom-[8.75rem] right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]"><Bot size={17}/><span>AI Manager</span></Link>;}
function ShippingShortcut(){return <Link to="/admin/shipping-delivery" className="fixed bottom-[12.5rem] right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Shipping & Delivery"><Truck size={17}/><span>Shipping & Delivery</span></Link>;}
function PricingShortcut(){return <Link to="/admin/pricing" className="fixed bottom-[16.25rem] right-5 z-40 inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Apparel Pricing"><DollarSign size={17}/><span>Apparel Pricing</span></Link>;}
function FinanceShortcuts(){return <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 flex flex-wrap justify-center items-center gap-2 max-w-[calc(100vw-2rem)]"><Link to="/admin/finance/reports" className="inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Finance Reports"><BarChart3 size={17}/><span>Finance Reports</span></Link><Link to="/admin/finance/local-sales" className="inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Local Sales"><Banknote size={17}/><span>Local Sales</span></Link><Link to="/admin/finance/expenses" className="inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Expense Controls"><FileText size={17}/><span>Expenses</span></Link><Link to="/admin/finance/cash-reconciliation" className="inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Cash Reconciliation"><Banknote size={17}/><span>Cash Close</span></Link><Link to="/admin/finance/bank-reconciliation" className="inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Bank Reconciliation"><Banknote size={17}/><span>Bank Reconciliation</span></Link><Link to="/admin/finance/bank-import" className="inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Bank Statement Import"><FileText size={17}/><span>Bank CSV Import</span></Link><Link to="/admin/finance/bank-statements" className="inline-flex items-center gap-2 rounded-xl border border-[#d6d8dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#25272b] shadow-lg shadow-black/10 hover:bg-[#f7f7f8]" aria-label="Open Bank Statement Close"><LockKeyhole size={17}/><span>Bank Close</span></Link></div>;}

export default function AdminV3(){
  const location=useLocation();
  if(location.pathname==="/admin/system-health") return <SystemHealthPage/>;
  if(location.pathname==="/admin/sales-leads") return <SalesLeads/>;
  if(location.pathname==="/admin/ai-manager") return <BusinessManagerPage/>;
  if(location.pathname==="/admin/shipping-delivery") return <AdminShipping/>;
  if(location.pathname==="/admin/pricing") return <AdminPricing/>;
  if(location.pathname==="/admin/finance/reports") return <FinanceReports/>;
  if(location.pathname==="/admin/finance/tax") return <FinanceTax/>;
  if(location.pathname==="/admin/finance/local-sales") return <FinanceLocalSales/>;
  if(location.pathname==="/admin/finance/expenses") return <FinanceExpenses/>;
  if(location.pathname==="/admin/finance/cash-reconciliation") return <FinanceCashReconciliation/>;
  if(location.pathname==="/admin/finance/bank-reconciliation") return <FinanceBankReconciliation/>;
  if(location.pathname==="/admin/finance/bank-import") return <FinanceBankImport/>;
  if(location.pathname==="/admin/finance/bank-statements") return <FinanceBankStatements/>;
  const onProductsPage=location.pathname==="/admin/products";
  const onFinancePage=location.pathname==="/admin/finance";
  const onAdminHome=location.pathname==="/admin";
  return <><AdminV2/>{onProductsPage&&<ProductActionsUX/>}{onFinancePage&&<FinanceShortcuts/>}<PricingShortcut/><ShippingShortcut/><AiShortcut/><SalesShortcut/><HealthShortcut expanded={onAdminHome}/></>;
}
