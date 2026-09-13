import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}
function replaceRegexOnce(source, regex, to, label) {
  const matches = [...source.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`Expected one regex target for ${label}, found ${matches.length}`);
  return source.replace(regex, to);
}

// 1) Seasonal becomes a Step-3 editor/preflight stage. It prepares production assets,
// but the shared Custom Studio owns Timing/Approval, final design creation, and cart state.
const seasonalPath = 'src/components/storefront/SeasonalStudioLayered.jsx';
let seasonal = read(seasonalPath);
seasonal = replaceOnce(seasonal, "import { useNavigate } from 'react-router-dom';\n", '', 'remove Seasonal navigate import');
seasonal = replaceOnce(seasonal, "import { useCart } from '@/lib/CartContext';\n", '', 'remove Seasonal cart import');
seasonal = replaceOnce(seasonal, "  Check,\n  ChevronDown,", "  ArrowRight,\n  Check,\n  ChevronDown,", 'add ArrowRight icon');
seasonal = replaceOnce(seasonal, "  ShoppingBag,\n", '', 'remove ShoppingBag icon');
seasonal = replaceOnce(seasonal,
  "  editCartKey = '',\n  onDraftChange = undefined,\n}) {",
  "  editCartKey = '',\n  onDraftChange = undefined,\n  onReadyForApproval = undefined,\n}) {",
  'Seasonal onReadyForApproval prop');
seasonal = replaceOnce(seasonal,
  "  const navigate = useNavigate();\n  const { addItem, replaceItem } = useCart();\n",
  '',
  'remove Seasonal cart hooks');

