import { sortApparelSizes } from './productVariants.js';

export const STUDIO_V2_STEPS = [
  { id: 'garment', label: 'Garment' },
  { id: 'design', label: 'Choose Design' },
  { id: 'customize', label: 'Customize & Approve' },
  { id: 'review', label: 'Review' },
];

export const STUDIO_V2_DESIGN_PATHS = [
  { id: 'seasonal', label: 'Seasonal Designs', description: 'Layer seasonal artwork and arrange it directly on the print area.' },
  { id: 'bootleg', label: 'Photo Bootleg Designs', description: 'Protected GDP layouts with editable customer photos and text.' },
  { id: 'memorial', label: 'Memorial Tribute Designs', description: 'Protected tribute layouts with portrait, name, dates and message editing.' },
  { id: 'upload', label: 'Upload My Own Artwork', description: 'Upload original artwork and control placement, size and print side.' },
];

const seasonalSideState = () => ({ layers: [], activeLayerId: '', confirmed: false });
const protectedSideState = () => ({
  templateId: '',
  photo: null,
  transform: { scale: 100, rotation: 0, x: 0, y: 0 },
  photos: [],
  activePhotoId: '',
  stickers: [],
  activeStickerId: '',
  text: { headline: '', subline: '', message: '' },
  textStyle: {
    fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
    fontScale: 100,
    color: '#ffffff',
    curve: 'straight',
    curveAmount: 45,
    effect: 'shadow',
    effectStrength: 45,
    rotation: 0,
    x: 0,
    y: 0,
  },
  confirmed: false,
});
const uploadSideState = () => ({
  artwork: null,
  transform: { scale: 100, rotation: 0, x: 0, y: 0 },
  confirmed: false,
});
const pathSides = (factory) => ({ front: factory(), back: factory() });

export function createInitialStudioV2State() {
  return {
    step: 'garment',
    productId: '',
    color: '',
    size: '',
    quantity: 1,
    designPath: '',
    side: 'front',
    seasonal: { sides: pathSides(seasonalSideState) },
    bootleg: { sides: pathSides(protectedSideState) },
    memorial: { sides: pathSides(protectedSideState) },
    upload: { sides: pathSides(uploadSideState) },
    approval: {
      needByDate: '',
      rightsConfirmed: false,
      finalDesignApproved: false,
    },
  };
}

// A saved design is always reopened as a NEW working copy. Never carry over
// approvals or production authority from a previous order.
export function createStudioV2ReuseState(saved, newGarment = false) {
  if (!saved || !["seasonal", "bootleg", "memorial", "upload"].includes(saved.designPath)) {
    return createInitialStudioV2State();
  }
  const base = createInitialStudioV2State();
  const next = { ...base, ...saved };
  for (const path of ["seasonal", "bootleg", "memorial", "upload"]) {
    const stored = saved[path]?.sides || {};
    next[path] = {
      sides: Object.fromEntries(["front", "back"].map((side) => [
        side, { ...base[path].sides[side], ...(stored[side] || {}), confirmed: false },
      ])),
    };
  }
  next.approval = { ...base.approval, ...(saved.approval || {}), finalDesignApproved: false, rightsConfirmed: false };
  next.step = newGarment ? "garment" : "customize";
  next.reusePending = Boolean(newGarment);
  if (newGarment) {
    next.productId = "";
    next.color = "";
    next.size = "";
    next.quantity = 1;
  }
  return next;
}

export const initialStudioV2State = createInitialStudioV2State();

function invalidatePath(path) {
  return {
    ...path,
    sides: Object.fromEntries(Object.entries(path.sides || {}).map(([side, editor]) => [side, { ...editor, confirmed: false }])),
  };
}

function invalidateApproval(state) {
  return { ...state, approval: { ...state.approval, finalDesignApproved: false } };
}

function invalidateAllEditors(state) {
  return invalidateApproval({
    ...state,
    seasonal: invalidatePath(state.seasonal),
    bootleg: invalidatePath(state.bootleg),
    memorial: invalidatePath(state.memorial),
    upload: invalidatePath(state.upload),
  });
}

