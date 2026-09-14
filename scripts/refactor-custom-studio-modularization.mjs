import fs from 'node:fs';

const corePath = 'src/pages/CustomStudio.jsx';
const garmentPath = 'src/components/storefront/custom-studio/GarmentStep.jsx';
const choosePath = 'src/components/storefront/custom-studio/ChooseDesignStep.jsx';
const timingPath = 'src/components/storefront/custom-studio/TimingApprovalStep.jsx';
const reviewPath = 'src/components/storefront/custom-studio/ReviewStep.jsx';
const reducerPath = 'src/hooks/useCustomStudioWorkflowState.js';
const architecturePath = 'scripts/verify-custom-studio-shell-architecture.mjs';
const garmentGuardPath = 'scripts/verify-custom-studio-garment-interactions.mjs';

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing modularization anchor: ${label}`);
  return source.replace(from, to);
}

function extractConditional(source, start, end, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`Missing start anchor: ${label}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`Missing end anchor: ${label}`);
  const block = source.slice(startIndex, endIndex);
  let jsx = block.replace(start, '<div>');
  const tailPattern = /\n\s*<\/div>}\s*$/;
  if (!tailPattern.test(jsx)) throw new Error(`Could not normalize JSX tail: ${label}`);
  jsx = jsx.replace(tailPattern, '\n</div>');
  return { block, jsx };
}

function writeComponent(path, imports, name, destructured, jsx) {
  const source = `${imports}\n\nexport default function ${name}({ model }) {\n  const {\n    ${destructured.join(',\n    ')}\n  } = model;\n\n  return (\n${jsx.split('\n').map((line) => `    ${line}`).join('\n')}\n  );\n}\n`;
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, source);
}

let core = fs.readFileSync(corePath, 'utf8');
if (core.includes('@/components/storefront/custom-studio/GarmentStep')) {
  console.log('Custom Studio already modularized; no structural transform needed.');
  process.exit(0);
}

const step2 = extractConditional(
  core,
  '          {step === 2 && <div>',
  '          {step === 3 && <div>',
  'Choose Design step'
);
const step1 = extractConditional(
  core,
  '          {step === 1 && <div>',
  '          {step === 3 && <div data-editor-legacy="photo-upload"',
  'Garment step'
);
const step4 = extractConditional(
  core,
  '          {step === 4 && <div>',
  '          {step === 5 && <div>',
  'Timing & Approval step'
);
const step5 = extractConditional(
  core,
  '          {step === 5 && <div>',
  '        </section>',
  'Review step'
);

writeComponent(
  garmentPath,
  'import React from "react";\nimport { ArrowRight, Check, Minus, Plus } from "lucide-react";',
  'GarmentStep',
  [
    'StepTitle', 'catalog', 'product', 'garmentFromProduct', 'studioCardImage', 'chooseProduct', 'GarmentShape',
    'showGarmentPrices', 'availableColors', 'color', 'chooseColor', 'swatchFor', 'availableSizes', 'variantFor',
    'variantAvailable', 'setSize', 'qty', 'setQty', 'addGroupGarment', 'groupGarments', 'GroupRow', 'updateGroup',
    'removeGroup', 'selectedAvailable', 'canContinue', 'continueHint', 'setStep'
  ],
  step1.jsx
);

writeComponent(
  choosePath,
  'import React from "react";\nimport { ArrowRight } from "lucide-react";',
  'ChooseDesignStep',
  [
    'StepTitle', 'DESIGN_PATHS', 'placement', 'groupGarments', 'designPath', 'setDesignPath', 'setMemorialNameConfirmed',
    'setSeasonalMode', 'setDesignStylesBySide', 'setPreviewSide', 'setArtworkStates', 'defaultArtworkStates',
    'setDesignMood', 'setDesignIntensity', 'setStep'
  ],
  step2.jsx
);

writeComponent(
  timingPath,
  'import React from "react";\nimport { Link } from "react-router-dom";\nimport { ShieldCheck } from "lucide-react";',
  'TimingApprovalStep',
  [
    'StepTitle', 'designPath', 'needByDate', 'setNeedByDate', 'Choice', 'priority', 'setPriority', 'rushFee',
    'rightsConfirmed', 'setRightsConfirmed', 'approvalAcknowledged', 'setApprovalAcknowledged'
  ],
  step4.jsx
);

