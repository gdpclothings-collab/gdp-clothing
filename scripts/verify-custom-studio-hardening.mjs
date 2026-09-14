import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const v13 = fs.readFileSync('src/pages/CustomStudioDesktopWorkspaceV13.jsx', 'utf8');
const cart = fs.readFileSync('src/pages/CartV2.jsx', 'utf8');
const cartContext = fs.readFileSync('src/lib/CartContext.jsx', 'utf8');
const bridge = fs.readFileSync('src/lib/customStudioDraftBridge.js', 'utf8');

assert.ok(app.includes("CustomStudioDesktopWorkspaceV13"), 'App must route Custom Studio through V13.');
assert.ok(app.includes("CartV2"), 'App must route cart through the custom-design edit capable cart.');

assert.ok(v13.includes('nextModalOpen && nextGuideOpen'), 'Draft recovery and the order guide must be mutually exclusive.');
assert.ok(v13.includes('z-index: 1400 !important'), 'Draft recovery modal must outrank guide layers.');
assert.ok(v13.includes('customerApi.getStudioCatalog()'), 'V13 must load canonical product preview data.');
assert.ok(v13.includes('colorMockup(product, color)'), 'Selected garment color must resolve through exact catalog mockups.');
assert.ok(v13.includes('gdp-change-garment-button'), 'Change garment must be a real control.');
assert.ok(v13.includes('button:disabled'), 'Unavailable size buttons must receive contextual availability guidance.');
assert.ok(v13.includes('standardLeadDays') && v13.includes('rushLeadDays'), 'Timing validation must use configurable Standard/Rush lead times.');
assert.ok(v13.includes('dateInput.min = minDate'), 'Need-by date must have a production-aware minimum.');
assert.ok(v13.includes('estimatedPhotoDpi'), 'Review must expose effective print DPI guidance.');
assert.ok(v13.includes('Editing this design from the cart reopens it and requires approval again before checkout.'), 'Approval copy must match editable cart behavior.');
assert.ok(v13.includes('clearStudioEditIntent()'), 'Start Fresh must cancel pending edit-cart replacement intent.');
assert.ok(v13.includes('data-gdp-after-order-strip'), 'The redundant standalone After You Order strip must be suppressed.');

assert.ok(bridge.includes('captureStudioDraftForCartItem'), 'Custom cart items must preserve the Studio draft that created them.');
assert.ok(bridge.includes('STUDIO_EDIT_CART_KEY'), 'Cart editing must use an explicit short-lived edit intent.');
assert.ok(bridge.includes('EDIT_INTENT_TTL_MS'), 'Edit intent must expire instead of surviving indefinitely.');

assert.ok(cartContext.includes('captureStudioDraftForCartItem(item)'), 'CartContext must attach Custom Studio drafts before persistence.');
assert.ok(cartContext.includes('prev.some((current) => current.key === editKey)'), 'Re-approved custom edits must replace the source cart item.');
assert.ok(cartContext.includes('clearStudioEditIntent()'), 'Replacement intent must be cleared after use.');

assert.ok(cart.includes('beginStudioCartEdit(item)'), 'Cart must restore custom designs through the shared edit bridge.');
assert.ok(cart.includes('item.studioDraft || item.seasonalDraft'), 'Edit Design must be offered across saved Custom Studio paths.');
assert.ok(!cart.includes('<Spec label="Personalization" value={seasonalPersonalization(item)}'), 'Artwork-only Seasonal cart details must not show meaningless Personalization: None.');
assert.ok(cart.includes('requires approval again'), 'Cart edit helper must explain that re-approval is required.');

console.log('Custom Studio hardening guard passed.');
