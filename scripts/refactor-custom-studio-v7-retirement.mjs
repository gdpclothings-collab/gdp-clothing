import fs from 'node:fs';

const corePath = 'src/pages/CustomStudio.jsx';
const workspacePath = 'src/pages/CustomStudioDesktopWorkspace.jsx';
const v7Path = 'src/pages/CustomStudioDesktopWorkspaceV7.jsx';
const architectureTestPath = 'scripts/verify-custom-studio-shell-architecture.mjs';
const garmentTestPath = 'scripts/verify-custom-studio-garment-interactions.mjs';
const guideTestPath = 'scripts/verify-custom-order-guide-visibility.mjs';

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing refactor anchor: ${label}`);
  return source.replace(from, to);
}

let core = fs.readFileSync(corePath, 'utf8');
let workspace = fs.readFileSync(workspacePath, 'utf8');
const v7 = fs.readFileSync(v7Path, 'utf8');

if (core.includes('data-studio-shell')) {
  console.log('Core already contains explicit Studio hooks; skipping structural core replacements.');
} else {
  core = replaceOnce(
    core,
    '<div className="min-h-screen w-full max-w-full overflow-x-clip bg-[linear-gradient(180deg,#F4F7FA_0%,#EDF2F6_38%,#F8FAFC_100%)]">',
    '<div data-studio-shell data-step={step} className="gdp-custom-studio-core min-h-screen w-full max-w-full overflow-x-clip bg-[linear-gradient(180deg,#F4F7FA_0%,#EDF2F6_38%,#F8FAFC_100%)]">',
    'root studio shell'
  );
  core = replaceOnce(
    core,
    '<div className="mx-auto w-full min-w-0 max-w-[1540px] px-4 py-6 md:py-10 lg:px-8">',
    '<div data-studio-container className="mx-auto w-full min-w-0 max-w-[1540px] px-4 py-6 md:py-10 lg:px-8">',
    'studio container'
  );
  core = replaceOnce(
    core,
    '<div className="relative overflow-hidden rounded-[28px] border border-[#DCE3EA] bg-[linear-gradient(135deg,#FFFFFF_0%,#f3ece2_100%)] px-5 py-7 md:px-9 md:py-9 mb-7 shadow-[0_20px_60px_rgba(32,28,22,.07)]">',
    '<div data-studio-hero className="relative overflow-hidden rounded-[28px] border border-[#DCE3EA] bg-[linear-gradient(135deg,#FFFFFF_0%,#f3ece2_100%)] px-5 py-7 md:px-9 md:py-9 mb-7 shadow-[0_20px_60px_rgba(32,28,22,.07)]">',
    'studio hero'
  );
  core = replaceOnce(
    core,
    '        <div className="mb-7">\n          <div className="md:hidden mb-3">',
    '        <div data-studio-rail className="mb-7">\n          <div data-mobile-progress className="md:hidden mb-3">',
    'studio rail and mobile progress'
  );
  core = replaceOnce(
    core,
    '<div className="hidden md:flex items-center gap-0 rounded-2xl border border-[#DCE3EA] bg-white/70 p-2 shadow-sm overflow-x-auto">',
    '<div data-stepper className="hidden md:flex items-center gap-0 rounded-2xl border border-[#DCE3EA] bg-white/70 p-2 shadow-sm overflow-x-auto">',
    'desktop stepper'
  );
  core = replaceOnce(
    core,
    '<div className="mt-3 overflow-hidden rounded-2xl border border-[#DCE3EA] bg-white/75 shadow-sm">',
    '<div data-guide className="mt-3 overflow-hidden rounded-2xl border border-[#DCE3EA] bg-white/75 shadow-sm">',
    'order guide'
  );
  core = replaceOnce(
    core,
    '          <div className="mt-3">\n            <StudioStepNav',
    '          <div data-actions className="mt-3">\n            <StudioStepNav',
    'desktop actions'
  );
  core = replaceOnce(
    core,
    '<div className="grid w-full min-w-0 max-w-full items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">',
    '<div data-studio-row className="grid w-full min-w-0 max-w-full items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">',
    'studio row'
  );
  core = replaceOnce(
    core,
    '<section id="custom-studio-workspace" className="scroll-mt-24 min-w-0 max-w-full overflow-x-clip rounded-[24px] border border-[#e2dcd3] bg-[#FFFFFF] p-4 shadow-[0_18px_50px_rgba(28,24,20,.055)] md:p-8 md:min-h-[560px]">',
    '<section id="custom-studio-workspace" data-workspace className="scroll-mt-24 min-w-0 max-w-full overflow-x-clip rounded-[24px] border border-[#e2dcd3] bg-[#FFFFFF] p-4 shadow-[0_18px_50px_rgba(28,24,20,.055)] md:p-8 md:min-h-[560px]">',
    'workspace section'
  );
  core = replaceOnce(
    core,
    '<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">\n              {(catalog.length ? catalog : (product ? [product] : [])).map((option) => {',
    '<div data-garment-grid className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">\n              {(catalog.length ? catalog : (product ? [product] : [])).map((option) => {',
    'garment grid'
  );
  core = replaceOnce(
    core,
    '            {product && <>\n              <div className="mt-7">',
    '            {product && <>\n              <div data-step1-color className="mt-7">',
    'Step 1 color group'
  );
  core = replaceOnce(
    core,
    '<div className="grid md:grid-cols-[1fr_auto] gap-5 mt-6 items-start">\n                <div>\n                  <label className="font-mono text-xs uppercase text-muted-foreground">Size</label>',
    '<div data-step1-size-quantity className="grid md:grid-cols-[1fr_auto] gap-5 mt-6 items-start">\n                <div data-step1-size>\n                  <label className="font-mono text-xs uppercase text-muted-foreground">Size</label>',
    'Step 1 size group'
  );
  core = replaceOnce(
    core,
    '                <div>\n                  <label className="font-mono text-xs uppercase text-muted-foreground">Quantity</label>',
    '                <div data-step1-quantity>\n                  <label className="font-mono text-xs uppercase text-muted-foreground">Quantity</label>',
    'Step 1 quantity group'
  );
  core = replaceOnce(
    core,
    '<div className="mt-7 border-t border-border pt-5">\n                <div className="flex items-center justify-between gap-4">\n                  <div>\n                    <div className="font-bold">Same design, different sizes or colors</div>',
    '<div data-step1-group className="mt-7 border-t border-border pt-5">\n                <div className="flex items-center justify-between gap-4">\n                  <div>\n                    <div className="font-bold">Same design, different sizes or colors</div>',
    'Step 1 group garment block'
  );
  core = replaceOnce(
    core,
    '<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Choose an available size before continuing.</div>',
    '<div data-step1-validation-message className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Choose an available size before continuing.</div>',
    'Step 1 validation message'
  );
  core = replaceOnce(
    core,
    '<div className="mt-7 hidden items-center justify-between gap-5 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 lg:flex">\n                <div>\n                  <div className="text-sm font-bold text-[#17324D]">Garment selection complete</div>',
    '<div data-step1-complete className="mt-7 hidden items-center justify-between gap-5 rounded-2xl border border-[#DCE3EA] bg-[#F8FAFC] p-4 lg:flex">\n                <div>\n                  <div className="text-sm font-bold text-[#17324D]">Garment selection complete</div>',
    'Step 1 completion card'
  );
  core = replaceOnce(
    core,
    '<aside className="h-fit min-w-0 max-w-full space-y-4 lg:sticky lg:top-24">',
    '<aside data-aside className="h-fit min-w-0 max-w-full space-y-4 lg:sticky lg:top-24">',
    'preview aside'
  );
  core = replaceOnce(
    core,
    '<div data-gdp-design-path={designPath || "none"} className="overflow-hidden rounded-[24px] border border-[#dcd5ca] bg-white shadow-[0_18px_55px_rgba(25,22,18,.085)]">',
    '<div data-preview-card data-gdp-design-path={designPath || "none"} className="overflow-hidden rounded-[24px] border border-[#dcd5ca] bg-white shadow-[0_18px_55px_rgba(25,22,18,.085)]">',
    'preview card'
  );
  core = replaceOnce(
    core,
    '<div className="rounded-[22px] border border-[#ddd6cc] bg-[#17212B] text-white p-5 shadow-[0_14px_40px_rgba(20,18,16,.11)]">\n              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Your order</div>',
    '<div data-order-card className="rounded-[22px] border border-[#ddd6cc] bg-[#17212B] text-white p-5 shadow-[0_14px_40px_rgba(20,18,16,.11)]">\n              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Your order</div>',
    'order summary card'
  );
}

const v7StylesMatch = v7.match(/const styles = `([\s\S]*?)`;\n\nfunction getStep/);
if (!v7StylesMatch) throw new Error('Unable to extract V7 base styles.');
const retiredBaseStyles = v7StylesMatch[1].replaceAll('.gdp-custom-studio-v7', '.gdp-custom-studio-core');

workspace = replaceOnce(
  workspace,
  'import CustomStudioDesktopWorkspaceV7 from "@/pages/CustomStudioDesktopWorkspaceV7";',
  'import CustomStudio from "@/pages/CustomStudio";',
  'unified workspace core import'
);
workspace = workspace.replaceAll('.gdp-custom-studio-v7', '.gdp-custom-studio-core');
workspace = workspace.replaceAll('CustomStudioDesktopWorkspaceV7', 'CustomStudio');
if (!workspace.includes('/* Retired V7 base layout */')) {
  workspace = replaceOnce(
    workspace,
    'const styles = `\n',
    `const styles = \`\n/* Retired V7 base layout */\n${retiredBaseStyles}\n/* Unified desktop refinement layer */\n`,
    'V7 styles migration'
  );
}

