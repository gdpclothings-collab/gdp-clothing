import fs from "node:fs";

const appSource = fs.readFileSync("src/App.jsx", "utf8");
const studioSource = fs.readFileSync("src/pages/CustomStudio.jsx", "utf8");
const workspaceSource = fs.readFileSync("src/pages/CustomStudioDesktopWorkspace.jsx", "utf8");
const garmentStepSource = fs.readFileSync("src/components/storefront/custom-studio/GarmentStep.jsx", "utf8");

function fail(message) {
  console.error(`FAIL Custom Studio garment interaction guard: ${message}`);
  process.exit(1);
}

if (/DesktopGarmentSelectionFocus/.test(appSource)) {
  fail("DesktopGarmentSelectionFocus must not be imported or mounted in App.jsx because it can intercept native garment-card clicks.");
}

if (!appSource.includes("CustomStudioDesktopWorkspace'))")) {
  fail("App.jsx must route Custom Studio through the unified desktop workspace.");
}

if (/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(appSource)) {
  fail("App.jsx must not route through the retired V7-V13 wrapper chain.");
}

if (!workspaceSource.includes('import CustomStudio from "@/pages/CustomStudio"')) {
  fail("The unified workspace must import the core CustomStudio directly.");
}

if (/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(workspaceSource)) {
  fail("The unified workspace must not nest any retired V7-V13 wrapper.");
}

if (!garmentStepSource.includes('onClick={() => chooseProduct(option)}')) {
  fail("The native Step 1 garment-card chooseProduct click handler is missing.");
}

if (!garmentStepSource.includes('key={option.id}')) {
  fail("The Step 1 garment-card mapping no longer exposes stable product identity.");
}

if (!studioSource.includes('data-studio-shell') || !studioSource.includes('data-workspace')) {
  fail("Core CustomStudio must retain the shell and workspace semantic annotations.");
}

if (!garmentStepSource.includes('data-garment-grid') || !garmentStepSource.includes('data-step1-size')) {
  fail("GarmentStep must own the extracted garment-grid and Step 1 semantic annotations.");
}

if (!workspaceSource.includes('document.addEventListener("pointerup", onPointerUp, true)')) {
  fail("The unified workspace must retain pointer-up garment recovery.");
}

if (!workspaceSource.includes("pending.card.click()")) {
  fail("The unified workspace must retry a swallowed native garment-card click.");
}

if (!workspaceSource.includes("gdpOriginalSrc") || !workspaceSource.includes("restoreExpandedGarmentImages")) {
  fail("The unified workspace must snapshot and restore catalog thumbnails when the chooser expands.");
}

if (!workspaceSource.includes("createPortal") || !workspaceSource.includes("gdp-step1-bottom-dock")) {
  fail("The unified workspace must keep the portal-based Step 1 bottom action dock.");
}

if (!workspaceSource.includes("object-fit: contain !important")) {
  fail("The unified workspace must force full-garment containment.");
}

if (!workspaceSource.includes('grid-template-columns: minmax(0, 820px) !important')) {
  fail("The unified workspace must keep the selected garment centered in a bounded configurator card.");
}

if (!workspaceSource.includes("customerApi.getStudioCatalog()") || !workspaceSource.includes("colorMockup(product, color)")) {
  fail("The unified workspace must resolve selected garment thumbnails from canonical product/color mockup data.");
}

if (!workspaceSource.includes("gdp-change-garment-button") || !workspaceSource.includes("Change garment")) {
  fail("The unified workspace must provide a real accessible Change garment control.");
}

if (!workspaceSource.includes("position: sticky !important") || !workspaceSource.includes(".gdp-step1-bottom-dock")) {
  fail("The unified workspace must keep Step 1 navigation visible while the workspace scrolls.");
}

if (!workspaceSource.includes('const STUDIO_DRAFT_KEY = "gdp.custom-studio.draft.v2"') || !workspaceSource.includes('window.location.replace("/custom-studio")')) {
  fail("Start Fresh must still clear the saved draft and perform a clean Studio reload.");
}

if (!workspaceSource.includes("clearStudioEditIntent()")) {
  fail("Start Fresh must clear pending cart-edit replacement intent.");
}

console.log("PASS Custom Studio garment interaction guard");
console.log("- App routes through one unified workspace instead of retired versioned wrappers");
console.log("- pointer recovery, catalog restoration, exact-color mockups, full-garment layout and sticky navigation remain protected");
console.log("- Step 1 native garment interactions and semantic hooks remain protected after component extraction");