from pathlib import Path

PAGE = Path('src/pages/CustomStudioV2.jsx')
STATE = Path('src/lib/customStudioV2State.js')
VERIFY = Path('scripts/verify-custom-studio-v2-approval-refinement.mjs')

page = PAGE.read_text()
state = STATE.read_text()
verify = VERIFY.read_text()

old_toggle = """  const toggleCurrentConfirmation = () => {\n    if (!currentHasContent) return;\n    if (state.designPath === 'seasonal') dispatch({ type: 'CONFIRM_SEASONAL', side: state.side, value: !currentConfirmed });\n    else dispatch({ type: 'CONFIRM_EDITOR', path: state.designPath, side: state.side, value: !currentConfirmed });\n  };"""
new_toggle = """  const toggleCurrentConfirmation = () => {\n    if (!currentHasContent) return;\n    dispatch({ type: 'CONFIRM_AND_APPROVE_SIDE', path: state.designPath, side: state.side, value: !currentConfirmed });\n  };"""
if old_toggle not in page:
    raise SystemExit('Expected Step 3 confirmation handler was not found; refusing unsafe patch.')
page = page.replace(old_toggle, new_toggle, 1)

old_button = """<span className=\"block text-sm font-black\">I’m done customizing this {state.side} design</span><span className=\"mt-0.5 block text-xs font-medium opacity-70\">Confirm this side’s artwork, text, layers and placement. If you also designed the other side, finish that side too.</span>"""
new_button = """<span className=\"block text-sm font-black\">I’m done customizing this {state.side} design &amp; I approve the final print layout</span><span className=\"mt-0.5 block text-xs font-medium opacity-70\">Confirm this side’s artwork, text, layers and placement. If both sides are designed, final approval completes after every designed side is confirmed.</span>"""
if old_button not in page:
    raise SystemExit('Expected Step 3 side-confirmation copy was not found; refusing unsafe patch.')
page = page.replace(old_button, new_button, 1)

old_hint = """    {!sidesConfirmed && sides.length > 0 && <p className=\"mt-3 text-xs font-bold text-amber-700\">Finish every designed print side before final layout approval becomes available.</p>}"""
new_hint = """    {!sidesConfirmed && sides.length > 1 && <p className=\"mt-3 text-xs font-bold text-amber-700\">Finish every designed print side to complete final layout approval.</p>}"""
if old_hint not in page:
    raise SystemExit('Expected multi-side approval hint was not found; refusing unsafe patch.')
page = page.replace(old_hint, new_hint, 1)

old_final = """        <button type=\"button\" disabled={!sidesConfirmed} onClick={() => dispatch({ type: 'SET_APPROVAL', patch: { finalDesignApproved: !state.approval.finalDesignApproved } })} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${state.approval.finalDesignApproved ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${state.approval.finalDesignApproved ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{state.approval.finalDesignApproved ? <Check size={18} /> : null}</span><span><span className=\"block text-sm font-black text-slate-900\">I approve the final print layout</span><span className=\"mt-1 block text-xs font-medium text-slate-500\">Your approved layout will be used to prepare the production artwork.</span></span></button>\n"""
if old_final not in page:
    raise SystemExit('Expected standalone final-layout approval button was not found; refusing unsafe patch.')
page = page.replace(old_final, '', 1)

marker = """    case 'CONFIRM_EDITOR': {\n      const path = action.path;\n      const side = validSide(action.side ?? state.side);\n      if (!['bootleg', 'memorial', 'upload'].includes(path)) return state;\n      return invalidateApproval({\n        ...state,\n        [path]: {\n          ...state[path],\n          sides: {\n            ...state[path].sides,\n            [side]: { ...state[path].sides[side], confirmed: Boolean(action.value) },\n          },\n        },\n      });\n    }\n"""
addition = marker + """    case 'CONFIRM_AND_APPROVE_SIDE': {\n      const path = action.path || state.designPath;\n      const side = validSide(action.side ?? state.side);\n      if (!['seasonal', 'bootleg', 'memorial', 'upload'].includes(path)) return state;\n      const nextConfirmed = Boolean(action.value);\n      const nextState = {\n        ...state,\n        [path]: {\n          ...state[path],\n          sides: {\n            ...state[path].sides,\n            [side]: { ...state[path].sides[side], confirmed: nextConfirmed },\n          },\n        },\n      };\n      const designedSides = studioV2PrintableSides(nextState);\n      const allDesignedSidesConfirmed = Boolean(designedSides.length) && designedSides.every((candidate) => Boolean(nextState[path]?.sides?.[candidate]?.confirmed));\n      return {\n        ...nextState,\n        approval: { ...state.approval, finalDesignApproved: allDesignedSidesConfirmed },\n      };\n    }\n"""
if marker not in state:
    raise SystemExit('Expected reducer confirmation case was not found; refusing unsafe patch.')
state = state.replace(marker, addition, 1)

verify = verify.replace("[page.includes('I approve the final print layout'), 'canonical final-layout approval control must remain present'],", "[page.includes('I’m done customizing this {state.side} design &amp; I approve the final print layout'), 'merged side-completion and final-layout approval control must remain present'],")
verify = verify.replace("[page.includes('finalDesignApproved: !state.approval.finalDesignApproved'), 'canonical approval toggle must remain intact'],", "[page.includes(\"type: 'CONFIRM_AND_APPROVE_SIDE'\"), 'merged approval control must use the atomic confirmation action'],\n  [page.includes('I approve the final print layout</span>') === false, 'standalone final-layout approval button must remain removed'],\n  [fs.readFileSync('src/lib/customStudioV2State.js', 'utf8').includes(\"case 'CONFIRM_AND_APPROVE_SIDE'\"), 'atomic merged approval reducer action must remain present'],")

PAGE.write_text(page)
STATE.write_text(state)
VERIFY.write_text(verify)

print('Merged Custom Studio side completion and final layout approval safely.')