workspace = replaceOnce(
  workspace,
  'function restoreExpandedGarmentImages(grid) {\n  if (!grid) return;\n  const collapsed = grid.dataset.gdpCollapsed === "true";\n  const selected = garmentCards(grid).find(isSelected) || null;',
  'function restoreExpandedGarmentImages(grid) {\n  if (!grid) return;\n  const collapsed = grid.dataset.gdpCollapsed === "true";\n  const selected = garmentCards(grid).find(isSelected) || null;',
  'thumbnail restoration anchor'
);
if (!workspace.includes('function syncGarmentChooserState')) {
  workspace = workspace.replace(
    'function exactLabel(root, text) {',
    `function syncGarmentChooserState(grid, resetExpanded = false) {\n  if (!grid) return null;\n  const selected = garmentCards(grid).find(isSelected) || null;\n  if (!selected) {\n    grid.removeAttribute("data-gdp-collapsed");\n    grid.removeAttribute("data-gdp-user-expanded");\n    return null;\n  }\n  if (resetExpanded) grid.dataset.gdpUserExpanded = "false";\n  grid.dataset.gdpCollapsed = grid.dataset.gdpUserExpanded === "true" ? "false" : "true";\n  return selected;\n}\nfunction exactLabel(root, text) {`
  );
}

