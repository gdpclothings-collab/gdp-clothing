
import assert from "node:assert/strict";
import {
  normalizeText,
  scoreKnowledge,
  selectProductMatches,
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
