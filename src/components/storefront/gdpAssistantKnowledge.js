const normalize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9$%.'\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) => normalize(value).split(" ").filter(Boolean);

function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function termMatches(query, term) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;

  if (normalizedTerm.includes(" ")) return query.includes(normalizedTerm);
  if (query.includes(normalizedTerm)) return true;

  if (normalizedTerm.length < 5) return false;
  return tokenize(query).some(
    (token) => Math.abs(token.length - normalizedTerm.length) <= 1 && editDistance(token, normalizedTerm) <= 1
  );
}

function scoreTerms(query, terms = []) {
  return terms.reduce((score, term) => score + (termMatches(query, term) ? 1 : 0), 0);
}

const INTENTS = [
  {
    id: "custom",
    terms: [
      "custom", "customize", "customise", "design", "custom studio", "photo bootleg", "bootleg",
      "memorial", "tribute", "seasonal", "personalize", "personalise", "upload photo", "own artwork"
    ],
    text:
      "Use Custom Studio for personalized garments. Choose a design path, garment, artwork or photos, edit the layout, review the live garment preview, and continue only when the design looks right.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: ["Can I upload my own artwork?", "How does Memorial Tribute work?", "Can I print front and back?"]
  },
  {
    id: "dtf",
    terms: [
      "dtf", "gang sheet", "gangsheet", "film", "print ready", "print-ready", "transfer", "gang sheet builder",
      "34 inch", "34\"", "dtf printing"
    ],
    text:
      "For DTF, you can upload a print-ready gang sheet or build one in GDP's gang-sheet workspace. Arrange your artwork on the film, review the usage and preview, then add the finished sheet to your bag.",
    action: { label: "Explore DTF Printing", path: "/dtf" },
    suggestions: ["What artwork file should I use?", "How does gang-sheet pricing work?", "Can I upload multiple files?"]
  },
  {
    id: "artwork",
    terms: [
      "artwork", "file type", "png", "jpg", "jpeg", "svg", "transparent", "background", "remove background",
      "background remover", "resolution", "dpi", "300 dpi", "quality", "blurry", "upload file"
    ],
    text:
      "For best print results, use the highest-quality artwork you have. Transparent PNG artwork is ideal when you do not want a rectangular background. Avoid blurry or heavily compressed images, and review the live preview before continuing.",
    suggestions: ["Can GDP remove my photo background?", "Can I upload multiple photos?", "Can I use JPG artwork?"]
  },
  {
    id: "print-side",
    terms: [
      "front print", "back print", "front and back", "print side", "back side", "both sides", "front side",
      "print on back", "print on front"
    ],
    text:
      "When a garment supports it, use the Front/Back controls in Custom Studio to work on each print side. Keep each side's artwork inside the printable area and review both views before submitting the design.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: ["How do I edit the back?", "Where is the print guide?", "Can I use different artwork on each side?"]
  },
  {
    id: "size",
    terms: [
      "size", "sizing", "fit", "oversize", "oversized", "small", "medium", "large", "xl", "2xl", "3xl",
      "measurements", "measurement", "size guide", "what size"
    ],
    text:
      "Use the garment size guide and measurements shown with the product. If you're between sizes, compare those measurements with a shirt or hoodie you already like. For a looser or oversized look, choose based on the finished garment measurements rather than the size label alone.",
    action: { label: "Shop Garments", path: "/shop" },
    suggestions: ["How do I measure a hoodie?", "What if I'm between sizes?", "Do custom items use the same size guide?"]
  },
  {
    id: "stock",
    terms: [
      "stock", "in stock", "out of stock", "available", "availability", "sold out", "inventory", "restock", "restocked"
    ],
    text:
      "Current availability is shown on each product page. If a size or product is marked Out of Stock, it should not be treated as available for a normal ready-to-wear purchase until inventory is updated.",
    action: { label: "Check the Shop", path: "/shop" },
    suggestions: ["Which products can I customize?", "Where do I choose a size?", "Can I order an out-of-stock item?"]
  },
  {
    id: "color",
    terms: ["color", "colour", "colors", "colours", "black", "white", "red", "garment color", "variant color"],
    text:
      "Available garment colors are shown with each product or customization flow. Select the color you want before final review so the artwork can be checked against the actual garment color.",
    action: { label: "Shop GDP", path: "/shop" },
    suggestions: ["Can I change color in Custom Studio?", "Will white artwork show on a white shirt?", "Are all colors available in every size?"]
  },
  {
    id: "price",
    terms: [
      "price", "pricing", "cost", "how much", "rate", "rates", "cheap", "expensive", "total", "gang sheet price",
      "custom price", "dtf price"
    ],
    text:
      "GDP shows current product and customization pricing in the storefront. For DTF or custom work, build the order with the size, garment and options you need so the displayed total reflects that configuration before checkout.",
    action: { label: "Browse Pricing", path: "/shop" },
    suggestions: ["Where is DTF pricing?", "Does customization cost extra?", "When do I see the final total?"]
  },
  {
    id: "production",
    terms: [
      "production", "turnaround", "how long", "ready", "processing", "process time", "business days", "when will",
      "how fast", "rush"
    ],
    text:
      "Production timing depends on the product and customization. Custom production begins after the required design or proof step is complete. Check the timing shown in the product or customization flow before checkout for the most relevant estimate.",
    suggestions: ["When does production start?", "Does shipping time include production?", "What happens after I approve my design?"]
  },
  {
    id: "shipping",
    terms: [
      "ship", "shipping", "delivery", "deliver", "pickup", "pick up", "local pickup", "usa", "u.s", "united states",
      "canada", "saskatoon", "shipping cost", "shipping fee"
    ],
    text:
      "Shipping and pickup options are confirmed during checkout. Enter the delivery information to see the methods and calculated cost available for that order and location.",
    suggestions: ["Do you offer local pickup?", "When do I see shipping cost?", "Does production time include shipping?"]
  },
  {
    id: "returns",
    terms: ["return", "returns", "refund", "refunds", "exchange", "exchanges", "cancel", "cancellation", "defective"],
    text:
      "Return or cancellation eligibility depends on the item and whether it was customized. Personalized and made-to-order pieces can have different rules from regular stock items, so review GDP Clothing's posted policy before ordering.",
    action: { label: "View FAQ", path: "/faq" },
    suggestions: ["Can I return a custom item?", "What if my item is defective?", "Where can I read the policy?"]
  },
  {
    id: "order",
    terms: [
      "order", "order number", "track", "tracking", "status", "where is my", "my purchase", "my package", "confirmation",
      "order help"
    ],
    text:
      "For private order details, sign in and open My Account. That keeps personal order information out of the public assistant.",
    action: { label: "Open My Account", path: "/account" },
    suggestions: ["Where is my order confirmation?", "How do I sign in?", "Who do I contact for order help?"]
  },
  {
    id: "checkout",
    terms: [
      "checkout", "guest checkout", "guest", "sign in", "login", "account", "payment", "pay", "card", "credit card",
      "apple pay", "google pay", "stripe"
    ],
    text:
      "You can complete the storefront checkout using the options presented on the checkout page. Payment details should only be entered in the secure checkout form — never in this chat.",
    suggestions: ["Can I checkout as a guest?", "Where do I enter my shipping address?", "How do I check an existing order?"]
  },
  {
    id: "discount",
    terms: ["discount", "coupon", "promo", "promo code", "coupon code", "sale", "deal", "promotion"],
    text:
      "If a valid GDP discount or promotion is available for your order, use the applicable discount field or promotion flow shown by the storefront. The final accepted discount should be reflected in the order total before payment is completed.",
    suggestions: ["Where do I enter a promo code?", "Why didn't my discount apply?", "Does a promo work on custom orders?"]
  },
  {
    id: "products",
    terms: [
      "shop", "product", "products", "tee", "t shirt", "t-shirt", "shirt", "hoodie", "sweater", "crewneck", "bodysuit",
      "garment", "clothes", "clothing"
    ],
    text:
      "Browse the GDP shop for ready-to-wear and customizable garments. Each product page should show the available sizes, colors, stock status and any customization path that applies.",
    action: { label: "Shop GDP", path: "/shop" },
    suggestions: ["Which items can I customize?", "How do I check stock?", "How do I choose the right size?"]
  },
  {
    id: "contact",
    terms: ["contact", "human", "person", "support", "email", "phone", "message you", "talk to someone", "customer service"],
    text:
      "If you need help that the assistant can't answer, use GDP Clothing's Contact page so your question can be handled directly.",
    action: { label: "Contact GDP", path: "/pages/contact" },
    suggestions: ["What should I include in my message?", "Can you help with an order question?", "Where can I find store policies?"]
  }
];

