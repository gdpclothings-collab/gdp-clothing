
import assert from "node:assert/strict";
import { getAssistantResponse } from "../src/components/storefront/gdpAssistantKnowledge.js";
import {
  adaptWebsiteAssistantResponse,
  findExplicitProductMention,
  formatDiscountLine,
  isProductSellable,
  normalizeText,
  scoreKnowledge,
  selectProductMatches,
  toMessengerQuickReplies,
  verifyMetaSignature,
} from "../functions/api/messenger.js";

assert.equal(normalizeText("Hello 👋   WORLD"), "hello world");

const knowledge = [
  {
    intent: "greeting",
    keywords: ["hello", "hi"],
    priority: 100,
    requires_human: false,
    active: true,
  },
  {
    intent: "order_support",
    keywords: ["refund", "cancel order", "charged twice"],
    priority: 190,
    requires_human: true,
    active: true,
  },
];

assert.equal(
  scoreKnowledge("Hi, I need a refund", knowledge)?.intent,
  "order_support",
  "Sensitive order support must win over greeting replies.",
);

const products = [
  { name: "Adult Pullover Hoodie", slug: "adult-pullover-hoodie", tags: [] },
  { name: "Adult Short Sleeve Tee", slug: "adult-short-sleeve-tee", tags: [] },
  { name: "Gildan Crewneck Adult Sweatshirt", slug: "gildan-crewneck-adult-sweatshirt", tags: [] },
];

assert.equal(
  selectProductMatches("How much is the hoodie?", products, 3)?.[0]?.slug,
  "adult-pullover-hoodie",
  "Hoodie pricing questions should rank the hoodie first.",
);

const explicitProducts = [
  { id: "generic", name: "Adult Pullover Hoodie", slug: "adult-pullover-hoodie" },
  { id: "vintage", name: "Vintage Bootleg Hoodie", slug: "vintage-bootleg-hoodie" },
];
assert.equal(
  findExplicitProductMention("How much is the Vintage Bootleg Hoodie?", explicitProducts)?.id,
  "vintage",
  "An explicitly named unavailable product must be recognized before generic category fallback.",
);
assert.equal(
  findExplicitProductMention("How much is a hoodie?", explicitProducts),
  null,
  "Generic category questions should not be treated as an exact product mention.",
);

const stockedProductIds = new Set(["in-stock-product"]);
assert.equal(
  isProductSellable(
    { id: "out-of-stock-product", status: "active", track_inventory: true, sell_when_out_of_stock: false },
    stockedProductIds,
  ),
  false,
  "Tracked products with no stocked active variant must not be recommended.",
);
assert.equal(
  isProductSellable(
    { id: "in-stock-product", status: "active", track_inventory: true, sell_when_out_of_stock: false },
    stockedProductIds,
  ),
  true,
  "Tracked products with stock remain eligible.",
);
assert.equal(
  isProductSellable(
    { id: "backorder-product", status: "active", track_inventory: true, sell_when_out_of_stock: true },
    new Set(),
  ),
  true,
  "Products explicitly allowed to sell out of stock remain eligible.",
);
assert.equal(
  isProductSellable(
    { id: "untracked-product", status: "active", track_inventory: false, sell_when_out_of_stock: false },
    new Set(),
  ),
  true,
  "Products that do not track inventory remain eligible.",
);

const discountLine = formatDiscountLine(
  {
    code: "50OFF",
    type: "percentage",
    value: 50,
    applies_to: "product",
    min_purchase: 0,
  },
  {
    name: "Sometimes All We Need Is a Hug — Adult Short Sleeve Tee",
    slug: "sometimes-all-we-need-is-a-hug-adult-short-sleeve-tee",
  },
  { website_url: "https://gdpclothing.ca" },
);
assert.match(
  discountLine,
  /50OFF: 50% off Sometimes All We Need Is a Hug/,
  "Product-specific discounts must name the eligible product.",
);
assert.match(
  discountLine,
  /gdpclothing\.ca\/products\/sometimes-all-we-need-is-a-hug-adult-short-sleeve-tee/,
  "Product-specific discounts should include the product link.",
);

const websiteCustom = getAssistantResponse("Can you help me make a custom shirt?", "");
assert.equal(
  websiteCustom.intentId,
  "custom-overview",
  "Messenger should inherit the website assistant's natural custom-design routing.",
);

const websiteDtf = getAssistantResponse("I need help arranging a gangsheet", "");
assert.equal(
  websiteDtf.intentId,
  "gangsheet-builder",
  "Messenger should inherit the website assistant's DTF/gang-sheet routing.",
);

const websiteSize = getAssistantResponse("I am between sizes, what should I pick?", "");
assert.equal(
  websiteSize.intentId,
  "size",
  "Messenger should inherit the website assistant's sizing routing.",
);

const adapted = adaptWebsiteAssistantResponse(
  {
    intentId: "custom-overview",
    text: "Open the studio.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: ["How do the editing tools work?"],
  },
  { website_url: "https://gdpclothing.ca" },
);
assert.match(
  adapted.text,
  /https:\/\/gdpclothing\.ca\/custom-studio/,
  "Website assistant actions must become usable Messenger links.",
);
assert.equal(
  toMessengerQuickReplies([], true).map((item) => item.title).join("|"),
  "Custom design|DTF printing|Find my size|Order help",
  "Messenger greeting should expose the same popular-question topics as the website assistant.",
);

const secret = "gdp-messenger-test-secret";
const body = JSON.stringify({ object: "page", entry: [] });
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);
const digest = await crypto.subtle.sign(
  "HMAC",
  key,
  new TextEncoder().encode(body),
);
const signature = "sha256=" + [...new Uint8Array(digest)]
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

assert.equal(await verifyMetaSignature(body, signature, secret), true);
assert.equal(await verifyMetaSignature(body + "tampered", signature, secret), false);

console.log("GDP Messenger agent regression checks passed.");
