import React from "react";
import { Link } from "react-router-dom";

export default function AuthLayout({ icon: Icon, title, subtitle, footer = null, children }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#08131F_0%,#102A40_34%,#EDF2F6_34%,#F8FAFC_100%)] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-7 text-center text-white">
          <Link to="/" className="mb-5 inline-flex items-center justify-center" aria-label="GDP Clothing home">
            <img src="/images/gdp-logo.webp" alt="GDP Clothing" className="h-16 w-32 object-contain" />
          </Link>
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-lg backdrop-blur">
              <Icon className="h-7 w-7 text-white" aria-hidden="true" />
            </div>
            <div className="text-left"><p className="font-mono text-xs uppercase tracking-[.2em] text-white/65">GDP Clothing account</p><h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1></div>
          </div>
          {subtitle && <p className="mt-2 text-sm text-white/70">{subtitle}</p>}
        </div>
        <div className="rounded-3xl border border-white/70 bg-card p-6 shadow-[0_24px_70px_rgba(5,18,30,.22)] sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="mt-6 text-center text-sm text-[#536576]">{footer}</p>
        )}
      </div>
    </div>
  );
}
