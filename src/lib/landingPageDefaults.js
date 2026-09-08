export const LANDING_SECTION_KEYS = [
  "trustBar",
  "categories",
  "customStudio",
  "bestSellers",
  "dtfSpotlight",
  "occasions",
  "howItWorks",
  "reviews",
  "promos",
  "localFulfillment",
  "faq",
  "finalCta",
];

const CUSTOM_APPAREL_IMAGE = "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654189993-3e006a34-65b9-4849-b353-e65e431a6598-Memorial-Tribute-Tee.png";

export const DEFAULT_LANDING_PAGE = {
  branding: {
    logoUrl: "/images/gdp-logo.webp",
    mobileLogoUrl: "/images/gdp-logo.webp",
    footerLogoUrl: "/images/gdp-logo.webp",
    logoAlt: "GDP Clothing",
    faviconUrl: "/favicon.svg",
    socialShareImageUrl: "/images/gdp-hero-approved.webp",
  },
  announcement: {
    enabled: false,
    text: "",
    linkLabel: "",
    url: "",
  },
  hero: {
    enabled: true,
    imageUrl: "/images/gdp-hero-approved.webp",
    brandLine: "GDP CLOTHING",
    headline: "MORE THAN CLOTHING",
    subheadline: "IT'S A LIFESTYLE",
    sideCopy: "WEAR YOUR STORY",
    ctaLabel: "CREATE CUSTOM APPAREL",
    ctaUrl: "/custom-studio",
    secondaryCtaLabel: "SHOP READY TO WEAR",
    secondaryCtaUrl: "/shop",
    tertiaryCtaLabel: "DTF PRINTING",
    tertiaryCtaUrl: "/dtf",
  },
  trustBar: [
    { title: "Fast & reliable shipping", text: "Across Canada", icon: "truck" },
    { title: "Premium quality", text: "Built to last", icon: "shield" },
    { title: "Custom designs", text: "Proof before production", icon: "shirt" },
    { title: "Support local", text: "Saskatoon, Saskatchewan", icon: "heart" },
  ],
  categories: [
    {
      title: "Tees",
      subtitle: "Everyday Essentials",
      imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654170383-8404147c-89f0-4e11-81df-d6f2e6d88757-Signature-GDP-Heavyweight-Tee.png",
      url: "/shop?category=T-Shirt",
    },
    {
      title: "Hoodies",
      subtitle: "Stay Warm, Stay Real",
      imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654034184-2a8649a5-74a3-4ea2-a6a7-ad82954a6ac9-Vintage-Bootleg-Hoodie.png",
      url: "/shop?category=Hoodie",
    },
    {
      title: "Custom Tees",
      subtitle: "Your Story, Our Print",
      imageUrl: CUSTOM_APPAREL_IMAGE,
      url: "/custom-studio",
    },
    {
      title: "Collections",
      subtitle: "Explore All",
      imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654214518-e8f25549-f292-4bd7-80d9-e9a45d00e1b6-Custom-Couples-Hoodie-Set.png",
      url: "/shop?view=collections",
    },
  ],
  customStudio: {
    eyebrow: "CUSTOM STUDIO",
    title: "TURN YOUR STORY INTO SOMETHING YOU CAN WEAR",
    subtitle: "Choose an occasion, upload photos, customize the look and approve your proof before production.",
    imageUrl: CUSTOM_APPAREL_IMAGE,
    ctaLabel: "OPEN CUSTOM STUDIO",
    ctaUrl: "/custom-studio",
    secondaryLabel: "HOW CUSTOM ORDERS WORK",
    secondaryUrl: "/#how-it-works",
  },
  bestSellers: {
    eyebrow: "",
    title: "Best Sellers",
    subtitle: "Fan favorites. Real style. Everyday wear.",
    ctaLabel: "View All Products",
    ctaUrl: "/shop?filter=best",
    limit: 5,
  },
  dtfSpotlight: {
    eyebrow: "DTF PRINTING",
    title: "BUILD OR UPLOAD YOUR GANG SHEET",
    subtitle: "Order custom DTF transfer film with live layout preview, artwork resizing, print-quality checks and advanced nesting before checkout.",
    imageUrl: "/images/dtf-gang-sheet.svg",
    primaryLabel: "EXPLORE DTF",
    primaryUrl: "/dtf",
    secondaryLabel: "OPEN GANG SHEET BUILDER",
    secondaryUrl: "/dtf-gang-sheet?mode=build",
  },
  occasions: {
    eyebrow: "MAKE IT PERSONAL",
    title: "SHOP BY OCCASION",
    subtitle: "Start with the moment. GDP Custom Studio helps turn it into a finished wearable design.",
    items: [
      { title: "Love & Couples", subtitle: "Anniversaries & gifts", url: "/custom-studio?occasion=love" },
      { title: "Family", subtitle: "Parents & reunions", url: "/custom-studio?occasion=family" },
      { title: "Memorial", subtitle: "Meaningful tributes", url: "/custom-studio?occasion=memorial" },
      { title: "Sports & School", subtitle: "Teams & graduation", url: "/custom-studio?occasion=sports" },
      { title: "Life Events", subtitle: "Birthdays & celebrations", url: "/custom-studio?occasion=events" },
      { title: "Pets", subtitle: "Portraits & memorials", url: "/custom-studio?occasion=pets" },
    ],
  },
  howItWorks: {
    eyebrow: "SIMPLE PROCESS",
    title: "HOW GDP CUSTOM ORDERS WORK",
    subtitle: "Clear steps from idea to finished apparel.",
    steps: [
      { title: "Choose your direction", text: "Pick the occasion, design style, garment, color and size." },
      { title: "Upload your photos", text: "Add your best images, names, dates, quotes and designer notes." },
      { title: "Review your setup", text: "Preview placement and confirm the details before checkout." },
      { title: "Approve the proof", text: "GDP reviews the artwork and sends a digital proof before production." },
      { title: "Print & quality check", text: "Approved designs move into production and final quality control." },
      { title: "Pickup or delivery", text: "Choose Saskatoon pickup or available shipping at checkout." },
    ],
  },
  reviews: {
    eyebrow: "CUSTOMER STORIES",
    title: "WHAT GDP CUSTOMERS ARE SAYING",
    subtitle: "Approved customer reviews appear here automatically.",
    limit: 6,
  },
  promos: [
    {
      title: "Custom Tees",
      subtitle: "Turn your photos and ideas into a one-of-one piece.",
      buttonLabel: "Start Your Design",
      imageUrl: CUSTOM_APPAREL_IMAGE,
      url: "/custom-studio",
    },
    {
      title: "Our Story",
      subtitle: "Built in Saskatoon. Made to carry your story.",
      buttonLabel: "Learn More",
      imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654214518-e8f25549-f292-4bd7-80d9-e9a45d00e1b6-Custom-Couples-Hoodie-Set.png",
      url: "/pages/about",
    },
    {
      title: "Quality. Bigger Moves.",
      subtitle: "Original GDP pieces and premium custom production.",
      buttonLabel: "Shop Now",
      imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654034184-2a8649a5-74a3-4ea2-a6a7-ad82954a6ac9-Vintage-Bootleg-Hoodie.png",
      url: "/shop",
    },
  ],
  localFulfillment: {
    eyebrow: "SASKATOON + CANADA",
    title: "LOCAL PICKUP. CANADA-WIDE SHIPPING.",
    subtitle: "GDP Clothing is based in Saskatoon, Saskatchewan. Available fulfillment options and final shipping costs are shown at checkout.",
    points: ["Saskatoon local pickup", "Secure CAD checkout", "Proof before custom production", "Shipping options calculated at checkout"],
  },
  faq: {
    eyebrow: "NEED TO KNOW",
    title: "QUICK ANSWERS",
    items: [
      { question: "How do custom orders work?", answer: "Build your order in Custom Studio, upload your photos and details, complete checkout, then approve the digital proof before production." },
      { question: "Do you offer DTF film only?", answer: "Yes. Use the DTF page to build a gang sheet or upload a complete print-ready sheet. Garments are not included with film-only orders." },
      { question: "Can I pick up locally in Saskatoon?", answer: "Local pickup can be selected when available. Checkout shows the fulfillment choices available for your order." },
      { question: "When does custom production start?", answer: "Custom production begins after your artwork has been reviewed and the proof is approved." },
    ],
    ctaLabel: "VIEW ALL FAQ",
    ctaUrl: "/faq",
  },
  finalCta: {
    eyebrow: "READY?",
    title: "MAKE SOMETHING THAT FEELS LIKE YOURS",
    subtitle: "Start a custom piece, shop GDP originals or build a DTF gang sheet.",
    primaryLabel: "START CUSTOM DESIGN",
    primaryUrl: "/custom-studio",
    secondaryLabel: "SHOP GDP",
    secondaryUrl: "/shop",
  },
  footer: {
    tagline: "Good People. Dope Clothes.",
    description: "",
    copyrightText: "",
    social: {
      instagram: "",
      facebook: "",
      tiktok: "",
      youtube: "",
    },
  },
  seo: {
    title: "GDP Clothing | Custom Apparel & DTF Printing in Saskatoon",
    description: "Custom apparel, personalized photo designs, streetwear and DTF gang sheet printing from GDP Clothing in Saskatoon, Saskatchewan.",
    ogTitle: "GDP Clothing | Custom Apparel & DTF Printing",
    ogDescription: "Create custom apparel, shop GDP originals and order professional DTF gang sheets from Saskatoon, Saskatchewan.",
    ogImageUrl: "",
  },
  layout: {
    sectionOrder: [...LANDING_SECTION_KEYS],
    visibility: Object.fromEntries(LANDING_SECTION_KEYS.map((key) => [key, true])),
  },
};

