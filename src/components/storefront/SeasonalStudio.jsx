import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { customerApi } from '@/lib/customerApi';
import { useCart } from '@/lib/CartContext';
import { fitSeasonalArtwork, seasonalSelection } from '@/lib/seasonalArtwork';

export function SeasonalOverlay({ artwork, layout, area, text }) {
  if (!artwork || !layout) return null;
  return <>
    <img src={artwork.preview} alt={artwork.title} draggable="false" className="absolute object-fill pointer-events-none" style={{ left: `${layout.x / area.width * 100}%`, top: `${layout.y / area.height * 100}%`, width: `${layout.width / area.width * 100}%`, height: `${layout.height / area.height * 100}%` }} />
    {artwork.requires_name && text.name && <svg className="absolute pointer-events-none" style={{left:`${layout.x/area.width*100}%`,top:`${layout.y/area.height*100}%`,width:`${layout.width/area.width*100}%`,height:`${layout.height/area.height*100}%`}} viewBox="0 0 600 600" aria-label={text.name} role="img"><text x="300" y="310" textAnchor="middle" fontFamily="Arial" fontSize={Math.min(42,650/Math.max(1,text.name.length))} fill={text.color}>{text.name}</text></svg>}
    {artwork.customizable && (text.name || text.message) && <svg className="absolute bottom-0 left-0 w-full pointer-events-none" style={{height: `${.8 / area.height * 100}%`}} viewBox="0 0 600 80" role="img" aria-label={[text.name, text.message].filter(Boolean).join(' — ')}>
      <text x="300" y="30" textAnchor="middle" fontFamily="Arial" fontSize={Math.min(26, 800 / Math.max(1, text.name.length))} fill={text.color}>{artwork.requires_name?'':text.name}</text>
      <text x="300" y="65" textAnchor="middle" fontFamily="Arial" fontSize={Math.min(20, 850 / Math.max(1, text.message.length))} fill={text.color}>{text.message}</text>
    </svg>}
  </>;
}

