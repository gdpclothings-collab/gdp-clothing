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
requireText(api, "async function assertProductionEntryReady(orderId)", "API-boundary production readiness guard");
requireText(api, '"id, production_status, production_checklist, order_items(is_custom, custom_design_id)"', "production entry reads current checklist and custom links");
requireText(api, '["not_started", "queued"].includes(order.production_status)', "only first production entry is guarded");
requireText(api, "PRODUCTION_CHECKS.find", "API requires every pre-production checklist item");
requireText(api, "function systemManagedDesignRow(row)", "API classifies canonical locked or seasonal designs");
requireText(api, "function hasProductionSide(row, side)", "API validates underlying production file paths");
requireText(api, "if (!systemManagedDesignRow(design)) continue", "manual proof compatibility remains intact at API boundary");
requireText(api, "requiredProductionSides(design.placement).filter", "API checks all required print sides");
requireText(api, 'if (status !== "production_queue")', "all first transitions beyond queue use readiness guard");
requireText(api, "await assertProductionEntryReady(orderId)", "status mutation cannot bypass readiness guard");

requireText(module, "function systemManagedProductionDesign(design)", "system-managed production classifier");
requireText(module, 'design.renderStatus === "locked" || Boolean(design.seasonalArtworkId)', "locked and seasonal approval compatibility");
requireText(module, "function productionItemReady(item)", "per-item print readiness guard");
requireText(module, "if (!systemManagedProductionDesign(design)) return true", "legacy manual proof compatibility");
requireText(module, "managedCustomItems.every(productionItemReady)", "all system-managed custom items must be production-file ready");
requireText(module, 'key === "printFileAttached" && checked && !customPrintFilesReady', "print-file checklist confirmation guard");
requireText(module, 'status === "printing" && !readyForProduction', "printing transition remains blocked until ready");
requireText(module, "data-gdp-production-files={item.id}", "production file group marker");
requireText(module, "data-gdp-production-file-side={side}", "per-side production file marker");
requireText(module, "design?.mockupUrl || item.image", "signed approved mockup preferred in production drawer");
requireText(module, "Print {prettify(side)} PNG", "front/back production download controls");
requireText(module, "Missing required {missingSides.map(prettify).join", "missing-side warning");
requireText(module, "Manual proof workflow", "legacy manual proof guidance remains available");

console.log("Admin production print-file readiness verified.");
