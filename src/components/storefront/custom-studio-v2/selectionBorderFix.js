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
  `;
  document.head.appendChild(style);
}
