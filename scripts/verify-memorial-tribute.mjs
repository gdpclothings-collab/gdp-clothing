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

const artworkFiles = [
  "public/images/gdp-styles/memorial-crimson-eternal.avif",
  "public/images/gdp-styles/memorial-golden-grace.avif",
  "public/images/gdp-styles/memorial-heavens-horizon.avif",
  "public/images/gdp-styles/memorial-everlasting-bloom.avif",
  "public/images/gdp-styles/memorial-angels-embrace.avif",
];

for (const path of artworkFiles) {
  const bytes = readBytes(path);
  if (bytes.length < 40000) fail(`${path} is unexpectedly small (${bytes.length} bytes)`);
  const header = bytes.subarray(4, 32).toString("ascii");
  if (!header.includes("ftypavif") && !header.includes("ftypavis")) {
    fail(`${path} does not have a valid AVIF file signature`);
  }
}

const styles = read("src/lib/customStudioStyleTemplates.js");
const memorialCategoryCount = (styles.match(/category:\s*"memorial_tribute"/g) || []).length;
if (memorialCategoryCount !== 5) fail(`Expected 5 Memorial Tribute templates, found ${memorialCategoryCount}`);

for (const id of [
  "memorial-crimson-eternal",
  "memorial-golden-grace",
  "memorial-heavens-horizon",
  "memorial-everlasting-bloom",
  "memorial-angels-embrace",
]) {
  if (!styles.includes(`id: "${id}"`)) fail(`Missing template metadata for ${id}`);
}

for (const name of [
  "Crimson Eternal",
  "Golden Grace",
  "Heaven’s Horizon",
  "Everlasting Bloom",
  "Angel’s Embrace",
]) {
  if (!styles.includes(`name: "${name}"`)) fail(`Missing customer-facing Memorial Tribute name: ${name}`);
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

console.log("Memorial Tribute verification passed: 5 approved AVIF artwork assets + protected workflow + name verification + admin controls.");
