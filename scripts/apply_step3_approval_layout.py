from pathlib import Path

p = Path('src/pages/CustomStudioV2.jsx')
s = p.read_text()

old_intro = "Keep the side-completion, timing and final approval together before moving to Final Review."
s = s.replace(old_intro, "Finish your design and approve the final print layout before moving to Final Review.", 1)

old_finish = '''    <button type="button" data-gdp-step3-finish-side="true" disabled={!currentHasContent} onClick={toggleCurrentConfirmation} aria-pressed={currentConfirmed} className={`mt-4 flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${currentConfirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'} disabled:cursor-not-allowed disabled:opacity-40`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${currentConfirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={18} strokeWidth={3} /></span><span><span className="block text-sm font-black">I’m done customizing this {state.side} design</span><span className="mt-0.5 block text-xs font-medium opacity-70">Confirm this side’s artwork, text, layers and placement. If you also designed the other side, finish that side too.</span></span></button>

    {!sidesConfirmed && sides.length > 0 && <p className="mt-3 text-xs font-bold text-amber-700">Finish every designed print side before final layout approval becomes available.</p>}

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <label className="rounded-3xl border border-slate-200 bg-white p-5"><span className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Needed by</span><input type="date" value={state.approval.needByDate} onChange={(event) => dispatch({ type: 'SET_APPROVAL', patch: { needByDate: event.target.value } })} className="mt-3 min-h-12 w-full rounded-xl border border-slate-200 px-3 text-base font-bold outline-none focus:border-slate-500 sm:text-sm" /><span className="mt-2 block text-xs font-medium text-slate-400">Optional. Production timing is confirmed during order processing.</span></label>
      <div className="space-y-3">
        {rightsRequired && <button type="button" disabled={!sidesConfirmed} onClick={() => dispatch({ type: 'SET_APPROVAL', patch: { rightsConfirmed: !state.approval.rightsConfirmed } })} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${state.approval.rightsConfirmed ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${state.approval.rightsConfirmed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{state.approval.rightsConfirmed ? <Check size={18} /> : null}</span><span><span className="block text-sm font-black text-slate-900">I have permission to use this artwork/photo</span><span className="mt-1 block text-xs font-medium text-slate-500">I own it or have authorization to print it.</span></span></button>}
        <button type="button" disabled={!sidesConfirmed} onClick={() => dispatch({ type: 'SET_APPROVAL', patch: { finalDesignApproved: !state.approval.finalDesignApproved } })} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${state.approval.finalDesignApproved ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${state.approval.finalDesignApproved ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{state.approval.finalDesignApproved ? <Check size={18} /> : null}</span><span><span className="block text-sm font-black text-slate-900">I approve the final print layout</span><span className="mt-1 block text-xs font-medium text-slate-500">Your approved layout will be used to prepare the production artwork.</span></span></button>
      </div>
    </div>'''

new_finish = '''    <div className="mt-4 grid grid-cols-2 gap-3">
      <button type="button" data-gdp-step3-finish-side="true" disabled={!currentHasContent} onClick={toggleCurrentConfirmation} aria-pressed={currentConfirmed} className={`flex min-h-[96px] w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition sm:p-4 ${currentConfirmed ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-900 hover:border-slate-500'} disabled:cursor-not-allowed disabled:opacity-40`}><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${currentConfirmed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 text-transparent'}`}><Check size={16} strokeWidth={3} /></span><span><span className="block text-xs font-black sm:text-sm">I’m done customizing this {state.side} design</span><span className="mt-1 block text-[11px] font-medium leading-4 opacity-70 sm:text-xs">Confirm this side’s artwork and placement.</span></span></button>
      <button type="button" disabled={!sidesConfirmed} onClick={() => dispatch({ type: 'SET_APPROVAL', patch: { finalDesignApproved: !state.approval.finalDesignApproved } })} aria-disabled={!sidesConfirmed} className={`flex min-h-[96px] w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition sm:p-4 ${state.approval.finalDesignApproved ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white'} ${sidesConfirmed ? 'hover:border-slate-500' : 'cursor-not-allowed'}`}><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${state.approval.finalDesignApproved ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white text-transparent'}`}><Check size={16} strokeWidth={3} /></span><span><span className="block text-xs font-black text-slate-900 sm:text-sm">I approve the final print layout</span><span className="mt-1 block text-[11px] font-medium leading-4 text-slate-600 sm:text-xs">Available after every designed side is finished.</span></span></button>
    </div>

    {!sidesConfirmed && sides.length > 0 && <p className="mt-3 text-xs font-bold text-amber-700">Finish every designed print side before final layout approval becomes available.</p>}

    {rightsRequired && <div className="mt-4"><button type="button" disabled={!sidesConfirmed} onClick={() => dispatch({ type: 'SET_APPROVAL', patch: { rightsConfirmed: !state.approval.rightsConfirmed } })} className={`flex min-h-[60px] w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${state.approval.rightsConfirmed ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${state.approval.rightsConfirmed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{state.approval.rightsConfirmed ? <Check size={18} /> : null}</span><span><span className="block text-sm font-black text-slate-900">I have permission to use this artwork/photo</span><span className="mt-1 block text-xs font-medium text-slate-500">I own it or have authorization to print it.</span></span></button></div>}'''

if old_finish not in s:
    raise SystemExit('Expected Step 3 approval block not found; refusing patch')
s = s.replace(old_finish, new_finish, 1)

old_review = '''        <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Needed by</div><div className="mt-1 text-sm font-black text-slate-900">{state.approval.needByDate || 'No date requested'}</div></div>
'''
if old_review not in s:
    raise SystemExit('Expected review Needed by card not found; refusing patch')
s = s.replace(old_review, '', 1)

p.write_text(s)
print('Applied Step 3 side-by-side approval layout and removed Needed By UI.')
