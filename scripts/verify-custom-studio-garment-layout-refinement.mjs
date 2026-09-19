import fs from 'node:fs';

const studio = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
const panel = fs.readFileSync('src/components/storefront/custom-studio-v2/GarmentInfoPanel.jsx', 'utf8');

const expect = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
};

expect(studio.includes("type: 'SELECT_PRODUCT'"), 'garment selection dispatch remains intact');
expect(studio.includes("type: 'SET_COLOR'"), 'color dispatch remains intact');
expect(studio.includes("type: 'SET_SIZE'"), 'size dispatch remains intact');
expect(studio.includes("type: 'SET_QUANTITY'"), 'quantity dispatch remains intact');
expect(studio.includes('variant?.price ?? product?.price'), 'variant pricing fallback remains intact');
expect(studio.includes('frontBackFee'), 'front/back fee calculation remains intact');
expect(studio.includes('data-gdp-selected-garment-configurator="true"'), 'full-width selected garment configurator is present');
expect(studio.includes('data-gdp-garment-swatch="true"'), 'color swatches are present');
expect(studio.includes('Select a size to continue'), 'required-size guidance is present');
expect(studio.includes('Selected garment'), 'selected garment summary is present');
expect(panel.includes('What is DTF?'), 'DTF explanation remains available');
expect(panel.includes('Product details'), 'product details remain available');
expect(panel.includes('Size guide'), 'size guide remains available');
expect(panel.includes('File guidelines'), 'file guidelines remain available');
expect(panel.includes('Shipping & care'), 'shipping and care remain available');
expect(panel.includes('How to order'), 'how-to-order remains available');

console.log('PASS: Custom Studio garment layout refinement contract');
