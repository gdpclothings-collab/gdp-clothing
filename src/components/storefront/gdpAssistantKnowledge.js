const normalize = (value = "") =>
  String(value || "")
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

  const queryTokens = tokenize(query);
  if (queryTokens.includes(normalizedTerm)) return true;

  if (normalizedTerm.length < 6) return false;
  return queryTokens.some(
    (token) =>
      Math.abs(token.length - normalizedTerm.length) <= 1 &&
      editDistance(token, normalizedTerm) <= 1
  );
}

function scoreTerms(query, terms = []) {
  return terms.reduce((score, term) => {
    if (!termMatches(query, term)) return score;
    return score + (normalize(term).includes(" ") ? 2 : 1);
  }, 0);
}

function routeBoost(pathname, routeHints = []) {
  return routeHints.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
    ? 0.75
    : 0;
}

const INTENTS = [
  {
    id: "memorial",
    priority: 50,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "memorial", "tribute", "memorial tribute", "remembrance", "in memory", "rest in peace",
      "rip shirt", "memorial shirt", "memorial design", "portrait tribute", "name and dates"
    ],
    text:
      "Memorial Tribute Designs are a dedicated Custom Studio path. Choose a protected GDP remembrance layout, add the portrait, then personalize details such as the name, dates and message. The base GDP template stays protected while the customer content remains editable, and the live garment preview should be reviewed before the order is submitted.",
    action: { label: "Open Memorial Studio", path: "/custom-studio?path=memorial" },
    suggestions: [
      "Can I edit the memorial text?",
      "Can I use more than one photo?",
      "Can I print a memorial design on the back?"
    ]
  },
  {
    id: "photo-bootleg",
    priority: 49,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "photo bootleg", "bootleg", "bootleg design", "flame ice", "flame neon", "flame heatwave",
      "flame inferno", "flame toxic", "photo design", "locked template"
    ],
    text:
      "Photo Bootleg Designs use a locked GDP layout as the foundation while your customer content stays editable. Add one or more photos, position and resize them, rotate them, adjust or crop them, use background-removal and erase/restore tools when available, and add styled text. The GDP template itself is protected from accidental move, delete or distortion.",
    action: { label: "Open Photo Bootleg", path: "/custom-studio?path=bootleg" },
    suggestions: [
      "What photo editing tools are available?",
      "Can I curve the text?",
      "Does GDP remove the photo background?"
    ]
  },
  {
    id: "seasonal",
    priority: 48,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "seasonal", "seasonal design", "holiday design", "seasonal design lab", "ready made artwork",
      "ready-made artwork", "seasonal artwork"
    ],
    text:
      "Seasonal Designs are ready-made GDP artwork inside Custom Studio. Choose the seasonal artwork, garment, color, size and print side, then use the live garment preview and in-canvas view controls to check placement. Review both front and back when used before adding the finished custom item to the order.",
    action: { label: "Open Seasonal Designs", path: "/custom-studio?path=seasonal" },
    suggestions: [
      "Can I resize seasonal artwork?",
      "Can I put seasonal artwork on the back?",
      "How do I zoom the garment preview?"
    ]
  },
  {
    id: "own-artwork",
    priority: 48,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "upload my own artwork", "own artwork", "my artwork", "upload artwork", "upload my design",
      "custom file", "artwork only", "no template"
    ],
    text:
      "Use Upload My Own Artwork when you already have the design you want printed. Upload the highest-quality file you have, choose the garment and print side, then size and position the artwork inside the printable area. Keep important details away from the safe-area edges and review the live garment preview before ordering.",
    action: { label: "Upload Your Artwork", path: "/custom-studio?path=upload" },
    suggestions: [
      "What file type should I upload?",
      "Can I remove the background?",
      "Can I print front and back?"
    ]
  },
  {
    id: "custom-paths",
    priority: 44,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "design path", "design paths", "design choices", "my design choices", "custom choices", "custom options", "what can i customize",
      "custom studio options", "custom design choices"
    ],
    text:
      "Custom Studio currently has four main design paths: Seasonal Designs, Photo Bootleg Designs, Memorial Tribute Designs, and Upload My Own Artwork. Each path keeps the same core garment, color, size, front/back and review flow, while the editing tools change to fit that design type.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: [
      "Tell me about Photo Bootleg",
      "Tell me about Memorial Tribute",
      "Can I upload my own artwork?"
    ]
  },
  {
    id: "custom-overview",
    priority: 38,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "custom", "customize", "customise", "personalized", "personalised", "custom studio",
      "custom design", "design a shirt", "make my own shirt", "custom garment"
    ],
    text:
      "Custom Studio guides you from design path to garment, color and size, then into the editor and final live preview. You can work with GDP seasonal art, Photo Bootleg templates, Memorial Tribute templates, or your own artwork. Front and back are handled independently, drafts are protected through the flow, and the final review should match what you want produced.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: [
      "What are the four design paths?",
      "How do the editing tools work?",
      "Can I checkout as a guest?"
    ]
  },
  {
    id: "editor-controls",
    priority: 46,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "editing tools", "editor tools", "edit photo", "edit my photo", "multiple photos", "add photos", "resize", "resize photo", "rotate", "rotate photo", "drag", "move photo",
      "pinch", "crop", "erase", "restore", "brightness", "contrast", "saturation",
      "warmth", "flip", "layer", "undo", "redo", "safe area", "snap"
    ],
    text:
      "The Custom Studio editor supports direct manipulation of customer layers. Depending on the design path, you can drag, resize or pinch, rotate, crop, flip, adjust photo brightness/contrast/saturation/warmth, erase or restore parts of a photo, manage layers, undo/redo, and use center snapping plus safe-area guidance. On touch devices, the editor is designed for finger-based movement and resizing.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: [
      "How do I edit text?",
      "How does background removal work?",
      "What does the safe area mean?"
    ]
  },
  {
    id: "text-editor",
    priority: 47,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "text", "lettering", "wording", "font", "font style", "curve text", "curved text", "arc text",
      "outline", "text shadow", "glow", "3d text", "vintage text", "letter spacing", "text color"
    ],
    text:
      "Text layers can be edited directly in the Custom Studio paths that support text. You can change the wording, font, size, color, alignment, letter spacing and rotation, and use text styles such as outline, shadow, glow, 3D or vintage effects. Curve options include straight, arc up, arc down, wave and circle-style text.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: [
      "Can I curve the text?",
      "Can I move text with my finger?",
      "Can I add an outline to text?"
    ]
  },
  {
    id: "background-removal",
    priority: 50,
    routeHints: ["/custom-studio", "/design", "/dtf", "/dtf-gang-sheet", "/products/dtf-gang-sheet"],
    terms: [
      "remove background", "background removal", "background remover", "transparent background",
      "transparent photo", "cut out", "erase background", "ai background", "background cleanup"
    ],
    text:
      "GDP can process supported uploaded images into a transparent-background version for Custom Studio and DTF workflows. Keep the original available as a fallback, review the processed result before ordering, and use erase/restore or cleanup tools when a fine edge needs correction. A transparent PNG is preferred when you need artwork without a rectangular background.",
    suggestions: [
      "What if background removal misses an edge?",
      "Should I upload PNG or JPG?",
      "Does DTF export with a transparent background?"
    ]
  },
  {
    id: "front-back",
    priority: 48,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "front print", "back print", "front and back", "print side", "back side", "both sides",
      "front side", "print on back", "print on front", "different artwork", "different design", "back design", "back artwork"
    ],
    text:
      "Front and back are separate design surfaces in Custom Studio. Select the side you want to edit, and that side keeps its own artwork and placement instead of replacing the other side. Review both sides before finalizing whenever a garment and customization path support two-sided printing.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: [
      "Can I use different artwork on each side?",
      "Where is the print guide?",
      "How do I switch back to the front?"
    ]
  },
  {
    id: "preview-controls",
    priority: 45,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "garment preview", "live preview", "fabric preview", "preview zoom", "garment zoom", "zoom preview", "zoom garment", "zoom in", "zoom out",
      "fit garment", "measurements", "print guide", "print area", "canvas", "preview canvas"
    ],
    text:
      "The live garment preview is the visual check for the custom order. Garment zoom, fit, print-guide and measurement controls are placed with the preview so you can inspect the design without changing the actual print artwork. Preview-only zoom is for viewing; artwork size and placement controls determine the printed result.",
    action: { label: "Open Custom Studio", path: "/custom-studio" },
    suggestions: [
      "Does preview zoom change the print size?",
      "What is the print guide?",
      "How do I resize the artwork itself?"
    ]
  },
  {
    id: "draft-resume",
    priority: 49,
    routeHints: ["/custom-studio", "/design"],
    terms: [
      "save design", "save draft", "draft", "resume", "continue later", "lost design", "sign in and continue",
      "after sign in", "design disappeared", "autosave", "restore draft"
    ],
    text:
      "Custom Studio protects in-progress work with draft persistence. If sign-in is needed during a custom flow, the goal is to keep the selected path, garment, color, size, artwork, photos, placement and personalization so you can return to the same configuration instead of starting over. If a draft looks wrong, avoid rebuilding immediately and use the available restore/resume flow first.",
    action: { label: "Return to Custom Studio", path: "/custom-studio" },
    suggestions: [
      "Can I checkout without an account?",
      "What should be saved in my draft?",
      "How do I restart a design?"
    ]
  },
  {
    id: "dtf-overview",
    priority: 44,
    routeHints: ["/dtf", "/dtf-gang-sheet", "/products/dtf-gang-sheet"],
    terms: [
      "dtf", "direct to film", "direct-to-film", "dtf printing", "dtf transfer", "film printing"
    ],
    text:
      "GDP DTF lets you prepare artwork for Direct-to-Film printing. You can upload print-ready artwork or use the gang-sheet workspace to arrange multiple designs on the film, rotate and size them, use background cleanup, review film usage and then add the finished sheet to your bag.",
    action: { label: "Explore DTF Printing", path: "/dtf" },
    suggestions: [
      "How does the gang-sheet builder work?",
      "What file should I upload for DTF?",
      "Does the exported gang sheet stay transparent?"
    ]
  },
  {
    id: "gangsheet-builder",
    priority: 50,
    routeHints: ["/dtf-gang-sheet", "/products/dtf-gang-sheet", "/dtf"],
    terms: [
      "gang sheet", "gangsheet", "gang sheet builder", "gangsheet builder", "nest", "nesting",
      "duplicate artwork", "multiple files", "rotate artwork", "film usage", "34 inch", "34\"", "34 in"
    ],
    text:
      "The gang-sheet builder uses a 34-inch-wide film workspace and supports multiple artwork files. You can position, resize, duplicate and freely rotate artwork, while the nesting and validation logic keeps rotated geometry in mind. Review the film-usage confirmation and the actual artwork preview before adding the sheet to your cart.",
    action: { label: "Build a Gang Sheet", path: "/dtf-gang-sheet" },
    suggestions: [
      "Can I upload multiple files?",
      "Can I rotate artwork any angle?",
      "How is gang-sheet pricing calculated?"
    ]
  },
  {
    id: "dtf-transparent-export",
    priority: 50,
    routeHints: ["/dtf-gang-sheet", "/products/dtf-gang-sheet"],
    terms: [
      "transparent png", "transparent export", "download gang sheet", "download gangsheet", "export png",
      "export film", "white background", "black background", "no background", "production file"
    ],
    text:
      "The DTF gang-sheet result is designed to preserve transparency in the PNG output, so the workspace background is not baked into the production artwork. Customer access to production-ready downloads follows the paid order flow; protected admin preview/export tools are separate from normal customer access.",
    action: { label: "Open Gang-Sheet Builder", path: "/dtf-gang-sheet" },
    suggestions: [
      "What artwork file is best for DTF?",
      "Can GDP remove the background first?",
      "Can I keep editing after adding to cart?"
    ]
  },
  {
    id: "dtf-cart-editing",
    priority: 49,
    routeHints: ["/dtf-gang-sheet", "/products/dtf-gang-sheet", "/cart"],
    terms: [
      "keep editing", "continue editing", "modify gang sheet", "modify gangsheet", "after add to cart",
      "return to workspace", "edit after cart"
    ],
    text:
      "Adding a DTF gang sheet to the cart does not have to end the editing session. The workflow is set up so you can keep or return to the workspace and continue modifying the gang sheet, while the cart keeps a preview of the configured item.",
    action: { label: "Open Gang-Sheet Builder", path: "/dtf-gang-sheet" },
    suggestions: [
      "Does the cart show my artwork preview?",
      "How do I export the final gang sheet?",
      "How is film usage confirmed?"
    ]
  },
  {
    id: "artwork-quality",
    priority: 39,
    terms: [
      "artwork", "file type", "png", "jpg", "jpeg", "svg", "resolution", "dpi", "300 dpi",
      "quality", "blurry", "pixelated", "upload file", "print ready", "print-ready"
    ],
    text:
      "For the cleanest print, start with the highest-quality artwork you have. Transparent PNG is ideal for raster artwork that should have no background; high-resolution JPG can work when a full rectangular image is intentional. Avoid screenshots, heavily compressed files and visibly blurry artwork. A 300-DPI source at the intended print size is a strong target when available.",
    suggestions: [
      "Can GDP remove the background?",
      "Can I use a JPG?",
      "Why does my artwork look blurry?"
    ]
  },
  {
    id: "size",
    priority: 36,
    terms: [
      "size", "sizing", "fit", "oversize", "oversized", "small", "medium", "large", "xl", "2xl", "3xl",
      "measurements", "measurement", "measure", "measuring", "size guide", "what size", "between sizes"
    ],
    text:
      "Use the size guide and garment measurements for the exact product you are buying. Compare them with a shirt or hoodie you already like rather than relying only on the S/M/L label. Color and size availability can be variant-specific, so make the final choice from the options shown for that garment.",
    action: { label: "Shop Garments", path: "/shop" },
    suggestions: [
      "What if I'm between sizes?",
      "Are all colors available in every size?",
      "Do custom items use the product size guide?"
    ]
  },
  {
    id: "stock",
    priority: 37,
    terms: [
      "stock", "in stock", "out of stock", "available", "availability", "sold out", "inventory",
      "restock", "restocked", "variant unavailable"
    ],
    text:
      "Use the live product page as the source of truth for availability. A product can be available while a specific color/size variant is not. If a product or variant is marked Out of Stock, the normal ready-to-wear checkout should not treat it as available until inventory is updated.",
    action: { label: "Check the Shop", path: "/shop" },
    suggestions: [
      "Why is my size unavailable?",
      "Can I customize an out-of-stock garment?",
      "Where do I choose color and size?"
    ]
  },
  {
    id: "color",
    priority: 35,
    terms: [
      "color", "colour", "colors", "colours", "black", "white", "red", "garment color", "variant color",
      "colour swatch", "color swatch"
    ],
    text:
      "Choose from the garment colors currently shown for the product or Custom Studio blank. Color availability can depend on the selected size. The selected color is also reflected in the garment preview so you can check artwork contrast before the final review.",
    action: { label: "Shop GDP", path: "/shop" },
    suggestions: [
      "Are all colors available in every size?",
      "Can I change garment color in Custom Studio?",
      "How do I check artwork contrast?"
    ]
  },
  {
    id: "pricing",
    priority: 38,
    terms: [
      "price", "pricing", "cost", "how much", "rate", "rates", "total", "gang sheet price",
      "gangsheet price", "custom price", "dtf price", "extra charge", "fee"
    ],
    text:
      "Use the live storefront total for current pricing. Product price, garment choice, customization, front/back options, DTF film usage, discounts, tax and shipping can affect the final amount. GDP Assistant does not hard-code a price because the live configuration is the source of truth.",
    action: { label: "Browse Current Pricing", path: "/shop" },
    suggestions: [
      "Where can I see DTF pricing?",
      "When do I see shipping cost?",
      "Does front and back affect the total?"
    ]
  },
  {
    id: "cart",
    priority: 42,
    routeHints: ["/cart"],
    terms: [
      "cart", "bag", "shopping bag", "add to cart", "add to bag", "cart preview", "remove from cart",
      "change quantity", "edit cart"
    ],
    text:
      "The cart is the review point before checkout. It should show the configured item, quantity, price and custom preview when applicable. For editable custom work such as DTF, use the available edit/return-to-workspace path rather than creating a duplicate item if you only need to change the existing design.",
    action: { label: "Open Cart", path: "/cart" },
    suggestions: [
      "Can I edit my DTF gang sheet after adding it?",
      "Why does shipping show in the cart?",
      "Can I remove an item from my cart?"
    ]
  },
  {
    id: "guest-checkout",
    priority: 50,
    routeHints: ["/checkout"],
    terms: [
      "guest checkout", "checkout as guest", "without account", "without signing in", "no account",
      "guest order", "do i need an account"
    ],
    text:
      "Yes. GDP supports secure guest checkout for normal storefront purchases and supported custom-design orders. Enter your contact and shipping details in checkout, then complete payment there. Creating or signing into an account is still useful for private order history and account-based order management.",
    suggestions: [
      "Will my custom design still be saved?",
      "Where do I enter shipping information?",
      "How do I check a guest order?"
    ]
  },
  {
    id: "checkout",
    priority: 42,
    routeHints: ["/checkout"],
    terms: [
      "checkout", "contact information", "shipping address", "billing", "place order", "complete order",
      "continue to payment", "single page checkout", "single-page checkout"
    ],
    text:
      "Checkout is a single modern flow for contact details, shipping information, order review and payment instead of forcing an unnecessary separate continue-to-payment step. Confirm the item details and final total, accept any required policy consent, then enter payment only in the secure checkout form.",
    suggestions: [
      "Can I checkout as a guest?",
      "When do I see shipping cost?",
      "Is payment information secure?"
    ]
  },
  {
    id: "payment",
    priority: 43,
    routeHints: ["/checkout"],
    terms: [
      "payment", "pay", "card", "credit card", "debit card", "stripe", "apple pay", "google pay",
      "payment method", "secure payment", "payment options"
    ],
    text:
      "Enter payment details only inside GDP's secure checkout. The payment methods actually available to you are the ones shown by the live payment form for your device and checkout session. Never send card numbers, passwords or verification codes through GDP Assistant or a support message.",
    suggestions: [
      "Can I checkout as a guest?",
      "Why don't I see a wallet option?",
      "How do I know the total before paying?"
    ]
  },
  {
    id: "discount",
    priority: 39,
    terms: [
      "discount", "coupon", "promo", "promo code", "coupon code", "sale", "deal", "promotion",
      "discount code"
    ],
    text:
      "If a GDP promotion applies to your order, enter or activate it through the storefront discount flow. A discount is only confirmed when the accepted amount appears in the order total; entering a code by itself does not guarantee it qualifies for every item or custom service.",
    suggestions: [
      "Why didn't my promo apply?",
      "Can a promo work on custom orders?",
      "When is the discount final?"
    ]
  },
  {
    id: "shipping",
    priority: 38,
    terms: [
      "ship", "shipping", "delivery", "deliver", "pickup", "pick up", "local pickup", "canada",
      "saskatoon", "shipping cost", "shipping fee", "shipping address", "usa", "united states"
    ],
    text:
      "Shipping or pickup choices and their current cost are confirmed by the live checkout for the order and destination. Production time and carrier travel time are separate, so the date an item is ready to ship is not the same as the delivery date.",
    suggestions: [
      "Do you offer local pickup?",
      "When do I see shipping cost?",
      "Does production time include shipping?"
    ]
  },
  {
    id: "production",
    priority: 39,
    terms: [
      "production", "turnaround", "how long", "ready", "processing", "process time", "business days",
      "when will", "how fast", "rush", "printed", "production starts"
    ],
    text:
      "Production timing depends on the item and customization. For custom work, the submitted design and order details must be complete before production can proceed. Use the timing shown by the current product, Custom Studio flow or GDP support for the most relevant estimate, and remember shipping time is separate from production time.",
    suggestions: [
      "When does production start?",
      "Does shipping time include production?",
      "Is the live preview used for production?"
    ]
  },
  {
    id: "returns",
    priority: 40,
    terms: [
      "return", "returns", "refund", "refunds", "exchange", "exchanges", "cancel", "cancellation",
      "defective", "wrong item", "damaged"
    ],
    text:
      "Return, exchange or cancellation eligibility depends on the item and whether it was personalized or made to order. Custom products can have different rules from regular stock items. Check GDP Clothing's current posted policy before ordering, and contact GDP promptly if an item arrives damaged, defective or incorrect.",
    action: { label: "View FAQ & Policies", path: "/faq" },
    suggestions: [
      "Can I return a custom item?",
      "What if my order arrives damaged?",
      "Where can I read the current policy?"
    ]
  },
  {
    id: "artwork-rights",
    priority: 46,
    routeHints: ["/dtf", "/dtf-gang-sheet", "/custom-studio"],
    terms: [
      "copyright", "copyrighted", "copyrighted logo", "logo i don't own", "brand logo", "rights", "own the artwork", "permission", "licensed artwork", "trademark",
      "artwork consent", "can i print this image"
    ],
    text:
      "Only upload or print artwork you own or have permission to use. GDP's custom and DTF flows may require you to confirm artwork rights before the order can proceed. That confirmation protects both the customer and GDP from unauthorized reproduction.",
    suggestions: [
      "Can I print a logo I don't own?",
      "What counts as permission?",
      "Where is the artwork-rights confirmation?"
    ]
  },
  {
    id: "order",
    priority: 42,
    terms: [
      "order", "order number", "track", "tracking", "status", "where is my", "my purchase", "my package",
      "confirmation", "order help", "order history"
    ],
    text:
      "For private order information, sign in and use My Account when the order is attached to your account. Guest orders use the confirmation details provided during checkout. GDP Assistant should not expose or request private order data in the public chat.",
    action: { label: "Open My Account", path: "/account" },
    suggestions: [
      "How do I check a guest order?",
      "Where is my order confirmation?",
      "How do I contact GDP about an order?"
    ]
  },
  {
    id: "account-auth",
    priority: 41,
    terms: [
      "account", "sign in", "login", "log in", "google sign in", "google login", "register", "create account",
      "forgot password", "reset password", "my account"
    ],
    text:
      "An account gives you access to private order history and account features, but supported purchases can also use guest checkout. Use the Sign In page for email or available Google sign-in, and use Forgot Password if you need to reset an email/password account. Never share a password or verification code with GDP Assistant.",
    action: { label: "Sign In", path: "/login" },
    suggestions: [
      "Can I checkout as a guest?",
      "How do I reset my password?",
      "Where can I see my orders?"
    ]
  },
  {
    id: "products",
    priority: 31,
    terms: [
      "shop", "product", "products", "tee", "t shirt", "t-shirt", "shirt", "hoodie", "sweater", "crewneck",
      "bodysuit", "garment", "clothes", "clothing", "ready to wear", "ready-to-wear"
    ],
    text:
      "Browse the GDP shop for ready-to-wear and customizable garments. Each live product page is the source of truth for current images, price, available color/size variants, stock and whether a customization path is available.",
    action: { label: "Shop GDP", path: "/shop" },
    suggestions: [
      "Which items can I customize?",
      "How do I check stock?",
      "How do I choose the right size?"
    ]
  },
  {
    id: "contact",
    priority: 32,
    terms: [
      "contact", "human", "person", "support", "email", "phone", "message you", "talk to someone",
      "customer service", "help center"
    ],
    text:
      "If the assistant cannot answer a store-specific or order-specific question, use GDP Clothing's Contact page or Help Center. Include the order number when relevant, but do not include passwords, full card details or verification codes.",
    action: { label: "Contact GDP", path: "/pages/contact" },
    suggestions: [
      "What should I include in my support message?",
      "Where can I read store policies?",
      "How do I check an existing order?"
    ]
  }
];

