export const DEFAULT_CONTACT_PAGE_BODY = {
  template: "contact",
  intro:
    "Need help with an order, a custom design, or a product question? Send us a message and it will go directly to the GDP Clothing support queue.",
  responseTime: "We normally reply within 1 business day.",
  locationNote: "Proudly based in Saskatoon, Saskatchewan, Canada.",
  formHeading: "Send us a message",
  formHelper:
    "Tell us what you need and include your order number when your question is about an existing order.",
  customTitle: "Planning a custom piece?",
  customText:
    "If you already know what you want to create, start in the Custom Studio to choose a garment, upload artwork, and build your design.",
  faqTitle: "Looking for a quick answer?",
  faqText:
    "Check common questions about ordering, custom designs, shipping, sizing, and store policies before sending a message.",
};

export function mergeContactPageBody(body = {}) {
  return {
    ...DEFAULT_CONTACT_PAGE_BODY,
    ...(body || {}),
    template: "contact",
  };
}
