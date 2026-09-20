import fs from 'node:fs';

const page = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
const start = page.indexOf('function GarmentStepV2');
const end = page.indexOf('function DesignStepV2');
const garmentStep = page.slice(start, end);

const expect = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
};

expect(start >= 0 && end > start, 'GarmentStepV2 is present and isolated for inspection');
expect(page.includes("import React, { useEffect, useMemo, useRef, useState } from 'react';"), 'focused mode uses local React state/ref only');
expect(garmentStep.includes("const [isChoosingGarment, setIsChoosingGarment] = useState(() => !state.productId);"), 'browse/focus state is local UI state');
expect(garmentStep.includes("const previousProductIdRef = useRef(state.productId);"), 'product changes are observed without duplicating selected product state');
expect(garmentStep.includes("const firstAvailableColor = productColors(item).find((candidate) => isProductColorAvailable(item, candidate)) || '';"), 'garment selection resolves the first actually available color');
expect(garmentStep.includes("dispatch({ type: 'SELECT_PRODUCT', productId: item.id, color: firstAvailableColor });"), 'existing canonical SELECT_PRODUCT dispatch remains authoritative');
expect((garmentStep.match(/type: 'SELECT_PRODUCT'/g) || []).length === 1, 'only one product-selection dispatch exists in GarmentStepV2');
expect(garmentStep.includes('data-gdp-change-garment="true"'), 'Change garment control exists');
expect(garmentStep.includes('onClick={() => setIsChoosingGarment(true)}'), 'Change garment changes presentation state only');
expect(garmentStep.includes('data-gdp-keep-current-garment="true"'), 'Keep current garment control exists');
expect(garmentStep.includes('onClick={() => setIsChoosingGarment(false)}'), 'Keep current garment changes presentation state only');
expect(garmentStep.includes('data-gdp-selected-garment-summary="true"'), 'compact selected garment summary exists');
expect(garmentStep.includes('h-20 w-20') && garmentStep.includes('sm:h-24 sm:w-24'), 'selected garment thumbnail has an explicit compact size cap');
expect(garmentStep.includes('selectedProduct && !browseGarments && <GarmentVariantControls'), 'configurator only appears in focused mode');
expect(!garmentStep.includes('document.'), 'GarmentStepV2 does not query or mutate the DOM');
expect(!garmentStep.includes('MutationObserver'), 'GarmentStepV2 does not use MutationObserver');
expect(!garmentStep.includes('createPortal'), 'GarmentStepV2 does not use portals');
expect(!garmentStep.includes('customerApi'), 'GarmentStepV2 does not call APIs');
expect(!garmentStep.includes('useCart'), 'GarmentStepV2 does not touch cart state');
expect(!garmentStep.includes("type: 'SET_COLOR'"), 'focused UI does not duplicate color business logic');
expect(!garmentStep.includes("type: 'SET_SIZE'"), 'focused UI does not duplicate size business logic');
expect(!garmentStep.includes("type: 'SET_QUANTITY'"), 'focused UI does not duplicate quantity business logic');

console.log('PASS: safe Custom Studio V2 focused garment mode contract');
