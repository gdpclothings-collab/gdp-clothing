import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, User, Menu, X } from "lucide-react";
import { useCart } from "@/lib/CartContext";

const NAV = [
  { label: "Home", path: "/" },
  { label: "Shop", path: "/shop" },
  { label: "Best Sellers", path: "/shop?filter=best" },
  { label: "New Arrivals", path: "/shop?filter=new" },
  { label: "T-Shirts", path: "/shop?category=T-Shirt" },
  { label: "Hoodies", path: "/shop?category=Hoodie" },
  { label: "Sweatshirts", path: "/shop?category=Sweatshirt" },
  { label: "Custom Studio", path: "/custom-studio" },
  { label: "Make It Personal", path: "/custom-studio", highlight: true },
  { label: "DTF Transfers", path: "/shop?category=DTF Transfer" },
  { label: "Track Order", path: "/account?tab=track" },
  { label: "FAQ", path: "/faq" },
  { label: "Contact", path: "/faq" },
];

export default function StoreNav() {
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const submitSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-[1500px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button className="lg:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="font-display text-3xl leading-none tracking-wide">GDP</span>
            <span className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground border-l border-border pl-2">
              Clothing · Saskatoon
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {NAV.slice(0, 9).map(n => (
              <Link key={n.label} to={n.path}
                className={`px-2.5 py-1.5 text-[13px] font-medium uppercase tracking-wide hover:text-accent transition-colors ${
                  n.highlight ? "text-accent" : ""
                }`}>
                {n.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={submitSearch} className="hidden md:flex items-center bg-secondary border border-border focus-within:border-accent transition-colors">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, collections…"
              className="bg-transparent px-3 py-2 text-sm w-44 lg:w-56 outline-none placeholder:text-muted-foreground"
              aria-label="Search"
            />
            <button type="submit" className="px-3" aria-label="Search"><Search size={16} /></button>
          </form>

          <div className="flex items-center gap-1">
            <Link to="/account" className="p-2 hover:text-accent" aria-label="Account"><User size={20} /></Link>
            <Link to="/cart" className="relative p-2 hover:text-accent" aria-label="Cart">
              <ShoppingBag size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-mono">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="hidden lg:flex border-t border-border">
          {NAV.slice(9).map(n => (
            <Link key={n.label} to={n.path}
              className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors">
              {n.label}
            </Link>
          ))}
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background">
          <form onSubmit={submitSearch} className="flex items-center bg-secondary border-y border-border m-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…" className="bg-transparent px-3 py-2.5 text-sm w-full outline-none" />
            <button type="submit" className="px-3"><Search size={18} /></button>
          </form>
          <nav className="grid grid-cols-2 px-4 pb-6 gap-1">
            {NAV.map(n => (
              <Link key={n.label} to={n.path} onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-medium uppercase tracking-wide hover:text-accent">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}