import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { inspectSeasonalPng, SEASONAL_BUCKET } from '@/lib/seasonalArtwork';

export default function SeasonalArtworkSettings({ row, onSaved }) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [draft,setDraft]=useState(row);
  const patch=p=>setDraft(d=>({...d,...p}));
  const upload=async file=>{
    if (!file) return;
    setBusy(true);setError('');
    try {
      const inspected=await inspectSeasonalPng(file);
      const path=`${row.id}/${crypto.randomUUID()}.png`;
      const {error:failure}=await supabase.storage.from(SEASONAL_BUCKET).upload(path,file,{contentType:'image/png',upsert:false});
      if (failure) throw failure;
      patch({production_path:path,preview_data_url:inspected.preview,source_sha256:inspected.sha,
        aspect_ratio:inspected.aspect_ratio,max_width_in:inspected.max_width_in,max_height_in:inspected.max_height_in,
        ink_bbox_px:inspected.ink_bbox_px,proof_approved:false,studio_visible:false,
        metadata:{...draft.metadata,production:{...draft.metadata?.production,vector_source:false,format:'PNG',canvas_px:inspected.canvas_px,
          ink_bbox_px:inspected.ink_bbox_px,max_ink_inches_at_300ppi:[inspected.max_width_in,inspected.max_height_in]},
          review_flags:[],production_review_status:'physical_proof_required'}});
    } catch(e){setError(e.message||'Upload failed.');}
    finally{setBusy(false);}
  };
  const save=async()=>{
    setBusy(true);setError('');
    try {
      const eligible=draft.rights_status==='confirmed' && draft.proof_approved && Boolean(draft.production_path) && Boolean(draft.source_sha256);
      if ((draft.studio_visible||draft.ready_print||draft.customizable)&&!eligible) throw new Error('Upload a production PNG and confirm commercial rights and the print proof before enabling these options.');
      if(draft.studio_visible&&!draft.ready_print&&!draft.customizable) throw new Error('Enable ready-print or personalization before showing this design.');
      if(draft.metadata?.customization_mode==='name-or-monogram-frame'&&draft.ready_print) throw new Error('A personalization frame must use personalization, not ready-print.');
      const values={status:eligible?'active':'draft',rights_status:draft.rights_status,proof_approved:draft.proof_approved||false,
        ready_print:!!draft.ready_print,customizable:!!draft.customizable,studio_visible:!!draft.studio_visible,
        production_path:draft.production_path,preview_data_url:draft.preview_data_url,source_sha256:draft.source_sha256,
        aspect_ratio:draft.aspect_ratio,max_width_in:draft.max_width_in,max_height_in:draft.max_height_in,ink_bbox_px:draft.ink_bbox_px,metadata:draft.metadata};
      const {data,error:failure}=await supabase.from('artwork_library').update(values).eq('id',row.id).select('*').single();
      if(failure)throw failure;
      setDraft(data);onSaved(data);setOpen(false);
    }catch(e){setError(e.message||'Could not save artwork settings.');}
    finally{setBusy(false);}
  };
  const download=async()=>{
    setBusy(true);setError('');
    try{const {data,error:failure}=await supabase.storage.from(SEASONAL_BUCKET).createSignedUrl(draft.production_path,60,{download:true});if(failure)throw failure;window.open(data.signedUrl,'_blank','noopener,noreferrer');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="mt-4 border-t pt-3">
    <p className="text-xs mb-2">Custom Studio: {row.studio_visible?'Published':'Hidden'}</p>
    <button type="button" onClick={()=>{setOpen(!open);setDraft(row);setError('');}} className="text-sm underline">{open?'Close settings':'Publishing settings'}</button>
    {open&&<div className="space-y-3 mt-3 text-sm">
      <p>Upload a transparent PNG master. Its visible artwork determines the 300 ppi print limit. Files stay private. Replacing the master requires a new print proof.</p>
      <label className="block">Production PNG<input type="file" accept="image/png" disabled={busy} onChange={e=>upload(e.target.files?.[0])} className="block w-full mt-1"/></label>
      {draft.source_sha256&&<p className="text-xs">Master ready · {Number(draft.max_width_in).toFixed(2)} × {Number(draft.max_height_in).toFixed(2)} in maximum at 300 ppi</p>}
      {draft.production_path&&<button type="button" disabled={busy} onClick={download} className="underline">Download private production file</button>}
      <label className="flex gap-2"><input type="checkbox" checked={draft.rights_status==='confirmed'} onChange={e=>patch({rights_status:e.target.checked?'confirmed':'unverified',...(!e.target.checked?{studio_visible:false,ready_print:false,customizable:false}:{})})}/>Commercial apparel, print-on-demand and online preview rights confirmed</label>
      <label className="flex gap-2"><input type="checkbox" checked={!!draft.proof_approved} onChange={e=>patch({proof_approved:e.target.checked,...(!e.target.checked?{studio_visible:false,ready_print:false,customizable:false}:{})})}/>Physical print proof approved for this master</label>
      <label className="flex gap-2"><input type="checkbox" checked={!!draft.ready_print} onChange={e=>patch({ready_print:e.target.checked})}/>Ready to print without added text</label>
      <label className="flex gap-2"><input type="checkbox" checked={!!draft.customizable} onChange={e=>patch({customizable:e.target.checked})}/>Allow name and message personalization</label>
      <label className="flex gap-2"><input type="checkbox" checked={!!draft.studio_visible} onChange={e=>patch({studio_visible:e.target.checked})}/>Show in Custom Studio</label>
      <button type="button" disabled={busy} onClick={save} className="bg-black text-white px-4 py-2 rounded disabled:opacity-40">{busy?'Working…':'Save settings'}</button>
    </div>}
    {error&&<p role="alert" className="mt-2 text-red-700 text-sm">{error}</p>}
  </div>;
}