export default function SeasonalStudio({ product, garment, color, size, variant, quantity, unitPrice, Preview, onBack }) {
  const [catalog, setCatalog] = useState(null), [error, setError] = useState(''), [selected, setSelected] = useState(null);
  const [category, setCategory] = useState(''), [query, setQuery] = useState('');
  const [requested, setRequested] = useState(0), [position, setPosition] = useState({x:0,y:0});
  const [text, setText] = useState({name:'',message:'',color:'#111111'});
  const [approved, setApproved] = useState(false), [saving, setSaving] = useState(false);
  const navigate = useNavigate(), { addItem } = useCart();
  useEffect(() => {
    window.scrollTo({top:0,behavior:'instant'});
    let active = true;
    Promise.resolve(supabase.rpc('list_seasonal_artworks', {p_product:product.id,p_size:size})).then(({data,error:failure}) => {
      if (!active) return;
      if (failure) setError('Seasonal designs could not load. Try again or use the photo design option.');
      else setCatalog(data);
    }).catch(() => { if (active) setError('Could not connect to the design library.'); });
    return () => {active=false;};
  }, [product.id,size]);
  const artworks = catalog?.artworks || [], area = catalog?.area;
  const hasText = selected?.customizable && Boolean(text.name.trim() || text.message.trim());
  const usableArea = area ? {...area, height:Number(area.height) - (hasText ? .8 : 0)} : null;
  const layout = fitSeasonalArtwork(selected, usableArea, requested, position.x, position.y);
  const visible = artworks.filter(a => (!category || category === a.category) && [a.title,a.category,...a.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const choose = a => {const initial=fitSeasonalArtwork(a,area,0);setSelected(a);setRequested(0);setPosition({x:initial?(area.width-initial.width)/2:0,y:0});setText({name:'',message:'',color:color.toLowerCase().includes('black')?'#ffffff':'#111111'});setApproved(false);setError('');};
  const updateText = patch => {setText(t=>({...t,...patch}));setApproved(false);};
  const save = async () => {
    if (!selected || !layout || !approved || saving) return;
    setSaving(true);setError('');
    try {
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) {setError('Please sign in using Account in another tab, then return here to add your design. Your current selection will stay here.');return;}
      const configuration = seasonalSelection(selected,layout,text,area);
      const design = await customerApi.createCustomDesign({productId:product.id,productName:product.name,name:selected.title,
        designStyle:`Seasonal: ${selected.title}`,occasion:selected.category,designMood:'Original artwork',designIntensity:1,
        color,size,placement:'front',photoAssets:[],personalization:{name:configuration.name,message:configuration.message},
        seasonalArtworkId:selected.id,seasonalConfiguration:configuration,
        customerConfirmedRights:true,approvalPolicyAcknowledged:approved,proofRequired:true,status:'in_cart',priority:'standard'});
      addItem({productId:product.id,name:product.name,image:product.images?.[0]||'',isCustom:true,customDesignId:design.id,
        variantId:variant?.id||null,variant:variant?.name||garment.label,color,size,quantity,price:unitPrice,
        fulfillmentMode:product.fulfillmentMode||'in_house',designStyle:`Seasonal: ${selected.title}`,occasion:selected.category,proofRequired:true});
      navigate('/cart');
    } catch (e) {setError(e.message || 'Could not save this design. Please try again.');}
    finally {setSaving(false);}
  };
  const previewConfig = area ? {...product.customization?.preview, printGuide:{...product.customization?.preview?.printGuide,front:{...product.customization?.preview?.printGuide?.front,widthIn:Number(area.width),heightIn:Number(area.height),maxWidthIn:Number(area.width),maxHeightIn:Number(area.height),sizeScalingEnabled:false}}} : product.customization?.preview;
  return <main className="max-w-7xl mx-auto px-4 py-8">
    <button type="button" onClick={onBack} className="underline mb-5">← Change garment or design option</button>
    <h1 className="text-3xl font-bold">Seasonal design studio</h1>
    <p className="mt-2 mb-6">{garment.label} · {color} · {size} · Quantity {quantity}</p>
    {error && <p role="alert" className="p-4 mb-4 bg-red-50 text-red-800 rounded">{error}</p>}
    {!catalog && !error && <p role="status">Loading seasonal designs…</p>}
    {catalog && artworks.length===0 && <div className="p-6 rounded border"><h2 className="font-semibold">Seasonal designs are being prepared</h2><p className="mt-2">New designs will appear here once approved for printing. You can continue with a photo design today.</p><button onClick={onBack} className="underline mt-4">Choose another design option</button></div>}
    {artworks.length>0 && <div className="grid lg:grid-cols-2 gap-8">
      <section aria-label="Choose seasonal artwork">
        <div className="flex flex-wrap gap-3 mb-4"><label>Season or holiday<select value={category} onChange={e=>setCategory(e.target.value)} className="block border rounded p-2"><option value="">All collections</option>{[...new Set(artworks.map(a=>a.category))].sort().map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Search designs<input type="search" value={query} onChange={e=>setQuery(e.target.value)} className="block border rounded p-2" /></label></div>
        <p role="status" className="mb-3">{visible.length} designs</p>
        {!visible.length && <p>No designs match. Try another collection or search.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[700px] overflow-auto">{visible.map(a=><button type="button" key={a.id} aria-pressed={selected?.id===a.id} onClick={()=>choose(a)} className={`rounded border p-2 text-left ${selected?.id===a.id?'border-black ring-2 ring-black':''}`}><img src={a.preview} alt={a.title} loading="lazy" className="h-36 w-full object-contain bg-gray-200"/><span className="block mt-2 text-sm font-semibold">{a.title}</span><span className="text-xs">{a.category}</span></button>)}</div>
      </section>
      <section aria-label="Garment preview and personalization">
        <div className="rounded-xl overflow-hidden border"><Preview garment={garment} color={color} side="front" placement="front" size={size} previewConfig={previewConfig||{}} zoom={1} artworkScale={100} artworkRotation={0} artworkOffset={{x:0,y:0}} showGuides showMeasurements seasonalOverlay={<SeasonalOverlay artwork={selected} layout={layout} area={area} text={text}/>}/></div>
        {selected && layout && <div className="mt-4 space-y-4">
          <h2 className="font-bold text-xl">{selected.title}</h2>
          <label className="block">Artwork width: {layout.width.toFixed(2)} in · height: {layout.height.toFixed(2)} in<input aria-label="Artwork width" type="range" min={Math.min(.5,layout.maxWidth)} max={layout.maxWidth} step="0.01" value={layout.width} onChange={e=>{setRequested(Number(e.target.value));setApproved(false);}} className="w-full"/></label>
          <label className="block">Horizontal position<input aria-label="Horizontal position" type="range" min="0" max={Math.max(0,area.width-layout.width)} step="0.01" value={layout.x} onChange={e=>{setPosition(p=>({...p,x:Number(e.target.value)}));setApproved(false);}} className="w-full"/></label>
          <label className="block">Vertical position<input aria-label="Vertical position" type="range" min="0" max={Math.max(0,usableArea.height-layout.height)} step="0.01" value={layout.y} onChange={e=>{setPosition(p=>({...p,y:Number(e.target.value)}));setApproved(false);}} className="w-full"/></label>
          <button type="button" className="underline text-sm" onClick={()=>{setPosition({x:(area.width-layout.width)/2,y:0});setApproved(false);}}>Centre artwork</button>
          {selected.customizable && <fieldset className="border rounded p-4 space-y-3"><legend>Personalization</legend><label className="block">Name {selected.requires_name?'(required)':'(optional)'}<input value={text.name} maxLength={32} onChange={e=>updateText({name:e.target.value})} className="block border rounded p-2 w-full"/></label><label className="block">Short message<input value={text.message} maxLength={60} onChange={e=>updateText({message:e.target.value})} className="block border rounded p-2 w-full"/></label><label className="block">Text colour<select value={text.color} onChange={e=>updateText({color:e.target.value})} className="block border rounded p-2"><option value="#111111">Black</option><option value="#ffffff">White</option></select></label><p className="text-xs">Names appear in the centre of personalization frames; other added text appears beneath the artwork. Original lettering stays unchanged.</p></fieldset>}
          <p className="text-sm">Front print · {Number(unitPrice).toFixed(2)} CAD each · {(unitPrice*quantity).toFixed(2)} CAD total before shipping and tax. No additional seasonal-design fee.</p>
          <label className="flex items-start gap-2"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} className="mt-1"/><span>I have checked the garment, design, spelling and placement and have permission to use any text I added. I understand this preview is approximate and a production proof requires my approval.</span></label>
          <button disabled={!approved||saving||(selected.requires_name&&!text.name.trim())} onClick={save} className="bg-black text-white px-6 py-3 rounded disabled:opacity-40">{saving?'Saving design…':'Add to cart'}</button>
        </div>}
      </section>
    </div>}
  </main>;
}