const preparedSave = `  const save = async () => {
    if (!visibleResolvedLayers.length || !approved || saving || saveLock.current) return;
    if (typeof onReadyForApproval !== 'function') {
      setError('Custom Studio approval flow is not ready. Please reload and try again.');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError('');
    try {
      const configurations = visibleResolvedLayers.map((entry, order) => ({
        layerId: entry.layer.id,
        order,
        artworkId: entry.artwork.id,
        artworkTitle: entry.artwork.title,
        category: entry.artwork.category,
        ...seasonalSelection(entry.artwork, entry.layout, {}, area, Number(entry.layer.rotation || 0)),
      }));
      const requestId = saveRequestId.current || crypto.randomUUID();
      saveRequestId.current = requestId;
      setCapturing(true);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await document.fonts?.ready;
      const { default: html2canvas } = await import('html2canvas');
      const printElement = document.getElementById('gdp-seasonal-production');
      if (!printElement || !approvedPreviewRef.current) throw new Error('The seasonal preview is not ready. Please try again.');
      const printRect = printElement.getBoundingClientRect();
      const previewRect = approvedPreviewRef.current.getBoundingClientRect();
      const printCanvas = await html2canvas(printElement, { backgroundColor: null, scale: Math.max(1, Number(area.width) * 300 / printRect.width), useCORS: true, logging: false, imageTimeout: 15000 });
      const mockupCanvas = await html2canvas(approvedPreviewRef.current, { backgroundColor: '#f3eee6', scale: Math.max(1, 900 / previewRect.width), useCORS: true, logging: false, imageTimeout: 15000, width: previewRect.width, height: previewRect.height, scrollX: 0, scrollY: 0 });
      const preparedAt = new Date().toISOString();
      const renderSnapshot = { version: 4, designPath: 'seasonal', layers: configurations, garment: { id: product.id, variantId: variant?.id || null, color, size } };
      const lockedHash = await digestSnapshot(renderSnapshot);
      const [productionUpload, mockupUpload] = await Promise.all([
        customerApi.uploadArtwork(new File([await canvasPng(printCanvas)], \`gdp-\${lockedHash.slice(0, 12)}-front-300dpi.png\`, { type: 'image/png' })),
        customerApi.uploadArtwork(new File([await canvasPng(mockupCanvas)], \`gdp-\${lockedHash.slice(0, 12)}-approval-preview.png\`, { type: 'image/png' })),
      ]);
      setCapturing(false);
      const artworkTitles = configurations.map((item) => item.artworkTitle);
      const collectionNames = configurations.map((item) => item.category);
      const seasonalSummary = {
        artwork: artworkTitles.join(' + '),
        artworks: artworkTitles,
        layerCount: configurations.length,
        collection: uniqueText(collectionNames),
        printSide: 'Front',
        layers: configurations.map((item) => ({
          artworkId: item.artworkId,
          artworkTitle: item.artworkTitle,
          width: Number(item.width),
          height: Number(item.height),
          rotation: Number(item.rotation || 0),
          position: { x: Number(item.x), y: Number(item.y) },
          order: item.order,
        })),
        garment: garment.label || product.name,
        color,
        size,
      };
      const designPayload = {
        productId: product.id,
        productName: product.name,
        name: artworkTitles.length === 1 ? artworkTitles[0] : \`\${artworkTitles.length} Layer Seasonal Design\`,
        designStyle: \`Seasonal Layers: \${artworkTitles.join(' + ')}\`,
        occasion: uniqueText(collectionNames),
        designMood: 'Layered original artwork',
        designIntensity: 1,
        color,
        size,
        placement: 'front',
        photoAssets: [],
        personalization: {},
        seasonalArtworkId: configurations[0]?.artworkId || null,
        seasonalConfiguration: { version: 2, layers: configurations, client_request_id: requestId },
        designPath: 'seasonal',
        renderSnapshot,
        productionFiles: { front: { path: productionUpload.storage_path, widthPx: printCanvas.width, heightPx: printCanvas.height, widthIn: Number(area.width), heightIn: Number(area.height), dpi: 300, mimeType: 'image/png' } },
        customerMockupPath: mockupUpload.storage_path,
        renderStatus: 'locked',
        lockedHash,
        preflight: { version: 2, status: 'passed', checkedAt: preparedAt, expectedSides: ['front'], dpi: 300, layerCount: configurations.length },
        proofRequired: false,
      };
      const cartItemBase = {
        productId: product.id,
        name: product.name,
        image: mockupUpload.file_url,
        isCustom: true,
        variantId: variant?.id || null,
        variant: variant?.name || garment.label,
        color,
        size,
        quantity,
        price: unitPrice,
        placement: 'front',
        fulfillmentMode: product.fulfillmentMode || 'in_house',
        designStyle: designPayload.designStyle,
        designPath: 'seasonal',
        occasion: uniqueText(collectionNames) || 'Seasonal',
        proofRequired: false,
        renderStatus: 'locked',
        ...(fabricDescription ? { fabric: fabricDescription } : {}),
        seasonalSummary,
        seasonalDraft: { version: 2, layers: cloneLayers(layers), printSide: 'front', previewZoom, reviewZoom },
      };
      onReadyForApproval({ designPayload, cartItemBase, seasonalSummary, editCartKey });
    } catch (failure) {
      setError(failure.message || 'Could not prepare this design. Please try again.');
      window.setTimeout(() => reviewErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    } finally {
      setCapturing(false);
      setSaving(false);
      saveLock.current = false;
    }
  };

  const previewConfig`;
