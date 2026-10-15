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

export const STUDIO_HISTORY_STEPS = Object.freeze([
  'garment',
  'design',
  'customize',
  'review',
]);

const isStudioStep = (value) => STUDIO_HISTORY_STEPS.includes(value);

export function studioHistoryActionStep(action) {
  if (action?.type === 'SET_DESIGN_PATH') return 'customize';
  if (action?.type === 'RESET' || action?.type === 'SELECT_PRODUCT') return 'garment';
  if (action?.type === 'SET_STEP' && isStudioStep(action.step)) return action.step;
  return null;
}

export function studioHistoryDestination(location, step) {
  if (!isStudioStep(step)) return null;
  const params = new URLSearchParams(location?.search || '');
  params.set(STUDIO_HISTORY_QUERY_KEY, step);
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
