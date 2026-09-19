export const BOOTLEG_MAX_TEXT_LAYERS = 8;

function cleanText(text = {}) {
  return {
    headline: String(text?.headline || ''),
    subline: '',
    message: '',
  };
}

export function normalizeBootlegTextStyle(style = {}, fallbackStyle = {}) {
  const layerStyle = { ...(style || {}) };
  delete layerStyle.templateTransform;
  return {
    ...(fallbackStyle || {}),
    ...layerStyle,
    freeTextLayout: true,
  };
}

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
