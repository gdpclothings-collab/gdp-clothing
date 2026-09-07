import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const failures = [];
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message);
};
const forbidMatch = (source, pattern, message) => {
  if (pattern.test(source)) failures.push(message);
};

const studio = read("src/pages/CustomStudio.jsx");
const product = read("src/pages/ProductDetail.jsx");
const cart = read("src/lib/CartContext.jsx");
const checkout = read("src/pages/Checkout.jsx");

forbidMatch(studio, /useState\("GDP Classic 90s"\)/, "Custom Studio must not preselect a GDP style.");
forbidMatch(studio, /useState\("Cool"\)/, "Custom Studio must not preselect a mood.");
forbidMatch(studio, /setDesignStyle\(initialTemplate\.name\)/, "Custom Studio must not select the first enabled style during hydration.");
forbidMatch(studio, /setSize\(sizes\[0\]/, "Custom Studio must not auto-select the first size.");
forbidMatch(studio, /styleTemplate\s*\|\|\s*GDP_STYLE_TEMPLATES\[0\]/, "Preview must not inject the first GDP style as a fallback.");
requireMatch(studio, /const activeStyleTemplate = designStyle \?/, "Custom Studio must explicitly guard style-template resolution.");
requireMatch(studio, /setSize\(""\)/, "Custom Studio must clear incompatible size selections instead of replacing them.");

forbidMatch(product, /setColor\(nextProduct\?\.colors\?\.\[0\]/, "Product page must not preselect the first color.");
forbidMatch(product, /setSize\(nextProduct\?\.sizes\?\.\[0\]/, "Product page must not preselect the first size.");
requireMatch(product, /selectionComplete/, "Product page must require explicit option selection.");

requireMatch(cart, /scopedStorageKey/, "Cart storage must be scoped per guest/user.");
requireMatch(checkout, /scopedStorageKey/, "Checkout session storage must be scoped per guest/user.");

if (failures.length) {
  console.error("Fresh-session verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Fresh-session and customer-storage isolation checks passed.");
