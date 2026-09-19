import fs from 'node:fs';

const page = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
const guard = fs.readFileSync('src/components/storefront/custom-studio-v2/CustomStudioV2PresentationGuard.jsx', 'utf8');
const focus = fs.readFileSync('src/components/storefront/custom-studio-v2/CustomStudioV2GarmentFocus.jsx', 'utf8');
const css = fs.readFileSync('src/components/storefront/custom-studio-v2/customStudioV2GarmentFocus.css', 'utf8');

const expect = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
};

expect(page.includes("dispatch({ type: 'SELECT_PRODUCT'"), 'canonical product selection dispatch remains in CustomStudioV2');
expect(page.includes("dispatch({ type: 'SET_COLOR'"), 'canonical color dispatch remains intact');
expect(page.includes("dispatch({ type: 'SET_SIZE'"), 'canonical size dispatch remains intact');
expect(page.includes("dispatch({ type: 'SET_QUANTITY'"), 'canonical quantity dispatch remains intact');
expect(page.includes('variant?.price ?? product?.price'), 'variant pricing fallback remains intact');
expect(page.includes('data-gdp-selected-garment-configurator="true"'), 'selected garment configurator remains intact');
expect(page.includes('data-gdp-garment-choices="top"'), 'top garment choices marker remains intact');

expect(guard.includes("CustomStudioV2GarmentFocus"), 'presentation guard installs garment focus enhancer');
expect(guard.includes("customStudioV2GarmentFocus.css"), 'presentation guard installs garment focus stylesheet');
expect(guard.indexOf('<CustomStudioV2 />') < guard.indexOf('<CustomStudioV2GarmentFocus />'), 'focus enhancer renders after canonical Studio');

expect(focus.includes("document.querySelector('[data-gdp-garment-choices=\"top\"]')"), 'focus enhancer targets only the Step 1 garment gallery');
expect(focus.includes("button[aria-pressed=\"true\"]"), 'focus enhancer derives selected garment from canonical aria state');
expect(focus.includes("data-gdp-change-garment=\"true\""), 'Change garment control is present');
expect(focus.includes("setFocused((value) => !value)"), 'Change garment toggles presentation state only');
expect(!focus.includes('dispatch('), 'focus enhancer must never dispatch Studio business state');
expect(!focus.includes('customerApi'), 'focus enhancer must not call product or customer APIs');
expect(!focus.includes('useCart'), 'focus enhancer must not touch cart state');

expect(css.includes('[data-gdp-garment-focus-mode="focused"] > [data-gdp-garment-choice-hidden="true"]'), 'non-selected garment cards hide only in focused presentation mode');
expect(css.includes('[data-gdp-garment-focus-state="browse"] [data-gdp-selected-garment-configurator="true"]'), 'configuration panel hides only while browsing garment choices');
expect(css.includes('@media (max-width: 639px)'), 'mobile focused-garment layout is explicitly guarded');

console.log('PASS: Custom Studio focused garment presentation contract');
