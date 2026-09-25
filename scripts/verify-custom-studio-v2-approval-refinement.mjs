import fs from 'node:fs';

const page = fs.readFileSync('src/pages/CustomStudioV2.jsx', 'utf8');
const state = fs.readFileSync('src/lib/customStudioV2State.js', 'utf8');
const guard = fs.readFileSync('src/components/storefront/custom-studio-v2/CustomStudioV2PresentationGuard.jsx', 'utf8');
const css = fs.readFileSync('src/components/storefront/custom-studio-v2/customStudioV2ApprovalRefinement.css', 'utf8');

const checks = [
  [guard.includes("import './customStudioV2ApprovalRefinement.css';"), 'V2 presentation guard must load the approval refinement stylesheet'],
  [guard.includes('data-gdp-studio-v2-guard="true"'), 'approval refinement must remain scoped to the V2 presentation guard'],
  [page.includes('I approve the final print layout'), 'canonical final-layout approval control must remain present'],
  [page.includes('finalDesignApproved: !state.approval.finalDesignApproved'), 'canonical approval toggle must remain intact'],
  [page.includes("if (!product || finalizing || !state.approval.finalDesignApproved) return;"), 'finalization must still require final design approval'],
  [state.includes("needByDate: ''"), 'backward-compatible needByDate state support must remain intact behind the presentation layer'],
  [page.includes("needByDate: state.approval.needByDate || null"), 'existing needByDate payload compatibility must remain intact'],
  [css.includes('label:has(input[type="date"])'), 'legacy customer-facing Needed by input selector must remain safely date-scoped'],
  [css.includes('grid-template-columns: minmax(0, 1fr) !important'), 'legacy approval layout must collapse cleanly if an older date-input presentation is rendered'],
  [css.includes('border: 2px solid rgb(71 85 105)'), 'unchecked legacy approval circle must retain a clearly visible border'],
  [css.includes('button.border-emerald-500'), 'checked legacy approval state must preserve its explicit green styling'],
  [css.includes('> div:nth-child(5)'), 'legacy Needed by summary tile must remain hidden in older Final Review markup'],
  [!css.includes('display: none !important;\n}\n\n[data-gdp-studio-v2-guard="true"] button'), 'refinement must not globally hide V2 buttons'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error('Custom Studio V2 approval refinement regression guard failed:');
  for (const message of failed) console.error(`- ${message}`);
  process.exit(1);
}

console.log('Custom Studio V2 approval refinement regression guard passed.');