workspace = replaceOnce(
  workspace,
  '      const grid = garmentGrid(shell);\n      restoreExpandedGarmentImages(grid);\n      const selected = garmentCards(grid).find(isSelected) || null;\n      const identity = String(selected?.querySelector(".font-bold")?.textContent || "").trim();\n      if (identity !== selectedIdentityRef.current) {\n        selectedIdentityRef.current = identity;\n        setValidationVisible(false);\n      }',
  '      const grid = garmentGrid(shell);\n      const currentSelected = garmentCards(grid).find(isSelected) || null;\n      const identity = String(currentSelected?.querySelector(".font-bold")?.textContent || "").trim();\n      const selectionChanged = Boolean(identity && identity !== selectedIdentityRef.current);\n      if (identity !== selectedIdentityRef.current) {\n        selectedIdentityRef.current = identity;\n        setValidationVisible(false);\n      }\n      const selected = syncGarmentChooserState(grid, selectionChanged);\n      restoreExpandedGarmentImages(grid);',
  'garment chooser state transfer'
);

fs.writeFileSync(corePath, core);
fs.writeFileSync(workspacePath, workspace);

const architectureTest = `import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst appPath = 'src/App.jsx';\nconst corePath = 'src/pages/CustomStudio.jsx';\nconst workspacePath = 'src/pages/CustomStudioDesktopWorkspace.jsx';\nconst app = fs.readFileSync(appPath, 'utf8');\nconst core = fs.readFileSync(corePath, 'utf8');\nconst workspace = fs.readFileSync(workspacePath, 'utf8');\nconst retired = [7, 8, 9, 10, 11, 12, 13].map((version) => \`src/pages/CustomStudioDesktopWorkspaceV\${version}.jsx\`);\n\nassert.ok(app.includes("import('@/pages/CustomStudioDesktopWorkspace')"), 'App must route through the unversioned Custom Studio workspace.');\nassert.ok(!/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(app), 'App must not reference retired versioned workspace wrappers.');\nassert.ok(workspace.includes('import CustomStudio from "@/pages/CustomStudio"'), 'Unified workspace must import the core Studio directly.');\nassert.ok(!/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(workspace), 'Unified workspace must not nest any retired versioned wrapper.');\n\nfor (const path of retired) {\n  assert.equal(fs.existsSync(path), false, \`\${path} must stay retired; use git history for rollback.\`);\n}\n\nfor (const hook of ['data-studio-shell','data-studio-container','data-studio-hero','data-studio-rail','data-mobile-progress','data-stepper','data-guide','data-actions','data-studio-row','data-workspace','data-aside','data-preview-card','data-order-card','data-garment-grid','data-step1-color','data-step1-size-quantity','data-step1-size','data-step1-quantity','data-step1-group','data-step1-complete']) {\n  assert.ok(core.includes(hook), \`Core CustomStudio must own explicit semantic hook \${hook}.\`);\n}\nassert.ok(core.includes('data-step={step}'), 'Core CustomStudio must expose the canonical active step without DOM inference.');\nassert.ok(core.includes('className="gdp-custom-studio-core'), 'Core CustomStudio must expose the stable unversioned shell class.');\n\nconst observerCount = (workspace.match(/new MutationObserver/g) || []).length;\nassert.equal(observerCount, 1, \`Unified workspace must own one DOM observer runtime, found \${observerCount}.\`);\nassert.ok(workspace.includes('syncGarmentChooserState'), 'Desktop-only chooser collapse/expand behavior must live in the unified runtime.');\nassert.ok(workspace.includes('restoreExpandedGarmentImages'), 'Catalog thumbnail integrity must live in the unified runtime.');\nassert.ok(workspace.includes('pending.card.click()'), 'Pointer recovery must live in the unified runtime.');\nassert.ok(workspace.includes('gdp-step1-bottom-dock'), 'Step 1 bottom navigation must live in the unified runtime.');\nassert.ok(workspace.includes('gdp-custom-guide-backdrop'), 'Help drawer behavior must live in the unified runtime.');\nassert.ok(workspace.includes('colorMockup(product, color)'), 'Exact selected-color resolution must live in the unified runtime.');\nassert.ok(workspace.includes('estimatedPhotoDpi'), 'Print-quality refinement must live in the unified runtime.');\n\nconsole.log('PASS Custom Studio shell architecture guard');\nconsole.log('- V7-V13 are retired');\nconsole.log('- core CustomStudio owns semantic layout hooks and active-step identity');\nconsole.log('- one unversioned desktop runtime owns desktop-only presentation behavior');\n`;
fs.writeFileSync(architectureTestPath, architectureTest);

