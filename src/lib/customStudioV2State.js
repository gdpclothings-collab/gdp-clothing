export const STUDIO_V2_STEPS = [
  { id: 'garment', label: 'Garment' },
  { id: 'design', label: 'Choose Design' },
  { id: 'customize', label: 'Customize' },
  { id: 'review', label: 'Review' },
];

export const STUDIO_V2_DESIGN_PATHS = [
  {
    id: 'seasonal',
    label: 'Seasonal Designs',
    description: 'Layer seasonal artwork and arrange it directly on the print area.',
  },
  {
    id: 'bootleg',
    label: 'Photo Bootleg Designs',
    description: 'Protected GDP layouts with editable customer photos and text.',
  },
  {
    id: 'memorial',
    label: 'Memorial Tribute Designs',
    description: 'Protected tribute layouts with portrait, name, dates and message editing.',
  },
  {
    id: 'upload',
    label: 'Upload My Own Artwork',
    description: 'Upload original artwork and control placement, size and print side.',
  },
];

export const initialStudioV2State = {
  step: 'garment',
  productId: '',
  color: '',
  size: '',
  quantity: 1,
  designPath: '',
  side: 'front',
  seasonal: {
    layers: [],
    activeLayerId: '',
    confirmed: false,
  },
};

export function studioV2Reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return initialStudioV2State;
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'SELECT_PRODUCT':
      return {
        ...state,
        productId: action.productId,
        color: action.color || '',
        size: '',
        designPath: '',
        side: 'front',
        seasonal: initialStudioV2State.seasonal,
      };
    case 'SET_COLOR':
      return {
        ...state,
        color: action.color,
        size: '',
        seasonal: { ...state.seasonal, confirmed: false },
      };
    case 'SET_SIZE':
      return {
        ...state,
        size: action.size,
        seasonal: { ...state.seasonal, confirmed: false },
      };
    case 'SET_QUANTITY':
      return { ...state, quantity: Math.max(1, Number(action.quantity || 1)) };
    case 'SET_DESIGN_PATH':
      return {
        ...state,
        designPath: action.designPath,
        step: 'customize',
        seasonal: action.designPath === 'seasonal' ? state.seasonal : initialStudioV2State.seasonal,
      };
    case 'SET_SIDE':
      return { ...state, side: action.side === 'back' ? 'back' : 'front' };
    case 'SET_SEASONAL_LAYERS':
      return {
        ...state,
        seasonal: {
          ...state.seasonal,
          layers: action.layers,
          activeLayerId: action.activeLayerId ?? state.seasonal.activeLayerId,
          confirmed: false,
        },
      };
    case 'SET_SEASONAL_ACTIVE':
      return { ...state, seasonal: { ...state.seasonal, activeLayerId: action.id } };
    case 'CONFIRM_SEASONAL':
      return { ...state, seasonal: { ...state.seasonal, confirmed: Boolean(action.value) } };
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

export function studioV2CanContinue(state) {
  if (state.step === 'garment') return Boolean(state.productId && state.color && state.size);
  if (state.step === 'design') return Boolean(state.designPath);
  if (state.step === 'customize' && state.designPath === 'seasonal') {
    return Boolean(state.seasonal.layers.length && state.seasonal.confirmed);
  }
  if (state.step === 'customize') return false;
  return true;
}
