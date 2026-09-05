import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, Youtube } from "lucide-react";

export default function StoreFooter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
  };

  return (
    <footer className="bg-[#0a0a0a] text-white">
      <div className="border-b border-white/10">
        <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-9 md:grid-cols-[1fr_auto] md:items-center lg:px-8">
          <div>
            <h3 className="font-display text-4xl leading-none sm:text-5xl">Join the GDP Family</h3>
            <p className="mt-2 text-sm text-white/60">
              Get new drops, custom design updates and special offers.
            </p>
          </div>
          <form onSubmit={submit} className="flex w-full max-w-xl">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email address"
              className="min-w-0 flex-1 bg-white px-4 py-3 text-sm text-black outline-none placeholder:text-neutral-500"
            />
            <button
              type="submit"
              className="bg-[#e11d2e] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white sm:px-7"
            >
              {subscribed ? "Subscribed ✓" : "Subscribe"}
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-5 py-8 lg:px-8">
        <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white font-display text-2xl">
              GDP
            </div>
            <div>
              <div className="font-display text-2xl leading-none">GDP Clothing</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/50">
                Good People. Dope Clothes.
              </div>
            </div>
          </Link>

          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/75">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/shop" className="hover:text-white">Shop</Link>
            <Link to="/custom-studio" className="hover:text-white">Custom</Link>
            <Link to="/pages/about" className="hover:text-white">About</Link>
            <Link to="/faq" className="hover:text-white">Contact</Link>
            <Link to="/faq" className="hover:text-white">Shipping & Returns</Link>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="https://www.instagram.com/gdpclothings"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/75 hover:text-white"
              aria-label="Instagram"
            >
              <Instagram size={20} />
            </a>
            <a
              href="https://www.youtube.com/@GDPClothingYXE"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/75 hover:text-white"
              aria-label="YouTube"
            >
              <Youtube size={21} />
            </a>
            <a
              href="https://www.facebook.com/gdpclothing"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/75 hover:text-white"
              aria-label="Facebook"
            >
              <Facebook size={20} />
            </a>
            <a
              href="mailto:gdpclothings@gmail.com"
              className="p-2 text-white/75 hover:text-white"
              aria-label="Email GDP Clothing"
            >
              <Mail size={20} />
            </a>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-white/10 pt-5 text-[11px] text-white/40 sm:flex-row">
          <span>© {new Date().getFullYear()} GDP Clothing. All rights reserved.</span>
          <span>Design your dream. Wear your vision.</span>
        </div>
      </div>
    </footer>
  );
}
