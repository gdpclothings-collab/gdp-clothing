import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { storefrontContentApi } from "@/lib/storefrontContentApi";

const FALLBACK_NAV = [
  { label: "Home", path: "/" },
  { label: "Shop", path: "/shop" },
  { label: "Collections", path: "/shop?view=collections" },
  { label: "Custom Tee", path: "/custom-studio" },
  { label: "About", path: "/pages/about" },
  { label: "Contact", path: "/pages/contact" },
];

export default function StoreNav() {
  const { itemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [navItems, setNavItems] = useState(FALLBACK_NAV);

  useEffect(() => {
    let active = true;
    storefrontContentApi
      .getMenu("main-menu")
      .then((menu) => {
        const items = (menu?.navigation_items || [])
          .filter((item) => item.url)
          .map((item) => ({ label: item.label, path: item.url }));
        if (active && items.length) setNavItems(items);
      })
      .catch((error) => {
        console.error("Store navigation load failed:", error);
      });
    return () => {
      active = false;
    };
  }, []);

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
  }, [location.pathname, location.search, location.hash]);

  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    navigate("/shop?q=" + encodeURIComponent(value));
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const active = (path) => {
    if (!path || /^https?:\/\//i.test(path)) return false;
    const [rawPathname, rawQuery = ""] = path.split("?");
    const pathname = rawPathname.split("#")[0];
    if (pathname === "/") return location.pathname === "/";
    if (rawQuery) {
      return location.pathname === pathname && location.search === "?" + rawQuery;
    }
    return location.pathname === pathname && !location.search;
  };

  const NavLink = ({ item, mobile = false }) => {
    const external = /^https?:\/\//i.test(item.path || "");
    const className = mobile
      ? "flex items-center justify-between border-b border-white/12 py-5 text-3xl font-black uppercase tracking-tight"
      : "relative py-2 text-[12px] font-medium transition " + (active(item.path) ? "text-white" : "text-white/72 hover:text-white");

    if (external) {
      return <a href={item.path} className={className}>{item.label}</a>;
    }

    return (
      <Link to={item.path || "/"} className={className}>
        {item.label}
        {!mobile && active(item.path) && <span className="absolute inset-x-0 -bottom-1 h-px bg-white" />}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080909] text-white">
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-10">
        <div className="flex h-[70px] items-center justify-between">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-start lg:hidden"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/" className="flex shrink-0 items-center" aria-label="GDP Clothing home">
            <img src="/images/gdp-logo.webp" alt="GDP Clothing" className="h-12 w-[92px] object-contain object-left" />
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex" aria-label="Primary navigation">
            {navItems.map((item) => <NavLink key={item.label + item.path} item={item} />)}
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen((value) => !value)}
              className="p-2.5 text-white/82 transition hover:text-white"
              aria-label="Search"
            >
              <Search size={21} strokeWidth={1.7} />
            </button>
            <Link to="/account" className="hidden p-2.5 text-white/82 transition hover:text-white sm:block" aria-label="Account">
              <User size={21} strokeWidth={1.7} />
            </Link>
            <Link to="/cart" className="relative p-2.5 text-white/82 transition hover:text-white" aria-label={"Cart with " + itemCount + " items"}>
              <ShoppingBag size={22} strokeWidth={1.7} />
              {itemCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-black text-black">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-white/10 bg-[#0b0b0b]">
          <form onSubmit={submitSearch} className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-6">
            <Search size={18} className="text-white/40" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search GDP Clothing"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/35"
            />
            <button type="submit" className="border border-white/25 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] hover:bg-white hover:text-black">
              Search
            </button>
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[70px] overflow-y-auto bg-[#080909] lg:hidden">
          <nav className="px-5 py-5" aria-label="Mobile navigation">
            {navItems.map((item) => <NavLink key={item.label + item.path} item={item} mobile />)}
            <Link to="/account" className="flex items-center justify-between border-b border-white/12 py-5 text-3xl font-black uppercase tracking-tight sm:hidden">
              Account <User size={20} className="text-white/50" />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
