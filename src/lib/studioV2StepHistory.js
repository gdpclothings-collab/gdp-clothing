/**
 * Custom Studio history is intentionally limited to the wizard. URL query
 * entries are created through React Router, not native pushState, so the
 * application router and Chrome/Android/iOS history remain synchronized.
 *
 * A query string alone is never trusted to advance into an uninitialized
 * editor: only router state installed by a real wizard action can restore a
 * later step. This preserves existing deep links, cart edit drafts and
 * browser reload behavior without storing customer artwork in the URL.
 */
export const STUDIO_HISTORY_STATE_KEY = '__gdpStudioHistoryStep';
export const STUDIO_HISTORY_QUERY_KEY = 'studioStep';
export const STUDIO_GARMENT_VIEW_STATE_KEY = '__gdpStudioGarmentView';
export const STUDIO_GARMENT_VIEW_QUERY_KEY = 'garmentView';

const isGarmentView = (value) => value === 'browse' || value === 'focused';

export const STUDIO_HISTORY_STEPS = Object.freeze([
  'garment',
  'design',
  'customize',
  'review',
]);

const isStudioStep = (value) => STUDIO_HISTORY_STEPS.includes(value);

export function studioHistoryActionStep(action) {
  if (action?.type === 'SET_DESIGN_PATH') return 'customize';
  if (['RESET', 'SELECT_PRODUCT', 'BROWSE_GARMENTS', 'FOCUS_GARMENT'].includes(action?.type)) return 'garment';
  if (action?.type === 'SET_STEP' && isStudioStep(action.step)) return action.step;
  return null;
}

export function studioHistoryActionGarmentView(action, currentView, selectedProductId) {
  if (action?.type === 'RESET' || action?.type === 'BROWSE_GARMENTS') return 'browse';
  if (action?.type === 'SELECT_PRODUCT' || action?.type === 'FOCUS_GARMENT') return 'focused';
  if (action?.type === 'SET_STEP' && action.step === 'garment') return selectedProductId ? 'focused' : 'browse';
  return isGarmentView(currentView) ? currentView : 'browse';
}

export function studioHistoryGarmentView(routeState, baselineView = 'browse', selectedProductId = '') {
  const view = routeState?.[STUDIO_GARMENT_VIEW_STATE_KEY];
  const desired = isGarmentView(view) ? view : baselineView;
  return desired === 'focused' && !selectedProductId ? 'browse' : (isGarmentView(desired) ? desired : 'browse');
}

export function studioHistoryShouldPush(currentStep, nextStep, currentView, nextView) {
  return currentStep !== nextStep || (nextStep === 'garment' && currentView !== nextView);
}

export function studioHistoryDestination(location, step, garmentView = 'browse') {
  if (!isStudioStep(step)) return null;
  const params = new URLSearchParams(location?.search || '');
  params.set(STUDIO_HISTORY_QUERY_KEY, step);
  if (step === 'garment' && isGarmentView(garmentView)) params.set(STUDIO_GARMENT_VIEW_QUERY_KEY, garmentView);
  else params.delete(STUDIO_GARMENT_VIEW_QUERY_KEY);
  return {
    pathname: location?.pathname || '/custom-studio',
    search: `?${params.toString()}`,
    hash: location?.hash || '',
  };
}

export function studioHistoryStep(routeState, baselineStep = 'garment') {
  const marker = routeState?.[STUDIO_HISTORY_STATE_KEY];
  return isStudioStep(marker)
    ? marker
    : (isStudioStep(baselineStep) ? baselineStep : 'garment');
}

/**
 * A hard reload does not recreate editor artwork from arbitrary URL/history
 * entries. Fall back to the nearest usable step rather than an empty editor.
 */
export function studioHistorySafeStep(step, state) {
  if (!isStudioStep(step) || step === 'garment') return 'garment';
  if (!state?.productId) return 'garment';
  if ((step === 'customize' || step === 'review') && !state?.designPath) return 'design';
  return step;
}
