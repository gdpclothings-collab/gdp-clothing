import fs from "node:fs";

function text(path) {
  return fs.readFileSync(path, "utf8");
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing admin production-file control: ${label}`);
  }
}

const api = text("src/lib/adminProductionApi.js");
const module = text("src/components/admin/ProductionModule.jsx");

requireText(api, 'from("custom_designs")', "production board resolves linked custom designs");
requireText(api, 'production_files, seasonal_artwork_id, seasonal_configuration', "production file and seasonal metadata query");
requireText(api, '.createSignedUrl(path, expiresIn)', "private production files use signed storage URLs");
requireText(api, 'signedStorageUrl("customer-uploads", file.path)', "customer production PNG signing");
requireText(api, 'signedStorageUrl(SEASONAL_BUCKET, seasonalConfiguration.production_path)', "seasonal production master signing");
requireText(api, 'requiredProductionSides(row.placement)', "front/back required-side preservation");
requireText(api, 'production_design: item.custom_design_id', "production design attached to order item");
requireText(api, 'mockupUrl: await signedStorageUrl("customer-uploads", mockupPath)', "approved mockup signing");

requireText(module, "function productionItemReady(item)", "per-item print readiness guard");
requireText(module, 'design.renderStatus === "locked" || Boolean(design.seasonalArtworkId)', "locked and seasonal approval compatibility");
requireText(module, "customItems.every(productionItemReady)", "all custom items must be production-file ready");
requireText(module, 'key === "printFileAttached" && checked && !customPrintFilesReady', "print-file checklist confirmation guard");
requireText(module, 'status === "printing" && !readyForProduction', "printing transition remains blocked until ready");
requireText(module, "data-gdp-production-files={item.id}", "production file group marker");
requireText(module, "data-gdp-production-file-side={side}", "per-side production file marker");
requireText(module, "design?.mockupUrl || item.image", "signed approved mockup preferred in production drawer");
requireText(module, "Print {prettify(side)} PNG", "front/back production download controls");
requireText(module, "Missing required {missingSides.map(prettify).join", "missing-side warning");

console.log("Admin production print-file readiness verified.");
