import fs from 'node:fs';

const page = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
const mobileRepairCss = fs.readFileSync('src/components/storefront/custom-studio-v2/customStudioV2MobileRepair.css', 'utf8');
const presentationCleanupCss = fs.readFileSync('src/components/storefront/custom-studio-v2/customStudioV2PresentationCleanup.css', 'utf8');
const garmentControlsStart = page.indexOf('function GarmentVariantControls');
const garmentStepStart = page.indexOf('function GarmentStepV2');
const designStepStart = page.indexOf('function DesignStepV2');
const reviewStepStart = page.indexOf('function ReviewStepV2');
const editorHeadingStart = page.indexOf('function EditorHeading');
const garmentControls = page.slice(garmentControlsStart, garmentStepStart);
const garmentStep = page.slice(garmentStepStart, designStepStart);
const reviewStep = page.slice(reviewStepStart, editorHeadingStart);

const expect = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
};

expect(garmentControlsStart >= 0 && garmentStepStart > garmentControlsStart, 'GarmentVariantControls is present and isolated for inspection');
expect(garmentStepStart >= 0 && designStepStart > garmentStepStart, 'GarmentStepV2 is present and isolated for inspection');
expect(reviewStepStart >= 0 && editorHeadingStart > reviewStepStart, 'ReviewStepV2 is present and isolated for inspection');
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
expect(!garmentStep.includes('data-gdp-selected-garment-summary="true"'), 'focused step does not render a duplicate selected garment summary');
expect(garmentStep.includes('selectedProduct && !browseGarments && <GarmentVariantControls'), 'configurator only appears in focused mode');

expect(garmentControls.includes("studioV2GarmentPreview(product, state.color, 'front')"), 'selected garment preview uses the canonical color-aware garment resolver');
expect(garmentControls.includes('data-gdp-selected-garment-summary="true"'), 'selected garment summary is owned by the configurator');
expect(garmentControls.includes('data-gdp-selected-garment-preview="true"'), 'selected garment has a dedicated preview surface');
expect(garmentControls.includes('md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]'), 'selected garment preview adapts at tablet width');
expect(garmentControls.includes('lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]'), 'selected garment preview adapts at desktop width');
expect(garmentControls.includes('h-[220px]') && garmentControls.includes('sm:h-[260px]') && garmentControls.includes('lg:h-[300px]'), 'selected garment preview has responsive phone, tablet and desktop heights');
expect(garmentControls.includes('object-contain'), 'selected garment preview preserves garment proportions without cropping');
expect(garmentControls.includes('state.color') && garmentControls.includes('displayVariantLabel(state.color)'), 'selected garment color remains visible with the preview');

expect(mobileRepairCss.includes('[data-gdp-selected-garment-summary="true"]') && mobileRepairCss.includes('display: grid !important;'), 'phone presentation explicitly keeps the selected garment summary visible');
expect(mobileRepairCss.includes('[data-gdp-selected-garment-preview="true"]') && mobileRepairCss.includes('display: block !important;'), 'phone presentation explicitly keeps the selected garment image visible');
expect(!mobileRepairCss.includes('[data-gdp-selected-garment-summary="true"] {\n    display: none;'), 'phone presentation no longer hides the selected garment summary');
expect(presentationCleanupCss.includes('[data-gdp-selected-garment-summary="true"] > div:last-child > div:last-child'), 'presentation cleanup targets only the redundant DTF status pill');
expect(!presentationCleanupCss.includes('[data-gdp-selected-garment-options="true"] > div:first-child > div:last-child {\n  display: none !important;'), 'presentation cleanup no longer hides the selected garment details container');

expect(reviewStep.includes("studioV2GarmentPreview(product, state.color, 'front')"), 'final review uses the same color-aware garment resolver');
expect(reviewStep.includes('data-gdp-review-garment-preview="true"'), 'final review visibly confirms the selected garment');
expect(reviewStep.includes('object-contain'), 'final review garment preview is not cropped');

expect(!garmentStep.includes('document.'), 'GarmentStepV2 does not query or mutate the DOM');
expect(!garmentStep.includes('MutationObserver'), 'GarmentStepV2 does not use MutationObserver');
expect(!garmentStep.includes('createPortal'), 'GarmentStepV2 does not use portals');
expect(!garmentStep.includes('customerApi'), 'GarmentStepV2 does not call APIs');
expect(!garmentStep.includes('useCart'), 'GarmentStepV2 does not touch cart state');
expect(!garmentStep.includes("type: 'SET_COLOR'"), 'focused step does not duplicate color business logic');
expect(!garmentStep.includes("type: 'SET_SIZE'"), 'focused step does not duplicate size business logic');
expect(!garmentStep.includes("type: 'SET_QUANTITY'"), 'focused step does not duplicate quantity business logic');

console.log('PASS: responsive Custom Studio V2 focused garment preview contract');
