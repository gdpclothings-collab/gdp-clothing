export const STUDIO_V2_STEPS = [
  { id: 'garment', label: 'Garment' },
  { id: 'design', label: 'Choose Design' },
  { id: 'customize', label: 'Customize' },
  { id: 'approval', label: 'Approval' },
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
    case 'SET_COLOR':
      return invalidateAllEditors({ ...state, color: action.color, size: '' });
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
  const values = variants.length ? variants.map((variant) => variant.color) : (product?.colors || []);
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

export function productSizes(product, color) {
  const variants = (product?.variants || []).filter((variant) => variant?.active !== false);
  const values = variants.length
    ? variants.filter((variant) => !color || String(variant.color || '').toLowerCase() === String(color).toLowerCase()).map((variant) => variant.size)
    : (product?.sizes || []);
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

export function studioV2SideHasContent(state, side) {
  const editor = state?.[state.designPath]?.sides?.[validSide(side)];
  if (!editor) return false;
  if (state.designPath === 'seasonal') return Boolean(editor.layers?.some((layer) => layer.visible !== false));
  if (state.designPath === 'bootleg' || state.designPath === 'memorial') {
    const hasPhoto = editor.photos?.some((layer) => layer?.asset?.path && layer.visible !== false) || editor.photo?.path;
    return Boolean(editor.templateId && hasPhoto);
  }
  if (state.designPath === 'upload') return Boolean(editor.artwork?.path);
  return false;
}

export function studioV2PrintableSides(state) {
  return ['front', 'back'].filter((side) => studioV2SideHasContent(state, side));
}

export function studioV2CanContinue(state) {
  if (state.step === 'garment') return Boolean(state.productId && state.color && state.size);
  if (state.step === 'design') return Boolean(state.designPath);
  if (state.step === 'customize') {
    const sides = studioV2PrintableSides(state);
    if (!sides.length) return false;
    return sides.every((side) => Boolean(state[state.designPath]?.sides?.[side]?.confirmed));
  }
  if (state.step === 'approval') {
    const rightsRequired = state.designPath !== 'seasonal';
    return Boolean(state.approval.finalDesignApproved && (!rightsRequired || state.approval.rightsConfirmed));
  }
  return true;
}