seasonal = replaceRegexOnce(seasonal, /  const save = async \(\) => \{[\s\S]*?\n  \};\n\n  const previewConfig/, preparedSave, 'Seasonal staged save');
seasonal = seasonal.replaceAll('Final review', 'Seasonal design check');
seasonal = seasonal.replaceAll('Exact approved layered mockup · Front print', 'Exact layered mockup ready for approval · Front print');
seasonal = seasonal.replaceAll('Your design is preserved. Use Retry add to cart below.', 'Your design is preserved. Use Retry continue below.');
seasonal = seasonal.replaceAll('I approve the exact garment preview, artwork layers, overlap, order, sizes, rotations and placements. I understand this composite will be locked and printed after successful payment.', 'I’m done arranging the seasonal artwork layers, overlap, order, sizes, rotations and placements. I’ll confirm final approval in the Custom Studio approval step.');
seasonal = replaceRegexOnce(seasonal,
  /<button disabled=\{saving\} onClick=\{save\} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-\[#17324D\] px-6 py-3\.5 font-bold text-white shadow-lg transition hover:bg-\[#234766\] disabled:opacity-40"><ShoppingBag size=\{17\} \/>\{saving \? \(editCartKey \? 'Updating cart…' : 'Adding to cart…'\) : \(error \? 'Retry add to cart' : editCartKey \? 'Update cart' : 'Add design to cart'\)\}<\/button>/,
  `<button disabled={saving} onClick={save} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#17324D] px-6 py-3.5 font-bold text-white shadow-lg transition hover:bg-[#234766] disabled:opacity-40">{saving ? 'Preparing production files…' : (error ? 'Retry continue' : 'Continue to timing & approval')} <ArrowRight size={17} /></button>`,
  'Seasonal continue CTA');
// Selected objects use GDP navy; red remains reserved for destructive/error actions.
seasonal = seasonal.replace("shadow-[0_0_0_1px_rgba(217,39,62,.92),0_0_28px_rgba(217,39,62,.16)]", "shadow-[0_0_0_1px_rgba(23,50,77,.92),0_0_28px_rgba(23,50,77,.16)]");
write(seasonalPath, seasonal);

// 2) Shared Custom Studio owns the final Seasonal approval/cart transition.
const studioPath = 'src/pages/CustomStudio.jsx';
let studio = read(studioPath);
studio = replaceOnce(studio, '  const { addItem } = useCart();', '  const { addItem, replaceItem } = useCart();', 'shared cart replaceItem');
studio = replaceOnce(studio,
  '  const [seasonalDraft, setSeasonalDraft] = useState(null);\n  const [designPath, setDesignPath] = useState("");',
  '  const [seasonalDraft, setSeasonalDraft] = useState(null);\n  const [seasonalPrepared, setSeasonalPrepared] = useState(null);\n  const [designPath, setDesignPath] = useState("");',
  'seasonalPrepared state');
studio = replaceOnce(studio,
  '    seasonalDraft: seasonalDraft ? JSON.parse(JSON.stringify(seasonalDraft)) : null,\n    seasonalMode,',
  '    seasonalDraft: seasonalDraft ? JSON.parse(JSON.stringify(seasonalDraft)) : null,\n    seasonalPrepared: seasonalPrepared ? JSON.parse(JSON.stringify(seasonalPrepared)) : null,\n    seasonalMode,',
  'editor snapshot seasonal prepared');
studio = replaceOnce(studio,
  '    if (Object.prototype.hasOwnProperty.call(snapshot, "seasonalDraft")) setSeasonalDraft(snapshot.seasonalDraft);\n    if (typeof snapshot.seasonalMode === "boolean") setSeasonalMode(snapshot.seasonalMode);',
  '    if (Object.prototype.hasOwnProperty.call(snapshot, "seasonalDraft")) setSeasonalDraft(snapshot.seasonalDraft);\n    if (Object.prototype.hasOwnProperty.call(snapshot, "seasonalPrepared")) setSeasonalPrepared(snapshot.seasonalPrepared);\n    if (typeof snapshot.seasonalMode === "boolean") setSeasonalMode(snapshot.seasonalMode);',
  'restore editor seasonal prepared');
studio = replaceOnce(studio,
  '    setSeasonalDraft(null);\n    setSeasonalMode(false);\n    setRightsConfirmed(false);',
  '    setSeasonalDraft(null);\n    setSeasonalPrepared(null);\n    setSeasonalMode(false);\n    setRightsConfirmed(false);',
  'reset design seasonal prepared');
studio = replaceOnce(studio,
  '    const restoredSeasonalDraft =\n      draft.designPath === "seasonal" && draft.seasonalDraft?.artworkId\n        ? draft.seasonalDraft\n        : null;\n    setSeasonalDraft(restoredSeasonalDraft);\n    setSeasonalMode(Boolean(restoredSeasonalDraft));',
  '    const restoredSeasonalDraft =\n      draft.designPath === "seasonal" && (draft.seasonalDraft?.artworkId || draft.seasonalDraft?.layers?.length)\n        ? draft.seasonalDraft\n        : null;\n    const restoredSeasonalPrepared =\n      draft.designPath === "seasonal" && draft.seasonalPrepared?.designPayload && draft.seasonalPrepared?.cartItemBase\n        ? draft.seasonalPrepared\n        : null;\n    setSeasonalDraft(restoredSeasonalDraft);\n    setSeasonalPrepared(restoredSeasonalPrepared);\n    setSeasonalMode(Boolean(restoredSeasonalDraft) && !restoredSeasonalPrepared && Number(draft.step || 1) <= 3);',
  'restore Seasonal staged state');
studio = replaceOnce(studio,
  '    setSeasonalDraft(null);\n    setSeasonalMode(false);\n    setPendingDraft(null);',
  '    setSeasonalDraft(null);\n    setSeasonalPrepared(null);\n    setSeasonalMode(false);\n    setPendingDraft(null);',
  'start fresh staged state');
studio = replaceOnce(studio,
  '        previewZoom,\n        seasonalDraft,\n      };',
  '        previewZoom,\n        seasonalDraft,\n        seasonalPrepared,\n      };',
  'persist staged Seasonal state');
studio = replaceOnce(studio,
  'previewZoom, seasonalDraft]);',
  'previewZoom, seasonalDraft, seasonalPrepared]);',
  'draft dependency staged Seasonal');

const createStart = `  async function createAndAdd() {
    if (!rightsConfirmed || !approvalAcknowledged) return;
    if (!product?.id) {
      setWarn("Choose a garment before adding your custom design to cart.");
      return;
    }
    if (!color || !size) {
      setWarn("Choose a color and size before adding your custom design to cart.");
      return;
    }
    if (product?.variants?.length && !selectedAvailable) {
      setWarn("The selected color and size is currently unavailable. Choose another variant.");
      return;
    }

    if (designPath === "seasonal") {
      if (!seasonalPrepared?.designPayload || !seasonalPrepared?.cartItemBase) {
        setWarn("Return to Seasonal Designs and prepare the layered preview before final approval.");
        return;
      }
      setSaving(true);
      try {
        const approvedAt = new Date().toISOString();
        const normalizedSeasonalGroups = groupGarments.map((item) => {
          const groupVariant = variantFor(product, item.color, item.size);
          return {
            ...item,
            variantId: groupVariant?.id || null,
            variantName: groupVariant?.name || "",
            unitPrice: priceFor(item.color, item.size),
          };
        });
        const design = await customerApi.createCustomDesign({
          ...seasonalPrepared.designPayload,
          needByDate: needByDate || undefined,
          priority,
          customerConfirmedRights: true,
          approvalPolicyAcknowledged: true,
          customerApprovedAt: approvedAt,
          proofRequired: false,
          additionalGarments: normalizedSeasonalGroups,
          status: "in_cart",
        });
        const common = {
          ...seasonalPrepared.cartItemBase,
          customDesignId: design.id,
          ...(design.guestDesignToken ? { guestDesignToken: design.guestDesignToken } : {}),
          needByDate,
          priority,
          proofRequired: false,
          proofStatus: "approved",
          customerApprovedAt: approvedAt,
          renderStatus: "locked",
        };
        const primaryItem = {
          ...common,
          variantId: selectedVariant?.id || common.variantId || null,
          variant: selectedVariant?.name || garment.label,
          price: priceFor(color, size),
          color,
          size,
          quantity: qty,
        };
        const editCartKey = seasonalPrepared.editCartKey || location.state?.editCartKey || "";
        if (editCartKey) replaceItem(editCartKey, primaryItem);
        else addItem(primaryItem);
        normalizedSeasonalGroups.forEach((item) => addItem({
          ...common,
          variantId: item.variantId,
          variant: item.variantName || garment.label,
          price: item.unitPrice,
          color: item.color,
          size: item.size,
          quantity: Number(item.quantity || 1),
        }));
        try { window.localStorage.removeItem(STUDIO_DRAFT_KEY); } catch { /* cart completion does not depend on draft cleanup */ }
        setSeasonalPrepared(null);
        setDraftStatus("idle");
        navigate("/cart");
      } catch (error) {
        setWarn(error?.message || "Could not save your seasonal custom design.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (photos.length < minPhotos) return;
    if (!designPath || !orderDesignStyle) {
      setWarn("Complete the design path and artwork before adding to cart.");
      return;
    }
    if (designPath === "memorial" && !memorialDetailsReady) {
      setWarn("Enter the memorial name and verify its spelling before approval.");
      return;
    }

    setSaving(true);
    try {`;
studio = replaceRegexOnce(studio,
  /  async function createAndAdd\(\) \{[\s\S]*?\n    setSaving\(true\);\n    try \{/,
  createStart,
  'shared createAndAdd Seasonal branch');

studio = replaceOnce(studio,
  '    initialDraft={seasonalDraft || location.state?.seasonalDraft || null} editCartKey={location.state?.editCartKey || ""}\n    onDraftChange={setSeasonalDraft}\n    onBack={() => {setSeasonalMode(false);setStep(1);window.scrollTo({top:0,behavior:\'instant\'});}} />;',
  '    initialDraft={seasonalDraft || location.state?.seasonalDraft || null} editCartKey={location.state?.editCartKey || ""}\n    onDraftChange={(nextDraft) => { setSeasonalDraft(nextDraft); setSeasonalPrepared(null); }}\n    onReadyForApproval={(prepared) => {\n      setSeasonalPrepared(prepared);\n      setSeasonalMode(false);\n      setRightsConfirmed(false);\n      setApprovalAcknowledged(false);\n      setStep(4);\n      window.requestAnimationFrame(() => document.getElementById("custom-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }));\n    }}\n    onBack={() => {setSeasonalMode(false);setStep(2);window.scrollTo({top:0,behavior:\'instant\'});}} />;',
  'Seasonal handoff to shared approval');

studio = replaceOnce(studio,
  '  const isFinal = step >= totalSteps;\n  const disabled = isFinal ? saving || finalDisabled : !canContinue;',
  '  const isFinal = step >= totalSteps;\n  if (compact && isFinal) return null;\n  const disabled = isFinal ? saving || finalDisabled : !canContinue;',
  'remove duplicate compact final CTA');
studio = replaceOnce(studio,
  '<ReviewCard label={designPath === "upload" ? "Artwork" : "Ready layout"} value={(orderDesignStyle || "Not selected").replace(/^GDP\\s+/, "")} sub={orderDesignStyle ? `${designMood || "Original"} finish` : ""} />',
  '<ReviewCard label={designPath === "seasonal" ? "Seasonal artwork" : designPath === "upload" ? "Artwork" : "Ready layout"} value={designPath === "seasonal" ? (seasonalPrepared?.seasonalSummary?.artwork || seasonalDraft?.artworkTitle || "Layered seasonal design") : (orderDesignStyle || "Not selected").replace(/^GDP\\s+/, "")} sub={designPath === "seasonal" ? `${seasonalPrepared?.seasonalSummary?.layerCount || seasonalDraft?.layers?.length || 0} print layer(s)` : orderDesignStyle ? `${designMood || "Original"} finish` : ""} />',
  'Seasonal final review summary');
studio = replaceOnce(studio,
  '<ReviewCard label="Photos" value={photos.length + " uploaded"} sub={photos.some(p => p.quality === "replace_recommended") ? "One or more photos should ideally be replaced." : "Photo quality check complete."} />',
  '{designPath !== "seasonal" && <ReviewCard label="Photos" value={photos.length + " uploaded"} sub={photos.some(p => p.quality === "replace_recommended") ? `Print-quality warning · smallest upload ${Math.min(...photos.map((p) => Math.max(Number(p.width || 0), Number(p.height || 0)))) || 0}px on its longest edge. Replace low-resolution photos when possible.` : "Photo quality check complete."} />}',
  'actionable photo quality copy');
studio = replaceOnce(studio,
  '{showOrderPrice && <div className="mt-6 bg-secondary p-5 flex items-end justify-between gap-4"><div><div className="font-mono text-xs uppercase text-muted-foreground">Estimated custom subtotal</div><div className="text-xs text-muted-foreground mt-1">Before cart discounts, shipping, tax or coupon.</div></div><div className="font-display text-4xl">{"$" + estimatedSubtotal.toFixed(2)}</div></div>}',
  '<div className="mt-6 bg-secondary p-5 flex items-end justify-between gap-4"><div><div className="font-mono text-xs uppercase text-muted-foreground">Estimated custom subtotal</div><div className="text-xs text-muted-foreground mt-1">Garment, selected print sides and rush fee included. Cart discounts, shipping, tax and coupons are calculated later.</div></div><div className="font-display text-4xl">{"$" + estimatedSubtotal.toFixed(2)}</div></div>',
  'always-visible final custom subtotal');
write(studioPath, studio);

// 3) Checkout accurately labels locked customer approvals and prefills signed-in email.
const checkoutPath = 'src/pages/Checkout.jsx';
let checkout = read(checkoutPath);
checkout = replaceOnce(checkout,
  '  const quantityPricing = calculateCartQuantityDiscount(items);',
  `  useEffect(() => {\n    if (!user?.email) return;\n    setForm((current) => current.email ? current : { ...current, email: user.email });\n  }, [user?.email]);\n\n  const quantityPricing = calculateCartQuantityDiscount(items);`,
  'checkout account email prefill');
checkout = replaceOnce(checkout,
  '{i.isCustom && <span className="block text-[10px] font-mono uppercase text-accent">{i.occasion || "Custom"} · {i.proofRequired === false ? "Proof skipped" : "Proof before print"}</span>}',
  '{i.isCustom && <span className="block text-[10px] font-mono uppercase text-accent">{i.occasion || i.designPath || "Custom"} · {(i.proofStatus === "approved" || i.customerApprovedAt || i.renderStatus === "locked") ? "Customer approved" : i.proofRequired === false ? "Proof not required" : "Proof before print"}</span>}',
  'checkout proof status wording');
write(checkoutPath, checkout);

// 4) Step 1 wide-desktop refinement: one row for the five garment choices and no guide-label overflow.
const v10Path = 'src/pages/CustomStudioDesktopWorkspaceV10.jsx';
let v10 = read(v10Path);
v10 = replaceOnce(v10,
  '  .gdp-custom-studio-v10 .gdp-custom-studio-v7 [data-guide] > button > span:first-child > span:last-child {\n    display: none !important;\n  }',
  '  .gdp-custom-studio-v10 .gdp-custom-studio-v7 [data-guide] > button {\n    width: 100% !important;\n    max-width: 100% !important;\n    overflow: hidden !important;\n  }\n\n  .gdp-custom-studio-v10 .gdp-custom-studio-v7 [data-guide] > button > span:first-child > span:last-child,\n  .gdp-custom-studio-v10 .gdp-custom-studio-v7 [data-guide] > button > span:last-child {\n    display: none !important;\n  }',
  'guide overflow fix');
v10 = replaceOnce(v10,
  '@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1599px) {',
  `@media (min-width: 1600px) {\n  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid]:not([data-gdp-collapsed="true"]) {\n    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;\n    gap: 11px !important;\n  }\n\n  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid]:not([data-gdp-collapsed="true"]) > button {\n    min-height: 258px !important;\n  }\n\n  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid]:not([data-gdp-collapsed="true"]) > button > :first-child {\n    height: 188px !important;\n    min-height: 188px !important;\n    padding: 10px !important;\n  }\n\n  .gdp-custom-studio-v10 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid]:not([data-gdp-collapsed="true"]) > button > :first-child img {\n    width: 100% !important;\n    height: 100% !important;\n    max-width: 100% !important;\n    max-height: 100% !important;\n    object-fit: contain !important;\n    object-position: center !important;\n  }\n}\n\n@media (min-width: \${DESKTOP_BREAKPOINT}px) and (max-width: 1599px) {`,
  'wide desktop five garment grid');
write(v10Path, v10);

// 5) Revenue guard: lock the current quantity discount policy into CI instead of silently changing it.
write('scripts/verify-cart-pricing.mjs', `import assert from 'node:assert/strict';\nimport { calculateCartQuantityDiscount } from '../src/lib/cartPricing.js';\n\nconst price = (quantity, extra = {}) => [{ price: 100, quantity, ...extra }];\nassert.equal(calculateCartQuantityDiscount(price(1)).factor, 1, '1 eligible unit must have no quantity discount');\nassert.equal(calculateCartQuantityDiscount(price(2)).factor, 0.8, '2 eligible units must retain the configured 20% discount');\nassert.equal(calculateCartQuantityDiscount(price(3)).factor, 0.75, '3+ eligible units must retain the configured 25% discount');\nassert.equal(calculateCartQuantityDiscount(price(7)).factor, 0.75, '7 eligible units must stay on the 25% tier');\nconst mixed = calculateCartQuantityDiscount([{ price: 100, quantity: 2 }, { price: 50, quantity: 3, discountExempt: true }]);\nassert.equal(mixed.eligibleCount, 2);\nassert.equal(mixed.discount, 40);\nassert.equal(mixed.afterDiscount, 310);\nconsole.log('Cart pricing thresholds verified.');\n`);

write('scripts/verify-custom-studio-canonical-flow.mjs', `import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nconst seasonal = fs.readFileSync('src/components/storefront/SeasonalStudioLayered.jsx', 'utf8');\nconst studio = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');\nconst checkout = fs.readFileSync('src/pages/Checkout.jsx', 'utf8');\nassert.ok(seasonal.includes('onReadyForApproval'), 'Seasonal must hand off to shared approval');\nassert.ok(!seasonal.includes("navigate('/cart')"), 'Seasonal Step 3 must not navigate directly to cart');\nassert.ok(!seasonal.includes('useCart'), 'Seasonal Step 3 must not mutate cart directly');\nassert.ok(seasonal.includes('Continue to timing & approval'), 'Seasonal must expose canonical continue CTA');\nassert.ok(studio.includes('setStep(4)'), 'Seasonal handoff must enter shared Timing & Approval');\nassert.ok(studio.includes('seasonalPrepared?.designPayload'), 'Final approval must use staged Seasonal production data');\nassert.ok(studio.includes('proofStatus: "approved"'), 'Final Seasonal cart item must carry approval state');\nassert.ok(checkout.includes('Customer approved'), 'Checkout must show approved proof state');\nassert.ok(!checkout.includes('Proof skipped'), 'Customer-facing checkout must not use Proof skipped wording');\nconsole.log('Canonical Custom Studio approval flow verified.');\n`);

const workflowPath = '.github/workflows/build-verification.yml';
let workflow = read(workflowPath);
workflow = replaceOnce(workflow,
  '          node --check scripts/verify-photo-bootleg-desktop.mjs\n',
  '          node --check scripts/verify-photo-bootleg-desktop.mjs\n          node --check scripts/verify-cart-pricing.mjs\n          node --check scripts/verify-custom-studio-canonical-flow.mjs\n',
  'CI syntax guards');
workflow = replaceOnce(workflow,
  '      - name: Verify Custom Studio garment interactions\n        run: node scripts/verify-custom-studio-garment-interactions.mjs\n',
  '      - name: Verify Custom Studio garment interactions\n        run: node scripts/verify-custom-studio-garment-interactions.mjs\n\n      - name: Verify Custom Studio canonical approval flow\n        run: node scripts/verify-custom-studio-canonical-flow.mjs\n\n      - name: Verify cart quantity pricing policy\n        run: node scripts/verify-cart-pricing.mjs\n',
  'CI canonical and pricing guards');
write(workflowPath, workflow);

console.log('Canonical Custom Studio patch applied successfully.');
