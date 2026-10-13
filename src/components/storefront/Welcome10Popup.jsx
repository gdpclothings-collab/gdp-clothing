import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { customerApi } from "@/lib/customerApi";

const KEY = "gdp-welcome10-dismissed-at";
const WEEK = 7 * 24 * 60 * 60 * 1000;
export default function Welcome10Popup() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let cancelled = false;
    let timer;
    // Runtime API check ensures a dormant campaign never displays an unusable code.
    customerApi.getWelcome10Status().then(({ enabled }) => {
      if (cancelled || !enabled) return;
      try {
        const last = Number(window.localStorage.getItem(KEY) || 0);
        if (last && Date.now() - last < WEEK) return;
      } catch { /* private browsing */ }
      timer = window.setTimeout(() => {
        if (!cancelled) setOpen(true);
      }, 5000);
    }).catch(() => {});
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);
  const dismiss = () => {
    setOpen(false);
    try { window.localStorage.setItem(KEY, String(Date.now())); } catch { /* private browsing */ }
  };
  useEffect(() => {
    if (!open) return;
    const escape = (event) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="welcome10-title" className="relative w-full max-w-md rounded-2xl bg-white p-7 text-center text-neutral-950 shadow-2xl">
        <button type="button" aria-label="Close welcome offer" onClick={dismiss} className="absolute right-3 top-3 rounded-full p-2 text-xl focus-visible:outline focus-visible:outline-2">×</button>
        <p className="text-xs font-bold uppercase tracking-[.25em]">Good People. Dope Clothes.</p>
        <h2 id="welcome10-title" className="mt-5 text-3xl font-black uppercase">Welcome to GDP Clothing</h2>
        <p className="mt-3 text-4xl font-black">10% OFF</p>
        <p className="mt-2">Your first eligible order. Maximum discount C$15. Cannot be combined with other offers. Verified email sign-in required.</p>
        <div className="mt-5 rounded-lg border-2 border-dashed border-neutral-400 p-3 font-bold tracking-widest">WELCOME10</div>
        <button type="button" className="mt-3 text-sm underline" onClick={() => navigator.clipboard?.writeText("WELCOME10")}>Copy code</button>
        <Link to="/shop" onClick={dismiss} className="mt-5 block rounded-lg bg-black px-5 py-3 font-bold text-white">Shop now</Link>
      </section>
    </div>
  );
}
