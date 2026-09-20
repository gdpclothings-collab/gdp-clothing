from pathlib import Path

PAGE = Path('src/pages/CustomStudioV2.jsx')
STATE = Path('src/lib/customStudioV2State.js')
VERIFY = Path('scripts/verify-custom-studio-v2.mjs')

page = PAGE.read_text()
state = STATE.read_text()
verify = VERIFY.read_text()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

page = replace_once(
    page,
    "import { normalizeStyleTemplates } from '@/lib/customStudioStyleTemplates';\n",
    "import { normalizeStyleTemplates } from '@/lib/customStudioStyleTemplates';\nimport { isProductColorAvailable, isProductVariantAvailable } from '@/lib/productVariants';\n",
    'product variant availability import',
)

page = replace_once(
    page,
    """function GarmentVariantControls({ product, state, dispatch, onContinue, canContinue }) {\n  const colors = productColors(product);\n  const sizes = productSizes(product, state.color);\n  const sizeRequired = !String(state.size || '').trim();\n""",
    """function GarmentVariantControls({ product, state, dispatch, onContinue, canContinue }) {\n  const colors = productColors(product);\n  const sizes = productSizes(product, state.color);\n  const selectedColorAvailable = !state.color || isProductColorAvailable(product, state.color);\n  const sizeRequired = !String(state.size || '').trim();\n\n  useEffect(() => {\n    if (state.color && !selectedColorAvailable) {\n      dispatch({ type: 'SET_COLOR', color: '', size: '' });\n    }\n  }, [dispatch, selectedColorAvailable, state.color]);\n""",
    'GarmentVariantControls availability setup',
)

old_color = """          <div className=\"flex flex-wrap gap-2\">{colors.map((color) => {\n            const selected = state.color === color;\n            return <button data-gdp-garment-swatch=\"true\" key={color} type=\"button\" onClick={() => { const nextSizes = productSizes(product, color); const preservedSize = nextSizes.some((candidate) => normalize(candidate) === normalize(state.size)) ? state.size : ''; dispatch({ type: 'SET_COLOR', color, size: preservedSize }); }} aria-label={`Select ${displayVariantLabel(color)}`} aria-pressed={selected} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 text-sm font-bold transition ${selected ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}><span className=\"h-5 w-5 shrink-0 rounded-full border border-slate-300 shadow-inner\" style={{ backgroundColor: garmentColorSwatch(product, color) }} aria-hidden=\"true\" /><span>{displayVariantLabel(color)}</span></button>;\n          })}</div>\n"""

new_color = """          <div className=\"flex flex-wrap gap-2\">{colors.map((color) => {\n            const available = isProductColorAvailable(product, color);\n            const selected = available && state.color === color;\n            const label = displayVariantLabel(color);\n            return <button\n              data-gdp-garment-swatch=\"true\"\n              data-gdp-color-available={available ? 'true' : 'false'}\n              key={color}\n              type=\"button\"\n              disabled={!available}\n              onClick={() => {\n                if (!available) return;\n                const nextSizes = productSizes(product, color);\n                const preservedSize = nextSizes.some((candidate) => normalize(candidate) === normalize(state.size)) ? state.size : '';\n                dispatch({ type: 'SET_COLOR', color, size: preservedSize });\n              }}\n              aria-label={available ? `Select ${label}` : `${label}, unavailable`}\n              aria-pressed={selected}\n              title={available ? label : `${label} — Unavailable`}\n              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 text-sm font-bold transition ${selected ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : available ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-400' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70'}`}\n            >\n              <span className=\"relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-slate-300 shadow-inner\" style={{ backgroundColor: garmentColorSwatch(product, color) }} aria-hidden=\"true\">\n                {!available && <span className=\"absolute left-1/2 top-[-3px] h-7 w-px -translate-x-1/2 rotate-45 bg-slate-600\" />}\n              </span>\n              <span className=\"text-left leading-tight\"><span className=\"block\">{label}</span>{!available && <span className=\"mt-0.5 block text-[8px] font-black uppercase tracking-[.08em]\">Unavailable</span>}</span>\n            </button>;\n          })}</div>\n"""
page = replace_once(page, old_color, new_color, 'V2 color swatch block')

