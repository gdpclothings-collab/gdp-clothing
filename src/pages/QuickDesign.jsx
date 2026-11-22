import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Download, HelpCircle, ImagePlus, Loader2, RotateCcw, Share2, ShieldCheck, Trash2 } from 'lucide-react';
import { salesLeadApi } from '@/lib/salesLeadApi';
import {
  QUICK_DESIGN_BACKGROUNDS,
  QUICK_DESIGN_MAX_PHOTOS,
  QUICK_DESIGN_FONTS,
  validateQuickDesignFile,
  renderQuickDesignArtwork,
} from '@/lib/quickDesignCanvas';
import { requestQuickDesignRemoveBgCutout } from '@/lib/quickDesignRemoveBgClient';
import { PREMIUM_TEXT_STYLES } from '@/lib/customStudioV2PremiumTextStyles';
import { QUICK_DESIGN_GARMENTS, QUICK_DESIGN_SIDES, renderQuickDesignGarmentMockup } from '@/lib/quickDesignGarmentMockup';
import { QUICK_DESIGN_PHASE_B_NAMES } from '@/lib/quickDesignPhaseBLayout';
import QuickDesignHelp from '@/components/storefront/QuickDesignHelp';
import './quickDesignFonts.css';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const ACCENTS = ['#f9c846', '#ffffff', '#fb61bd', '#80f1f2', '#b3fb6e'];
const PHASE_B_DEFAULT_BACKGROUND = QUICK_DESIGN_BACKGROUNDS.some((item) => item.id === 'flame-inferno') ? 'flame-inferno' : (QUICK_DESIGN_BACKGROUNDS[0]?.id || '');
const INPUT = 'min-w-0 w-full rounded-xl border border-white/20 bg-[#17191d] px-3 py-3 text-sm text-white outline-none focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20';
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
  const isCloudflareBranchPreview = typeof window !== 'undefined' && /^.+\.gdp-clothing\.pages\.dev$/i.test(window.location.hostname);
  const [photos, setPhotos] = useState([]);
  const urlsRef = useRef(new Set());
  const [message, setMessage] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const [backgroundId, setBackgroundId] = useState(PHASE_B_DEFAULT_BACKGROUND);
  const [headline, setHeadline] = useState('');
  const [subline, setSubline] = useState('');
  const [fontId, setFontId] = useState('serif');
  const [curve, setCurve] = useState('up');
  const [fontSizePercent, setFontSizePercent] = useState(100);
  const [premiumStyle, setPremiumStyle] = useState('gold-chrome');
  const [autoCutout, setAutoCutout] = useState(false);
  const [cutoutBusy, setCutoutBusy] = useState(false);
  const [cutoutError, setCutoutError] = useState('');
  const [cutoutUnavailable, setCutoutUnavailable] = useState(false);
  const [accent, setAccent] = useState(ACCENTS[2]);
  const [results, setResults] = useState([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [selected, setSelected] = useState('A');
  const [garment, setGarment] = useState('tshirt');
  const [garmentSide, setGarmentSide] = useState('front');
  const [garmentMockup, setGarmentMockup] = useState('');
  const [garmentBusy, setGarmentBusy] = useState(false);
  const [garmentError, setGarmentError] = useState('');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', size: 'M', quantity: 1, notes: '', website: '' });
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [sendError, setSendError] = useState('');

  const selectedBackground = useMemo(() =>
    QUICK_DESIGN_BACKGROUNDS.find((background) => background.id === backgroundId) || QUICK_DESIGN_BACKGROUNDS[0],
  [backgroundId]);
  const selectedResult = results.find((item) => item.variant === selected);
  const selectedGarment = QUICK_DESIGN_GARMENTS.find((item) => item.id === garment) || QUICK_DESIGN_GARMENTS[0];
  const selectedPremium = PREMIUM_TEXT_STYLES.find((item) => item.id === premiumStyle);
  const cutoutPending = autoCutout && photos.some((item) => item.bgStatus === 'pending' || item.bgStatus === 'working');

  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);

  // Sequential, explicit customer-opt-in processing. A third-party request
  // happens only after checking the external remove.bg consent control.
  // The server, not the customer browser, owns the API key and quota checks.
  useEffect(() => {
    if (!autoCutout || cutoutBusy || cutoutUnavailable) return;
    const target = photos.find((item) => item.bgStatus === 'pending');
    if (!target) return;
    setCutoutBusy(true);
    setCutoutError('');
    setPhotos((items) => items.map((item) => item.id === target.id
      ? { ...item, bgStatus: 'working' } : item));

    requestQuickDesignRemoveBgCutout(target.file).then((result) => {
      if (result.ok && result.cutoutUrl) {
        if (!urlsRef.current.has(target.url)) {
          URL.revokeObjectURL(result.cutoutUrl);
          return;
        }
        urlsRef.current.add(result.cutoutUrl);
        setPhotos((items) => items.map((item) => item.id === target.id
          ? { ...item, cutoutUrl: result.cutoutUrl, bgStatus: 'done' } : item));
        return;
      }
      // A quota/rate/config failure stops all remaining uploads. This avoids
      // accidental chargeable retries and preserves already processed cutouts.
      setCutoutError(result.message || 'Automatic background removal is unavailable.');
      setCutoutUnavailable(true);
      setAutoCutout(false);
      setPhotos((items) => items.map((item) => item.id === target.id
        ? { ...item, bgStatus: 'failed' } : item));
    }).catch(() => {
      setCutoutError('Automatic cutouts are unavailable. Your original photos are safe. Use the remove.bg link below.');
      setCutoutUnavailable(true);
      setAutoCutout(false);
      setPhotos((items) => items.map((item) => item.id === target.id
        ? { ...item, bgStatus: 'failed' } : item));
    }).finally(() => setCutoutBusy(false));
  }, [photos, autoCutout, cutoutBusy, cutoutUnavailable]);

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
      photos: photos.map((item) => ({ ...item, url: (autoCutout || cutoutUnavailable) ? (item.cutoutUrl || item.url) : item.url })),
      backgroundUrl: selectedBackground.fullAsset || selectedBackground.assetUrl,
      headline: headline || 'YOUR NAME',
      subline: subline.trim(),
      accent,
      fontId,
      curve,
      fontSizePercent,
      premiumStyle,
    };
    Promise.all(['A', 'B'].map(async (variant) => {
      const artwork = await renderQuickDesignArtwork({ ...options, variant });
      return { variant, artwork: artwork.toDataURL('image/jpeg', 0.84) };
    })).then((previews) => {
      if (!cancelled) setResults(previews);
    }).catch((error) => {
      if (!cancelled) {
        setResults([]);
        setPreviewError(error?.message || 'Could not generate your samples.');
      }
    }).finally(() => { if (!cancelled) setPreviewBusy(false); });
    return () => { cancelled = true; };
  }, [photos, selectedBackground, headline, subline, accent, fontId, curve, fontSizePercent, premiumStyle, autoCutout, cutoutUnavailable]);

  // Switching shirt / crewneck / hoodie or front / back only redraws the
  // selected mockup, rather than recomputing the two original photo samples.
  useEffect(() => {
    if (!selectedResult?.artwork || previewBusy) {
      setGarmentMockup('');
      setGarmentBusy(false);
      return undefined;
    }
    let cancelled = false;
    setGarmentBusy(true);
    setGarmentError('');
    setGarmentMockup('');
    renderQuickDesignGarmentMockup({ artworkSource: selectedResult.artwork, garment, side: garmentSide })
      .then((canvas) => { if (!cancelled) setGarmentMockup(canvas.toDataURL('image/jpeg', 0.9)); })
      .catch((error) => { if (!cancelled) setGarmentError(error?.message || 'Could not render this garment.'); })
      .finally(() => { if (!cancelled) setGarmentBusy(false); });
    return () => { cancelled = true; };
  }, [selectedResult?.artwork, garment, garmentSide, previewBusy]);

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
      return { id: crypto.randomUUID(), url, file, bgStatus: 'pending', cutoutUrl: '' };
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
      if (target.cutoutUrl) { URL.revokeObjectURL(target.cutoutUrl); urlsRef.current.delete(target.cutoutUrl); }
    }
    setSubmitted(null);
  };

  const reset = () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    setPhotos([]);
    setHeadline('');
    setSubline('');
    setFontId('serif');
    setCurve('up');
    setFontSizePercent(100);
    setPremiumStyle('gold-chrome');
    setGarment('tshirt');
    setGarmentSide('front');
    setGarmentMockup('');
    setCutoutError('');
    setCutoutUnavailable(false);
    setAutoCutout(false);
    setBackgroundId(PHASE_B_DEFAULT_BACKGROUND);
    setAccent(ACCENTS[2]);
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
      await navigator.share({ files, title: 'GDP Clothing custom bootleg request', text: 'GDP Quick Design – Sample ' + selected + ', ' + selectedGarment.label + ', ' + garmentSide + '. Please share these files with GDP Clothing.' });
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage('Could not share the files. You can download the sample instead.');
    }
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    if (isCloudflareBranchPreview) { setSendError('This is the development preview. Sending customer requests is disabled here. No details were submitted.'); return; }
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
        'Font: ' + fontId,
        'Name curve: ' + curve,
        'Name size: ' + fontSizePercent + '%',
        'Text style: ' + (selectedPremium?.label || 'Solid color'),
        'Artwork format: 12 x 16 inches (3600 x 4800 pixels at 300 DPI target)',
        'remove.bg cutout (external opt-in): ' + (autoCutout || cutoutUnavailable ? 'enabled or attempted' : 'disabled'),
        'Uploaded photos on customer device: ' + photos.length,
        'Black ' + selectedGarment.label + ', size: ' + customer.size,
        'Requested print side: ' + garmentSide + ' only',
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
        garmentType: 'Black ' + selectedGarment.label + ' – ' + customer.size,
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
  const switchCutouts = (enabled) => {
    setAutoCutout(enabled);
    if (enabled) {
      setCutoutUnavailable(false);
      setCutoutError('');
      setPhotos((items) => items.map((item) => !item.cutoutUrl ? { ...item, bgStatus: 'pending' } : item));
    }
  };

  return <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-[#090b0e] text-white" data-gdp-quick-design="true">
    <section className="border-b border-white/10 bg-gradient-to-br from-[#131c20] via-[#111016] to-[#16121d] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-lime-300">GDP Clothing • Marketplace Quick Design</p>
          <button type="button" data-gdp-help-trigger="header" onClick={() => setHelpOpen(true)} aria-haspopup="dialog" aria-expanded={helpOpen} aria-controls="gdp-quick-design-help-dialog" className={BTN + ' border border-lime-300/40 bg-lime-300/10 text-lime-100 hover:bg-lime-300/20'}><HelpCircle size={19}/> Help with my design</button>
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">2 free bootleg samples. <span className="text-lime-300">Instantly.</span></h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-white/70">Upload your photos, pick an original GDP background, edit the text and compare two layouts right here. No account, Photoshop or paid AI generation required.</p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-white/70">
          <span className="rounded-full border border-white/20 px-3 py-2">Free watermarked previews</span>
          <span className="rounded-full border border-white/20 px-3 py-2">On-device sample rendering</span>
          <span className="rounded-full border border-white/20 px-3 py-2">T-shirt, sweatshirt and hoodie previews</span>
        </div>
      </div>
    </section>

    <div className="mx-auto grid min-w-0 max-w-6xl grid-cols-[minmax(0,1fr)] gap-7 px-4 py-9 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-7">
        <section className="min-w-0 rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="1">Add your photos</SmallHeading>
          <label className="mb-4 flex min-w-0 items-start gap-3 rounded-xl border border-lime-300/20 bg-lime-300/5 p-3 text-sm leading-5 text-white/80"><input type="checkbox" className="mt-1 accent-lime-300" checked={autoCutout} onChange={(e) => switchCutouts(e.target.checked)} /> <span className="min-w-0 break-words"><strong>Automatic background removal with remove.bg (optional)</strong><span className="mt-1 block text-xs text-white/65">If you check this, each uploaded photo will be sent to remove.bg, an external provider, for a low-resolution transparent preview. Your photos are never sent without your consent. Free quota is shared across customers; no full-resolution upgrades or paid requests.</span></span></label>
          {isCloudflareBranchPreview && <p role="status" className="mb-3 rounded-lg border border-white/15 bg-black/30 p-3 text-xs leading-5 text-white/70">Phase B development preview: automatic remove.bg API calls are not activated. Upload transparent PNGs to test the new layered compositions; the external remove.bg link remains available.</p>}
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/25 bg-black/20 p-5 text-center hover:border-lime-300">
            <ImagePlus size={28} className="text-lime-300" />
            <span className="font-bold">Tap to upload 1–5 photos</span>
            <span className="text-xs text-white/60">JPG, PNG or WebP • up to 10 MB each</span>
            <input aria-label="Upload customer photos" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} />
          </label>
          {photos.length > 0 && <div data-gdp-photo-grid="true" className="mt-4 grid min-w-0 max-w-full grid-cols-5 gap-1.5 sm:gap-2">{photos.map((item, index) =>
            <div key={item.id} className="relative aspect-square min-w-0 overflow-hidden rounded-lg border border-white/20">
              <img src={(autoCutout || cutoutUnavailable) ? (item.cutoutUrl || item.url) : item.url} alt={'Uploaded photo ' + (index + 1)} className="block h-full w-full max-w-full object-contain bg-neutral-700" />
              <button type="button" onClick={() => removePhoto(item.id)} aria-label={'Remove photo ' + (index + 1)} className="absolute right-0 top-0 rounded-bl-lg bg-black/80 p-1 text-white"><Trash2 size={14}/></button>
            </div>
          )}</div>}
          {cutoutPending && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-lime-200"><Loader2 size={15} className="animate-spin"/> Removing background through remove.bg free preview…</p>}
          {cutoutError && <p role="alert" className="mt-3 max-w-full min-w-0 break-words rounded-lg bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">{cutoutError}</p>}
          <p className="mt-3 max-w-full break-words text-xs leading-5 text-white/55">Original photos are kept for reference. The two artwork samples render locally; photos are sent to remove.bg only when you turn on its checkbox. Free cutouts are low-resolution previews, not 300-DPI production files.</p>
          <div className="mt-3 min-w-0 rounded-xl border border-white/15 bg-black/20 p-3" data-gdp-cutout-fallback="true">
            <p className="text-xs font-bold text-white/85">Need an alternative background remover?</p>
            <p className="mt-1 text-xs leading-5 text-white/65">When the automatic free-use allowance is exhausted or not configured, open remove.bg directly, save a transparent PNG and upload it here with automatic removal turned OFF. External remove.bg has its own privacy terms and may offer paid upgrades; GDP does not purchase those for you.</p>
            <a href="https://www.remove.bg/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 max-w-full items-center rounded-lg border border-white/25 px-3 text-sm font-bold text-lime-200 underline underline-offset-2 hover:bg-white/10">Open remove.bg (external)</a>
          </div>
          {message && <p role="status" className="mt-3 min-w-0 max-w-full break-words rounded-lg bg-amber-300/10 p-3 text-sm text-amber-200">{message}</p>}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="2">Choose a GDP background</SmallHeading>
          <p className="mb-3 text-xs text-white/60">Background stretches vertically to 12″ × 16″, with your name at the top. The GDP source image remains unchanged.</p>
          <div className="grid min-w-0 grid-cols-4 gap-2 sm:grid-cols-4">
            {QUICK_DESIGN_BACKGROUNDS.map((background) =>
              <button key={background.id} type="button" onClick={() => { setBackgroundId(background.id); setSubmitted(null); }}
                aria-pressed={backgroundId === background.id}
                className={'min-w-0 overflow-hidden rounded-xl border-2 p-1 text-left transition ' + (backgroundId === background.id ? 'border-lime-300 bg-lime-300/10' : 'border-white/15 hover:border-white/50')}>
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
            <Field title="Subtitle (optional)"><input className={INPUT} maxLength={36} value={subline} onChange={(e) => { setSubline(e.target.value); setSubmitted(null); }} placeholder="Leave blank to show no subtitle" /></Field>
            <Field title="Bootleg name font"><select value={fontId} onChange={(e) => { setFontId(e.target.value); setSubmitted(null); }} className={INPUT}>{QUICK_DESIGN_FONTS.map((font) => <option key={font.id} value={font.id}>{font.label}</option>)}</select></Field>
            <div aria-live="polite" className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">Selected font preview</p>
              <p className="mt-2 break-words text-3xl" style={{ fontFamily: QUICK_DESIGN_FONTS.find((font) => font.id === fontId)?.css || 'Impact, sans-serif', fontWeight: 400, fontSize: Math.round(30 * fontSizePercent / 100) + 'px', lineHeight: 1.15, color: selectedPremium ? 'transparent' : accent, backgroundImage: selectedPremium ? 'linear-gradient(180deg,' + selectedPremium.stops.join(',') + ')' : undefined, WebkitBackgroundClip: selectedPremium ? 'text' : undefined, backgroundClip: selectedPremium ? 'text' : undefined, filter: selectedPremium?.glow ? 'drop-shadow(0 0 5px ' + selectedPremium.glow + ')' : undefined }}>{(headline || 'YOUR NAME').slice(0, 36)}</p>
            </div>
            <Field title="Name layout"><select value={curve} onChange={(e) => { setCurve(e.target.value); setSubmitted(null); }} className={INPUT}><option value="straight">Straight</option><option value="up">Curve upward</option><option value="down">Curve downward</option></select></Field>
            <div>
              <label htmlFor="quick-design-name-size" className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider text-white/70"><span>Name font size</span><span data-gdp-font-size-value className="font-mono text-lime-300">{fontSizePercent}%</span></label>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Decrease name font size" onClick={() => { setFontSizePercent((size) => Math.max(60, size - 5)); setSubmitted(null); }} className={BTN + ' border border-white/20 bg-white/5 px-3'}>−</button>
                <input id="quick-design-name-size" aria-label="Name font size" type="range" min="60" max="160" step="5" value={fontSizePercent} onChange={(e) => { setFontSizePercent(Number(e.target.value)); setSubmitted(null); }} className="min-w-0 flex-1 accent-lime-300"/>
                <button type="button" aria-label="Increase name font size" onClick={() => { setFontSizePercent((size) => Math.min(160, size + 5)); setSubmitted(null); }} className={BTN + ' border border-white/20 bg-white/5 px-3'}>+</button>
              </div>
              <p className="mt-2 text-xs text-white/50">60–160% • Automatically fits long names within the artwork.</p>
            </div>
            <Field title="Premium text style">
              <select aria-label="Premium text style" className={INPUT} value={premiumStyle} onChange={(e) => { setPremiumStyle(e.target.value); setSubmitted(null); }}>
                <option value="solid">Solid color • Classic</option>
                {PREMIUM_TEXT_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
              </select>
            </Field>
            <p className="text-xs text-white/55">Premium finishes include metallic gradients, chrome, neon glow and 3D lettering. Your name color also tints the featured gradient band. No extra fee.</p>

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

      <div className="min-w-0 space-y-7">
        <section className="min-w-0 rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="4">Compare your two samples</SmallHeading>
          <p className="mb-2 text-xs text-white/55">12″ × 16″ portrait layout; the print target would be 3600 × 4800 px at 300 DPI after source-quality checks.</p>
          <p className="mb-4 text-sm text-white/65">Phase B: Sample A builds a balanced, overlapping hero portrait; Sample B creates a dramatic multi-layer stack. Transparent PNG cutouts get glowing pink-and-white subject outlines. The selected GDP background remains the original image.</p>
          {!photos.length ? <div className="rounded-xl border border-dashed border-white/20 bg-black/20 p-12 text-center text-white/60">Upload at least one photo to create Samples A and B instantly.</div> :
          previewBusy ? <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-white/70"><Loader2 className="animate-spin" /> Creating both previews on your device…</div> :
          previewError ? <p role="alert" className="rounded-xl bg-red-950/50 p-4 text-sm text-red-200">{previewError}</p> :
          <div className="grid grid-cols-2 gap-3">{results.map((item) =>
            <button key={item.variant} data-gdp-sample-option={item.variant} aria-label={"Choose Sample " + item.variant} type="button" onClick={() => { setSelected(item.variant); setSubmitted(null); }} aria-pressed={selected === item.variant}
              className={'overflow-hidden rounded-xl border-2 text-left transition ' + (selected === item.variant ? 'border-lime-300 bg-lime-300/10' : 'border-white/15 hover:border-white/50')}>
              <img src={item.artwork} alt={'Watermarked sample ' + item.variant + ' artwork'} className="aspect-[297/420] w-full object-contain" />
              <span className="flex items-center justify-between p-3 text-sm font-black"><span>Sample {item.variant}<small className="mt-0.5 block text-[10px] font-medium text-white/60">{QUICK_DESIGN_PHASE_B_NAMES[item.variant]}</small></span> {selected === item.variant ? <CheckCircle2 size={18} className="text-lime-300" /> : null}</span>
            </button>)}</div>}
          <p className="mt-4 text-xs leading-5 text-white/60">{MAX_PREVIEW_NOTICE}</p>
          {selectedResult && !previewBusy && <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => downloadSample(selectedResult.artwork, 'GDP-Quick-Design-Sample-' + selected + '.jpg')} className={BTN + ' bg-white text-black hover:bg-white/90'}><Download size={16}/> Save Sample {selected}</button>
            <button type="button" onClick={shareFiles} className={BTN + ' border border-white/20 hover:bg-white/10'}><Share2 size={16}/> Share sample + photos</button>
          </div>}
        </section>

        {selectedResult && !previewBusy && <section className="rounded-2xl border border-white/15 bg-white/5 p-5" data-gdp-garment-preview="true">
          <h2 className="mb-2 text-lg font-black">Preview your garment • Sample {selected}</h2>
          <p className="mb-4 text-sm leading-6 text-white/65">Choose a garment and the side where you would like your selected artwork printed.</p>
          <div role="group" aria-label="Choose garment type" className="grid grid-cols-3 gap-2">
            {QUICK_DESIGN_GARMENTS.map((item) =>
              <button key={item.id} type="button" aria-label={'Preview ' + item.label} aria-pressed={garment === item.id} onClick={() => { setGarment(item.id); setSubmitted(null); }}
                className={'min-h-16 rounded-xl border-2 p-2 text-center transition ' + (garment === item.id ? 'border-lime-300 bg-lime-300/10 text-lime-100' : 'border-white/15 bg-black/20 text-white/75 hover:border-white/50')}>
                <span className="block text-xs font-extrabold sm:text-sm">{item.label}</span>
                <span className="mt-1 block text-[10px] text-white/55">{item.description}</span>
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Choose print side">
            {QUICK_DESIGN_SIDES.map((item) =>
              <button key={item.id} type="button" aria-label={'Show ' + item.label + ' view'} aria-pressed={garmentSide === item.id}
                onClick={() => { setGarmentSide(item.id); setSubmitted(null); }}
                className={'min-h-11 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition ' + (garmentSide === item.id ? 'border-lime-300 bg-lime-300/10 text-lime-100' : 'border-white/15 bg-black/20 hover:border-white/40')}>
                {item.label}
              </button>
            )}
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#16171b]">
            {garmentBusy ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-white/65"><Loader2 size={18} className="animate-spin"/> Updating garment preview…</div> :
            garmentError ? <p role="alert" className="p-5 text-sm text-amber-200">{garmentError}</p> :
            garmentMockup ? <img data-gdp-garment-image="true" src={garmentMockup} alt={'Sample ' + selected + ' on illustrative black ' + selectedGarment.label + ' ' + garmentSide + ' view'} className="mx-auto max-h-[520px] w-full object-contain" /> :
            <p className="p-6 text-center text-sm text-white/60">Select a garment to view your design.</p>}
          </div>
          <p className="mt-3 text-xs leading-5 text-white/55">Illustrative black {selectedGarment.label.toLowerCase()} • {garmentSide} only. This view does not add two-sided printing. Not a verified Gildan product photo. Actual print size and placement depend on the garment and require GDP's production check.</p>
        </section>}

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SmallHeading number="5">Request this design</SmallHeading>
            <button type="button" data-gdp-help-trigger="request" aria-haspopup="dialog" aria-expanded={helpOpen} aria-controls="gdp-quick-design-help-dialog" onClick={() => setHelpOpen(true)} className={BTN + ' border border-white/25 bg-white/5 text-white hover:bg-white/10'}><HelpCircle size={17}/> Need design help?</button>
          </div>
          {isCloudflareBranchPreview && <p role="status" className="mb-4 rounded-xl border border-amber-300/40 bg-amber-200/10 p-3 text-sm text-amber-100">Development preview: request submissions are disabled to protect live customer data. You can test the design controls and sample downloads safely.</p>}
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
              <Field title="Garment size *"><select className={INPUT} value={customer.size} onChange={(e) => updateCustomer('size', e.target.value)}>{SIZES.map((size) => <option key={size}>{size}</option>)}</select></Field>
              <Field title="Quantity *"><input className={INPUT} type="number" min={1} max={100} required value={customer.quantity} onChange={(e) => updateCustomer('quantity', e.target.value)}/></Field>
            </div>
            <Field title="Notes (optional)"><textarea className={INPUT} rows={3} maxLength={1000} value={customer.notes} onChange={(e) => updateCustomer('notes', e.target.value)} placeholder="Any requested changes or details?" /></Field>
            <label className="flex gap-3 text-sm leading-6 text-white/75">
              <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} className="mt-1.5 h-4 w-4 accent-lime-300" required />
              <span>I have permission to use the photos I uploaded and understand this is a free preview request, not a completed order.</span>
            </label>
            <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={customer.website} onChange={(e) => updateCustomer('website', e.target.value)}/></label></div>
            {sendError && <p role="alert" className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{sendError}</p>}
            <button type="submit" disabled={isCloudflareBranchPreview || !selectedResult || previewBusy || cutoutPending || sending || !headline.trim()} className={BTN + ' w-full bg-lime-300 py-3 text-black hover:bg-lime-200'}>
              {sending ? <Loader2 className="animate-spin" size={18}/> : <ShieldCheck size={18}/>}
              {sending ? 'Sending your request…' : (isCloudflareBranchPreview ? 'Request submission disabled in preview' : 'Submit Sample ' + selected + ' request')}
              {!sending && <ArrowRight size={18}/>}
            </button>
            <p className="text-xs leading-5 text-white/55">This sends contact info and design selections through GDP's existing request system. Images remain on your device; GDP will request the original photo files. No payment or automatic order is created.</p>
          </form>}
          <p className="mt-5 text-xs text-white/55">Need full editing instead? <Link to="/custom-studio" className="font-bold text-lime-300 underline">Open the original GDP Custom Studio</Link>.</p>
        </section>
      </div>
    </div>
    {helpOpen && <QuickDesignHelp onClose={closeHelp} details={{
      headline,
      subline,
      selected,
      background: selectedBackground?.name || '',
      font: QUICK_DESIGN_FONTS.find((font) => font.id === fontId)?.label || 'Street Impact',
      curve,
      photoCount: photos.length,
      fontSizePercent,
      premiumStyle: selectedPremium?.label || 'Solid color',
      garment: selectedGarment.label,
      garmentSide,
    }} />}
  </div>;
}
