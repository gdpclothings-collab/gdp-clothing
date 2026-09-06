import React from "react";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { Link } from "react-router-dom";

export default function StoreFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#080909] text-white">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <div className="flex items-center gap-4">
          <Link to="/" aria-label="GDP Clothing home">
            <img src="/images/gdp-logo.webp" alt="GDP Clothing" className="h-11 w-[78px] object-contain object-left" />
          </Link>
          <div className="border-l border-white/15 pl-4 text-[10px] font-medium text-white/70 sm:text-xs">
            Good People. Dope Clothes.
          </div>
        </div>

        <div className="flex items-center gap-1">
          <a
            href="https://www.instagram.com/gdpclothings"
            target="_blank"
            rel="noopener noreferrer"
            className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white hover:text-black"
            aria-label="Instagram"
          >
            <Instagram size={18} />
          </a>
          <a
            href="https://www.youtube.com/@GDPClothingYXE"
            target="_blank"
            rel="noopener noreferrer"
            className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white hover:text-black"
            aria-label="YouTube"
          >
            <Youtube size={18} />
          </a>
          <a
            href="https://www.facebook.com/gdpclothing"
            target="_blank"
            rel="noopener noreferrer"
            className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white hover:text-black"
            aria-label="Facebook"
          >
            <Facebook size={18} />
          </a>
        </div>
      </div>
    </footer>
  );
}
