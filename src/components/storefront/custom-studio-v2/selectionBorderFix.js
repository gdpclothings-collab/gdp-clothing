const STYLE_ID = 'gdp-custom-studio-v2-selection-border-fix';

if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-gdp-upload-artwork-layer="true"],
    [data-seasonal-v2-layer],
    [data-gdp-bootleg-free-photo-layer="true"],
    [data-gdp-memorial-free-photo-layer="true"],
    [data-gdp-sticker-layer-id],
    [data-gdp-bootleg-template-layer="true"],
    [data-gdp-memorial-template-layer="true"],
    div:has(> img[alt="Customer photo layer"]) {
      --tw-ring-offset-shadow: 0 0 #0000 !important;
      --tw-ring-shadow: 0 0 #0000 !important;
      box-shadow: none !important;
      outline: none !important;
    }

    /* Keep the printable-area helper transparent so the selected garment
       remains visible beneath the dashed guide. */
    [data-gdp-print-guide="true"] {
      background-color: transparent !important;
    }

    /* Empty Photo Zone helpers previously added a dark grey tint. Keep the
       wording and dashed boundary, but remove the fill and use neutral text. */
    [data-gdp-print-guide="true"] [class*="bg-slate-900/10"] {
      background-color: transparent !important;
      border-color: rgb(148 163 184 / 0.7) !important;
      color: rgb(100 116 139) !important;
      text-shadow: 0 1px 2px rgb(255 255 255 / 0.85);
    }

    /* Adapt the empty Photo Zone helper to the garment below it. Difference
       blending keeps the helper dark on light garments and light on dark
       garments without adding a fill or hard-coding garment color names. */
    [data-gdp-print-guide="true"] [class*="bg-slate-900/10"] {
      color: rgb(255 255 255) !important;
      border-color: rgb(255 255 255 / 0.72) !important;
      mix-blend-mode: difference;
      text-shadow: none !important;
    }

    /* Bootleg/Memorial empty-template message: keep the guidance while
       removing the dark banner so the garment preview remains unobstructed. */
    div:has(> [data-gdp-print-guide="true"])
      > div[class*="bottom-4"][class*="bg-slate-950/80"] {
      bottom: 0.75rem !important;
      padding: 0.6rem 0.9rem !important;
      background-color: rgb(255 255 255 / 0.82) !important;
      border: 1px solid rgb(226 232 240 / 0.95) !important;
      color: rgb(71 85 105) !important;
      box-shadow: 0 2px 10px rgb(15 23 42 / 0.08) !important;
      backdrop-filter: blur(2px);
    }

    /* Make the mobile interaction helper beneath Bootleg/Memorial previews
       easier to scan without changing any editor state or gestures. */
    div:has(> div > [data-gdp-print-guide="true"]) > p[class*="text-slate-400"] {
      margin-top: 0.45rem !important;
      padding-inline: 0.5rem !important;
      color: rgb(100 116 139) !important;
      font-size: 0.6875rem !important;
      line-height: 1.15rem !important;
    }

    /* Keep the active-layer status obvious without letting the old cyan bar
       dominate the garment preview. Applies only to Bootleg/Memorial editor
       status elements that already expose dedicated data attributes. */
    [data-gdp-bootleg-active-status="true"],
    [data-gdp-memorial-active-status="true"] {
      margin-bottom: 0.6rem !important;
      padding: 0.5rem 0.75rem !important;
      border-color: rgb(226 232 240) !important;
      background-color: rgb(248 250 252 / 0.92) !important;
      color: rgb(51 65 85) !important;
      box-shadow: inset 3px 0 0 rgb(15 23 42 / 0.9);
      font-size: 0.72rem !important;
      line-height: 1rem !important;
    }
  `;
  document.head.appendChild(style);
}