function validSide(side) {
  return side === 'back' ? 'back' : 'front';
}

export function studioV2Reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return createInitialStudioV2State();
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'SELECT_PRODUCT': {
      const next = createInitialStudioV2State();
      return { ...next, productId: action.productId, color: action.color || '' };
    }
    case 'SELECT_PRODUCT_FOR_REUSE':
      // Preserve editable artwork while switching blank garments. Render and
      // customer approval are mandatory again for the new print dimensions.
      return invalidateAllEditors({
        ...state, productId: action.productId, color: action.color || '', size: '',
        quantity: 1, step: 'garment', reusePending: true,
      });
    case 'SET_COLOR':
      return invalidateAllEditors({ ...state, color: action.color, size: action.size || '' });
    case 'SET_SIZE':
      return invalidateAllEditors({ ...state, size: action.size });
    case 'SET_QUANTITY':
      return { ...state, quantity: Math.max(1, Number(action.quantity || 1)) };
    case 'SET_DESIGN_PATH':
      return invalidateApproval({ ...state, designPath: action.designPath, step: 'customize', side: 'front' });
    case 'SET_SIDE':
      return { ...state, side: validSide(action.side) };
    case 'SET_APPROVAL':
      return { ...state, approval: { ...state.approval, ...(action.patch || {}) } };
    case 'CONFIRM_FINAL_LAYOUT': {
      // The UI exposes one checkbox, but the canonical side-specific and
      // artwork-rights flags must still be recorded for production/checkout.
      const designPath = state.designPath;
      const originalSides = state?.[designPath]?.sides;
      if (!originalSides) return state;
      const printableSides = studioV2PrintableSides(state);
      const approved = Boolean(action.value) && printableSides.length > 0;
      return {
        ...state,
        [designPath]: {
          ...state[designPath],
          sides: Object.fromEntries(Object.entries(originalSides).map(([side, editor]) => [
            side,
            { ...editor, confirmed: approved && printableSides.includes(side) },
          ])),
        },
        approval: {
          ...state.approval,
          finalDesignApproved: approved,
          // The GDP-managed Seasonal library does not require customers to
          // claim ownership of templates they did not upload.
          rightsConfirmed: approved && designPath !== 'seasonal',
        },
      };
    }
    case 'SET_SEASONAL_LAYERS': {
      const side = validSide(action.side ?? state.side);
      const current = state.seasonal.sides[side];
      return invalidateApproval({
        ...state,
        seasonal: {
          ...state.seasonal,
          sides: {
            ...state.seasonal.sides,
            [side]: {
              ...current,
              layers: action.layers,
              activeLayerId: action.activeLayerId ?? current.activeLayerId,
              confirmed: false,
            },
          },
        },
      });
    }
    case 'SET_SEASONAL_ACTIVE': {
      const side = validSide(action.side ?? state.side);
      return {
        ...state,
        seasonal: {
          ...state.seasonal,
          sides: {
            ...state.seasonal.sides,
            [side]: { ...state.seasonal.sides[side], activeLayerId: action.id },
          },
        },
      };
    }
    case 'CONFIRM_SEASONAL': {
      const side = validSide(action.side ?? state.side);
      return invalidateApproval({
        ...state,
        seasonal: {
          ...state.seasonal,
          sides: {
            ...state.seasonal.sides,
            [side]: { ...state.seasonal.sides[side], confirmed: Boolean(action.value) },
          },
        },
      });
    }
    case 'PATCH_EDITOR': {
      const path = action.path;
      const side = validSide(action.side ?? state.side);
      if (!['bootleg', 'memorial', 'upload'].includes(path)) return state;
      const current = state[path].sides[side];
      return invalidateApproval({
        ...state,
        [path]: {
          ...state[path],
          sides: {
            ...state[path].sides,
            [side]: {
              ...current,
              ...(action.patch || {}),
              confirmed: action.keepConfirmed ? current.confirmed : false,
            },
          },
        },
      });
    }
    case 'CONFIRM_EDITOR': {
      const path = action.path;
      const side = validSide(action.side ?? state.side);
      if (!['bootleg', 'memorial', 'upload'].includes(path)) return state;
      return invalidateApproval({
        ...state,
        [path]: {
          ...state[path],
          sides: {
            ...state[path].sides,
            [side]: { ...state[path].sides[side], confirmed: Boolean(action.value) },
          },
        },
      });
    }
    default:
      return state;
  }
}

