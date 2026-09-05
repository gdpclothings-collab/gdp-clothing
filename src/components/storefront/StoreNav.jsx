import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/lib/CartContext";

const NAV = [
  { label: "Shop", path: "/shop" },
  { label: "Custom", path: "/custom-studio" },
  { label: "Drops", path: "/shop?filter=new" },
  { label: "Builds", path: "/#builds" },
  { label: "Story", path: "/pages/about" },
];

export default function StoreNav() {
  const { itemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    navigate("/shop?q=" + encodeURIComponent(value));
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const active = (path) => {
    const pathname = path.split("?")[0].split("#")[0];
    if (pathname === "/") return location.pathname === "/";
    return location.pathname.startsWith(pathname);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 text-white backdrop-blur-xl">
      <div className="overflow-hidden border-b border-white/10 bg-[#e11d2e] text-white">
        <div className="gdp-marquee min-h-7 items-center whitespace-nowrap text-[9px] font-black uppercase tracking-[0.22em] sm:text-[10px]">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center">
              <span className="px-7">Free shipping on orders $100+</span>
              <span className="text-white/55">+</span>
              <span className="px-7">Custom designs available</span>
              <span className="text-white/55">+</span>
              <span className="px-7">Designed in Saskatoon</span>
              <span className="text-white/55">+</span>
              <span className="px-7">Wear your story</span>
              <span className="text-white/55">+</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 lg:px-8">
        <div className="flex h-[70px] items-center justify-between sm:h-[76px]">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-start lg:hidden"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="GDP Clothing home">
            <img src="/images/gdp-logo.webp" alt="" className="h-11 w-11 rounded-full object-cover sm:h-12 sm:w-12" />
            <div>
              <div className="font-display text-[30px] leading-[0.82] tracking-[0.08em] sm:text-[34px]">GDP</div>
              <div className="mt-1 hidden text-[8px] font-black uppercase tracking-[0.36em] text-white/50 sm:block">Clothing / YXE</div>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex" aria-label="Primary navigation">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={"relative py-3 text-[11px] font-black uppercase tracking-[0.17em] transition " + (active(item.path) ? "text-white" : "text-white/58 hover:text-white")}
              >
                {item.label}
                {active(item.path) && <span className="absolute inset-x-0 bottom-1 h-px bg-[#e11d2e]" />}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setSearchOpen((value) => !value)} className="p-2.5 text-white/80 transition hover:text-white" aria-label="Search">
              <Search size={21} strokeWidth={1.7} />
            </button>
            <Link to="/account" className="hidden p-2.5 text-white/80 transition hover:text-white sm:block" aria-label="Account">
              <User size={21} strokeWidth={1.7} />
            </Link>
            <Link to="/cart" className="relative p-2.5 text-white/80 transition hover:text-white" aria-label={"Cart with " + itemCount + " items"}>
              <ShoppingBag size={21} strokeWidth={1.7} />
              {itemCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e11d2e] px-1 text-[9px] font-black text-white">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-white/10 bg-[#0b0b0b]">
          <form onSubmit={submitSearch} className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 lg:px-8">
            <Search size={18} className="text-white/40" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, drops, custom designs..."
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/35"
            />
            <button type="submit" className="border border-white/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] transition hover:border-[#e11d2e] hover:bg-[#e11d2e]">
              Search
            </button>
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[98px] overflow-y-auto bg-[#080808] text-white lg:hidden">
          <div className="gdp-editorial-grid min-h-full px-5 py-8">
            <div className="mb-7 text-[9px] font-black uppercase tracking-[0.34em] text-white/35">GDP / Navigation</div>
            <nav className="border-t border-white/15" aria-label="Mobile navigation">
              {NAV.map((item, index) => (
                <Link
                  key={item.label}
                  to={item.path}
                  className="group flex items-center justify-between border-b border-white/15 py-5"
                >
                  <span className="font-display text-5xl leading-none tracking-wide">{item.label}</span>
                  <span className="font-mono text-[10px] text-white/35">0{index + 1}</span>
                </Link>
              ))}
              <Link to="/account" className="flex items-center justify-between border-b border-white/15 py-5 sm:hidden">
                <span className="font-display text-5xl leading-none tracking-wide">Account</span>
                <User size={20} className="text-white/45" />
              </Link>
            </nav>
            <div className="mt-8 max-w-sm text-sm leading-6 text-white/45">
              Custom apparel, photo graphics and limited pieces made around your story.
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