const SMALL_TALK = [
  { terms: ["thank you", "thanks", "thankyou", "thx"], text: "You're welcome! If you need anything else with GDP products, custom designs, DTF, sizing or an order, just ask." },
  { terms: ["bye", "goodbye", "see you"], text: "Thanks for visiting GDP Clothing. Come back anytime if you need product, custom design or DTF help." }
];

function greetingResponse(query) {
  if (/^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)[!. ]*$/.test(query)) {
    return {
      text: "Hey! What can I help you with today — shopping, Custom Studio, DTF printing, sizing, shipping, or an order question?",
      suggestions: ["How does Custom Studio work?", "Tell me about DTF printing", "What size should I order?"]
    };
  }
  return null;
}

function capabilityResponse(query) {
  if (
    termMatches(query, "what can you do") ||
    termMatches(query, "how can you help") ||
    termMatches(query, "help me")
  ) {
    return {
      text:
        "I can help with GDP products, Custom Studio, Memorial Tribute and photo designs, DTF gang sheets, artwork setup, sizing, stock, colors, pricing, production, shipping, returns, checkout and order-help directions.",
      suggestions: ["Help me customize a shirt", "Help me with DTF", "Help me choose a size"]
    };
  }
  return null;
}

function getContextualFallback(pathname = "") {
  if (pathname.startsWith("/products/") || pathname.startsWith("/product/")) {
    return {
      text:
        "I didn't fully understand that. Since you're viewing a product, you can ask me about its size, color, stock, customization, pricing, shipping or return guidance.",
      suggestions: ["Is this customizable?", "How do I choose a size?", "How do I check stock?"]
    };
  }

  if (pathname.startsWith("/dtf")) {
    return {
      text:
        "I didn't fully understand that. For DTF, try asking about gang sheets, artwork files, transparent backgrounds, pricing, film usage or uploading multiple files.",
      suggestions: ["How do gang sheets work?", "What file should I upload?", "How does DTF pricing work?"]
    };
  }

  return {
    text:
      "I didn't quite catch that. Try asking about GDP products, Custom Studio, DTF printing, sizing, stock, pricing, production, shipping, returns, checkout or an order. You can also contact GDP for something more specific.",
    action: { label: "Contact GDP", path: "/pages/contact" },
    showStarters: true
  };
}

export function getAssistantResponse(message, pathname = "") {
  const query = normalize(message);
  if (!query) return getContextualFallback(pathname);

  const greeting = greetingResponse(query);
  if (greeting) return greeting;

  const capability = capabilityResponse(query);
  if (capability) return capability;

  const smallTalk = SMALL_TALK.find(({ terms }) => scoreTerms(query, terms) > 0);
  if (smallTalk) return { text: smallTalk.text };

  const ranked = INTENTS
    .map((intent) => ({ intent, score: scoreTerms(query, intent.terms) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 0) {
    const { intent } = ranked[0];
    return {
      text: intent.text,
      action: intent.action,
      suggestions: intent.suggestions
    };
  }

  return getContextualFallback(pathname);
}