writeComponent(
  reviewPath,
  'import React from "react";',
  'ReviewStep',
  [
    'StepTitle', 'ReviewCard', 'DESIGN_PATHS', 'designPath', 'seasonalPrepared', 'seasonalDraft', 'orderDesignStyle',
    'designMood', 'personalization', 'product', 'color', 'size', 'qty', 'placement', 'printSummaryForSide', 'artworkStates',
    'photos', 'priority', 'needByDate', 'groupGarments', 'estimatedSubtotal', 'createAndAdd', 'saving', 'rightsConfirmed',
    'approvalAcknowledged'
  ],
  step5.jsx
);

const reducerSource = `import { useMemo, useReducer } from "react";\n\nfunction resolveNext(current, value) {\n  return typeof value === "function" ? value(current) : value;\n}\n\nfunction workflowReducer(state, action) {\n  if (!action || action.type !== "set") return state;\n  const nextValue = resolveNext(state[action.key], action.value);\n  if (Object.is(nextValue, state[action.key])) return state;\n  return { ...state, [action.key]: nextValue };\n}\n\nexport function useCustomStudioWorkflowState(fallbackGarment) {\n  const [state, dispatch] = useReducer(workflowReducer, null, () => ({\n    step: 1,\n    seasonalMode: false,\n    seasonalDraft: null,\n    seasonalPrepared: null,\n    designPath: "",\n    catalog: [],\n    product: null,\n    designMood: "Original",\n    designIntensity: 3,\n    garment: fallbackGarment,\n    color: "",\n    size: "",\n    qty: 1,\n    placement: "front",\n    previewSide: "front",\n    designStylesBySide: { front: "", back: "" },\n    groupGarments: [],\n  }));\n\n  const setters = useMemo(() => ({\n    setStep: (value) => dispatch({ type: "set", key: "step", value }),\n    setSeasonalMode: (value) => dispatch({ type: "set", key: "seasonalMode", value }),\n    setSeasonalDraft: (value) => dispatch({ type: "set", key: "seasonalDraft", value }),\n    setSeasonalPrepared: (value) => dispatch({ type: "set", key: "seasonalPrepared", value }),\n    setDesignPath: (value) => dispatch({ type: "set", key: "designPath", value }),\n    setCatalog: (value) => dispatch({ type: "set", key: "catalog", value }),\n    setProduct: (value) => dispatch({ type: "set", key: "product", value }),\n    setDesignMood: (value) => dispatch({ type: "set", key: "designMood", value }),\n    setDesignIntensity: (value) => dispatch({ type: "set", key: "designIntensity", value }),\n    setGarment: (value) => dispatch({ type: "set", key: "garment", value }),\n    setColor: (value) => dispatch({ type: "set", key: "color", value }),\n    setSize: (value) => dispatch({ type: "set", key: "size", value }),\n    setQty: (value) => dispatch({ type: "set", key: "qty", value }),\n    setPlacement: (value) => dispatch({ type: "set", key: "placement", value }),\n    setPreviewSide: (value) => dispatch({ type: "set", key: "previewSide", value }),\n    setDesignStylesBySide: (value) => dispatch({ type: "set", key: "designStylesBySide", value }),\n    setGroupGarments: (value) => dispatch({ type: "set", key: "groupGarments", value }),\n  }), []);\n\n  return { ...state, ...setters };\n}\n`;
fs.mkdirSync('src/hooks', { recursive: true });
fs.writeFileSync(reducerPath, reducerSource);

core = replaceOnce(
  core,
  'import SeasonalStudio from "@/components/storefront/SeasonalStudio";',
  'import SeasonalStudio from "@/components/storefront/SeasonalStudio";\nimport GarmentStep from "@/components/storefront/custom-studio/GarmentStep";\nimport ChooseDesignStep from "@/components/storefront/custom-studio/ChooseDesignStep";\nimport TimingApprovalStep from "@/components/storefront/custom-studio/TimingApprovalStep";\nimport ReviewStep from "@/components/storefront/custom-studio/ReviewStep";\nimport { useCustomStudioWorkflowState } from "@/hooks/useCustomStudioWorkflowState";',
  'module imports'
);

