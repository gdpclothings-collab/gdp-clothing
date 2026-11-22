import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Download, ImagePlus, Loader2, RotateCcw, Share2, ShieldCheck, Trash2 } from 'lucide-react';
import { salesLeadApi } from '@/lib/salesLeadApi';
import {
  QUICK_DESIGN_BACKGROUNDS,
  QUICK_DESIGN_MAX_PHOTOS,
  validateQuickDesignFile,
  renderQuickDesignArtwork,
  renderQuickDesignMockup,
} from '@/lib/quickDesignCanvas';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const ACCENTS = ['#f9c846', '#ffffff', '#fb61bd', '#80f1f2', '#b3fb6e'];
const INPUT = 'w-full rounded-xl border border-white/20 bg-[#17191d] px-3 py-3 text-sm text-white outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20';
const BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50';
const MAX_PREVIEW_NOTICE = 'Previews are watermarked and not print-ready. GDP reviews the original photos and approves final print quality after ordering.';

function downloadSample(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function Field({ title, children }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/70">{title}</span>{children}</label>;
}

function SmallHeading({ number, children }) {
  return <h2 className="mb-4 flex items-center gap-3 text-lg font-black"><span className="grid h-8 w-8 place-items-center rounded-full bg-lime-300 text-sm text-black">{number}</span>{children}</h2>;
}

export default function QuickDesign() {
  const location = useLocation();
  const [photos, setPhotos] = useState([]);
  const urlsRef = useRef(new Set());
  const [message, setMessage] = useState('');
  const [backgroundId, setBackgroundId] = useState(QUICK_DESIGN_BACKGROUNDS[0]?.id || '');
  const [headline, setHeadline] = useState('');
  const [subline, setSubline] = useState('ONE OF A KIND');
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [results, setResults] = useState([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [selected, setSelected] = useState('A');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', size: 'M', quantity: 1, notes: '', website: '' });
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [sendError, setSendError] = useState('');

  const selectedBackground = useMemo(() =>
    QUICK_DESIGN_BACKGROUNDS.find((background) => background.id === backgroundId) || QUICK_DESIGN_BACKGROUNDS[0],
  [backgroundId]);
  const selectedResult = results.find((item) => item.variant === selected);

  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!photos.length || !selectedBackground) {
      setResults([]);
      setPreviewBusy(false);
      setPreviewError('');
      return undefined;
    }
    let cancelled = false;
    setPreviewBusy(true);
    setPreviewError('');
    const options = {
      photos,
      backgroundUrl: selectedBackground.fullAsset || selectedBackground.assetUrl,
      headline: headline || 'YOUR NAME',
      subline: subline || 'CUSTOM BOOTLEG',
      accent,
    };
    Promise.all(['A', 'B'].map(async (variant) => {
      const artwork = await renderQuickDesignArtwork({ ...options, variant });
      const shirt = renderQuickDesignMockup(artwork);
      return { variant, artwork: artwork.toDataURL('image/jpeg', 0.84), mockup: shirt.toDataURL('image/jpeg', 0.85) };
    })).then((previews) => {
      if (!cancelled) setResults(previews);
    }).catch((error) => {
      if (!cancelled) {
        setResults([]);
        setPreviewError(error?.message || 'Could not generate your samples.');
      }
    }).finally(() => { if (!cancelled) setPreviewBusy(false); });
    return () => { cancelled = true; };
  }, [photos, selectedBackground, headline, subline, accent]);

  const addPhotos = (event) => {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    setMessage('');
    if (!incoming.length) return;
    if (incoming.length + photos.length > QUICK_DESIGN_MAX_PHOTOS) {
      setMessage('You can upload a maximum of ' + QUICK_DESIGN_MAX_PHOTOS + ' photos.');
      return;
    }
    for (const file of incoming) {
      const error = validateQuickDesignFile(file);
      if (error) {
        setMessage(error);
        return;
      }
    }
    const items = incoming.map((file) => {
      const url = URL.createObjectURL(file);
      urlsRef.current.add(url);
      return { id: crypto.randomUUID(), url, file };
    });
    setSubmitted(null);
    setPhotos((current) => [...current, ...items]);
  };

  const removePhoto = (id) => {
    setPhotos((current) => current.filter((item) => item.id !== id));
    const target = photos.find((item) => item.id === id);
    if (target) {
      URL.revokeObjectURL(target.url);
      urlsRef.current.delete(target.url);
    }
    setSubmitted(null);
  };

  const reset = () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    setPhotos([]);
    setHeadline('');
    setSubline('ONE OF A KIND');
    setBackgroundId(QUICK_DESIGN_BACKGROUNDS[0]?.id || '');
    setAccent(ACCENTS[0]);
    setSelected('A');
    setResults([]);
    setSubmitted(null);
    setMessage('');
  };

  const shareFiles = async () => {
    if (!selectedResult || !navigator.share || !navigator.canShare) {
      setMessage('Sharing is unavailable in this browser. Download the sample and attach it with your original photos when GDP contacts you.');
      return;
    }
    try {
      const blob = await (await fetch(selectedResult.artwork)).blob();
      const files = [new File([blob], 'GDP-Sample-' + selected + '.jpg', { type: 'image/jpeg' }), ...photos.map((item) => item.file)];
      if (!navigator.canShare({ files })) {
        setMessage('Your device cannot share these files together. Download the sample and send your photos separately.');
        return;
      }
      await navigator.share({ files, title: 'GDP Clothing custom bootleg request', text: 'GDP Quick Design – Sample ' + selected + '. Please share these files with GDP Clothing.' });
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage('Could not share the files. You can download the sample instead.');
    }
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    setSendError('');
    setSubmitted(null);
    if (!selectedResult || previewBusy || !photos.length) {
      setSendError('Finish your design and choose a sample first.');
      return;
    }
    if (!rightsConfirmed) {
      setSendError('Please confirm you have permission to use these photos.');
      return;
    }
    setSending(true);
    try {
      const params = new URLSearchParams(location.search);
      const notes = [
        '[GDP QUICK DESIGN MVP — contact and choices only; original photos and previews are NOT uploaded by this form]',
        'Sample: ' + selected,
        'Background: ' + (selectedBackground?.name || backgroundId) + ' (' + backgroundId + ')',
        'Headline: ' + headline.trim().slice(0, 36),
        'Subtitle: ' + subline.trim().slice(0, 36),
        'Accent: ' + accent,
        'Uploaded photos on customer device: ' + photos.length,
        'Black unisex T-shirt, size: ' + customer.size,
        'Requested quantity: ' + customer.quantity,
        'Customer notes: ' + customer.notes.trim().slice(0, 1000),
        'Request source: Facebook Marketplace / Quick Design',
        'Please request the original customer photos and selected sample before production.',
      ].join('\n');
      const response = await salesLeadApi.submit({
        customerName: customer.name.trim(),
        customerEmail: customer.email.trim(),
        customerPhone: customer.phone.trim(),
        orderType: 'custom_apparel',
        garmentType: 'Black unisex cotton T-shirt – ' + customer.size,
        quantity: Math.max(1, Math.min(100, Number(customer.quantity) || 1)),
        artworkReady: false,
        budgetRange: '',
        preferredContact: 'email',
        notes,
        source: 'quick_design_page',
        utmSource: params.get('utm_source') || 'facebook_marketplace',
        utmMedium: params.get('utm_medium') || 'referral',
        utmCampaign: params.get('utm_campaign') || 'quick_design',
        referrer: document.referrer || '',
        website: customer.website,
      });
      setSubmitted(response || { accepted: true });
    } catch (error) {
      setSendError(error?.message || 'Your request could not be submitted. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const updateCustomer = (key, value) => setCustomer((current) => ({ ...current, [key]: value }));

  return <div className="min-h-screen bg-[#090b0e] text-white" data-gdp-quick-design="true">
    <section className="border-b border-white/10 bg-gradient-to-br from-[#131c20] via-[#111016] to-[#16121d] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-lime-300">GDP Clothing • Marketplace Quick Design</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">2 free bootleg samples. <span className="text-lime-300">Instantly.</span></h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-white/70">Upload your photos, pick an original GDP background, edit the text and compare two layouts right here. No account, Photoshop or paid AI generation required.</p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-white/70">
          <span className="rounded-full border border-white/20 px-3 py-2">Free watermarked previews</span>
          <span className="rounded-full border border-white/20 px-3 py-2">Private browser rendering</span>
          <span className="rounded-full border border-white/20 px-3 py-2">Black T-shirt mockups</span>
        </div>
      </div>
    </section>

    <div className="mx-auto grid max-w-6xl gap-7 px-4 py-9 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="space-y-7">
        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="1">Add your photos</SmallHeading>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/25 bg-black/20 p-5 text-center hover:border-lime-300">
            <ImagePlus size={28} className="text-lime-300" />
            <span className="font-bold">Tap to upload 1–5 photos</span>
            <span className="text-xs text-white/60">JPG, PNG or WebP • up to 10 MB each</span>
            <input aria-label="Upload customer photos" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} />
          </label>
          {photos.length > 0 && <div className="mt-4 grid grid-cols-5 gap-2">{photos.map((item, index) =>
            <div key={item.id} className="relative aspect-square overflow-hidden rounded-lg border border-white/20">
              <img src={item.url} alt={'Uploaded photo ' + (index + 1)} className="h-full w-full object-cover" />
              <button type="button" onClick={() => removePhoto(item.id)} aria-label={'Remove photo ' + (index + 1)} className="absolute right-0 top-0 rounded-bl-lg bg-black/80 p-1 text-white"><Trash2 size={14}/></button>
            </div>
          )}</div>}
          <p className="mt-3 text-xs leading-5 text-white/55">Photos stay on your device while you design. Soft edge feathering blends the edges of photos but does not cut subjects out of their backgrounds. Transparent PNG cutouts work best; automatic background removal is not included.</p>
          {message && <p role="status" className="mt-3 rounded-lg bg-amber-300/10 p-3 text-sm text-amber-200">{message}</p>}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="2">Choose a GDP background</SmallHeading>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
            {QUICK_DESIGN_BACKGROUNDS.map((background) =>
              <button key={background.id} type="button" onClick={() => { setBackgroundId(background.id); setSubmitted(null); }}
                aria-pressed={backgroundId === background.id}
                className={'overflow-hidden rounded-xl border-2 p-1 text-left transition ' + (backgroundId === background.id ? 'border-lime-300 bg-lime-300/10' : 'border-white/15 hover:border-white/50')}>
                <img src={background.thumbnail} alt="" loading="lazy" className="aspect-[297/420] w-full rounded-md bg-black object-contain" />
                <span className="mt-1 block truncate px-1 text-[10px] font-bold">{background.name}</span>
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="3">Personalize the text</SmallHeading>
          <div className="grid gap-4">
            <Field title="Main name or heading"><input className={INPUT} maxLength={36} value={headline} onChange={(e) => { setHeadline(e.target.value); setSubmitted(null); }} placeholder="e.g. HENRY" /></Field>
            <Field title="Subtitle"><input className={INPUT} maxLength={36} value={subline} onChange={(e) => { setSubline(e.target.value); setSubmitted(null); }} placeholder="e.g. FOREVER LOVED" /></Field>
            <div><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/70">Name color</span>
              <div className="flex gap-3">{ACCENTS.map((color) =>
                <button key={color} type="button" onClick={() => { setAccent(color); setSubmitted(null); }} aria-label={'Choose color ' + color}
                  aria-pressed={accent === color} className={'h-10 w-10 rounded-full border-4 ' + (accent === color ? 'border-lime-300 ring-2 ring-white/60' : 'border-[#17191d]')}
                  style={{ backgroundColor: color }} />
              )}</div>
            </div>
          </div>
        </section>
        <button type="button" onClick={reset} className={BTN + ' border border-white/20 bg-white/5 hover:bg-white/10'}><RotateCcw size={16}/> Start over</button>
      </div>

      <div className="space-y-7">
        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="4">Compare your two samples</SmallHeading>
          <p className="mb-4 text-sm text-white/65">Sample A uses a centered hero montage. Sample B uses a bold, off-center editorial layout. Both use soft photo edges without changing your original background.</p>
          {!photos.length ? <div className="rounded-xl border border-dashed border-white/20 bg-black/20 p-12 text-center text-white/60">Upload at least one photo to create Samples A and B instantly.</div> :
          previewBusy ? <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-white/70"><Loader2 className="animate-spin" /> Creating both previews on your device…</div> :
          previewError ? <p role="alert" className="rounded-xl bg-red-950/50 p-4 text-sm text-red-200">{previewError}</p> :
          <div className="grid grid-cols-2 gap-3">{results.map((item) =>
            <button key={item.variant} data-gdp-sample-option={item.variant} aria-label={"Choose Sample " + item.variant} type="button" onClick={() => { setSelected(item.variant); setSubmitted(null); }} aria-pressed={selected === item.variant}
              className={'overflow-hidden rounded-xl border-2 text-left transition ' + (selected === item.variant ? 'border-lime-300 bg-lime-300/10' : 'border-white/15 hover:border-white/50')}>
              <img src={item.artwork} alt={'Watermarked sample ' + item.variant + ' artwork'} className="aspect-[297/420] w-full object-contain" />
              <span className="flex items-center justify-between p-3 text-sm font-black"><span>Sample {item.variant}<small className="mt-0.5 block text-[10px] font-medium text-white/60">{item.variant === "A" ? "Hero Montage" : "Editorial Collage"}</small></span> {selected === item.variant ? <CheckCircle2 size={18} className="text-lime-300" /> : null}</span>
            </button>)}</div>}
          <p className="mt-4 text-xs leading-5 text-white/60">{MAX_PREVIEW_NOTICE}</p>
          {selectedResult && !previewBusy && <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadSample(selectedResult.artwork, 'GDP-Quick-Design-Sample-' + selected + '.jpg')} className={BTN + ' bg-white text-black hover:bg-white/90'}><Download size={16}/> Save Sample {selected}</button>
            <button type="button" onClick={shareFiles} className={BTN + ' border border-white/20 hover:bg-white/10'}><Share2 size={16}/> Share sample + photos</button>
          </div>}
        </section>

        {selectedResult && !previewBusy && <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <h2 className="mb-3 text-lg font-black">Black T-shirt preview • Sample {selected}</h2>
          <img src={selectedResult.mockup} alt={'Sample ' + selected + ' on an illustrative black T-shirt'} className="mx-auto max-h-[490px] w-full rounded-xl bg-[#111] object-contain" />
          <p className="mt-3 text-xs leading-5 text-white/55">Illustrative unisex black cotton shirt, not a verified Gildan product photo. Final print size and placement are checked by GDP.</p>
        </section>}

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="5">Request this design</SmallHeading>
          <p className="mb-5 text-sm leading-6 text-white/65">Choose your preferred sample, then send GDP your contact details and design choices. This is a request, not a purchase or payment.</p>
          {submitted ? <div role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-5">
            <CheckCircle2 className="text-emerald-300" size={26} />
            <h3 className="mt-2 text-xl font-black">Your design request was received.</h3>
            <p className="mt-2 text-sm leading-6 text-white/75">GDP received your contact details and Sample {selected} selection. <strong>Your photos and preview image have not been uploaded.</strong> Save/share the sample with its original photos when GDP contacts you, so production can proceed.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadSample(selectedResult.artwork, 'GDP-Quick-Design-Sample-' + selected + '.jpg')} className={BTN + ' bg-lime-300 text-black'}><Download size={16}/> Save selected sample</button>
              <button type="button" onClick={shareFiles} className={BTN + ' border border-white/20'}><Share2 size={16}/> Share original files</button>
            </div>
          </div> :
          <form onSubmit={submitRequest} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field title="Your name *"><input className={INPUT} required minLength={2} maxLength={120} value={customer.name} onChange={(e) => updateCustomer('name', e.target.value)} autoComplete="name"/></Field>
              <Field title="Email *"><input className={INPUT} required type="email" maxLength={200} value={customer.email} onChange={(e) => updateCustomer('email', e.target.value)} autoComplete="email"/></Field>
              <Field title="Phone (optional)"><input className={INPUT} maxLength={60} value={customer.phone} onChange={(e) => updateCustomer('phone', e.target.value)} autoComplete="tel"/></Field>
              <Field title="Shirt size *"><select className={INPUT} value={customer.size} onChange={(e) => updateCustomer('size', e.target.value)}>{SIZES.map((size) => <option key={size}>{size}</option>)}</select></Field>
              <Field title="Quantity *"><input className={INPUT} type="number" min={1} max={100} required value={customer.quantity} onChange={(e) => updateCustomer('quantity', e.target.value)}/></Field>
            </div>
            <Field title="Notes (optional)"><textarea className={INPUT} rows={3} maxLength={1000} value={customer.notes} onChange={(e) => updateCustomer('notes', e.target.value)} placeholder="Any requested changes or details?" /></Field>
            <label className="flex gap-3 text-sm leading-6 text-white/75">
              <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} className="mt-1.5 h-4 w-4 accent-lime-300" required />
              <span>I have permission to use the photos I uploaded and understand this is a free preview request, not a completed order.</span>
            </label>
            <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={customer.website} onChange={(e) => updateCustomer('website', e.target.value)}/></label></div>
            {sendError && <p role="alert" className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{sendError}</p>}
            <button type="submit" disabled={!selectedResult || previewBusy || sending || !headline.trim()} className={BTN + ' w-full bg-lime-300 py-3 text-black hover:bg-lime-200'}>
              {sending ? <Loader2 className="animate-spin" size={18}/> : <ShieldCheck size={18}/>}
              {sending ? 'Sending your request…' : 'Submit Sample ' + selected + ' request'}
              {!sending && <ArrowRight size={18}/>}
            </button>
            <p className="text-xs leading-5 text-white/55">This sends contact info and design selections through GDP's existing request system. Images remain on your device; GDP will request the original photo files. No payment or automatic order is created.</p>
          </form>}
          <p className="mt-5 text-xs text-white/55">Need full editing instead? <Link to="/custom-studio" className="font-bold text-lime-300 underline">Open the original GDP Custom Studio</Link>.</p>
        </section>
      </div>
    </div>
  </div>;
}
