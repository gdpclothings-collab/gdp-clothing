import fs from 'node:fs';

const layout = fs.readFileSync('src/components/storefront/Layout.jsx', 'utf8');
const footer = fs.readFileSync('src/components/storefront/StoreFooter.jsx', 'utf8');

const expect = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
};

expect(layout.includes('data-gdp-studio-footer="true"'), 'Custom Studio has an explicit footer boundary');
expect(!layout.includes('{!studioActive && <StoreFooter />}'), 'StoreFooter is no longer suppressed in Custom Studio');
expect(layout.indexOf('<main className="flex-1">') < layout.indexOf('data-gdp-studio-footer="true"'), 'footer renders after the main Studio content');
expect(layout.indexOf('data-gdp-studio-footer="true"') < layout.indexOf('{!cartActive && <AIAssistant />}'), 'Ask GDP remains outside and after the footer boundary');
expect(layout.includes('mt-8 sm:mt-10'), 'Studio-to-footer spacing is preserved');

const requiredLinks = [
  '/pages/contact',
  '/faq',
  '/pages/shipping-delivery',
  '/pages/returns-refunds',
  '/pages/custom-artwork-policy',
  '/pages/privacy',
  '/pages/terms',
  '/pages/data-retention',
  '/pages/cookie-policy',
  '/pages/marketing-consent',
  '/pages/payment-security',
  '/pages/account-security',
  '/pages/security',
];

for (const route of requiredLinks) {
  expect(footer.includes(route), `shared footer retains customer route ${route}`);
}

expect(footer.includes('gdp:open-cookie-preferences'), 'Cookie Preferences action remains wired');
expect(footer.includes('recordMarketingConsent'), 'newsletter consent keeps the existing privacy API');
expect(footer.includes('Secure checkout via Stripe'), 'Stripe security trust badge remains visible');
expect(footer.includes('Saskatoon, Saskatchewan, Canada'), 'GDP location footer line remains visible');

console.log('PASS: Custom Studio shared footer integration contract');