let garmentTest = fs.readFileSync(garmentTestPath, 'utf8');
garmentTest = garmentTest.replace('const v7Source = fs.readFileSync("src/pages/CustomStudioDesktopWorkspaceV7.jsx", "utf8");\n', '');
garmentTest = garmentTest.replace(/if \(!workspaceSource\.includes\("CustomStudioDesktopWorkspaceV7"\)\) \{[\s\S]*?\}\n\n/, 'if (!workspaceSource.includes(\'import CustomStudio from "@/pages/CustomStudio"\')) {\n  fail("The unified workspace must import the core CustomStudio directly.");\n}\n\n');
garmentTest = garmentTest.replace('if (/CustomStudioDesktopWorkspaceV(?:8|9|10|11|12|13)/.test(appSource)) {', 'if (/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(appSource)) {');
garmentTest = garmentTest.replace('if (/CustomStudioDesktopWorkspaceV(?:8|9|10|11|12|13)/.test(workspaceSource)) {', 'if (/CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)/.test(workspaceSource)) {');
garmentTest = garmentTest.replace(/if \(!v7Source\.includes\('data-garment-grid'\)[\s\S]*?\}\n\n/, 'if (!studioSource.includes(\'data-garment-grid\') || !studioSource.includes(\'data-studio-shell\')) {\n  fail("Core CustomStudio must own garment-grid and shell annotations directly.");\n}\n\n');
garmentTest = garmentTest.replace('- V7 remains the only temporary legacy layout/annotation layer under the consolidated workspace', '- V7 is retired; semantic hooks now come directly from core CustomStudio');
fs.writeFileSync(garmentTestPath, garmentTest);

let guideTest = fs.readFileSync(guideTestPath, 'utf8');
guideTest = guideTest.replace("const workspace = fs.readFileSync('src/pages/CustomStudioDesktopWorkspace.jsx', 'utf8');", "const workspace = fs.readFileSync('src/pages/CustomStudioDesktopWorkspace.jsx', 'utf8');\nconst core = fs.readFileSync('src/pages/CustomStudio.jsx', 'utf8');");
guideTest = guideTest.replace(/CustomStudioDesktopWorkspaceV\(\?:8\|9\|10\|11\|12\|13\)/g, 'CustomStudioDesktopWorkspaceV(?:7|8|9|10|11|12|13)');
guideTest = guideTest.replace("assert.ok(workspace.includes('.gdp-custom-studio-v7 [data-studio-row]'), 'Guide-aware workspace sizing must apply to all main Studio steps.');", "assert.ok(workspace.includes('.gdp-custom-studio-core [data-studio-row]'), 'Guide-aware workspace sizing must apply to all main Studio steps.');\nassert.ok(core.includes('data-guide') && core.includes('data-studio-rail'), 'Guide and rail hooks must be owned by core CustomStudio markup.');");
fs.writeFileSync(guideTestPath, guideTest);

fs.rmSync(v7Path);
console.log('Custom Studio V7 retirement transformation applied.');
