import React, { useEffect, useState } from "react";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { DEFAULT_LANDING_PAGE } from "@/lib/landingPageDefaults";
import { isLandingDraftPreview, storefrontContentApi } from "@/lib/storefrontContentApi";

function ManagedLogo({ src, alt }) {
  const [currentSrc, setCurrentSrc] = useState(src || "/images/gdp-logo.webp");

  useEffect(() => {
    setCurrentSrc(src || "/images/gdp-logo.webp");
  }, [src]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className="h-11 w-[78px] object-contain object-left"
      onError={() => {
        if (currentSrc !== "/images/gdp-logo.webp") setCurrentSrc("/images/gdp-logo.webp");
      }}
    />
  );
}

export default function StoreFooter() {
  const [landing, setLanding] = useState(DEFAULT_LANDING_PAGE);
  const previewDraft = isLandingDraftPreview();

  useEffect(() => {
    let active = true;
    storefrontContentApi
      .getHomepage({ previewDraft })
      .then((data) => {
        if (active && data) setLanding(data);
      })
      .catch((error) => {
        console.error("Store footer content load failed:", error);
      });

    return () => {
      active = false;
    };
  }, [previewDraft]);

  const branding = landing.branding || DEFAULT_LANDING_PAGE.branding;
  const footer = landing.footer || DEFAULT_LANDING_PAGE.footer;
  const social = footer.social || DEFAULT_LANDING_PAGE.footer.social;

  return (
    <footer className="border-t border-white/10 bg-[#080909] text-white">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <div className="flex items-center gap-4">
          <Link to="/" aria-label="GDP Clothing home">
            <ManagedLogo
              src={branding.footerLogoUrl || branding.logoUrl}
              alt={branding.logoAlt || "GDP Clothing"}
            />
          </Link>
          <div className="border-l border-white/15 pl-4">
            <div className="text-[10px] font-medium text-white/70 sm:text-xs">
              {footer.tagline}
            </div>
            {footer.description && (
              <div className="mt-1 max-w-xl text-[10px] leading-4 text-white/45 sm:text-[11px]">
                {footer.description}
              </div>
            )}
            {footer.copyrightText && (
              <div className="mt-1 text-[9px] text-white/35 sm:text-[10px]">
                {footer.copyrightText}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {social.instagram && (
            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white hover:text-black"
              aria-label="Instagram"
            >
              <Instagram size={18} />
            </a>
          )}
          {social.youtube && (
            <a
              href={social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white hover:text-black"
              aria-label="YouTube"
            >
              <Youtube size={18} />
            </a>
          )}
          {social.facebook && (
            <a
              href={social.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white hover:text-black"
              aria-label="Facebook"
            >
              <Facebook size={18} />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
