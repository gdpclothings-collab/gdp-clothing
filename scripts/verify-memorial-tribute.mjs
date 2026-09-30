import fs from "node:fs";

const fail = (message) => {
  console.error("Memorial Tribute verification failed:", message);
  process.exit(1);
};

const read = (path) => {
  if (!fs.existsSync(path)) fail(`Missing required file: ${path}`);
  return fs.readFileSync(path, "utf8");
};

const readBytes = (path) => {
  if (!fs.existsSync(path)) fail(`Missing required file: ${path}`);
  return fs.readFileSync(path);
};

const memorialTemplates = [
  {
    id: "memorial-eternal-light",
    name: "Crimson Eternal",
    asset: "/images/gdp-styles/memorial-crimson-eternal.avif",
  },
  {
    id: "memorial-heavenly-clouds",
    name: "Golden Grace",
    asset: "/images/gdp-styles/memorial-golden-grace.avif",
  },
  {
    id: "memorial-rose-tribute",
    name: "Heaven’s Horizon",
    asset: "/images/gdp-styles/memorial-heavens-horizon.avif",
  },
  {
    id: "memorial-guardian-wings",
    name: "Everlasting Bloom",
    asset: "/images/gdp-styles/memorial-everlasting-bloom.avif",
  },
  {
    id: "memorial-sunset-remembrance",
    name: "Angel’s Embrace",
    asset: "/images/gdp-styles/memorial-angels-embrace.avif",
  },
];

const styles = read("src/lib/customStudioStyleTemplates.js");
const memorialCategoryCount = (styles.match(/category:\s*"memorial_tribute"/g) || []).length;
if (memorialCategoryCount !== memorialTemplates.length) {
  fail(`Expected ${memorialTemplates.length} Memorial Tribute templates, found ${memorialCategoryCount}`);
}

for (const template of memorialTemplates) {
  const filePath = `public${template.asset}`;
  const bytes = readBytes(filePath);
  const signature = bytes.subarray(0, 32).toString("ascii");
  if (!signature.includes("ftypavif") && !signature.includes("ftypavis")) {
    fail(`${filePath} does not have a valid AVIF file signature`);
  }

  for (const token of [
    `id: "${template.id}"`,
    `name: "${template.name}"`,
    `thumbnail: "${template.asset}"`,
    `fullAsset: "${template.asset}"`,
    `assetUrl: "${template.asset}"`,
  ]) {
    if (!styles.includes(token)) {
      fail(`Active Memorial template mapping is missing: ${token}`);
    }
  }
}

const v2State = read("src/lib/customStudioV2State.js");
for (const required of [
  "{ id: 'memorial', label: 'Memorial Tribute Designs'",
  "memorial: { sides: pathSides(protectedSideState) }",
  "['bootleg', 'memorial', 'upload'].includes(path)",
]) {
  if (!v2State.includes(required)) {
    fail(`Custom Studio V2 state is missing required Memorial behavior: ${required}`);
  }
}

const studioV2 = read("src/pages/CustomStudioV2.jsx");
for (const required of [
  "import ProtectedTemplateEditorV2",
  "state.designPath === 'bootleg' || state.designPath === 'memorial'",
  "state.designPath === 'memorial' ? 'Memorial Tribute Studio'",
  "<ProtectedTemplateEditorV2 path={state.designPath}",
]) {
  if (!studioV2.includes(required)) {
    fail(`Custom Studio V2 is missing required Memorial wiring: ${required}`);
  }
}

const protectedEditorV2 = read("src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx");
for (const required of [
  "normalizeStyleTemplates",
  "resolveMemorialTextLayers",
  "buildMemorialTextStatePatch",
]) {
  if (!protectedEditorV2.includes(required)) {
    fail(`Protected Template Editor V2 is missing Memorial behavior: ${required}`);
  }
}

const admin = read("src/components/admin/CustomStudioAdminModule.jsx");
if (!admin.includes("Protected design templates") || !admin.includes("Memorial Tribute")) {
  fail("Admin template management is missing Memorial Tribute controls");
}

console.log("Memorial Tribute verification passed: 5 approved AVIF assets + active template mappings + protected Custom Studio V2 workflow + admin controls.");