const workflowStateStart = '  const [step, setStep] = useState(1);\n';
const workflowStateEnd = '  const [designStylesBySide, setDesignStylesBySide] = useState({ front: "", back: "" });\n';
const startIndex = core.indexOf(workflowStateStart);
const endIndex = core.indexOf(workflowStateEnd, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error('Could not locate workflow state declarations.');
const afterEnd = endIndex + workflowStateEnd.length;
const workflowHook = `  const {\n    step, setStep,\n    seasonalMode, setSeasonalMode,\n    seasonalDraft, setSeasonalDraft,\n    seasonalPrepared, setSeasonalPrepared,\n    designPath, setDesignPath,\n    catalog, setCatalog,\n    product, setProduct,\n    designMood, setDesignMood,\n    designIntensity, setDesignIntensity,\n    garment, setGarment,\n    color, setColor,\n    size, setSize,\n    qty, setQty,\n    placement, setPlacement,\n    previewSide, setPreviewSide,\n    designStylesBySide, setDesignStylesBySide,\n    groupGarments, setGroupGarments,\n  } = useCustomStudioWorkflowState(FALLBACK_GARMENT);\n`;
core = core.slice(0, startIndex) + workflowHook + core.slice(afterEnd);
core = replaceOnce(core, '  const [groupGarments, setGroupGarments] = useState([]);\n', '', 'legacy group garment state');

const garmentInvocation = `          {step === 1 && <GarmentStep model={{\n            StepTitle, catalog, product, garmentFromProduct, studioCardImage, chooseProduct, GarmentShape, showGarmentPrices,\n            availableColors, color, chooseColor, swatchFor, availableSizes, variantFor, variantAvailable, setSize, qty, setQty,\n            addGroupGarment, groupGarments, GroupRow, updateGroup, removeGroup, selectedAvailable, canContinue, continueHint, setStep,\n          }} />}\n\n`;
const chooseInvocation = `          {step === 2 && <ChooseDesignStep model={{\n            StepTitle, DESIGN_PATHS, placement, groupGarments, designPath, setDesignPath, setMemorialNameConfirmed, setSeasonalMode,\n            setDesignStylesBySide, setPreviewSide, setArtworkStates, defaultArtworkStates, setDesignMood, setDesignIntensity, setStep,\n          }} />}\n`;
const timingInvocation = `          {step === 4 && <TimingApprovalStep model={{\n            StepTitle, designPath, needByDate, setNeedByDate, Choice, priority, setPriority, rushFee, rightsConfirmed, setRightsConfirmed,\n            approvalAcknowledged, setApprovalAcknowledged,\n          }} />}\n\n`;
const reviewInvocation = `          {step === 5 && <ReviewStep model={{\n            StepTitle, ReviewCard, DESIGN_PATHS, designPath, seasonalPrepared, seasonalDraft, orderDesignStyle, designMood, personalization,\n            product, color, size, qty, placement, printSummaryForSide, artworkStates, photos, priority, needByDate, groupGarments,\n            estimatedSubtotal, createAndAdd, saving, rightsConfirmed, approvalAcknowledged,\n          }} />}\n`;

core = core.replace(step2.block, chooseInvocation);
core = core.replace(step1.block, garmentInvocation);
core = core.replace(step4.block, timingInvocation);
core = core.replace(step5.block, reviewInvocation);
fs.writeFileSync(corePath, core);

let architecture = fs.readFileSync(architecturePath, 'utf8');
architecture = replaceOnce(
  architecture,
  "const workspacePath = 'src/pages/CustomStudioDesktopWorkspace.jsx';\n",
  "const workspacePath = 'src/pages/CustomStudioDesktopWorkspace.jsx';\nconst garmentStepPath = 'src/components/storefront/custom-studio/GarmentStep.jsx';\nconst chooseStepPath = 'src/components/storefront/custom-studio/ChooseDesignStep.jsx';\nconst timingStepPath = 'src/components/storefront/custom-studio/TimingApprovalStep.jsx';\nconst reviewStepPath = 'src/components/storefront/custom-studio/ReviewStep.jsx';\nconst workflowStatePath = 'src/hooks/useCustomStudioWorkflowState.js';\n",
  'architecture module paths'
);
architecture = replaceOnce(
  architecture,
  "const workspace = fs.readFileSync(workspacePath, 'utf8');\n",
  "const workspace = fs.readFileSync(workspacePath, 'utf8');\nconst garmentStep = fs.readFileSync(garmentStepPath, 'utf8');\nconst chooseStep = fs.readFileSync(chooseStepPath, 'utf8');\nconst timingStep = fs.readFileSync(timingStepPath, 'utf8');\nconst reviewStep = fs.readFileSync(reviewStepPath, 'utf8');\nconst workflowState = fs.readFileSync(workflowStatePath, 'utf8');\n",
  'architecture module reads'
);
architecture = replaceOnce(
  architecture,
  "assert.ok(core.includes('className=\"gdp-custom-studio-core'), 'Core CustomStudio must expose the stable unversioned shell class.');\n",
  "assert.ok(core.includes('className=\"gdp-custom-studio-core'), 'Core CustomStudio must expose the stable unversioned shell class.');\nassert.ok(core.includes('@/components/storefront/custom-studio/GarmentStep'), 'Core must delegate Step 1 to GarmentStep.');\nassert.ok(core.includes('@/components/storefront/custom-studio/ChooseDesignStep'), 'Core must delegate Step 2 to ChooseDesignStep.');\nassert.ok(core.includes('@/components/storefront/custom-studio/TimingApprovalStep'), 'Core must delegate Step 4 to TimingApprovalStep.');\nassert.ok(core.includes('@/components/storefront/custom-studio/ReviewStep'), 'Core must delegate Step 5 to ReviewStep.');\nassert.ok(core.includes('useCustomStudioWorkflowState(FALLBACK_GARMENT)'), 'Core workflow state must use the shared reducer hook.');\nassert.ok(garmentStep.includes('onClick={() => chooseProduct(option)}'), 'GarmentStep must preserve the native garment chooseProduct interaction.');\nassert.ok(chooseStep.includes('CHOOSE YOUR DESIGN PATH'), 'ChooseDesignStep must own the design-path UI.');\nassert.ok(timingStep.includes('TIMING + FINAL APPROVAL'), 'TimingApprovalStep must own approval UI.');\nassert.ok(reviewStep.includes('REVIEW THE EXACT RESULT'), 'ReviewStep must own final review UI.');\nassert.ok(workflowState.includes('function workflowReducer'), 'Workflow state must be reducer-backed.');\nassert.ok(workflowState.includes('setPlacement') && workflowState.includes('setDesignStylesBySide'), 'Workflow reducer must preserve functional setter adapters used by the editor.');\nassert.ok(!core.includes('{step === 1 && <div>'), 'Step 1 must not be inlined back into the page monolith.');\nassert.ok(!core.includes('{step === 2 && <div>'), 'Step 2 must not be inlined back into the page monolith.');\nassert.ok(!core.includes('{step === 4 && <div>'), 'Step 4 must not be inlined back into the page monolith.');\nassert.ok(!core.includes('{step === 5 && <div>'), 'Step 5 must not be inlined back into the page monolith.');\n",
  'architecture modularization assertions'
);
architecture = architecture.replace(
  "console.log('- one unversioned desktop runtime owns desktop-only presentation behavior');",
  "console.log('- one unversioned desktop runtime owns desktop-only presentation behavior');\nconsole.log('- stable customer steps are isolated modules and workflow state is reducer-backed');"
);
fs.writeFileSync(architecturePath, architecture);

let garmentGuard = fs.readFileSync(garmentGuardPath, 'utf8');
garmentGuard = replaceOnce(
  garmentGuard,
  'const workspaceSource = fs.readFileSync("src/pages/CustomStudioDesktopWorkspace.jsx", "utf8");\n',
  'const workspaceSource = fs.readFileSync("src/pages/CustomStudioDesktopWorkspace.jsx", "utf8");\nconst garmentStepSource = fs.readFileSync("src/components/storefront/custom-studio/GarmentStep.jsx", "utf8");\n',
  'garment guard module read'
);
garmentGuard = garmentGuard.replace(
  'if (!studioSource.includes(\'onClick={() => chooseProduct(option)}\')) {',
  'if (!garmentStepSource.includes(\'onClick={() => chooseProduct(option)}\')) {'
);
garmentGuard = garmentGuard.replace(
  'if (!studioSource.includes(\'key={option.id}\')) {',
  'if (!garmentStepSource.includes(\'key={option.id}\')) {'
);
garmentGuard = garmentGuard.replace(
  'console.log("- pointer recovery, catalog restoration, exact-color mockups, full-garment layout and sticky navigation remain protected");',
  'console.log("- pointer recovery, catalog restoration, exact-color mockups, full-garment layout and sticky navigation remain protected");\nconsole.log("- Step 1 native garment interactions remain protected after component extraction");'
);
fs.writeFileSync(garmentGuardPath, garmentGuard);

console.log('Custom Studio modularization transform complete.');
console.log('- extracted Garment, Choose Design, Timing & Approval, and Review steps');
console.log('- introduced reducer-backed workflow state with stable setter adapters');
console.log('- left Step 3 editor and production rendering behavior unchanged');