const mergeSection = (base, value) => ({ ...base, ...(value || {}) });

function normalizeSectionOrder(value) {
  const supplied = Array.isArray(value) ? value.filter((key) => LANDING_SECTION_KEYS.includes(key)) : [];
  return [...new Set([...supplied, ...LANDING_SECTION_KEYS])];
}

export function mergeLandingPageConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  const footer = mergeSection(DEFAULT_LANDING_PAGE.footer, source.footer);
  const layout = mergeSection(DEFAULT_LANDING_PAGE.layout, source.layout);

  return {
    ...DEFAULT_LANDING_PAGE,
    ...source,
    branding: mergeSection(DEFAULT_LANDING_PAGE.branding, source.branding),
    announcement: mergeSection(DEFAULT_LANDING_PAGE.announcement, source.announcement),
    hero: mergeSection(DEFAULT_LANDING_PAGE.hero, source.hero),
    customStudio: mergeSection(DEFAULT_LANDING_PAGE.customStudio, source.customStudio),
    bestSellers: mergeSection(DEFAULT_LANDING_PAGE.bestSellers, source.bestSellers),
    dtfSpotlight: mergeSection(DEFAULT_LANDING_PAGE.dtfSpotlight, source.dtfSpotlight),
    occasions: {
      ...mergeSection(DEFAULT_LANDING_PAGE.occasions, source.occasions),
      items: Array.isArray(source.occasions?.items) && source.occasions.items.length
        ? source.occasions.items
        : DEFAULT_LANDING_PAGE.occasions.items,
    },
    howItWorks: {
      ...mergeSection(DEFAULT_LANDING_PAGE.howItWorks, source.howItWorks),
      steps: Array.isArray(source.howItWorks?.steps) && source.howItWorks.steps.length
        ? source.howItWorks.steps
        : DEFAULT_LANDING_PAGE.howItWorks.steps,
    },
    reviews: mergeSection(DEFAULT_LANDING_PAGE.reviews, source.reviews),
    localFulfillment: {
      ...mergeSection(DEFAULT_LANDING_PAGE.localFulfillment, source.localFulfillment),
      points: Array.isArray(source.localFulfillment?.points) && source.localFulfillment.points.length
        ? source.localFulfillment.points
        : DEFAULT_LANDING_PAGE.localFulfillment.points,
    },
    faq: {
      ...mergeSection(DEFAULT_LANDING_PAGE.faq, source.faq),
      items: Array.isArray(source.faq?.items) && source.faq.items.length
        ? source.faq.items
        : DEFAULT_LANDING_PAGE.faq.items,
    },
    finalCta: mergeSection(DEFAULT_LANDING_PAGE.finalCta, source.finalCta),
    footer: {
      ...footer,
      social: mergeSection(DEFAULT_LANDING_PAGE.footer.social, source.footer?.social),
    },
    seo: mergeSection(DEFAULT_LANDING_PAGE.seo, source.seo),
    layout: {
      ...layout,
      sectionOrder: normalizeSectionOrder(source.layout?.sectionOrder),
      visibility: mergeSection(DEFAULT_LANDING_PAGE.layout.visibility, source.layout?.visibility),
    },
    trustBar: Array.isArray(source.trustBar) && source.trustBar.length ? source.trustBar : DEFAULT_LANDING_PAGE.trustBar,
    categories: Array.isArray(source.categories) && source.categories.length ? source.categories : DEFAULT_LANDING_PAGE.categories,
    promos: Array.isArray(source.promos) && source.promos.length ? source.promos : DEFAULT_LANDING_PAGE.promos,
  };
}
