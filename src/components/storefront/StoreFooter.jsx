import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Facebook, Instagram, Mail, Youtube } from "lucide-react";

export default function StoreFooter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
  };

  return (
    <footer className="border-t border-white/10 bg-[#070707] text-white">
      <div className="gdp-editorial-grid border-b border-white/10">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-12 md:grid-cols-[1fr_0.8fr] md:items-end lg:px-8 lg:py-16">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/35">GDP / drop signal</div>
            <h3 className="mt-3 max-w-3xl font-display text-6xl leading-[0.85] tracking-wide sm:text-7xl md:text-8xl">
              GET THE NEXT<br />DROP FIRST.
            </h3>
          </div>
          <div>
            <p className="max-w-md text-sm leading-6 text-white/50">
              New pieces, custom design updates and GDP releases. No clutter - just the useful stuff.
            </p>
            <form onSubmit={submit} className="mt-5 flex border-b border-white/30">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="EMAIL ADDRESS"
                className="min-w-0 flex-1 bg-transparent py-4 text-[11px] font-black uppercase tracking-[0.13em] text-white outline-none placeholder:text-white/30"
              />
              <button type="submit" className="flex items-center gap-2 py-4 pl-4 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:text-[#e11d2e]">
                {subscribed ? "Subscribed" : "Join"} <ArrowRight size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-5 py-9 lg:px-8 lg:py-11">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr_1fr]">
          <div>
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/images/gdp-logo.webp" alt="" className="h-12 w-12 rounded-full object-cover" />
              <div>
                <div className="font-display text-3xl leading-none tracking-wide">GDP CLOTHING</div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.25em] text-white/35">Good people / dope clothes</div>
              </div>
            </Link>
            <p className="mt-5 max-w-xs text-xs leading-5 text-white/38">
              Custom apparel and streetwear built around real stories, photos and moments.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="mb-4 font-mono text-[8px] uppercase tracking-[0.22em] text-white/30">Explore</div>
              <nav className="space-y-3 text-xs font-semibold text-white/65">
                <Link to="/shop" className="block hover:text-white">Shop</Link>
                <Link to="/shop?filter=new" className="block hover:text-white">Latest Drop</Link>
                <Link to="/custom-studio" className="block hover:text-white">Custom Studio</Link>
                <Link to="/#builds" className="block hover:text-white">GDP Builds</Link>
              </nav>
            </div>
            <div>
              <div className="mb-4 font-mono text-[8px] uppercase tracking-[0.22em] text-white/30">Info</div>
              <nav className="space-y-3 text-xs font-semibold text-white/65">
                <Link to="/pages/about" className="block hover:text-white">Our Story</Link>
                <Link to="/faq" className="block hover:text-white">FAQ</Link>
                <Link to="/faq" className="block hover:text-white">Shipping & Returns</Link>
                <Link to="/account" className="block hover:text-white">Account</Link>
              </nav>
            </div>
          </div>

          <div className="md:text-right">
            <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/30">Connect</div>
            <div className="mt-4 flex items-center gap-1 md:justify-end">
              <a href="https://www.instagram.com/gdpclothings" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/60 transition hover:border-white hover:text-white" aria-label="Instagram">
                <Instagram size={18} />
              </a>
              <a href="https://www.youtube.com/@GDPClothingYXE" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/60 transition hover:border-white hover:text-white" aria-label="YouTube">
                <Youtube size={18} />
              </a>
              <a href="https://www.facebook.com/gdpclothing" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/60 transition hover:border-white hover:text-white" aria-label="Facebook">
                <Facebook size={18} />
              </a>
              <a href="mailto:gdpclothings@gmail.com" className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/60 transition hover:border-white hover:text-white" aria-label="Email GDP Clothing">
                <Mail size={18} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-col justify-between gap-3 border-t border-white/10 pt-5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/28 sm:flex-row">
          <span>Copyright {new Date().getFullYear()} GDP Clothing</span>
          <span>Design your dream / wear your vision</span>
        </div>
      </div>
    </footer>
  );
}
