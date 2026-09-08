import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { SEASONAL_BUCKET } from '@/lib/seasonalArtwork';

export default function SeasonalProductionDetails({ design }) {
  const [error,setError]=useState('');
  const s=design?.seasonal_configuration;
  if(!s)return null;
  const download=async()=>{
    setError('');
    try {
      const {data,error:failure}=await supabase.storage.from(SEASONAL_BUCKET).createSignedUrl(s.production_path,60,{download:true});
      if(failure)throw failure;
      window.open(data.signedUrl,'_blank','noopener,noreferrer');
    }catch(failure){setError(failure.message||'Could not open the production file.');}
  };
  return <section className="border rounded p-4 my-3 text-sm"><h3 className="font-bold">Seasonal production details</h3>
    <img src={s.preview} alt={s.title} className="w-40 h-40 object-contain bg-gray-200 mt-2"/>
    <p>{s.title} · {s.category} · Front print</p>
    <p>Artwork: {Number(s.width).toFixed(2)} × {Number(s.height).toFixed(2)} in</p>
    <p>Offset from print-area top left: {Number(s.x).toFixed(2)} in across, {Number(s.y).toFixed(2)} in down</p>
    <p>Print area: {s.area_width} × {s.area_height} in. Crop master to ink bounds: {(s.ink_bbox_px||[]).join(', ')} px.</p>
    {(s.name||s.message)&&<p>Name: “{s.name}” ({s.name_placement==='frame-centre'?'centred in frame':'beneath artwork'}). Message below: “{s.message}” · {s.text_font} · {s.text_color}. Reserve the bottom 0.8 in for text and approve a final proof.</p>}
    <p className="break-all text-xs">Source SHA-256: {s.source_sha256}</p>
    <button type="button" onClick={download} className="underline mt-2">Download this order’s production master</button>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
