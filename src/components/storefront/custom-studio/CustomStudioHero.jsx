import React from "react";

// Brand-led studio hero: restrained dark header, illustrated garment mockups.
// Decorative drawings are examples rather than order production mockups.
export default function CustomStudioHero() {
  return (
    <div
      data-studio-hero-content
      className="relative mb-6 overflow-hidden rounded-[25px] border border-[#25334B] bg-[linear-gradient(117deg,#061224_0%,#0B1D37_66%,#182345_100%)] px-5 py-7 shadow-[0_17px_40px_rgba(11,20,37,.13)] md:px-9 md:py-9"
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-full opacity-40 sm:w-[60%] sm:opacity-75 lg:w-[48%] lg:opacity-100">
        <svg viewBox="0 0 650 225" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="gdp-hero-brush" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1749BB" />
              <stop offset="100%" stopColor="#643AAE" />
            </linearGradient>
          </defs>
          <path d="M75 235 L210 -15 H320 L169 235Z" fill="url(#gdp-hero-brush)" opacity=".4" />
          <path d="M208 230 L340 -12 H389 L268 230Z" fill="#5641C3" opacity=".21" />
          <path d="M454 222 L565 -5 H606 L493 222Z" fill="#643ECA" opacity=".17" />
          <circle cx="601" cy="62" r="58" fill="#5A39AA" opacity=".12" />
          <g transform="translate(146 -25) rotate(-7 158 120)">
            <path d="M105 67 Q133 20 160 23 Q195 20 216 68 L231 86 L264 117 L245 160 L219 148 L219 238 L105 238 L105 148 L79 160 L60 117 L93 86 Z" fill="#F0EEE8" stroke="#D1CFCB" strokeWidth="3" />
            <path d="M128 68 Q159 43 195 68 Q188 94 161 102 Q136 94 128 68Z" fill="#E5E2DA" stroke="#BDBAB5" strokeWidth="3" />
            <path d="M129 68 L148 114 M193 68 L172 114" stroke="#C6C0B6" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M139 192 Q158 179 185 192 L185 218 L139 218Z" fill="#E5E1DA" stroke="#CEC7BE" />
            <text x="162" y="160" fill="#161719" textAnchor="middle" fontSize="36" fontFamily="Arial, sans-serif" fontWeight="900" letterSpacing="-2">GDP</text>
            <text x="162" y="179" fill="#161719" textAnchor="middle" fontSize="13" fontFamily="Arial, sans-serif" fontWeight="800">CLOTHING</text>
          </g>
          <g transform="translate(357 -18) rotate(6 152 114)">
            <path d="M98 46 L134 27 Q154 48 179 27 L219 46 L269 91 L238 125 L214 107 L214 235 L105 235 L105 107 L82 125 L49 91Z" fill="#1A1C25" stroke="#0D0F16" strokeWidth="3" />
            <path d="M134 27 Q153 70 179 27" fill="none" stroke="#42434D" strokeWidth="5" />
            <path d="M113 216 H206 M49 91 L82 125 M238 125 L269 91" fill="none" stroke="#3C3C45" strokeWidth="2" />
            <path d="M115 103 L148 83 L194 117 L206 173 L152 190 L110 152Z" fill="#243F88" opacity=".85" />
            <path d="M119 166 L167 95 L192 166" fill="none" stroke="#763FE9" strokeWidth="10" opacity=".7" />
            <text x="158" y="140" fill="#F6F8FF" textAnchor="middle" fontSize="22" fontWeight="900" fontFamily="Arial, sans-serif" transform="rotate(-6 158 140)">GOOD</text>
            <text x="158" y="163" fill="#F5F7FF" textAnchor="middle" fontSize="23" fontWeight="900" fontFamily="Arial, sans-serif" transform="rotate(-6 158 163)">PEOPLE</text>
          </g>
        </svg>
      </div>
      <div className="relative z-10 max-w-[850px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-white/85 md:text-[11px]">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 tracking-[.04em]">✦ GDP Custom Studio</span>
          <span className="tracking-[.02em]">Create · Preview · Approve</span>
        </div>
        <h1 className="mt-4 max-w-[800px] font-display text-[33px] font-extrabold leading-[1.05] tracking-[-.035em] text-white sm:text-[42px] md:text-[49px]">
          Made by you. <span className="bg-gradient-to-r from-[#CE9DFB] via-[#E1B5FF] to-[#A9D1FF] bg-clip-text text-transparent">Worn your way.</span>
        </h1>
        <p className="mt-2 max-w-[600px] text-[12px] leading-relaxed text-white/85 sm:text-sm">
          Choose your garment, pick your colors and fit, then bring your artwork to life.
        </p>
      </div>
    </div>
  );
}
