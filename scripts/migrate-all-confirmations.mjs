import fs from "node:fs";

const files = [
  "src/pages/Admin.jsx",
  "src/pages/TemplateManager.jsx",
  "src/pages/AdminMediaOptimizer.jsx",
  "src/components/storefront/SeasonalStudioLayered.jsx",
  "src/components/admin/SettingsModule.jsx",
  "src/components/admin/ProductsModule.jsx",
  "src/components/admin/OrdersModule.jsx",
  "src/components/admin/MaintenanceAccessPasswordControl.jsx",
  "src/components/admin/MaintenanceModeControl.jsx",
  "src/components/admin/LandingPageModule.jsx",
  "src/components/admin/DraftOrdersModule.jsx",
];

const asyncMarkers = {
  "src/pages/TemplateManager.jsx": [
    ["const restoreDefault = (styleId) =>", "const restoreDefault = async (styleId) =>"],
  ],
  "src/components/admin/ProductsModule.jsx": [
    ["const clearSelectedMediaAssignments = () =>", "const clearSelectedMediaAssignments = async () =>"],
    ["const retireSelectedVariants = () =>", "const retireSelectedVariants = async () =>"],
    ["const generateVariantMatrix = () =>", "const generateVariantMatrix = async () =>"],
    ["const removeVariant = (index) =>", "const removeVariant = async (index) =>"],
  ],
  "src/components/admin/LandingPageModule.jsx": [
    ["const restoreDefaults = () =>", "const restoreDefaults = async () =>"],
  ],
};

function addImport(source) {
  const statement = 'import { requestConfirmation } from "@/lib/NotificationContext";\n';
  if (source.includes(statement.trim())) return source;
  return statement + source;
}

function replaceExactlyOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return source.replace(before, after);
}

for (const path of files) {
  let source = fs.readFileSync(path, "utf8");
  const original = source;

  source = addImport(source);

  for (const [before, after] of asyncMarkers[path] || []) {
    source = replaceExactlyOnce(source, before, after, `${path} async marker`);
  }

  if (path === "src/components/storefront/SeasonalStudioLayered.jsx") {
    source = replaceExactlyOnce(
      source,
      "onClick={() => { if (window.confirm('Remove all seasonal artwork layers?')) {",
      "onClick={async () => { if (await requestConfirmation({ tone: 'destructive', title: 'Clear all seasonal artwork?', description: 'Every seasonal artwork layer on this fabric will be removed. This action can be undone from the editor history.', confirmLabel: 'Clear all layers', cancelLabel: 'Keep layers' })) {",
      "Seasonal Studio clear-all confirmation"
    );
  }

  source = source.replace(/window\.confirm\s*\(/g, "await requestConfirmation(");

  if (source === original) {
    throw new Error(`${path}: migration made no changes`);
  }
  if (/window\.confirm\s*\(/.test(source)) {
    throw new Error(`${path}: native confirm remains after migration`);
  }

  fs.writeFileSync(path, source);
}

const remaining = [];
for (const path of walk("src")) {
  if (!/\.(?:js|jsx|ts|tsx)$/.test(path)) continue;
  const source = fs.readFileSync(path, "utf8");
  if (/window\.confirm\s*\(/.test(source)) remaining.push(path);
}

if (remaining.length) {
  throw new Error(`Native browser confirmations remain in: ${remaining.join(", ")}`);
}

console.log(`Migrated ${files.length} files. No window.confirm calls remain in src/.`);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}
