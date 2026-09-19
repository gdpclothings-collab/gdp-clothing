export const BOOTLEG_MAX_TEXT_LAYERS = 8;

/**
 * @param {Record<string, any>} text
 * @returns {{ headline: string, subline: string, message: string }}
 */
function cleanText(text = {}) {
  return {
    headline: String(text?.headline || ''),
    subline: '',
    message: '',
  };
}

/**
 * Keep GDP template transform outside individual text-layer styles while
 * leaving each text layer free to own its visual typography/placement.
 * @param {Record<string, any>} style
 * @param {Record<string, any>} fallbackStyle
 * @returns {Record<string, any>}
 */
export function normalizeBootlegTextStyle(style = {}, fallbackStyle = {}) {
  const layerStyle = { ...(style || {}) };
  delete layerStyle.templateTransform;
  return {
    ...(fallbackStyle || {}),
    ...layerStyle,
    freeTextLayout: true,
  };
}

/**
 * @param {Record<string, any>} editor
 * @param {Record<string, any>} fallbackStyle
 * @returns {Array<Record<string, any>>}
 */
export function resolveBootlegTextLayers(editor = {}, fallbackStyle = {}) {
  if (Array.isArray(editor?.textLayers)) {
    return editor.textLayers
      .filter(Boolean)
      .slice(0, BOOTLEG_MAX_TEXT_LAYERS)
      .map((layer, index) => ({
        id: String(layer.id || `bootleg-text-${index + 1}`),
        name: String(layer.name || `Text ${index + 1}`),
        text: cleanText(layer.text),
        style: normalizeBootlegTextStyle(layer.style || {}, fallbackStyle),
        order: index,
        visible: layer.visible !== false,
      }));
  }

  return [{
    id: 'bootleg-text-legacy',
    name: 'Text 1',
    text: cleanText(editor?.text || {}),
    style: normalizeBootlegTextStyle(editor?.textStyle || {}, fallbackStyle),
    order: 0,
    visible: true,
  }];
}

/**
 * @param {Record<string, any>} editor
 * @param {Array<Record<string, any>>} layers
 * @param {string} activeId
 * @param {Record<string, any>} fallbackStyle
 * @returns {Record<string, any>}
 */
export function buildBootlegTextStatePatch(editor = {}, layers = [], activeId = '', fallbackStyle = {}) {
  const ordered = (layers || [])
    .filter(Boolean)
    .slice(0, BOOTLEG_MAX_TEXT_LAYERS)
    .map((layer, index) => ({
      ...layer,
      id: String(layer.id || `bootleg-text-${index + 1}`),
      name: String(layer.name || `Text ${index + 1}`),
      text: cleanText(layer.text),
      style: normalizeBootlegTextStyle(layer.style || {}, fallbackStyle),
      order: index,
      visible: layer.visible !== false,
    }));

  const active = ordered.find((layer) => layer.id === activeId) || ordered.at(-1) || null;
  const templateTransform = editor?.textStyle?.templateTransform;
  const mirroredStyle = active
    ? { ...active.style, ...(templateTransform ? { templateTransform } : {}) }
    : { ...(fallbackStyle || {}), freeTextLayout: true, ...(templateTransform ? { templateTransform } : {}) };

  return {
    textLayers: ordered,
    activeTextLayerId: active?.id || '',
    text: active?.text || { headline: '', subline: '', message: '' },
    textStyle: mirroredStyle,
  };
}
