export const DEFAULT_LANDING_PAGE = {
  hero: {
    imageUrl: "/images/gdp-hero-approved.webp",
    brandLine: "GDP CLOTHING",
    headline: "MORE THAN CLOTHING",
    subheadline: "IT'S A LIFESTYLE",
    sideCopy: "WEAR YOUR STORY",
    ctaLabel: "SHOP NOW",
    ctaUrl: "/shop",
  },
  trustBar: [
    { title: "Fast & reliable shipping", text: "Across Canada", icon: "truck" },
    { title: "Premium quality", text: "Built to last", icon: "shield" },
    { title: "Custom designs", text: "Bring your ideas to life", icon: "shirt" },
    { title: "Support local", text: "Small business. Big dreams.", icon: "heart" },
  ],
  categories: [
    { title: "Tees", subtitle: "Everyday Essentials", imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654170383-8404147c-89f0-4e11-81df-d6f2e6d88757-Signature-GDP-Heavyweight-Tee.png", url: "/shop?category=T-Shirt" },
    { title: "Hoodies", subtitle: "Stay Warm, Stay Real", imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654034184-2a8649a5-74a3-4ea2-a6a7-ad82954a6ac9-Vintage-Bootleg-Hoodie.png", url: "/shop?category=Hoodie" },
    { title: "Custom Tees", subtitle: "Your Design, Our Print", imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654153667-c7277015-4e8c-43af-b5a1-5acca1027658-DTF-Gang-Sheet.png", url: "/custom-studio" },
    { title: "Collections", subtitle: "Explore All", imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654214518-e8f25549-f292-4bd7-80d9-e9a45d00e1b6-Custom-Couples-Hoodie-Set.png", url: "/shop?view=collections" },
  ],
  bestSellers: {
    eyebrow: "",
    title: "Best Sellers",
    subtitle: "Fan favorites. Real style. Everyday wear.",
    ctaLabel: "View All Products",
    ctaUrl: "/shop",
    limit: 5,
  },
  promos: [
    { title: "Custom Tees", subtitle: "Turn your ideas into reality.", buttonLabel: "Start Your Design", imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654153667-c7277015-4e8c-43af-b5a1-5acca1027658-DTF-Gang-Sheet.png", url: "/custom-studio" },
    { title: "Our Story", subtitle: "Built by the culture, for the culture.", buttonLabel: "Learn More", imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654214518-e8f25549-f292-4bd7-80d9-e9a45d00e1b6-Custom-Couples-Hoodie-Set.png", url: "/pages/about" },
    { title: "Quality. Bigger Moves.", subtitle: "It's in the details.", buttonLabel: "Shop Now", imageUrl: "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654189993-3e006a34-65b9-4849-b353-e65e431a6598-Memorial-Tribute-Tee.png", url: "/shop" },
  ],
};

const mergeSection = (base, value) => ({ ...base, ...(value || {}) });

export function mergeLandingPageConfig(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_LANDING_PAGE,
    ...source,
    hero: mergeSection(DEFAULT_LANDING_PAGE.hero, source.hero),
    bestSellers: mergeSection(DEFAULT_LANDING_PAGE.bestSellers, source.bestSellers),
    trustBar: Array.isArray(source.trustBar) && source.trustBar.length ? source.trustBar : DEFAULT_LANDING_PAGE.trustBar,
    categories: Array.isArray(source.categories) && source.categories.length ? source.categories : DEFAULT_LANDING_PAGE.categories,
    promos: Array.isArray(source.promos) && source.promos.length ? source.promos : DEFAULT_LANDING_PAGE.promos,
  };
}
