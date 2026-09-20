from pathlib import Path

path = Path('scripts/apply_memorial_v2_layer_parity.py')
text = path.read_text()
old = '''editor = replace_once(
    editor,
    "  const isBootleg = path === 'bootleg';\\n",
    "  const isBootleg = path === 'bootleg';\\n  const isMemorial = path === 'memorial';\\n  const usesLayerLab = isBootleg || isMemorial;\\n",
    'preview layer lab flags',
)
'''
new = '''editor = replace_once(
    editor,
    "function ProtectedPreview({ product, color, size, template, editor, path, stickers, side, onPatch, activeLayer = 'photo', onActiveLayerChange }) {\\n  const zoneRef = useRef(null);\\n  const canvasRef = useRef(null);\\n  const isBootleg = path === 'bootleg';\\n",
    "function ProtectedPreview({ product, color, size, template, editor, path, stickers, side, onPatch, activeLayer = 'photo', onActiveLayerChange }) {\\n  const zoneRef = useRef(null);\\n  const canvasRef = useRef(null);\\n  const isBootleg = path === 'bootleg';\\n  const isMemorial = path === 'memorial';\\n  const usesLayerLab = isBootleg || isMemorial;\\n",
    'preview layer lab flags',
)
'''
if text.count(old) != 1:
    raise RuntimeError(f'expected one ambiguous preview anchor block, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Narrowed preview layer-lab patch anchor.')
