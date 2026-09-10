import fs from "node:fs";

const fail = (message) => {
  console.error("Memorial Tribute verification failed:", message);
  process.exit(1);
};

const read = (path) => {
  if (!fs.existsSync(path)) fail(`Missing required file: ${path}`);
  return fs.readFileSync(path, "utf8");
};

const artworkFiles = [
  "public/images/gdp-styles/memorial-eternal-light.svg",
  "public/images/gdp-styles/memorial-heavenly-clouds.svg",
  "public/images/gdp-styles/memorial-rose-tribute.svg",
  "public/images/gdp-styles/memorial-guardian-wings.svg",
  "public/images/gdp-styles/memorial-sunset-remembrance.svg",
];

for (const path of artworkFiles) {
  const svg = read(path);
  for (const token of ['width="4500"', 'height="5400"', 'viewBox="0 0 4500 5400"']) {
    if (!svg.includes(token)) fail(`${path} is missing ${token}`);
  }
  if (/<rect[^>]+width=["']4500["'][^>]+height=["']5400["'][^>]+fill=/i.test(svg)) {
    fail(`${path} appears to contain an opaque full-canvas background`);
  }
}

const styles = read("src/lib/customStudioStyleTemplates.js");
const memorialCategoryCount = (styles.match(/category:\s*"memorial_tribute"/g) || []).length;
if (memorialCategoryCount !== 5) fail(`Expected 5 Memorial Tribute templates, found ${memorialCategoryCount}`);

for (const id of [
  "memorial-eternal-light",
  "memorial-heavenly-clouds",
  "memorial-rose-tribute",
  "memorial-guardian-wings",
  "memorial-sunset-remembrance",
]) {
  if (!styles.includes(`id: "${id}"`)) fail(`Missing template metadata for ${id}`);
}

const studio = read("src/pages/CustomStudio.jsx");
for (const required of [
  'id: "memorial"',
  'style.category === "memorial_tribute"',
  'memorialNameConfirmed',
  'memorialNameVerifiedAt',
  'designPath === "bootleg" || designPath === "memorial"',
  'I verified the memorial name is spelled exactly as it should be printed.',
  'UPLOAD THE MEMORIAL PORTRAIT',
]) {
  if (!studio.includes(required)) fail(`Custom Studio is missing required Memorial Tribute behavior: ${required}`);
}

const admin = read("src/components/admin/CustomStudioAdminModule.jsx");
if (!admin.includes("Protected design templates") || !admin.includes("Memorial Tribute")) {
  fail("Admin template management is missing Memorial Tribute controls");
}

console.log("Memorial Tribute verification passed: 5 transparent 4500×5400 masters + protected workflow + name verification + admin controls.");
