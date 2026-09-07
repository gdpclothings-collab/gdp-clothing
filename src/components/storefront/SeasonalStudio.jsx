import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Maximize2, Move, RotateCcw, RotateCw, Ruler, Search, Shirt, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { customerApi } from '@/lib/customerApi';
import { useCart } from '@/lib/CartContext';
import { fitSeasonalArtwork, seasonalSelection } from '@/lib/seasonalArtwork';

export function SeasonalOverlay({ artwork, layout, area, text, rotation = 0, editable = false, onMove, onResize, onRotate, onDelete }) {
  const action = useRef(null);
  if (!artwork || !layout) return null;
  const begin = (event, type) => {
    if (!editable) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const parent = event.currentTarget.closest('[data-seasonal-artwork]')?.parentElement;
    const rect = parent?.getBoundingClientRect();
    if (!rect) return;
    const box = event.currentTarget.closest('[data-seasonal-artwork]')?.getBoundingClientRect();
    action.current = { type, startX:event.clientX, startY:event.clientY, x:layout.x, y:layout.y, width:layout.width, rotation, rect,
      centerX:(box?.left||0)+(box?.width||0)/2, centerY:(box?.top||0)+(box?.height||0)/2,
      angle:Math.atan2(event.clientY-((box?.top||0)+(box?.height||0)/2),event.clientX-((box?.left||0)+(box?.width||0)/2))*180/Math.PI };
  };
  const move = (event) => {
    const start = action.current; if (!start) return;
    event.preventDefault();
    if (start.type === 'move') onMove?.({x:start.x+(event.clientX-start.startX)/start.rect.width*area.width,y:start.y+(event.clientY-start.startY)/start.rect.height*area.height});
    if (start.type === 'resize') onResize?.(start.width+(event.clientX-start.startX)/start.rect.width*area.width);
    if (start.type === 'rotate') {
      const angle=Math.atan2(event.clientY-start.centerY,event.clientX-start.centerX)*180/Math.PI;
      onRotate?.(((((start.rotation + angle - start.angle) + 180) % 360 + 360) % 360) - 180);
    }
  };
  const stop = () => { action.current = null; };
  return <div data-seasonal-artwork="true" onPointerDown={e=>{if(!(e.target instanceof Element) || !e.target.closest('[data-control]'))begin(e,'move');}} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
    className={"absolute touch-none select-none " + (editable?'cursor-move ring-2 ring-white shadow-[0_0_0_1px_rgba(23,50,77,.8)]':'pointer-events-none')}
    style={{left:`${layout.x/area.width*100}%`,top:`${layout.y/area.height*100}%`,width:`${layout.width/area.width*100}%`,height:`${layout.height/area.height*100}%`,transform:`rotate(${rotation}deg)`,transformOrigin:'center'}}>
    <img src={artwork.preview} alt={artwork.title} draggable="false" className="absolute inset-0 h-full w-full object-fill pointer-events-none" />
    {artwork.requires_name && text.name && <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 600 600" aria-label={text.name} role="img"><text x="300" y="310" textAnchor="middle" fontFamily="Arial" fontSize={Math.min(42,650/Math.max(1,text.name.length))} fill={text.color}>{text.name}</text></svg>}
    {artwork.customizable && (text.name || text.message) && <svg className="absolute bottom-0 left-0 w-full pointer-events-none" style={{height:'18%'}} viewBox="0 0 600 80" role="img" aria-label={[text.name, text.message].filter(Boolean).join(' — ')}>
      <text x="300" y="30" textAnchor="middle" fontFamily="Arial" fontSize={Math.min(26, 800 / Math.max(1, text.name.length))} fill={text.color}>{artwork.requires_name?'':text.name}</text>
      <text x="300" y="65" textAnchor="middle" fontFamily="Arial" fontSize={Math.min(20, 850 / Math.max(1, text.message.length))} fill={text.color}>{text.message}</text>
    </svg>}
    {editable && <>
      <button data-control type="button" onClick={e=>{e.stopPropagation();onDelete?.();}} className="absolute right-1 top-1 z-20 grid h-6 w-6 place-items-center rounded-full bg-[#17324D] text-white shadow-lg" aria-label="Remove artwork"><X size={13}/></button>
      <button data-control type="button" onPointerDown={e=>begin(e,'rotate')} className="absolute left-1 top-1 z-20 grid h-6 w-6 touch-none place-items-center rounded-full bg-white text-[#17324D] shadow-lg" aria-label="Rotate artwork"><RotateCw size={13}/></button>
      <button data-control type="button" onPointerDown={e=>begin(e,'resize')} className="absolute bottom-1 right-1 z-20 grid h-6 w-6 touch-none place-items-center rounded-full bg-white text-[#17324D] shadow-lg" aria-label="Resize artwork"><Maximize2 size={13}/></button>
    </>}
  </div>;
}

export default function SeasonalStudio({ product, garment, color, size, variant, quantity, unitPrice, Preview, onBack, catalog: garmentCatalog = [], availableColors = [], availableSizes = [], onProductChange, onColorChange, onSizeChange, colorSwatch, priceVisibility = 'hidden' }) {
  const [catalog, setCatalog] = useState(null), [error, setError] = useState(''), [selected, setSelected] = useState(null);
  const [category, setCategory] = useState(''), [query, setQuery] = useState('');
  const [requested, setRequested] = useState(0), [position, setPosition] = useState({x:0,y:0});
  const [rotation, setRotation] = useState(0), [showGarmentOptions, setShowGarmentOptions] = useState(false);
  const [showGuides, setShowGuides] = useState(true), [showMeasurements, setShowMeasurements] = useState(false);
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
  const choose = a => {const initial=fitSeasonalArtwork(a,area,0);setSelected(a);setRequested(0);setPosition({x:initial?(area.width-initial.width)/2:0,y:0});setRotation(0);setText({name:'',message:'',color:color.toLowerCase().includes('black')?'#ffffff':'#111111'});setApproved(false);setError('');};
  const updatePosition = next => { if (!layout || !usableArea) return; setPosition({x:Math.max(0,Math.min(next.x,area.width-layout.width)),y:Math.max(0,Math.min(next.y,usableArea.height-layout.height))});setApproved(false); };
  const resetArtwork = () => {const initial=fitSeasonalArtwork(selected,area,0);setRequested(0);setPosition({x:initial?(area.width-initial.width)/2:0,y:0});setRotation(0);setApproved(false);};
  const updateText = patch => {setText(t=>({...t,...patch}));setApproved(false);};
  const save = async () => {
    if (!selected || !layout || !approved || saving) return;
    setSaving(true);setError('');
    try {
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) {setError('Please sign in using Account in another tab, then return here to add your design. Your current selection will stay here.');return;}
      const configuration = seasonalSelection(selected,layout,text,area,rotation);
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
  return <main className="min-h-screen bg-[linear-gradient(180deg,#F4F7FA_0%,#EDF2F6_45%,#F8FAFC_100%)] px-4 py-6 lg:px-8 lg:py-9">
    <div className="mx-auto max-w-[1540px]">
    <header className="relative mb-6 overflow-hidden rounded-[28px] border border-[#DCE3EA] bg-[linear-gradient(135deg,#FFFFFF_0%,#F4EDE3_100%)] px-5 py-6 shadow-[0_20px_60px_rgba(32,28,22,.07)] md:px-8 md:py-8">
      <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><button type="button" onClick={onBack} className="mb-3 text-xs font-semibold text-[#667788] hover:text-[#17324D]">← Design options</button><p className="font-mono text-[10px] uppercase tracking-[.26em] text-[#A66331]">GDP Custom Studio</p><h1 className="mt-2 font-display text-4xl leading-none text-[#17324D] md:text-5xl">SEASONAL DESIGN LAB</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#66717C]">Choose a print, style it directly on the garment, then review every detail before checkout.</p></div>
        <div className="flex items-center gap-2 self-start rounded-full border border-[#DCE3EA] bg-white/80 px-4 py-2 text-xs font-semibold text-[#52616F] shadow-sm"><Check size={15} className="text-emerald-600"/> Designer reviewed before printing</div>
      </div>
    </header>
    <div className="mb-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#DCE3EA] bg-white/75 p-1 text-center text-[10px] font-bold uppercase tracking-wide text-[#7B8793] shadow-sm"><div className="rounded-xl bg-[#17324D] px-3 py-2.5 text-white">1 · Choose design</div><div className="px-3 py-2.5">2 · Customize</div><div className="px-3 py-2.5">3 · Review</div></div>
    {error && <p role="alert" className="p-4 mb-4 bg-red-50 text-red-800 rounded">{error}</p>}
    {!catalog && !error && <p role="status">Loading seasonal designs…</p>}
    {catalog && artworks.length===0 && <div className="p-6 rounded border"><h2 className="font-semibold">Seasonal designs are being prepared</h2><p className="mt-2">New designs will appear here once approved for printing. You can continue with a photo design today.</p><button onClick={onBack} className="underline mt-4">Choose another design option</button></div>}
    {artworks.length>0 && <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,0.78fr)_minmax(520px,1.3fr)_minmax(285px,0.72fr)]">
      <section aria-label="Choose seasonal artwork" className="rounded-3xl border border-[#DCE3EA] bg-white/85 p-4 shadow-[0_14px_40px_rgba(23,50,77,.07)] lg:p-5">
        <div className="mb-4"><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#A66331]">Artwork library</p><h2 className="mt-1 text-xl font-bold text-[#17324D]">Find your design</h2></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><label className="text-[10px] font-bold uppercase tracking-wide text-[#697784]">Season or holiday<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 block w-full rounded-xl border border-[#DCE3EA] bg-white p-2.5 text-sm font-normal normal-case"><option value="">All collections</option>{[...new Set(artworks.map(a=>a.category))].sort().map(c=><option key={c}>{c}</option>)}</select></label>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#697784]">Search designs<div className="relative mt-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A96A1]"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search artwork" className="block w-full rounded-xl border border-[#DCE3EA] bg-white py-2.5 pl-9 pr-3 text-sm font-normal normal-case" /></div></label></div>
        <p role="status" className="my-3 text-xs text-[#7B8793]">{visible.length} designs available</p>
        {!visible.length && <p>No designs match. Try another collection or search.</p>}
        <div className="grid max-h-[670px] grid-cols-2 gap-3 overflow-auto pr-1">{visible.map(a=><button type="button" key={a.id} aria-pressed={selected?.id===a.id} onClick={()=>choose(a)} className={`group rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected?.id===a.id?'border-[#17324D] bg-[#EEF3F7] ring-2 ring-[#17324D]/15':'border-[#E1E6EB] bg-white'}`}><div className="relative overflow-hidden rounded-xl bg-[linear-gradient(45deg,#f0ede8_25%,transparent_25%),linear-gradient(-45deg,#f0ede8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f0ede8_75%),linear-gradient(-45deg,transparent_75%,#f0ede8_75%)] bg-[length:14px_14px]"><img src={a.preview} alt={a.title} loading="lazy" className="h-28 w-full object-contain transition group-hover:scale-105"/>{selected?.id===a.id&&<span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#17324D] text-white"><Check size={13}/></span>}</div><span className="mt-2 block text-xs font-bold text-[#273B4E]">{a.title}</span><span className="text-[9px] uppercase tracking-wide text-[#84909B]">{a.category}</span></button>)}</div>
      </section>
      <section aria-label="Garment preview" className="xl:sticky xl:top-4">
        <div className="overflow-hidden rounded-3xl border border-[#CDD7E0] bg-white p-3 shadow-[0_24px_60px_rgba(23,50,77,.12)]"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#A66331]">Live garment preview</p><p className="mt-0.5 text-sm font-bold text-[#17324D]">{garment.label} · {color} · {size}</p></div><div className="flex gap-1.5"><button type="button" aria-pressed={showGuides} onClick={()=>setShowGuides(v=>!v)} className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-bold ${showGuides?'border-[#17324D] bg-[#17324D] text-white':'border-[#DCE3EA] text-[#607080]'}`}><Maximize2 size={13}/> Print area</button><button type="button" aria-pressed={showMeasurements} onClick={()=>setShowMeasurements(v=>!v)} className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[10px] font-bold ${showMeasurements?'border-[#A66331] bg-[#A66331] text-white':'border-[#DCE3EA] text-[#607080]'}`}><Ruler size={13}/> Measurements</button></div></div>
        <div className="overflow-hidden rounded-2xl border border-[#E1E6EA]"><Preview garment={garment} color={color} side="front" placement="front" size={size} previewConfig={previewConfig||{}} zoom={1} artworkScale={100} artworkRotation={0} artworkOffset={{x:0,y:0}} showGuides={showGuides} showMeasurements={showMeasurements} seasonalOverlay={<SeasonalOverlay artwork={selected} layout={layout} area={area} text={text} rotation={rotation} editable onMove={updatePosition} onResize={value=>{setRequested(value);setApproved(false);}} onRotate={value=>{setRotation(value);setApproved(false);}} onDelete={()=>{setSelected(null);setApproved(false);}}/>}/></div>
        <p className="px-2 pb-1 pt-3 text-center text-[10px] text-[#71808D]"><Move size={12} className="mr-1 inline"/>Drag artwork anywhere. Use its corner controls to rotate, resize, or remove it.</p></div>
      </section>
      <section aria-label="Garment and artwork controls" className="space-y-4">
        <div className="rounded-3xl border border-[#DCE3EA] bg-white/90 p-4 shadow-[0_14px_40px_rgba(23,50,77,.07)]">
          <button type="button" onClick={()=>setShowGarmentOptions(v=>!v)} className="flex w-full items-center justify-between text-left"><span><span className="font-mono text-[9px] uppercase tracking-[.18em] text-[#A66331]">Your blank</span><span className="mt-1 block text-sm font-bold text-[#17324D]">Change garment, color or size</span></span><ChevronDown size={18} className={`transition ${showGarmentOptions?'rotate-180':''}`}/></button>
          {showGarmentOptions&&<div className="mt-4 space-y-4 border-t border-[#E5E9ED] pt-4"><label className="block text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Garment<select value={product.id} onChange={e=>onProductChange?.(garmentCatalog.find(item=>String(item.id)===e.target.value))} className="mt-1 block w-full rounded-xl border border-[#DCE3EA] bg-white p-2.5 text-sm normal-case">{garmentCatalog.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Color · {color}</p><div className="mt-2 flex flex-wrap gap-2">{availableColors.map(value=><button key={value} type="button" onClick={()=>onColorChange?.(value)} title={value} aria-label={`Choose ${value}`} className={`h-8 w-8 rounded-full border-2 shadow-sm ${color===value?'border-[#17324D] ring-2 ring-[#17324D]/20':'border-white'}`} style={{backgroundColor:colorSwatch?.(value)||value}} />)}</div></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#6F7D89]">Size</p><div className="mt-2 flex flex-wrap gap-2">{availableSizes.map(value=><button key={value} type="button" onClick={()=>onSizeChange?.(value)} className={`min-w-10 rounded-xl border px-2.5 py-2 text-xs font-bold ${size===value?'border-[#17324D] bg-[#17324D] text-white':'border-[#DCE3EA] bg-white text-[#52616F]'}`}>{value}</button>)}</div></div><p className="rounded-xl bg-[#F3F6F8] p-2.5 text-[10px] leading-relaxed text-[#657481]">Your artwork position is preserved when changing the blank. It is safely fitted only when the new print area is smaller.</p></div>}
        </div>
        {selected && layout ? <div className="rounded-3xl border border-[#DCE3EA] bg-white/90 p-4 shadow-[0_14px_40px_rgba(23,50,77,.07)] space-y-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#A66331]">Selected artwork</p><h2 className="mt-1 font-bold text-[#17324D]">{selected.title}</h2></div><button type="button" onClick={()=>{setSelected(null);setApproved(false);}} className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50" aria-label="Delete artwork"><Trash2 size={15}/></button></div>
          <label className="block text-xs font-semibold text-[#52616F]">Size · {layout.width.toFixed(2)} × {layout.height.toFixed(2)} in<input aria-label="Artwork width" type="range" min={Math.min(.5,layout.maxWidth)} max={layout.maxWidth} step="0.01" value={layout.width} onChange={e=>{setRequested(Number(e.target.value));setApproved(false);}} className="mt-2 w-full accent-[#A66331]"/></label>
          <label className="block text-xs font-semibold text-[#52616F]">Rotation · {Math.round(rotation)}°<input aria-label="Artwork rotation" type="range" min="-180" max="180" step="1" value={rotation} onChange={e=>{setRotation(Number(e.target.value));setApproved(false);}} className="mt-2 w-full accent-[#A66331]"/></label>
          <div className="grid grid-cols-2 gap-2"><button type="button" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DCE3EA] px-3 py-2.5 text-xs font-bold text-[#52616F]" onClick={()=>updatePosition({x:(area.width-layout.width)/2,y:(usableArea.height-layout.height)/2})}><Move size={14}/> Center</button><button type="button" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DCE3EA] px-3 py-2.5 text-xs font-bold text-[#52616F]" onClick={resetArtwork}><RotateCcw size={14}/> Reset</button></div>
          {selected.customizable && <fieldset className="border rounded p-4 space-y-3"><legend>Personalization</legend><label className="block">Name {selected.requires_name?'(required)':'(optional)'}<input value={text.name} maxLength={32} onChange={e=>updateText({name:e.target.value})} className="block border rounded p-2 w-full"/></label><label className="block">Short message<input value={text.message} maxLength={60} onChange={e=>updateText({message:e.target.value})} className="block border rounded p-2 w-full"/></label><label className="block">Text colour<select value={text.color} onChange={e=>updateText({color:e.target.value})} className="block border rounded p-2"><option value="#111111">Black</option><option value="#ffffff">White</option></select></label><p className="text-xs">Names appear in the centre of personalization frames; other added text appears beneath the artwork. Original lettering stays unchanged.</p></fieldset>}
          {priceVisibility!=='hidden'&&<p className="rounded-xl bg-[#F3F6F8] p-3 text-xs">Front print · {Number(unitPrice).toFixed(2)} CAD each{priceVisibility==='total'&&` · ${(unitPrice*quantity).toFixed(2)} CAD total`} before shipping and tax.</p>}
          <label className="flex items-start gap-2"><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} className="mt-1"/><span>I have checked the garment, design, spelling and placement and have permission to use any text I added. I understand this preview is approximate and a production proof requires my approval.</span></label>
          <button disabled={!approved||saving||(selected.requires_name&&!text.name.trim())} onClick={save} className="w-full rounded-xl bg-[#17324D] px-6 py-3.5 font-bold text-white shadow-lg transition hover:bg-[#234766] disabled:opacity-40">{saving?'Saving design…':'Review & add to cart'}</button>
        </div>:<div className="rounded-3xl border border-dashed border-[#C9D3DC] bg-white/65 p-6 text-center"><Shirt className="mx-auto text-[#9AA7B2]"/><p className="mt-3 text-sm font-bold text-[#17324D]">Choose an artwork to begin</p><p className="mt-1 text-xs text-[#73818D]">Your editing tools will appear here.</p></div>}
      </section>
    </div>}
    </div>
  </main>;
}