old_sizes = """          <div className=\"flex flex-wrap gap-2\">{sizes.map((size) => <button key={size} type=\"button\" onClick={() => dispatch({ type: 'SET_SIZE', size })} className={`min-h-11 min-w-12 rounded-xl border-2 px-3 text-sm font-bold transition ${state.size === size ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>{size}</button>)}</div>\n"""
new_sizes = """          <div className=\"flex flex-wrap gap-2\">{sizes.map((size) => {\n            const sizeVariant = variantFor(product, state.color, size);\n            const available = isProductVariantAvailable(product, sizeVariant);\n            return <button key={size} type=\"button\" disabled={!available} onClick={() => available && dispatch({ type: 'SET_SIZE', size })} title={!available ? `${size} — Unavailable` : size} className={`min-h-11 min-w-12 rounded-xl border-2 px-3 text-sm font-bold transition ${state.size === size && available ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : available ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-400' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through opacity-70'}`}>{size}</button>;\n          })}</div>\n"""
page = replace_once(page, old_sizes, new_sizes, 'V2 size availability block')

page = replace_once(
    page,
    """  const chooseProduct = (item) => {\n    dispatch({ type: 'SELECT_PRODUCT', productId: item.id, color: productColors(item)[0] || '' });\n    setIsChoosingGarment(false);\n  };\n""",
    """  const chooseProduct = (item) => {\n    const firstAvailableColor = productColors(item).find((candidate) => isProductColorAvailable(item, candidate)) || '';\n    dispatch({ type: 'SELECT_PRODUCT', productId: item.id, color: firstAvailableColor });\n    setIsChoosingGarment(false);\n  };\n""",
    'V2 garment default color selection',
)

page = replace_once(
    page,
    """  const product = useMemo(() => catalog.find((item) => String(item.id) === String(state.productId)) || null, [catalog, state.productId]);\n  const canContinue = studioV2CanContinue(state);\n""",
    """  const product = useMemo(() => catalog.find((item) => String(item.id) === String(state.productId)) || null, [catalog, state.productId]);\n  const baseCanContinue = studioV2CanContinue(state);\n  const selectedGarmentVariant = state.step === 'garment' && product ? variantFor(product, state.color, state.size) : null;\n  const canContinue = state.step === 'garment'\n    ? Boolean(baseCanContinue && isProductColorAvailable(product, state.color) && isProductVariantAvailable(product, selectedGarmentVariant))\n    : baseCanContinue;\n""",
    'V2 garment continue availability guard',
)

state = replace_once(
    state,
    """export function productColors(product) {\n  const variants = (product?.variants || []).filter((variant) => variant?.active !== false);\n  const values = variants.length ? variants.map((variant) => variant.color) : (product?.colors || []);\n  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];\n}\n""",
    """export function productColors(product) {\n  const variants = (product?.variants || []).filter((variant) => variant?.active !== false);\n  const values = [...(product?.colors || []), ...variants.map((variant) => variant.color)];\n  return [...new Map(values.map((value) => String(value || '').trim()).filter(Boolean).map((value) => [value.toLowerCase(), value])).values()];\n}\n""",
    'V2 configured color union',
)

verify_anchor = """assert(page.includes('data-gdp-garment-continue=\"true\"'), 'Step 1 Continue must live inside the selected garment configurator');\n"""
verify_insert = verify_anchor + """assert(page.includes(\"data-gdp-color-available={available ? 'true' : 'false'}\"), 'V2 color swatches must expose availability state');\nassert(page.includes('disabled={!available}'), 'V2 unavailable color swatches must be disabled');\nassert(page.includes('Unavailable</span>'), 'V2 unavailable color swatches must show an Unavailable label');\nassert(page.includes('isProductColorAvailable(product, color)'), 'V2 color availability must use shared inventory-aware logic');\nassert(state.includes(\"...(product?.colors || [])\"), 'V2 must retain configured colors so unavailable swatches remain visible');\n"""
verify = replace_once(verify, verify_anchor, verify_insert, 'V2 unavailable color regression assertions')

PAGE.write_text(page)
STATE.write_text(state)
VERIFY.write_text(verify)
print('Applied Custom Studio V2 unavailable color swatch repair.')
