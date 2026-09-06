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
    { title: "Tees", subtitle: "Everyday Essentials", imageUrl: "/images/gdp-sold-family.webp", url: "/shop?category=T-Shirt" },
    { title: "Hoodies", subtitle: "Stay Warm, Stay Real", imageUrl: "/images/gdp-hero-approved.webp", url: "/shop?category=Hoodie" },
    { title: "Custom Tees", subtitle: "Your Design, Our Print", imageUrl: "/images/gdp-process.svg", url: "/custom-studio" },
    { title: "Collections", subtitle: "Explore All", imageUrl: "/images/gdp-sold-categories.webp", url: "/shop" },
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
    { title: "Custom Tees", subtitle: "Turn your ideas into reality.", buttonLabel: "Start Your Design", imageUrl: "/images/gdp-process.svg", url: "/custom-studio" },
    { title: "Our Story", subtitle: "Built by the culture, for the culture.", buttonLabel: "Learn More", imageUrl: "/images/gdp-sold-family.webp", url: "/pages/about" },
    { title: "Quality. Bigger Moves.", subtitle: "It's in the details.", buttonLabel: "Shop Now", imageUrl: "/images/gdp-sold-categories.webp", url: "/shop" },
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
