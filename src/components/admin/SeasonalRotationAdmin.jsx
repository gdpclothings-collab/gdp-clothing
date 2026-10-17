import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  DEFAULT_SEASONAL_WINDOWS, normalizeSeasonalRotation, resolveSeasonalFeature, isSeasonalMonthDay,
  SEASONAL_DATE_MODES, seasonalToday,
} from '@/lib/seasonalRotation';

const approvedArtwork = row => row.status === 'active' && row.studio_visible === true &&
  row.rights_status === 'confirmed' && (row.proof_approved || row.digital_approved) &&
  Boolean(row.production_path) && Boolean(row.source_sha256) && Boolean(row.preview_data_url);
const selectClass = 'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm';
const inputClass = 'min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm';

export default function SeasonalRotationAdmin({ rows = [] }) {
  const [draft, setDraft] = useState(() => normalizeSeasonalRotation());
  const [original, setOriginal] = useState(() => normalizeSeasonalRotation());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const categories = useMemo(() => [...new Set(rows.map(row => row.category).filter(Boolean))].sort(), [rows]);
  const eligible = useMemo(() => rows.filter(approvedArtwork), [rows]);
  const changed = JSON.stringify(draft) !== JSON.stringify(original);
  const currentFeature = useMemo(
    () => resolveSeasonalFeature(draft, eligible.map(row => ({
      id: row.id, title: row.title, category: row.category,
      preview: row.preview_data_url, requires_name: row.metadata?.customization_mode === 'name-or-monogram-frame',
    })), seasonalToday()),
    [draft, eligible],
  );

  useEffect(() => {
    let active = true;
    Promise.resolve(supabase.from('store_settings').select('custom_studio_settings').eq('id', 1).single())
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) throw failure;
        const settings = normalizeSeasonalRotation(data?.custom_studio_settings?.seasonalRotation);
        setDraft(settings);
        setOriginal(settings);
      }).catch(err => { if (active) setError(err.message || 'Could not load the seasonal schedule.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const patch = values => { setDraft(current => ({ ...current, ...values })); setNotice(''); };
  const patchWindow = (id, values) => {
    setDraft(current => ({ ...current, windows: current.windows.map(window =>
      window.id === id ? { ...window, ...values } : window) }));
    setNotice('');
  };
  const save = async () => {
    setError('');
    setNotice('');
    if (draft.windows.some(window => window.mode === 'fixed' &&
      (!isSeasonalMonthDay(window.start) || !isSeasonalMonthDay(window.end)))) {
      setError('Use MM-DD for custom schedule start and end dates.'); return;
    }
    setSaving(true);
    try {
      // Preserve the other Custom Studio settings; never replace them with only the rotation keys.
      const { data, error: readError } = await supabase.from('store_settings')
        .select('custom_studio_settings').eq('id', 1).single();
      if (readError) throw readError;
      const normalized = normalizeSeasonalRotation(draft);
      const { data: saved, error: updateError } = await supabase.from('store_settings')
        .update({ custom_studio_settings: { ...(data?.custom_studio_settings || {}), seasonalRotation: normalized } })
        .eq('id', 1).select('id').single();
      if (updateError) throw updateError;
      if (!saved) throw new Error('No store settings were updated. Check administrator access.');
      setDraft(normalized);
      setOriginal(normalized);
      setNotice('Seasonal rotation saved. New Studio visits will use the new schedule.');
    } catch (err) {
      setError(err.message || 'Could not save seasonal automation.');
    } finally { setSaving(false); }
  };

  return (
    <section data-gdp-seasonal-automation="true" className="mb-7 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Seasonal Artwork Automation</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Automatically feature the upcoming occasion in Custom Studio. Collection artwork stays available year-round; existing customer designs are never changed. Dates use Saskatoon time (America/Regina).</p>
        </div>
        <button type="button" onClick={save} disabled={loading || saving || !changed}
          className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-40">
          {saving ? 'Saving…' : 'Save automation'}
        </button>
      </div>
      {loading ? <p role="status" className="mt-4 text-sm">Loading schedule…</p> : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold">
              <input type="checkbox" checked={draft.enabled} onChange={event => patch({ enabled: event.target.checked })} /> Enable automatic seasonal features
            </label>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold">
              <input type="checkbox" checked={draft.manual} onChange={event => patch({ manual: event.target.checked })} /> Use manual override
            </label>
          </div>
          {draft.manual && (
            <div className="mt-3 grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-2">
              <label className="text-xs font-bold">Featured collection
                <select value={draft.manualCategory} onChange={event => patch({ manualCategory: event.target.value, manualArtworkId: '' })} className={selectClass}>
                  <option value="">Choose a collection</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold">Featured artwork
                <select className={selectClass} value={draft.manualArtworkId} onChange={event => patch({ manualArtworkId: event.target.value })}>
                  <option value="">First approved artwork</option>
                  {eligible.filter(row => row.category === draft.manualCategory).map(row => <option value={row.id} key={row.id}>{row.title}</option>)}
                </select>
              </label>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3">
            {currentFeature ? <><img src={currentFeature.artwork.preview} alt="Featured design" className="h-16 w-16 rounded-lg bg-slate-50 object-contain" />
              <div className="text-sm"><strong>Currently featured: {currentFeature.category}</strong><div className="text-slate-600">{currentFeature.artwork.title} · {currentFeature.source === 'manual' ? 'Manual override' : 'Scheduled rotation'}</div></div></> :
              <p className="text-sm text-slate-600">No eligible featured design for today. The storefront will show its regular Seasonal Designs preview until a matching design is published and scheduled.</p>}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold">Recurring promotional windows</h3>
            <button type="button" className="min-h-10 rounded-lg border bg-white px-3 text-xs font-bold"
              onClick={() => setDraft(current => ({ ...current, windows: [...current.windows, {
                id: `custom-${Date.now()}`, category: categories[0] || 'New collection',
                mode: 'fixed', start: '11-01', end: '12-26', enabled: true,
                priority: 50, featuredArtworkId: '',
              }] }))}>+ Add schedule</button>
          </div>
          <p className="mt-1 text-xs text-slate-500">The highest-priority active collection with approved artwork is featured. Dynamic holidays automatically shift with each calendar year. Custom dates repeat every year.</p>
          <div className="mt-3 grid gap-2">
            {draft.windows.map(window => (
              <details key={window.id} className="rounded-xl border bg-white">
                <summary className="cursor-pointer px-3 py-3 text-sm font-semibold">
                  {window.category} · {window.mode === 'fixed' ? `${window.start} → ${window.end}` : 'Moving holiday · one month before'} · Priority {window.priority} {window.enabled ? '' : '· Off'}
                </summary>
                <div className="grid gap-3 border-t px-3 py-4 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="text-xs font-bold">Collection
                    <select className={selectClass} value={window.category} onChange={event => patchWindow(window.id, { category: event.target.value, featuredArtworkId: '' })}>
                      {!categories.includes(window.category) && <option value={window.category}>{window.category}</option>}
                      {categories.map(category => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold">Schedule type
                    <select className={selectClass} value={window.mode} onChange={event => patchWindow(window.id, { mode: event.target.value })}>
                      {SEASONAL_DATE_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold">Featured artwork
                    <select className={selectClass} value={window.featuredArtworkId} onChange={event => patchWindow(window.id, { featuredArtworkId: event.target.value })}>
                      <option value="">First approved design in collection</option>
                      {eligible.filter(row => row.category === window.category).map(row => <option value={row.id} key={row.id}>{row.title}</option>)}
                    </select>
                  </label>
                  {window.mode === 'fixed' && <>
                    <label className="text-xs font-bold">Start (MM-DD)
                      <input className={inputClass} value={window.start} maxLength={5} onChange={event => patchWindow(window.id, { start: event.target.value })} placeholder="11-01" />
                    </label>
                    <label className="text-xs font-bold">End (MM-DD)
                      <input className={inputClass} value={window.end} maxLength={5} onChange={event => patchWindow(window.id, { end: event.target.value })} placeholder="12-26" />
                    </label>
                  </>}
                  <label className="text-xs font-bold">Priority (0–1000)
                    <input type="number" min="0" max="1000" className={inputClass} value={window.priority} onChange={event => patchWindow(window.id, { priority: Number(event.target.value || 0) })} />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-3">
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={window.enabled} onChange={event => patchWindow(window.id, { enabled: event.target.checked })} /> Include in rotation</label>
                    <button type="button" className="min-h-10 rounded-lg border px-3 text-xs font-semibold text-red-700" onClick={() => setDraft(current => ({
                      ...current, windows: current.windows.filter(item => item.id !== window.id),
                    }))}>Remove window</button>
                  </div>
                </div>
              </details>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={() => setDraft(normalizeSeasonalRotation(original))} className="min-h-10 rounded-lg border bg-white px-3 text-xs font-semibold">Discard unsaved edits</button>
            <button type="button" disabled={saving} onClick={() => patch({ ...normalizeSeasonalRotation({ windows: DEFAULT_SEASONAL_WINDOWS }) })} className="min-h-10 rounded-lg border bg-white px-3 text-xs font-semibold">Load recommended schedule (not saved)</button>
          </div>
        </>
      )}
      {changed && !loading && <p className="mt-3 text-xs font-bold text-amber-700">Unsaved automation changes</p>}
      {notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}