export function productColors(product) {
  const variants = (product?.variants || []).filter((variant) => variant?.active !== false);
  const values = [...(product?.colors || []), ...variants.map((variant) => variant.color)];
  return [...new Map(values.map((value) => String(value || '').trim()).filter(Boolean).map((value) => [value.toLowerCase(), value])).values()];
}

export function productSizes(product, color) {
  const variants = (product?.variants || []).filter((variant) => variant?.active !== false);
  const values = variants.length
    ? variants.filter((variant) => !color || String(variant.color || '').toLowerCase() === String(color).toLowerCase()).map((variant) => variant.size)
    : (product?.sizes || []);
  return sortApparelSizes(values);
}

export function studioV2SideHasContent(state, side) {
  const editor = state?.[state.designPath]?.sides?.[validSide(side)];
  if (!editor) return false;
  if (state.designPath === 'seasonal') return Boolean(editor.layers?.some((layer) => layer.visible !== false));
  if (state.designPath === 'bootleg' || state.designPath === 'memorial') {
    // Match the production renderer: an explicit photo stack is authoritative.
    // A hidden/invalid photo must not unlock approval via the legacy photo alias.
    const hasPhoto = Array.isArray(editor.photos) && editor.photos.length
      ? editor.photos.some((layer) => layer?.visible !== false && layer?.asset?.path && layer?.asset?.url)
      : Boolean(editor.photo?.path && editor.photo?.url);
    return Boolean(editor.templateId && hasPhoto);
  }
  if (state.designPath === 'upload') return Boolean(editor.artwork?.path);
  return false;
}

export function studioV2PrintableSides(state) {
  return ['front', 'back'].filter((side) => studioV2SideHasContent(state, side));
}

/** Explain the exact missing print input without weakening production validation. */
export function studioV2MissingArtworkMessage(state) {
  if (studioV2PrintableSides(state).length) return '';
  const sides = ['front', 'back'].map((side) => state?.[state.designPath]?.sides?.[side]).filter(Boolean);
  if (state.designPath === 'seasonal') return 'Choose at least one visible Seasonal artwork for the Front or Back print area.';
  if (state.designPath === 'upload') return 'Upload a printable artwork file to the Front or Back print area.';
  if (state.designPath === 'bootleg' || state.designPath === 'memorial') {
    if (!sides.some((editor) => editor?.templateId)) return 'Choose a protected template and add at least one customer photo on the same print side.';
    return 'A protected template is selected, but printing also needs a customer photo on that same print side. The template is not counted as a photo.';
  }
  return 'Add printable artwork to the Front or Back print area.';
}

export function studioV2CanContinue(state) {
  if (state.step === 'garment') return Boolean(state.productId && state.color && state.size);
  if (state.step === 'design') return Boolean(state.designPath);
  if (state.step === 'customize') {
    const sides = studioV2PrintableSides(state);
    if (!sides.length) return false;
    const sidesConfirmed = sides.every((side) => Boolean(state[state.designPath]?.sides?.[side]?.confirmed));
    const rightsRequired = state.designPath !== 'seasonal';
    return Boolean(sidesConfirmed && state.approval.finalDesignApproved && (!rightsRequired || state.approval.rightsConfirmed));
  }
  if (state.step === 'approval') {
    const rightsRequired = state.designPath !== 'seasonal';
    return Boolean(state.approval.finalDesignApproved && (!rightsRequired || state.approval.rightsConfirmed));
  }
  return true;
}
