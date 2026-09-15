import fs from 'node:fs';

const layout = fs.readFileSync('src/components/storefront/Layout.jsx', 'utf8');
const shell = fs.readFileSync('src/components/storefront/CustomStudioShellEnhancer.jsx', 'utf8');
const approval = fs.readFileSync('src/components/storefront/custom-studio/TimingApprovalStep.jsx', 'utf8');
const css = fs.readFileSync('src/components/storefront/customStudioMobileRegressionFix.css', 'utf8');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const cssImport = 'import "./customStudioMobileRegressionFix.css";';
expect(layout.includes(cssImport), 'Mobile regression repair stylesheet must be loaded by the storefront layout.');
expect(
  layout.indexOf(cssImport) > layout.indexOf('import "./seasonalStudioWorkspaceFix.css";'),
  'Mobile regression repair stylesheet must load last so it can safely override older phone rules.'
);

expect(shell.includes('function detectMobileMenu(root)'), 'Custom Studio shell must track the storefront mobile menu state.');
expect(shell.includes('root.dataset.gdpMobileMenuOpen = "true"'), 'Open mobile navigation must be exposed to scoped Studio CSS.');
expect(shell.includes('delete root.dataset.gdpMobileMenuOpen'), 'Mobile navigation state must be cleaned up when closed/unmounted.');

expect(css.includes('@media (max-width: 767px)'), 'Regression repair must remain phone-scoped.');
expect(!css.includes('@media (min-width:'), 'Phone regression repair must not change tablet/desktop breakpoints.');
expect(css.includes('.gdp-studio-active > header'), 'Storefront header needs an explicit Studio stacking boundary.');
expect(css.includes('z-index: 200 !important'), 'Storefront header must stay above elevated canvas/editor controls.');
expect(css.includes('[data-gdp-mobile-menu-open="true"] [data-gdp-step-nav="mobile"]'), 'Studio mobile navigation must be suspended while the hamburger menu is open.');
expect(css.includes('[data-seasonal-approved-preview]'), 'Prepared Seasonal approval preview needs mobile render stabilization.');
expect(css.includes('contain: layout paint'), 'Prepared approval preview should be isolated from mobile repaint/layout bleed.');

expect(approval.includes('SEASONAL_PREVIEW_TIMEOUT_MS = 15000'), 'Final approval must have a bounded render wait instead of an infinite spinner.');
expect(approval.includes('preview.dataset.seasonalPreviewState'), 'Final approval must consume the runtime guard readiness state.');
expect(approval.includes('attributeFilter: ["src", "data-seasonal-preview-state"]'), 'Final approval must react when the guard marks the prepared preview ready/error.');
expect(approval.includes('Retry preview check'), 'A failed prepared preview must provide a recoverable retry action.');
expect(approval.includes('setApprovalAcknowledged(false)'), 'Approval must be cleared when the exact prepared preview is not ready.');

const forbiddenCssTokens = ['customerApi', 'supabase', 'stripe', 'addItem(', 'replaceItem('];
for (const token of forbiddenCssTokens) {
  expect(!css.toLowerCase().includes(token.toLowerCase()), `Presentation-only repair CSS must not contain business wiring token: ${token}`);
}

console.log('Custom Studio mobile regression repair guard passed.');