const SMALL_TALK = [
  {
    terms: ["thank you", "thanks", "thankyou", "thx"],
    text:
      "You're welcome! I can also help with Custom Studio, Memorial Tribute, Photo Bootleg, DTF gang sheets, sizing, checkout or order guidance."
  },
  {
    terms: ["bye", "goodbye", "see you"],
    text:
      "Thanks for visiting GDP Clothing. Come back anytime if you need product, custom design, DTF or order help."
  }
];

function greetingResponse(query) {
  if (/^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)[!. ]*$/.test(query)) {
    return {
      text:
        "Hey! What can I help you with today — Custom Studio, Photo Bootleg, Memorial Tribute, DTF gang sheets, products, sizing, checkout, shipping or an order question?",
      suggestions: [
        "What are the Custom Studio design paths?",
        "How does the DTF gang-sheet builder work?",
        "Can I checkout as a guest?"
      ]
    };
  }
  return null;
}

function capabilityResponse(query) {
  if (
    termMatches(query, "what can you do") ||
    termMatches(query, "how can you help") ||
    termMatches(query, "help me") ||
    termMatches(query, "what can i ask")
  ) {
    return {
      text:
        "I can explain GDP products and stock, all four Custom Studio paths, photo and text editing, front/back printing, draft resume, background removal, DTF and gang sheets, artwork setup, sizing, pricing, cart and guest checkout, payment safety, shipping, production, returns, account access and order-help directions.",
      suggestions: [
        "Show me the Custom Studio options",
        "Help me with a DTF gang sheet",
        "Help me with checkout"
      ]
    };
  }
  return null;
}

