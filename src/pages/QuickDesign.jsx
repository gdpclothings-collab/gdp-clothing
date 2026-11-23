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
import { requestQuickDesignRemoveBgCutout, checkQuickDesignRemoveBgConnection } from '@/lib/quickDesignRemoveBgClient';
import { detectQuickDesignBackground } from '@/lib/quickDesignTransparency';
import { PREMIUM_TEXT_STYLES } from '@/lib/customStudioV2PremiumTextStyles';
import { QUICK_DESIGN_GARMENTS, QUICK_DESIGN_COLORS, QUICK_DESIGN_SIDES, renderQuickDesignGarmentMockup } from '@/lib/quickDesignGarmentMockup';
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
  const cutoutRunRef = useRef(0);
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
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [connectionChecking, setConnectionChecking] = useState(false);
  const [accent, setAccent] = useState(ACCENTS[2]);
  const [results, setResults] = useState([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [garmentMockup, setGarmentMockup] = useState('');
  const [garment, setGarment] = useState('');
  const [garmentColor, setGarmentColor] = useState('');
  const [garmentSide, setGarmentSide] = useState('');
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
  const selectedResult = results[0] || null;
  const selectedMockup = garmentMockup;
  const selectedGarment = QUICK_DESIGN_GARMENTS.find((item) => item.id === garment);
  const selectedColor = QUICK_DESIGN_COLORS.find((item) => item.id === garmentColor);
  const placementChosen = Boolean(selectedGarment && selectedColor && QUICK_DESIGN_SIDES.some((item) => item.id === garmentSide));
  const selectedPremium = PREMIUM_TEXT_STYLES.find((item) => item.id === premiumStyle);
  const cutoutPending = autoCutout && photos.some((item) => item.bgStatus === 'pending' || item.bgStatus === 'checking' || item.bgStatus === 'working');

  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
  }, []);

  // One local transparency preflight per photo. An already-transparent image
  // is preserved unchanged (same source URL and file bytes, zero API calls).
  // Opaque photos enter the existing remove.bg proxy only after consent.
  useEffect(() => {
    if (!autoCutout || cutoutBusy || cutoutUnavailable) return;
    const target = photos.find((item) => item.bgStatus === 'pending');
    if (!target) return;
    const run = cutoutRunRef.current;
    const validTarget = () => run === cutoutRunRef.current && urlsRef.current.has(target.url);
    setCutoutBusy(true);
    setCutoutError('');
    setPhotos((items) => items.map((item) => item.id === target.id
      ? { ...item, bgStatus: 'checking' } : item));

    (async () => {
      const transparency = await detectQuickDesignBackground(target.file);
      if (!validTarget()) return;
      if (transparency === 'already-transparent') {
        setPhotos((items) => items.map((item) => item.id === target.id
          ? { ...item, bgStatus: 'skipped' } : item));
        return;
      }
      if (transparency === 'unreadable') {
        setPhotos((items) => items.map((item) => item.id === target.id
          ? { ...item, bgStatus: 'failed' } : item));
        setCutoutError('Could not inspect this photo safely. Its original remains unchanged. Try a JPG, PNG or WebP upload.');
        return;
      }
      // "needs-removal" means no alpha cutout was detected, NOT that an AI
      // already recognized the background or confirmed the subject.
      setPhotos((items) => items.map((item) => item.id === target.id
        ? { ...item, bgStatus: 'working' } : item));
      const result = await requestQuickDesignRemoveBgCutout(target.file);
      if (!validTarget()) {
        if (result.cutoutUrl) URL.revokeObjectURL(result.cutoutUrl);
        return;
      }
      if (result.ok && result.cutoutUrl) {
        urlsRef.current.add(result.cutoutUrl);
        setPhotos((items) => items.map((item) => item.id === target.id
          ? { ...item, cutoutUrl: result.cutoutUrl, bgStatus: 'done' } : item));
        return;
      }
      // Preserve originals and successful prior cutouts on quota/config/error.
      // No retries that could accidentally consume remaining free credits.
      setCutoutError(result.message || 'Automatic background removal is unavailable.');
      setCutoutUnavailable(true);
      setAutoCutout(false);
      setPhotos((items) => items.map((item) => item.id === target.id
        ? { ...item, bgStatus: 'failed' } : item));
    })().catch(() => {
      if (!validTarget()) return;
      setCutoutError('Background removal is unavailable. Your original photo is safe. You may use remove.bg separately.');
      setCutoutUnavailable(true);
      setAutoCutout(false);
      setPhotos((items) => items.map((item) => item.id === target.id
        ? { ...item, bgStatus: 'failed' } : item));
    }).finally(() => setCutoutBusy(false));
  }, [photos, autoCutout, cutoutBusy, cutoutUnavailable]);

  useEffect(() => {
    if (!placementChosen || !photos.length || !selectedBackground) {
      setResults([]);
      setPreviewBusy(false);
      setPreviewError('');
      return undefined;
    }
    let cancelled = false;
    setPreviewBusy(true);
    setPreviewError('');
    const options = {
      photos: photos.map((item) => ({ ...item, url: item.cutoutUrl || item.url })),
      backgroundUrl: selectedBackground.fullAsset || selectedBackground.assetUrl,
      headline: headline || 'YOUR NAME',
      subline: subline.trim(),
      accent,
      fontId,
      curve,
      fontSizePercent,
      premiumStyle,
    };
    renderQuickDesignArtwork(options).then((canvas) => {
      if (!cancelled) setResults([{ artwork: canvas.toDataURL('image/png') }]);
    }).catch((error) => {
      if (!cancelled) {
        setResults([]);
        setPreviewError(error?.message || 'Could not render your design.');
      }
    }).finally(() => { if (!cancelled) setPreviewBusy(false); });
    return () => { cancelled = true; };
  }, [photos, selectedBackground, headline, subline, accent, fontId, curve, fontSizePercent, premiumStyle, placementChosen]);

  // Show only one selected garment/color/print-side mockup. Each choice is
  // explicit: changing the garment resets color and side; changing color
  // resets side. This prevents showing a stale/mismatched mockup.
  useEffect(() => {
    if (!placementChosen || !selectedResult?.artwork || previewBusy) {
      setGarmentMockup('');
      setGarmentBusy(false);
      return undefined;
    }
    let cancelled = false;
    setGarmentBusy(true);
    setGarmentError('');
    setGarmentMockup('');
    renderQuickDesignGarmentMockup({
      artworkSource: selectedResult.artwork, garment, side: garmentSide, color: garmentColor,
    }).then((canvas) => {
      if (!cancelled) setGarmentMockup(canvas.toDataURL('image/jpeg', 0.89));
    }).catch((error) => {
      if (!cancelled) setGarmentError(error?.message || 'Could not render your selected garment.');
    }).finally(() => {
      if (!cancelled) setGarmentBusy(false);
    });
    return () => { cancelled = true; };
  }, [selectedResult?.artwork, garment, garmentColor, garmentSide, placementChosen, previewBusy]);

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
    cutoutRunRef.current += 1;
    setHeadline('');
    setSubline('');
    setFontId('serif');
    setCurve('up');
    setFontSizePercent(100);
    setPremiumStyle('gold-chrome');
    setGarment('');
    setGarmentColor('');
    setGarmentSide('');
    setGarmentMockup('');
    setCutoutError('');
    setCutoutUnavailable(false);
    setConnectionStatus(null);
    setAutoCutout(false);
    setBackgroundId(PHASE_B_DEFAULT_BACKGROUND);
    setAccent(ACCENTS[2]);
    setResults([]);
    setSubmitted(null);
    setMessage('');
  };

  const shareFiles = async () => {
    if (!selectedMockup || !navigator.share || !navigator.canShare) {
      setMessage('Sharing is unavailable in this browser. Download the sample and attach it with your original photos when GDP contacts you.');
      return;
    }
    try {
      const blob = await (await fetch(selectedMockup)).blob();
      const files = [new File([blob], 'GDP-' + garmentColor + '-' + garment + '-' + garmentSide + '-mockup.jpg', { type: 'image/jpeg' }), ...photos.map((item) => item.file)];
      if (!navigator.canShare({ files })) {
        setMessage('Your device cannot share these files together. Download the sample and send your photos separately.');
        return;
      }
      await navigator.share({ files, title: 'GDP Clothing garment mockup', text: 'GDP Quick Design — ' + selectedColor.label + ' ' + selectedGarment.label + ', ' + garmentSide + ' print only. Please share these files with GDP Clothing.' });
    } catch (error) {
      if (error?.name !== 'AbortError') setMessage('Could not share the files. You can download the sample instead.');
    }
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    if (isCloudflareBranchPreview) { setSendError('This is the development preview. Sending customer requests is disabled here. No details were submitted.'); return; }
    setSendError('');
    setSubmitted(null);
    if (!placementChosen || !selectedResult || !selectedMockup || previewBusy || garmentBusy || !photos.length) {
      setSendError('Choose a garment, Black or White colour, and one print side first.');
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
        'Preview: Phase C STORM-style garment mockup (one print side only)',
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
        'Garment: ' + selectedColor.label + ' ' + selectedGarment.label + ', size: ' + customer.size,
        'Requested garment color: ' + selectedColor.label + ' (' + garmentColor + ')',
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
        garmentType: selectedColor.label + ' ' + selectedGarment.label + ' – ' + customer.size,
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
  const checkRemoveBgConnection = async () => {
    setConnectionChecking(true);
    setConnectionStatus(null);
    const result = await checkQuickDesignRemoveBgConnection();
    setConnectionStatus(result);
    setConnectionChecking(false);
  };

  const switchCutouts = (enabled) => {
    cutoutRunRef.current += 1;
    setAutoCutout(enabled);
    if (enabled) {
      setCutoutUnavailable(false);
      setCutoutError('');
      setPhotos((items) => items.map((item) => !item.cutoutUrl && item.bgStatus !== 'skipped' ? { ...item, bgStatus: 'pending' } : item));
    }
  };

  return <div className="min-h-screen w-full min-w-0 max-w-full overflow-x-clip bg-[#090b0e] text-white" data-gdp-quick-design="true">
    <section className="border-b border-white/10 bg-gradient-to-br from-[#131c20] via-[#111016] to-[#16121d] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-lime-300">GDP Clothing • Marketplace Quick Design</p>
          <button type="button" data-gdp-help-trigger="header" onClick={() => setHelpOpen(true)} aria-haspopup="dialog" aria-expanded={helpOpen} aria-controls="gdp-quick-design-help-dialog" className={BTN + ' border border-lime-300/40 bg-lime-300/10 text-lime-100 hover:bg-lime-300/20'}><HelpCircle size={19}/> Help with my design</button>
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Your design. <span className="text-lime-300">On any garment.</span></h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-white/70">First choose your garment, colour and print side, then upload photos and personalize the design. Preview only your selected garment. No paid image generation required.</p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-white/70">
          <span className="rounded-full border border-white/20 px-3 py-2">Choose garment &amp; print side first</span>
          <span className="rounded-full border border-white/20 px-3 py-2">On-device sample rendering</span>
          <span className="rounded-full border border-white/20 px-3 py-2">T-shirt, sweatshirt and hoodie previews</span>
        </div>
      </div>
    </section>

    <div className="mx-auto grid min-w-0 max-w-6xl grid-cols-[minmax(0,1fr)] gap-7 px-4 py-9 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-7">
        <section className="min-w-0 rounded-2xl border border-lime-300/25 bg-white/5 p-5" data-gdp-garment-first="true">
          <SmallHeading number="1">Choose your garment</SmallHeading>
          <p className="mb-3 text-xs text-white/65">Select garment, colour, then one print side.</p>
          <div role="group" aria-label="Choose garment type" className="grid grid-cols-3 gap-2">
            {QUICK_DESIGN_GARMENTS.map((item) =>
              <button key={item.id} type="button" aria-label={'Choose ' + item.label} aria-pressed={garment === item.id}
                onClick={() => { setGarment(item.id); setGarmentColor(''); setGarmentSide(''); setSubmitted(null); }}
                className={'min-h-14 min-w-0 rounded-xl border-2 px-1 py-2 text-center text-xs font-extrabold transition sm:text-sm ' + (garment === item.id ? 'border-lime-300 bg-lime-300/10 text-lime-100' : 'border-white/15 bg-black/20 text-white/75 hover:border-white/50')}>
                <span className="block">{item.label}</span>
              </button>
            )}
          </div>
          {garment ? <>
            <p className="mb-2 mt-4 text-xs font-bold text-white/75">Choose garment colour</p>
            <div role="group" aria-label="Choose garment color" data-gdp-color-selector="true" className="grid grid-cols-2 gap-2">
              {QUICK_DESIGN_COLORS.map((item) =>
                <button key={item.id} type="button" aria-label={'Choose ' + item.label + ' garment color'} aria-pressed={garmentColor === item.id}
                  onClick={() => { setGarmentColor(item.id); setGarmentSide(''); setSubmitted(null); }}
                  className={'flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-extrabold transition ' + (garmentColor === item.id ? 'border-lime-300 bg-lime-300/10 text-lime-100' : 'border-white/15 bg-black/20 text-white/75 hover:border-white/40')}>
                  <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border border-white/30 shadow-sm" style={{ backgroundColor: item.hex }} />
                  {item.label}
                </button>
              )}
            </div>
            {garmentColor ? <>
              <p className="mb-2 mt-4 text-xs font-bold text-white/75">Which side do you want printed?</p>
              <div role="group" aria-label="Choose print side" className="grid grid-cols-2 gap-2">
                {QUICK_DESIGN_SIDES.map((item) =>
                  <button key={item.id} type="button" aria-label={'Print on ' + item.label} aria-pressed={garmentSide === item.id}
                    onClick={() => { setGarmentSide(item.id); setSubmitted(null); }}
                    className={'min-h-12 rounded-xl border-2 px-3 py-2 text-sm font-extrabold transition ' + (garmentSide === item.id ? 'border-lime-300 bg-lime-300/10 text-lime-100' : 'border-white/15 bg-black/20 text-white/75 hover:border-white/40')}>
                    {item.label}
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-white/55">Select one side only. Front and Back are separate printing options.</p>
            </> : <p className="mt-3 text-xs text-white/55">Select Black or White to choose Front or Back.</p>}
          </> : <p className="mt-3 text-xs text-white/55">Select a garment to choose its colour and print side.</p>}
          {placementChosen && <p role="status" data-gdp-garment-choice="true" className="mt-3 flex items-center gap-2 text-sm font-semibold text-lime-200"><CheckCircle2 size={16}/> {selectedColor.label} {selectedGarment.label} · {garmentSide === 'front' ? 'Front' : 'Back'} printing selected</p>}
        </section>

        <section className="min-w-0 rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="2">Upload photos</SmallHeading>
          <label aria-disabled={!placementChosen} className={"flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/25 bg-black/20 p-4 text-center " + (placementChosen ? "cursor-pointer hover:border-lime-300" : "cursor-not-allowed opacity-55")}>
            <ImagePlus size={25} className="text-lime-300" />
            <span className="font-bold">Add 1–5 photos</span>
            <span className="text-xs text-white/60">JPG, PNG or WebP · 10 MB maximum each</span>
            <input aria-label="Upload customer photos" className="sr-only" disabled={!placementChosen} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} />
          </label>
          {!placementChosen && <p className="mt-2 text-xs text-white/60">Select a garment, Black or White colour, and Front or Back in Step 1 to enable uploads.</p>}
          {photos.length > 0 && <div data-gdp-photo-grid="true" className="mt-3 grid min-w-0 max-w-full grid-cols-5 gap-1.5 sm:gap-2">{photos.map((item, index) =>
            <div key={item.id} className="relative aspect-square min-w-0 overflow-hidden rounded-lg border border-white/20">
              <img src={item.cutoutUrl || item.url} alt={'Uploaded photo ' + (index + 1)} className="block h-full w-full max-w-full bg-neutral-700 object-contain" />
              <button type="button" onClick={() => removePhoto(item.id)} aria-label={'Remove photo ' + (index + 1)} className="absolute right-0 top-0 rounded-bl-lg bg-black/80 p-1 text-white"><Trash2 size={14}/></button>
              {item.bgStatus === 'skipped' && <span className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 text-center text-[9px] font-bold text-lime-200" data-gdp-photo-status="transparent">Transparent</span>}
              {item.bgStatus === 'done' && <span className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 text-center text-[9px] font-bold text-lime-200" data-gdp-photo-status="removed">Removed</span>}
              {item.bgStatus === 'failed' && <span className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 text-center text-[9px] font-bold text-amber-200" data-gdp-photo-status="failed">Original kept</span>}
              {!autoCutout && item.bgStatus === 'pending' && <span className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 text-center text-[9px] font-bold text-white" data-gdp-photo-status="off">Original</span>}
            </div>
          )}</div>}
          {photos.length > 0 && !autoCutout && !cutoutBusy && !cutoutUnavailable && photos.some((item) => !item.cutoutUrl && item.bgStatus !== 'skipped') && <div className="mt-3">
            <button type="button" onClick={() => switchCutouts(true)} className={BTN + ' w-full bg-lime-300 text-black hover:bg-lime-200'} data-gdp-remove-photos="true">Remove backgrounds</button>
            <p className="mt-1.5 text-center text-[11px] leading-4 text-white/55">Uses remove.bg for opaque photos only. Transparent images stay unchanged.</p>
          </div>}
          {cutoutPending && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-lime-200"><Loader2 size={15} className="animate-spin"/> Removing backgrounds…</p>}
          {photos.length > 0 && autoCutout && !cutoutPending && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-lime-200" data-gdp-auto-remove-status="on"><span><CheckCircle2 size={14} className="mr-1 inline"/> Auto-removal on for new uploads</span><button type="button" onClick={() => switchCutouts(false)} className="min-h-9 rounded-lg border border-white/20 px-3 text-white/70 hover:bg-white/10">Turn off</button></div>}
          {cutoutError && <div role="alert" className="mt-3 min-w-0 max-w-full rounded-lg bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
            <p className="break-words">{cutoutError}</p>
            <a href="https://www.remove.bg/" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block font-bold text-amber-100 underline underline-offset-2">Open remove.bg (external)</a>
          </div>}
          <details className="mt-3 min-w-0 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-xs text-white/65" data-gdp-removal-help="true">
            <summary className="cursor-pointer py-1 font-semibold text-white/80">Background removal help</summary>
            <div className="space-y-2 pb-2 pt-3 leading-5">
              <p>Removing a background sends opaque photos to remove.bg after you tap the button. Existing transparent PNG/WebP images are kept as uploaded. Free preview limits apply; your originals stay safe.</p>
              <button type="button" onClick={checkRemoveBgConnection} disabled={connectionChecking} className={BTN + ' w-full border border-white/25 bg-black/30 text-white/85 hover:bg-white/10'} data-gdp-check-removal="true">{connectionChecking ? 'Checking connection…' : 'Check remove.bg connection'}</button>
              {connectionStatus && <p role="status" data-gdp-removal-connection={connectionStatus.code} className={'break-words ' + (connectionStatus.ready ? 'text-lime-200' : 'text-amber-200')}>{connectionStatus.message}</p>}
              {!cutoutError && <a href="https://www.remove.bg/" target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-lime-200 underline underline-offset-2">Open remove.bg (external)</a>}
              <p>These are low-resolution design previews, not 300-DPI print files.</p>
            </div>
          </details>
          {message && <p role="status" className="mt-3 min-w-0 max-w-full break-words rounded-lg bg-amber-300/10 p-3 text-sm text-amber-200">{message}</p>}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <SmallHeading number="3">Choose a GDP background</SmallHeading>
          <p className="mb-3 text-xs text-white/60">Choose an original GDP background. Phase C keeps its effects behind your pets and toward the bottom, with your name above.</p>
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
          <SmallHeading number="4">Personalize the text</SmallHeading>
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
        <section className="min-w-0 rounded-2xl border border-white/15 bg-white/5 p-5" data-gdp-garment-preview="true">
          <SmallHeading number="5">Your garment preview</SmallHeading>
          <p className="mb-4 text-xs leading-5 text-white/65">One STORM-inspired design on your selected garment colour and print side. Your name stays above the pets; the GDP storm/flame background sits mainly below.</p>
          {!placementChosen ? <div role="status" data-gdp-preview-gated="true" className="rounded-xl border border-dashed border-white/20 bg-black/20 p-8 text-center text-sm text-white/60">First choose your garment, colour, and Front or Back in Step 1.</div> :
          !photos.length ? <div role="status" data-gdp-preview-gated="true" className="rounded-xl border border-dashed border-white/20 bg-black/20 p-8 text-center text-sm text-white/60">Add a photo in Step 2 to see your selected mockup.</div> :
          previewBusy || garmentBusy ? <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-white/70"><Loader2 className="animate-spin" /> Creating your selected mockup…</div> :
          previewError || garmentError ? <p role="alert" className="rounded-xl bg-red-950/50 p-4 text-sm text-red-200">{previewError || garmentError}</p> :
          selectedMockup ? <>
            <p data-gdp-preview-label="true" className="mb-3 text-sm font-bold text-lime-200">{selectedColor.label} {selectedGarment.label} · {garmentSide === 'front' ? 'Front' : 'Back'} print</p>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#16171b]">
              <img data-gdp-garment-image="true" src={selectedMockup}
                alt={selectedColor.label + ' ' + selectedGarment.label + ' ' + garmentSide + ' mockup with STORM-style artwork'} className="mx-auto max-h-[560px] w-full object-contain" />
            </div>
            <p className="mt-3 text-xs leading-5 text-white/55">Only {garmentSide} printing is selected. The other side is not included. Studio-rendered illustration, not a manufacturer-certified photo. Actual print size and placement require GDP approval.</p>
            <p className="mt-2 text-xs leading-5 text-white/55">{MAX_PREVIEW_NOTICE}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadSample(selectedMockup, 'GDP-' + garmentColor + '-' + garment + '-' + garmentSide + '-mockup.jpg')} className={BTN + ' bg-white text-black hover:bg-white/90'}><Download size={16}/> Save mockup</button>
              <button type="button" onClick={shareFiles} className={BTN + ' border border-white/20 hover:bg-white/10'}><Share2 size={16}/> Share mockup + photos</button>
            </div>
          </> : <p className="rounded-xl bg-black/20 p-6 text-center text-sm text-white/60">Your selected garment preview will appear here.</p>}
        </section>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SmallHeading number="6">Request this design</SmallHeading>
            <button type="button" data-gdp-help-trigger="request" aria-haspopup="dialog" aria-expanded={helpOpen} aria-controls="gdp-quick-design-help-dialog" onClick={() => setHelpOpen(true)} className={BTN + ' border border-white/25 bg-white/5 text-white hover:bg-white/10'}><HelpCircle size={17}/> Need design help?</button>
          </div>
          {isCloudflareBranchPreview && <p role="status" className="mb-4 rounded-xl border border-amber-300/40 bg-amber-200/10 p-3 text-sm text-amber-100">Development preview: request submissions are disabled to protect live customer data. You can test your selected garment mockup and save the preview image safely.</p>}
          <p className="mb-5 text-sm leading-6 text-white/65">Your garment, colour and print side were selected in Step 1. This is a design request, not a purchase or payment.</p>
          {submitted ? <div role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-5">
            <CheckCircle2 className="text-emerald-300" size={26} />
            <h3 className="mt-2 text-xl font-black">Your design request was received.</h3>
            <p className="mt-2 text-sm leading-6 text-white/75">GDP received your contact details and selected {selectedColor.label} {selectedGarment.label} {garmentSide} mockup. <strong>Your photos and preview image have not been uploaded.</strong> Save/share the sample with its original photos when GDP contacts you, so production can proceed.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadSample(selectedMockup, 'GDP-' + garmentColor + '-' + garment + '-' + garmentSide + '-mockup.jpg')} className={BTN + ' bg-lime-300 text-black'}><Download size={16}/> Save selected mockup</button>
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
            <button type="submit" disabled={isCloudflareBranchPreview || !placementChosen || !selectedMockup || previewBusy || garmentBusy || cutoutPending || sending || !headline.trim()} className={BTN + ' w-full bg-lime-300 py-3 text-black hover:bg-lime-200'}>
              {sending ? <Loader2 className="animate-spin" size={18}/> : <ShieldCheck size={18}/>}
              {sending ? 'Sending your request…' : (isCloudflareBranchPreview ? 'Request submission disabled in preview' : 'Submit design request')}
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
      printSide: garmentSide,
      background: selectedBackground?.name || '',
      font: QUICK_DESIGN_FONTS.find((font) => font.id === fontId)?.label || 'Street Impact',
      curve,
      photoCount: photos.length,
      fontSizePercent,
      premiumStyle: selectedPremium?.label || 'Solid color',
      garment: selectedGarment?.label || '(not chosen)',
      garmentColor: selectedColor?.label || '(not chosen)',
      garmentSide,
    }} />}
  </div>;
}
