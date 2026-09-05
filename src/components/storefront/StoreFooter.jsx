import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";

export default function StoreFooter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <footer className="bg-primary text-primary-foreground mt-20">
      <div className="border-b border-primary-foreground/15">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-12 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="font-display text-4xl md:text-5xl leading-none">JOIN THE GDP MOVEMENT</h3>
            <p className="mt-2 text-primary-foreground/70 text-sm">Drops, custom design tips & subscriber-only discounts.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (email) setDone(true); }}
            className="flex gap-2">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-primary-foreground/10 border border-primary-foreground/20 px-4 py-3 text-sm placeholder:text-primary-foreground/40 outline-none focus:border-accent" />
            <button className="bg-accent text-accent-foreground px-6 py-3 text-sm font-bold uppercase tracking-wide hover:opacity-90">
              {done ? "Subscribed ✓" : "Subscribe"}
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-12 grid md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="font-display text-3xl">GDP</div>
          <p className="mt-3 text-primary-foreground/60">Design Your Dream, Wear Your Vision! Custom apparel & print-on-demand streetwear from Saskatoon, Saskatchewan.</p>
          <div className="flex gap-3 mt-4">
            <a href="https://www.facebook.com/gdpclothing" target="_blank" rel="noopener noreferrer" className="p-2 border border-primary-foreground/20 hover:border-accent hover:text-accent" aria-label="Facebook"><Facebook size={16} /></a>
            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="p-2 border border-primary-foreground/20 hover:border-accent hover:text-accent" aria-label="Instagram"><Instagram size={16} /></a>
            <a href="mailto:hello@gdpclothing.ca" className="p-2 border border-primary-foreground/20 hover:border-accent hover:text-accent" aria-label="Email"><Mail size={16} /></a>
          </div>
        </div>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground/50 mb-3">Shop</h4>
          <ul className="space-y-2 text-primary-foreground/80">
            <li><Link to="/shop" className="hover:text-accent">All Products</Link></li>
            <li><Link to="/custom-studio" className="hover:text-accent">GDP Custom Studio</Link></li>
            <li><Link to="/shop?category=DTF Transfer" className="hover:text-accent">DTF Transfers</Link></li>
            <li><Link to="/shop?filter=best" className="hover:text-accent">Best Sellers</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground/50 mb-3">Support</h4>
          <ul className="space-y-2 text-primary-foreground/80">
            <li><Link to="/account" className="hover:text-accent">My Account</Link></li>
            <li><Link to="/account?tab=track" className="hover:text-accent">Track Order</Link></li>
            <li><Link to="/faq" className="hover:text-accent">FAQ</Link></li>
            <li><Link to="/contact" className="hover:text-accent">Contact</Link></li>
            <li><Link to="/faq" className="hover:text-accent">Shipping & Returns</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground/50 mb-3">Visit Us</h4>
          <ul className="space-y-2 text-primary-foreground/80">
            <li className="flex gap-2"><MapPin size={16} className="shrink-0" /> Saskatoon, SK, Canada</li>
            <li className="flex gap-2"><Phone size={16} className="shrink-0" /> (306) 555-GDP1</li>
            <li className="flex gap-2"><Mail size={16} className="shrink-0" /> hello@gdpclothing.ca</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-5 flex flex-col sm:flex-row justify-between gap-2 text-xs text-primary-foreground/50 font-mono">
          <span>© {new Date().getFullYear()} GDP CLOTHING. ALL RIGHTS RESERVED.</span>
          <div className="flex gap-4">
            <Link to="/faq" className="hover:text-accent">Privacy Policy</Link>
            <Link to="/faq" className="hover:text-accent">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}