function contextualIntentBoost(intent, pathname = "") {
  return routeBoost(pathname, intent.routeHints || []);
}

function getContextualFallback(pathname = "") {
  if (pathname.startsWith("/products/") || pathname.startsWith("/product/")) {
    return {
      text:
        "I didn't fully understand that. Since you're viewing a product, ask me about its size, color, stock, customization, pricing, shipping, returns or how to add it to your bag.",
      suggestions: [
        "Is this customizable?",
        "How do I choose a size?",
        "How do I check stock?"
      ]
    };
  }

  if (
    pathname.startsWith("/dtf") ||
    pathname.startsWith("/products/dtf-gang-sheet")
  ) {
    return {
      text:
        "I didn't fully understand that. For DTF, ask about gang sheets, multiple artwork files, rotation, transparent backgrounds, background removal, film usage, pricing or final PNG export.",
      suggestions: [
        "How does the gang-sheet builder work?",
        "Does DTF export as transparent PNG?",
        "Can I upload multiple files?"
      ]
    };
  }

  if (pathname.startsWith("/custom-studio") || pathname.startsWith("/design")) {
    return {
      text:
        "I didn't fully understand that. For Custom Studio, ask about Seasonal, Photo Bootleg, Memorial Tribute, Upload My Own Artwork, photo or text editing, front/back printing, the print guide, draft resume or the final preview.",
      suggestions: [
        "What are the four design paths?",
        "What editing tools are available?",
        "How do front and back designs work?"
      ]
    };
  }

  if (pathname.startsWith("/cart")) {
    return {
      text:
        "I didn't fully understand that. For the cart, ask about custom previews, editing a DTF item, quantities, totals, shipping estimates or moving on to checkout.",
      suggestions: [
        "Can I edit my gang sheet after adding it?",
        "When do I see final shipping cost?",
        "Can I checkout as a guest?"
      ]
    };
  }

  return {
    text:
      "I didn't quite catch that. Try asking about GDP products, Custom Studio, Photo Bootleg, Memorial Tribute, DTF gang sheets, artwork, sizing, stock, pricing, cart, checkout, shipping, returns or an order. For something store-specific, you can also contact GDP directly.",
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
    .map((intent) => ({
      intent,
      score:
        scoreTerms(query, intent.terms) +
        contextualIntentBoost(intent, pathname) +
        Number(intent.priority || 0) / 1000
    }))
    .filter(({ score }) => score >= 1)
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
