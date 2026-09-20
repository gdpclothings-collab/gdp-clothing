from pathlib import Path

path = Path('scripts/apply_memorial_v2_layer_parity.py')
text = path.read_text()

preview_old = '''editor = replace_once(
    editor,
    "  const isBootleg = path === 'bootleg';\\n",
    "  const isBootleg = path === 'bootleg';\\n  const isMemorial = path === 'memorial';\\n  const usesLayerLab = isBootleg || isMemorial;\\n",
    'preview layer lab flags',
)
'''
preview_new = '''editor = replace_once(
    editor,
    "function ProtectedPreview({ product, color, size, template, editor, path, stickers, side, onPatch, activeLayer = 'photo', onActiveLayerChange }) {\\n  const zoneRef = useRef(null);\\n  const canvasRef = useRef(null);\\n  const isBootleg = path === 'bootleg';\\n",
    "function ProtectedPreview({ product, color, size, template, editor, path, stickers, side, onPatch, activeLayer = 'photo', onActiveLayerChange }) {\\n  const zoneRef = useRef(null);\\n  const canvasRef = useRef(null);\\n  const isBootleg = path === 'bootleg';\\n  const isMemorial = path === 'memorial';\\n  const usesLayerLab = isBootleg || isMemorial;\\n",
    'preview layer lab flags',
)
'''
if text.count(preview_old) != 1:
    raise RuntimeError(f'expected one ambiguous preview anchor block, found {text.count(preview_old)}')
text = text.replace(preview_old, preview_new, 1)

role_old = '''editor = replace_once(editor, "      name: nextTextName(),\\n      text:", "      name: nextTextName(),\\n      ...(isMemorial ? { role: 'custom' } : {}),\\n      text:", 'custom Memorial text role')
'''
role_new = '''editor = replace_once(
    editor,
    "  const addTextLayer = () => {\\n    if (!usesLayerLab || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;\\n    const layer = {\\n      id: v2LayerId('text'),\\n      name: nextTextName(),\\n      text:",
    "  const addTextLayer = () => {\\n    if (!usesLayerLab || bootlegTextLayers.length >= BOOTLEG_MAX_TEXT_LAYERS) return;\\n    const layer = {\\n      id: v2LayerId('text'),\\n      name: nextTextName(),\\n      ...(isMemorial ? { role: 'custom' } : {}),\\n      text:",
    'custom Memorial text role',
)
'''
if text.count(role_old) != 1:
    raise RuntimeError(f'expected one ambiguous custom-text role block, found {text.count(role_old)}')
text = text.replace(role_old, role_new, 1)

path.write_text(text)
print('Narrowed preview and Memorial custom-text patch anchors.')
