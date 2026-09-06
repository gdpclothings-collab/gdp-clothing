export const DEFAULT_ABOUT_PAGE_BODY = {
  template: "about",
  heroEyebrow: "GOOD PEOPLE. DOPE CLOTHES.",
  heroTitle: "MORE THAN CLOTHING.",
  heroSubtitle: "Your story, your memories, your style.",
  heroImageUrl: "/images/gdp-hero-approved.webp",

  founderKicker: "THE GDP STORY",
  founderTitle: "BUILT BY ONE. MADE FOR MANY.",
  founderBody:
    "GDP Clothing is an independent clothing and custom-printing brand built from creativity, persistence, and more than 7 years of hands-on experience in custom apparel printing. What started as a passion for creating personalized clothing grew into a brand focused on helping people turn their ideas, photographs, memories, and personalities into something they can actually wear. As a solo entrepreneur, every part of GDP Clothing has been built one step at a time—from designing artwork and preparing prints to producing apparel, helping customers, developing new products, and continuously improving the experience. There isn't a huge corporation behind GDP Clothing. There is a real person behind the brand who cares about how every piece turns out.",

  stats: [
    { value: "7+", label: "Years of custom printing" },
    { value: "1", label: "Independent founder" },
    { value: "YXE", label: "Built in Saskatoon" },
  ],

  memoryTitle: "YOUR MEMORIES. YOUR STYLE. YOUR CLOTHING.",
  memoryBody:
    "Some clothes are simply clothes. Others mean something. A photograph of someone you love. A family memory. A relationship. A pet. A celebration. A tribute. A favorite moment. Or simply an idea that represents who you are. GDP Clothing specializes in transforming those ideas into custom wearable pieces, especially the bold retro and bootleg-inspired designs that have become a signature part of the brand.",

  experienceTitle: "7+ YEARS OF CREATING & PRINTING",
  experienceBody:
    "Experience matters when a customer's memories are going onto a garment. With more than seven years in custom printing, GDP Clothing has developed around the details that make a custom piece feel right: image preparation, composition, colour, placement, garment selection, and print quality. GDP Clothing uses Direct-to-Film (DTF) printing for many products to produce detailed, colourful prints designed to stay vibrant and durable. Good printing is only part of the job—the goal is to make the finished product feel like your product, not something copied from a template.",

  dreamTitle: "SMALL BUSINESS. BIG DREAMS.",
  dreamBody:
    "GDP Clothing represents the idea that you don't need to start big to build something meaningful. It has been developed independently—from designing products and fulfilling customer orders to building the online store and growing the brand. That independent mindset remains part of GDP Clothing today: premium quality, original ideas, personal service, custom designs, and work made with purpose.",

  standsTitle: "WHAT GDP STANDS FOR",
  standsBody:
    "Good People. Dope Clothes. The name says a lot about the vision. GDP Clothing is about creating clothing for people who want to express something—whether that's their personality, culture, creativity, family, memories, or simply their own style. The philosophy is simple: wear what means something to you. The best designs aren't always created around trends. Sometimes they're created around people, experiences, and memories.",

  cultureTitle: "BUILT FOR THE CULTURE. MADE FOR YOU.",
  cultureBody:
    "GDP Clothing blends custom printing with streetwear influence—especially vintage, retro, and bootleg-inspired graphics—with a focus on pieces that feel personal rather than mass-produced. From custom photo shirts and memorial designs to statement hoodies, oversized apparel, and original GDP pieces, the vision is to keep building a brand where customers can either wear GDP or create something completely their own.",
  storyImageUrl:
    "https://mcmancxsqlhxnjhlnfkz.supabase.co/storage/v1/object/public/product-images/products/1788654189993-3e006a34-65b9-4849-b353-e65e431a6598-Memorial-Tribute-Tee.png",

  ctaTitle: "DESIGN YOUR DREAM. WEAR YOUR VISION.",
  ctaBody: "You bring the idea. GDP Clothing helps bring it to life.",
  ctaLabel: "CREATE YOUR CUSTOM PIECE",
  ctaUrl: "/custom-studio",
  secondaryCtaLabel: "SHOP GDP",
  secondaryCtaUrl: "/shop",
  closingLine: "Good People. Dope Clothes. Wear Your Story.",
};

export function mergeAboutPageBody(value) {
  const source = value && typeof value === "object" ? value : {};
  const stats =
    Array.isArray(source.stats) && source.stats.length
      ? source.stats.slice(0, 3).map((item, index) => ({
          ...DEFAULT_ABOUT_PAGE_BODY.stats[index],
          ...(item || {}),
        }))
      : DEFAULT_ABOUT_PAGE_BODY.stats;

  return {
    ...DEFAULT_ABOUT_PAGE_BODY,
    ...source,
    template: "about",
    stats,
  };
}
