import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/lib/CartContext";

const NAV = [
  { label: "Home", path: "/" },
  { label: "Shop", path: "/shop" },
  { label: "Collections", path: "/shop" },
  { label: "Custom Tee", path: "/custom-studio" },
  { label: "About", path: "/pages/about" },
  { label: "Contact", path: "/faq" },
];

export default function StoreNav() {
  const { itemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    navigate(`/shop?q=${encodeURIComponent(value)}`);
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const active = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path.split("?")[0]);
  };

  return (
    <header className="sticky top-0 z-50 bg-white text-black shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      <div className="bg-black text-white">
        <div className="mx-auto flex min-h-8 max-w-[1500px] items-center justify-center gap-3 px-3 text-center text-[9px] font-black uppercase tracking-[0.14em] sm:gap-4 sm:text-[10px] md:text-[11px]">
          <span>Free Shipping on Orders $100+</span>
          <span className="text-white/35">|</span>
          <span>Custom Designs Available</span>
          <span className="hidden text-white/35 sm:inline">|</span>
          <span className="hidden sm:inline">Wear Your Story</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 lg:px-8">
        <div className="flex h-[78px] items-center justify-between">
          <button type="button" className="p-2 lg:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? "Close menu" : "Open menu"}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-3" aria-label="GDP Clothing home">
            <img src="/images/gdp-logo.webp" alt="GDP Clothing" className="h-14 w-14 rounded-full object-cover sm:h-16 sm:w-16" />
            <div className="hidden sm:block">
              <div className="font-display text-3xl leading-[0.82] tracking-wide">GDP</div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.35em]">Clothing</div>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-7 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className={`relative py-2 text-sm font-semibold transition hover:text-neutral-500 ${active(item.path) ? "after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-black" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setSearchOpen((v) => !v)} className="p-2.5 transition hover:text-neutral-500" aria-label="Search">
              <Search size={23} strokeWidth={1.7} />
            </button>
            <Link to="/account" className="hidden p-2.5 transition hover:text-neutral-500 sm:block" aria-label="Account">
              <User size={23} strokeWidth={1.7} />
            </Link>
            <Link to="/cart" className="relative p-2.5 transition hover:text-neutral-500" aria-label="Cart">
              <ShoppingBag size={23} strokeWidth={1.7} />
              {itemCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] font-black text-white">{itemCount}</span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-neutral-200 bg-white">
          <form onSubmit={submitSearch} className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
            <Search size={18} className="text-neutral-400" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, custom designs..." className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-neutral-400" />
            <button type="submit" className="text-xs font-black uppercase tracking-wide">Search</button>
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="border-t border-neutral-200 bg-white lg:hidden">
          <nav className="mx-auto grid max-w-[1500px] grid-cols-2 gap-x-6 px-5 py-5">
            {NAV.map((item) => (
              <Link key={item.label} to={item.path} onClick={() => setMenuOpen(false)} className="border-b border-neutral-100 py-3 text-sm font-bold">
                {item.label}
              </Link>
            ))}
            <Link to="/account" onClick={() => setMenuOpen(false)} className="border-b border-neutral-100 py-3 text-sm font-bold sm:hidden">Account</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
