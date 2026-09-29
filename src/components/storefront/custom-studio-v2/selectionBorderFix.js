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
  `;
  document.head.appendChild(style);
}
